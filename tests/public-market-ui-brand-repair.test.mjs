import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__test as publicApi} from '../functions/api/v1/[[path]].js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('governed public market contract is deterministic, explicit and non-executable',()=>{
  const first=publicApi.publicMarketOverviewContract();
  const second=publicApi.publicMarketOverviewContract();
  assert.deepEqual(first,second);
  assert.equal(first.mode,'simulated-demo');
  assert.equal(first.items.length,6);
  assert.equal(first.guardrails.live,false);
  assert.equal(first.guardrails.executable,false);
  assert.equal(first.guardrails.personalizedAdvice,false);
  assert.match(first.truthBoundary,/not live/i);
  assert.equal(first.items.every((asset)=>asset.source?.freshness==='simulated'),true);

  const bitcoin=publicApi.publicMarketAsset('QI-CRYPTO-BTC');
  assert.equal(bitcoin.symbol,'BTC');
  const candles=publicApi.publicMarketCandles(bitcoin,168);
  assert.equal(candles.points.length,168);
  assert.equal(candles.guardrails.live,false);
  assert.equal(candles.guardrails.executable,false);
  assert.deepEqual(candles,publicApi.publicMarketCandles(bitcoin,168));
});

test('anonymous market handlers execute before the required-session gate',async()=>{
  const source=await read('functions/api/v1/[[path]].js');
  const overview=source.indexOf("path==='public/markets/overview'");
  const candles=source.indexOf("segments[4]==='candles'");
  const requiredSession=source.indexOf('resolveSession(request,env,{required:true})');
  assert.ok(overview>0);
  assert.ok(candles>overview);
  assert.ok(requiredSession>candles);
  assert.match(source,/publicMarketOverviewContract\(\)/);
  assert.match(source,/publicMarketCandles\(asset,url\.searchParams\.get\('limit'\)\)/);
});

test('canonical Qelly logo is used in the global strip and edge dock',async()=>{
  const [index,shell,correction]=await Promise.all([
    read('apps/web/public/index.html'),
    read('apps/web/public/assets/shell-foundations.mjs'),
    read('apps/web/public/assets/qelly-brand-visual-correction.mjs')
  ]);
  assert.match(index,/class="q-brand-home"[^>]+qelly-logo-primary\.svg/);
  assert.doesNotMatch(index,/class="q-brand-mark"[^>]*><span>Q<\/span>/);
  assert.match(shell,/new URL\('\.\/brand\/qelly-symbol\.svg'/);
  assert.match(shell,/data-qelly-official-brand="true"/);
  assert.doesNotMatch(shell,/q-edge-dock__brand" aria-hidden="true">Q/);
  assert.match(correction,/primaryLogoAsset/);
  assert.doesNotMatch(correction,/q-edge-dock__brand'\)\?\.setAttribute\('hidden'/);
});

test('final repair stylesheet is loaded last and restores accessible feature contrast',async()=>{
  const [index,style,route]=await Promise.all([
    read('apps/web/public/index.html'),
    read('apps/web/public/assets/qelly-runtime-repair.css'),
    read('apps/web/public/assets/routes/feature-universe.mjs')
  ]);
  assert.ok(index.indexOf('qelly-runtime-repair.css')>index.indexOf('qelly-public-recovery.css'));
  for(const selector of ['.q-universe-hero','.q-universe-core','.q-universe-route-grid>button','.q-edge-dock__brand'])assert.match(style,new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(style,/color:#fff!important/);
  assert.match(style,/background:#1b1519!important/);
  assert.match(style,/\[hidden\]\{display:none!important\}/);
  assert.match(route,/qelly-symbol\.svg/);
  assert.match(route,/Open market overview/);
});

test('public recovery replaces the market error instead of redirecting or nesting it',async()=>{
  const recovery=await read('apps/web/public/assets/qelly-public-recovery.mjs');
  assert.match(recovery,/function renderMarketRecovery/);
  assert.match(recovery,/main\.innerHTML=`<section class="q-recovery-page q-market-recovery"/);
  assert.match(recovery,/No authentication is required for this public route/);
  assert.match(recovery,/if\(route==='market'\)\{renderMarketRecovery\(message\);return;\}/);
  assert.doesNotMatch(recovery,/if\(route==='market'\)\{location\.hash='#\/market\?view=decision-maker'/);
});
