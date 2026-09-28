import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionIntelligence} from '../functions/api/v1/decision-proven-graph.js';
import {__tradingViewDisplayTest} from '../apps/web/public/assets/market/tradingview-display-widget.mjs';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
const DAY=86_400_000;

test('Wave CJ rejects SSRF-shaped and unsupported Decision assets before provider fetch',async()=>{
  let fetchCalls=0;
  const env={__fetch:async()=>{fetchCalls+=1;throw new Error('provider fetch must not run');}};
  await assert.rejects(
    ()=>buildDecisionIntelligence(env,{asset:'https://169.254.169.254/latest/meta-data',interval:'15m',horizon:'4h'}),
    error=>error?.code==='unsupported_asset'&&error?.status===400
  );
  await assert.rejects(
    ()=>buildDecisionIntelligence(env,{asset:'../../etc/passwd',interval:'15m',horizon:'4h'}),
    error=>error?.code==='unsupported_asset'&&error?.status===400
  );
  assert.equal(fetchCalls,0);
});

test('Wave CJ rejects oversized or malformed selected ranges before provider fetch',async()=>{
  let fetchCalls=0;
  const env={__fetch:async()=>{fetchCalls+=1;throw new Error('provider fetch must not run');}};
  await assert.rejects(
    ()=>buildDecisionIntelligence(env,{asset:'BTC',interval:'15m',horizon:'4h',selection:{start:1,end:1+90*DAY+1}}),
    error=>error?.code==='invalid_selection'&&error?.status===400
  );
  await assert.rejects(
    ()=>buildDecisionIntelligence(env,{asset:'BTC',interval:'15m',horizon:'4h',selection:{start:100,end:100}}),
    error=>error?.code==='invalid_selection'&&error?.status===400
  );
  assert.equal(fetchCalls,0);
});

test('Wave CJ hardens TradingView outbound links to the official HTTPS origin',()=>{
  const {TRADINGVIEW_OPEN_ORIGIN,safeTradingViewOpenUrl}=__tradingViewDisplayTest;
  const fallback=TRADINGVIEW_OPEN_ORIGIN+'/markets/';
  assert.equal(safeTradingViewOpenUrl('https://www.tradingview.com/chart/?symbol=BINANCE%3ABTCUSDT'),'https://www.tradingview.com/chart/?symbol=BINANCE%3ABTCUSDT');
  for(const hostile of [
    'javascript:alert(1)',
    'http://www.tradingview.com/markets/',
    'https://www.tradingview.com.evil.example/markets/',
    'https://evil.example/?next=https://www.tradingview.com',
    '"><img src=x onerror=alert(1)>',
    '//evil.example/path'
  ])assert.equal(safeTradingViewOpenUrl(hostile),fallback);
});

test('Wave CJ retains explicit API rate-abuse and bounded-range controls',async()=>{
  const [decision,range,scan]=await Promise.all([
    read('functions/api/v1/decision-proven-graph.js'),
    read('functions/api/v1/decision-range-evidence.js'),
    read('functions/api/v1/decision-scan.js')
  ]);
  assert.match(decision,/enforceRateLimit\(env,'decision-proven-graph:'\+ip\(request\),\{limit:30,windowMs:60_000\}\)/);
  assert.match(range,/enforceRateLimit\(env,'decision-range-evidence:'\+ip\(request\),\{limit:12,windowMs:60_000\}\)/);
  assert.match(scan,/enforceRateLimit\(env,'decision-scan:'\+ip\(request\),\{limit:6,windowMs:60_000\}\)/);
  assert.match(range,/const MAX_RANGE_MS=90\*86_400_000/);
  assert.match(range,/end-start>MAX_RANGE_MS/);
  assert.match(range,/future_range/);
  assert.match(range,/unsupported_asset/);
  assert.match(range,/invalid_range/);
});

test('Wave CJ malicious news HTML remains text and never becomes executable Decision markup',async()=>{
  const [route,e2e]=await Promise.all([
    read('apps/web/public/assets/routes/decision-proven-graph.mjs'),
    read('scripts/qelly-decision-range-selection-e2e.mjs')
  ]);
  assert.match(e2e,/Bitcoin <img src=x onerror=alert\(1\)> ETF inflow update during selected move/);
  assert.match(route,/escapeHtml\(rep\.title\|\|'Headline'\)/);
  assert.match(route,/escapeHtml\(item\.title\)/);
  assert.match(route,/escapeHtml\(item\.url\)/);
  assert.doesNotMatch(route,/innerHTML\s*=\s*item\.title/);
});

test('Wave CJ preserves no-crash degradation for provider failures and aborted range requests',async()=>{
  const [failure,route]=await Promise.all([
    read('tests/qelly-scientific-wave-bo-failure-injection.test.mjs'),
    read('apps/web/public/assets/routes/decision-proven-graph.mjs')
  ]);
  for(const marker of [
    /critical candle timeout fails closed/,
    /optional derivatives, liquidity and funding failures degrade/,
    /news provider failure uses only a bounded stale cache/,
    /macro failure remains unavailable reference context/,
    /scanner tolerates one failed asset/
  ])assert.match(failure,marker);
  assert.match(route,/rangeEvidenceController\?\.abort\(\)/);
  assert.match(route,/state\.rangeEvidenceRequest\+=1/);
  assert.match(route,/if\(requestId!==state\.rangeEvidenceRequest\|\|selectionKey\(state\.selection\)!==key\|\|!state\.data\)return false/);
});

test('Wave CJ preserves CSP and embed isolation boundaries',async()=>{
  const [headers,widget]=await Promise.all([
    read('apps/web/public/_headers'),
    read('apps/web/public/assets/market/tradingview-display-widget.mjs')
  ]);
  assert.match(headers,/frame-ancestors 'none'/);
  assert.match(headers,/object-src 'none'/);
  assert.match(headers,/base-uri 'none'/);
  assert.doesNotMatch(headers,/script-src[^\n;]*'unsafe-eval'/);
  assert.match(widget,/TRADINGVIEW_OPEN_ORIGIN='https:\/\/www\.tradingview\.com'/);
  assert.match(widget,/url\.protocol==='https:'&&url\.origin===TRADINGVIEW_OPEN_ORIGIN/);
  assert.match(widget,/noopener noreferrer nofollow/);
});
