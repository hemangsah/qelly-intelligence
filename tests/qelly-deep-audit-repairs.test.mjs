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

test('component owners replace the retired deep-audit override layer',async()=>{
  const [index,shell,experience,widgetCss,rankings,network,discovery]=await Promise.all([
    read('apps/web/public/index.html'),
    read('apps/web/public/assets/qelly-production-shell.mjs'),
    read('apps/web/public/assets/qelly-product-experience.css'),
    read('apps/web/public/assets/market/tradingview-display-widget.css'),
    read('apps/web/public/assets/premium-rankings.css'),
    read('apps/web/public/assets/routes/market-network.css'),
    read('apps/web/public/assets/app.css')
  ]);
  assert.doesNotMatch(index,/qelly-deep-audit-repairs\.css/);
  assert.doesNotMatch(shell,/DEEP_AUDIT_REPAIRS_STYLESHEET|qellyDeepAuditRepairs/);
  assert.doesNotMatch(experience,/@import/);
  assert.match(experience,/\.q-product-nav a::after\{content:none!important/);
  assert.match(experience,/\.q-product-search :where\(input,button\)/);
  assert.match(experience,/data-resolved-appearance="light"/);
  assert.match(widgetCss,/\.qelly-tradingview-loading/);
  assert.match(rankings,/\.q-ranking-display-stage/);
  assert.match(network,/\.q-market-network\s*>\s*\.q-page-head/);
  assert.match(discovery,/Discovery grids own their card geometry/);
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
