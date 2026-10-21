'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  Box, Stack, Paper, Card, CardContent, Button, TextField, FormControl, InputLabel,
  Select, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Pagination, Dialog, DialogTitle, DialogContent, DialogActions, Alert, Typography,
  IconButton, CircularProgress, Divider, Switch, FormControlLabel, ToggleButton,
  ToggleButtonGroup, List, ListItemButton, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import AddIcon from '@mui/icons-material/Add';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { fmtRs, fmtDate } from './shared';

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const NEXT_STATUS = { pending: 'confirmed', confirmed: 'shipped', shipped: 'delivered' };
const STATUS_COLOR = { pending: 'warning', confirmed: 'info', shipped: 'primary', delivered: 'success', cancelled: 'error' };

const StatusChip = ({ status }) => (
  <Chip size="small" label={status} color={STATUS_COLOR[status] || 'default'} sx={{ textTransform: 'capitalize' }} />
);

const Row = ({ children, cols = 2 }) => (
  <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: `repeat(${cols}, 1fr)` }, mb: 2 }}>{children}</Box>
);

const SectionTitle = ({ children }) => (
  <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>{children}</Typography>
);

function ChangeBadge({ v }) {
  if (v === null || v === undefined) return null;
  const up = v > 0;
  const flat = v === 0;
  return (
    <Typography variant="caption" sx={{ color: flat ? 'text.secondary' : up ? '#1E7A46' : '#B3402E', fontWeight: 600, display: 'block', mt: 0.5 }}>
      {flat ? '—' : up ? `▲ ${v}%` : `▼ ${Math.abs(v)}%`} <span style={{ fontWeight: 400 }}>vs prev</span>
    </Typography>
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

function StatCard({ label, value, children }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</Typography>
        <Typography variant="h5" sx={{ mt: 0.5 }}>{value}</Typography>
        {children}
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const [range, setRange] = useState('7d');
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [advPending, setAdvPending] = useState(0);

  useEffect(() => {
    fetch('/api/admin/orders?payment=advance&limit=100')
      .then((r) => r.json())
      .then((j) => setAdvPending((j.items || []).filter((x) => x.advance_status === 'pending_verification').length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/stats?range=${range}`)
      .then((r) => r.json())
      .then((j) => { setD(j); setLoading(false); })
      .catch(() => setLoading(false));
  }, [range]);

  if (loading || !d) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  const k = d.kpis || {};
  const ch = d.change || {};

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2.5 }}>
        <ToggleButtonGroup value={range} exclusive onChange={(_, v) => v && setRange(v)} size="small">
          <ToggleButton value="today">Today</ToggleButton>
          <ToggleButton value="7d">Last 7 days</ToggleButton>
          <ToggleButton value="30d">Last 30 days</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<DownloadIcon />} href="/api/admin/export?type=orders">Orders CSV</Button>
      </Stack>

      {advPending > 0 && (
        <Alert severity="warning" sx={{ mb: 2.5 }}>
          <b>{advPending} advance payment{advPending > 1 ? 's' : ''} awaiting verification.</b>{' '}
          Open the order in Orders → Payment: Advance, check the transaction in your EasyPaisa / bank account, then Approve or Reject.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
        <StatCard label="Revenue" value={fmtRs(k.revenue)}><ChangeBadge v={ch.revenue} /></StatCard>
        <StatCard label="Orders" value={k.orders}><ChangeBadge v={ch.orders} /></StatCard>
        <StatCard label="Avg. Order Value" value={fmtRs(k.aov)} />
        <StatCard label="Pending Orders" value={k.pending} />
      </Box>

      <Card sx={{ mt: 2.5 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Revenue</Typography>
          <RevenueChart series={d.series} />
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, mt: 2.5, alignItems: 'start' }}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Order Pipeline</Typography>
            {STATUSES.map((s) => (
              <Stack key={s} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1, borderBottom: '1px solid #F1E9DA' }}>
                <StatusChip status={s} />
                <Typography fontWeight={700}>{d.statusBreakdown?.[s] || 0}</Typography>
              </Stack>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Top Products <Typography component="span" variant="body2" color="text.secondary">({range === 'today' ? 'today' : range === '7d' ? '7 days' : '30 days'})</Typography>
            </Typography>
            {!(d.topProducts || []).length && <Typography color="text.secondary">No sales in this period yet.</Typography>}
            {(d.topProducts || []).map((p, i) => (
              <Stack key={i} direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ py: 1, borderBottom: '1px solid #F1E9DA' }}>
                <Typography variant="body2" noWrap><b style={{ color: '#C29B4B', marginRight: 8 }}>#{i + 1}</b>{p.name}</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>{p.qty} sold · {fmtRs(p.revenue)}</Typography>
              </Stack>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Low Stock <Typography component="span" variant="body2" color="error">({(d.lowStock || []).length})</Typography>
            </Typography>
            {(d.lowStock || []).length === 0 && <Typography color="text.secondary">All stocked up. 🎉</Typography>}
            {(d.lowStock || []).map((p) => (
              <Stack key={p.id} direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ py: 1, borderBottom: '1px solid #F1E9DA' }}>
                <Typography variant="body2" noWrap>{p.name}</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ color: p.stock === 0 ? '#B3402E' : '#9C7A33', whiteSpace: 'nowrap' }}>
                  {p.stock === 0 ? 'OUT' : `${p.stock} left`}
                </Typography>
              </Stack>
            ))}
          </CardContent>
        </Card>
      </Box>

      <Card sx={{ mt: 2.5 }}>
        <CardContent sx={{ px: 0 }}>
          <Typography variant="h6" sx={{ px: 2, mb: 1 }}>Recent Orders</Typography>
          <TableContainer>
            <Table>
              <TableHead><TableRow><TableCell>Order</TableCell><TableCell>Customer</TableCell><TableCell>Total</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
              <TableBody>
                {(d.recentOrders || []).map((o) => (
                  <TableRow key={o.id} hover>
                    <TableCell><b>#{o.id}</b><br /><Typography variant="caption" color="text.secondary">{fmtDate(o.created_at)}</Typography></TableCell>
                    <TableCell sx={{ maxWidth: 180 }}><Typography variant="body2" noWrap>{o.customer?.name}</Typography></TableCell>
                    <TableCell>{fmtRs(o.total)}</TableCell>
                    <TableCell><StatusChip status={o.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {!(d.recentOrders || []).length && (
            <Typography color="text.secondary" sx={{ px: 2, py: 2.5 }}>No orders yet — new orders will appear here.</Typography>
          )}
        </CardContent>
      </Card>
    </Box>
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
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2 }}>
        <TextField
          placeholder="Search id / name / phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ flex: '1 1 200px', minWidth: 180 }}
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
        />
        <FormControl size="small" sx={{ flex: '0 1 150px', minWidth: 140 }}>
          <InputLabel>Payment</InputLabel>
          <Select value={payment} label="Payment" onChange={(e) => setPayment(e.target.value)}>
            <MenuItem value="">All payments</MenuItem>
            <MenuItem value="cod">COD</MenuItem>
            <MenuItem value="bank">Bank</MenuItem>
            <MenuItem value="advance">Advance</MenuItem>
          </Select>
        </FormControl>
        <Button variant="outlined" startIcon={<DownloadIcon />} href="/api/admin/export?type=orders">CSV</Button>
      </Box>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {[['', 'All'], ...STATUSES.map((s) => [s, s])].map(([v, label]) => (
          <Chip
            key={v}
            label={label}
            onClick={() => setStatus(v)}
            color={status === v ? (STATUS_COLOR[v] || 'primary') : 'default'}
            variant={status === v ? 'filled' : 'outlined'}
            sx={{ textTransform: 'capitalize' }}
          />
        ))}
      </Stack>

      <TableContainer component={Paper} sx={{ border: '1px solid #E8E2D6' }}>
        <Table>
          <TableHead><TableRow><TableCell>Order</TableCell><TableCell>Customer</TableCell><TableCell>Items</TableCell><TableCell>Total</TableCell><TableCell>Pay</TableCell><TableCell>Status</TableCell><TableCell align="right"></TableCell></TableRow></TableHead>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id} hover>
                <TableCell><b>#{o.id}</b><br /><Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{fmtDate(o.created_at)}</Typography></TableCell>
                <TableCell sx={{ maxWidth: 180 }}>
                  <Typography variant="body2" noWrap>{o.customer?.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{o.customer?.phone}</Typography>
                </TableCell>
                <TableCell>{o.items?.reduce((s, i) => s + i.qty, 0)}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {fmtRs(o.total)}
                  {o.discount ? <><br /><Typography variant="caption" sx={{ color: '#1E7A46' }}>−{fmtRs(o.discount)} {o.coupon_code ? 'coupon' : 'discount'}</Typography></> : null}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ textTransform: 'uppercase', fontSize: 12 }}>{o.payment}</Typography>
                  {o.advance_status === 'pending_verification' && <Chip label="⏳ Verify payment" size="small" color="warning" sx={{ mt: 0.5 }} />}
                  {o.advance_status === 'verified' && <Chip label="Advance ✓" size="small" color="success" sx={{ mt: 0.5 }} />}
                  {o.advance_status === 'rejected' && <Chip label="Advance rejected" size="small" color="error" sx={{ mt: 0.5 }} />}
                </TableCell>
                <TableCell><StatusChip status={o.status} /></TableCell>
                <TableCell align="right"><Button size="small" variant="outlined" onClick={() => openDetail(o.id)}>View</Button></TableCell>
              </TableRow>
            ))}
            {!loading && orders.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5 }}><Typography color="text.secondary">No orders found</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>}
      </TableContainer>

      <Stack direction="row" spacing={2} justifyContent="center" alignItems="center" sx={{ mt: 2.5 }}>
        <Pagination count={pages} page={page} onChange={(_, v) => setPage(v)} color="primary" shape="rounded" />
        <Typography variant="body2" color="text.secondary">{total} orders</Typography>
      </Stack>

      {detail && (
        <OrderDetail
          order={detail}
          onClose={() => setDetail(null)}
          onUpdated={(o) => { setDetail(o); load(); }}
          onPrint={onPrint}
        />
      )}
    </Box>
  );
}

function OrderDetail({ order, onClose, onUpdated, onPrint }) {
  const [o, setO] = useState(order);
  const [courier, setCourier] = useState(order.courier || '');
  const [tracking, setTracking] = useState(order.tracking_number || '');
  const [notes, setNotes] = useState(order.admin_notes || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [verifyAmt, setVerifyAmt] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [advBusy, setAdvBusy] = useState(false);
  const [advMsg, setAdvMsg] = useState('');

  const verifyPayment = async (action) => {
    setAdvBusy(true);
    setAdvMsg('');
    const payload = { action };
    if (action === 'approve' && verifyAmt !== '') payload.verified_amount = Number(verifyAmt);
    if (action === 'reject') payload.reason = rejectReason;
    const r = await fetch(`/api/admin/orders/${o.id}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    setAdvBusy(false);
    if (r.ok) {
      setO(d);
      onUpdated(d);
      setAdvMsg(action === 'approve' ? 'Payment verified ✓ — discount applied, order confirmed.' : 'Payment rejected — the customer can resubmit proof from the track page.');
    } else {
      setAdvMsg(d.error || 'Verification failed');
    }
  };

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
  const flow = ['pending', 'confirmed', 'shipped', 'delivered'];
  const cur = flow.indexOf(o.status);

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ pr: 14 }}>
        Order #{o.id}
        <Stack direction="row" spacing={1} sx={{ position: 'absolute', right: 12, top: 12 }}>
          <Button size="small" variant="outlined" startIcon={<PrintIcon />} onClick={() => onPrint(o)}>Invoice</Button>
          <IconButton onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <StatusChip status={o.status} />
          <Typography variant="body2" color="text.secondary">{fmtDate(o.created_at)} · {o.payment?.toUpperCase()}</Typography>
          <Box sx={{ flex: 1 }} />
          {NEXT_STATUS[o.status] && (
            <Button variant="contained" size="small" disabled={saving} onClick={advance}>
              Mark as {NEXT_STATUS[o.status]} →
            </Button>
          )}
          {o.status !== 'cancelled' && o.status !== 'delivered' && (
            <Button variant="outlined" size="small" color="error" disabled={saving} onClick={cancel}>Cancel order</Button>
          )}
        </Stack>

        <Row>
          <Box>
            <SectionTitle>Customer</SectionTitle>
            <Typography fontWeight={700}>{o.customer?.name}</Typography>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{o.customer?.phone}</Typography>
            <Typography variant="body2" color="text.secondary">{o.customer?.address}, {o.customer?.city}</Typography>
          </Box>
          <Box>
            <SectionTitle>Fulfillment</SectionTitle>
            <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
              <InputLabel>Courier</InputLabel>
              <Select value={courier} label="Courier" onChange={(e) => setCourier(e.target.value)}>
                <MenuItem value="">— Select —</MenuItem>
                <MenuItem value="TCS">TCS</MenuItem>
                <MenuItem value="Leopards">Leopards</MenuItem>
                <MenuItem value="PostEx">PostEx</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. 123456789" />
          </Box>
        </Row>

        <SectionTitle>Items</SectionTitle>
        {(o.items || []).map((it, i) => (
          <Stack key={i} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1, borderBottom: '1px solid #F1E9DA' }}>
            {it.image && <Box component="img" src={it.image} alt={it.name} sx={{ width: 40, height: 48, objectFit: 'cover', borderRadius: 1 }} />}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>{it.name}</Typography>
              <Typography variant="caption" color="text.secondary">{it.sku ? `${it.sku} · ` : ''}Qty {it.qty} × {fmtRs(it.price)}</Typography>
            </Box>
            <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>{fmtRs(it.price * it.qty)}</Typography>
          </Stack>
        ))}

        <Box sx={{ mt: 1.5, maxWidth: 320, ml: 'auto' }}>
          <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5 }}><Typography variant="body2">Subtotal</Typography><Typography variant="body2">{fmtRs(subtotal)}</Typography></Stack>
          {o.discount > 0 && (
            <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5, color: '#1E7A46' }}>
              <Typography variant="body2">Coupon {o.coupon_code ? `(${o.coupon_code})` : ''}</Typography><Typography variant="body2">−{fmtRs(o.discount)}</Typography>
            </Stack>
          )}
          <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5 }}><Typography variant="body2">Shipping</Typography><Typography variant="body2">{shipping === 0 ? 'FREE' : fmtRs(shipping)}</Typography></Stack>
          <Stack direction="row" justifyContent="space-between" sx={{ py: 1, borderTop: '1px solid #E8E2D6', mt: 0.5 }}>
            <Typography fontWeight={700}>Total</Typography><Typography fontWeight={700} variant="h6">{fmtRs(o.total)}</Typography>
          </Stack>
        </Box>

        {o.advance_status && o.advance_status !== 'none' && (
          <Box sx={{ mt: 2, p: 2, border: '1px solid #E8E2D6', borderRadius: 2, bgcolor: o.advance_status === 'pending_verification' ? '#FDF6E3' : o.advance_status === 'verified' ? '#EFF7F1' : '#FBEEE9' }}>
            <SectionTitle>Advance Payment — {
              o.advance_status === 'pending_verification' ? 'Pending Verification' :
              o.advance_status === 'verified' ? 'Verified ✓' : 'Rejected'
            }</SectionTitle>
            <Stack spacing={0.5}>
              <Typography variant="body2">Advance required: <b>{fmtRs(o.advance_amount)}</b> · Promised discount: <b>{fmtRs(o.advance_discount)}</b></Typography>
              <Typography variant="body2">Transaction ID: <b>{o.advance_txn_id || '—'}</b></Typography>
              {o.advance_status === 'verified' && (
                <Typography variant="body2">
                  Verified amount: <b>{fmtRs(o.advance_verified_amount)}</b> by {o.advance_verified_by} on {fmtDate(o.advance_verified_at)} ·
                  {' '}COD balance on delivery: <b>{fmtRs(o.cod_balance)}</b>
                </Typography>
              )}
              {o.advance_status === 'rejected' && o.advance_reject_reason && (
                <Typography variant="body2" color="error">Reason sent to customer: {o.advance_reject_reason}</Typography>
              )}
            </Stack>
            {o.advance_proof_url && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" color="text.secondary">Customer&apos;s payment screenshot (click to open full size)</Typography>
                <Box component="a" href={o.advance_proof_url} target="_blank" rel="noreferrer" sx={{ display: 'block', mt: 0.5 }}>
                  <Box component="img" src={o.advance_proof_url} alt="Payment screenshot" sx={{ width: 180, maxWidth: '100%', borderRadius: 1, border: '1px solid #E8E2D6' }} />
                </Box>
              </Box>
            )}
            {o.advance_status === 'pending_verification' && (
              <Box sx={{ mt: 2 }}>
                <Alert severity="info" sx={{ mb: 1.5 }}>Check this transaction in your actual EasyPaisa / bank account first. Approving applies the {fmtRs(o.advance_discount)} discount and confirms the order.</Alert>
                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="flex-start">
                  <TextField label="Verified amount (Rs)" type="number" size="small" sx={{ width: 190 }}
                    value={verifyAmt} onChange={(e) => setVerifyAmt(e.target.value)}
                    placeholder={String(o.advance_amount)} helperText="Leave empty = full advance" />
                  <Button variant="contained" color="success" disabled={advBusy} onClick={() => verifyPayment('approve')}>Approve Payment</Button>
                </Stack>
                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="flex-start" sx={{ mt: 1.5 }}>
                  <TextField label="Rejection reason (customer will see this)" size="small" sx={{ flex: '1 1 260px' }}
                    value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Amount not received in our account" />
                  <Button variant="outlined" color="error" disabled={advBusy || !rejectReason.trim()} onClick={() => verifyPayment('reject')}>Reject Payment</Button>
                </Stack>
              </Box>
            )}
            {advMsg && <Alert severity={advMsg.includes('✓') || advMsg.startsWith('Payment rejected') ? 'success' : 'error'} sx={{ mt: 1.5 }}>{advMsg}</Alert>}
          </Box>
        )}

        {o.notes && <Typography variant="body2" sx={{ mt: 1.5 }}><b>Customer note:</b> {o.notes}</Typography>}

        <Box sx={{ mt: 2 }}>
          <TextField label="Internal notes (not shown to customer)" value={notes} onChange={(e) => setNotes(e.target.value)} multiline rows={2} placeholder="e.g. Customer asked for gift wrap" />
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2 }}>
          <Button variant="contained" disabled={saving} onClick={() => patch({ courier: courier || null, tracking_number: tracking || null, admin_notes: notes || null })}>
            {saving ? 'Saving…' : 'Save courier / notes'}
          </Button>
          {msg && <Typography variant="body2" sx={{ color: msg.includes('✓') ? '#1E7A46' : '#B3402E' }}>{msg}</Typography>}
        </Stack>

        <Box sx={{ mt: 2.5 }}>
          <SectionTitle>Status timeline</SectionTitle>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {o.status === 'cancelled' ? (
              <Chip label="cancelled" color="error" size="small" sx={{ textTransform: 'capitalize' }} />
            ) : flow.map((s, idx) => (
              <Chip key={s} label={s} size="small" color={idx <= cur ? 'success' : 'default'} variant={idx <= cur ? 'filled' : 'outlined'} sx={{ textTransform: 'capitalize' }} />
            ))}
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
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
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 2 }}>
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
      <Box sx={{ maxWidth: 760, mx: 'auto' }}>
        <Stack direction="row" spacing={1} className="no-print" sx={{ mb: 2 }}>
          <Button variant="outlined" size="small" startIcon={<ArrowBackIcon />} onClick={onBack}>Back</Button>
          <Button variant="contained" size="small" startIcon={<PrintIcon />} onClick={() => window.print()}>Print / Save PDF</Button>
        </Stack>
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
      </Box>
    </Box>
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
    <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, alignItems: 'start' }}>
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Customer</Typography>
          <Box component="form" onSubmit={submit}>
            <Stack spacing={2}>
              <TextField label="Name *" required value={customer.name} onChange={setC('name')} />
              <TextField label="Phone *" required value={customer.phone} onChange={setC('phone')} placeholder="03xx xxxxxxx" />
              <TextField label="Address *" required value={customer.address} onChange={setC('address')} />
              <TextField label="City *" required value={customer.city} onChange={setC('city')} />
              <Row>
                <FormControl fullWidth size="small">
                  <InputLabel>Payment</InputLabel>
                  <Select value={payment} label="Payment" onChange={(e) => setPayment(e.target.value)}>
                    <MenuItem value="cod">COD</MenuItem>
                    <MenuItem value="bank">Bank transfer</MenuItem>
                  </Select>
                </FormControl>
                <TextField label="Coupon (optional)" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="EID20" inputProps={{ style: { textTransform: 'uppercase' } }} />
              </Row>
              <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
              {error && <Alert severity="error">{error}</Alert>}
              {done && <Alert severity="success">Order #{done.order_id} created — {fmtRs(done.total)}</Alert>}
              <Button variant="contained" size="large" type="submit" disabled={saving || lines.length === 0} fullWidth>
                {saving ? 'Creating…' : `Create Order · ${fmtRs(subtotal)}`}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Products</Typography>
          <TextField
            placeholder="Search products to add…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ mb: 1.5 }}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
          />
          {results.map((p) => (
            <ListItemButton key={p.id} onClick={() => addLine(p)} sx={{ border: '1px solid #E8E2D6', borderRadius: 2, mb: 1, gap: 1.5 }}>
              {p.image && <Box component="img" src={p.image} alt="" sx={{ width: 40, height: 48, objectFit: 'cover', borderRadius: 1 }} />}
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>{p.name}</Typography>
              <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>{fmtRs(p.price)}</Typography>
              <Typography variant="caption" color="text.secondary">{p.stock} in stock</Typography>
            </ListItemButton>
          ))}
          {lines.length === 0 && <Typography color="text.secondary" variant="body2">No items yet — search and tap a product to add it.</Typography>}
          {lines.map((l) => (
            <Stack key={l.id} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1, borderBottom: '1px solid #F1E9DA' }}>
              {l.image && <Box component="img" src={l.image} alt={l.name} sx={{ width: 40, height: 48, objectFit: 'cover', borderRadius: 1 }} />}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>{l.name}</Typography>
                <Typography variant="caption" color="text.secondary">{fmtRs(l.price)} each</Typography>
              </Box>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Button size="small" variant="outlined" sx={{ minWidth: 32 }} onClick={() => setLines((ls) => ls.map((x) => (x.id === l.id ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}>−</Button>
                <Typography fontWeight={700} sx={{ minWidth: 20, textAlign: 'center' }}>{l.qty}</Typography>
                <Button size="small" variant="outlined" sx={{ minWidth: 32 }} onClick={() => setLines((ls) => ls.map((x) => (x.id === l.id ? { ...x, qty: Math.min(10, x.qty + 1) } : x)))}>+</Button>
                <IconButton size="small" color="error" onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))} aria-label="Remove"><CloseIcon fontSize="small" /></IconButton>
              </Stack>
              <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>{fmtRs(l.price * l.qty)}</Typography>
            </Stack>
          ))}
          {lines.length > 0 && (
            <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.5 }}>
              <Typography fontWeight={700}>Subtotal</Typography>
              <Typography fontWeight={700}>{fmtRs(subtotal)}</Typography>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
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
    <Box>
      <TextField
        placeholder="Search name / phone / city…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 2, width: { xs: '100%', sm: 320 } }}
        InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
      />
      <TableContainer component={Paper} sx={{ border: '1px solid #E8E2D6' }}>
        <Table>
          <TableHead><TableRow><TableCell>Customer</TableCell><TableCell>Phone</TableCell><TableCell>City</TableCell><TableCell>Orders</TableCell><TableCell>Total Spent</TableCell><TableCell>Last Order</TableCell><TableCell align="right"></TableCell></TableRow></TableHead>
          <TableBody>
            {list.map((c) => (
              <Fragment key={c.phone}>
                <TableRow hover>
                  <TableCell sx={{ maxWidth: 170 }}><Typography variant="body2" noWrap>{c.name || '—'}</Typography></TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{c.phone}</TableCell>
                  <TableCell>{c.city || '—'}</TableCell>
                  <TableCell>{c.orders}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtRs(c.total_spent)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{c.last_order_id ? <>#{c.last_order_id} · {fmtDate(c.last_order)}</> : '—'}</TableCell>
                  <TableCell align="right"><Button size="small" variant="outlined" onClick={() => openHistory(c.phone)}>{expanded === c.phone ? 'Hide' : 'History'}</Button></TableCell>
                </TableRow>
                {expanded === c.phone && (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ bgcolor: '#FBF9F4' }}>
                      {history.length === 0 && <Typography variant="body2" color="text.secondary">Loading…</Typography>}
                      {history.map((o) => (
                        <Stack key={o.id} direction="row" spacing={1.5} alignItems="center" sx={{ py: 0.75, borderBottom: '1px solid #F1E9DA' }}>
                          <Typography variant="body2" fontWeight={700}>#{o.id}</Typography>
                          <Typography variant="body2" color="text.secondary">{fmtDate(o.created_at)}</Typography>
                          <StatusChip status={o.status} />
                          <Box sx={{ flex: 1 }} />
                          <Typography variant="body2">{fmtRs(o.total)}</Typography>
                        </Stack>
                      ))}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
            {list.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5 }}><Typography color="text.secondary">No customers yet</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
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
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Typography color="text.secondary" variant="body2" sx={{ flex: 1 }}>Discount codes for campaigns & influencers.</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>New Coupon</Button>
      </Stack>
      <TableContainer component={Paper} sx={{ border: '1px solid #E8E2D6' }}>
        <Table>
          <TableHead><TableRow><TableCell>Code</TableCell><TableCell>Discount</TableCell><TableCell>Min Order</TableCell><TableCell>Used</TableCell><TableCell>Expiry</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
          <TableBody>
            {list.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell><Typography fontWeight={700} sx={{ letterSpacing: '0.06em' }}>{c.code}</Typography></TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{c.type === 'percent' ? `${c.value}%` : fmtRs(c.value)}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{c.min_order ? fmtRs(c.min_order) : '—'}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{c.expires_at ? fmtDate(c.expires_at) : '—'}</TableCell>
                <TableCell>
                  <Chip size="small" label={!c.active ? 'off' : expired(c) ? 'expired' : 'active'} color={c.active && !expired(c) ? 'success' : 'default'} sx={{ textTransform: 'capitalize' }} />
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Button size="small" variant="outlined" onClick={() => setEditing(c)} sx={{ mr: 1 }}>Edit</Button>
                  <Button size="small" variant="outlined" onClick={() => toggle(c)} sx={{ mr: 1 }}>{c.active ? 'Disable' : 'Enable'}</Button>
                  <Button size="small" variant="outlined" color="error" onClick={() => remove(c)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {list.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5 }}><Typography color="text.secondary">No coupons yet — create one for your next campaign.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {editing && (
        <CouponEditor
          coupon={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </Box>
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
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{coupon ? 'Edit Coupon' : 'New Coupon'}</DialogTitle>
      <Box component="form" onSubmit={save}>
        <DialogContent dividers>
          <Stack spacing={2}>
            {!coupon && <TextField label="Code *" required value={f.code} onChange={set('code')} placeholder="EID20" inputProps={{ style: { textTransform: 'uppercase', letterSpacing: '0.06em' } }} />}
            <Row>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select value={f.type} label="Type" onChange={set('type')}>
                  <MenuItem value="percent">Percent %</MenuItem>
                  <MenuItem value="flat">Flat Rs</MenuItem>
                </Select>
              </FormControl>
              <TextField label={`Value * ${f.type === 'percent' ? '(%)' : '(Rs)'}`} required type="number" inputProps={{ min: 1, max: f.type === 'percent' ? 100 : undefined }} value={f.value} onChange={set('value')} />
            </Row>
            <Row>
              <TextField label="Min order (Rs)" type="number" inputProps={{ min: 0 }} value={f.min_order} onChange={set('min_order')} placeholder="0" />
              <TextField label="Usage limit" type="number" inputProps={{ min: 1 }} value={f.usage_limit} onChange={set('usage_limit')} placeholder="Unlimited" />
            </Row>
            <TextField label="Expiry date" type="date" InputLabelProps={{ shrink: true }} value={f.expires_at} onChange={set('expires_at')} />
            <FormControlLabel control={<Switch checked={!!f.active} onChange={set('active')} />} label="Active" />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Coupon'}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Newsletter                                                           */
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

  const pages = Math.max(1, Math.ceil(total / 50));

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2 }}>
        <TextField
          placeholder="Search email…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          sx={{ flex: '1 1 200px', minWidth: 180 }}
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
        />
        <Typography variant="body2" color="text.secondary">{total} subscriber{total === 1 ? '' : 's'}</Typography>
        <Button variant="outlined" startIcon={<DownloadIcon />} href="/api/admin/export?type=newsletter">Export CSV</Button>
      </Box>
      <TableContainer component={Paper} sx={{ border: '1px solid #E8E2D6' }}>
        <Table>
          <TableHead><TableRow><TableCell>Email</TableCell><TableCell>Subscribed</TableCell><TableCell align="right"></TableCell></TableRow></TableHead>
          <TableBody>
            {list.map((s) => (
              <TableRow key={s.id} hover>
                <TableCell>{s.email}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDate(s.created_at)}</TableCell>
                <TableCell align="right"><Button size="small" variant="outlined" color="error" onClick={() => remove(s.id, s.email)}>Remove</Button></TableCell>
              </TableRow>
            ))}
            {list.length === 0 && (
              <TableRow><TableCell colSpan={3} align="center" sx={{ py: 5 }}><Typography color="text.secondary">No subscribers yet</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {total > 50 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2.5 }}>
          <Pagination count={pages} page={page} onChange={(_, v) => setPage(v)} color="primary" shape="rounded" />
        </Box>
      )}
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                             */
/* ------------------------------------------------------------------ */

function Settings() {
  const [f, setF] = useState({
    admin_password: '', whatsapp: '', announcement: '', tagline: '', brand: '',
    shipping_flat: '', free_shipping_threshold: '', payment_cod: true, payment_bank: true,
    advance_enabled: false, advance_amount: '500', advance_discount: '150',
    adv_easypaisa_name: '', adv_easypaisa_number: '',
    adv_bank_name: '', adv_bank_title: '', adv_bank_account: '', adv_bank_iban: '',
    adv_instructions: '',
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
        advance_enabled: d.advance_enabled === '1',
        advance_amount: d.advance_amount ?? '500',
        advance_discount: d.advance_discount ?? '150',
        adv_easypaisa_name: d.adv_easypaisa_name || '',
        adv_easypaisa_number: d.adv_easypaisa_number || '',
        adv_bank_name: d.adv_bank_name || '',
        adv_bank_title: d.adv_bank_title || '',
        adv_bank_account: d.adv_bank_account || '',
        adv_bank_iban: d.adv_bank_iban || '',
        adv_instructions: d.adv_instructions || '',
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
      advance_enabled: f.advance_enabled,
      advance_amount: f.advance_amount,
      advance_discount: f.advance_discount,
      adv_easypaisa_name: f.adv_easypaisa_name,
      adv_easypaisa_number: f.adv_easypaisa_number,
      adv_bank_name: f.adv_bank_name,
      adv_bank_title: f.adv_bank_title,
      adv_bank_account: f.adv_bank_account,
      adv_bank_iban: f.adv_bank_iban,
      adv_instructions: f.adv_instructions,
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
  const S = ({ children, mt = 0 }) => <Typography variant="h6" sx={{ mt, mb: 2 }}>{children}</Typography>;

  return (
    <Card sx={{ maxWidth: 680 }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Box component="form" onSubmit={save}>
          <S>Store</S>
          <Stack spacing={2}>
            <TextField label="Brand Name" value={f.brand} onChange={set('brand')} />
            <TextField label="Tagline" value={f.tagline} onChange={set('tagline')} />
            <TextField label="Announcement Bar" value={f.announcement} onChange={set('announcement')} />
            <TextField label="WhatsApp Number (with country code)" value={f.whatsapp} onChange={set('whatsapp')} placeholder="923001234567" />
          </Stack>

          <S mt={3.5}>Storefront Display</S>
          <Stack spacing={2}>
            <FormControlLabel control={<Switch checked={f.marquee_enabled} onChange={set('marquee_enabled')} />} label="Show scrolling marquee strip" />
            <TextField label="Marquee items (separate with | )" value={f.marquee_items} onChange={set('marquee_items')} placeholder="Free delivery|Cash on Delivery|7-day exchange" />
            <FormControlLabel control={<Switch checked={f.popup_enabled} onChange={set('popup_enabled')} />} label="Show offer popup (once per visit)" />
            <TextField label="Popup Title" value={f.popup_title} onChange={set('popup_title')} placeholder="Welcome to AMMIGE" />
            <TextField label="Popup Text" value={f.popup_text} onChange={set('popup_text')} placeholder="Get 10% off your first order…" />
            <TextField label="Popup Button Text" value={f.popup_cta} onChange={set('popup_cta')} placeholder="Shop Now" />
            <TextField label="Popup Delay (seconds)" type="number" inputProps={{ min: 2, max: 60 }} value={f.popup_delay} onChange={set('popup_delay')} />
            <TextField label="Homepage Video URL" value={f.video_url} onChange={set('video_url')} placeholder="YouTube link or .mp4 URL (empty = no video section)"
              helperText="YouTube watch/shorts link or a direct .mp4/.webm URL. Leave empty to hide the video section." />
          </Stack>

          <S mt={3.5}>Shipping</S>
          <Row>
            <TextField label="Flat Rate (PKR)" type="number" inputProps={{ min: 0 }} value={f.shipping_flat} onChange={set('shipping_flat')} />
            <TextField label="Free Shipping Over (PKR)" type="number" inputProps={{ min: 0 }} value={f.free_shipping_threshold} onChange={set('free_shipping_threshold')} />
          </Row>

          <S mt={1.5}>Payments</S>
          <Stack spacing={0.5}>
            <FormControlLabel control={<Switch checked={f.payment_cod} onChange={set('payment_cod')} />} label="Cash on Delivery" />
            <FormControlLabel control={<Switch checked={f.payment_bank} onChange={set('payment_bank')} />} label="Bank Transfer" />
          </Stack>

          <S mt={3.5}>Advance Payments (Manual Verification)</S>
          <Stack spacing={2}>
            <FormControlLabel control={<Switch checked={f.advance_enabled} onChange={set('advance_enabled')} />} label="Enable advance payment option at checkout" />
            <Typography variant="body2" color="text.secondary" sx={{ mt: -1 }}>
              The customer pays the advance to one of the accounts below, uploads the screenshot and transaction ID.
              The order stays <b>Pending Verification</b> until you check the transaction in your account and approve it here — the discount applies only after approval.
            </Typography>
            <Row>
              <TextField label="Advance Amount (PKR)" type="number" inputProps={{ min: 0 }} value={f.advance_amount} onChange={set('advance_amount')} />
              <TextField label="Discount on Verification (PKR)" type="number" inputProps={{ min: 0 }} value={f.advance_discount} onChange={set('advance_discount')} />
            </Row>
            <Row>
              <TextField label="EasyPaisa Account Number" value={f.adv_easypaisa_number} onChange={set('adv_easypaisa_number')} placeholder="03xx xxxxxxx" />
              <TextField label="EasyPaisa Account Title" value={f.adv_easypaisa_name} onChange={set('adv_easypaisa_name')} placeholder="Account holder name" />
            </Row>
            <Row>
              <TextField label="Bank Name" value={f.adv_bank_name} onChange={set('adv_bank_name')} placeholder="e.g. Meezan Bank" />
              <TextField label="Bank Account Title" value={f.adv_bank_title} onChange={set('adv_bank_title')} />
            </Row>
            <Row>
              <TextField label="Bank Account Number" value={f.adv_bank_account} onChange={set('adv_bank_account')} />
              <TextField label="Bank IBAN" value={f.adv_bank_iban} onChange={set('adv_bank_iban')} placeholder="PK36…" />
            </Row>
            <TextField label="Instructions shown to customer" value={f.adv_instructions} onChange={set('adv_instructions')} multiline rows={2}
              placeholder="Send the advance to any account below, then upload the payment screenshot and enter the transaction ID." />
          </Stack>

          <S mt={3.5}>Security</S>
          <TextField label="New Admin Password (leave empty to keep current)" type="password" value={f.admin_password} onChange={set('admin_password')} placeholder="Min 6 characters" />

          {msg && <Alert severity="success" sx={{ mt: 2 }}>{msg}</Alert>}
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          <Button variant="contained" size="large" type="submit" sx={{ mt: 2.5 }}>Save Settings</Button>
        </Box>
      </CardContent>
    </Card>
  );
}

export { Dashboard, Orders, OrderDetail, InvoicePrint, ManualOrder, Customers, Coupons, Newsletter, Settings };
