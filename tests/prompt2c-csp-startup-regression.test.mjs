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
  const directives=new Map(csp.split(';').map((directive)=>directive.trim()).filter(Boolean).map((directive)=>{
    const [name,...values]=directive.split(/\s+/);
    return [name,`${name}${values.length?` ${values.join(' ')}`:''}`];
  }));
  assert.equal(directives.get('script-src'),"script-src 'self' https://s3.tradingview.com");
  assert.equal(directives.get('connect-src'),"connect-src 'self'");
  assert.equal(directives.get('frame-src'),'frame-src https://*.tradingview.com https://*.tradingview-widget.com');
  assert.doesNotMatch(directives.get('script-src')||'',/'unsafe-inline'|'unsafe-eval'/);
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
