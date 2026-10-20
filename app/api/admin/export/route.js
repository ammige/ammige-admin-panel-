import { NextResponse } from 'next/server';
import { client, ready, parseOrder, parseProduct } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { checkRate } from '@/lib/rate-limit';

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csv(rows) {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export async function GET(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (!checkRate(req, { windowMs: 60_000, max: 30, scope: 'admin-export' })) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  await ready();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const c = client();
  const stamp = new Date().toISOString().slice(0, 10);

  if (type === 'orders') {
    const r = await c.execute({ sql: 'SELECT * FROM orders ORDER BY id DESC' });
    const header = ['id', 'created_at', 'status', 'name', 'phone', 'address', 'city', 'items', 'payment', 'subtotal', 'discount', 'coupon_code', 'shipping', 'total', 'tracking_number', 'courier', 'notes', 'admin_notes'];
    const rows = [header];
    for (const o of r.rows.map(parseOrder)) {
      const itemsTxt = (o.items || []).map((i) => `${i.name} x${i.qty}`).join('; ');
      const subtotal = (o.items || []).reduce((s, i) => s + i.price * i.qty, 0);
      const shipping = Math.max(0, Number(o.total) - (subtotal - Number(o.discount || 0)));
      rows.push([
        o.id, o.created_at, o.status,
        o.customer?.name, o.customer?.phone, o.customer?.address, o.customer?.city,
        itemsTxt, o.payment,
        subtotal,
        o.discount, o.coupon_code || '', shipping, o.total,
        o.tracking_number || '', o.courier || '', o.notes || '', o.admin_notes || '',
      ]);
    }
    return new NextResponse(csv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ammige-orders-${stamp}.csv"`,
      },
    });
  }

  if (type === 'products') {
    const r = await c.execute({ sql: 'SELECT * FROM products ORDER BY id DESC' });
    const header = ['id', 'sku', 'name', 'collection', 'price', 'old_price', 'stock', 'active', 'rating', 'reviews', 'created_at'];
    const rows = [header];
    for (const p of r.rows.map(parseProduct)) {
      rows.push([p.id, p.sku, p.name, p.collection, p.price, p.old_price ?? '', p.stock, p.active ? 1 : 0, p.rating, p.reviews, p.created_at]);
    }
    return new NextResponse(csv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ammige-products-${stamp}.csv"`,
      },
    });
  }

  if (type === 'newsletter') {
    const r = await c.execute({ sql: 'SELECT id, email, created_at FROM newsletter ORDER BY id DESC' });
    const rows = [['id', 'email', 'created_at']];
    for (const s of r.rows) rows.push([s.id, s.email, s.created_at]);
    return new NextResponse(csv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ammige-newsletter-${stamp}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: 'type must be "orders", "products" or "newsletter".' }, { status: 400 });
}
