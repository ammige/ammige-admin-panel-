'use client';
import { useEffect, useState } from 'react';
import { apiContent, ScheduleFields, LivePill, AdminImageField, formatPKT, toPKTInput, fromPKTInput, uploadFile } from './shared';

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

  if (!s) return <div className="empty">Loading…</div>;
  const seoB = seo[seoPage];
  const setSeoData = (k, v) => setSeo({ ...seo, [seoPage]: { ...seoB, data: { ...(seoB?.data || {}), [k]: v } } });

  return (
    <div>
      {msg && <div className="ad-success">{msg}</div>}
      {error && <div className="ad-error">{error}</div>}

      <h3 style={{ marginTop: 0 }}>Store identity</h3>
      <div className="f-row">
        <div className="f-group"><label>Store name</label>
          <input value={s.store_name || ''} onChange={(e) => set('store_name', e.target.value)} /></div>
        <div className="f-group"><label>Contact email</label>
          <input value={s.contact_email || ''} onChange={(e) => set('contact_email', e.target.value)} /></div>
        <div className="f-group"><label>Contact phone</label>
          <input value={s.contact_phone || ''} onChange={(e) => set('contact_phone', e.target.value)} /></div>
      </div>
      <div className="f-group"><label>Address</label>
        <input value={s.contact_address || ''} onChange={(e) => set('contact_address', e.target.value)} /></div>
      <div className="f-row">
        <div className="f-group"><label>Logo (light bg)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={s.logo_light || ''} onChange={(e) => set('logo_light', e.target.value)} style={{ flex: 1 }} />
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>↑
              <input type="file" accept="image/*" hidden onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return;
                try { set('logo_light', await uploadFile(f, 800)); } catch (err) { setError(err.message); }
              }} /></label>
          </div></div>
        <div className="f-group"><label>Favicon</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={s.favicon_url || ''} onChange={(e) => set('favicon_url', e.target.value)} style={{ flex: 1 }} />
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>↑
              <input type="file" accept="image/*" hidden onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return;
                try { set('favicon_url', await uploadFile(f, 256)); } catch (err) { setError(err.message); }
              }} /></label>
          </div></div>
      </div>

      <h3>Social links</h3>
      <div className="f-row">
        {['instagram', 'tiktok', 'facebook', 'youtube'].map((n) => (
          <div className="f-group" key={n}><label style={{ textTransform: 'capitalize' }}>{n}</label>
            <input value={socialVal(n)} onChange={(e) => setSocial(n, e.target.value)} placeholder="https://…" /></div>
        ))}
      </div>

      <h3>Theme</h3>
      <div className="f-row">
        <div className="f-group"><label>Primary</label>
          <input type="color" value={s.theme_primary || '#111111'} onChange={(e) => set('theme_primary', e.target.value)} /></div>
        <div className="f-group"><label>Accent / gold</label>
          <input type="color" value={s.theme_accent || '#B08D3E'} onChange={(e) => set('theme_accent', e.target.value)} /></div>
        <div className="f-group"><label>Font pairing</label>
          <select value={s.theme_font || 'cormorant-inter'} onChange={(e) => set('theme_font', e.target.value)}>
            {FONT_CHOICES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select></div>
        <div className="f-group"><label>Button style</label>
          <select value={s.theme_button_style || 'sharp'} onChange={(e) => set('theme_button_style', e.target.value)}>
            <option value="sharp">Sharp</option><option value="soft">Soft</option><option value="pill">Pill</option>
          </select></div>
      </div>

      <h3>Maintenance mode</h3>
      <div className="f-row" style={{ alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={s.maintenance_enabled === '1'}
            onChange={(e) => set('maintenance_enabled', e.target.checked ? '1' : '0')} />
          Site offline for visitors</label>
        <div className="f-group" style={{ flex: 1 }}><label>Message</label>
          <input value={s.maintenance_message || ''} onChange={(e) => set('maintenance_message', e.target.value)} /></div>
      </div>

      <button type="button" className="btn btn-gold" onClick={saveSettings} style={{ marginTop: 8 }}>Save site settings</button>

      <h3 style={{ marginTop: 28 }}>Per-page SEO</h3>
      <div className="f-row">
        <div className="f-group"><label>Page</label>
          <select value={seoPage} onChange={(e) => setSeoPage(e.target.value)}>
            {SEO_PAGES.map(([p, l]) => <option key={p} value={p}>{l} ({p})</option>)}
          </select></div>
      </div>
      <div className="f-group"><label>Title</label>
        <input value={seoB?.data?.title || ''} onChange={(e) => setSeoData('title', e.target.value)} /></div>
      <div className="f-group"><label>Description</label>
        <textarea rows={2} value={seoB?.data?.description || ''} onChange={(e) => setSeoData('description', e.target.value)} /></div>
      <div className="f-group"><label>Keywords</label>
        <input value={seoB?.data?.keywords || ''} onChange={(e) => setSeoData('keywords', e.target.value)} /></div>
      <button type="button" className="btn btn-gold" onClick={saveSeo}>Save SEO</button>
    </div>
  );
}

function MenuItemsEditor({ items, onChange }) {
  const list = items || [];
  const upd = (i, patch) => onChange(list.map((it, j) => j === i ? { ...it, ...patch } : it));
  return (
    <div>
      {list.map((it, i) => (
        <div key={i} className="f-row" style={{ alignItems: 'center' }}>
          <div className="f-group" style={{ flex: 1 }}><label>Label</label>
            <input value={it.label || ''} onChange={(e) => upd(i, { label: e.target.value })} /></div>
          <div className="f-group" style={{ flex: 2 }}><label>Link</label>
            <input value={it.href || ''} onChange={(e) => upd(i, { href: e.target.value })} /></div>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={it.visible !== false} onChange={(e) => upd(i, { visible: e.target.checked })} /> show</label>
          <button type="button" className="btn btn-outline btn-sm" disabled={i === 0}
            onClick={() => { const l = [...list]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; onChange(l); }}>↑</button>
          <button type="button" className="btn btn-outline btn-sm" disabled={i === list.length - 1}
            onClick={() => { const l = [...list]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; onChange(l); }}>↓</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="btn btn-outline btn-sm"
        onClick={() => onChange([...list, { label: 'New link', href: '/', visible: true }])}>+ Add link</button>
    </div>
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

  if (!nav || !footer) return <div className="empty">Loading…</div>;
  const setNavData = (k, v) => setNav({ ...nav, data: { ...nav.data, [k]: v } });
  const setFooterData = (k, v) => setFooter({ ...footer, data: { ...footer.data, [k]: v } });

  return (
    <div>
      {msg && <div className="ad-success">{msg}</div>}
      {error && <div className="ad-error">{error}</div>}
      <h3 style={{ marginTop: 0 }}>Header navigation</h3>
      <MenuItemsEditor items={nav.data.items} onChange={(items) => setNavData('items', items)} />
      <button type="button" className="btn btn-gold" style={{ marginTop: 8 }} onClick={() => save(nav, nav.data)}>Save navigation</button>

      <h3 style={{ marginTop: 28 }}>Footer</h3>
      {(footer.data.columns || []).map((col, ci) => (
        <div key={ci} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div className="f-group"><label>Column heading</label>
            <input value={col.heading || ''} onChange={(e) => {
              const cols = [...footer.data.columns]; cols[ci] = { ...col, heading: e.target.value };
              setFooterData('columns', cols);
            }} /></div>
          <MenuItemsEditor items={col.links} onChange={(links) => {
            const cols = [...footer.data.columns]; cols[ci] = { ...col, links };
            setFooterData('columns', cols);
          }} />
          <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 6 }}
            onClick={() => setFooterData('columns', footer.data.columns.filter((_, j) => j !== ci))}>Remove column</button>
        </div>
      ))}
      <button type="button" className="btn btn-outline btn-sm"
        onClick={() => setFooterData('columns', [...(footer.data.columns || []), { heading: 'New column', links: [] }])}>+ Add column</button>
      <div className="f-group" style={{ marginTop: 12 }}><label>Bottom line (use {'{year}'} for year)</label>
        <input value={footer.data.bottom_text || ''} onChange={(e) => setFooterData('bottom_text', e.target.value)} /></div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input type="checkbox" checked={footer.data.newsletter !== false}
          onChange={(e) => setFooterData('newsletter', e.target.checked)} /> Show newsletter signup in footer</label>
      <div><button type="button" className="btn btn-gold" onClick={() => save(footer, footer.data)}>Save footer</button></div>
    </div>
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
  if (!ann) return <div className="empty">Loading…</div>;

  return (
    <div>
      {msg && <div className="ad-success">{msg}</div>}
      {error && <div className="ad-error">{error}</div>}

      <h3 style={{ marginTop: 0 }}>Announcement bar <LivePill block={ann} /></h3>
      <div className="f-group"><label>Text</label>
        <input value={ann.data.text || ''} onChange={(e) => setAnnData('text', e.target.value)} /></div>
      <div className="f-row">
        <div className="f-group"><label>Link (optional)</label>
          <input value={ann.data.link || ''} onChange={(e) => setAnnData('link', e.target.value)} placeholder="/shop" /></div>
        <div className="f-group"><label>Background</label>
          <input type="color" value={ann.data.bg_color || '#111111'} onChange={(e) => setAnnData('bg_color', e.target.value)} /></div>
        <div className="f-group"><label>Text color</label>
          <input type="color" value={ann.data.text_color || '#FFFFFF'} onChange={(e) => setAnnData('text_color', e.target.value)} /></div>
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input type="checkbox" checked={ann.data.dismissible !== false}
          onChange={(e) => setAnnData('dismissible', e.target.checked)} /> Visitors can dismiss (×)</label>
      <ScheduleFields value={ann} onChange={(nv) => setAnn({ ...ann, ...nv })} />
      <div style={{ border: '1px dashed var(--line)', borderRadius: 8, padding: 10, margin: '12px 0',
        background: ann.data.bg_color, color: ann.data.text_color, textAlign: 'center', fontSize: 14 }}>
        {ann.data.text || 'Preview'}
      </div>
      <button type="button" className="btn btn-gold" onClick={saveAnn}>Save announcement</button>

      <h3 style={{ marginTop: 28 }}>Marquees</h3>
      <button type="button" className="btn btn-outline btn-sm" style={{ marginBottom: 12 }}
        onClick={() => setEditing({ name: 'marquee-' + Date.now(), status: 'published', active: 1, priority: 0,
          data: { items: [{ text: '', icon: '✦', link: '' }], speed: 30, direction: 'left', pause_on_hover: true,
            bg_color: '#111111', text_color: '#FFFFFF', position: 'top' } })}>+ New marquee</button>
      <table className="ad-table">
        <thead><tr><th>Name</th><th>Items</th><th>Position</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {marquees.map((m) => (
            <tr key={m.id}>
              <td>{m.name}</td>
              <td>{(m.data.items || []).length}</td>
              <td>{m.data.position}</td>
              <td><LivePill block={m} /></td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(m)}>Edit</button>{' '}
                <button type="button" className="btn btn-outline btn-sm" onClick={() => delMarquee(m.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <div className="ad-modal-overlay" onClick={() => setEditing(null)}>
          <div className="ad-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>{editing.id ? 'Edit marquee' : 'New marquee'}</h3>
            <div className="f-group"><label>Internal name</label>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            {(editing.data.items || []).map((it, i) => (
              <div key={i} className="f-row" style={{ alignItems: 'center' }}>
                <div className="f-group" style={{ maxWidth: 70 }}><label>Icon</label>
                  <input value={it.icon || ''} onChange={(e) => {
                    const items = [...editing.data.items]; items[i] = { ...it, icon: e.target.value };
                    setEditing({ ...editing, data: { ...editing.data, items } });
                  }} /></div>
                <div className="f-group" style={{ flex: 2 }}><label>Text</label>
                  <input value={it.text || ''} onChange={(e) => {
                    const items = [...editing.data.items]; items[i] = { ...it, text: e.target.value };
                    setEditing({ ...editing, data: { ...editing.data, items } });
                  }} /></div>
                <div className="f-group" style={{ flex: 1 }}><label>Link</label>
                  <input value={it.link || ''} onChange={(e) => {
                    const items = [...editing.data.items]; items[i] = { ...it, link: e.target.value };
                    setEditing({ ...editing, data: { ...editing.data, items } });
                  }} /></div>
                <button type="button" className="btn btn-outline btn-sm"
                  onClick={() => setEditing({ ...editing, data: { ...editing.data, items: editing.data.items.filter((_, j) => j !== i) } })}>✕</button>
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-sm"
              onClick={() => setEditing({ ...editing, data: { ...editing.data, items: [...(editing.data.items || []), { text: '', icon: '✦', link: '' }] } })}>+ Add item</button>
            <div className="f-row" style={{ marginTop: 12 }}>
              <div className="f-group"><label>Speed (seconds per loop)</label>
                <input type="number" min={5} max={120} value={editing.data.speed || 30}
                  onChange={(e) => setEditing({ ...editing, data: { ...editing.data, speed: Number(e.target.value) } })} /></div>
              <div className="f-group"><label>Direction</label>
                <select value={editing.data.direction || 'left'}
                  onChange={(e) => setEditing({ ...editing, data: { ...editing.data, direction: e.target.value } })}>
                  <option value="left">Left</option><option value="right">Right</option>
                </select></div>
              <div className="f-group"><label>Position</label>
                <select value={editing.data.position || 'top'}
                  onChange={(e) => setEditing({ ...editing, data: { ...editing.data, position: e.target.value } })}>
                  <option value="top">Below header</option><option value="above_footer">Above footer</option>
                </select></div>
            </div>
            <div className="f-row">
              <div className="f-group"><label>Background</label>
                <input type="color" value={editing.data.bg_color || '#111111'}
                  onChange={(e) => setEditing({ ...editing, data: { ...editing.data, bg_color: e.target.value } })} /></div>
              <div className="f-group"><label>Text color</label>
                <input type="color" value={editing.data.text_color || '#FFFFFF'}
                  onChange={(e) => setEditing({ ...editing, data: { ...editing.data, text_color: e.target.value } })} /></div>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <input type="checkbox" checked={editing.data.pause_on_hover !== false}
                onChange={(e) => setEditing({ ...editing, data: { ...editing.data, pause_on_hover: e.target.checked } })} />
              Pause on hover</label>
            <ScheduleFields value={editing} onChange={(nv) => setEditing({ ...editing, ...nv })} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" className="btn btn-gold" onClick={() => saveMarquee(editing)}>Save marquee</button>
              <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
    // stats per popup
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
    <div>
      <h2 style={{ marginBottom: 4 }}>Popups</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>Triggers, frequency, targeting, stats. Highest priority wins when several match.</p>
      {msg && <p className="ad-ok">{msg}</p>}
      {error && <p className="ad-err">{error}</p>}

      {list.map((p) => {
        const st = stats[p.id] || {};
        return (
          <div key={p.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14, marginBottom: 12, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <strong>{p.data.title || p.name}</strong>
                <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>
                  {(POPUP_TYPES.find((t) => t.id === p.data.popup_type) || {}).label} · trigger: {p.data.trigger} · {p.data.frequency}
                </span>
              </div>
              <LivePill block={p} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
              👁 {st.impression || 0} impressions · ✖ {st.close || 0} closes · 👆 {st.cta_click || 0} clicks
              {st.impression ? ` · CTR ${Math.round(((st.cta_click || 0) / st.impression) * 100)}%` : ''}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(JSON.parse(JSON.stringify(p)))}>Edit</button>
              <button type="button" className="btn btn-outline btn-sm" style={{ color: '#B3402E' }} onClick={() => del(p.id)}>Delete</button>
            </div>
          </div>
        );
      })}
      <button type="button" className="btn btn-outline" onClick={() => setEditing(blankPopup())}>+ New popup</button>

      {e && (
        <div className="ad-modal-overlay" onClick={() => setEditing(null)}>
          <div className="ad-modal" onClick={(ev) => ev.stopPropagation()} style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>{e.id ? 'Edit popup' : 'New popup'}</h3>
            <div className="f-row">
              <div className="f-group"><label>Internal name</label>
                <input value={e.name} onChange={(ev) => setEditing({ ...e, name: ev.target.value })} /></div>
              <div className="f-group"><label>Type</label>
                <select value={e.data.popup_type} onChange={(ev) => setD('popup_type', ev.target.value)}>
                  {POPUP_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select></div>
              <div className="f-group"><label>Priority (higher wins)</label>
                <input type="number" value={e.priority || 0} onChange={(ev) => setEditing({ ...e, priority: Number(ev.target.value) })} /></div>
            </div>

            <h4 style={{ margin: '14px 0 8px' }}>Content</h4>
            <div className="f-group"><label>Title</label>
              <input value={e.data.title} onChange={(ev) => setD('title', ev.target.value)} /></div>
            <div className="f-group"><label>Text</label>
              <textarea rows={3} value={e.data.text} onChange={(ev) => setD('text', ev.target.value)} /></div>
            <AdminImageField label="Image (optional)" value={e.data.image_url} alt={e.data.image_alt}
              onChange={(v) => setD('image_url', v)} onAltChange={(v) => setD('image_alt', v)} />
            <div className="f-row">
              <div className="f-group"><label>CTA button text</label>
                <input value={e.data.cta_text} onChange={(ev) => setD('cta_text', ev.target.value)} /></div>
              <div className="f-group"><label>CTA link</label>
                <input value={e.data.cta_link} onChange={(ev) => setD('cta_link', ev.target.value)} placeholder="/shop" /></div>
            </div>
            <div className="f-group"><label>Secondary dismiss text</label>
              <input value={e.data.secondary_text} onChange={(ev) => setD('secondary_text', ev.target.value)} placeholder="No thanks" /></div>
            <div className="f-row">
              <div className="f-group"><label>Coupon code (optional)</label>
                <input value={e.data.coupon_code} onChange={(ev) => setD('coupon_code', ev.target.value.toUpperCase())} placeholder="WELCOME10" /></div>
              <div className="f-group"><label>Countdown ends (PKT, optional)</label>
                <input type="datetime-local" value={toPKTInput(e.data.countdown_ends_at)} onChange={(ev) => setD('countdown_ends_at', fromPKTInput(ev.target.value) || '')} /></div>
            </div>
            <div className="f-group"><label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!e.data.newsletter_enabled} onChange={(ev) => setD('newsletter_enabled', ev.target.checked)} /> Include newsletter signup form
            </label></div>

            <h4 style={{ margin: '14px 0 8px' }}>Trigger</h4>
            <div className="f-row">
              <div className="f-group"><label>Trigger</label>
                <select value={e.data.trigger} onChange={(ev) => setD('trigger', ev.target.value)}>
                  <option value="delay">After delay (seconds)</option>
                  <option value="scroll">On scroll (% of page)</option>
                  <option value="exit">Exit intent (desktop)</option>
                  <option value="click">On click (CSS selector)</option>
                </select></div>
              <div className="f-group"><label>
                {e.data.trigger === 'delay' ? 'Seconds' : e.data.trigger === 'scroll' ? 'Scroll %' : e.data.trigger === 'click' ? 'CSS selector' : '—'}
              </label>
                <input value={e.data.trigger_value} disabled={e.data.trigger === 'exit'}
                  onChange={(ev) => setD('trigger_value', ev.target.value)}
                  placeholder={e.data.trigger === 'click' ? '.buy-button' : '8'} /></div>
            </div>

            <h4 style={{ margin: '14px 0 8px' }}>Frequency</h4>
            <div className="f-row">
              <div className="f-group"><label>Show</label>
                <select value={e.data.frequency} onChange={(ev) => setD('frequency', ev.target.value)}>
                  <option value="once_session">Once per session</option>
                  <option value="every_visit">Every visit</option>
                  <option value="every_x_days">Every X days</option>
                  <option value="once_ever">Once ever</option>
                </select></div>
              {e.data.frequency === 'every_x_days' && (
                <div className="f-group"><label>Days</label>
                  <input type="number" min={1} value={e.data.frequency_days || 7} onChange={(ev) => setD('frequency_days', Number(ev.target.value))} /></div>
              )}
            </div>

            <h4 style={{ margin: '14px 0 8px' }}>Targeting</h4>
            <div className="f-row">
              <div className="f-group"><label>Pages</label>
                <select value={e.data.pages} onChange={(ev) => setD('pages', ev.target.value)}>
                  <option value="all">All pages</option>
                  <option value="home">Homepage only</option>
                  <option value="shop">Shop pages</option>
                  <option value="product">Product pages</option>
                  <option value="custom">Custom URLs</option>
                </select></div>
              <div className="f-group"><label>Device</label>
                <select value={e.data.device} onChange={(ev) => setD('device', ev.target.value)}>
                  <option value="all">All</option>
                  <option value="mobile">Mobile only</option>
                  <option value="desktop">Desktop only</option>
                </select></div>
              <div className="f-group"><label>Audience</label>
                <select value={e.data.audience} onChange={(ev) => setD('audience', ev.target.value)}>
                  <option value="all">Everyone</option>
                  <option value="new">New visitors</option>
                  <option value="returning">Returning visitors</option>
                </select></div>
            </div>
            {e.data.pages === 'custom' && (
              <div className="f-group"><label>URLs (comma separated)</label>
                <input value={e.data.page_urls} onChange={(ev) => setD('page_urls', ev.target.value)} placeholder="/sale, /product/5" /></div>
            )}

            <h4 style={{ margin: '14px 0 8px' }}>Schedule</h4>
            <ScheduleFields value={e} onChange={(nv) => setEditing({ ...e, ...nv })} />

            {/* Live preview */}
            <h4 style={{ margin: '14px 0 8px' }}>Preview</h4>
            <div style={{ border: '1px dashed var(--line)', borderRadius: 8, padding: 20, background: '#fafafa' }}>
              <div style={{ background: '#fff', borderRadius: 12, maxWidth: 360, margin: '0 auto', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,.12)' }}>
                {e.data.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.data.image_url} alt="" style={{ width: '100%', height: 140, objectFit: 'cover' }} />
                )}
                <div style={{ padding: 20, textAlign: 'center' }}>
                  {e.data.title && <div style={{ fontFamily: 'var(--font-d)', fontSize: 22, marginBottom: 8 }}>{e.data.title}</div>}
                  {e.data.text && <div style={{ fontSize: 14, color: '#666', marginBottom: 12, whiteSpace: 'pre-line' }}>{e.data.text}</div>}
                  {e.data.coupon_code && <div style={{ border: '2px dashed var(--gold)', borderRadius: 8, padding: '8px 16px', fontWeight: 700, display: 'inline-block', marginBottom: 10 }}>{e.data.coupon_code}</div>}
                  {e.data.cta_text && <div style={{ background: '#111', color: '#fff', borderRadius: 6, padding: '12px', fontWeight: 700, marginTop: 8 }}>{e.data.cta_text}</div>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn btn-gold" onClick={() => save(e)}>Save popup</button>
              <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
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
      // validate
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
    <div>
      <h2 style={{ marginBottom: 4 }}>Offers & Sales</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>Automatic sale prices on cards + product pages. Expired offers revert prices automatically.</p>
      {msg && <p className="ad-ok">{msg}</p>}
      {error && <p className="ad-err">{error}</p>}

      {list.map((o) => (
        <div key={o.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14, marginBottom: 12, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong>{o.name}</strong>
              <span style={{ fontSize: 13, color: '#B3402E', fontWeight: 700, marginLeft: 10 }}>
                {o.data.discount_type === 'percent' ? `${o.data.discount_value}% OFF` : `Rs ${Number(o.data.discount_value).toLocaleString()} OFF`}
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>
                {o.data.applies_to === 'all' ? 'All products' : o.data.applies_to === 'collection' ? `Collection: ${o.data.collection}` : o.data.applies_to === 'products' ? `${(o.data.product_ids || []).length} products` : `Tag: ${o.data.tag}`}
                {o.ends_at ? ` · ends ${formatPKT(o.ends_at)}` : ''}
              </span>
            </div>
            <LivePill block={o} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(JSON.parse(JSON.stringify(o)))}>Edit</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => showPreview(o)}>Preview affected</button>
            <button type="button" className="btn btn-outline btn-sm" style={{ color: '#B3402E' }} onClick={() => del(o.id)}>Delete</button>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-outline" onClick={() => setEditing(blankOffer())}>+ New offer</button>

      {preview && (
        <div className="ad-modal-overlay" onClick={() => setPreview(null)}>
          <div className="ad-modal" onClick={(ev) => ev.stopPropagation()} style={{ maxWidth: 560 }}>
            <h3>Affected products ({preview.count})</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Showing first 20. Sale prices apply automatically.</p>
            <table className="ad-table">
              <thead><tr><th>Product</th><th>Was</th><th>Now</th></tr></thead>
              <tbody>
                {(preview.items || []).map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><s>Rs {Number(p.was).toLocaleString()}</s></td>
                    <td><strong style={{ color: '#B3402E' }}>Rs {Number(p.now).toLocaleString()}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="btn btn-outline" onClick={() => setPreview(null)} style={{ marginTop: 12 }}>Close</button>
          </div>
        </div>
      )}

      {e && (
        <div className="ad-modal-overlay" onClick={() => setEditing(null)}>
          <div className="ad-modal" onClick={(ev) => ev.stopPropagation()} style={{ maxWidth: 620 }}>
            <h3>{e.id ? 'Edit offer' : 'New offer'}</h3>
            <div className="f-row">
              <div className="f-group"><label>Internal name</label>
                <input value={e.name} onChange={(ev) => setEditing({ ...e, name: ev.target.value })} /></div>
              <div className="f-group"><label>Discount type</label>
                <select value={e.data.discount_type} onChange={(ev) => setD('discount_type', ev.target.value)}>
                  <option value="percent">Percent %</option>
                  <option value="fixed">Fixed Rs amount</option>
                </select></div>
              <div className="f-group"><label>Value</label>
                <input type="number" min={1} value={e.data.discount_value} onChange={(ev) => setD('discount_value', Number(ev.target.value))} /></div>
            </div>
            <div className="f-group"><label>Applies to</label>
              <select value={e.data.applies_to} onChange={(ev) => setD('applies_to', ev.target.value)}>
                <option value="all">All products</option>
                <option value="collection">One collection</option>
                <option value="products">Specific products</option>
                <option value="tag">Product tag</option>
              </select></div>
            {e.data.applies_to === 'collection' && (
              <div className="f-group"><label>Collection</label>
                <select value={e.data.collection} onChange={(ev) => setD('collection', ev.target.value)}>
                  <option value="everyday">Everyday</option>
                  <option value="signature">Signature</option>
                  <option value="leather">Leather</option>
                </select></div>
            )}
            {e.data.applies_to === 'products' && (
              <div className="f-group"><label>Product IDs (comma separated)</label>
                <input value={(e.data.product_ids || []).join(', ')}
                  onChange={(ev) => setD('product_ids', ev.target.value.split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean))}
                  placeholder="1, 5, 12" /></div>
            )}
            {e.data.applies_to === 'tag' && (
              <div className="f-group"><label>Tag</label>
                <input value={e.data.tag} onChange={(ev) => setD('tag', ev.target.value)} placeholder="sale" /></div>
            )}
            <div className="f-row">
              <div className="f-group"><label>Badge text (optional)</label>
                <input value={e.data.badge_text} onChange={(ev) => setD('badge_text', ev.target.value)} placeholder="SALE / -20%" /></div>
              <div className="f-group"><label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!e.data.show_banner} onChange={(ev) => setD('show_banner', ev.target.checked)} /> Show floating banner
              </label></div>
            </div>
            {e.data.show_banner && (
              <div className="f-group"><label>Banner text</label>
                <input value={e.data.banner_text} onChange={(ev) => setD('banner_text', ev.target.value)} placeholder="Winter Sale — up to 20% off" /></div>
            )}
            <ScheduleFields value={e} onChange={(nv) => setEditing({ ...e, ...nv })} />
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Schedule with Start/End (PKT) — prices revert automatically when the offer ends.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" className="btn btn-gold" onClick={() => save(e)}>Save offer</button>
              <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Homepage builder (Phase 4)                                          */
/* ------------------------------------------------------------------ */




export { SiteSettings, Menus, Bars, Popups, Offers };

