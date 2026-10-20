'use client';

import { useCallback, useEffect, useState } from 'react';
import { uploadFile, prepImage, toPKTInput, fromPKTInput, AdminImageField } from './shared';

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
    <>
      <div className="toolbar" style={{ marginTop: 0, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="search">
            <input placeholder="Search products..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
          </div>
          <select value={collection} onChange={(e) => setCollection(e.target.value)} aria-label="Collection">
            <option value="">All collections</option>
            <option value="everyday">Everyday</option>
            <option value="signature">Signature</option>
            <option value="leather">Leather</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="btn btn-outline btn-sm" href="/api/admin/products/export">↓ Export CSV</a>
          <button className="btn btn-outline btn-sm" onClick={csvImport} disabled={bulkBusy}>↑ Import CSV</button>
          <button className="btn btn-gold btn-sm" onClick={() => setEditing('new')}>+ Add Product</button>
        </div>
      </div>

      <div className="admin-card" style={{ overflowX: 'auto', padding: 12 }}>
        {selected.size > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, padding: '10px 14px', background: '#FFF4E5', borderRadius: 10, flexWrap: 'wrap' }}>
            <b>{selected.size} selected</b>
            <button className="btn btn-sm btn-gold" disabled={bulkBusy} onClick={() => bulkAction('publish')}>✓ Publish</button>
            <button className="btn btn-outline btn-sm" disabled={bulkBusy} onClick={() => bulkAction('unpublish')}>⊘ Unpublish</button>
            <button className="btn btn-outline btn-sm" disabled={bulkBusy} onClick={bulkPrice}>% Price ±</button>
            <button className="btn btn-outline btn-sm" disabled={bulkBusy} onClick={() => bulkAction('duplicate')}>⧉ Duplicate</button>
            <button className="btn btn-sm" style={{ background: '#B3402E', color: '#fff' }} disabled={bulkBusy} onClick={bulkDelete}>
              {bulkBusy ? 'Working…' : `🗑 Delete`}
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 36 }}><input type="checkbox" checked={items.length > 0 && selected.size === items.length} onChange={toggleSelectAll} aria-label="Select all" /></th>
              <th>Product</th><th>SKU</th><th>Price</th><th>Stock</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} style={selected.has(p.id) ? { background: '#FFF9F0' } : {}}>
                <td><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} aria-label={`Select ${p.name}`} /></td>
                <td>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <img src={p.image} alt="" loading="lazy" style={{ width: 44, height: 52, objectFit: 'cover', borderRadius: 8 }} />
                    <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  </div>
                </td>
                <td style={{ color: 'var(--muted)' }}>{p.sku}</td>
                <td style={{ whiteSpace: 'nowrap' }}>Rs {p.price.toLocaleString('en-PK')}</td>
                <td style={{ color: p.stock <= 5 ? '#B3402E' : 'inherit', fontWeight: p.stock <= 5 ? 700 : 400 }}>{p.stock}</td>
                <td><span className="pill" style={p.active ? { background: '#D9F2E2', color: '#1E7A46' } : {}}>{p.active ? 'Active' : 'Hidden'}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-outline btn-sm" style={{ marginRight: 8 }} onClick={() => setEditing(p)}>Edit</button>
                  <button className="btn btn-outline btn-sm" onClick={() => remove(p.id)}>Hide</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="empty"><div className="display">Loading...</div></div>}
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, alignItems: 'center' }}>
          <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}

      {editing && (
        <ProductEditor
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}

/** Small upload button used next to URL inputs. */
function ImageUploadButton({ onUploaded, title, maxDim = 1600 }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="btn btn-outline btn-sm" style={{ cursor: busy ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
      {busy ? 'Uploading…' : (title || '↑ Upload')}
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
    </label>
  );
}

function ImageField({ label, value, onChange, hint }) {
  return (
    <div className="f-group">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input value={value || ''} onChange={(e) => onChange(e.target.value)}
          placeholder="Upload from device or paste image URL" style={{ flex: 1 }} />
        <ImageUploadButton onUploaded={onChange} />
      </div>
      {value && <img src={value} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, marginTop: 6, border: '1px solid var(--line)' }} />}
      {hint && <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function FramesField({ value, onChange }) {
  const frames = Array.isArray(value) ? value : [];
  const [busy, setBusy] = useState(false);
  return (
    <div className="f-group">
      <label>360° spin frames ({frames.length}/24)</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {frames.map((u, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <img src={u} alt={`frame ${i}`} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--line)' }} />
            <button type="button" onClick={() => onChange(frames.filter((_, j) => j !== i))}
              style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: '#c00', color: '#fff', cursor: 'pointer', fontSize: 12 }}>×</button>
          </div>
        ))}
      </div>
      <label className="btn btn-outline btn-sm" style={{ cursor: busy ? 'wait' : 'pointer' }}>
        {busy ? 'Uploading…' : '↑ Add frames'}
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
      </label>
      <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>Upload 8–24 angle photos in order. The 3D viewer turns them into a smooth turntable.</div>
    </div>
  );
}

function GlbField({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="f-group">
      <label>3D model (.glb — optional)</label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input value={value || ''} onChange={(e) => onChange(e.target.value)}
          placeholder="Upload .glb or paste URL" style={{ flex: 1 }} />
        <label className="btn btn-outline btn-sm" style={{ cursor: busy ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
          {busy ? 'Uploading…' : '↑ Upload .glb'}
          <input type="file" accept=".glb,model/gltf-binary" hidden disabled={busy} onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try { onChange(await uploadFile(f, 0, 'model')); }
            catch (err) { alert(err.message); }
            setBusy(false);
            e.target.value = '';
          }} />
        </label>
        {value && <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange('')}>Clear</button>}
      </div>
      <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>A real 3D model renders with true geometry + AR. Without one, the viewer uses the photo box.</div>
    </div>
  );
}

function VideoUploadButton({ onUploaded }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="btn btn-outline btn-sm" style={{ cursor: busy ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
      {busy ? 'Uploading…' : '↑ Upload MP4'}
      <input type="file" accept="video/mp4" hidden disabled={busy} onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setBusy(true);
        try { onUploaded(await uploadFile(f, 0, 'video')); }
        catch (err) { alert(err.message); }
        setBusy(false);
        e.target.value = '';
      }} />
    </label>
  );
}

function ColorPhotos({ colors, variantImages, onChange }) {
  const list = String(colors || '').split(',').map((c) => c.trim()).filter(Boolean);
  if (!list.length) return null;
  const vi = variantImages || {};
  return (
    <div className="f-group">
      <label>Per-color photos</label>
      {list.map((c) => (
        <div key={c} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <span style={{ minWidth: 90, fontSize: 13 }}>{c}</span>
          <input value={vi[c] || ''} onChange={(e) => onChange({ ...vi, [c]: e.target.value })}
            placeholder="Image URL for this color" style={{ flex: 1 }} />
          <ImageUploadButton title="↑" onUploaded={(url) => onChange({ ...vi, [c]: url })} />
        </div>
      ))}
    </div>
  );
}

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
  });
  const [saving, setSaving] = useState(false);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [error, setError] = useState('');

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
    <div className="ad-modal-overlay" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, maxHeight: '92vh', overflowY: 'auto' }}>
        <h3>{product ? 'Edit product' : 'New product'}</h3>
        {error && <div className="ad-error">{error}</div>}
        <div className="f-row">
          <div className="f-group" style={{ flex: 2 }}><label>Name *</label>
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="f-group"><label>SKU</label>
            <input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} placeholder={product ? product.sku : 'auto'} /></div>
        </div>
        <div className="f-row">
          <div className="f-group"><label>Collection</label>
            <select value={f.collection} onChange={(e) => setF({ ...f, collection: e.target.value })}>
              <option value="everyday">Everyday</option>
              <option value="signature">Signature</option>
              <option value="leather">Leather</option>
            </select></div>
          <div className="f-group"><label>Price (Rs) *</label>
            <input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
          <div className="f-group"><label>Old price (Rs)</label>
            <input type="number" value={f.old_price} onChange={(e) => setF({ ...f, old_price: e.target.value })} /></div>
          <div className="f-group"><label>Stock</label>
            <input type="number" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} /></div>
        </div>
        <div className="f-row">
          <div className="f-group"><label>URL slug</label>
            <input value={f.slug || ''} onChange={(e) => setF({ ...f, slug: e.target.value })}
              placeholder="auto-from-name" />
            {f.slug && <div style={{ fontSize: 11, color: '#888' }}>/product/{f.slug}</div>}</div>
          <div className="f-group"><label>Badge</label>
            <input value={f.badge} onChange={(e) => setF({ ...f, badge: e.target.value })} placeholder="Bestseller / New" /></div>
          <div className="f-group"><label>Status</label>
            <select value={f.active} onChange={(e) => setF({ ...f, active: e.target.value })}>
              <option value={1}>Active</option><option value={0}>Inactive</option>
            </select></div>
        </div>
        <div className="f-row">
          <div className="f-group"><label>Badge from (PKT)</label>
            <input type="datetime-local" value={f.badge_start} onChange={(e) => setF({ ...f, badge_start: e.target.value })} /></div>
          <div className="f-group"><label>Badge until (PKT)</label>
            <input type="datetime-local" value={f.badge_end} onChange={(e) => setF({ ...f, badge_end: e.target.value })} /></div>
        </div>
        <div className="f-group"><label>Tags (comma separated)</label>
          <input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="tote, work, sale" /></div>
        <div className="f-row">
          <div className="f-group"><label>Colors (comma separated)</label>
            <input value={f.colors} onChange={(e) => setF({ ...f, colors: e.target.value })} /></div>
          <div className="f-group"><label>Sizes (comma separated)</label>
            <input value={f.sizes} onChange={(e) => setF({ ...f, sizes: e.target.value })} /></div>
        </div>
        <div className="f-group"><label>Material</label>
          <input value={f.material} onChange={(e) => setF({ ...f, material: e.target.value })} /></div>
        <div className="f-group"><label>Description</label>
          <textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div className="f-group">
          <label>Rich description (HTML)
            <button type="button" className="btn btn-outline btn-sm" style={{ marginLeft: 8 }}
              onClick={() => setShowHtmlPreview(!showHtmlPreview)}>
              {showHtmlPreview ? 'Edit' : 'Preview'}
            </button></label>
          {showHtmlPreview ? (
            <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 12, minHeight: 60 }}
              dangerouslySetInnerHTML={{ __html: f.description_html }} />
          ) : (
            <textarea rows={4} value={f.description_html} onChange={(e) => setF({ ...f, description_html: e.target.value })}
              placeholder="<p>Rich <b>formatted</b> description…</p>" style={{ fontFamily: 'monospace', fontSize: 12 }} />
          )}
        </div>
        <ImageField label="Main image *" value={f.image} onChange={(v) => setF({ ...f, image: v })}
          hint="The main product photo — upload from your device, no link needed." />
        <ImageField label="Hover image (2nd photo — shows on hover)" value={f.image2}
          onChange={(v) => setF({ ...f, image2: v })} />
        <ColorPhotos colors={f.colors} variantImages={f.variant_images}
          onChange={(v) => setF({ ...f, variant_images: v })} />
        <FramesField value={f.spin_frames} onChange={(v) => setF({ ...f, spin_frames: v })} />
        <GlbField value={f.model_3d} onChange={(v) => setF({ ...f, model_3d: v })} />
        <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginTop: 8, background: '#fafafa' }}>
          <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 8 }}>360° / 3D settings</label>
          <div className="f-row">
            <div className="f-group"><label>3D view</label>
              <select value={f.spin_enabled} onChange={(e) => setF({ ...f, spin_enabled: e.target.value })}>
                <option value="">Default (on)</option>
                <option value="1">Enabled</option>
                <option value="0">Disabled</option>
              </select></div>
            <div className="f-group"><label>Preferred mode</label>
              <select value={f.spin_mode} onChange={(e) => setF({ ...f, spin_mode: e.target.value })}>
                <option value="auto">Auto (GLB → frames → photo box)</option>
                <option value="glb">3D model only</option>
                <option value="frames">Spin frames only</option>
                <option value="box">Photo box only</option>
              </select></div>
          </div>
          <AdminImageField label="Poster image (shown before 3D loads)" value={f.spin_poster}
            onChange={(v) => setF({ ...f, spin_poster: v })} hint="Empty = main product photo." />
        </div>
        <div className="f-group">
          <label>Product video (optional)</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input value={f.video_url} onChange={(e) => setF({ ...f, video_url: e.target.value })}
              placeholder="YouTube link, .mp4 URL, or upload from device" style={{ flex: 1 }} />
            <VideoUploadButton onUploaded={(url) => setF({ ...f, video_url: url })} />
          </div>
          <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>YouTube watch/shorts/embed link, direct .mp4/.webm URL, or upload an MP4 (max 50 MB). Leave empty for no video.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" className="btn btn-gold" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : (product ? 'Save changes' : 'Create product')}</button>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export { Products, ProductEditor };
