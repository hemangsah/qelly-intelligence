import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const bootstrap=await readFile(new URL('../apps/web/public/assets/qelly-auth-appearance-bootstrap.js',import.meta.url),'utf8');
function beforePaint(saved,{dark=false,contrast=false,blocked=false}={}){const root={dataset:{},style:{}};runInNewContext(bootstrap,{document:{documentElement:root},localStorage:{getItem:()=>{if(blocked)throw Error('blocked');return saved;}},matchMedia:query=>({matches:query.includes('prefers-contrast')?contrast:dark})});return root;}
test('callback first paint resolves saved and system appearance without an authorization URL',()=>{
  assert.equal(beforePaint('{"appearance":"light"}').dataset.appearance,'light');
  assert.equal(beforePaint('{"appearance":"dark"}').dataset.appearance,'dark');
  assert.equal(beforePaint('{"appearance":"system"}',{dark:false}).dataset.appearance,'light');
  assert.equal(beforePaint('{"appearance":"system"}',{dark:true}).dataset.appearance,'dark');
  assert.equal(beforePaint('{"appearance":"system"}',{contrast:true}).dataset.appearance,'high-contrast');
  assert.equal(beforePaint('{"appearance":"light"}').style.colorScheme,'light');
});
test('blocked, malformed and unsupported saved appearance retain safe first paint',()=>{
  for(const value of ['invalid','null','{"appearance":"unknown"}'])assert.equal(beforePaint(value).dataset.appearance,'dark');
  assert.equal(beforePaint('{}',{blocked:true}).dataset.appearance,'dark');
});
test('callback isolates authorization information from appearance and strengthens referrer policy',async()=>{
  const html=await readFile(new URL('../apps/web/public/auth/callback.html',import.meta.url),'utf8'),module=await readFile(new URL('../apps/web/public/assets/qelly-auth-appearance.mjs',import.meta.url),'utf8'),headers=await readFile(new URL('../apps/web/public/_headers',import.meta.url),'utf8');
  assert.ok(html.indexOf('qelly-auth-appearance-bootstrap.js')<html.indexOf('qelly-auth-appearance.css'));
  assert.match(html,/<meta name="referrer" content="no-referrer">/);assert.match(headers,/\/auth\/\*\s+Cache-Control: no-store\s+Referrer-Policy: no-referrer/);
  assert.doesNotMatch(bootstrap+module,/location\.|URLSearchParams|fetch\(|createThemePreferenceStore|qelly:open-ai|installQellyChat/);
  assert.match(html,/qelly-auth-callback\.mjs/);assert.match(html,/role="status" aria-live="polite"/);
});
