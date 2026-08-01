import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hardenIndexHtml,isValidSupabasePublishableKey} from '../scripts/harden-cloudflare-index.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Cloudflare public runtime contains no CSP-blocked inline JavaScript',async()=>{
  const [source,headers,ready,prepaint]=await Promise.all([
    read('apps/web/public/index.html'),
    read('apps/web/public/_headers'),
    read('apps/web/public/assets/qelly-app-ready.mjs'),
    read('apps/web/public/assets/qelly-prepaint-bootstrap.js')
  ]);
  const csp=headers.match(/Content-Security-Policy:\s*([^\n]+)/)?.[1]||'';
  const scriptDirective=csp.split(';').map((directive)=>directive.trim()).find((directive)=>directive.startsWith('script-src '))||'';
  assert.equal(scriptDirective,"script-src 'self'");
  assert.doesNotMatch(scriptDirective,/'unsafe-inline'/);
  const hardened=hardenIndexHtml(source);
  const inline=[...hardened.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match)=>!/(?:^|\s)src\s*=/.test(match[1])&&match[2].trim());
  assert.equal(inline.length,0);
  assert.match(hardened,/assets\/qelly-prepaint-bootstrap\.js/);
  assert.match(hardened,/assets\/qelly-app-ready\.mjs/);
  assert.ok(hardened.indexOf('qelly-app-ready.mjs')<hardened.indexOf('assets/app.js'));
  assert.match(ready,/QELLY_STARTUP_SCRIPT_ERROR/);
  assert.match(ready,/QELLY_STARTUP_TIMEOUT/);
  assert.match(ready,/data-qelly-startup-retry/);
  assert.match(prepaint,/themeReady='true'/);
});

test('public runtime rejects project references masquerading as Supabase keys',()=>{
  const project='ssdgfgqnjlwzkgukzeef';
  assert.equal(isValidSupabasePublishableKey(project,project),false);
  assert.equal(isValidSupabasePublishableKey('sb_publishable_example_valid_key_1234567890',project),true);
  assert.equal(isValidSupabasePublishableKey(`${'a'.repeat(36)}.${'b'.repeat(64)}.${'c'.repeat(43)}`,project),true);
  assert.equal(isValidSupabasePublishableKey('too-short',project),false);
});
