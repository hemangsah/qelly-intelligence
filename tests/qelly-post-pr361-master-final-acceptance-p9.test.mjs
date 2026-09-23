import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import {routeDefinitions} from '../apps/web/public/assets/route-registry.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const route=(id)=>routeDefinitions.find((item)=>item.route===id);

test('master acceptance: required public product surfaces and protected operations retain the correct access boundary',()=>{
  const publicRoutes=['feature-universe','market','decision-provenance','formula-screener','asset','search','india-finance','alert-center','notification-center','qelly-verify','calculator-center'];
  for(const id of publicRoutes){
    const definition=route(id);
    assert.ok(definition,`${id} route missing`);
    assert.equal(definition.public,true,`${id} must remain public`);
  }
  const protectedRoutes=['account-session','security-setup','passkey-center','account-recovery','secure-import-vault','delivery-operations','platform-readiness','secret-rotation','quarantine-review','staging-assurance','watchlist','portfolio-analytics','research-workspace'];
  for(const id of protectedRoutes){
    const definition=route(id);
    assert.ok(definition,`${id} route missing`);
    assert.notEqual(definition.public,true,`${id} must remain protected`);
    assert.notEqual(definition.anonymousOnly,true,`${id} must not become anonymous-only`);
  }
});

test('master acceptance: Decision is the live evidence workspace with complete R:R/lifecycle and explicit unavailable-evidence boundaries',async()=>{
  const [ui,api,trade,context,chatTools]=await Promise.all([
    read('apps/web/public/assets/routes/decision-proven-graph.mjs'),
    read('functions/api/v1/decision-proven-graph.js'),
    read('functions/_lib/decision-trade-research.js'),
    read('functions/_lib/decision-context.js'),
    read('functions/_lib/qelly-chat-tools.js')
  ]);
  for(const phrase of ['Find Trade Now','1:1','1:2','1:3','1:4','Auto','Custom','Past','Present','Future','QELLY Chat','NO TRADE'])assert.ok(ui.toLowerCase().includes(phrase.toLowerCase()),`missing Decision UI phrase: ${phrase}`);
  assert.match(ui,/data-dpg-chart/);
  assert.match(ui,/data-dpg-open-chat/);
  assert.match(ui,/decisionSnapshot/i);
  assert.match(api,/Use GET for public Decision Intelligence/);
  assert.match(api,/liquidations:\{state:'unavailable'/);
  assert.match(api,/options:\{state:'unavailable'/);
  assert.match(api,/onChain:\{state:'unavailable'/);
  assert.match(api,/eventRisk/);
  assert.match(api,/crossAsset/);
  assert.match(api,/macro/);
  assert.match(api,/includeNews/);
  assert.match(trade,/invalidationLayers/);
  assert.match(trade,/entryZone/);
  assert.match(trade,/targets/);
  assert.match(trade,/lifecycle/);
  assert.match(trade,/expiryAt/);
  assert.match(trade,/NOT FEASIBLE/);
  assert.match(trade,/requestedRr/);
  assert.match(trade,/customRr/);
  assert.match(trade,/calibrationState/);
  assert.match(context,/eligibilityImpact:'none'/);
  assert.match(context,/contradiction/i);
  assert.match(context,/past/i);
  assert.match(context,/present/i);
  assert.match(context,/future/i);
  assert.match(chatTools,/compactDecisionToolReceipt/);
  assert.match(chatTools,/Decision Trace is explanatory only/);
  assert.match(chatTools,/Historical analog outcomes are descriptive context/);
});

test('master acceptance: Market has one canonical owner, Advanced Chart before Crypto Heatmap, and cancellable lazy embeds',async()=>{
  const [app,market,grid,widget,index]=await Promise.all([
    read('apps/web/public/assets/app.js'),
    read('apps/web/public/assets/routes/market-v6.mjs'),
    read('apps/web/public/assets/market/tradingview-market-grid.mjs'),
    read('apps/web/public/assets/market/tradingview-display-widget.mjs'),
    read('apps/web/public/index.html')
  ]);
  assert.match(app,/case 'market': await renderMarketV6/);
  assert.match(app,/default: await renderMarketV6/);
  assert.doesNotMatch(app,/async function renderMarket\(main\)/);
  const chart=market.indexOf('id="v6-market-tradingview"');
  const gridHost=market.indexOf('data-market-widget-grid');
  assert.ok(chart>=0&&gridHost>chart,'Advanced Chart host must precede the external market grid');
  const panelBlock=market.slice(market.indexOf('const MARKET_WIDGET_PANELS'),market.indexOf('const INTELLIGENCE_DOCK_PANELS'));
  assert.match(panelBlock,/Object\.freeze\(\[\s*\{id:'crypto-heatmap'/);
  assert.match(grid,/IntersectionObserver/);
  assert.match(grid,/destroy/);
  assert.match(widget,/MutationObserver/);
  assert.match(widget,/destroy\(\)/);
  assert.match(widget,/iframe/);
  assert.doesNotMatch(index,/qelly-external-market-surfaces\.mjs|qelly-product-route-guard\.mjs/);
});

test('master acceptance: Search, Dossier, Formula, Chat, Verify, Alerts and Notifications preserve truthful current contracts',async()=>{
  const [search,catalog,formula,chat,verify,alerts,notifications,app]=await Promise.all([
    read('functions/_lib/public-search.js'),
    read('functions/_lib/public-market-assets.js'),
    read('apps/web/public/assets/routes/formula-screener.mjs'),
    read('apps/web/public/assets/routes/qelly-chat-workspace.mjs'),
    read('apps/web/public/assets/qelly-verify-product.mjs'),
    read('apps/web/public/assets/routes/alert-center.mjs'),
    read('apps/web/public/assets/routes/notification-center.mjs'),
    read('apps/web/public/assets/app.js')
  ]);
  for(const symbol of ['BTC','ETH','SOL','HYPE','XRP','DOGE'])assert.match(catalog,new RegExp('["\\\']'+symbol+'["\\\']'));
  assert.match(search,/public.*asset|asset.*public/i);
  assert.match(formula,/supporting evidence only/i);
  assert.match(formula,/Open in Decision Intelligence/);
  assert.match(chat,/QELLY tool receipts/i);
  assert.match(chat,/explicit unavailable coverage/i);
  assert.match(verify,/processed in this browser and is not uploaded/i);
  assert.match(verify,/No live AI model, order execution or personalized financial recommendation is active/i);
  assert.match(alerts,/dry-run|does not execute|no execution/i);
  assert.match(notifications,/never marks an item read or sends a message/i);
  assert.match(app,/source:'asset-dossier'/);
});

test('master acceptance: retired duplicate owners and demo modules remain physically absent',async()=>{
  for(const p of [
    '../apps/web/public/assets/qelly-product-route-guard.mjs',
    '../apps/web/public/assets/qelly-external-market-surfaces.mjs',
    '../apps/web/public/assets/qelly-decision-engine.mjs',
    '../apps/web/public/assets/qelly-v54-decision-provenance.css',
    '../apps/web/public/assets/market/tradingview-live-chart.mjs'
  ])await assert.rejects(access(new URL(p,import.meta.url)));
  const [index,tree]=await Promise.all([read('apps/web/public/index.html'),read('artifacts/QELLY_SOURCE_TREE.txt')]);
  assert.doesNotMatch(index,/qelly-verify-bootstrap\.mjs|qelly-verify-shell-nav\.mjs|qelly-product-route-guard\.mjs|qelly-public-recovery\.mjs/);
  assert.doesNotMatch(tree,/qelly-product-route-guard\.mjs|qelly-external-market-surfaces\.mjs|qelly-decision-engine\.mjs|qelly-v54-decision-provenance\.css|tradingview-live-chart\.mjs/);
});

test('master acceptance: canonical, SEO, cache, security and ad-readiness defaults stay production-safe',async()=>{
  const [build,headers,worker,robots]=await Promise.all([
    read('scripts/build-frontend.mjs'),
    read('apps/web/public/_headers'),
    read('apps/web/public/qelly-service-worker.js'),
    read('apps/web/public/robots.txt')
  ]);
  assert.match(build,/QELLY_CANONICAL_SITE_URL/);
  assert.match(build,/QELLY_PUBLIC_SITE_URL/);
  assert.match(build,/QELLY_PUBLIC_AD_NETWORK_ENABLED/);
  assert.match(build,/QELLY_PUBLIC_ADSENSE_CSP_READY/);
  assert.match(build,/adsConfigured/);
  assert.match(headers,/Content-Security-Policy/);
  assert.match(headers,/Strict-Transport-Security/);
  assert.match(headers,/X-Content-Type-Options: nosniff/);
  assert.match(headers,/X-Frame-Options: DENY/);
  assert.match(headers,/\/qelly-release\.json[\s\S]*Cache-Control: no-store/);
  assert.match(worker,/caches\.delete/);
  assert.match(worker,/networkFirst/);
  assert.match(worker,/\/api\//);
  assert.match(robots,/Disallow: \/api\//);
  assert.match(robots,/Host-neutral fallback/);
  assert.match(robots,/Connected builds replace this file from QELLY_PUBLIC_SITE_URL/);
});
