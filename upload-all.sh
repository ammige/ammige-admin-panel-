#!/bin/bash
# Upload all project files to Vercel and build a deployment manifest.
# Usage: ./upload-all.sh
set -u
cd ~/workspace/ammige

MANIFEST=/tmp/ammige-manifest.json
echo '{"files":[]}' > "$MANIFEST"

count=0
failed=0
while IFS= read -r f; do
  rel="${f#./}"
  sha=$(sha1sum "$f" | cut -d' ' -f1)
  size=$(stat -c%s "$f")
  b64=$(base64 -w0 "$f")
  resp=$(vercel call-tool --name upload_file --arguments-json "{\"contentLength\":$size,\"requestBody\":\"$b64\",\"xVercelDigest\":\"$sha\"}" 2>/dev/null)
  url=$(echo "$resp" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    urls=d.get('result',{}).get('urls',[])
    print(urls[0] if urls else '')
except: print('')
")
  rsha=$(basename "$url")
  if [ -z "$rsha" ] || [ "$rsha" != "$sha" ]; then
    echo "FAILED: $rel (resp sha: $rsha)"
    failed=$((failed+1))
    continue
  fi
  python3 - "$MANIFEST" "$rel" "$rsha" "$size" <<'EOF'
import json,sys
man, rel, sha, size = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
d = json.load(open(man))
d['files'].append({"file": rel, "sha": sha, "size": size})
json.dump(d, open(man,'w'))
EOF
  count=$((count+1))
  echo "[$count] ok: $rel"
done < <(find . -path ./node_modules -prune -o -path ./.next -prune -o -type f -print | grep -v -E '^\./(ammige\.db|\.env|\.env\.local)$' | sort)

echo "DONE: $count uploaded, $failed failed"
python3 -c "import json; d=json.load(open('$MANIFEST')); print('manifest files:', len(d['files']))"
