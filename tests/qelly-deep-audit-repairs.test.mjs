import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('startup reveals the first usable route without waiting for fonts or optional enhancements',async()=>{
  const [ready,fonts,app,theme]=await Promise.all([
    read('apps/web/public/assets/qelly-app-ready.mjs'),
    read('apps/web/public/assets/premium-font-surface.css'),
    read('apps/web/public/assets/app.js'),
    read('apps/web/public/assets/theme-intelligence-bootstrap.mjs')
  ]);
  assert.doesNotMatch(ready,/Promise\.all\(\[\s*document\.fonts/);
  assert.doesNotMatch(ready,/await\s+(?:document\.fonts|window\.__qelly(?:Discovery|DataMesh)EnhancementReady)/);
  assert.match(ready,/await Promise\.race\(\[\s*routeReady,/);
  assert.doesNotMatch(fonts,/font-display:block/);
  assert.match(fonts,/font-display:swap/);
  assert.doesNotMatch(app,/^import .*\.\/routes\//m);
  assert.match(app,/const renderMarketV6=lazyRoute/);
  assert.match(theme,/requestIdleCallback\(enhanceDocument/);
});

test('deep audit stylesheet removes the misplaced header line and normalizes control geometry',async()=>{
  const [index,css]=await Promise.all([
    read('apps/web/public/index.html'),
    read('apps/web/public/assets/qelly-deep-audit-repairs.css')
  ]);
  assert.match(index,/qelly-deep-audit-repairs\.css/);
  assert.match(css,/\.q-product-nav a::after/);
  assert.match(css,/content:none!important/);
  assert.match(css,/\.q-product-search :where\(input,button\)/);
  assert.match(css,/data-resolved-appearance="light"/);
});

test('rankings expose lazy official research displays and preserve the no-fabrication boundary',async()=>{
  const route=await read('apps/web/public/assets/routes/asset-rankings-premium.mjs');
  for(const label of ['Global overview','Crypto screener','Crypto heatmap','CoinMarketCap'])assert.match(route,new RegExp(label));
  assert.match(route,/IntersectionObserver/);
  assert.match(route,/official third-party display widgets and are not Qelly rankings/);
  assert.match(route,/data-market-ranking-runtime="no-fabrication"/);
});

test('About Qelly identifies the founder exactly as supplied',async()=>{
  const route=await read('apps/web/public/assets/routes/about-qelly.mjs');
  assert.match(route,/Hemang Sah/);
  assert.match(route,/Founder and Product Director, Qelly Intelligence/);
});
