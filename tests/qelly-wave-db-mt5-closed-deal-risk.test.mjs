import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeMt5ClosedDeals} from '../apps/web/public/assets/qelly-mt5-advanced-metrics.mjs';
import {buildMt5ObservedDiagnostics,renderMt5ObservedDiagnostics} from '../apps/web/public/assets/qelly-mt5-diagnostics.mjs';
import {buildMt5ShareSafePackage} from '../apps/web/public/assets/qelly-mt5-share-safe.mjs';

const valid={mt5:{format:'mt5-html',closingDealsWithMissingCosts:0}};
const report=(pnl,times=pnl.map((_,i)=>'2026.09.'+String(i+1).padStart(2,'0')+' 09:30'))=>
 analyzeMt5ClosedDeals(pnl.map((value,i)=>({
  pnl:value,symbol:i%2?'EURUSD':'GBPUSD',side:i%2?'buy':'sell',
  closedAt:times[i],commission:-0.2,fee:0,swap:0
 })),valid);
const finding=(d,id)=>d.findings.find(item=>item.id===id);

test('concentrated observed losses and strictly ordered underwater span are derived from all closing deals',()=>{
 const a=report([-5,1,-3,2,10,-2]);
 assert.equal(a.metrics.grossLoss,10);
 assert.equal(a.metrics.largestLosingDealPnl,-5);
 assert.equal(a.metrics.largestLossContributionPct,50);
 assert.equal(a.metrics.maxClosedDealDrawdown,7);
 assert.equal(a.metrics.longestUnderwaterClosingDeals,4);
 assert.equal(a.series.chronological,true);
 assert.equal(a.series.uniqueChronological,true);
 const d=buildMt5ObservedDiagnostics(a);
 const loss=finding(d,'largest-loss-share'),span=finding(d,'longest-underwater-deals');
 assert.equal(loss.value,50);
 assert.equal(loss.sampleCount,3);
 assert.equal(loss.state,'LIMITED_SAMPLE');
 assert.match(loss.evidence,/partial position exits/);
 assert.equal(span.value,4);
 assert.equal(span.sampleCount,6);
 assert.match(span.units,/not elapsed time/);
 assert.match(span.evidence,/not the downsampled chart/);
 assert.match(d.warnings.join(' '),/not future loss probabilities/);
 const pack=buildMt5ShareSafePackage(a);
 assert.equal(pack.reportA.metrics.largestLossContributionPct,50);
 assert.equal(pack.reportA.metrics.longestUnderwaterClosingDeals,4);
 assert.equal(pack.reportA.series.uniqueChronological,true);
 assert.equal(pack.diagnosticsA.findings.some(item=>item.id==='largest-loss-share'),true);
 assert.equal(pack.privacy.sourceRowsIncluded,false);
});
test('missing or tied report clocks withhold underwater span even when row-order drawdown exists',()=>{
 const p=[-5,1,-3,2,10,-2];
 for(const times of [
  ['2026.09.01 09:30','2026.09.01 09:30','2026.09.03 09:30','2026.09.04 09:30','2026.09.05 09:30','2026.09.06 09:30'],
  ['2026.09.02 09:30','2026.09.01 09:30','2026.09.03 09:30','2026.09.04 09:30','2026.09.05 09:30','2026.09.06 09:30'],
  [null,'2026.09.02 09:30','2026.09.03 09:30','2026.09.04 09:30','2026.09.05 09:30','2026.09.06 09:30']
 ]){
  const a=report(p,times),d=buildMt5ObservedDiagnostics(a);
  assert.equal(a.series.uniqueChronological,false);
  assert.equal(a.metrics.longestUnderwaterClosingDeals,null);
  assert.equal(finding(d,'longest-underwater-deals'),undefined);
  assert.match(d.unavailable.join(' '),/strictly increasing, unambiguous broker report-clock sequence is unavailable/);
  assert.equal(a.metrics.largestLossContributionPct,50);
 }
});
test('no losing closes never fabricates a loss contribution or adverse-trade diagnostic',()=>{
 const a=report([2,3,1,5,2,4]),d=buildMt5ObservedDiagnostics(a);
 assert.equal(a.metrics.grossLoss,0);
 assert.equal(a.metrics.largestLosingDealPnl,null);
 assert.equal(a.metrics.largestLossContributionPct,null);
 assert.equal(a.metrics.longestUnderwaterClosingDeals,0);
 assert.equal(finding(d,'largest-loss-share'),undefined);
 assert.equal(finding(d,'longest-underwater-deals'),undefined);
 assert.match(d.unavailable.join(' '),/No observed losing closing deal/);
});
test('even with 30+ total closes, fewer than five losing deals remain a small loss set',()=>{
 const pnl=[-40,...Array(34).fill(2)],times=pnl.map((_,i)=>'2026.09.'+String(1+i%28).padStart(2,'0')+' 09:30');
 const a=report(pnl,times),d=buildMt5ObservedDiagnostics(a);
 assert.equal(a.sample.deals,35);
 assert.equal(a.metrics.largestLossContributionPct,100);
 const f=finding(d,'largest-loss-share');
 assert.equal(f.sampleCount,1);
 assert.equal(f.state,'SMALL_LOSS_SET');
 assert.equal(a.metrics.longestUnderwaterClosingDeals,null);
 assert.equal(finding(d,'longest-underwater-deals'),undefined);
 assert.doesNotMatch(d.warnings.join(' '),/future losses are certain/i);
});
test('risk receipt renders without private account metadata or unsupported broker-equity attribution',()=>{
 const a=report([-5,1,-3,2,10,-2]);
 a.account={login:'PRIVATE_BROKER_LOGIN',password:'PRIVATE_PASSWORD'};
 a.rawRows=[{ticket:'PRIVATE_TICKET'}];
 const receipt=renderMt5ObservedDiagnostics(a),json=JSON.stringify(buildMt5ShareSafePackage(a));
 assert.match(receipt,/Largest observed single closing-deal loss share/);
 assert.match(receipt,/Longest closing-deal sequence/);
 assert.match(receipt,/account-equity drawdown/);
 for(const secret of ['PRIVATE_BROKER_LOGIN','PRIVATE_PASSWORD','PRIVATE_TICKET']){
  assert.ok(!receipt.includes(secret));
  assert.ok(!json.includes(secret));
 }
});
