import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(file)=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('route rendering cancels stale work and immediately replaces the previous route with a stable shell',async()=>{
  const source=await read('apps/web/public/assets/app.js');
  assert.match(source,/let routeRenderRequest=0;/);
  assert.match(source,/activeRouteController\?\.abort\(\)/);
  assert.match(source,/main\.innerHTML=loadingPage\(definition\?\.label\?\?'Loading route'\)/);
  assert.match(source,/routeRenderTail=routeRenderTail\.catch\(\(\)=>undefined\)\.then\(\(\)=>request===routeRenderRequest\?performRouteRender\(request,controller\):undefined\)/);
  assert.match(source,/signal:fetchOptions\.signal\?\?currentRenderSignal\?\?undefined/);
  assert.match(source,/error\?\.name==='AbortError'\|\|request!==routeRenderRequest/);
  assert.match(source,/const route=state\.route;/);
  assert.match(source,/switch \(route\)/);
});

test('market route teardown destroys every external widget lifecycle owner',async()=>{
  const source=await read('apps/web/public/assets/app.js');
  assert.match(source,/window\.__qellyLiveMarketCleanup\?\.\(\)/);
  assert.match(source,/window\.__qellyMarketV6Cleanup\?\.\(\)/);
  assert.match(source,/window\.__qellyMarketV6Cleanup=null/);
});

test('persistent assistant branding reserves image geometry and reduced motion cancels transitions',async()=>{
  const [assistant,appCss,productCss]=await Promise.all([
    read('apps/web/public/assets/ai/qelly-chat.mjs'),
    read('apps/web/public/assets/app.css'),
    read('apps/web/public/assets/qelly-product-experience.css')
  ]);
  assert.match(assistant,/qelly-symbol\.svg" width="38" height="38"/);
  assert.match(assistant,/qelly-symbol\.svg" width="36" height="36"/);
  assert.match(appCss,/@media \(prefers-reduced-motion:reduce\)[\s\S]*#app\.q-app\.q-app\.q-app #main \*[\s\S]*#q-feature-navigation\.q-feature-navigation \*[\s\S]*animation:none!important;[\s\S]*transition:none!important;/);
  assert.match(productCss,/\.q-product-header :where\(\.q-product-menu,\.q-product-system,\.q-product-account\)\{height:44px!important;min-height:44px!important/);
  assert.match(productCss,/@media\(max-width:760px\)[\s\S]*header\.q-product-header\{grid-template-columns:44px minmax\(0,1fr\) auto auto!important/);
});

test('authenticated session state synchronizes the production account header',async()=>{
  const [app,product]=await Promise.all([
    read('apps/web/public/assets/app.js'),
    read('apps/web/public/assets/qelly-public-runtime.mjs')
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
  for(const text of ['data-capability-boundary','Continue in Qelly','Why this page is empty','never invents missing values','Retry connection'])assert.match(source,new RegExp(text));
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
