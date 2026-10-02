import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeMt5ClosedDeals} from '../apps/web/public/assets/qelly-mt5-advanced-metrics.mjs';
import {compareMt5ClosedDealReports} from '../apps/web/public/assets/qelly-mt5-comparison.mjs';
const build=(n,offset=0)=>analyzeMt5ClosedDeals(Array.from({length:n},(_,i)=>({
 pnl:(i+offset)%4===0?-4:7,side:i%3?'buy':'sell',symbol:i%5?'EURUSD':'GBPUSD',
 closedAt:'2026.09.'+String(1+i%28).padStart(2,'0')+' 10:45'
})),{mt5:{format:'mt5-html',closingDealsWithMissingCosts:0}});
test('two validated reports produce sample-bound dimensionless deltas without cross-currency P&L differences',()=>{
 const r=compareMt5ClosedDealReports(build(40),build(46,1));
 assert.equal(r.schema,'qelly.mt5.closed-deal-comparison/1.0');
 assert.equal(r.comparability.sampleStatus,'OBSERVED_SAMPLES');
 assert.equal(r.comparability.monetaryDeltas,'WITHHELD_UNVERIFIED_CURRENCY');
 assert.equal(r.comparability.pnlUnitsCompatible,false);
 assert.equal(r.dimensions[0].comparisonState,'OBSERVED_SAMPLE_DIFFERENCE');
 assert.ok(typeof r.dimensions[0].delta==='number');
 assert.equal(r.reportA.deals,40);assert.equal(r.reportB.deals,46);
 assert.ok(r.symbols.some(x=>x.symbol==='EURUSD'&&x.reportA?.trades>0&&x.reportB?.trades>0));
 assert.equal(r.privacy.rawFilesRetained,false);assert.equal(r.privacy.sourceRowsIncluded,false);
});
test('tiny and missing-profit-factor samples never receive numeric significance-like differences',()=>{
 const r=compareMt5ClosedDealReports(build(4),build(50));
 assert.equal(r.comparability.sampleStatus,'LIMITED_SAMPLE');
 assert.equal(r.dimensions[0].delta,null);
 assert.match(r.warnings.join(' '),/LIMITED SAMPLE/);
 const noLoss=analyzeMt5ClosedDeals(Array.from({length:31},()=>({pnl:1})),{mt5:{format:'mt5-xlsx'}});
 const s=compareMt5ClosedDealReports(noLoss,build(40));
 assert.equal(s.dimensions[1].delta,null);assert.equal(s.dimensions[1].comparisonState,'UNAVAILABLE');
});
test('report output contains no trade IDs, account identifiers or source rows',()=>{
 const a=build(34),b=build(36);
 a.rawFileContents='PRIVATE_CONTENT_SHOULD_NOT_APPEAR';
 a.account={id:'SENSITIVE_ACCOUNT'};
 const raw=JSON.stringify(compareMt5ClosedDealReports(a,b));
 assert.doesNotMatch(raw,/PRIVATE_CONTENT_SHOULD_NOT_APPEAR|SENSITIVE_ACCOUNT|dealId/);
});
test('unvalidated, malformed and empty reports fail closed',()=>{
 assert.throws(()=>compareMt5ClosedDealReports({},build(40)),/validated MT5/);
 assert.throws(()=>compareMt5ClosedDealReports(build(40),{schema:'qelly.mt5.closed-deals/1.0'}),/validated MT5/);
});
