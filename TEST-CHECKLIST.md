# AMMIGE — Final Test Checklist (Phase 7)

Run after every deploy. Mark each ✓.

## Storefront

- [ ] Homepage loads, hero slider autoplays, all sections in admin order
- [ ] Announcement bar shows (dismiss × works, persists)
- [ ] Marquee scrolls, pauses on hover
- [ ] Navigation + footer match admin
- [ ] Theme colors/fonts apply
- [ ] Product cards show sale prices + badges when offer is live
- [ ] Product page: gallery, variants, video, 3D button opens viewer
- [ ] 3D viewer: drag rotate, pinch zoom, angle buttons, poster → loads
- [ ] Popup appears per trigger/frequency settings
- [ ] Cart → checkout (COD) → order confirmation
- [ ] Mobile: no horizontal scroll, buttons tappable, images load

## Admin

- [ ] Login works, wrong password rejected, rate limit after 8 tries
- [ ] Site tab: change theme color → storefront updates immediately
- [ ] Menus: add link → appears in header
- [ ] Bars: edit announcement → appears on site
- [ ] Popups: create test popup (delay 3s, every visit) → shows on site
- [ ] Offers: 10% off all → product prices drop; delete offer → prices revert
- [ ] Homepage: hide a section → disappears; reorder → order changes
- [ ] Products: create, edit (slug/tags/rich text/badge schedule), bulk publish/unpublish, CSV export/import
- [ ] Collections: rename → homepage card updates
- [ ] Activity log records all changes
- [ ] Maintenance mode: site shows maintenance page, /admin still works

## Schedule logic

- [ ] `node lib/tests.js` → 23 passed, 0 failed
- [ ] Create offer ending in 2 minutes → prices revert after expiry (server time)

## Performance

- [ ] Homepage < 3s on 4G (Lighthouse)
- [ ] Product images lazy-load, WebP served
- [ ] 3D viewer lazy-loads three.js chunk only when opened

## Security

- [ ] Admin APIs return 401 without login
- [ ] No secrets in client JS bundle (grep for ADMIN_SECRET)
- [ ] description_html strips `<script>` (test in product editor)
