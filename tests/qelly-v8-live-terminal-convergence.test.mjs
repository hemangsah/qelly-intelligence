import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('connected production config excludes simulated market state',async()=>{
  const source=await read('functions/api/v1/config.js');
  assert.doesNotMatch(source,/states:\[[^\]]*['"]simulated['"]/s);
  assert.match(source,/fabricatedMarketFallback:false/);
  assert.match(source,/deterministicExamplesRestrictedToAnalyticalTools:true/);
});

test('production frontend build inherits the proven canonical email canary',async()=>{
  const source=await read('scripts/build-frontend.mjs');
  assert.match(source,/AUTH_EMAIL_CANARY/);
  assert.match(source,/CANONICAL_QELLY_PUBLIC_SITE/);
  assert.match(source,/productionEmailCanary/);
  assert.match(source,/QELLY_ENABLE_AUTH_EMAIL_DELIVERY,productionEmailCanary/);
});

test('canonical auth router uses the same effective email capability owner as config',async()=>{
  const [router,config]=await Promise.all([
    read('functions/api/v1/[[path]].js'),
    read('functions/api/v1/config.js')
  ]);
  assert.match(router,/effectivePublicRuntimeConfig/);
  assert.match(router,/const authRuntime=effectivePublicRuntimeConfig\(env,request\.url\)/);
  assert.match(config,/effectivePublicRuntimeConfig/);
});

test('github pages keeps live-markets local and uses canonical read-only API',async()=>{
  const [mirror,finalizer]=await Promise.all([
    read('apps/web/public/assets/qelly-github-pages-mirror.mjs'),
    read('scripts/finalize-github-pages-mirror.mjs')
  ]);
  assert.match(mirror,/LOCAL_PUBLIC_ROUTES=new Set\(\[[\s\S]*'live-markets'/);
  const canonicalBlock=mirror.match(/const CANONICAL_ONLY_ROUTES=new Set\(\[([\s\S]*?)\]\);/)?.[1]||'';
  assert.doesNotMatch(canonicalBlock,/'live-markets'/);
  assert.match(finalizer,/config\.apiBaseUrl!==CANONICAL_URL/);
});

test('global market network is live-first and preserves no-fabrication boundaries',async()=>{
  const [route,css,backend]=await Promise.all([
    read('apps/web/public/assets/routes/market-network.mjs'),
    read('apps/web/public/assets/routes/market-network.css'),
    read('functions/_lib/market-network.js')
  ]);
  assert.match(route,/data-market-network=\"live-terminal-v8\"/);
  assert.match(route,/Live source board/);
  assert.match(route,/Professional research dock/);
  assert.match(route,/ECB governed FX reference/);
  assert.match(route,/TradingView.*display-only/is);
  assert.match(css,/q-mn-live-board/);
  assert.match(css,/height:390px/);
  assert.match(backend,/fabricatedFallback:false/);
  assert.match(backend,/sourceFailuresRemainUnavailable:true/);
});

test('deployed acceptance gate verifies Cloudflare and GitHub live-markets',async()=>{
  const source=await read('.github/workflows/qelly-v8-live-terminal-acceptance.yml');
  assert.match(source,/api\/v1\/market\/network/);
  assert.match(source,/ecb_reference_unavailable/);
  assert.match(source,/no_fast_public_market_source_available/);
  assert.match(source,/static_dynamic_email_capability_drift/);
  assert.match(source,/github-live-markets/);
  assert.match(source,/unexpected_handoff/);
});
