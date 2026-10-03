import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeMt5ClosedDeals} from '../apps/web/public/assets/qelly-mt5-advanced-metrics.mjs';
import {compareMt5ClosedDealReports} from '../apps/web/public/assets/qelly-mt5-comparison.mjs';
import {renderMt5Comparison} from '../apps/web/public/assets/qelly-mt5-comparison-ui.mjs';
import {buildMt5ShareSafePackage} from '../apps/web/public/assets/qelly-mt5-share-safe.mjs';
import {buildMt5LocalResearchNote} from '../apps/web/public/assets/qelly-mt5-research-note.mjs';
const validation={mt5:{format:'mt5-html',closingDealsWithMissingCosts:0}};
const report=pnls=>analyzeMt5ClosedDeals(pnls.map((pnl,i)=>({
 pnl,closedAt:'2026.09.'+String(1+i%28).padStart(2,'0')+' 10:30',
 symbol:'EURUSD',side:i%2?'buy':'sell',commission:0,fee:0,swap:0
})),validation);
test('comparative single-close shares are source-derived with no numeric differences or rank',()=>{
 const c=compareMt5ClosedDealReports(report([-5,10,5,-5,5]),report([-20,20,10,-10,10]));
 assert.equal(c.reportA.profitConcentration.pct,50);
 assert.equal(c.reportB.profitConcentration.pct,50);
 assert.equal(c.reportA.lossConcentration.pct,50);
 assert.equal(c.reportB.lossConcentration.pct,66.67);
 assert.equal(c.reportA.profitConcentration.closes,3);
 assert.equal(c.reportB.lossConcentration.closes,2);
 assert.equal(c.reportA.profitConcentration.state,'LIMITED_SAMPLE');
 assert.equal(c.dimensions.find(d=>d.label==='Largest winning close share (%)').delta,null);
 const loss=c.dimensions.find(d=>d.label==='Largest losing close share (%)');
 assert.equal(loss.comparisonState,'SIDE_BY_SIDE_ONLY');
 assert.equal(loss.delta,null);
 assert.match(loss.interpretation,/Distinct denominators/);
 assert.equal(c.comparability.monetaryDeltas,'WITHHELD_UNVERIFIED_CURRENCY');
});
test('large report with one winner identifies small win set independently of total closes',()=>{
 const a=report([100,...Array(34).fill(-1)]);
 const b=report(Array(36).fill(3));
 const c=compareMt5ClosedDealReports(a,b);
 assert.equal(c.reportA.profitConcentration.state,'SMALL_WIN_SET');
 assert.equal(c.reportA.profitConcentration.closes,1);
 assert.equal(c.reportA.profitConcentration.pct,100);
 assert.equal(c.reportB.lossConcentration.state,'UNAVAILABLE');
 assert.equal(c.reportB.lossConcentration.pct,null);
 assert.equal(c.dimensions.find(d=>d.label==='Largest losing close share (%)').comparisonState,'UNAVAILABLE');
 assert.equal(c.dimensions.find(d=>d.label==='Largest winning close share (%)').delta,null);
});
test('single-sided reports withhold absent winning or losing shares',()=>{
 const c=compareMt5ClosedDealReports(report([-1,-2,-3]),report([1,2,3]));
 assert.deepEqual(c.reportA.profitConcentration,{pct:null,closes:0,state:'UNAVAILABLE'});
 assert.deepEqual(c.reportB.lossConcentration,{pct:null,closes:0,state:'UNAVAILABLE'});
 assert.equal(c.dimensions.find(d=>d.label==='Largest winning close share (%)').delta,null);
 assert.equal(c.dimensions.find(d=>d.label==='Largest losing close share (%)').delta,null);
});
test('local comparison UI prints per-report states and never converts shares to rankings or returns',()=>{
 const a=report([100,...Array(34).fill(-1)]),b=report(Array(36).fill(3));
 a.account={login:'PRIVATE_ACCOUNT',token:'PRIVATE_TOKEN'};
 a.rawRows=[{ticket:'PRIVATE_TICKET'}];
 const c=compareMt5ClosedDealReports(a,b);
 const html=renderMt5Comparison(c,{nameA:'<script>HOSTILE</script>',nameB:'sample.xlsx'});
 assert.match(html,/Largest winning close share \(%\)/);
 assert.match(html,/Largest losing close share \(%\)/);
 assert.match(html,/Not comparable \(distinct denominators\)/);
 assert.match(html,/SMALL_WIN_SET across 1 winning closes/);
 assert.match(html,/UNAVAILABLE across 0 losing closes/);
 assert.match(html,/not return on capital, matched-position risk or forecasts/);
 assert.match(html,/&lt;script&gt;HOSTILE&lt;\/script&gt;/);
 for(const secret of ['PRIVATE_ACCOUNT','PRIVATE_TOKEN','PRIVATE_TICKET'])assert.ok(!html.includes(secret));
 assert.doesNotMatch(html,/strategy winner|predicted return/i);
});
test('aggregate JSON and local research note include side-by-side only, with privacy and no unsupported deltas',()=>{
 const a=report([-5,10,5,-5,5]),b=report([-20,20,10,-10,10]);
 a.account={id:'SECRET_ACCOUNT_A'};
 b.account={id:'SECRET_ACCOUNT_B'};
 const json=JSON.stringify(buildMt5ShareSafePackage(a,b));
 const markdown=buildMt5LocalResearchNote(a,b);
 assert.match(json,/"profitConcentration"/);
 assert.match(json,/"lossConcentration"/);
 assert.match(json,/"comparisonState":"SIDE_BY_SIDE_ONLY"/);
 assert.match(markdown,/Largest winning close share \(%\)/);
 assert.match(markdown,/Largest losing close share \(%\)/);
 assert.match(markdown,/Not comparable \(distinct denominators\)/);
 assert.doesNotMatch(json+markdown,/SECRET_ACCOUNT_A|SECRET_ACCOUNT_B/);
 assert.doesNotMatch(markdown,/Observed difference.*Largest winning close/);
});
test('unvalidated report and corrupted gross loss evidence fail closed',()=>{
 const a=report([-1,4,2]),b=report([-2,3,3]);
 a.metrics.grossLoss=Infinity;
 assert.throws(()=>compareMt5ClosedDealReports(a,b),/Validated normalized MT5/);
 assert.throws(()=>compareMt5ClosedDealReports({},b),/validated MT5/);
});
