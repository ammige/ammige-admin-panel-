import { NextResponse } from 'next/server';

const fs = require('fs');
const { resolveMediaPath, contentTypeFor, readMediaDb } = require('@/lib/media');

/**
 * GET /media/<dir>/<file> — streams uploaded files from UPLOAD_DIR.
 *
 * Why a route handler instead of /public: Next.js does not serve files
 * added to /public AFTER the build. Uploads land on disk at runtime,
 * so they must be served by code.
 *
 * - Correct Content-Type per extension
 * - HTTP Range support (video seeking → 206 Partial Content)
 * - Long immutable cache headers (filenames are random = content-addressed)
 */
function serveFile(full, req) {
  let stat;
  try {
    stat = fs.statSync(full);
  } catch {
    return null;
  }
  if (!stat.isFile()) return null;

  const size = stat.size;
  const type = contentTypeFor(full);
  const headers = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    // Filenames are random per upload, so aggressive caching is safe.
    'Cache-Control': 'public, max-age=31536000, immutable',
  };

  const range = req.headers.get('range');
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m) {
      let start = m[1] === '' ? null : parseInt(m[1], 10);
      let end = m[2] === '' ? null : parseInt(m[2], 10);
      if (start === null && end !== null) start = Math.max(0, size - end);
      if (start !== null && end === null) end = size - 1;
      if (
        start !== null && end !== null &&
        Number.isInteger(start) && Number.isInteger(end) &&
        start >= 0 && end >= start && start < size
      ) {
        end = Math.min(end, size - 1);
        const chunkSize = end - start + 1;
        const stream = fs.createReadStream(full, { start, end });
        return new NextResponse(stream, {
          status: 206,
          headers: {
            ...headers,
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Content-Length': String(chunkSize),
          },
        });
      }
      // Unsatisfiable range
      return new NextResponse('Range Not Satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}` },
      });
    }
  }

  const stream = fs.createReadStream(full);
  return new NextResponse(stream, {
    status: 200,
    headers: { ...headers, 'Content-Length': String(size) },
  });
}

export async function GET(req, { params }) {
  // Uploaded images live in the shared DB (Vercel disk is ephemeral and not
  // shared between deployments) — check there first, then fall back to disk.
  const dbHit = await readMediaDb(params.path);
  if (dbHit) {
    const size = dbHit.buf.length;
    const base = {
      'Content-Type': dbHit.mime,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    };
    const range = req.headers.get('range');
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (m) {
        let start = m[1] === '' ? null : parseInt(m[1], 10);
        let end = m[2] === '' ? null : parseInt(m[2], 10);
        if (start === null && end !== null) start = Math.max(0, size - end);
        if (start !== null && end === null) end = size - 1;
        if (start !== null && end !== null && start >= 0 && end >= start && start < size) {
          end = Math.min(end, size - 1);
          return new NextResponse(dbHit.buf.subarray(start, end + 1), {
            status: 206,
            headers: { ...base, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
          });
        }
        return new NextResponse('Range Not Satisfiable', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      }
    }
    return new NextResponse(dbHit.buf, {
      status: 200,
      headers: { ...base, 'Content-Length': String(size) },
    });
  }
  const full = resolveMediaPath(params.path);
  if (!full) {
    return new NextResponse('Not found', { status: 404 });
  }
  const res = serveFile(full, req);
  if (!res) return new NextResponse('Not found', { status: 404 });
  return res;
}

export async function HEAD(req, { params }) {
  const full = resolveMediaPath(params.path);
  if (!full) return new NextResponse(null, { status: 404 });
  let stat;
  try {
    stat = fs.statSync(full);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  if (!stat.isFile()) return new NextResponse(null, { status: 404 });
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': contentTypeFor(full),
      'Content-Length': String(stat.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
