'use strict';

/**
 * Time helpers — schedules are stored in UTC, edited/shown in Asia/Karachi (PKT).
 * PKT is UTC+5 with no DST, so conversion is a fixed offset.
 */

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

function pad(n) {
  return String(n).padStart(2, '0');
}

/** UTC ISO → 'YYYY-MM-DDTHH:mm' in PKT (for datetime-local inputs). */
function toPKTInput(utcISO) {
  if (!utcISO) return '';
  const d = new Date(utcISO);
  if (Number.isNaN(d.getTime())) return '';
  const pkt = new Date(d.getTime() + PKT_OFFSET_MS);
  return `${pkt.getUTCFullYear()}-${pad(pkt.getUTCMonth() + 1)}-${pad(pkt.getUTCDate())}T${pad(pkt.getUTCHours())}:${pad(pkt.getUTCMinutes())}`;
}

/** 'YYYY-MM-DDTHH:mm' in PKT → UTC ISO string. */
function fromPKTInput(local) {
  if (!local) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local.trim());
  if (!m) return null;
  const utcMs = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - PKT_OFFSET_MS;
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Human-readable PKT timestamp for the admin UI, e.g. "19 Oct 2026, 02:30 PM PKT". */
function formatPKT(utcISO) {
  if (!utcISO) return '—';
  const d = new Date(utcISO);
  if (Number.isNaN(d.getTime())) return '—';
  const pkt = new Date(d.getTime() + PKT_OFFSET_MS);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let h = pkt.getUTCHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${pkt.getUTCDate()} ${months[pkt.getUTCMonth()]} ${pkt.getUTCFullYear()}, ${pad(h)}:${pad(pkt.getUTCMinutes())} ${ap} PKT`;
}

function nowUTC() {
  return new Date().toISOString();
}

module.exports = { toPKTInput, fromPKTInput, formatPKT, nowUTC, PKT_OFFSET_MS };
