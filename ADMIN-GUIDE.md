# AMMIGE Admin — User Guide

## Tabs

| Tab | What you control |
|---|---|
| **Dashboard** | Revenue, orders, top products |
| **Orders** | View, update status, print invoice, manual order |
| **Products** | Full catalog: add/edit, images, variants, 360 frames, GLB 3D model, video, slug, tags, rich description, badge schedule, stock |
| **Customers** | Customer list |
| **Coupons** | Discount codes |
| **Newsletter** | Subscribers + export |
| **Site** | Store name, logo, favicon, contact, social links, theme (colors/fonts/buttons), maintenance mode, per-page SEO |
| **Menus** | Navigation links + footer columns |
| **Bars** | Announcement bar + scrolling marquees |
| **Popups** | Popups (offer/newsletter/image/announcement/exit-intent) with triggers, frequency, targeting, stats |
| **Offers** | Automatic sale prices (% or Rs off, by collection/tag/products) with schedule |
| **Homepage** | Section order/visibility, hero slides, section text, banners, testimonials, FAQs, 3D viewer settings |
| **Collections** | Rename/describe/re-image collections |
| **Activity** | Who changed what, when |
| **Settings** | WhatsApp, shipping, payments, storefront display |

## Key concepts

- **Everything saves live.** No "publish site" button — changes appear immediately.
- **Schedule (PKT).** Any block can have Start/End dates in Pakistan time. The server shows/hides it automatically. Prices from expired offers revert on their own.
- **Active toggle.** Quick on/off without deleting.
- **Draft.** Invisible to visitors, visible in admin.
- **Priority.** When several popups match, highest priority wins.

## Common tasks

**Change the announcement bar:** Bars → Announcement bar → edit text/colors → Save.

**Run a weekend sale:** Offers → New offer → 20% off, applies to All products, Start Friday 00:00, End Monday 00:00 → Save. Prices update everywhere automatically.

**Add a hero slide:** Homepage → Hero slides → New slide → upload desktop + mobile images → Save.

**Reorder homepage:** Homepage → Sections → ↑ ↓ → Save homepage.

**Import products:** Products → ↑ Import CSV (columns: sku, name, collection, price, old_price, material, description, tags, badge, stock, active). Existing SKUs update, new SKUs create.

**Maintenance mode:** Site → enable → visitors see "we'll be back soon", admin keeps working.

## Safety

- Bulk delete is **permanent**. Export CSV first.
- Changing the admin password: Settings → change it, store it somewhere safe (not in chat/email).
- The Activity tab shows every change — check it if something looks wrong.
