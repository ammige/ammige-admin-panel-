'use client';

import { useState } from 'react';

const fmtRs = (n) => 'Rs ' + Number(n || 0).toLocaleString('en-PK');
const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

async function prepImage(file, maxDim = 1600) {
  if (file.type === 'image/gif') return file; // keep animation
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  if (scale >= 1 && file.size < 900 * 1024) { bmp.close(); return file; }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((res) => canvas.toBlob(res, type, 0.85));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, type === 'image/png' ? '.png' : '.jpg'), { type }) : file;
}


async function uploadFile(file, maxDim, kind = 'image') {
  const fd = new FormData();
  if (kind === 'image' || kind === 'frame') {
    const ready = await prepImage(file, maxDim);
    fd.append('file', ready);
  } else {
    fd.append('file', file);
  }
  fd.append('kind', kind);
  const r = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Upload failed');
  return d.url;
}

/** Small upload button used next to URL inputs. */

function toPKTInput(utcISO) {
  if (!utcISO) return '';
  const d = new Date(utcISO);
  if (Number.isNaN(d.getTime())) return '';
  const p = new Date(d.getTime() + 5 * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.getUTCFullYear()}-${pad(p.getUTCMonth() + 1)}-${pad(p.getUTCDate())}T${pad(p.getUTCHours())}:${pad(p.getUTCMinutes())}`;
}

function fromPKTInput(local) {
  if (!local) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local.trim());
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - 5 * 3600 * 1000).toISOString();
}

function formatPKT(utcISO) {
  if (!utcISO) return '—';
  const d = new Date(utcISO);
  if (Number.isNaN(d.getTime())) return '—';
  const p = new Date(d.getTime() + 5 * 3600 * 1000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let h = p.getUTCHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.getUTCDate()} ${months[p.getUTCMonth()]} ${p.getUTCFullYear()}, ${pad(h)}:${pad(p.getUTCMinutes())} ${ap} PKT`;
}

/** Status + active + schedule fields used by every content type. */

async function apiContent(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}

/* ------------------------------------------------------------------ */
/* Site settings (Phase 1: identity, theme, maintenance, SEO)          */
/* ------------------------------------------------------------------ */

const FONT_CHOICES = [
  { id: 'cormorant-inter', label: 'Cormorant Garamond + Inter (current)' },
  { id: 'playfair-montserrat', label: 'Playfair Display + Montserrat' },
  { id: 'jost-jost', label: 'Jost (geometric sans)' },
  { id: 'poppins-poppins', label: 'Poppins (rounded sans)' },
];


function ScheduleFields({ value, onChange }) {
  const v = value || {};
  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value;
    onChange({ ...v, [k]: val });
  };
  const setDate = (k) => (e) => onChange({ ...v, [k]: fromPKTInput(e.target.value) });
  return (
    <div className="f-row" style={{ gap: 12, flexWrap: 'wrap' }}>
      <div className="f-group" style={{ minWidth: 130 }}>
        <label>Status</label>
        <select value={v.status || 'published'} onChange={set('status')}>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
        </select>
      </div>
      <div className="f-group" style={{ minWidth: 110, justifyContent: 'flex-end' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={v.active !== 0} onChange={set('active')} /> Active
        </label>
      </div>
      <div className="f-group" style={{ minWidth: 200 }}>
        <label>Start (PKT, optional)</label>
        <input type="datetime-local" value={toPKTInput(v.starts_at)} onChange={setDate('starts_at')} />
      </div>
      <div className="f-group" style={{ minWidth: 200 }}>
        <label>End (PKT, optional)</label>
        <input type="datetime-local" value={toPKTInput(v.ends_at)} onChange={setDate('ends_at')} />
      </div>
    </div>
  );
}

/** Live-status pill for content lists. */

function LivePill({ block }) {
  const now = new Date().toISOString();
  let label = 'Live', color = '#2E7D32';
  if (Number(block.active) !== 1) { label = 'Off'; color = '#777'; }
  else if (block.status === 'draft') { label = 'Draft'; color = '#B07D2B'; }
  else if (block.starts_at && block.starts_at > now) { label = `Starts ${formatPKT(block.starts_at)}`; color = '#1565C0'; }
  else if (block.ends_at && block.ends_at <= now) { label = 'Expired'; color = '#B3402E'; }
  else if (block.status === 'scheduled') { label = 'Scheduled'; color = '#1565C0'; }
  return <span style={{ fontSize: 12, fontWeight: 600, color, background: `${color}14`, border: `1px solid ${color}44`, borderRadius: 999, padding: '2px 10px', whiteSpace: 'nowrap' }}>{label}</span>;
}

/** Image field with upload + preview + alt text. */

function AdminImageField({ label, value, alt, onChange, onAltChange, hint }) {
  const [busy, setBusy] = useState(false);
  const pick = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/jpeg,image/png,image/webp';
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return;
      setBusy(true);
      try {
        const url = await uploadFile(f, 1920, 'image');
        onChange(url);
      } catch (err) { alert(err.message); }
      finally { setBusy(false); }
    };
    inp.click();
  };
  return (
    <div className="f-group">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input value={value || ''} onChange={(e) => onChange(e.target.value)}
          placeholder="Upload or paste image URL" style={{ flex: 1 }} />
        <button type="button" className="btn btn-outline btn-sm" onClick={pick} disabled={busy} style={{ whiteSpace: 'nowrap' }}>
          {busy ? '…' : '📤 Upload'}
        </button>
      </div>
      {onAltChange && (
        <input value={alt || ''} onChange={(e) => onAltChange(e.target.value)}
          placeholder="Alt text (accessibility)" style={{ marginTop: 8 }} />
      )}
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt={alt || label} className="ad-img-preview" />
      ) : hint ? (
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{hint}</p>
      ) : null}
    </div>
  );
}


export { fmtRs, fmtDate, prepImage, uploadFile, toPKTInput, fromPKTInput, formatPKT, apiContent, ScheduleFields, LivePill, AdminImageField };
