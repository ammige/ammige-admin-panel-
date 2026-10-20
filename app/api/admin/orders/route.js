import { NextResponse } from 'next/server';
import { client, ready, parseOrder, ORDER_STATUSES } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { checkRate } from '@/lib/rate-limit';

export async function GET(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (!checkRate(req, { windowMs: 60_000, max: 120, scope: 'admin-read' })) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  await ready();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const payment = searchParams.get('payment');
  const q = (searchParams.get('q') || '').trim();
  const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit'), 10) || 25));
  const offset = (page - 1) * limit;

  const where = [];
  const args = [];
  if (status) {
    if (!ORDER_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
    }
    where.push('status = ?');
    args.push(status);
  }
  if (payment) {
    if (payment !== 'cod' && payment !== 'bank') {
      return NextResponse.json({ error: 'Invalid payment filter.' }, { status: 400 });
    }
    where.push('payment = ?');
    args.push(payment);
  }
  if (q) {
    if (/^\d+$/.test(q)) {
      where.push('id = ?');
      args.push(Number(q));
    } else {
      // customer is a JSON blob: name/phone/city live inside the text.
      where.push('customer LIKE ?');
      args.push(`%${q}%`);
    }
  }
  const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const c = client();
  const totalR = await c.execute({ sql: `SELECT COUNT(*) AS c FROM orders ${whereSQL}`, args });
  const total = Number(totalR.rows[0].c);
  const r = await c.execute({
    sql: `SELECT * FROM orders ${whereSQL} ORDER BY id DESC LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });
  return NextResponse.json({
    items: r.rows.map(parseOrder),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}
