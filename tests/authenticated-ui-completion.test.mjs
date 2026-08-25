import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(file)=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('authenticated route rendering is serialized and stale requests are discarded',async()=>{
  const source=await read('apps/web/public/assets/app.js');
  assert.match(source,/let routeRenderRequest=0;/);
  assert.match(source,/routeRenderTail=routeRenderTail\.catch\(\(\)=>undefined\)\.then\(\(\)=>request===routeRenderRequest\?performRouteRender\(\):undefined\)/);
  assert.match(source,/const route=state\.route;/);
  assert.match(source,/switch \(route\)/);
});

test('authenticated session state synchronizes the production account header',async()=>{
  const [app,product]=await Promise.all([
    read('apps/web/public/assets/app.js'),
    read('apps/web/public/assets/prompt2c-public-beta.mjs')
  ]);
  assert.match(app,/qelly:session-state/);
  assert.match(app,/publishSessionState\(\);/);
  assert.match(app,/window\.__QELLY_SESSION_STATE__=detail/);
  assert.match(product,/addEventListener\('qelly:session-state'/);
  assert.match(product,/applySessionState\(event\.detail\)/);
  assert.match(product,/const initialSessionState=window\.__QELLY_SESSION_STATE__/);
  assert.doesNotMatch(product,/loadSessionState\(/);
});

test('unavailable backend capabilities render a truthful professional workspace boundary',async()=>{
  const source=await read('apps/web/public/assets/app.js');
  for(const text of ['data-capability-boundary','What is available','What is not connected','no fixture response substituted','Retry connection'])assert.match(source,new RegExp(text));
  assert.match(source,/\[404,501,503\]\.includes\(status\)/);
});

test('feature dock is persistent at common desktop width and exposes a stable launcher hook',async()=>{
  const [runtime,css]=await Promise.all([
    read('apps/web/public/assets/qelly-production-shell.mjs'),
    read('apps/web/public/assets/qelly-premium-theme.css')
  ]);
  assert.doesNotMatch(runtime,/min-width:1381px/);
  assert.match(runtime,/min-width:1241px/);
  assert.match(runtime,/featureNavigationTrigger='true'/);
  assert.match(css,/@media\(min-width:1241px\)/);
  assert.match(css,/\.q-product-nav a\{min-height:44px!important/);
});

test('successful authentication restores the persistent desktop feature dock',async()=>{
  const runtime=await read('apps/web/public/assets/qelly-production-shell.mjs');
  assert.match(runtime,/addEventListener\('qelly:session-state'/);
  assert.match(runtime,/event\.detail\?\.authenticated===true&&matchMedia\('\(min-width:1241px\)'\)\.matches/);
  assert.match(runtime,/document\.body\.classList\.remove\('q-feature-navigation-collapsed'\)/);
  assert.match(runtime,/window\.__QELLY_SESSION_STATE__\?\.authenticated===true/);
  assert.match(runtime,/account\.setAttribute\('href',authenticated\?'#\/account-session':'#\/auth-login'\)/);
  assert.match(runtime,/authenticated\?'Open Qelly account':'Sign in to Qelly'/);
});
