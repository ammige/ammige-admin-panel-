'use client';

import { useEffect, useState } from 'react';
import {
  Box, Stack, Paper, Card, CardContent, Button, TextField, FormControl, InputLabel,
  Select, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, Typography, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Switch, FormControlLabel, Tabs, Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { apiContent, ScheduleFields, LivePill, AdminImageField, formatPKT } from './shared';

const SECTION_LABELS = {
  hero: 'Hero slider', collections: 'Collections', bestsellers: 'Bestsellers / Featured',
  occasion: 'Shop by occasion', craft: 'Craft story', video: 'Video',
  trust: 'Trust badges', gallery: 'Gallery strip', testimonials: 'Testimonials',
  newsletter: 'Newsletter',
};

const Row = ({ children, cols = 2 }) => (
  <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: `repeat(${cols}, 1fr)` }, mb: 2 }}>{children}</Box>
);

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
          value={value || '#FFFFFF'}
          onChange={(e) => onChange(e.target.value)}
          sx={{ width: 44, height: 40, p: 0, border: '1px solid #C9C2B2', borderRadius: 1.5, bgcolor: 'transparent', cursor: 'pointer' }}
        />
        <TextField value={value || ''} onChange={(e) => onChange(e.target.value)} sx={{ flex: 1 }} />
      </Stack>
    </Box>
  );
}

function BlockCard({ title, block, children, onEdit, onDelete }) {
  return (
    <Card sx={{ mb: 1.5 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: children || onEdit ? 1 : 0 }}>
          <Typography fontWeight={700}>{title}</Typography>
          {block && <LivePill block={block} />}
        </Stack>
        {children}
        {(onEdit || onDelete) && (
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {onEdit && <Button size="small" variant="outlined" onClick={onEdit}>Edit</Button>}
            {onDelete && <Button size="small" variant="outlined" color="error" onClick={onDelete}>Delete</Button>}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function EditorDialog({ open, onClose, title, onSave, saveLabel = 'Save', children, maxWidth = 'md' }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth scroll="paper">
      <DialogTitle sx={{ pr: 6 }}>
        {title}
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 12, top: 10 }} aria-label="Close"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave}>{saveLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}

function blankHero() {
  return {
    id: null, name: 'hero-' + Date.now().toString(36), status: 'published', active: 1,
    starts_at: null, ends_at: null, priority: 0,
    data: {
      desktop_image: '', mobile_image: '', video_url: '',
      eyebrow: '', headline: '', subheadline: '',
      cta1_text: 'Shop Now', cta1_link: '/shop', cta2_text: '', cta2_link: '',
      align: 'center', overlay: 45, text_color: '#FFFFFF', animation: 'fade',
    },
  };
}

function Homepage() {
  const [layout, setLayout] = useState(null);
  const [heroes, setHeroes] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [banners, setBanners] = useState([]);
  const [viewerCfg, setViewerCfg] = useState(null);
  const [viewerId, setViewerId] = useState(null);
  const [editingHero, setEditingHero] = useState(null);
  const [editingBanner, setEditingBanner] = useState(null);
  const [editingT, setEditingT] = useState(null);
  const [editingF, setEditingF] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [sub, setSub] = useState('sections');

  const load = async () => {
    const [l, h, t, f, b, v] = await Promise.all([
      apiContent('GET', '/api/admin/content?type=homepage').catch(() => ({ items: [] })),
      apiContent('GET', '/api/admin/content?type=hero').catch(() => ({ items: [] })),
      apiContent('GET', '/api/admin/content?type=testimonial').catch(() => ({ items: [] })),
      apiContent('GET', '/api/admin/content?type=faq').catch(() => ({ items: [] })),
      apiContent('GET', '/api/admin/content?type=banner').catch(() => ({ items: [] })),
      apiContent('GET', '/api/admin/content?type=viewer_3d').catch(() => ({ items: [] })),
    ]);
    setLayout(l.items[0] || null);
    setHeroes(h.items || []);
    setTestimonials(t.items || []);
    setFaqs(f.items || []);
    setBanners(b.items || []);
    if (v.items[0]) { setViewerCfg(v.items[0].data); setViewerId(v.items[0].id); }
  };
  useEffect(() => { load().catch(() => setError('Failed to load.')); }, []);

  const saveLayout = async () => {
    setMsg(''); setError('');
    try {
      await apiContent('PATCH', `/api/admin/content/${layout.id}`, {
        data: layout.data, status: layout.status, active: layout.active,
        starts_at: layout.starts_at, ends_at: layout.ends_at,
      });
      setMsg('Homepage saved — live immediately.');
    } catch (err) { setError(err.message); }
  };

  const saveBlock = async (type, b, setEd) => {
    setMsg(''); setError('');
    try {
      if (b.id) {
        await apiContent('PATCH', `/api/admin/content/${b.id}`, {
          data: b.data, name: b.name, status: b.status, active: b.active,
          starts_at: b.starts_at, ends_at: b.ends_at, priority: b.priority,
        });
      } else {
        await apiContent('POST', '/api/admin/content', {
          type, name: b.name, data: b.data, status: b.status,
          active: b.active !== 0, starts_at: b.starts_at || null,
          ends_at: b.ends_at || null, priority: b.priority || 0,
        });
      }
      setEd(null); await load(); setMsg('Saved — live immediately.');
    } catch (err) { setError(err.message); }
  };

  const delBlock = async (id) => {
    if (!confirm('Delete?')) return;
    try { await apiContent('DELETE', `/api/admin/content/${id}`); await load(); setMsg('Deleted.'); }
    catch (err) { setError(err.message); }
  };

  const moveSection = (i, dir) => {
    const secs = [...layout.data.sections];
    const j = i + dir;
    if (j < 0 || j >= secs.length) return;
    [secs[i], secs[j]] = [secs[j], secs[i]];
    setLayout({ ...layout, data: { ...layout.data, sections: secs } });
  };
  const toggleSection = (i) => {
    const secs = [...layout.data.sections];
    secs[i] = { ...secs[i], visible: secs[i].visible === false ? true : false };
    setLayout({ ...layout, data: { ...layout.data, sections: secs } });
  };

  if (!layout) return <Typography color="text.secondary">Loading…</Typography>;
  const D = layout.data;
  const setCopy = (sec, k, v) => setLayout({
    ...layout,
    data: { ...D, copy: { ...D.copy, [sec]: { ...(D.copy[sec] || {}), [k]: v } } },
  });
  const setHeroSet = (k, v) => setLayout({
    ...layout, data: { ...D, hero_settings: { ...(D.hero_settings || {}), [k]: v } },
  });

  const SUBS = [
    ['sections', 'Sections'], ['hero', 'Hero slides'], ['copy', 'Section text'],
    ['banners', 'Banners'], ['testimonials', 'Testimonials'], ['faq', 'FAQs'], ['viewer3d', '3D Viewer'],
  ];

  const eh = editingHero;
  const sdHero = (k, v) => setEditingHero({ ...eh, data: { ...eh.data, [k]: v } });
  const et = editingT;
  const sdT = (k, v) => setEditingT({ ...et, data: { ...et.data, [k]: v } });
  const ef = editingF;
  const sdF = (k, v) => setEditingF({ ...ef, data: { ...ef.data, [k]: v } });

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>Homepage Builder</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Sections, hero, banners, testimonials, FAQs — all live immediately.</Typography>
      <Messages msg={msg} error={error} />

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
        <Tabs value={sub} onChange={(_, v) => setSub(v)} variant="scrollable" scrollButtons="auto" sx={{ flex: 1, minWidth: 0 }}>
          {SUBS.map(([id, label]) => <Tab key={id} value={id} label={label} sx={{ textTransform: 'none', fontWeight: 600 }} />)}
        </Tabs>
        <Button variant="outlined" size="small" endIcon={<OpenInNewIcon />} href="/" target="_blank" rel="noreferrer">Preview</Button>
      </Stack>

      {/* ============ SECTIONS ============ */}
      {sub === 'sections' && (
        <Box>
          {(D.sections || []).map((s, i) => (
            <Paper key={s.id} variant="outlined" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.75, py: 1, mb: 1, bgcolor: s.visible === false ? '#F5F2EA' : '#fff', opacity: s.visible === false ? 0.65 : 1 }}>
              <Typography fontWeight={700}>{i + 1}.</Typography>
              <Typography sx={{ flex: 1 }}>{SECTION_LABELS[s.id] || s.id}</Typography>
              <IconButton size="small" onClick={() => moveSection(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUpwardIcon fontSize="small" /></IconButton>
              <IconButton size="small" onClick={() => moveSection(i, 1)} disabled={i === D.sections.length - 1} aria-label="Move down"><ArrowDownwardIcon fontSize="small" /></IconButton>
              <Switch checked={s.visible !== false} onChange={() => toggleSection(i)} inputProps={{ 'aria-label': 'Toggle section visibility' }} />
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 44 }}>{s.visible === false ? 'Hidden' : 'Visible'}</Typography>
            </Paper>
          ))}
          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>Hero slider settings</Typography>
            <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap alignItems="center">
              <FormControlLabel control={<Switch checked={D.hero_settings?.autoplay !== false} onChange={(e) => setHeroSet('autoplay', e.target.checked)} />} label="Autoplay" />
              <TextField label="Seconds per slide" type="number" inputProps={{ min: 3, max: 30 }} value={D.hero_settings?.autoplay_seconds || 6} onChange={(e) => setHeroSet('autoplay_seconds', Number(e.target.value))} sx={{ width: 170 }} />
              <FormControlLabel control={<Switch checked={D.hero_settings?.show_dots !== false} onChange={(e) => setHeroSet('show_dots', e.target.checked)} />} label="Dots" />
              <FormControlLabel control={<Switch checked={D.hero_settings?.show_arrows !== false} onChange={(e) => setHeroSet('show_arrows', e.target.checked)} />} label="Arrows" />
            </Stack>
          </Paper>
          <Button variant="contained" onClick={saveLayout} sx={{ mt: 2 }}>Save homepage</Button>
        </Box>
      )}

      {/* ============ HERO ============ */}
      {sub === 'hero' && (
        <Box>
          {heroes.map((h) => (
            <BlockCard key={h.id} title={h.data.headline || h.name} block={h}
              onEdit={() => setEditingHero(JSON.parse(JSON.stringify(h)))}
              onDelete={() => delBlock(h.id)}>
              {h.data.desktop_image && (
                <Box component="img" src={h.data.desktop_image} alt="" sx={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 1.5, display: 'block' }} />
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{h.data.subheadline}</Typography>
            </BlockCard>
          ))}
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setEditingHero(blankHero())}>New slide</Button>

          {eh && (
            <EditorDialog open onClose={() => setEditingHero(null)} title={eh.id ? 'Edit slide' : 'New slide'}
              onSave={() => saveBlock('hero', editingHero, setEditingHero)} saveLabel="Save slide">
              <AdminImageField label="Desktop image" value={eh.data.desktop_image} onChange={(v) => sdHero('desktop_image', v)} />
              <AdminImageField label="Mobile image (optional)" value={eh.data.mobile_image} onChange={(v) => sdHero('mobile_image', v)} hint="Shown on phones. Empty = desktop image." />
              <Box sx={{ mb: 2 }}>
                <TextField label="Video URL (optional, overrides image)" value={eh.data.video_url} onChange={(e) => sdHero('video_url', e.target.value)} placeholder="/media/videos/… or https://…" />
              </Box>
              <Stack spacing={2} sx={{ mb: 2 }}>
                <TextField label="Eyebrow" value={eh.data.eyebrow} onChange={(e) => sdHero('eyebrow', e.target.value)} />
                <TextField label="Headline" value={eh.data.headline} onChange={(e) => sdHero('headline', e.target.value)} />
                <TextField label="Subheadline" value={eh.data.subheadline} onChange={(e) => sdHero('subheadline', e.target.value)} multiline rows={2} />
              </Stack>
              <Row>
                <TextField label="CTA 1 text" value={eh.data.cta1_text} onChange={(e) => sdHero('cta1_text', e.target.value)} />
                <TextField label="CTA 1 link" value={eh.data.cta1_link} onChange={(e) => sdHero('cta1_link', e.target.value)} />
              </Row>
              <Row>
                <TextField label="CTA 2 text" value={eh.data.cta2_text} onChange={(e) => sdHero('cta2_text', e.target.value)} />
                <TextField label="CTA 2 link" value={eh.data.cta2_link} onChange={(e) => sdHero('cta2_link', e.target.value)} />
              </Row>
              <Row cols={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Text align</InputLabel>
                  <Select value={eh.data.align} label="Text align" onChange={(e) => sdHero('align', e.target.value)}>
                    <MenuItem value="left">Left</MenuItem>
                    <MenuItem value="center">Center</MenuItem>
                    <MenuItem value="right">Right</MenuItem>
                  </Select>
                </FormControl>
                <TextField label="Overlay darkness (0–80)" type="number" inputProps={{ min: 0, max: 80 }} value={eh.data.overlay ?? 45} onChange={(e) => sdHero('overlay', Number(e.target.value))} />
                <ColorField label="Text color" value={eh.data.text_color || '#FFFFFF'} onChange={(v) => sdHero('text_color', v)} />
                <FormControl fullWidth size="small">
                  <InputLabel>Animation</InputLabel>
                  <Select value={eh.data.animation} label="Animation" onChange={(e) => sdHero('animation', e.target.value)}>
                    <MenuItem value="fade">Fade</MenuItem>
                    <MenuItem value="slide">Slide up</MenuItem>
                    <MenuItem value="zoom">Slow zoom</MenuItem>
                    <MenuItem value="none">None</MenuItem>
                  </Select>
                </FormControl>
              </Row>
              <ScheduleFields value={eh} onChange={(nv) => setEditingHero({ ...eh, ...nv })} />
            </EditorDialog>
          )}
        </Box>
      )}

      {/* ============ SECTION COPY ============ */}
      {sub === 'copy' && (
        <Box>
          {Object.keys(SECTION_LABELS).filter((s) => s !== 'hero').map((sec) => (
            <Paper key={sec} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>{SECTION_LABELS[sec]}</Typography>
              <Row>
                <TextField label="Eyebrow" value={D.copy?.[sec]?.eyebrow || ''} onChange={(e) => setCopy(sec, 'eyebrow', e.target.value)} />
                <TextField label="Title" value={D.copy?.[sec]?.title || ''} onChange={(e) => setCopy(sec, 'title', e.target.value)} />
              </Row>
              <Box sx={{ mb: sec === 'bestsellers' ? 2 : 0 }}>
                <TextField label="Text" value={D.copy?.[sec]?.text || ''} onChange={(e) => setCopy(sec, 'text', e.target.value)} multiline rows={2} />
              </Box>
              {sec === 'bestsellers' && (
                <Row cols={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Product source</InputLabel>
                    <Select value={D.copy?.bestsellers?.source || 'badge'} label="Product source" onChange={(e) => setCopy('bestsellers', 'source', e.target.value)}>
                      <MenuItem value="badge">Bestseller badge</MenuItem>
                      <MenuItem value="manual">Hand-picked products</MenuItem>
                      <MenuItem value="collection">One collection</MenuItem>
                    </Select>
                  </FormControl>
                  {(D.copy?.bestsellers?.source === 'manual') && (
                    <TextField label="Product IDs (comma separated)" value={(D.copy?.bestsellers?.product_ids || []).join(', ')}
                      onChange={(e) => setCopy('bestsellers', 'product_ids', e.target.value.split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean))} />
                  )}
                  {(D.copy?.bestsellers?.source === 'collection') && (
                    <FormControl fullWidth size="small">
                      <InputLabel>Collection</InputLabel>
                      <Select value={D.copy?.bestsellers?.collection || ''} label="Collection" onChange={(e) => setCopy('bestsellers', 'collection', e.target.value)}>
                        <MenuItem value="everyday">Everyday</MenuItem>
                        <MenuItem value="signature">Signature</MenuItem>
                        <MenuItem value="leather">Leather</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                  <TextField label="Max products" type="number" inputProps={{ min: 1, max: 20 }} value={D.copy?.bestsellers?.limit || 10} onChange={(e) => setCopy('bestsellers', 'limit', Number(e.target.value))} />
                </Row>
              )}
            </Paper>
          ))}
          <Button variant="contained" onClick={saveLayout}>Save section text</Button>
        </Box>
      )}

      {/* ============ BANNERS ============ */}
      {sub === 'banners' && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Full-width promo banners. Set position to "homepage" to show between sections.</Typography>
          {banners.filter((b) => !['occasion-tiles', 'craft-steps', 'gallery'].includes(b.name)).map((b) => (
            <BlockCard key={b.id} title={b.data.title || b.name} block={b}
              onEdit={() => setEditingBanner(JSON.parse(JSON.stringify(b)))}
              onDelete={() => delBlock(b.id)}>
              {b.data.desktop_image && (
                <Box component="img" src={b.data.desktop_image} alt="" sx={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 1.5, display: 'block' }} />
              )}
            </BlockCard>
          ))}
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setEditingBanner({
            id: null, name: 'banner-' + Date.now().toString(36), status: 'published', active: 1,
            starts_at: null, ends_at: null, priority: 0,
            data: { desktop_image: '', mobile_image: '', alt: '', eyebrow: '', title: '', text: '', cta_text: '', cta_link: '', align: 'center', overlay: 35, text_color: '#FFFFFF', height: 'medium', position: 'homepage' },
          })}>New banner</Button>
          {editingBanner && (
            <BannerEditor b={editingBanner} setB={setEditingBanner}
              onSave={() => saveBlock('banner', editingBanner, setEditingBanner)}
              onCancel={() => setEditingBanner(null)} />
          )}
        </Box>
      )}

      {/* ============ TESTIMONIALS ============ */}
      {sub === 'testimonials' && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Enable the Testimonials section under Sections to show these on the homepage.</Typography>
          {testimonials.map((t) => (
            <BlockCard key={t.id} title={`${t.data.name}${t.data.location ? ` · ${t.data.location}` : ''}`} block={t}
              onEdit={() => setEditingT(JSON.parse(JSON.stringify(t)))}
              onDelete={() => delBlock(t.id)}>
              <Typography variant="body2" sx={{ fontStyle: 'italic' }}>“{t.data.text}”</Typography>
            </BlockCard>
          ))}
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setEditingT({
            id: null, name: 'review-' + Date.now().toString(36), status: 'published', active: 1,
            starts_at: null, ends_at: null, priority: 0,
            data: { name: '', location: '', text: '', rating: 5, photo_url: '', product: '' },
          })}>New testimonial</Button>
          {et && (
            <EditorDialog open onClose={() => setEditingT(null)} title={et.id ? 'Edit testimonial' : 'New testimonial'} maxWidth="sm"
              onSave={() => saveBlock('testimonial', editingT, setEditingT)}>
              <Row cols={3}>
                <TextField label="Name" value={et.data.name} onChange={(e) => sdT('name', e.target.value)} />
                <TextField label="Location" value={et.data.location} onChange={(e) => sdT('location', e.target.value)} placeholder="Karachi" />
                <FormControl fullWidth size="small">
                  <InputLabel>Rating</InputLabel>
                  <Select value={et.data.rating} label="Rating" onChange={(e) => sdT('rating', Number(e.target.value))}>
                    {[5, 4, 3, 2, 1].map((n) => <MenuItem key={n} value={n}>{n} stars</MenuItem>)}
                  </Select>
                </FormControl>
              </Row>
              <Box sx={{ mb: 2 }}>
                <TextField label="Review text" value={et.data.text} onChange={(e) => sdT('text', e.target.value)} multiline rows={3} />
              </Box>
              <Box sx={{ mb: 2 }}>
                <TextField label="Product bought (optional)" value={et.data.product} onChange={(e) => sdT('product', e.target.value)} />
              </Box>
              <AdminImageField label="Photo (optional)" value={et.data.photo_url} onChange={(v) => sdT('photo_url', v)} />
              <ScheduleFields value={et} onChange={(nv) => setEditingT({ ...et, ...nv })} />
            </EditorDialog>
          )}
        </Box>
      )}

      {/* ============ FAQ ============ */}
      {sub === 'faq' && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>FAQs appear on the FAQ page (and can be shown on product pages later).</Typography>
          {faqs.map((f) => (
            <BlockCard key={f.id} title={f.data.question} block={f}
              onEdit={() => setEditingF(JSON.parse(JSON.stringify(f)))}
              onDelete={() => delBlock(f.id)}>
              <Typography variant="body2" color="text.secondary">{(f.data.answer || '').slice(0, 120)}…</Typography>
            </BlockCard>
          ))}
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setEditingF({
            id: null, name: 'faq-' + Date.now().toString(36), status: 'published', active: 1,
            starts_at: null, ends_at: null, priority: 0,
            data: { question: '', answer: '', category: 'General' },
          })}>New FAQ</Button>
          {ef && (
            <EditorDialog open onClose={() => setEditingF(null)} title={ef.id ? 'Edit FAQ' : 'New FAQ'} maxWidth="sm"
              onSave={() => saveBlock('faq', editingF, setEditingF)}>
              <Stack spacing={2} sx={{ mb: 2 }}>
                <TextField label="Question" value={ef.data.question} onChange={(e) => sdF('question', e.target.value)} />
                <TextField label="Answer" value={ef.data.answer} onChange={(e) => sdF('answer', e.target.value)} multiline rows={4} />
                <TextField label="Category" value={ef.data.category} onChange={(e) => sdF('category', e.target.value)} />
              </Stack>
              <ScheduleFields value={ef} onChange={(nv) => setEditingF({ ...ef, ...nv })} />
            </EditorDialog>
          )}
        </Box>
      )}

      {/* ============ 3D VIEWER ============ */}
      {sub === 'viewer3d' && viewerCfg && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Global 3D viewer settings. Per-product: enable/disable, poster and mode in the product editor.</Typography>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Row cols={3}>
              <FormControlLabel control={<Switch checked={!!viewerCfg.auto_rotate} onChange={(e) => setViewerCfg({ ...viewerCfg, auto_rotate: e.target.checked })} />} label="Auto-rotate" sx={{ alignSelf: 'center' }} />
              <TextField label="Rotate speed" type="number" inputProps={{ min: 0.1, max: 5, step: 0.1 }} value={viewerCfg.rotate_speed || 1}
                onChange={(e) => setViewerCfg({ ...viewerCfg, rotate_speed: Number(e.target.value) })} />
              <TextField label="Light intensity" type="number" inputProps={{ min: 0.2, max: 2.5, step: 0.1 }} value={viewerCfg.light_intensity || 1}
                onChange={(e) => setViewerCfg({ ...viewerCfg, light_intensity: Number(e.target.value) })} />
            </Row>
            <Row cols={3}>
              <TextField label="Min zoom" type="number" inputProps={{ min: 0.5, max: 4, step: 0.5 }} value={viewerCfg.min_zoom || 1}
                onChange={(e) => setViewerCfg({ ...viewerCfg, min_zoom: Number(e.target.value) })} />
              <TextField label="Max zoom" type="number" inputProps={{ min: 1, max: 8, step: 0.5 }} value={viewerCfg.max_zoom || 4}
                onChange={(e) => setViewerCfg({ ...viewerCfg, max_zoom: Number(e.target.value) })} />
              <ColorField label="Background color" value={viewerCfg.bg_color || '#15120e'} onChange={(v) => setViewerCfg({ ...viewerCfg, bg_color: v })} />
            </Row>
            <Row cols={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Tone mapping</InputLabel>
                <Select value={viewerCfg.tone_mapping || 'aces'} label="Tone mapping" onChange={(e) => setViewerCfg({ ...viewerCfg, tone_mapping: e.target.value })}>
                  <MenuItem value="aces">ACES (cinematic)</MenuItem>
                  <MenuItem value="none">None</MenuItem>
                </Select>
              </FormControl>
              <Stack spacing={0.5}>
                <FormControlLabel control={<Switch checked={viewerCfg.bg_transparent !== false} onChange={(e) => setViewerCfg({ ...viewerCfg, bg_transparent: e.target.checked })} />} label="Transparent background" />
                <FormControlLabel control={<Switch checked={viewerCfg.shadow !== false} onChange={(e) => setViewerCfg({ ...viewerCfg, shadow: e.target.checked })} />} label="Ground shadow" />
              </Stack>
              <Stack spacing={0.5}>
                <FormControlLabel control={<Switch checked={viewerCfg.show_angle_buttons !== false} onChange={(e) => setViewerCfg({ ...viewerCfg, show_angle_buttons: e.target.checked })} />} label="Angle buttons" />
                <FormControlLabel control={<Switch checked={viewerCfg.show_ar_button !== false} onChange={(e) => setViewerCfg({ ...viewerCfg, show_ar_button: e.target.checked })} />} label="AR button (GLB only)" />
              </Stack>
            </Row>
            <Button variant="contained" onClick={async () => {
              setMsg(''); setError('');
              try {
                await apiContent('PATCH', `/api/admin/content/${viewerId}`, { data: viewerCfg });
                setMsg('3D viewer settings saved — live immediately.');
              } catch (err) { setError(err.message); }
            }}>Save 3D settings</Button>
          </Paper>
        </Box>
      )}
    </Box>
  );
}

function BannerEditor({ b, setB, onSave, onCancel }) {
  const sd = (k, v) => setB({ ...b, data: { ...b.data, [k]: v } });
  return (
    <EditorDialog open onClose={onCancel} title={b.id ? 'Edit banner' : 'New banner'} onSave={onSave} saveLabel="Save banner">
      <Box sx={{ mb: 2 }}>
        <TextField label="Internal name" value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} />
      </Box>
      <AdminImageField label="Desktop image" value={b.data.desktop_image} onChange={(v) => sd('desktop_image', v)} />
      <AdminImageField label="Mobile image (optional)" value={b.data.mobile_image} onChange={(v) => sd('mobile_image', v)} />
      <Stack spacing={2} sx={{ mb: 2 }}>
        <TextField label="Eyebrow" value={b.data.eyebrow} onChange={(e) => sd('eyebrow', e.target.value)} />
        <TextField label="Title" value={b.data.title} onChange={(e) => sd('title', e.target.value)} />
        <TextField label="Text" value={b.data.text} onChange={(e) => sd('text', e.target.value)} multiline rows={2} />
      </Stack>
      <Row>
        <TextField label="CTA text" value={b.data.cta_text} onChange={(e) => sd('cta_text', e.target.value)} />
        <TextField label="CTA link" value={b.data.cta_link} onChange={(e) => sd('cta_link', e.target.value)} />
      </Row>
      <Row cols={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Align</InputLabel>
          <Select value={b.data.align} label="Align" onChange={(e) => sd('align', e.target.value)}>
            <MenuItem value="left">Left</MenuItem>
            <MenuItem value="center">Center</MenuItem>
            <MenuItem value="right">Right</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth size="small">
          <InputLabel>Height</InputLabel>
          <Select value={b.data.height} label="Height" onChange={(e) => sd('height', e.target.value)}>
            <MenuItem value="short">Short</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="tall">Tall</MenuItem>
          </Select>
        </FormControl>
        <TextField label="Overlay" type="number" inputProps={{ min: 0, max: 80 }} value={b.data.overlay ?? 35} onChange={(e) => sd('overlay', Number(e.target.value))} />
      </Row>
      <ScheduleFields value={b} onChange={(nv) => setB({ ...b, ...nv })} />
    </EditorDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Collections manager (Phase 5)                                       */
/* ------------------------------------------------------------------ */

function Collections() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const d = await apiContent('GET', '/api/admin/content?type=collection').catch(() => ({ items: [] }));
    setList(d.items || []);
  };
  useEffect(() => { load().catch(() => setError('Failed to load.')); }, []);

  const save = async (c) => {
    setMsg(''); setError('');
    try {
      if (c.id) {
        await apiContent('PATCH', `/api/admin/content/${c.id}`, {
          data: c.data, name: c.name, status: c.status, active: c.active,
        });
      } else {
        await apiContent('POST', '/api/admin/content', {
          type: 'collection', name: c.data.id, data: c.data, status: 'published', active: 1,
        });
      }
      setEditing(null); await load(); setMsg('Collection saved — live immediately.');
    } catch (err) { setError(err.message); }
  };

  const ce = editing;
  const sd = (k, v) => setEditing({ ...ce, data: { ...ce.data, [k]: v } });

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>Collections</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>Rename, describe and re-image collections. IDs cannot be changed after creation.</Typography>
      <Messages msg={msg} error={error} />

      {list.map((c) => (
        <Card key={c.id} sx={{ mb: 1.5 }}>
          <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {c.data.image && (
              <Box component="img" src={c.data.image} alt="" sx={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 2 }} />
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography component="span" fontWeight={700}>{c.data.name}</Typography>
              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1, fontFamily: 'monospace' }}>{c.data.id}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{c.data.tagline}</Typography>
            </Box>
            <Button size="small" variant="outlined" onClick={() => setEditing(JSON.parse(JSON.stringify(c)))}>Edit</Button>
          </CardContent>
        </Card>
      ))}

      {ce && (
        <EditorDialog open onClose={() => setEditing(null)} title="Edit collection" maxWidth="sm" onSave={() => save(editing)}>
          <Stack spacing={2} sx={{ mb: 2 }}>
            <TextField label="Display name" value={ce.data.name} onChange={(e) => sd('name', e.target.value)} />
            <TextField label="Tagline" value={ce.data.tagline} onChange={(e) => sd('tagline', e.target.value)} />
            <TextField label="Description" value={ce.data.description || ''} onChange={(e) => sd('description', e.target.value)} multiline rows={3} />
          </Stack>
          <AdminImageField label="Collection image" value={ce.data.image} onChange={(v) => sd('image', v)} />
        </EditorDialog>
      )}
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Activity log                                                         */
/* ------------------------------------------------------------------ */

function ActivityLog() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/admin/activity?limit=200').then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => setError('Failed to load activity.'));
  }, []);
  return (
    <Box sx={{ maxWidth: 1000 }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>Activity Log</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>Who changed what, when. Newest first.</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <TableContainer component={Paper} sx={{ border: '1px solid #E8E2D6' }}>
        <Table>
          <TableHead><TableRow><TableCell>When (PKT)</TableCell><TableCell>Action</TableCell><TableCell>Entity</TableCell><TableCell>Detail</TableCell></TableRow></TableHead>
          <TableBody>
            {items.map((a) => (
              <TableRow key={a.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatPKT(a.created_at)}</TableCell>
                <TableCell><Typography variant="body2" fontWeight={700}>{a.action}</Typography></TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{a.entity}{a.entity_id ? ` #${a.entity_id}` : ''}</TableCell>
                <TableCell>{a.detail || '—'}</TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No activity yet.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export { Homepage, Collections, ActivityLog };
