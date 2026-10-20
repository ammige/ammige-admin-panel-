'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Box, Stack, Paper, Button, TextField, FormControl, InputLabel, Select, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Checkbox, Chip,
  Pagination, Dialog, DialogTitle, DialogContent, DialogActions, Alert, Typography,
  IconButton, InputAdornment, CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import { uploadFile, toPKTInput, fromPKTInput, AdminImageField } from './shared';

function Products() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [collection, setCollection] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), ...(collection ? { collection } : {}), ...(q ? { q } : {}) });
    const r = await fetch(`/api/admin/products?${qs}`);
    const d = await r.json();
    setItems(d.items || []);
    setPages(d.pages || 1);
    setLoading(false);
  }, [page, collection, q]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [collection, q]);

  const remove = async (id) => {
    if (!confirm('Deactivate this product?')) return;
    await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    load();
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((p) => p.id))));
  };
  const bulkDelete = async () => {
    if (!selected.size) return;
    if (!confirm(`PERMANENTLY delete ${selected.size} product(s)? This cannot be undone.`)) return;
    setBulkBusy(true);
    try {
      const r = await fetch('/api/admin/products/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected] }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Delete failed');
      setSelected(new Set());
      load();
    } catch (e) { alert(e.message); } finally { setBulkBusy(false); }
  };
  const bulkAction = async (action, extra = {}) => {
    if (!selected.size) return;
    const labels = { publish: 'publish', unpublish: 'unpublish', price_percent: `change price by ${extra.percent}%`, duplicate: 'duplicate' };
    if (!confirm(`${labels[action] || action} ${selected.size} product(s)?`)) return;
    setBulkBusy(true);
    try {
      const r = await fetch('/api/admin/products/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: [...selected], ...extra }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Bulk action failed');
      setSelected(new Set());
      load();
    } catch (e) { alert(e.message); } finally { setBulkBusy(false); }
  };
  const bulkPrice = () => {
    const v = prompt('Price change % (e.g. 10 = +10%, -15 = -15%):', '-10');
    if (v === null) return;
    const pct = Number(v);
    if (!Number.isFinite(pct) || pct <= -100 || pct > 500) { alert('Enter a number between -99 and 500.'); return; }
    bulkAction('price_percent', { percent: pct });
  };
  const csvImport = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.csv,text/csv';
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return;
      const fd = new FormData();
      fd.append('file', f);
      setBulkBusy(true);
      try {
        const r = await fetch('/api/admin/products/import', { method: 'POST', body: fd });
        const d = await r.json();
        if (!d.ok) throw new Error(d.error || 'Import failed');
        alert(`Import done: ${d.created} created, ${d.updated} updated, ${d.skipped} skipped.`);
        load();
      } catch (e) { alert(e.message); } finally { setBulkBusy(false); }
    };
    inp.click();
  };

  return (
    <Box>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mb: 2 }}>
        <TextField
          placeholder="Search products…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ width: { xs: '100%', sm: 260 }, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
        />
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel>Collection</InputLabel>
          <Select value={collection} label="Collection" onChange={(e) => setCollection(e.target.value)}>
            <MenuItem value="">All collections</MenuItem>
            <MenuItem value="everyday">Everyday</MenuItem>
            <MenuItem value="signature">Signature</MenuItem>
            <MenuItem value="leather">Leather</MenuItem>
          </Select>
        </FormControl>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<DownloadIcon />} href="/api/admin/products/export">Export CSV</Button>
        <Button variant="outlined" startIcon={<UploadIcon />} onClick={csvImport} disabled={bulkBusy}>Import CSV</Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>Add Product</Button>
      </Stack>

      {selected.size > 0 && (
        <Paper sx={{ p: 1.5, mb: 2, bgcolor: '#FFF4E5', border: '1px solid #F0DDBB' }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            <Typography variant="subtitle2" sx={{ mr: 1 }}>{selected.size} selected</Typography>
            <Button size="small" variant="contained" disabled={bulkBusy} onClick={() => bulkAction('publish')}>Publish</Button>
            <Button size="small" variant="outlined" disabled={bulkBusy} onClick={() => bulkAction('unpublish')}>Unpublish</Button>
            <Button size="small" variant="outlined" disabled={bulkBusy} onClick={bulkPrice}>Price ±%</Button>
            <Button size="small" variant="outlined" disabled={bulkBusy} onClick={() => bulkAction('duplicate')}>Duplicate</Button>
            <Button size="small" variant="contained" color="error" startIcon={<DeleteIcon />} disabled={bulkBusy} onClick={bulkDelete}>
              {bulkBusy ? 'Working…' : 'Delete'}
            </Button>
            <Button size="small" onClick={() => setSelected(new Set())}>Clear</Button>
          </Stack>
        </Paper>
      )}

      <TableContainer component={Paper} sx={{ border: '1px solid #E8E2D6' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox checked={items.length > 0 && selected.size === items.length} onChange={toggleSelectAll} inputProps={{ 'aria-label': 'Select all' }} />
              </TableCell>
              <TableCell>Product</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Stock</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((p) => (
              <TableRow key={p.id} hover selected={selected.has(p.id)}>
                <TableCell padding="checkbox">
                  <Checkbox checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} inputProps={{ 'aria-label': `Select ${p.name}` }} />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box component="img" src={p.image} alt="" loading="lazy" sx={{ width: 44, height: 52, objectFit: 'cover', borderRadius: 1.5 }} />
                    <Typography variant="body2" sx={{ maxWidth: 240 }} noWrap>{p.name}</Typography>
                  </Stack>
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{p.sku}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Rs {p.price.toLocaleString('en-PK')}</TableCell>
                <TableCell>
                  <Typography variant="body2" color={p.stock <= 5 ? 'error' : 'inherit'} fontWeight={p.stock <= 5 ? 700 : 400}>{p.stock}</Typography>
                </TableCell>
                <TableCell><Chip size="small" label={p.active ? 'Active' : 'Hidden'} color={p.active ? 'success' : 'default'} variant={p.active ? 'filled' : 'outlined'} /></TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Button size="small" variant="outlined" onClick={() => setEditing(p)} sx={{ mr: 1 }}>Edit</Button>
                  <Button size="small" variant="outlined" color="error" onClick={() => remove(p.id)}>Hide</Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && items.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                <Typography color="text.secondary">No products yet. Click “Add Product” to create your first product.</Typography>
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>}
      </TableContainer>

      {pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2.5 }}>
          <Pagination count={pages} page={page} onChange={(_, v) => setPage(v)} color="primary" shape="rounded" />
        </Box>
      )}

      {editing && (
        <ProductEditor
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </Box>
  );
}

/** Small upload button used next to URL inputs. */
function ImageUploadButton({ onUploaded, title, maxDim = 1600 }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button component="label" variant="outlined" disabled={busy} sx={{ whiteSpace: 'nowrap', height: 40 }}>
      {busy ? 'Uploading…' : (title || 'Upload')}
      <input type="file" accept="image/*" hidden disabled={busy} onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setBusy(true);
        try {
          const url = await uploadFile(f, maxDim);
          onUploaded(url);
        } catch (err) { alert(err.message); }
        setBusy(false);
        e.target.value = '';
      }} />
    </Button>
  );
}

function ImageField({ label, value, onChange, hint }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField label={label} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="Upload from device or paste image URL" />
        <ImageUploadButton onUploaded={onChange} />
      </Stack>
      {value && <Box component="img" src={value} alt="" sx={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 1.5, mt: 1, border: '1px solid #E8E2D6', display: 'block' }} />}
      {hint && <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{hint}</Typography>}
    </Box>
  );
}

function FramesField({ value, onChange }) {
  const frames = Array.isArray(value) ? value : [];
  const [busy, setBusy] = useState(false);
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>360° spin frames ({frames.length}/24)</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
        {frames.map((u, i) => (
          <Box key={i} sx={{ position: 'relative' }}>
            <Box component="img" src={u} alt={`frame ${i}`} sx={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 1, border: '1px solid #E8E2D6', display: 'block' }} />
            <IconButton size="small" onClick={() => onChange(frames.filter((_, j) => j !== i))}
              sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'error.main', color: '#fff', width: 20, height: 20, '&:hover': { bgcolor: 'error.dark' } }}>
              <CloseIcon sx={{ fontSize: 12 }} />
            </IconButton>
          </Box>
        ))}
      </Stack>
      <Button component="label" variant="outlined" size="small" disabled={busy}>
        {busy ? 'Uploading…' : 'Add frames'}
        <input type="file" accept="image/*" multiple hidden disabled={busy} onChange={async (e) => {
          const files = [...(e.target.files || [])].slice(0, 24 - frames.length);
          if (!files.length) return;
          setBusy(true);
          try {
            const urls = [];
            for (const f of files) urls.push(await uploadFile(f, 1200, 'frame'));
            onChange([...frames, ...urls]);
          } catch (err) { alert(err.message); }
          setBusy(false);
          e.target.value = '';
        }} />
      </Button>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>Upload 8–24 angle photos in order. The 3D viewer turns them into a smooth turntable.</Typography>
    </Box>
  );
}

function GlbField({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField label="3D model (.glb — optional)" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="Upload .glb or paste URL" />
        <Button component="label" variant="outlined" disabled={busy} sx={{ whiteSpace: 'nowrap', height: 40 }}>
          {busy ? 'Uploading…' : 'Upload .glb'}
          <input type="file" accept=".glb,model/gltf-binary" hidden disabled={busy} onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try { onChange(await uploadFile(f, 0, 'model')); }
            catch (err) { alert(err.message); }
            setBusy(false);
            e.target.value = '';
          }} />
        </Button>
        {value && <Button variant="outlined" color="error" onClick={() => onChange('')} sx={{ height: 40 }}>Clear</Button>}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>A real 3D model renders with true geometry + AR. Without one, the viewer uses the photo box.</Typography>
    </Box>
  );
}

function VideoUploadButton({ onUploaded }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button component="label" variant="outlined" disabled={busy} sx={{ whiteSpace: 'nowrap', height: 40 }}>
      {busy ? 'Uploading…' : 'Upload MP4'}
      <input type="file" accept="video/mp4" hidden disabled={busy} onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setBusy(true);
        try { onUploaded(await uploadFile(f, 0, 'video')); }
        catch (err) { alert(err.message); }
        setBusy(false);
        e.target.value = '';
      }} />
    </Button>
  );
}

function ColorPhotos({ colors, variantImages, onChange }) {
  const list = String(colors || '').split(',').map((c) => c.trim()).filter(Boolean);
  if (!list.length) return null;
  const vi = variantImages || {};
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Per-color photos</Typography>
      {list.map((c) => (
        <Stack key={c} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 90 }}>{c}</Typography>
          <TextField value={vi[c] || ''} onChange={(e) => onChange({ ...vi, [c]: e.target.value })} placeholder="Image URL for this color" />
          <ImageUploadButton title="Upload" onUploaded={(url) => onChange({ ...vi, [c]: url })} />
        </Stack>
      ))}
    </Box>
  );
}

const Row = ({ children, cols = 2 }) => (
  <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: `repeat(${cols}, 1fr)` }, mb: 2 }}>{children}</Box>
);

function ProductEditor({ product, onClose, onSaved }) {
  const [f, setF] = useState({
    name: product?.name || '',
    collection: product?.collection || 'everyday',
    price: product?.price ?? '',
    old_price: product?.old_price || '',
    colors: product?.colors || '',
    sizes: product?.sizes || '',
    material: product?.material || '',
    description: product?.description || '',
    description_html: product?.description_html || '',
    tags: product?.tags || '',
    image: product?.image || '',
    image2: product?.image2 || '',
    variant_images: product?.variant_images || {},
    spin_frames: product?.spin_frames || [],
    model_3d: product?.model_3d || '',
    video_url: product?.video_url || '',
    stock: product?.stock ?? 50,
    badge: product?.badge || '',
    badge_start: toPKTInput(product?.badge_start),
    badge_end: toPKTInput(product?.badge_end),
    spin_enabled: product?.spin_enabled == null ? '' : (product.spin_enabled ? '1' : '0'),
    spin_poster: product?.spin_poster || '',
    spin_mode: product?.spin_mode || 'auto',
    active: product ? (product.active ? 1 : 0) : 1,
    sku: product?.sku || '',
    slug: product?.slug || '',
  });
  const [saving, setSaving] = useState(false);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setSaving(true); setError('');
    try {
      const payload = {
        name: f.name.trim(),
        collection: f.collection,
        price: Number(f.price),
        old_price: f.old_price ? Number(f.old_price) : null,
        colors: f.colors.trim(),
        sizes: f.sizes.trim(),
        material: f.material.trim(),
        description: f.description.trim(),
        description_html: f.description_html.trim() || null,
        tags: f.tags.trim(),
        image: f.image.trim(),
        image2: f.image2.trim() || null,
        variant_images: f.variant_images,
        spin_frames: f.spin_frames,
        model_3d: (f.model_3d || '').trim() || null,
        video_url: (f.video_url || '').trim() || null,
        stock: Number(f.stock) || 0,
        badge: f.badge.trim() || null,
        active: Number(f.active),
        slug: (f.slug || '').trim() || undefined,
        badge_start: fromPKTInput(f.badge_start),
        badge_end: fromPKTInput(f.badge_end),
        spin_enabled: f.spin_enabled === '' ? null : (f.spin_enabled === '1' ? 1 : 0),
        spin_poster: (f.spin_poster || '').trim() || null,
        spin_mode: f.spin_mode || null,
      };
      if (!payload.name) throw new Error('Name is required');
      if (!payload.price || payload.price <= 0) throw new Error('Valid price is required');
      if (!payload.image) throw new Error('Main image is required');
      const url = product ? `/api/admin/products/${product.id}` : '/api/admin/products';
      const method = product ? 'PATCH' : 'POST';
      const body = product ? payload : { ...payload, sku: f.sku.trim() || undefined };
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Save failed');
      onSaved();
    } catch (err) { setError(err.message); }
    setSaving(false);
  }

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ pr: 6 }}>
        {product ? 'Edit product' : 'New product'}
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 12, top: 10 }} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Row cols={3}>
          <Box sx={{ gridColumn: { sm: 'span 2' } }}>
            <TextField label="Name *" value={f.name} onChange={set('name')} />
          </Box>
          <TextField label="SKU" value={f.sku} onChange={set('sku')} placeholder={product ? product.sku : 'auto'} />
        </Row>
        <Row cols={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Collection</InputLabel>
            <Select value={f.collection} label="Collection" onChange={set('collection')}>
              <MenuItem value="everyday">Everyday</MenuItem>
              <MenuItem value="signature">Signature</MenuItem>
              <MenuItem value="leather">Leather</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Price (Rs) *" type="number" value={f.price} onChange={set('price')} />
          <TextField label="Old price (Rs)" type="number" value={f.old_price} onChange={set('old_price')} />
          <TextField label="Stock" type="number" value={f.stock} onChange={set('stock')} />
        </Row>
        <Row cols={3}>
          <TextField label="URL slug" value={f.slug || ''} onChange={set('slug')} placeholder="auto-from-name"
            helperText={f.slug ? `/product/${f.slug}` : undefined} />
          <TextField label="Badge" value={f.badge} onChange={set('badge')} placeholder="Bestseller / New" />
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select value={f.active} label="Status" onChange={set('active')}>
              <MenuItem value={1}>Active</MenuItem>
              <MenuItem value={0}>Inactive</MenuItem>
            </Select>
          </FormControl>
        </Row>
        <Row>
          <TextField label="Badge from (PKT)" type="datetime-local" InputLabelProps={{ shrink: true }} value={f.badge_start} onChange={set('badge_start')} />
          <TextField label="Badge until (PKT)" type="datetime-local" InputLabelProps={{ shrink: true }} value={f.badge_end} onChange={set('badge_end')} />
        </Row>
        <Box sx={{ mb: 2 }}>
          <TextField label="Tags (comma separated)" value={f.tags} onChange={set('tags')} placeholder="tote, work, sale" />
        </Box>
        <Row>
          <TextField label="Colors (comma separated)" value={f.colors} onChange={set('colors')} />
          <TextField label="Sizes (comma separated)" value={f.sizes} onChange={set('sizes')} />
        </Row>
        <Box sx={{ mb: 2 }}>
          <TextField label="Material" value={f.material} onChange={set('material')} />
        </Box>
        <Box sx={{ mb: 2 }}>
          <TextField label="Description" value={f.description} onChange={set('description')} multiline rows={3} />
        </Box>
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Rich description (HTML)</Typography>
            <Button size="small" variant="outlined" onClick={() => setShowHtmlPreview(!showHtmlPreview)}>
              {showHtmlPreview ? 'Edit' : 'Preview'}
            </Button>
          </Stack>
          {showHtmlPreview ? (
            <Box sx={{ border: '1px solid #E8E2D6', borderRadius: 2, p: 1.5, minHeight: 60 }}
              dangerouslySetInnerHTML={{ __html: f.description_html }} />
          ) : (
            <TextField value={f.description_html} onChange={set('description_html')} multiline rows={4}
              placeholder="<p>Rich <b>formatted</b> description…</p>"
              inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }} />
          )}
        </Box>
        <ImageField label="Main image *" value={f.image} onChange={(v) => setF({ ...f, image: v })}
          hint="The main product photo — upload from your device, no link needed." />
        <ImageField label="Hover image (2nd photo — shows on hover)" value={f.image2}
          onChange={(v) => setF({ ...f, image2: v })} />
        <ColorPhotos colors={f.colors} variantImages={f.variant_images}
          onChange={(v) => setF({ ...f, variant_images: v })} />
        <FramesField value={f.spin_frames} onChange={(v) => setF({ ...f, spin_frames: v })} />
        <GlbField value={f.model_3d} onChange={(v) => setF({ ...f, model_3d: v })} />
        <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#FBF9F4' }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>360° / 3D settings</Typography>
          <Row>
            <FormControl fullWidth size="small">
              <InputLabel>3D view</InputLabel>
              <Select value={f.spin_enabled} label="3D view" onChange={set('spin_enabled')}>
                <MenuItem value="">Default (on)</MenuItem>
                <MenuItem value="1">Enabled</MenuItem>
                <MenuItem value="0">Disabled</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Preferred mode</InputLabel>
              <Select value={f.spin_mode} label="Preferred mode" onChange={set('spin_mode')}>
                <MenuItem value="auto">Auto (GLB → frames → photo box)</MenuItem>
                <MenuItem value="glb">3D model only</MenuItem>
                <MenuItem value="frames">Spin frames only</MenuItem>
                <MenuItem value="box">Photo box only</MenuItem>
              </Select>
            </FormControl>
          </Row>
          <AdminImageField label="Poster image (shown before 3D loads)" value={f.spin_poster}
            onChange={(v) => setF({ ...f, spin_poster: v })} hint="Empty = main product photo." />
        </Paper>
        <Box sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <TextField label="Product video (optional)" value={f.video_url} onChange={set('video_url')}
              placeholder="YouTube link, .mp4 URL, or upload from device" />
            <VideoUploadButton onUploaded={(url) => setF({ ...f, video_url: url })} />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            YouTube watch/shorts/embed link, direct .mp4/.webm URL, or upload an MP4 (max 50 MB). Leave empty for no video.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : (product ? 'Save changes' : 'Create product')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export { Products, ProductEditor };
