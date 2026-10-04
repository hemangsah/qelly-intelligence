import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeMt5ClosedDeals} from '../apps/web/public/assets/qelly-mt5-advanced-metrics.mjs';
import {buildMt5ObservedDiagnostics,renderMt5ObservedDiagnostics} from '../apps/web/public/assets/qelly-mt5-diagnostics.mjs';
import {buildMt5ShareSafePackage} from '../apps/web/public/assets/qelly-mt5-share-safe.mjs';
const validated={mt5:{format:'mt5-html',closingDealsWithMissingCosts:0}};
const report=pnl=>analyzeMt5ClosedDeals(pnl.map((value,i)=>({pnl:value,symbol:'EURUSD',side:'buy',closedAt:'2026.09.'+String(1+i%28).padStart(2,'0')+' 10:00',commission:0,fee:0,swap:0})),validated);
const finding=(a,id)=>buildMt5ObservedDiagnostics(a).findings.find(f=>f.id===id);
test('largest winning close is measured against all winning P&L and exported without private rows',()=>{
 const a=report([-4,10,3,-2,7]);
 assert.equal(a.metrics.grossProfit,20);
 assert.equal(a.metrics.largestWinningDealPnl,10);
 assert.equal(a.metrics.largestProfitContributionPct,50);
 const f=finding(a,'largest-profit-share');
 assert.equal(f.value,50);
 assert.equal(f.sampleCount,3);
 assert.equal(f.state,'LIMITED_SAMPLE');
 assert.match(f.evidence,/partial position exits/);
 const p=buildMt5ShareSafePackage(a);
 assert.equal(p.reportA.metrics.largestProfitContributionPct,50);
 assert.equal(p.diagnosticsA.findings.some(x=>x.id==='largest-profit-share'),true);
 assert.equal(p.privacy.sourceRowsIncluded,false);
});
test('35 closes but one winning close is SMALL_WIN_SET, not a reliable advantage',()=>{
 const a=report([100,...Array(34).fill(-1)]),f=finding(a,'largest-profit-share');
 assert.equal(a.sample.deals,35);
 assert.equal(a.sample.wins,1);
 assert.equal(a.metrics.largestProfitContributionPct,100);
 assert.equal(f.state,'SMALL_WIN_SET');
 assert.match(buildMt5ObservedDiagnostics(a).warnings.join(' '),/not investment returns, future probabilities/);
});
test('all-losing closes withhold profit share and disclose unavailable evidence',()=>{
 const a=report([-2,-4,-1]),d=buildMt5ObservedDiagnostics(a);
 assert.equal(a.metrics.largestWinningDealPnl,null);
 assert.equal(a.metrics.largestProfitContributionPct,null);
 assert.equal(finding(a,'largest-profit-share'),undefined);
 assert.match(d.unavailable.join(' '),/No observed winning closing deal/);
 assert.equal(buildMt5ShareSafePackage(a).reportA.metrics.largestProfitContributionPct,null);
});
test('profit concentration uses all closing deals rather than downsampled chart points',()=>{
 const a=report([100,...Array(200).fill(1)]);
 assert.equal(a.metrics.grossProfit,300);
 assert.equal(a.metrics.largestProfitContributionPct,33.33);
 assert.ok(a.series.points.length<201);
 assert.equal(finding(a,'largest-profit-share').sampleCount,201);
});
test('rendering/export never include private report metadata or hostile account labels',()=>{
 const a=report([-2,10,3]);
 a.account={login:'PRIVATE_ACCOUNT_IDENTIFIER',token:'PRIVATE_TOKEN'};
 a.rawRows=[{ticket:'PRIVATE_TICKET'}];
 const html=renderMt5ObservedDiagnostics(a),exported=JSON.stringify(buildMt5ShareSafePackage(a));
 assert.match(html,/Largest observed single closing-deal profit share/);
 assert.match(html,/partial position exits/);
 for(const secret of ['PRIVATE_ACCOUNT_IDENTIFIER','PRIVATE_TOKEN','PRIVATE_TICKET']){
  assert.equal(html.includes(secret),false);
  assert.equal(exported.includes(secret),false);
 }
});
