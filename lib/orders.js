'use strict';

/**
 * Shared order-creation pipeline.
 * Used by the public checkout API and by admin manual orders, so pricing
 * (subtotal, coupon discount, shipping, total) is ALWAYS computed
 * server-side from DB prices. Never trust client-supplied totals.
 */
const {
  client,
  ready,
  parseProduct,
  nowISO,
  isNonEmptyString,
  isPositiveInt,
  sanitizeText,
  getCouponByCode,
  checkCoupon,
  shippingFor,
} = require('./db');

function cleanCustomer(customer) {
  const out = {
    name: sanitizeText(customer.name, 100),
    phone: sanitizeText(customer.phone, 30),
    address: sanitizeText(customer.address, 300),
    city: sanitizeText(customer.city, 60),
  };
  if (customer && isNonEmptyString(customer.email)) {
    out.email = sanitizeText(customer.email, 120);
  }
  return out;
}

function validateCustomer(customer) {
  if (
    !customer || !isNonEmptyString(customer.name) || !isNonEmptyString(customer.phone) ||
    !isNonEmptyString(customer.address) || !isNonEmptyString(customer.city)
  ) {
    return 'Name, phone, address and city are required.';
  }
  return null;
}

/**
 * Build priced line items from DB. Throws { status, error } on problems.
 * Returns { lines, subtotal }.
 */
async function priceLines(c, items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
    throw { status: 400, error: 'Items must be a non-empty array (max 20).' };
  }
  const lines = [];
  let subtotal = 0;
  for (const it of items) {
    const id = it && it.id;
    const qty = it && it.qty;
    if (!isPositiveInt(id) || !isPositiveInt(qty) || qty > 10) {
      throw { status: 400, error: 'Each item needs a valid id and qty (max 10).' };
    }
    const r = await c.execute({
      sql: 'SELECT * FROM products WHERE id = ? AND active = 1',
      args: [id],
    });
    if (!r.rows.length) throw { status: 400, error: `Product ${id} not found or unavailable.` };
    const p = parseProduct(r.rows[0]);
    if (p.stock < qty) {
      throw { status: 400, error: `Only ${p.stock} left in stock for "${p.name}".` };
    }
    // Color is informational only (pricing/stock are per-product, not per-variant).
    const color = it && typeof it.color === 'string' && it.color.trim()
      ? it.color.trim().slice(0, 40)
      : null;
    const line = { id: p.id, sku: p.sku, name: p.name, price: p.price, qty, image: p.image };
    if (color) line.color = color;
    const size = it && typeof it.size === 'string' && it.size.trim()
      ? it.size.trim().slice(0, 20)
      : null;
    if (size) line.size = size;
    lines.push(line);
    subtotal += p.price * qty;
  }
  return { lines, subtotal };
}

/**
 * Create an order. All pricing server-side.
 * opts: { customer, items, notes, payment, couponCode, source, customerId }
 * customerId (optional, number): verified customer id — stored on the order
 * so the account page can list order history. Never trust client body for it.
 * Returns { order_id, subtotal, discount, shipping, total }.
 * Throws { status, error }.
 */
async function createOrder(opts) {
  const { customer, items, notes, payment, couponCode, source, customerId } = opts || {};
  const custErr = validateCustomer(customer);
  if (custErr) throw { status: 400, error: custErr };

  const pay = payment === 'bank' ? 'bank' : 'cod';
  const cleanNotes = notes && isNonEmptyString(notes) ? sanitizeText(notes, 500) : null;
  const cid = Number.isInteger(customerId) && customerId > 0 ? customerId : null;

  await ready();
  const c = client();

  const { lines, subtotal } = await priceLines(c, items);

  // Coupon: validated server-side, discount stored on the order.
  let discount = 0;
  let coupon_code = null;
  if (couponCode && isNonEmptyString(couponCode)) {
    const coupon = await getCouponByCode(couponCode);
    const chk = checkCoupon(coupon, subtotal);
    if (!chk.ok) throw { status: 400, error: chk.error };
    discount = chk.discount;
    coupon_code = coupon.code;
  }

  const shipping = await shippingFor(subtotal - discount);
  const total = subtotal - discount + shipping;

  // Decrement stock, insert order, bump coupon usage — best-effort atomic
  // enough at this scale (single Node process per instance).
  for (const l of lines) {
    const upd = await c.execute({
      sql: 'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
      args: [l.qty, l.id, l.qty],
    });
    if (upd.rowsAffected === 0) {
      throw { status: 400, error: `Just ran out of stock for "${l.name}".` };
    }
  }
  if (coupon_code) {
    await c.execute({
      sql: 'UPDATE coupons SET used_count = used_count + 1 WHERE UPPER(code) = UPPER(?)',
      args: [coupon_code],
    });
  }
  const ins = await c.execute({
    sql: `INSERT INTO orders
            (customer, items, total, payment, notes, status, created_at, discount, coupon_code, customer_id)
          VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
    args: [
      JSON.stringify(cleanCustomer(customer)),
      JSON.stringify(lines),
      total,
      pay,
      cleanNotes,
      nowISO(),
      discount,
      coupon_code,
      cid,
    ],
  });
  const orderId = Number(ins.lastInsertRowid);
  return { order_id: orderId, subtotal, discount, shipping, total, coupon_code };
}

module.exports = { createOrder, priceLines, validateCustomer };
