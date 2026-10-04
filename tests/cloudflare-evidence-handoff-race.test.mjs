import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const path=new URL('../.github/workflows/release-evidence-handoff.yml',import.meta.url);
test('empty Browser run PR arrays use commit-to-open-PR lookup instead of a guess',async()=>{
 const yaml=await readFile(path,'utf8');
 assert.match(yaml,/commits\/\$sha\/pulls/);
 assert.match(yaml,/\.state == "open" and \.head\.sha == \$sha and \.base\.ref == "release\/qelly-global-public-beta"/);
 assert.match(yaml,/if \[ -z "\$pr_url" \]; then/);
 assert.match(yaml,/if \[ "\$current_sha" != "\$sha" \]; then/);
 assert.match(yaml,/superseded pull-request head; exact-PR evidence is intentionally not applicable/);
 assert.match(yaml,/echo "eligible=false" >> "\$GITHUB_OUTPUT"/);
});
test('PR must still be open at exact tested head after Cloudflare and artifact checks',async()=>{
 const yaml=await readFile(path,'utf8');
 assert.match(yaml,/PR advanced or closed while evidence was being reconciled/);
 assert.match(yaml,/\.head\.sha/);
 assert.match(yaml,/ref: \$\{\{ steps\.pr\.outputs\.sha \}\}/);
 assert.match(yaml,/test "\$\(git rev-parse HEAD\)" = "\$\{\{ steps\.pr\.outputs\.sha \}\}"/);
});
