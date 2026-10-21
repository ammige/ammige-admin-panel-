'use client';

import { useState } from 'react';
import {
  Box, Stack, TextField, FormControl, InputLabel, Select, MenuItem,
  FormControlLabel, Switch, Chip, Button, Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

const fmtRs = (n) => 'Rs ' + Number(n || 0).toLocaleString('en-PK');
const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

// Vercel rejects request bodies over ~4.5MB before the request even
// reaches the server, so an image must be shrunk client-side until it
// is safely below that — a raw phone photo (5-10MB) otherwise fails
// with an unreadable platform error. Always re-encode as JPEG and keep
// lowering quality/size until it fits.
const UPLOAD_SAFE_BYTES = 3.4 * 1024 * 1024;

async function prepImage(file, maxDim = 1600) {
  if (file.type === 'image/gif') return file; // keep animation
  let bmp = null;
  try { bmp = await createImageBitmap(file); } catch { bmp = null; }
  if (!bmp) {
    throw new Error('Ye photo parhi nahi ja rahi — is format ki photo support nahi hai. JPG ya PNG photo try karein.');
  }
  let scale = Math.min(1, (maxDim || 1600) / Math.max(bmp.width, bmp.height));
  let quality = 0.85;
  let out = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    out = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!out || out.size <= UPLOAD_SAFE_BYTES) break;
    if (quality > 0.55) quality -= 0.15; else scale *= 0.72;
  }
  bmp.close();
  if (!out) throw new Error('Photo tayyar nahi ho saki. Dobara try karein.');
  if (out.size <= UPLOAD_SAFE_BYTES && file.size <= UPLOAD_SAFE_BYTES && scale >= 1 && file.type !== 'image/png') {
    return file; // already small enough — keep the original bytes
  }
  return new File([out], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}

async function uploadFile(file, maxDim, kind = 'image') {
  const fd = new FormData();
  if (kind === 'image' || kind === 'frame') {
    const ready = await prepImage(file, maxDim);
    fd.append('file', ready);
  } else {
    if (file.size > 4.2 * 1024 * 1024) throw new Error('File bohat bari hai (max ~4MB). Chhoti file try karein.');
    fd.append('file', file);
  }
  fd.append('kind', kind);
  const r = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || (r.status === 413 ? 'File bohat bari hai — chhoti file try karein.' : 'Upload failed'));
  return d.url;
}

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

// Date/time fields: the label sits ABOVE the input as a caption — never a
// floating MUI label. The floating label rendered inside the box and
// overlapped Chrome's native mm/dd/yyyy segments (the garbled inputs the
// user screenshotted). Caption-above makes overlap impossible, and the
// field wraps to its own line instead of squeezing below ~230px.
const dtInputSx = {
  '& input[type="datetime-local"], & input[type="date"], & input[type="time"]': {
    fontFamily: "var(--font-poppins), 'Poppins', system-ui, sans-serif",
    fontSize: 14,
    letterSpacing: 'normal',
    textTransform: 'none',
    lineHeight: 1.5,
    minWidth: 0,
  },
  '& input::-webkit-datetime-edit': { padding: 0 },
  '& input::-webkit-calendar-picker-indicator': { cursor: 'pointer', marginLeft: 4, opacity: 0.6 },
};

function DateTimeField({ label, value, onChange, minW = 230 }) {
  return (
    <Box sx={{ flex: `1 1 ${minW}px`, minWidth: minW, maxWidth: '100%' }}>
      <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 600, color: 'text.secondary' }}>{label}</Typography>
      <TextField type="datetime-local" value={value || ''} onChange={onChange} sx={dtInputSx} />
    </Box>
  );
}

function DateField({ label, value, onChange, minW = 200 }) {
  return (
    <Box sx={{ flex: `1 1 ${minW}px`, minWidth: minW, maxWidth: '100%' }}>
      <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 600, color: 'text.secondary' }}>{label}</Typography>
      <TextField type="date" value={value || ''} onChange={onChange} sx={dtInputSx} />
    </Box>
  );
}

/** Status + active + schedule fields used by every content type (MUI). */
function ScheduleFields({ value, onChange }) {
  const v = value || {};
  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value;
    onChange({ ...v, [k]: val });
  };
  const setDate = (k) => (e) => onChange({ ...v, [k]: fromPKTInput(e.target.value) });
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap" useFlexGap sx={{ my: 1 }}>
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Status</InputLabel>
        <Select value={v.status || 'published'} label="Status" onChange={set('status')}>
          <MenuItem value="published">Published</MenuItem>
          <MenuItem value="draft">Draft</MenuItem>
          <MenuItem value="scheduled">Scheduled</MenuItem>
        </Select>
      </FormControl>
      <FormControlLabel
        control={<Switch checked={v.active !== 0} onChange={set('active')} />}
        label="Active"
      />
      <DateTimeField
        label="Start (PKT, optional)"
        value={toPKTInput(v.starts_at)}
        onChange={setDate('starts_at')}
      />
      <DateTimeField
        label="End (PKT, optional)"
        value={toPKTInput(v.ends_at)}
        onChange={setDate('ends_at')}
      />
    </Stack>
  );
}

/** Live-status pill for content lists (MUI Chip). */
function LivePill({ block }) {
  const now = new Date().toISOString();
  let label = 'Live', color = '#2E7D32';
  if (Number(block.active) !== 1) { label = 'Off'; color = '#777777'; }
  else if (block.status === 'draft') { label = 'Draft'; color = '#B07D2B'; }
  else if (block.starts_at && block.starts_at > now) { label = `Starts ${formatPKT(block.starts_at)}`; color = '#1565C0'; }
  else if (block.ends_at && block.ends_at <= now) { label = 'Expired'; color = '#B3402E'; }
  else if (block.status === 'scheduled') { label = 'Scheduled'; color = '#1565C0'; }
  return (
    <Chip
      size="small"
      label={label}
      sx={{ color, borderColor: `${color}66`, bgcolor: `${color}14`, fontWeight: 600 }}
      variant="outlined"
    />
  );
}

/** Image field with upload + preview + alt text (MUI). */
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
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          label={label}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Upload or paste image URL"
        />
        <Button variant="outlined" startIcon={<CloudUploadIcon />} onClick={pick} disabled={busy} sx={{ whiteSpace: 'nowrap', height: 40 }}>
          {busy ? 'Uploading…' : 'Upload'}
        </Button>
      </Stack>
      {onAltChange && (
        <TextField
          label="Alt text (accessibility)"
          value={alt || ''}
          onChange={(e) => onAltChange(e.target.value)}
          sx={{ mt: 1 }}
        />
      )}
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <Box component="img" src={value} alt={alt || label}
          sx={{ mt: 1, maxWidth: 200, maxHeight: 150, objectFit: 'cover', borderRadius: 2, border: '1px solid #E8E2D6', display: 'block' }} />
      ) : hint ? (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{hint}</Typography>
      ) : null}
    </Box>
  );
}

export { fmtRs, fmtDate, prepImage, uploadFile, toPKTInput, fromPKTInput, formatPKT, apiContent, ScheduleFields, DateTimeField, DateField, LivePill, AdminImageField };
