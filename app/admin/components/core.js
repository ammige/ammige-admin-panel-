'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { fmtRs, fmtDate } from './shared';

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const NEXT_STATUS = { pending: 'confirmed', confirmed: 'shipped', shipped: 'delivered' };

function ChangeBadge({ v }) {
  if (v === null || v === undefined) return null;
  const up = v > 0;
  const flat = v === 0;
  return (
    <small style={{ color: flat ? 'var(--muted)' : up ? '#1E7A46' : '#B3402E', fontWeight: 600 }}>
      {flat ? '—' : up ? `▲ ${v}%` : `▼ ${Math.abs(v)}%`} <span style={{ fontWeight: 400 }}>vs prev</span>
    </small>
  );
}


function RevenueChart({ series }) {
  const W = 720, H = 220, PAD = 36;
  const data = series || [];
  const maxV = Math.max(1, ...data.map((d) => d.revenue));
  const n = Math.max(1, data.length);
  const x = (i) => PAD + (i * (W - PAD * 2)) / Math.max(1, n - 1);
  const y = (v) => H - PAD - (v / maxV) * (H - PAD * 2);
  const pts = data.map((d, i) => [x(i), y(d.revenue)]);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${(H - PAD).toFixed(1)} L${x(0).toFixed(1)},${(H - PAD).toFixed(1)} Z`;
  const step = Math.ceil(n / 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Revenue chart">
      <defs>
        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C29B4B" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#C29B4B" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={PAD} x2={W - PAD} y1={y(maxV * f)} y2={y(maxV * f)} stroke="#EAE0CE" strokeDasharray="4 4" />
      ))}
      <path d={area} fill="url(#revFill)" />
      <path d={line} fill="none" stroke="#9C7A33" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="#9C7A33" stroke="#fff" strokeWidth="1.5">
          <title>{`${data[i].date}: ${fmtRs(data[i].revenue)} (${data[i].orders} orders)`}</title>
        </circle>
      ))}
      {data.map((d, i) =>
        i % step === 0 ? (
          <text key={d.date} x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="#8A7B5F">
            {d.date.slice(5)}
          </text>
        ) : null
      )}
    </svg>
  );
}


function Dashboard() {
  const [range, setRange] = useState('7d');
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/stats?range=${range}`)
      .then((r) => r.json())
      .then((j) => { setD(j); setLoading(false); })
      .catch(() => setLoading(false));
  }, [range]);

  if (loading || !d) return <div className="empty"><div className="display">Loading...</div></div>;
  const k = d.kpis || {};
  const ch = d.change || {};

  return (
    <>
      <div className="toolbar" style={{ marginTop: 0 }}>
        <div className="chips">
          {[['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days']].map(([v, label]) => (
            <button key={v} className={`chip ${range === v ? 'on' : ''}`} onClick={() => setRange(v)}>{label}</button>
          ))}
        </div>
        <a className="btn btn-outline btn-sm" href="/api/admin/export?type=orders">↓ Orders CSV</a>
      </div>

      <div className="stat-grid">
        <div className="stat"><small>Revenue</small><b>{fmtRs(k.revenue)}</b><ChangeBadge v={ch.revenue} /></div>
        <div className="stat"><small>Orders</small><b>{k.orders}</b><ChangeBadge v={ch.orders} /></div>
        <div className="stat"><small>Avg. Order Value</small><b>{fmtRs(k.aov)}</b></div>
        <div className="stat"><small>Pending Orders</small><b>{k.pending}</b></div>
      </div>

      <div className="admin-card" style={{ marginTop: 20 }}>
        <h3 className="display" style={{ fontSize: 22, marginBottom: 12 }}>Revenue</h3>
        <RevenueChart series={d.series} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginTop: 20 }}>
        <div className="admin-card">
          <h3 className="display" style={{ fontSize: 22, marginBottom: 12 }}>Order Pipeline</h3>
          {STATUSES.map((s) => (
            <div key={s} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1E9DA' }}>
              <span className={`pill ${s}`} style={{ textTransform: 'capitalize' }}>{s}</span>
              <b>{d.statusBreakdown?.[s] || 0}</b>
            </div>
          ))}
        </div>

        <div className="admin-card">
          <h3 className="display" style={{ fontSize: 22, marginBottom: 12 }}>
            Top Products <small style={{ color: 'var(--muted)' }}>({range === 'today' ? 'today' : range === '7d' ? '7 days' : '30 days'})</small>
          </h3>
          {!(d.topProducts || []).length && <p style={{ color: 'var(--muted)' }}>No sales in this period yet.</p>}
          {(d.topProducts || []).map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1E9DA', gap: 8 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <b style={{ color: '#C29B4B', marginRight: 8 }}>#{i + 1}</b>{p.name}
              </span>
              <b style={{ whiteSpace: 'nowrap' }}>{p.qty} sold · {fmtRs(p.revenue)}</b>
            </div>
          ))}
        </div>

        <div className="admin-card">
          <h3 className="display" style={{ fontSize: 22, marginBottom: 12 }}>
            Low Stock <small style={{ color: '#B3402E' }}>({(d.lowStock || []).length})</small>
          </h3>
          {(d.lowStock || []).length === 0 && <p style={{ color: 'var(--muted)' }}>All stocked up. 🎉</p>}
          {(d.lowStock || []).map((p) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1E9DA', gap: 8 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              <b style={{ color: p.stock === 0 ? '#B3402E' : '#9C7A33', whiteSpace: 'nowrap' }}>
                {p.stock === 0 ? 'OUT' : `${p.stock} left`}
              </b>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 20, overflowX: 'auto', padding: 12 }}>
        <h3 className="display" style={{ fontSize: 22, marginBottom: 12, padding: '0 12px' }}>Recent Orders</h3>
        <table className="tbl">
          <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            {(d.recentOrders || []).map((o) => (
              <tr key={o.id}>
                <td><b>#{o.id}</b><br /><small style={{ color: 'var(--muted)' }}>{fmtDate(o.created_at)}</small></td>
                <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.customer?.name}</td>
                <td>{fmtRs(o.total)}</td>
                <td><span className={`pill ${o.status}`}>{o.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Orders                                                               */
/* ------------------------------------------------------------------ */


function Orders({ onPrint }) {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [payment, setPayment] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '25' });
    if (status) qs.set('status', status);
    if (payment) qs.set('payment', payment);
    if (q.trim()) qs.set('q', q.trim());
    const r = await fetch(`/api/admin/orders?${qs}`);
    const d = await r.json();
    setOrders(d.items || []);
    setPages(d.pages || 1);
    setTotal(d.total || 0);
    setLoading(false);
  }, [page, status, payment, q]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status, payment, q]);

  const openDetail = async (id) => {
    const r = await fetch(`/api/admin/orders/${id}`);
    if (r.ok) setDetail(await r.json());
  };

  return (
    <>
      <div className="toolbar" style={{ marginTop: 0, flexWrap: 'wrap' }}>
        <div className="search" style={{ minWidth: 200 }}>
          <input placeholder="Search id / name / phone..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" />
        </div>
        <select value={payment} onChange={(e) => setPayment(e.target.value)} aria-label="Payment filter" style={{ width: 'auto' }}>
          <option value="">All payments</option>
          <option value="cod">COD</option>
          <option value="bank">Bank</option>
        </select>
        <a className="btn btn-outline btn-sm" href="/api/admin/export?type=orders">↓ CSV</a>
      </div>
      <div className="chips" style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[['', 'All'], ...STATUSES.map((s) => [s, s])].map(([v, label]) => (
          <button key={v} className={`chip ${status === v ? 'on' : ''}`} onClick={() => setStatus(v)} style={{ textTransform: 'capitalize' }}>
            {label}
          </button>
        ))}
      </div>

      <div className="admin-card" style={{ overflowX: 'auto', padding: 12 }}>
        <table className="tbl">
          <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Pay</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><b>#{o.id}</b><br /><small style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDate(o.created_at)}</small></td>
                <td style={{ maxWidth: 170 }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.customer?.name}</span>
                  <small style={{ color: 'var(--muted)' }}>{o.customer?.phone}</small>
                </td>
                <td>{o.items?.reduce((s, i) => s + i.qty, 0)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtRs(o.total)}{o.discount ? <><br /><small style={{ color: '#1E7A46' }}>−{fmtRs(o.discount)} coupon</small></> : null}</td>
                <td style={{ textTransform: 'uppercase', fontSize: 12 }}>{o.payment}</td>
                <td><span className={`pill ${o.status}`}>{o.status}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => openDetail(o.id)}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="empty"><div className="display">Loading...</div></div>}
        {!loading && orders.length === 0 && <div className="empty"><div className="display">No orders found</div></div>}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, alignItems: 'center' }}>
        <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span style={{ fontSize: 14 }}>Page {page} of {pages} · {total} orders</span>
        <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
      </div>

      {detail && (
        <OrderDetail
          order={detail}
          onClose={() => setDetail(null)}
          onUpdated={(o) => { setDetail(o); load(); }}
          onPrint={onPrint}
        />
      )}
    </>
  );
}


function OrderDetail({ order, onClose, onUpdated, onPrint }) {
  const [o, setO] = useState(order);
  const [courier, setCourier] = useState(order.courier || '');
  const [tracking, setTracking] = useState(order.tracking_number || '');
  const [notes, setNotes] = useState(order.admin_notes || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setO(order);
    setCourier(order.courier || '');
    setTracking(order.tracking_number || '');
    setNotes(order.admin_notes || '');
    setMsg('');
  }, [order]);

  const patch = async (payload) => {
    setSaving(true);
    setMsg('');
    const r = await fetch(`/api/admin/orders/${o.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (r.ok) {
      setO(d);
      onUpdated(d);
      setMsg('Saved ✓');
    } else {
      setMsg(d.error || 'Save failed');
    }
  };

  const advance = () => {
    const next = NEXT_STATUS[o.status];
    if (next && confirm(`Mark order #${o.id} as "${next}"?`)) patch({ status: next });
  };
  const cancel = () => {
    if (confirm(`Cancel order #${o.id}? Stock will NOT be auto-restored — adjust manually if needed.`)) {
      patch({ status: 'cancelled' });
    }
  };

  const subtotal = (o.items || []).reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = Math.max(0, o.total - (subtotal - (o.discount || 0)));

  return (
    <div className="cart-overlay open" onClick={onClose}>
      <div
        className="admin-card"
        style={{ maxWidth: 720, margin: '32px auto', maxHeight: '88vh', overflowY: 'auto', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
          <h2 className="display" style={{ fontSize: 26, margin: 0 }}>Order #{o.id}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => onPrint(o)}>🖨 Print Invoice</button>
            <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <span className={`pill ${o.status}`} style={{ fontSize: 14 }}>{o.status}</span>
          <small style={{ color: 'var(--muted)' }}>{fmtDate(o.created_at)} · {o.payment?.toUpperCase()}</small>
          {NEXT_STATUS[o.status] && (
            <button className="btn btn-gold btn-sm" disabled={saving} onClick={advance} style={{ marginLeft: 'auto' }}>
              Mark as {NEXT_STATUS[o.status]} →
            </button>
          )}
          {o.status !== 'cancelled' && o.status !== 'delivered' && (
            <button className="btn btn-outline btn-sm" disabled={saving} onClick={cancel} style={{ color: '#B3402E' }}>
              Cancel order
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)' }}>Customer</h4>
            <b>{o.customer?.name}</b><br />
            <span style={{ overflowWrap: 'anywhere' }}>{o.customer?.phone}</span><br />
            <span style={{ color: 'var(--muted)' }}>{o.customer?.address}, {o.customer?.city}</span>
          </div>
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)' }}>Fulfillment</h4>
            <div className="f-group" style={{ marginBottom: 8 }}>
              <label>Courier</label>
              <select value={courier} onChange={(e) => setCourier(e.target.value)}>
                <option value="">— Select —</option>
                <option value="TCS">TCS</option>
                <option value="Leopards">Leopards</option>
                <option value="PostEx">PostEx</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="f-group" style={{ marginBottom: 0 }}>
              <label>Tracking number</label>
              <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. 123456789" />
            </div>
          </div>
        </div>

        <h4 style={{ margin: '0 0 8px', fontSize: 14, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)' }}>Items</h4>
        {(o.items || []).map((it, i) => (
          <div key={i} className="order-line">
            {it.image && <img src={it.image} alt={it.name} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</b>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>{it.sku ? `${it.sku} · ` : ''}Qty {it.qty} × {fmtRs(it.price)}</span>
            </div>
            <b style={{ whiteSpace: 'nowrap' }}>{fmtRs(it.price * it.qty)}</b>
          </div>
        ))}

        <div style={{ marginTop: 12, borderTop: '1px solid #F1E9DA', paddingTop: 12, maxWidth: 320, marginLeft: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Subtotal</span><span>{fmtRs(subtotal)}</span></div>
          {o.discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#1E7A46' }}>
              <span>Coupon {o.coupon_code ? `(${o.coupon_code})` : ''}</span><span>−{fmtRs(o.discount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Shipping</span><span>{shipping === 0 ? 'FREE' : fmtRs(shipping)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 700, fontSize: 18, borderTop: '1px solid #F1E9DA', marginTop: 4 }}>
            <span>Total</span><span>{fmtRs(o.total)}</span>
          </div>
        </div>

        {o.notes && <p style={{ marginTop: 12 }}><b>Customer note:</b> {o.notes}</p>}

        <div className="f-group" style={{ marginTop: 12 }}>
          <label>Internal notes (not shown to customer)</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Customer asked for gift wrap" />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
          <button className="btn btn-dark btn-sm" disabled={saving} onClick={() => patch({ courier: courier || null, tracking_number: tracking || null, admin_notes: notes || null })}>
            {saving ? 'Saving...' : 'Save courier / notes'}
          </button>
          {msg && <small style={{ color: msg.includes('✓') ? '#1E7A46' : '#B3402E' }}>{msg}</small>}
        </div>

        <div style={{ marginTop: 16 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)' }}>Status timeline</h4>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STATUSES.filter((s) => s !== 'cancelled').map((s) => {
              const order = ['pending', 'confirmed', 'shipped', 'delivered'];
              const cur = order.indexOf(o.status);
              const idx = order.indexOf(s);
              const done = o.status === 'cancelled' ? false : idx <= cur;
              return (
                <span key={s} className="pill" style={done ? { background: '#1E7A46', color: '#fff' } : {}}>{s}</span>
              );
            })}
            {o.status === 'cancelled' && <span className="pill cancelled">cancelled</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Printable invoice                                                    */
/* ------------------------------------------------------------------ */


function InvoicePrint({ order, onBack }) {
  const [brand, setBrand] = useState({ brand: 'AMMIGE', tagline: '', whatsapp: '' });
  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setBrand({ brand: d.brand || 'AMMIGE', tagline: d.tagline || '', whatsapp: d.whatsapp || '' }); })
      .catch(() => {});
  }, []);

  const o = order;
  const subtotal = (o.items || []).reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = Math.max(0, o.total - (subtotal - (o.discount || 0)));

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-sheet, #invoice-sheet * { visibility: visible; }
          #invoice-sheet { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
        #invoice-sheet { background: #fff; color: #111; padding: 32px; max-width: 760px; margin: 0 auto; font-family: Georgia, serif; }
        #invoice-sheet table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        #invoice-sheet th, #invoice-sheet td { border-bottom: 1px solid #ddd; padding: 8px 4px; text-align: left; font-size: 14px; }
        #invoice-sheet th { text-transform: uppercase; font-size: 11px; letter-spacing: .08em; color: #666; }
      `}</style>
      <div className="admin-wrap">
        <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button className="btn btn-outline btn-sm" onClick={onBack}>← Back</button>
          <button className="btn btn-gold btn-sm" onClick={() => window.print()}>🖨 Print / Save PDF</button>
        </div>
        <div id="invoice-sheet">
          <div style={{ textAlign: 'center', borderBottom: '2px solid #111', paddingBottom: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 34, letterSpacing: '.35em', fontWeight: 700 }}>AMMIGE</div>
            <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>{brand.tagline || 'Carry Grace Everywhere'}</div>
            {brand.whatsapp && <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>WhatsApp: {brand.whatsapp}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <b>INVOICE #{o.id}</b><br />
              <span style={{ fontSize: 13, color: '#555' }}>{fmtDate(o.created_at)}</span><br />
              <span style={{ fontSize: 13 }}>Payment: {o.payment === 'cod' ? 'Cash on Delivery' : 'Bank Transfer'}</span><br />
              <span style={{ fontSize: 13 }}>Status: {o.status}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <b>Bill To</b><br />
              <span style={{ fontSize: 14 }}>{o.customer?.name}</span><br />
              <span style={{ fontSize: 13, color: '#555' }}>{o.customer?.phone}<br />{o.customer?.address}, {o.customer?.city}</span>
            </div>
          </div>
          <table>
            <thead><tr><th>Item</th><th>SKU</th><th>Qty</th><th>Price</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>
              {(o.items || []).map((it, i) => (
                <tr key={i}>
                  <td>{it.name}</td><td>{it.sku || '—'}</td><td>{it.qty}</td>
                  <td>{fmtRs(it.price)}</td><td style={{ textAlign: 'right' }}>{fmtRs(it.price * it.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ textAlign: 'right', marginTop: 12, fontSize: 14 }}>
            <div>Subtotal: {fmtRs(subtotal)}</div>
            {o.discount > 0 && <div>Discount{o.coupon_code ? ` (${o.coupon_code})` : ''}: −{fmtRs(o.discount)}</div>}
            <div>Shipping: {shipping === 0 ? 'FREE' : fmtRs(shipping)}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>Total: {fmtRs(o.total)}</div>
          </div>
          {o.tracking_number && <p style={{ fontSize: 13 }}>Tracking: <b>{o.courier || ''} {o.tracking_number}</b></p>}
          <p style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: '#555' }}>
            Thank you for shopping with AMMIGE — 7-day easy exchange, premium gift packaging.
          </p>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Manual order (WhatsApp / phone sales)                                */
/* ------------------------------------------------------------------ */


function ManualOrder({ onCreated }) {
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '', city: '' });
  const [lines, setLines] = useState([]); // {id, qty, name, price, image, sku}
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  const [payment, setPayment] = useState('cod');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/admin/products?q=${encodeURIComponent(search.trim())}&limit=8`);
      const d = await r.json().catch(() => ({}));
      setResults(d.items || []);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const addLine = (p) => {
    setLines((ls) => {
      const ex = ls.find((l) => l.id === p.id);
      if (ex) return ls.map((l) => (l.id === p.id ? { ...l, qty: Math.min(10, l.qty + 1) } : l));
      return [...ls, { id: p.id, qty: 1, name: p.name, price: p.price, image: p.image, sku: p.sku, stock: p.stock }];
    });
    setSearch('');
    setResults([]);
  };

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const r = await fetch('/api/admin/orders/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer,
          items: lines.map((l) => ({ id: l.id, qty: l.qty })),
          notes: notes || undefined,
          payment,
          couponCode: couponCode.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not create order');
      setDone(d);
      setLines([]);
      setCouponCode('');
      setNotes('');
      onCreated && onCreated(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const setC = (k) => (e) => setCustomer({ ...customer, [k]: e.target.value });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
      <div className="admin-card">
        <h3 className="display" style={{ fontSize: 22, marginBottom: 16 }}>Customer</h3>
        <form onSubmit={submit}>
          <div className="f-group"><label>Name *</label><input required value={customer.name} onChange={setC('name')} /></div>
          <div className="f-group"><label>Phone *</label><input required value={customer.phone} onChange={setC('phone')} placeholder="03xx xxxxxxx" /></div>
          <div className="f-group"><label>Address *</label><input required value={customer.address} onChange={setC('address')} /></div>
          <div className="f-group"><label>City *</label><input required value={customer.city} onChange={setC('city')} /></div>
          <div className="f-row">
            <div className="f-group">
              <label>Payment</label>
              <select value={payment} onChange={(e) => setPayment(e.target.value)}>
                <option value="cod">COD</option>
                <option value="bank">Bank transfer</option>
              </select>
            </div>
            <div className="f-group"><label>Coupon (optional)</label><input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="EID20" style={{ textTransform: 'uppercase' }} /></div>
          </div>
          <div className="f-group"><label>Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></div>
          {error && <p style={{ color: '#B3402E', marginBottom: 12 }}>{error}</p>}
          {done && <p style={{ color: '#1E7A46', marginBottom: 12 }}>✓ Order #{done.order_id} created — {fmtRs(done.total)}</p>}
          <button className="btn btn-gold" type="submit" disabled={saving || lines.length === 0} style={{ width: '100%' }}>
            {saving ? 'Creating...' : `Create Order · ${fmtRs(subtotal)}`}
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h3 className="display" style={{ fontSize: 22, marginBottom: 16 }}>Products</h3>
        <div className="search" style={{ marginBottom: 12 }}>
          <input placeholder="Search products to add..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search products" />
        </div>
        {results.map((p) => (
          <button
            key={p.id}
            onClick={() => addLine(p)}
            style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', background: '#FDFAF3', border: '1px solid #F1E9DA', borderRadius: 10, padding: 8, marginBottom: 8, cursor: 'pointer' }}
          >
            {p.image && <img src={p.image} alt="" style={{ width: 40, height: 48, objectFit: 'cover', borderRadius: 6 }} />}
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <b style={{ whiteSpace: 'nowrap' }}>{fmtRs(p.price)}</b>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>{p.stock} in stock</span>
          </button>
        ))}
        {lines.length === 0 && <p style={{ color: 'var(--muted)' }}>No items yet — search and tap a product to add it.</p>}
        {lines.map((l) => (
          <div key={l.id} className="order-line">
            {l.image && <img src={l.image} alt={l.name} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</b>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>{fmtRs(l.price)} each</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setLines((ls) => ls.map((x) => (x.id === l.id ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}>−</button>
              <b>{l.qty}</b>
              <button className="btn btn-outline btn-sm" onClick={() => setLines((ls) => ls.map((x) => (x.id === l.id ? { ...x, qty: Math.min(10, x.qty + 1) } : x)))}>+</button>
              <button className="btn btn-outline btn-sm" onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))} aria-label="Remove">✕</button>
            </div>
            <b style={{ whiteSpace: 'nowrap' }}>{fmtRs(l.price * l.qty)}</b>
          </div>
        ))}
        {lines.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontWeight: 700 }}>
            <span>Subtotal</span><span>{fmtRs(subtotal)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Customers                                                            */
/* ------------------------------------------------------------------ */


function Customers() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [history, setHistory] = useState([]);

  const load = useCallback(async () => {
    const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    const r = await fetch(`/api/admin/customers${qs}`);
    setList(await r.json().catch(() => []));
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const openHistory = async (phone) => {
    if (expanded === phone) { setExpanded(null); return; }
    setExpanded(phone);
    const r = await fetch(`/api/admin/orders?q=${encodeURIComponent(phone)}&limit=50`);
    const d = await r.json().catch(() => ({}));
    setHistory(d.items || []);
  };

  return (
    <div className="admin-card" style={{ overflowX: 'auto', padding: 12 }}>
      <div className="toolbar" style={{ marginTop: 0 }}>
        <div className="search" style={{ minWidth: 220 }}>
          <input placeholder="Search name / phone / city..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" />
        </div>
      </div>
      <table className="tbl">
        <thead><tr><th>Customer</th><th>Phone</th><th>City</th><th>Orders</th><th>Total Spent</th><th>Last Order</th><th></th></tr></thead>
        <tbody>
          {list.map((c) => (
            <Fragment key={c.phone}>
              <tr>
                <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{c.phone}</td>
                <td>{c.city || '—'}</td>
                <td>{c.orders}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtRs(c.total_spent)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{c.last_order_id ? <>#{c.last_order_id} · {fmtDate(c.last_order)}</> : '—'}</td>
                <td><button className="btn btn-outline btn-sm" onClick={() => openHistory(c.phone)}>{expanded === c.phone ? 'Hide' : 'History'}</button></td>
              </tr>
              {expanded === c.phone && (
                <tr>
                  <td colSpan={7} style={{ background: '#FDFAF3' }}>
                    {history.length === 0 && <small style={{ color: 'var(--muted)' }}>Loading...</small>}
                    {history.map((o) => (
                      <div key={o.id} style={{ display: 'flex', gap: 12, padding: '6px 0', fontSize: 14, borderBottom: '1px solid #F1E9DA' }}>
                        <b>#{o.id}</b>
                        <span style={{ color: 'var(--muted)' }}>{fmtDate(o.created_at)}</span>
                        <span className={`pill ${o.status}`}>{o.status}</span>
                        <span style={{ marginLeft: 'auto' }}>{fmtRs(o.total)}</span>
                      </div>
                    ))}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      {list.length === 0 && <div className="empty"><div className="display">No customers yet</div></div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Coupons                                                              */
/* ------------------------------------------------------------------ */


function Coupons() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/coupons');
    setList(await r.json().catch(() => []));
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (c) => {
    await fetch(`/api/admin/coupons/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !c.active }),
    });
    load();
  };
  const remove = async (c) => {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    await fetch(`/api/admin/coupons/${c.id}`, { method: 'DELETE' });
    load();
  };

  const expired = (c) => c.expires_at && new Date(c.expires_at).getTime() < Date.now();

  return (
    <>
      <div className="toolbar" style={{ marginTop: 0 }}>
        <p style={{ color: 'var(--muted)', margin: 0, fontSize: 14 }}>Discount codes for campaigns & influencers.</p>
        <button className="btn btn-gold btn-sm" onClick={() => setEditing('new')}>+ New Coupon</button>
      </div>
      <div className="admin-card" style={{ overflowX: 'auto', padding: 12 }}>
        <table className="tbl">
          <thead><tr><th>Code</th><th>Discount</th><th>Min Order</th><th>Used</th><th>Expiry</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td><b style={{ letterSpacing: '.06em' }}>{c.code}</b></td>
                <td style={{ whiteSpace: 'nowrap' }}>{c.type === 'percent' ? `${c.value}%` : fmtRs(c.value)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{c.min_order ? fmtRs(c.min_order) : '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{c.expires_at ? fmtDate(c.expires_at) : '—'}</td>
                <td>
                  <span className="pill" style={!c.active || expired(c) ? {} : { background: '#D9F2E2', color: '#1E7A46' }}>
                    {!c.active ? 'off' : expired(c) ? 'expired' : 'active'}
                  </span>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-outline btn-sm" style={{ marginRight: 8 }} onClick={() => setEditing(c)}>Edit</button>
                  <button className="btn btn-outline btn-sm" style={{ marginRight: 8 }} onClick={() => toggle(c)}>{c.active ? 'Disable' : 'Enable'}</button>
                  <button className="btn btn-outline btn-sm" onClick={() => remove(c)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div className="empty"><div className="display">No coupons yet</div><p>Create one for your next campaign.</p></div>}
      </div>
      {editing && (
        <CouponEditor
          coupon={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}


function CouponEditor({ coupon, onClose, onSaved }) {
  const toDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
  const [f, setF] = useState({
    code: coupon?.code || '',
    type: coupon?.type || 'percent',
    value: coupon?.value || '',
    min_order: coupon?.min_order || '',
    usage_limit: coupon?.usage_limit || '',
    expires_at: toDateInput(coupon?.expires_at),
    active: coupon ? coupon.active : true,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...(coupon ? {} : { code: f.code, type: f.type, value: Number(f.value) }),
        ...(coupon ? { type: f.type, ...(f.value !== '' ? { value: Number(f.value) } : {}) } : {}),
        min_order: f.min_order === '' ? 0 : Number(f.min_order),
        usage_limit: f.usage_limit === '' ? null : Number(f.usage_limit),
        expires_at: f.expires_at || null,
        active: f.active,
      };
      const url = coupon ? `/api/admin/coupons/${coupon.id}` : '/api/admin/coupons';
      const r = await fetch(url, {
        method: coupon ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Save failed');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cart-overlay open" onClick={onClose}>
      <div className="admin-card" style={{ maxWidth: 520, margin: '40px auto', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        <h2 className="display" style={{ fontSize: 26, marginBottom: 20 }}>{coupon ? 'Edit Coupon' : 'New Coupon'}</h2>
        <form onSubmit={save}>
          {!coupon && <div className="f-group"><label>Code *</label><input required value={f.code} onChange={set('code')} placeholder="EID20" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }} /></div>}
          <div className="f-row">
            <div className="f-group">
              <label>Type</label>
              <select value={f.type} onChange={set('type')}>
                <option value="percent">Percent %</option>
                <option value="flat">Flat Rs</option>
              </select>
            </div>
            <div className="f-group"><label>Value * {f.type === 'percent' ? '(%)' : '(Rs)'}</label><input required type="number" min="1" max={f.type === 'percent' ? 100 : undefined} value={f.value} onChange={set('value')} /></div>
          </div>
          <div className="f-row">
            <div className="f-group"><label>Min order (Rs)</label><input type="number" min="0" value={f.min_order} onChange={set('min_order')} placeholder="0" /></div>
            <div className="f-group"><label>Usage limit</label><input type="number" min="1" value={f.usage_limit} onChange={set('usage_limit')} placeholder="Unlimited" /></div>
          </div>
          <div className="f-group"><label>Expiry date</label><input type="date" value={f.expires_at} onChange={set('expires_at')} /></div>
          <div className="f-group">
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={f.active} onChange={set('active')} style={{ width: 'auto' }} /> Active
            </label>
          </div>
          {error && <p style={{ color: '#B3402E', marginBottom: 12 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-gold" type="submit" disabled={saving} style={{ flex: 1 }}>{saving ? 'Saving...' : 'Save Coupon'}</button>
            <button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Products (kept, + CSV export)                                         */
/* ------------------------------------------------------------------ */


function Newsletter() {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ page: String(page), limit: '50', ...(q.trim() ? { q: q.trim() } : {}) });
    const r = await fetch(`/api/admin/newsletter?${qs}`);
    const d = await r.json().catch(() => ({}));
    setList(d.items || []);
    setTotal(d.total || 0);
  }, [q, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const remove = async (id, email) => {
    if (!window.confirm(`Remove ${email} from the newsletter?`)) return;
    await fetch('/api/admin/newsletter', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    load();
  };

  return (
    <div className="admin-card" style={{ overflowX: 'auto', padding: 12 }}>
      <div className="toolbar" style={{ marginTop: 0 }}>
        <div className="search" style={{ minWidth: 220 }}>
          <input placeholder="Search email..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search subscribers" />
        </div>
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>{total} subscriber{total === 1 ? '' : 's'}</span>
        <a className="btn btn-outline btn-sm" href="/api/admin/export?type=newsletter">↓ Export CSV</a>
      </div>
      <table className="tbl">
        <thead><tr><th>Email</th><th>Subscribed</th><th></th></tr></thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.id}>
              <td>{s.email}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(s.created_at)}</td>
              <td><button className="btn btn-outline btn-sm" onClick={() => remove(s.id, s.email)}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && <div className="empty"><div className="display">No subscribers yet</div></div>}
      {total > 50 && (
        <div className="toolbar" style={{ justifyContent: 'center' }}>
          <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span style={{ fontSize: 14 }}>Page {page}</span>
          <button className="btn btn-outline btn-sm" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* Phase 1+: shared content helpers                                    */
/* ------------------------------------------------------------------ */

/** PKT (UTC+5, no DST) <-> UTC helpers for datetime-local inputs. */

function Settings() {
  const [f, setF] = useState({
    admin_password: '', whatsapp: '', announcement: '', tagline: '', brand: '',
    shipping_flat: '', free_shipping_threshold: '', payment_cod: true, payment_bank: true,
    video_url: '',
    marquee_enabled: true, marquee_items: '',
    popup_enabled: false, popup_title: '', popup_text: '', popup_cta: '', popup_delay: '8',
  });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((d) => setF({
        admin_password: '',
        whatsapp: d.whatsapp || '',
        announcement: d.announcement || '',
        tagline: d.tagline || '',
        brand: d.brand || '',
        shipping_flat: d.shipping_flat ?? '250',
        free_shipping_threshold: d.free_shipping_threshold ?? '5000',
        payment_cod: d.payment_cod !== '0',
        payment_bank: d.payment_bank !== '0',
        video_url: d.video_url || '',
        marquee_enabled: d.marquee_enabled !== '0',
        marquee_items: d.marquee_items || '',
        popup_enabled: d.popup_enabled === '1',
        popup_title: d.popup_title || '',
        popup_text: d.popup_text || '',
        popup_cta: d.popup_cta || '',
        popup_delay: d.popup_delay || '8',
      }))
      .catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setMsg('');
    setError('');
    const payload = {
      whatsapp: f.whatsapp,
      announcement: f.announcement,
      tagline: f.tagline,
      brand: f.brand,
      shipping_flat: f.shipping_flat,
      free_shipping_threshold: f.free_shipping_threshold,
      payment_cod: f.payment_cod,
      payment_bank: f.payment_bank,
      video_url: f.video_url,
      marquee_enabled: f.marquee_enabled,
      marquee_items: f.marquee_items,
      popup_enabled: f.popup_enabled,
      popup_title: f.popup_title,
      popup_text: f.popup_text,
      popup_cta: f.popup_cta,
      popup_delay: f.popup_delay,
      ...(f.admin_password ? { admin_password: f.admin_password } : {}),
    };
    const r = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (r.ok) {
      setMsg('Settings saved.');
      setF({ ...f, admin_password: '' });
    } else {
      setError(d.error || 'Save failed');
    }
  };

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <div className="admin-card" style={{ maxWidth: 640 }}>
      <form onSubmit={save}>
        <h3 className="display" style={{ fontSize: 22, marginBottom: 16 }}>Store</h3>
        <div className="f-group"><label>Brand Name</label><input value={f.brand} onChange={set('brand')} /></div>
        <div className="f-group"><label>Tagline</label><input value={f.tagline} onChange={set('tagline')} /></div>
        <div className="f-group"><label>Announcement Bar</label><input value={f.announcement} onChange={set('announcement')} /></div>
        <div className="f-group"><label>WhatsApp Number (with country code)</label><input value={f.whatsapp} onChange={set('whatsapp')} placeholder="923001234567" /></div>
        
        <h3 className="display" style={{ fontSize: 22, marginBottom: 16, marginTop: 28 }}>Storefront Display</h3>
        <div className="f-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={f.marquee_enabled} onChange={set('marquee_enabled')} style={{ width: 20, height: 20 }} />
          <label style={{ margin: 0 }}>Show scrolling marquee strip</label>
        </div>
        <div className="f-group"><label>Marquee items (separate with | )</label><input value={f.marquee_items} onChange={set('marquee_items')} placeholder="Free delivery|Cash on Delivery|7-day exchange" /></div>
        <div className="f-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={f.popup_enabled} onChange={set('popup_enabled')} style={{ width: 20, height: 20 }} />
          <label style={{ margin: 0 }}>Show offer popup (once per visit)</label>
        </div>
        <div className="f-group"><label>Popup Title</label><input value={f.popup_title} onChange={set('popup_title')} placeholder="Welcome to AMMIGE" /></div>
        <div className="f-group"><label>Popup Text</label><input value={f.popup_text} onChange={set('popup_text')} placeholder="Get 10% off your first order…" /></div>
        <div className="f-group"><label>Popup Button Text</label><input value={f.popup_cta} onChange={set('popup_cta')} placeholder="Shop Now" /></div>
        <div className="f-group"><label>Popup Delay (seconds)</label><input type="number" min="2" max="60" value={f.popup_delay} onChange={set('popup_delay')} /></div>

        <div className="f-group"><label>Homepage Video URL</label><input value={f.video_url} onChange={set('video_url')} placeholder="YouTube link or .mp4 URL (empty = no video section)" /><div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>YouTube watch/shorts link or a direct .mp4/.webm URL. Leave empty to hide the video section.</div></div>

        <h3 className="display" style={{ fontSize: 22, margin: '24px 0 16px' }}>Shipping</h3>
        <div className="f-row">
          <div className="f-group"><label>Flat Rate (PKR)</label><input type="number" min="0" value={f.shipping_flat} onChange={set('shipping_flat')} /></div>
          <div className="f-group"><label>Free Shipping Over (PKR)</label><input type="number" min="0" value={f.free_shipping_threshold} onChange={set('free_shipping_threshold')} /></div>
        </div>

        <h3 className="display" style={{ fontSize: 22, margin: '24px 0 16px' }}>Payments</h3>
        <div className="f-group">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={f.payment_cod} onChange={set('payment_cod')} style={{ width: 'auto' }} /> Cash on Delivery
          </label>
        </div>
        <div className="f-group">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={f.payment_bank} onChange={set('payment_bank')} style={{ width: 'auto' }} /> Bank Transfer
          </label>
        </div>

        <h3 className="display" style={{ fontSize: 22, margin: '24px 0 16px' }}>Security</h3>
        <div className="f-group">
          <label>New Admin Password (leave empty to keep current)</label>
          <input type="password" value={f.admin_password} onChange={set('admin_password')} placeholder="Min 6 characters" />
        </div>
        {msg && <p style={{ color: '#1E7A46', marginBottom: 12 }}>{msg}</p>}
        {error && <p style={{ color: '#B3402E', marginBottom: 12 }}>{error}</p>}
        <button className="btn btn-gold" type="submit">Save Settings</button>
      </form>
    </div>
  );
}


export { Dashboard, Orders, OrderDetail, InvoicePrint, ManualOrder, Customers, Coupons, Newsletter, Settings };
