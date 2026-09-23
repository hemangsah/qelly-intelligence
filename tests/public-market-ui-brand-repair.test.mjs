import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('governed public market contract is explicit no-fabrication and non-executable',async()=>{
  const dedicated=await read('functions/api/v1/public/markets/[[route]].js');
  assert.match(dedicated,/MARKET_UNAVAILABLE_REASON/);
  assert.match(dedicated,/does not generate substitute prices or candles/i);
  assert.match(dedicated,/fabricatedObservations:false/);
  assert.match(dedicated,/HYPERLIQUID_URL='https:\/\/api\.hyperliquid\.xyz\/info'/);
  assert.match(dedicated,/fabricatedFallback:false/);
  assert.match(dedicated,/LIVE_INTERVALS=new Set\(\['15m','1h','4h','1d'\]\)/);
  assert.match(dedicated,/execution:false/);
  assert.doesNotMatch(dedicated,/simulated-demo|qelly-governed-demo|qelly-fixture|Math\.sin|Math\.cos/);
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

test('authoritative app route renders market recovery without a second global owner',async()=>{
  const [recovery,app]=await Promise.all([
    read('apps/web/public/assets/qelly-public-recovery.mjs'),
    read('apps/web/public/assets/app.js')
  ]);
  assert.match(recovery,/export function publicRecoveryMarkup/);
  assert.match(recovery,/if\(current==='market'\)/);
  assert.match(recovery,/q-recovery-page q-market-recovery/);
  assert.match(recovery,/This research page is public and does not require sign-in/);
  assert.match(app,/else if\(isPublicRecoveryRoute\(route\)\)/);
  assert.match(app,/main\.innerHTML=publicRecoveryMarkup\(route,error\.message,\{preview:staticVisualPreview\}\)/);
  assert.doesNotMatch(recovery,/MutationObserver|main\.innerHTML|qellyRecoveryOwner|location\.hash='#\/market\?view=decision-maker'/);
});

test('canonical market UI keeps unavailable provider states explicit without substitute observations',async()=>{
  const market=await read('apps/web/public/assets/routes/market-v6.mjs');
  assert.match(market,/const ecb=await api\('\/api\/v1\/providers\/ecb\?capability=fx-reference-rates&symbol=EUR'\)\.catch\(\(\)=>null\)/);
  assert.match(market,/No approved reference observations were returned\. Qelly will not substitute generated values\./);
  assert.match(market,/api\('\/api\/v1\/market\/network'\)\.then/);
  assert.match(market,/populateNetworkSections\(marketRoot,\{sources:\{\},providerDirectory:\[\],providerDirectorySummary:\{byIntegration:\{\}\}\},escapeHtml\)/);
  assert.doesNotMatch(market,/Math\.sin|Math\.cos|simulated-demo|qelly-governed-demo/);
});

test('shared chart shell renders an explicit empty state instead of dereferencing a missing latest point',async()=>{
  const chart=await read('packages/charting/chart-shell.mjs');
  assert.match(chart,/if\(!visible\.length\)/);
  assert.match(chart,/No governed observations are available/);
  assert.match(chart,/q-chart-shell--empty/);
  assert.match(chart,/return;/);
});
