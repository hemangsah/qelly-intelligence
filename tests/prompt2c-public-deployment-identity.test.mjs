import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rewritePublicIdentity} from '../scripts/finalize-public-runtime.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('production build rewrites legacy public URLs and adds canonical social identity',()=>{
  const siteUrl='https://qelly-intelligence.pages.dev';
  const source='<!doctype html><html><head><title>Qelly Intelligence · Verifiable Market Intelligence</title></head><body><a href="https://hemangsah.github.io/qelly-intelligence/support.html">Support</a></body></html>';
  const rewritten=rewritePublicIdentity(source,{siteUrl,file:'index.html'});
  assert.doesNotMatch(rewritten,/hemangsah\.github\.io/);
  assert.match(rewritten,new RegExp(`<link rel="canonical" href="${siteUrl.replaceAll('.','\\.')}/">`));
  assert.match(rewritten,new RegExp(`<meta property="og:url" content="${siteUrl.replaceAll('.','\\.')}/">`));
  assert.match(rewritten,/twitter:card/);
});

test('public headers preserve strict CSP and prevent unsolicited edge transformation',async()=>{
  const headers=await read('apps/web/public/_headers');
  assert.match(headers,/Cache-Control: public, max-age=0, must-revalidate, no-transform/);
  const csp=headers.match(/Content-Security-Policy:\s*([^\n]+)/)?.[1]||'';
  const directive=(name)=>csp.split(';').map(value=>value.trim()).find(value=>value.startsWith(`${name} `))||'';
  assert.equal(directive('script-src'),"script-src 'self' https://s3.tradingview.com");
  assert.equal(directive('connect-src'),"connect-src 'self'");
  assert.equal(directive('frame-src'),'frame-src https://*.tradingview.com https://*.tradingview-widget.com');
  assert.doesNotMatch(directive('script-src'),/'unsafe-inline'|'unsafe-eval'/);
  assert.doesNotMatch(csp,/static\.cloudflareinsights\.com/);
});

test('privacy and support copy remain accurate while transactional email is fail-closed',async()=>{
  const [privacy,support]=await Promise.all([read('apps/web/public/legal/privacy.html'),read('apps/web/public/support.html')]);
  assert.match(privacy,/configured to use Supabase Postgres and Auth/);
  assert.match(privacy,/authenticated production lifecycle remains fail-closed/);
  assert.match(privacy,/Optional Cloudflare Web Analytics is not required/);
  assert.doesNotMatch(privacy,/must be updated when a real cloud provider is activated/);
  assert.match(support,/Registration and recovery remain fail-closed/);
  assert.match(support,/protected account feedback is not yet production-proven/);
  assert.doesNotMatch(support,/Production authentication and protected feedback APIs are active/);
  assert.doesNotMatch(support,/cloud endpoint are authorized/);
  assert.doesNotMatch(support,/Cloud protected writes require authorization/);
});
