import { NextResponse } from 'next/server';
import {
  client, ready, getSetting, isNonEmptyString,
  sanitizeText, isWeakPassword, isValidWhatsapp,
} from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { checkOrigin } from '@/lib/csrf';
import { checkRate } from '@/lib/rate-limit';

const ALLOWED = [
  'admin_password', 'whatsapp', 'announcement', 'tagline', 'brand',
  'shipping_flat', 'free_shipping_threshold', 'payment_cod', 'payment_bank',
  'video_url',
  'marquee_enabled', 'marquee_items',
  'popup_enabled', 'popup_title', 'popup_text', 'popup_cta', 'popup_delay',
  // Phase 1: global site settings
  'store_name', 'logo_light', 'logo_dark', 'favicon_url',
  'contact_email', 'contact_phone', 'contact_address', 'social_links',
  'theme_primary', 'theme_secondary', 'theme_accent',
  'theme_font', 'theme_button_style', 'theme_radius',
  'maintenance_enabled', 'maintenance_message',
  // Manual advance payment verification
  'advance_enabled', 'advance_amount', 'advance_discount',
  'adv_easypaisa_name', 'adv_easypaisa_number',
  'adv_bank_name', 'adv_bank_title', 'adv_bank_account', 'adv_bank_iban',
  'adv_instructions',
];

function adminWriteLimit(req) {
  return checkRate(req, { windowMs: 60_000, max: 60, scope: 'admin-write' });
}

export async function GET(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  await ready();
  const out = {};
  // Never send the real admin password to the client; expose only a
  // weakness flag so the dashboard can nudge the admin to strengthen it.
  for (const k of ALLOWED) {
    if (k === 'admin_password') continue;
    out[k] = await getSetting(k);
  }
  out.password_weak = isWeakPassword(await getSetting('admin_password'));
  return NextResponse.json(out);
}

export async function PATCH(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;
  if (!adminWriteLimit(req)) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  let b;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const keys = Object.keys(b || {}).filter((k) => ALLOWED.includes(k));
  if (keys.length === 0) {
    return NextResponse.json({ error: `Nothing to update. Allowed: ${ALLOWED.join(', ')}.` }, { status: 400 });
  }
  const cleaned = {};
  for (const k of keys) {
    if (k === 'admin_password') {
      if (!isNonEmptyString(b[k]) || b[k].trim().length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
      }
      cleaned[k] = b[k].trim();
    } else if (k === 'whatsapp') {
      if (!isValidWhatsapp(b[k])) {
        return NextResponse.json({ error: 'whatsapp must be a valid phone number.' }, { status: 400 });
      }
      cleaned[k] = b[k].trim();
    } else if (k === 'advance_enabled') {
      cleaned[k] = b[k] ? '1' : '0';
    } else if (k === 'advance_amount' || k === 'advance_discount') {
      const v = Number(b[k]);
      if (!Number.isInteger(v) || v < 0) {
        return NextResponse.json({ error: `${k} must be a non-negative integer (PKR).` }, { status: 400 });
      }
      cleaned[k] = String(v);
    } else if (k === 'shipping_flat' || k === 'free_shipping_threshold') {
      const v = Number(b[k]);
      if (!Number.isInteger(v) || v < 0) {
        return NextResponse.json({ error: `${k} must be a non-negative integer (PKR).` }, { status: 400 });
      }
      cleaned[k] = String(v);
    } else if (k === 'payment_cod' || k === 'payment_bank') {
      cleaned[k] = b[k] ? '1' : '0';
    } else if (k === 'video_url') {
      // Empty = hide the homepage video section. Non-empty must be a URL.
      const v = String(b[k] || '').trim();
      if (v && !/^https?:\/\/.{4,500}$/.test(v)) {
        return NextResponse.json({ error: 'video_url must be a valid http(s) URL or empty.' }, { status: 400 });
      }
      cleaned[k] = v;
    } else if (['theme_primary', 'theme_secondary', 'theme_accent'].includes(k)) {
      const v = String(b[k] || '').trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(v)) {
        return NextResponse.json({ error: `${k} must be a hex color like #B08D3E.` }, { status: 400 });
      }
      cleaned[k] = v;
    } else if (k === 'theme_font') {
      const v = String(b[k] || '').trim();
      if (!['cormorant-inter', 'playfair-montserrat', 'jost-jost', 'poppins-poppins'].includes(v)) {
        return NextResponse.json({ error: 'Unknown font choice.' }, { status: 400 });
      }
      cleaned[k] = v;
    } else if (k === 'theme_button_style') {
      const v = String(b[k] || '').trim();
      if (!['sharp', 'soft', 'pill'].includes(v)) {
        return NextResponse.json({ error: 'Button style must be sharp, soft or pill.' }, { status: 400 });
      }
      cleaned[k] = v;
    } else if (k === 'theme_radius') {
      const v = parseInt(b[k], 10);
      if (!Number.isInteger(v) || v < 0 || v > 24) {
        return NextResponse.json({ error: 'Corner radius must be 0–24px.' }, { status: 400 });
      }
      cleaned[k] = String(v);
    } else if (k === 'maintenance_enabled') {
      cleaned[k] = b[k] ? '1' : '0';
    } else if (k === 'social_links') {
      let obj = b[k];
      if (typeof obj === 'string') {
        try { obj = JSON.parse(obj); } catch {
          return NextResponse.json({ error: 'social_links must be valid JSON.' }, { status: 400 });
        }
      }
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return NextResponse.json({ error: 'social_links must be an object.' }, { status: 400 });
      }
      const out = {};
      for (const net of ['instagram', 'tiktok', 'facebook', 'youtube']) {
        const u = String(obj[net] || '').trim().slice(0, 300);
        if (u && !/^https?:\/\//i.test(u)) {
          return NextResponse.json({ error: `social_links.${net} must be a valid URL or empty.` }, { status: 400 });
        }
        out[net] = u;
      }
      cleaned[k] = JSON.stringify(out);
    } else if (['logo_light', 'logo_dark', 'favicon_url'].includes(k)) {
      const v = sanitizeText(b[k], 300);
      if (v && !/^(https?:\/\/|\/)/i.test(v)) {
        return NextResponse.json({ error: `${k} must be a relative path or http(s) URL.` }, { status: 400 });
      }
      cleaned[k] = v;
    } else if (['contact_email'].includes(k)) {
      const v = sanitizeText(b[k], 120);
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        return NextResponse.json({ error: 'contact_email must be a valid email or empty.' }, { status: 400 });
      }
      cleaned[k] = v;
    } else if (['adv_easypaisa_name', 'adv_easypaisa_number', 'adv_bank_name', 'adv_bank_title', 'adv_bank_account', 'adv_bank_iban', 'adv_instructions'].includes(k)) {
      // Advance-payment account details may legitimately be empty
      // (e.g. only EasyPaisa configured, no bank account).
      cleaned[k] = sanitizeText(b[k] == null ? '' : String(b[k]), k === 'adv_instructions' ? 500 : 120);
    } else {
      const v = sanitizeText(b[k], 500);
      if (!v) {
        return NextResponse.json({ error: `${k} cannot be empty.` }, { status: 400 });
      }
      cleaned[k] = v;
    }
  }
  await ready();
  const c = client();
  for (const k of keys) {
    await c.execute({
      sql: `INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      args: [k, cleaned[k]],
    });
  }
  const { logActivity, revalidateSite } = await import('@/lib/content');
  await logActivity('update', 'settings', null, `Updated: ${keys.join(', ')}`);
  revalidateSite();
  return NextResponse.json({ ok: true, updated: keys });
}
