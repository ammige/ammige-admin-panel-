'use client';

import { useEffect, useState } from 'react';
import {
  Box, Stack, Paper, Card, CardContent, Button, TextField, FormControl, InputLabel,
  Select, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, Typography, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Switch, FormControlLabel, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CloseIcon from '@mui/icons-material/Close';
import UploadIcon from '@mui/icons-material/Upload';
import { apiContent, ScheduleFields, LivePill, AdminImageField, formatPKT, toPKTInput, fromPKTInput, uploadFile } from './shared';

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const Row = ({ children, cols = 2 }) => (
  <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: `repeat(${cols}, 1fr)` }, mb: 2 }}>{children}</Box>
);

const H3 = ({ children, mt = 0 }) => <Typography variant="h6" sx={{ mt, mb: 1.5 }}>{children}</Typography>;
const H4 = ({ children }) => <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 2, mb: 1 }}>{children}</Typography>;

function Messages({ msg, error }) {
  return (
    <Box sx={{ mb: 2 }}>
      {msg && <Alert severity="success" sx={{ mb: 1 }}>{msg}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
    </Box>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{label}</Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box
          component="input"
          type="color"
          value={value || '#111111'}
          onChange={(e) => onChange(e.target.value)}
          sx={{ width: 44, height: 40, p: 0, border: '1px solid #C9C2B2', borderRadius: 1.5, bgcolor: 'transparent', cursor: 'pointer' }}
        />
        <TextField value={value || ''} onChange={(e) => onChange(e.target.value)} sx={{ flex: 1 }} />
      </Stack>
    </Box>
  );
}

function UploadField({ label, value, onChange, maxDim = 800, onError }) {
  const [busy, setBusy] = useState(false);
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField label={label} value={value || ''} onChange={(e) => onChange(e.target.value)} />
        <Button component="label" variant="outlined" startIcon={<UploadIcon />} disabled={busy} sx={{ whiteSpace: 'nowrap', height: 40 }}>
          {busy ? '…' : 'Upload'}
          <input type="file" accept="image/*" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            setBusy(true);
            try { onChange(await uploadFile(f, maxDim)); } catch (err) { onError && onError(err.message); }
            setBusy(false);
            e.target.value = '';
          }} />
        </Button>
      </Stack>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Site settings (Phase 1: identity, theme, maintenance, SEO)          */
/* ------------------------------------------------------------------ */

const FONT_CHOICES = [
  { id: 'cormorant-inter', label: 'Cormorant Garamond + Inter (default)' },
  { id: 'playfair-montserrat', label: 'Playfair Display + Montserrat' },
  { id: 'jost-jost', label: 'Jost (geometric)' },
  { id: 'poppins-poppins', label: 'Poppins (modern)' },
];

const SEO_PAGES = [
  ['/', 'Homepage'],
  ['/shop', 'Shop'],
  ['/about', 'About'],
  ['/contact', 'Contact'],
  ['/faq', 'FAQ'],
];

function SiteSettings() {
  const [s, setS] = useState(null);
  const [seo, setSeo] = useState({});
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [seoPage, setSeoPage] = useState('/');

  useEffect(() => { load(); }, []);
  async function load() {
    try {
      const r = await fetch('/api/admin/settings');
      const d = await r.json();
      setS(d.settings || {});
      const blocks = await apiContent('GET', '/api/admin/content?type=page_seo');
      const m = {};
      for (const b of blocks) m[b.name] = b;
      setSeo(m);
    } catch (e) { setError(e.message); }
  }

  const set = (k, v) => setS({ ...s, [k]: v });
  const setSocial = (k, v) => {
    let links = {};
    try { links = JSON.parse(s.social_links || '{}'); } catch {}
    links[k] = v;
    set('social_links', JSON.stringify(links));
  };
  const socialVal = (k) => {
    try { return (JSON.parse(s.social_links || '{}')[k]) || ''; } catch { return ''; }
  };

  async function saveSettings() {
    setMsg(''); setError('');
    try {
      const r = await fetch('/api/admin/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Save failed');
      setMsg('Site settings saved — live immediately.');
    } catch (e) { setError(e.message); }
  }

  async function saveSeo() {
    setMsg(''); setError('');
    try {
      const b = seo[seoPage];
      const data = {
        title: b?.data?.title || '',
        description: b?.data?.description || '',
        keywords: b?.data?.keywords || '',
      };
      if (b?.id) {
        await apiContent('PATCH', `/api/admin/content/${b.id}`, { data });
      } else {
        await apiContent('POST', '/api/admin/content', {
          type: 'page_seo', name: seoPage, data, status: 'published', active: 1, priority: 0,
        });
      }
      setMsg(`SEO saved for ${seoPage}.`);
      load();
    } catch (e) { setError(e.message); }
  }

  if (!s) return <Typography color="text.secondary">Loading…</Typography>;
  const seoB = seo[seoPage];
  const setSeoData = (k, v) => setSeo({ ...seo, [seoPage]: { ...seoB, data: { ...(seoB?.data || {}), [k]: v } } });

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Messages msg={msg} error={error} />

      <H3>Store identity</H3>
      <Row cols={3}>
        <TextField label="Store name" value={s.store_name || ''} onChange={(e) => set('store_name', e.target.value)} />
        <TextField label="Contact email" value={s.contact_email || ''} onChange={(e) => set('contact_email', e.target.value)} />
        <TextField label="Contact phone" value={s.contact_phone || ''} onChange={(e) => set('contact_phone', e.target.value)} />
      </Row>
      <Box sx={{ mb: 2 }}>
        <TextField label="Address" value={s.contact_address || ''} onChange={(e) => set('contact_address', e.target.value)} />
      </Box>
      <Row>
        <UploadField label="Logo (light bg)" value={s.logo_light || ''} onChange={(v) => set('logo_light', v)} onError={setError} />
        <UploadField label="Favicon" value={s.favicon_url || ''} onChange={(v) => set('favicon_url', v)} maxDim={256} onError={setError} />
      </Row>

      <H3 mt={1.5}>Social links</H3>
      <Row cols={4}>
        {['instagram', 'tiktok', 'facebook', 'youtube'].map((n) => (
          <TextField key={n} label={n[0].toUpperCase() + n.slice(1)} value={socialVal(n)} onChange={(e) => setSocial(n, e.target.value)} placeholder="https://…" />
        ))}
      </Row>

      <H3 mt={1.5}>Theme</H3>
      <Row cols={4}>
        <ColorField label="Primary" value={s.theme_primary || '#111111'} onChange={(v) => set('theme_primary', v)} />
        <ColorField label="Accent / gold" value={s.theme_accent || '#B08D3E'} onChange={(v) => set('theme_accent', v)} />
        <FormControl fullWidth size="small">
          <InputLabel>Font pairing</InputLabel>
          <Select value={s.theme_font || 'cormorant-inter'} label="Font pairing" onChange={(e) => set('theme_font', e.target.value)}>
            {FONT_CHOICES.map((f) => <MenuItem key={f.id} value={f.id}>{f.label}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl fullWidth size="small">
          <InputLabel>Button style</InputLabel>
          <Select value={s.theme_button_style || 'sharp'} label="Button style" onChange={(e) => set('theme_button_style', e.target.value)}>
            <MenuItem value="sharp">Sharp</MenuItem>
            <MenuItem value="soft">Soft</MenuItem>
            <MenuItem value="pill">Pill</MenuItem>
          </Select>
        </FormControl>
      </Row>

      <H3 mt={1.5}>Maintenance mode</H3>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <FormControlLabel
          control={<Switch checked={s.maintenance_enabled === '1'} onChange={(e) => set('maintenance_enabled', e.target.checked ? '1' : '0')} />}
          label="Site offline for visitors"
        />
        <TextField label="Message" value={s.maintenance_message || ''} onChange={(e) => set('maintenance_message', e.target.value)} sx={{ flex: 1, minWidth: 240 }} />
      </Stack>

      <Button variant="contained" onClick={saveSettings}>Save site settings</Button>

      <Divider sx={{ my: 4 }} />

      <H3>Per-page SEO</H3>
      <Box sx={{ mb: 2, maxWidth: 320 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Page</InputLabel>
          <Select value={seoPage} label="Page" onChange={(e) => setSeoPage(e.target.value)}>
            {SEO_PAGES.map(([p, l]) => <MenuItem key={p} value={p}>{l} ({p})</MenuItem>)}
          </Select>
        </FormControl>
      </Box>
      <Stack spacing={2} sx={{ mb: 2 }}>
        <TextField label="Title" value={seoB?.data?.title || ''} onChange={(e) => setSeoData('title', e.target.value)} />
        <TextField label="Description" value={seoB?.data?.description || ''} onChange={(e) => setSeoData('description', e.target.value)} multiline rows={2} />
        <TextField label="Keywords" value={seoB?.data?.keywords || ''} onChange={(e) => setSeoData('keywords', e.target.value)} />
      </Stack>
      <Button variant="contained" onClick={saveSeo}>Save SEO</Button>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Menus                                                                */
/* ------------------------------------------------------------------ */

function MenuItemsEditor({ items, onChange }) {
  const list = items || [];
  const upd = (i, patch) => onChange(list.map((it, j) => j === i ? { ...it, ...patch } : it));
  return (
    <Box>
      {list.map((it, i) => (
        <Stack key={i} direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <TextField label="Label" value={it.label || ''} onChange={(e) => upd(i, { label: e.target.value })} sx={{ flex: 1 }} />
          <TextField label="Link" value={it.href || ''} onChange={(e) => upd(i, { href: e.target.value })} sx={{ flex: 2 }} />
          <FormControlLabel control={<Switch checked={it.visible !== false} onChange={(e) => upd(i, { visible: e.target.checked })} />} label="Show" sx={{ mr: 0 }} />
          <IconButton size="small" disabled={i === 0} onClick={() => { const l = [...list]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; onChange(l); }} aria-label="Move up"><ArrowUpwardIcon fontSize="small" /></IconButton>
          <IconButton size="small" disabled={i === list.length - 1} onClick={() => { const l = [...list]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; onChange(l); }} aria-label="Move down"><ArrowDownwardIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={() => onChange(list.filter((_, j) => j !== i))} aria-label="Remove"><DeleteIcon fontSize="small" /></IconButton>
        </Stack>
      ))}
      <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => onChange([...list, { label: 'New link', href: '/', visible: true }])}>
        Add link
      </Button>
    </Box>
  );
}

function Menus() {
  const [nav, setNav] = useState(null);
  const [footer, setFooter] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);
  async function load() {
    try {
      const [n, f] = await Promise.all([
        apiContent('GET', '/api/admin/content?type=nav_menu'),
        apiContent('GET', '/api/admin/content?type=footer'),
      ]);
      setNav(n[0] || null);
      setFooter(f[0] || null);
    } catch (e) { setError(e.message); }
  }

  async function save(block, data) {
    setMsg(''); setError('');
    try {
      await apiContent('PATCH', `/api/admin/content/${block.id}`, { data });
      setMsg('Menu saved — live immediately.');
    } catch (e) { setError(e.message); }
  }

  if (!nav || !footer) return <Typography color="text.secondary">Loading…</Typography>;
  const setNavData = (k, v) => setNav({ ...nav, data: { ...nav.data, [k]: v } });
  const setFooterData = (k, v) => setFooter({ ...footer, data: { ...footer.data, [k]: v } });

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Messages msg={msg} error={error} />
      <H3>Header navigation</H3>
      <MenuItemsEditor items={nav.data.items} onChange={(items) => setNavData('items', items)} />
      <Box sx={{ mt: 1.5 }}>
        <Button variant="contained" onClick={() => save(nav, nav.data)}>Save navigation</Button>
      </Box>

      <H3 mt={4}>Footer</H3>
      {(footer.data.columns || []).map((col, ci) => (
        <Paper key={ci} variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ mb: 1.5 }}>
            <TextField label="Column heading" value={col.heading || ''} onChange={(e) => {
              const cols = [...footer.data.columns]; cols[ci] = { ...col, heading: e.target.value };
              setFooterData('columns', cols);
            }} />
          </Box>
          <MenuItemsEditor items={col.links} onChange={(links) => {
            const cols = [...footer.data.columns]; cols[ci] = { ...col, links };
            setFooterData('columns', cols);
          }} />
          <Button size="small" variant="outlined" color="error" sx={{ mt: 1 }} onClick={() => setFooterData('columns', footer.data.columns.filter((_, j) => j !== ci))}>
            Remove column
          </Button>
        </Paper>
      ))}
      <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setFooterData('columns', [...(footer.data.columns || []), { heading: 'New column', links: [] }])}>
        Add column
      </Button>
      <Box sx={{ mt: 2, mb: 1 }}>
        <TextField label="Bottom line (use {year} for year)" value={footer.data.bottom_text || ''} onChange={(e) => setFooterData('bottom_text', e.target.value)} />
      </Box>
      <FormControlLabel
        control={<Switch checked={footer.data.newsletter !== false} onChange={(e) => setFooterData('newsletter', e.target.checked)} />}
        label="Show newsletter signup in footer"
        sx={{ mb: 2, display: 'flex' }}
      />
      <Button variant="contained" onClick={() => save(footer, footer.data)}>Save footer</Button>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Bars: announcement + marquee (Phase 2)                               */
/* ------------------------------------------------------------------ */

function Bars() {
  const [ann, setAnn] = useState(null);
  const [marquees, setMarquees] = useState([]);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);
  async function load() {
    try {
      const [a, m] = await Promise.all([
        apiContent('GET', '/api/admin/content?type=announcement'),
        apiContent('GET', '/api/admin/content?type=marquee'),
      ]);
      setAnn(a[0] || null);
      setMarquees(m);
    } catch (e) { setError(e.message); }
  }

  async function saveAnn() {
    setMsg(''); setError('');
    try {
      await apiContent('PATCH', `/api/admin/content/${ann.id}`, {
        data: ann.data, status: ann.status, active: ann.active,
        starts_at: ann.starts_at, ends_at: ann.ends_at,
      });
      setMsg('Announcement saved — live immediately.');
    } catch (e) { setError(e.message); }
  }

  async function saveMarquee(mq) {
    setMsg(''); setError('');
    try {
      if (mq.id) {
        await apiContent('PATCH', `/api/admin/content/${mq.id}`, {
          data: mq.data, status: mq.status, active: mq.active,
          starts_at: mq.starts_at, ends_at: mq.ends_at, priority: mq.priority,
        });
      } else {
        await apiContent('POST', '/api/admin/content', {
          type: 'marquee', name: mq.name || 'marquee', data: mq.data,
          status: mq.status, active: mq.active, priority: mq.priority || 0,
          starts_at: mq.starts_at, ends_at: mq.ends_at,
        });
      }
      setEditing(null); setMsg('Marquee saved.');
      load();
    } catch (e) { setError(e.message); }
  }

  async function delMarquee(id) {
    if (!confirm('Delete this marquee?')) return;
    await apiContent('DELETE', `/api/admin/content/${id}`);
    load();
  }

  const setAnnData = (k, v) => setAnn({ ...ann, data: { ...ann.data, [k]: v } });
  if (!ann) return <Typography color="text.secondary">Loading…</Typography>;
  const setItem = (i, patch) => {
    const items = [...editing.data.items]; items[i] = { ...items[i], ...patch };
    setEditing({ ...editing, data: { ...editing.data, items } });
  };

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Messages msg={msg} error={error} />

      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="h6">Announcement bar</Typography>
        <LivePill block={ann} />
      </Stack>
      <Box sx={{ mb: 2 }}>
        <TextField label="Text" value={ann.data.text || ''} onChange={(e) => setAnnData('text', e.target.value)} />
      </Box>
      <Row cols={3}>
        <TextField label="Link (optional)" value={ann.data.link || ''} onChange={(e) => setAnnData('link', e.target.value)} placeholder="/shop" />
        <ColorField label="Background" value={ann.data.bg_color || '#111111'} onChange={(v) => setAnnData('bg_color', v)} />
        <ColorField label="Text color" value={ann.data.text_color || '#FFFFFF'} onChange={(v) => setAnnData('text_color', v)} />
      </Row>
      <FormControlLabel
        control={<Switch checked={ann.data.dismissible !== false} onChange={(e) => setAnnData('dismissible', e.target.checked)} />}
        label="Visitors can dismiss (×)"
        sx={{ mb: 1, display: 'flex' }}
      />
      <ScheduleFields value={ann} onChange={(nv) => setAnn({ ...ann, ...nv })} />
      <Box sx={{ border: '1px dashed #C9C2B2', borderRadius: 2, p: 1.25, my: 1.5, bgcolor: ann.data.bg_color, color: ann.data.text_color, textAlign: 'center', fontSize: 14 }}>
        {ann.data.text || 'Preview'}
      </Box>
      <Button variant="contained" onClick={saveAnn}>Save announcement</Button>

      <H3 mt={4}>Marquees</H3>
      <Button size="small" variant="outlined" startIcon={<AddIcon />} sx={{ mb: 1.5 }}
        onClick={() => setEditing({ name: 'marquee-' + Date.now(), status: 'published', active: 1, priority: 0,
          data: { items: [{ text: '', icon: '✦', link: '' }], speed: 30, direction: 'left', pause_on_hover: true,
            bg_color: '#111111', text_color: '#FFFFFF', position: 'top' } })}>
        New marquee
      </Button>
      <TableContainer component={Paper} sx={{ border: '1px solid #E8E2D6' }}>
        <Table>
          <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Items</TableCell><TableCell>Position</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
          <TableBody>
            {marquees.map((m) => (
              <TableRow key={m.id} hover>
                <TableCell>{m.name}</TableCell>
                <TableCell>{(m.data.items || []).length}</TableCell>
                <TableCell>{m.data.position}</TableCell>
                <TableCell><LivePill block={m} /></TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Button size="small" variant="outlined" onClick={() => setEditing(m)} sx={{ mr: 1 }}>Edit</Button>
                  <Button size="small" variant="outlined" color="error" onClick={() => delMarquee(m.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {editing && (
        <Dialog open onClose={() => setEditing(null)} maxWidth="md" fullWidth scroll="paper">
          <DialogTitle sx={{ pr: 6 }}>
            {editing.id ? 'Edit marquee' : 'New marquee'}
            <IconButton onClick={() => setEditing(null)} sx={{ position: 'absolute', right: 12, top: 10 }} aria-label="Close"><CloseIcon /></IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Box sx={{ mb: 2 }}>
              <TextField label="Internal name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Box>
            {(editing.data.items || []).map((it, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <TextField label="Icon" value={it.icon || ''} onChange={(e) => setItem(i, { icon: e.target.value })} sx={{ maxWidth: 80 }} />
                <TextField label="Text" value={it.text || ''} onChange={(e) => setItem(i, { text: e.target.value })} sx={{ flex: 2 }} />
                <TextField label="Link" value={it.link || ''} onChange={(e) => setItem(i, { link: e.target.value })} sx={{ flex: 1 }} />
                <IconButton size="small" color="error" onClick={() => setEditing({ ...editing, data: { ...editing.data, items: editing.data.items.filter((_, j) => j !== i) } })} aria-label="Remove item"><DeleteIcon fontSize="small" /></IconButton>
              </Stack>
            ))}
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setEditing({ ...editing, data: { ...editing.data, items: [...(editing.data.items || []), { text: '', icon: '✦', link: '' }] } })}>
              Add item
            </Button>
            <Row cols={3}>
              <TextField label="Speed (seconds per loop)" type="number" inputProps={{ min: 5, max: 120 }} value={editing.data.speed || 30}
                onChange={(e) => setEditing({ ...editing, data: { ...editing.data, speed: Number(e.target.value) } })} />
              <FormControl fullWidth size="small">
                <InputLabel>Direction</InputLabel>
                <Select value={editing.data.direction || 'left'} label="Direction" onChange={(e) => setEditing({ ...editing, data: { ...editing.data, direction: e.target.value } })}>
                  <MenuItem value="left">Left</MenuItem>
                  <MenuItem value="right">Right</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Position</InputLabel>
                <Select value={editing.data.position || 'top'} label="Position" onChange={(e) => setEditing({ ...editing, data: { ...editing.data, position: e.target.value } })}>
                  <MenuItem value="top">Below header</MenuItem>
                  <MenuItem value="above_footer">Above footer</MenuItem>
                </Select>
              </FormControl>
            </Row>
            <Row>
              <ColorField label="Background" value={editing.data.bg_color || '#111111'} onChange={(v) => setEditing({ ...editing, data: { ...editing.data, bg_color: v } })} />
              <ColorField label="Text color" value={editing.data.text_color || '#FFFFFF'} onChange={(v) => setEditing({ ...editing, data: { ...editing.data, text_color: v } })} />
            </Row>
            <FormControlLabel
              control={<Switch checked={editing.data.pause_on_hover !== false} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, pause_on_hover: e.target.checked } })} />}
              label="Pause on hover"
              sx={{ mb: 1, display: 'flex' }}
            />
            <ScheduleFields value={editing} onChange={(nv) => setEditing({ ...editing, ...nv })} />
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="contained" onClick={() => saveMarquee(editing)}>Save marquee</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Popups (Phase 2)                                                     */
/* ------------------------------------------------------------------ */

const POPUP_TYPES = [
  { id: 'offer', label: 'Offer / Sale' },
  { id: 'newsletter', label: 'Newsletter signup' },
  { id: 'image', label: 'Image banner' },
  { id: 'announcement', label: 'Announcement' },
  { id: 'exit_intent', label: 'Exit intent' },
];

function blankPopup() {
  return {
    id: null, name: 'popup-' + Date.now().toString(36), status: 'published', active: 1,
    starts_at: null, ends_at: null, priority: 0,
    data: {
      popup_type: 'offer', title: '', text: '', image_url: '', image_alt: '',
      cta_text: 'Shop Now', cta_link: '/shop', secondary_text: 'No thanks',
      coupon_code: '', countdown_ends_at: '',
      trigger: 'delay', trigger_value: '8',
      frequency: 'once_session', frequency_days: 7,
      pages: 'all', page_urls: '', device: 'all', audience: 'all',
      newsletter_enabled: false,
    },
  };
}

function Popups() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [stats, setStats] = useState({});
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const d = await apiContent('GET', '/api/admin/content?type=popup').catch(() => ({ items: [] }));
    setList(d.items || []);
    const s = {};
    for (const p of (d.items || [])) {
      try {
        const r = await fetch(`/api/admin/content/${p.id}/stats`).then((x) => x.json());
        s[p.id] = r.totals || {};
      } catch {}
    }
    setStats(s);
  };
  useEffect(() => { load().catch(() => setError('Failed to load.')); }, []);

  const save = async (p) => {
    setMsg(''); setError('');
    try {
      if (p.id) {
        await apiContent('PATCH', `/api/admin/content/${p.id}`, {
          data: p.data, name: p.name, status: p.status, active: p.active,
          starts_at: p.starts_at, ends_at: p.ends_at, priority: p.priority,
        });
      } else {
        await apiContent('POST', '/api/admin/content', {
          type: 'popup', name: p.name, data: p.data, status: p.status,
          active: p.active !== 0, starts_at: p.starts_at || null,
          ends_at: p.ends_at || null, priority: p.priority || 0,
        });
      }
      setEditing(null); await load();
      setMsg('Popup saved — live immediately.');
    } catch (err) { setError(err.message); }
  };

  const del = async (id) => {
    if (!confirm('Delete this popup?')) return;
    try { await apiContent('DELETE', `/api/admin/content/${id}`); await load(); setMsg('Popup deleted.'); }
    catch (err) { setError(err.message); }
  };

  const e = editing;
  const setD = (k, v) => setEditing({ ...e, data: { ...e.data, [k]: v } });

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>Popups</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>Triggers, frequency, targeting, stats. Highest priority wins when several match.</Typography>
      <Messages msg={msg} error={error} />

      {list.map((p) => {
        const st = stats[p.id] || {};
        return (
          <Card key={p.id} sx={{ mb: 1.5 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap spacing={1} sx={{ mb: 0.5 }}>
                <Box>
                  <Typography component="span" fontWeight={700}>{p.data.title || p.name}</Typography>
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    {(POPUP_TYPES.find((t) => t.id === p.data.popup_type) || {}).label} · trigger: {p.data.trigger} · {p.data.frequency}
                  </Typography>
                </Box>
                <LivePill block={p} />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
                👁 {st.impression || 0} impressions · ✖ {st.close || 0} closes · 👆 {st.cta_click || 0} clicks
                {st.impression ? ` · CTR ${Math.round(((st.cta_click || 0) / st.impression) * 100)}%` : ''}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" onClick={() => setEditing(JSON.parse(JSON.stringify(p)))}>Edit</Button>
                <Button size="small" variant="outlined" color="error" onClick={() => del(p.id)}>Delete</Button>
              </Stack>
            </CardContent>
          </Card>
        );
      })}
      <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setEditing(blankPopup())}>New popup</Button>

      {e && (
        <Dialog open onClose={() => setEditing(null)} maxWidth="md" fullWidth scroll="paper">
          <DialogTitle sx={{ pr: 6 }}>
            {e.id ? 'Edit popup' : 'New popup'}
            <IconButton onClick={() => setEditing(null)} sx={{ position: 'absolute', right: 12, top: 10 }} aria-label="Close"><CloseIcon /></IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Row cols={3}>
              <TextField label="Internal name" value={e.name} onChange={(ev) => setEditing({ ...e, name: ev.target.value })} />
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select value={e.data.popup_type} label="Type" onChange={(ev) => setD('popup_type', ev.target.value)}>
                  {POPUP_TYPES.map((t) => <MenuItem key={t.id} value={t.id}>{t.label}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="Priority (higher wins)" type="number" value={e.priority || 0} onChange={(ev) => setEditing({ ...e, priority: Number(ev.target.value) })} />
            </Row>

            <H4>Content</H4>
            <Stack spacing={2}>
              <TextField label="Title" value={e.data.title} onChange={(ev) => setD('title', ev.target.value)} />
              <TextField label="Text" value={e.data.text} onChange={(ev) => setD('text', ev.target.value)} multiline rows={3} />
            </Stack>
            <Box sx={{ mt: 2 }}>
              <AdminImageField label="Image (optional)" value={e.data.image_url} alt={e.data.image_alt}
                onChange={(v) => setD('image_url', v)} onAltChange={(v) => setD('image_alt', v)} />
            </Box>
            <Row>
              <TextField label="CTA button text" value={e.data.cta_text} onChange={(ev) => setD('cta_text', ev.target.value)} />
              <TextField label="CTA link" value={e.data.cta_link} onChange={(ev) => setD('cta_link', ev.target.value)} placeholder="/shop" />
            </Row>
            <Box sx={{ mb: 2 }}>
              <TextField label="Secondary dismiss text" value={e.data.secondary_text} onChange={(ev) => setD('secondary_text', ev.target.value)} placeholder="No thanks" />
            </Box>
            <Row>
              <TextField label="Coupon code (optional)" value={e.data.coupon_code} onChange={(ev) => setD('coupon_code', ev.target.value.toUpperCase())} placeholder="WELCOME10" />
              <TextField label="Countdown ends (PKT, optional)" type="datetime-local" InputLabelProps={{ shrink: true }} value={toPKTInput(e.data.countdown_ends_at)} onChange={(ev) => setD('countdown_ends_at', fromPKTInput(ev.target.value) || '')} />
            </Row>
            <FormControlLabel
              control={<Switch checked={!!e.data.newsletter_enabled} onChange={(ev) => setD('newsletter_enabled', ev.target.checked)} />}
              label="Include newsletter signup form"
            />

            <H4>Trigger</H4>
            <Row>
              <FormControl fullWidth size="small">
                <InputLabel>Trigger</InputLabel>
                <Select value={e.data.trigger} label="Trigger" onChange={(ev) => setD('trigger', ev.target.value)}>
                  <MenuItem value="delay">After delay (seconds)</MenuItem>
                  <MenuItem value="scroll">On scroll (% of page)</MenuItem>
                  <MenuItem value="exit">Exit intent (desktop)</MenuItem>
                  <MenuItem value="click">On click (CSS selector)</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label={e.data.trigger === 'delay' ? 'Seconds' : e.data.trigger === 'scroll' ? 'Scroll %' : e.data.trigger === 'click' ? 'CSS selector' : '—'}
                value={e.data.trigger_value} disabled={e.data.trigger === 'exit'}
                onChange={(ev) => setD('trigger_value', ev.target.value)}
                placeholder={e.data.trigger === 'click' ? '.buy-button' : '8'}
              />
            </Row>

            <H4>Frequency</H4>
            <Row>
              <FormControl fullWidth size="small">
                <InputLabel>Show</InputLabel>
                <Select value={e.data.frequency} label="Show" onChange={(ev) => setD('frequency', ev.target.value)}>
                  <MenuItem value="once_session">Once per session</MenuItem>
                  <MenuItem value="every_visit">Every visit</MenuItem>
                  <MenuItem value="every_x_days">Every X days</MenuItem>
                  <MenuItem value="once_ever">Once ever</MenuItem>
                </Select>
              </FormControl>
              {e.data.frequency === 'every_x_days' && (
                <TextField label="Days" type="number" inputProps={{ min: 1 }} value={e.data.frequency_days || 7} onChange={(ev) => setD('frequency_days', Number(ev.target.value))} />
              )}
            </Row>

            <H4>Targeting</H4>
            <Row cols={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Pages</InputLabel>
                <Select value={e.data.pages} label="Pages" onChange={(ev) => setD('pages', ev.target.value)}>
                  <MenuItem value="all">All pages</MenuItem>
                  <MenuItem value="home">Homepage only</MenuItem>
                  <MenuItem value="shop">Shop pages</MenuItem>
                  <MenuItem value="product">Product pages</MenuItem>
                  <MenuItem value="custom">Custom URLs</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Device</InputLabel>
                <Select value={e.data.device} label="Device" onChange={(ev) => setD('device', ev.target.value)}>
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="mobile">Mobile only</MenuItem>
                  <MenuItem value="desktop">Desktop only</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Audience</InputLabel>
                <Select value={e.data.audience} label="Audience" onChange={(ev) => setD('audience', ev.target.value)}>
                  <MenuItem value="all">Everyone</MenuItem>
                  <MenuItem value="new">New visitors</MenuItem>
                  <MenuItem value="returning">Returning visitors</MenuItem>
                </Select>
              </FormControl>
            </Row>
            {e.data.pages === 'custom' && (
              <Box sx={{ mb: 2 }}>
                <TextField label="URLs (comma separated)" value={e.data.page_urls} onChange={(ev) => setD('page_urls', ev.target.value)} placeholder="/sale, /product/5" />
              </Box>
            )}

            <H4>Schedule</H4>
            <ScheduleFields value={e} onChange={(nv) => setEditing({ ...e, ...nv })} />

            <H4>Preview</H4>
            <Box sx={{ border: '1px dashed #C9C2B2', borderRadius: 2, p: 2.5, bgcolor: '#FAFAF7' }}>
              <Box sx={{ bgcolor: '#fff', borderRadius: 2, maxWidth: 360, mx: 'auto', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,.12)' }}>
                {e.data.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <Box component="img" src={e.data.image_url} alt="" sx={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                )}
                <Box sx={{ p: 2.5, textAlign: 'center' }}>
                  {e.data.title && <Typography variant="h6" sx={{ mb: 1 }}>{e.data.title}</Typography>}
                  {e.data.text && <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, whiteSpace: 'pre-line' }}>{e.data.text}</Typography>}
                  {e.data.coupon_code && <Box sx={{ border: '2px dashed #B08D3E', borderRadius: 2, px: 2, py: 1, fontWeight: 700, display: 'inline-block', mb: 1.25 }}>{e.data.coupon_code}</Box>}
                  {e.data.cta_text && <Box sx={{ bgcolor: '#111', color: '#fff', borderRadius: 1.5, p: 1.5, fontWeight: 700, mt: 1 }}>{e.data.cta_text}</Box>}
                </Box>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="contained" onClick={() => save(e)}>Save popup</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Offers / Sales (Phase 3)                                            */
/* ------------------------------------------------------------------ */

function blankOffer() {
  return {
    id: null, name: 'offer-' + Date.now().toString(36), status: 'published', active: 1,
    starts_at: null, ends_at: null, priority: 0,
    data: {
      discount_type: 'percent', discount_value: 10,
      applies_to: 'all', collection: 'everyday', product_ids: [], tag: '',
      badge_text: '', banner_text: '', show_banner: false,
    },
  };
}

function Offers() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const d = await apiContent('GET', '/api/admin/content?type=offer').catch(() => ({ items: [] }));
    setList(d.items || []);
  };
  useEffect(() => { load().catch(() => setError('Failed to load.')); }, []);

  const save = async (o) => {
    setMsg(''); setError('');
    try {
      const v = Number(o.data.discount_value);
      if (!(v > 0)) throw new Error('Discount value must be > 0.');
      if (o.data.discount_type === 'percent' && v > 90) throw new Error('Percent discount max 90%.');
      if (o.id) {
        await apiContent('PATCH', `/api/admin/content/${o.id}`, {
          data: o.data, name: o.name, status: o.status, active: o.active,
          starts_at: o.starts_at, ends_at: o.ends_at, priority: o.priority,
        });
      } else {
        await apiContent('POST', '/api/admin/content', {
          type: 'offer', name: o.name, data: o.data, status: o.status,
          active: o.active !== 0, starts_at: o.starts_at || null,
          ends_at: o.ends_at || null, priority: o.priority || 0,
        });
      }
      setEditing(null); await load();
      setMsg('Offer saved — sale prices live immediately.');
    } catch (err) { setError(err.message); }
  };

  const del = async (id) => {
    if (!confirm('Delete this offer? Prices revert immediately.')) return;
    try { await apiContent('DELETE', `/api/admin/content/${id}`); await load(); setMsg('Offer deleted — prices reverted.'); }
    catch (err) { setError(err.message); }
  };

  const showPreview = async (o) => {
    try {
      const r = await fetch('/api/admin/offers/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: o.data }),
      }).then((x) => x.json());
      setPreview({ offer: o, ...r });
    } catch (err) { setError(err.message); }
  };

  const e = editing;
  const setD = (k, v) => setEditing({ ...e, data: { ...e.data, [k]: v } });

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>Offers & Sales</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>Automatic sale prices on cards + product pages. Expired offers revert prices automatically.</Typography>
      <Messages msg={msg} error={error} />

      {list.map((o) => (
        <Card key={o.id} sx={{ mb: 1.5 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap spacing={1}>
              <Box>
                <Typography component="span" fontWeight={700}>{o.name}</Typography>
                <Typography component="span" fontWeight={700} sx={{ color: '#B3402E', ml: 1.25 }}>
                  {o.data.discount_type === 'percent' ? `${o.data.discount_value}% OFF` : `Rs ${Number(o.data.discount_value).toLocaleString()} OFF`}
                </Typography>
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  {o.data.applies_to === 'all' ? 'All products' : o.data.applies_to === 'collection' ? `Collection: ${o.data.collection}` : o.data.applies_to === 'products' ? `${(o.data.product_ids || []).length} products` : `Tag: ${o.data.tag}`}
                  {o.ends_at ? ` · ends ${formatPKT(o.ends_at)}` : ''}
                </Typography>
              </Box>
              <LivePill block={o} />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
              <Button size="small" variant="outlined" onClick={() => setEditing(JSON.parse(JSON.stringify(o)))}>Edit</Button>
              <Button size="small" variant="outlined" onClick={() => showPreview(o)}>Preview affected</Button>
              <Button size="small" variant="outlined" color="error" onClick={() => del(o.id)}>Delete</Button>
            </Stack>
          </CardContent>
        </Card>
      ))}
      <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setEditing(blankOffer())}>New offer</Button>

      {preview && (
        <Dialog open onClose={() => setPreview(null)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ pr: 6 }}>
            Affected products ({preview.count})
            <IconButton onClick={() => setPreview(null)} sx={{ position: 'absolute', right: 12, top: 10 }} aria-label="Close"><CloseIcon /></IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Showing first 20. Sale prices apply automatically.</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead><TableRow><TableCell>Product</TableCell><TableCell>Was</TableCell><TableCell>Now</TableCell></TableRow></TableHead>
                <TableBody>
                  {(preview.items || []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell><s>Rs {Number(p.was).toLocaleString()}</s></TableCell>
                      <TableCell><Typography component="span" fontWeight={700} sx={{ color: '#B3402E' }}>Rs {Number(p.now).toLocaleString()}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button variant="outlined" onClick={() => setPreview(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}

      {e && (
        <Dialog open onClose={() => setEditing(null)} maxWidth="md" fullWidth scroll="paper">
          <DialogTitle sx={{ pr: 6 }}>
            {e.id ? 'Edit offer' : 'New offer'}
            <IconButton onClick={() => setEditing(null)} sx={{ position: 'absolute', right: 12, top: 10 }} aria-label="Close"><CloseIcon /></IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Row cols={3}>
              <TextField label="Internal name" value={e.name} onChange={(ev) => setEditing({ ...e, name: ev.target.value })} />
              <FormControl fullWidth size="small">
                <InputLabel>Discount type</InputLabel>
                <Select value={e.data.discount_type} label="Discount type" onChange={(ev) => setD('discount_type', ev.target.value)}>
                  <MenuItem value="percent">Percent %</MenuItem>
                  <MenuItem value="fixed">Fixed Rs amount</MenuItem>
                </Select>
              </FormControl>
              <TextField label="Value" type="number" inputProps={{ min: 1 }} value={e.data.discount_value} onChange={(ev) => setD('discount_value', Number(ev.target.value))} />
            </Row>
            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Applies to</InputLabel>
                <Select value={e.data.applies_to} label="Applies to" onChange={(ev) => setD('applies_to', ev.target.value)}>
                  <MenuItem value="all">All products</MenuItem>
                  <MenuItem value="collection">One collection</MenuItem>
                  <MenuItem value="products">Specific products</MenuItem>
                  <MenuItem value="tag">Product tag</MenuItem>
                </Select>
              </FormControl>
            </Box>
            {e.data.applies_to === 'collection' && (
              <Box sx={{ mb: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Collection</InputLabel>
                  <Select value={e.data.collection} label="Collection" onChange={(ev) => setD('collection', ev.target.value)}>
                    <MenuItem value="everyday">Everyday</MenuItem>
                    <MenuItem value="signature">Signature</MenuItem>
                    <MenuItem value="leather">Leather</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}
            {e.data.applies_to === 'products' && (
              <Box sx={{ mb: 2 }}>
                <TextField label="Product IDs (comma separated)" value={(e.data.product_ids || []).join(', ')}
                  onChange={(ev) => setD('product_ids', ev.target.value.split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean))}
                  placeholder="1, 5, 12" />
              </Box>
            )}
            {e.data.applies_to === 'tag' && (
              <Box sx={{ mb: 2 }}>
                <TextField label="Tag" value={e.data.tag} onChange={(ev) => setD('tag', ev.target.value)} placeholder="sale" />
              </Box>
            )}
            <Row>
              <TextField label="Badge text (optional)" value={e.data.badge_text} onChange={(ev) => setD('badge_text', ev.target.value)} placeholder="SALE / -20%" />
              <FormControlLabel
                control={<Switch checked={!!e.data.show_banner} onChange={(ev) => setD('show_banner', ev.target.checked)} />}
                label="Show floating banner"
                sx={{ alignSelf: 'center' }}
              />
            </Row>
            {e.data.show_banner && (
              <Box sx={{ mb: 2 }}>
                <TextField label="Banner text" value={e.data.banner_text} onChange={(ev) => setD('banner_text', ev.target.value)} placeholder="Winter Sale — up to 20% off" />
              </Box>
            )}
            <ScheduleFields value={e} onChange={(nv) => setEditing({ ...e, ...nv })} />
            <Typography variant="caption" color="text.secondary">Schedule with Start/End (PKT) — prices revert automatically when the offer ends.</Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="contained" onClick={() => save(e)}>Save offer</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

export { SiteSettings, Menus, Bars, Popups, Offers };
