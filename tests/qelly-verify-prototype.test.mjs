import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {analyzeTrades,parseTradeCsv,sampleTradeCsv,__qellyVerifyTest} from '../apps/web/public/assets/qelly-verify-engine.mjs';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Qelly Verify parses the governed sample and maps its P&L evidence',()=>{
  const parsed=parseTradeCsv(sampleTradeCsv());
  assert.equal(parsed.trades.length,80);
  assert.equal(parsed.validation.invalidRows,0);
  assert.equal(parsed.validation.detectedPnlColumn,'net_profit');
  assert.equal(parsed.validation.detectedFields.symbol,'symbol');
  assert.equal(parsed.validation.detectedFields.side,'side');
});

test('Qelly Verify rejects files without usable trade evidence',()=>{
  assert.throws(()=>parseTradeCsv('date,symbol\n2026-01-01,BTC'),error=>error?.code==='verify_pnl_column_missing');
  assert.throws(()=>parseTradeCsv('pnl\nnot-a-number'),error=>error?.code==='verify_no_valid_trades');
  assert.throws(()=>analyzeTrades([{pnl:1},{pnl:-1}]),error=>error?.code==='verify_sample_too_small');
});

test('strategy report is bounded, deterministic and explicitly non-predictive',()=>{
  const parsed=parseTradeCsv(sampleTradeCsv());
  const first=analyzeTrades(parsed.trades,{sourceName:'sample.csv'});
  const second=analyzeTrades(parsed.trades,{sourceName:'sample.csv'});
  const withoutTime=report=>({...report,generatedAt:null});
  assert.deepEqual(withoutTime(first),withoutTime(second));
  for(const score of Object.values(first.scores))assert.ok(score.value>=0&&score.value<=100);
  assert.ok(first.allocation.constrainedFractionalKellyLow>=0);
  assert.ok(first.allocation.constrainedFractionalKellyHigh<=5);
  assert.ok(first.stress.iterations===500);
  assert.match(first.truthState,/DETERMINISTIC LOCAL ANALYSIS/);
  assert.match(first.limitations.join(' '),/not calibrated probabilities|not a personalized/i);
});

test('CSV parser handles quoted values, semicolon decimals and accounting negatives',()=>{
  const parsed=parseTradeCsv('ticket;profit;symbol\n1;"12,50";BTCUSD\n2;"(7,25)";ETHUSD\n3;4;SOLUSD\n4;-2;XRPUSD\n5;1;BNBUSD');
  assert.deepEqual(parsed.trades.map(trade=>trade.pnl),[12.5,-7.25,4,-2,1]);
  assert.equal(parsed.validation.delimiter,';');
  assert.equal(__qellyVerifyTest.maxDrawdown(parsed.trades.map(trade=>trade.pnl)),7.25);
});

test('Qelly Verify product is local-only and preserves the evidence-first boundary',async()=>{
  const source=await read('apps/web/public/assets/qelly-verify-product.mjs');
  for(const phrase of ['Put your strategy through evidence, not belief','Upload','Validate','Analyze','Decide','No live AI model','order execution','personalized financial recommendation'])assert.match(source,new RegExp(phrase,'i'));
  assert.match(source,/MAX_FILE_BYTES=5\*1024\*1024/);
  assert.match(source,/data-verify-export/);
  assert.match(source,/local-only prototype/i);
  assert.doesNotMatch(source,/fetch\s*\(/);
  assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(source,/placeOrder|executeTrade|wallet\.sign/i);
});

test('homepage and shell load Qelly Verify after existing runtime protections',async()=>{
  const index=await read('apps/web/public/index.html');
  assert.match(index,/qelly-verify\.css/);
  assert.match(index,/qelly-verify-product\.mjs/);
  assert.ok(index.indexOf('qelly-verify-product.mjs')>index.indexOf('qelly-public-recovery.mjs'));
  const source=await read('apps/web/public/assets/qelly-verify-product.mjs');
  assert.match(source,/Quantitative intelligence for disciplined market decisions/);
  assert.match(source,/Analyze a strategy/);
  assert.match(source,/Request a demo/);
  assert.match(source,/Validate the edge/);
  assert.match(source,/Constrained Kelly research range/);
});

test('service worker cache follows release identity and refreshes executable assets from network',async()=>{
  const source=await read('apps/web/public/prompt2c-sw.js');
  assert.match(source,/CACHE_PREFIX='qelly-public-beta-'/);
  assert.match(source,/qelly-release\.json/);
  assert.match(source,/qelly-verify-engine\.mjs/);
  assert.match(source,/qelly-verify-product\.mjs/);
  assert.match(source,/\['script','style','manifest'\]/);
  assert.match(source,/networkFirst\(request\)/);
  assert.doesNotMatch(source,/const CACHE='qelly-public-beta-v1'/);
});
