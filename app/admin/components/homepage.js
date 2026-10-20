'use client';

import { useEffect, useState } from 'react';
import { apiContent, ScheduleFields, LivePill, AdminImageField, formatPKT } from './shared';
const SECTION_LABELS = {
  hero: 'Hero slider', collections: 'Collections', bestsellers: 'Bestsellers / Featured',
  occasion: 'Shop by occasion', craft: 'Craft story', video: 'Video',
  trust: 'Trust badges', gallery: 'Gallery strip', testimonials: 'Testimonials',
  newsletter: 'Newsletter',
};

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
  const [sub, setSub] = useState('sections'); // sections|hero|copy|banners|testimonials|faq

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

  if (!layout) return <p>Loading…</p>;
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

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Homepage Builder</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>Sections, hero, banners, testimonials, FAQs — all live immediately.</p>
      {msg && <p className="ad-ok">{msg}</p>}
      {error && <p className="ad-err">{error}</p>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {SUBS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setSub(id)}
            className={`btn btn-sm ${sub === id ? 'btn-gold' : 'btn-outline'}`}>{label}</button>
        ))}
        <a className="btn btn-sm btn-outline" href="/" target="_blank" rel="noreferrer" style={{ marginLeft: 'auto' }}>Preview ↗</a>
      </div>

      {/* ============ SECTIONS ============ */}
      {sub === 'sections' && (
        <div>
          {(D.sections || []).map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line)', borderRadius: 8, padding: '10px 14px', marginBottom: 8, background: s.visible === false ? '#f5f5f5' : '#fff', opacity: s.visible === false ? 0.6 : 1 }}>
              <span style={{ fontWeight: 600 }}>{i + 1}.</span>
              <span style={{ flex: 1 }}>{SECTION_LABELS[s.id] || s.id}</span>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => moveSection(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => moveSection(i, 1)} disabled={i === D.sections.length - 1}>↓</button>
              <button type="button" className={`btn btn-sm ${s.visible === false ? 'btn-outline' : 'btn-gold'}`} onClick={() => toggleSection(i)}>
                {s.visible === false ? 'Hidden' : 'Visible'}
              </button>
            </div>
          ))}
          <div style={{ marginTop: 16, border: '1px solid var(--line)', borderRadius: 8, padding: 14, background: '#fff' }}>
            <h4>Hero slider settings</h4>
            <div className="f-row">
              <div className="f-group"><label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={D.hero_settings?.autoplay !== false} onChange={(e) => setHeroSet('autoplay', e.target.checked)} /> Autoplay
              </label></div>
              <div className="f-group"><label>Seconds per slide</label>
                <input type="number" min={3} max={30} value={D.hero_settings?.autoplay_seconds || 6} onChange={(e) => setHeroSet('autoplay_seconds', Number(e.target.value))} /></div>
              <div className="f-group"><label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={D.hero_settings?.show_dots !== false} onChange={(e) => setHeroSet('show_dots', e.target.checked)} /> Dots
              </label></div>
              <div className="f-group"><label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={D.hero_settings?.show_arrows !== false} onChange={(e) => setHeroSet('show_arrows', e.target.checked)} /> Arrows
              </label></div>
            </div>
          </div>
          <button className="btn btn-gold" onClick={saveLayout} style={{ marginTop: 14 }}>Save homepage</button>
        </div>
      )}

      {/* ============ HERO ============ */}
      {sub === 'hero' && (
        <div>
          {heroes.map((h) => (
            <div key={h.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14, marginBottom: 12, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong>{h.data.headline || h.name}</strong>
                <LivePill block={h} />
              </div>
              {h.data.desktop_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={h.data.desktop_image} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} />
              )}
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{h.data.subheadline}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditingHero(JSON.parse(JSON.stringify(h)))}>Edit</button>
                <button type="button" className="btn btn-outline btn-sm" style={{ color: '#B3402E' }} onClick={() => delBlock(h.id)}>Delete</button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-outline" onClick={() => setEditingHero(blankHero())}>+ New slide</button>

          {editingHero && (
            <div className="ad-modal-overlay" onClick={() => setEditingHero(null)}>
              <div className="ad-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
                <h3>{editingHero.id ? 'Edit slide' : 'New slide'}</h3>
                {(() => {
                  const eh = editingHero;
                  const sd = (k, v) => setEditingHero({ ...eh, data: { ...eh.data, [k]: v } });
                  return (<>
                    <AdminImageField label="Desktop image" value={eh.data.desktop_image} onChange={(v) => sd('desktop_image', v)} />
                    <AdminImageField label="Mobile image (optional)" value={eh.data.mobile_image} onChange={(v) => sd('mobile_image', v)} hint="Shown on phones. Empty = desktop image." />
                    <div className="f-group"><label>Video URL (optional, overrides image)</label>
                      <input value={eh.data.video_url} onChange={(e) => sd('video_url', e.target.value)} placeholder="/media/videos/… or https://…" /></div>
                    <div className="f-group"><label>Eyebrow</label>
                      <input value={eh.data.eyebrow} onChange={(e) => sd('eyebrow', e.target.value)} /></div>
                    <div className="f-group"><label>Headline</label>
                      <input value={eh.data.headline} onChange={(e) => sd('headline', e.target.value)} /></div>
                    <div className="f-group"><label>Subheadline</label>
                      <textarea rows={2} value={eh.data.subheadline} onChange={(e) => sd('subheadline', e.target.value)} /></div>
                    <div className="f-row">
                      <div className="f-group"><label>CTA 1 text</label>
                        <input value={eh.data.cta1_text} onChange={(e) => sd('cta1_text', e.target.value)} /></div>
                      <div className="f-group"><label>CTA 1 link</label>
                        <input value={eh.data.cta1_link} onChange={(e) => sd('cta1_link', e.target.value)} /></div>
                    </div>
                    <div className="f-row">
                      <div className="f-group"><label>CTA 2 text</label>
                        <input value={eh.data.cta2_text} onChange={(e) => sd('cta2_text', e.target.value)} /></div>
                      <div className="f-group"><label>CTA 2 link</label>
                        <input value={eh.data.cta2_link} onChange={(e) => sd('cta2_link', e.target.value)} /></div>
                    </div>
                    <div className="f-row">
                      <div className="f-group"><label>Text align</label>
                        <select value={eh.data.align} onChange={(e) => sd('align', e.target.value)}>
                          <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                        </select></div>
                      <div className="f-group"><label>Overlay darkness (0–80)</label>
                        <input type="number" min={0} max={80} value={eh.data.overlay ?? 45} onChange={(e) => sd('overlay', Number(e.target.value))} /></div>
                      <div className="f-group"><label>Text color</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input type="color" value={eh.data.text_color || '#FFFFFF'} onChange={(e) => sd('text_color', e.target.value)} style={{ width: 44, height: 38 }} />
                          <input value={eh.data.text_color || '#FFFFFF'} onChange={(e) => sd('text_color', e.target.value)} />
                        </div></div>
                      <div className="f-group"><label>Animation</label>
                        <select value={eh.data.animation} onChange={(e) => sd('animation', e.target.value)}>
                          <option value="fade">Fade</option><option value="slide">Slide up</option><option value="zoom">Slow zoom</option><option value="none">None</option>
                        </select></div>
                    </div>
                    <ScheduleFields value={eh} onChange={(nv) => setEditingHero({ ...eh, ...nv })} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button type="button" className="btn btn-gold" onClick={() => saveBlock('hero', editingHero, setEditingHero)}>Save slide</button>
                      <button type="button" className="btn btn-outline" onClick={() => setEditingHero(null)}>Cancel</button>
                    </div>
                  </>);
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ SECTION COPY ============ */}
      {sub === 'copy' && (
        <div>
          {Object.keys(SECTION_LABELS).filter((s) => s !== 'hero').map((sec) => (
            <div key={sec} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14, marginBottom: 12, background: '#fff' }}>
              <h4 style={{ margin: '0 0 10px' }}>{SECTION_LABELS[sec]}</h4>
              <div className="f-row">
                <div className="f-group"><label>Eyebrow</label>
                  <input value={D.copy?.[sec]?.eyebrow || ''} onChange={(e) => setCopy(sec, 'eyebrow', e.target.value)} /></div>
                <div className="f-group"><label>Title</label>
                  <input value={D.copy?.[sec]?.title || ''} onChange={(e) => setCopy(sec, 'title', e.target.value)} /></div>
              </div>
              <div className="f-group"><label>Text</label>
                <textarea rows={2} value={D.copy?.[sec]?.text || ''} onChange={(e) => setCopy(sec, 'text', e.target.value)} /></div>
              {sec === 'bestsellers' && (
                <div className="f-row">
                  <div className="f-group"><label>Product source</label>
                    <select value={D.copy?.bestsellers?.source || 'badge'} onChange={(e) => setCopy('bestsellers', 'source', e.target.value)}>
                      <option value="badge">Bestseller badge</option>
                      <option value="manual">Hand-picked products</option>
                      <option value="collection">One collection</option>
                    </select></div>
                  {(D.copy?.bestsellers?.source === 'manual') && (
                    <div className="f-group"><label>Product IDs (comma separated)</label>
                      <input value={(D.copy?.bestsellers?.product_ids || []).join(', ')}
                        onChange={(e) => setCopy('bestsellers', 'product_ids', e.target.value.split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean))} /></div>
                  )}
                  {(D.copy?.bestsellers?.source === 'collection') && (
                    <div className="f-group"><label>Collection</label>
                      <select value={D.copy?.bestsellers?.collection || ''} onChange={(e) => setCopy('bestsellers', 'collection', e.target.value)}>
                        <option value="everyday">Everyday</option><option value="signature">Signature</option><option value="leather">Leather</option>
                      </select></div>
                  )}
                  <div className="f-group"><label>Max products</label>
                    <input type="number" min={1} max={20} value={D.copy?.bestsellers?.limit || 10} onChange={(e) => setCopy('bestsellers', 'limit', Number(e.target.value))} /></div>
                </div>
              )}
            </div>
          ))}
          <button className="btn btn-gold" onClick={saveLayout}>Save section text</button>
        </div>
      )}

      {/* ============ BANNERS ============ */}
      {sub === 'banners' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Full-width promo banners. Set position to "homepage" to show between sections.</p>
          {banners.filter((b) => !['occasion-tiles', 'craft-steps', 'gallery'].includes(b.name)).map((b) => (
            <div key={b.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14, marginBottom: 12, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong>{b.data.title || b.name}</strong>
                <LivePill block={b} />
              </div>
              {b.data.desktop_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.data.desktop_image} alt="" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} />
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => { setEditingBanner(JSON.parse(JSON.stringify(b))); }}>Edit</button>
                <button type="button" className="btn btn-outline btn-sm" style={{ color: '#B3402E' }} onClick={() => delBlock(b.id)}>Delete</button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-outline" onClick={() => setEditingBanner({
            id: null, name: 'banner-' + Date.now().toString(36), status: 'published', active: 1,
            starts_at: null, ends_at: null, priority: 0,
            data: { desktop_image: '', mobile_image: '', alt: '', eyebrow: '', title: '', text: '', cta_text: '', cta_link: '', align: 'center', overlay: 35, text_color: '#FFFFFF', height: 'medium', position: 'homepage' },
          })}>+ New banner</button>
          {editingBanner && (
            <BannerEditor b={editingBanner} setB={setEditingBanner}
              onSave={() => saveBlock('banner', editingBanner, setEditingBanner)}
              onCancel={() => setEditingBanner(null)} />
          )}
        </div>
      )}

      {/* ============ TESTIMONIALS ============ */}
      {sub === 'testimonials' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Enable the Testimonials section under Sections to show these on the homepage.</p>
          {testimonials.map((t) => (
            <div key={t.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14, marginBottom: 12, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <strong>{t.data.name} {t.data.location ? `· ${t.data.location}` : ''}</strong>
                <LivePill block={t} />
              </div>
              <p style={{ fontStyle: 'italic', margin: '0 0 8px' }}>“{t.data.text}”</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditingT(JSON.parse(JSON.stringify(t)))}>Edit</button>
                <button type="button" className="btn btn-outline btn-sm" style={{ color: '#B3402E' }} onClick={() => delBlock(t.id)}>Delete</button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-outline" onClick={() => setEditingT({
            id: null, name: 'review-' + Date.now().toString(36), status: 'published', active: 1,
            starts_at: null, ends_at: null, priority: 0,
            data: { name: '', location: '', text: '', rating: 5, photo_url: '', product: '' },
          })}>+ New testimonial</button>
          {editingT && (
            <div className="ad-modal-overlay" onClick={() => setEditingT(null)}>
              <div className="ad-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
                <h3>{editingT.id ? 'Edit testimonial' : 'New testimonial'}</h3>
                {(() => {
                  const et = editingT;
                  const sd = (k, v) => setEditingT({ ...et, data: { ...et.data, [k]: v } });
                  return (<>
                    <div className="f-row">
                      <div className="f-group"><label>Name</label><input value={et.data.name} onChange={(e) => sd('name', e.target.value)} /></div>
                      <div className="f-group"><label>Location</label><input value={et.data.location} onChange={(e) => sd('location', e.target.value)} placeholder="Karachi" /></div>
                      <div className="f-group"><label>Rating</label>
                        <select value={et.data.rating} onChange={(e) => sd('rating', Number(e.target.value))}>
                          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
                        </select></div>
                    </div>
                    <div className="f-group"><label>Review text</label>
                      <textarea rows={3} value={et.data.text} onChange={(e) => sd('text', e.target.value)} /></div>
                    <div className="f-group"><label>Product bought (optional)</label>
                      <input value={et.data.product} onChange={(e) => sd('product', e.target.value)} /></div>
                    <AdminImageField label="Photo (optional)" value={et.data.photo_url} onChange={(v) => sd('photo_url', v)} />
                    <ScheduleFields value={et} onChange={(nv) => setEditingT({ ...et, ...nv })} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button type="button" className="btn btn-gold" onClick={() => saveBlock('testimonial', editingT, setEditingT)}>Save</button>
                      <button type="button" className="btn btn-outline" onClick={() => setEditingT(null)}>Cancel</button>
                    </div>
                  </>);
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ FAQ ============ */}
      {sub === 'faq' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>FAQs appear on the FAQ page (and can be shown on product pages later).</p>
          {faqs.map((f) => (
            <div key={f.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14, marginBottom: 12, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <strong>{f.data.question}</strong>
                <LivePill block={f} />
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 8px' }}>{(f.data.answer || '').slice(0, 120)}…</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditingF(JSON.parse(JSON.stringify(f)))}>Edit</button>
                <button type="button" className="btn btn-outline btn-sm" style={{ color: '#B3402E' }} onClick={() => delBlock(f.id)}>Delete</button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-outline" onClick={() => setEditingF({
            id: null, name: 'faq-' + Date.now().toString(36), status: 'published', active: 1,
            starts_at: null, ends_at: null, priority: 0,
            data: { question: '', answer: '', category: 'General' },
          })}>+ New FAQ</button>
          {editingF && (
            <div className="ad-modal-overlay" onClick={() => setEditingF(null)}>
              <div className="ad-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
                <h3>{editingF.id ? 'Edit FAQ' : 'New FAQ'}</h3>
                {(() => {
                  const ef = editingF;
                  const sd = (k, v) => setEditingF({ ...ef, data: { ...ef.data, [k]: v } });
                  return (<>
                    <div className="f-group"><label>Question</label>
                      <input value={ef.data.question} onChange={(e) => sd('question', e.target.value)} /></div>
                    <div className="f-group"><label>Answer</label>
                      <textarea rows={4} value={ef.data.answer} onChange={(e) => sd('answer', e.target.value)} /></div>
                    <div className="f-group"><label>Category</label>
                      <input value={ef.data.category} onChange={(e) => sd('category', e.target.value)} /></div>
                    <ScheduleFields value={ef} onChange={(nv) => setEditingF({ ...ef, ...nv })} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button type="button" className="btn btn-gold" onClick={() => saveBlock('faq', editingF, setEditingF)}>Save</button>
                      <button type="button" className="btn btn-outline" onClick={() => setEditingF(null)}>Cancel</button>
                    </div>
                  </>);
                })()}
              </div>
            </div>
          )}
        </div>
      )}
      {/* ============ 3D VIEWER ============ */}
      {sub === 'viewer3d' && viewerCfg && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Global 3D viewer settings. Per-product: enable/disable, poster and mode in the product editor.</p>
          <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14, background: '#fff' }}>
            <div className="f-row">
              <div className="f-group"><label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!viewerCfg.auto_rotate}
                  onChange={(e) => setViewerCfg({ ...viewerCfg, auto_rotate: e.target.checked })} /> Auto-rotate
              </label></div>
              <div className="f-group"><label>Rotate speed</label>
                <input type="number" min={0.1} max={5} step={0.1} value={viewerCfg.rotate_speed || 1}
                  onChange={(e) => setViewerCfg({ ...viewerCfg, rotate_speed: Number(e.target.value) })} /></div>
            </div>
            <div className="f-row">
              <div className="f-group"><label>Min zoom</label>
                <input type="number" min={0.5} max={4} step={0.5} value={viewerCfg.min_zoom || 1}
                  onChange={(e) => setViewerCfg({ ...viewerCfg, min_zoom: Number(e.target.value) })} /></div>
              <div className="f-group"><label>Max zoom</label>
                <input type="number" min={1} max={8} step={0.5} value={viewerCfg.max_zoom || 4}
                  onChange={(e) => setViewerCfg({ ...viewerCfg, max_zoom: Number(e.target.value) })} /></div>
              <div className="f-group"><label>Light intensity</label>
                <input type="number" min={0.2} max={2.5} step={0.1} value={viewerCfg.light_intensity || 1}
                  onChange={(e) => setViewerCfg({ ...viewerCfg, light_intensity: Number(e.target.value) })} /></div>
            </div>
            <div className="f-row">
              <div className="f-group"><label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={viewerCfg.bg_transparent !== false}
                  onChange={(e) => setViewerCfg({ ...viewerCfg, bg_transparent: e.target.checked })} /> Transparent background
              </label></div>
              <div className="f-group"><label>Background color</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="color" value={viewerCfg.bg_color || '#15120e'}
                    onChange={(e) => setViewerCfg({ ...viewerCfg, bg_color: e.target.value })} style={{ width: 44, height: 38 }} />
                  <input value={viewerCfg.bg_color || '#15120e'}
                    onChange={(e) => setViewerCfg({ ...viewerCfg, bg_color: e.target.value })} />
                </div></div>
              <div className="f-group"><label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={viewerCfg.shadow !== false}
                  onChange={(e) => setViewerCfg({ ...viewerCfg, shadow: e.target.checked })} /> Ground shadow
              </label></div>
            </div>
            <div className="f-row">
              <div className="f-group"><label>Tone mapping</label>
                <select value={viewerCfg.tone_mapping || 'aces'}
                  onChange={(e) => setViewerCfg({ ...viewerCfg, tone_mapping: e.target.value })}>
                  <option value="aces">ACES (cinematic)</option>
                  <option value="none">None</option>
                </select></div>
              <div className="f-group"><label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={viewerCfg.show_angle_buttons !== false}
                  onChange={(e) => setViewerCfg({ ...viewerCfg, show_angle_buttons: e.target.checked })} /> Angle buttons
              </label></div>
              <div className="f-group"><label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={viewerCfg.show_ar_button !== false}
                  onChange={(e) => setViewerCfg({ ...viewerCfg, show_ar_button: e.target.checked })} /> AR button (GLB only)
              </label></div>
            </div>
            <button type="button" className="btn btn-gold" style={{ marginTop: 8 }}
              onClick={async () => {
                setMsg(''); setError('');
                try {
                  await apiContent('PATCH', `/api/admin/content/${viewerId}`, { data: viewerCfg });
                  setMsg('3D viewer settings saved — live immediately.');
                } catch (err) { setError(err.message); }
              }}>Save 3D settings</button>
          </div>
        </div>
      )}
    </div>
  );
}


function BannerEditor({ b, setB, onSave, onCancel }) {
  const sd = (k, v) => setB({ ...b, data: { ...b.data, [k]: v } });
  return (
    <div className="ad-modal-overlay" onClick={onCancel}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
        <h3>{b.id ? 'Edit banner' : 'New banner'}</h3>
        <div className="f-group"><label>Internal name</label>
          <input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} /></div>
        <AdminImageField label="Desktop image" value={b.data.desktop_image} onChange={(v) => sd('desktop_image', v)} />
        <AdminImageField label="Mobile image (optional)" value={b.data.mobile_image} onChange={(v) => sd('mobile_image', v)} />
        <div className="f-group"><label>Eyebrow</label><input value={b.data.eyebrow} onChange={(e) => sd('eyebrow', e.target.value)} /></div>
        <div className="f-group"><label>Title</label><input value={b.data.title} onChange={(e) => sd('title', e.target.value)} /></div>
        <div className="f-group"><label>Text</label><textarea rows={2} value={b.data.text} onChange={(e) => sd('text', e.target.value)} /></div>
        <div className="f-row">
          <div className="f-group"><label>CTA text</label><input value={b.data.cta_text} onChange={(e) => sd('cta_text', e.target.value)} /></div>
          <div className="f-group"><label>CTA link</label><input value={b.data.cta_link} onChange={(e) => sd('cta_link', e.target.value)} /></div>
        </div>
        <div className="f-row">
          <div className="f-group"><label>Align</label>
            <select value={b.data.align} onChange={(e) => sd('align', e.target.value)}>
              <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
            </select></div>
          <div className="f-group"><label>Height</label>
            <select value={b.data.height} onChange={(e) => sd('height', e.target.value)}>
              <option value="short">Short</option><option value="medium">Medium</option><option value="tall">Tall</option>
            </select></div>
          <div className="f-group"><label>Overlay</label>
            <input type="number" min={0} max={80} value={b.data.overlay ?? 35} onChange={(e) => sd('overlay', Number(e.target.value))} /></div>
        </div>
        <ScheduleFields value={b} onChange={(nv) => setB({ ...b, ...nv })} />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" className="btn btn-gold" onClick={onSave}>Save banner</button>
          <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
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

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Collections</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>Rename, describe and re-image collections. IDs cannot be changed after creation.</p>
      {msg && <p className="ad-ok">{msg}</p>}
      {error && <p className="ad-err">{error}</p>}

      {list.map((c) => (
        <div key={c.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14, marginBottom: 12, background: '#fff', display: 'flex', gap: 14, alignItems: 'center' }}>
          {c.data.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.data.image} alt="" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8 }} />
          )}
          <div style={{ flex: 1 }}>
            <strong>{c.data.name}</strong>
            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8, fontFamily: 'monospace' }}>{c.data.id}</span>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>{c.data.tagline}</p>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(JSON.parse(JSON.stringify(c)))}>Edit</button>
        </div>
      ))}

      {editing && (
        <div className="ad-modal-overlay" onClick={() => setEditing(null)}>
          <div className="ad-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h3>Edit collection</h3>
            {(() => {
              const ce = editing;
              const sd = (k, v) => setEditing({ ...ce, data: { ...ce.data, [k]: v } });
              return (<>
                <div className="f-group"><label>Display name</label>
                  <input value={ce.data.name} onChange={(e) => sd('name', e.target.value)} /></div>
                <div className="f-group"><label>Tagline</label>
                  <input value={ce.data.tagline} onChange={(e) => sd('tagline', e.target.value)} /></div>
                <div className="f-group"><label>Description</label>
                  <textarea rows={3} value={ce.data.description || ''} onChange={(e) => sd('description', e.target.value)} /></div>
                <AdminImageField label="Collection image" value={ce.data.image} onChange={(v) => sd('image', v)} />
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button type="button" className="btn btn-gold" onClick={() => save(editing)}>Save</button>
                  <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </>);
            })()}
          </div>
        </div>
      )}
    </div>
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
    <div>
      <h2 style={{ marginBottom: 4 }}>Activity Log</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>Who changed what, when. Newest first.</p>
      {error && <p className="ad-err">{error}</p>}
      <div style={{ overflowX: 'auto' }}>
        <table className="ad-table">
          <thead><tr><th>When (PKT)</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{formatPKT(a.created_at)}</td>
                <td><strong>{a.action}</strong></td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.entity}{a.entity_id ? ` #${a.entity_id}` : ''}</td>
                <td>{a.detail || '—'}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>No activity yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}



export { Homepage, Collections, ActivityLog };
