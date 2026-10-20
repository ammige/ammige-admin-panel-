#!/usr/bin/env python3
"""Upload all ammige project files to Vercel file storage and build a manifest.
upload_file returns 200 with EMPTY body on success (per tool docs).
Manifest entries: {file, sha, size} for create_deployment.
"""
import base64, hashlib, json, os, subprocess, sys

ROOT = os.path.expanduser('~/workspace/ammige')
MANIFEST = '/tmp/ammige-manifest.json'
EXCLUDE_DIRS = {'node_modules', '.next', '.git'}
EXCLUDE_FILES = {'ammige.db', '.env', '.env.local'}

def files():
    out = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for fn in filenames:
            if fn in EXCLUDE_FILES:
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, ROOT)
            out.append((rel, full))
    return sorted(out)

def upload(rel, full, sha, size):
    with open(full, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode()
    args = json.dumps({'contentLength': size, 'requestBody': b64, 'xVercelDigest': sha})
    p = subprocess.run(['vercel', 'call-tool', '--name', 'upload_file',
                        '--arguments-json', args],
                       capture_output=True, text=True, timeout=300)
    try:
        d = json.loads(p.stdout)
        txt = d['result']['content'][0]['text']
        body = json.loads(txt)
        result = body.get('result', {})
        # success = 200 with urls list (new upload) OR empty {} (already uploaded)
        urls = result.get('urls', [])
        if urls:
            return sha in urls[0]
        return result == {}
    except Exception as e:
        print(f'  parse error: {e} | out: {p.stdout[:200]}', flush=True)
        return False

def main():
    fl = files()
    print(f'{len(fl)} files to upload', flush=True)
    manifest = {'files': []}
    failed = []
    for i, (rel, full) in enumerate(fl, 1):
        size = os.path.getsize(full)
        h = hashlib.sha1()
        with open(full, 'rb') as f:
            for chunk in iter(lambda: f.read(65536), b''):
                h.update(chunk)
        sha = h.hexdigest()
        ok = upload(rel, full, sha, size)
        if ok:
            manifest['files'].append({'file': rel, 'sha': sha, 'size': size})
        else:
            failed.append(rel)
        if i % 10 == 0 or not ok:
            print(f'[{i}/{len(fl)}] {"ok" if ok else "FAILED"}: {rel}', flush=True)
    json.dump(manifest, open(MANIFEST, 'w'))
    print(f'DONE: {len(manifest["files"])} uploaded, {len(failed)} failed')
    if failed:
        print('failed:', failed)
    print('manifest:', MANIFEST)

main()
