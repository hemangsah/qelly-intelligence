import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('governed public market contract is explicit no-fabrication and non-executable',async()=>{
  const dedicated=await read('functions/api/v1/public/markets/[[route]].js');
  assert.match(dedicated,/MARKET_UNAVAILABLE_REASON/);
  assert.match(dedicated,/does not generate substitute prices or candles/i);
  assert.match(dedicated,/fabricatedObservations:false/);
  assert.match(dedicated,/points:\[\]/);
  assert.match(dedicated,/execution:false/);
  assert.doesNotMatch(dedicated,/simulated-demo|qelly-governed-demo|Math\.sin|Math\.cos/);
});

test('dedicated public market route owns anonymous market namespace before catch-all session gate',async()=>{
  const [catchAll,dedicated]=await Promise.all([
    read('functions/api/v1/[[path]].js'),
    read('functions/api/v1/public/markets/[[route]].js')
  ]);
  assert.match(dedicated,/export async function onRequest/);
  assert.match(dedicated,/const route=segments\(params\.route\)/);
  assert.match(dedicated,/route\[0\]==='overview'/);
  assert.match(dedicated,/route\[0\]==='assets'/);
  assert.doesNotMatch(catchAll,/path==='public\/markets\/overview'|path==='public\/markets\/assets'/);
  assert.doesNotMatch(catchAll,/segments\[0\]==='public'&&segments\[1\]==='markets'/);
  assert.match(catchAll,/resolveSession\(request,env,\{required:true\}\)/);
});

test('canonical Qelly logo is used in the global strip and edge dock',async()=>{
  const [index,shell,correction]=await Promise.all([
    read('apps/web/public/index.html'),
    read('apps/web/public/assets/shell-foundations.mjs'),
    read('apps/web/public/assets/qelly-brand-visual-correction.mjs')
  ]);
  assert.match(index,/<a class="q-brand-home"[^>]*>\s*<img[^>]+qelly-logo-primary\.svg/);
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

test('market UI normalizes governed unavailable envelopes before rendering',async()=>{
  const app=await read('apps/web/public/assets/app.js');
  assert.match(app,/Array\.isArray\(data\.items\)\?data\.items:\[\]/);
  assert.match(app,/Array\.isArray\(data\.kpis\)\?data\.kpis:/);
  assert.match(app,/data\.providerStatus\?\?\{/);
  assert.match(app,/candles\.source\?\?\{/);
  assert.match(app,/Provider observations remain unavailable/);
});
