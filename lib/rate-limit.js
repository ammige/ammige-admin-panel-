'use strict';

/**
 * Tiny in-memory sliding-window rate limiter (best-effort on serverless).
 * Usage: if (!checkRate(req, { windowMs, max })) return 429 response.
 */
const buckets = new Map(); // key -> array of timestamps

function keyOf(req, scope) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  return `${scope}:${ip}`;
}

function checkRate(req, { windowMs = 60_000, max = 30, scope = 'global' } = {}) {
  const key = keyOf(req, scope);
  const now = Date.now();
  let arr = buckets.get(key);
  if (!arr) {
    arr = [];
    buckets.set(key, arr);
  }
  while (arr.length && arr[0] <= now - windowMs) arr.shift();
  if (arr.length >= max) return false;
  arr.push(now);
  // Prevent unbounded growth
  if (buckets.size > 5000) buckets.clear();
  return true;
}

module.exports = { checkRate };
