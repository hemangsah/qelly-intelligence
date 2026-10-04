import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeMt5ClosedDeals} from '../apps/web/public/assets/qelly-mt5-advanced-metrics.mjs';
import {renderMt5ClosedDealEvidence} from '../apps/web/public/assets/qelly-mt5-visuals.mjs';
import {buildMt5ShareSafePackage} from '../apps/web/public/assets/qelly-mt5-share-safe.mjs';
import {buildMt5LocalResearchNote} from '../apps/web/public/assets/qelly-mt5-research-note.mjs';
const validation={mt5:{format:'mt5-html',closingDealsWithMissingCosts:0}};
const report=(pnls)=>analyzeMt5ClosedDeals(pnls.map((pnl,i)=>({pnl,closedAt:'2026.09.'+String(1+i%28).padStart(2,'0')+' 09:00',symbol:'EURUSD',side:'buy',commission:0,swap:0,fee:0})),validation);
test('observed winning and losing close averages and payoff match fixture arithmetic',()=>{
 const r=report([10,-5,3,-7,4,9]);
 assert.equal(r.metrics.netPnl,14);
 assert.equal(r.metrics.grossProfit,26);
 assert.equal(r.metrics.grossLoss,12);
 assert.equal(r.metrics.averageWinningClose,6.5);
 assert.equal(r.metrics.averageLosingClose,6);
 assert.equal(r.metrics.payoffRatio,1.0833);
 assert.equal(r.metrics.winRatePct,66.67);
 assert.equal(r.metrics.lossRatePct,33.33);
 assert.equal(r.sample.wins,4);assert.equal(r.sample.losses,2);
});
test('all-winning sample has no fabricated average losing close or infinite payoff',()=>{
 const r=report([2,4,9]);
 assert.equal(r.metrics.averageWinningClose,5);
 assert.equal(r.metrics.averageLosingClose,null);
 assert.equal(r.metrics.payoffRatio,null);
 assert.equal(r.metrics.lossRatePct,0);
 assert.match(r.warnings.join(' '),/Missing positive or negative closing-deal evidence/);
 assert.doesNotMatch(JSON.stringify(r.metrics),/Infinity|NaN/);
});
test('all-losing sample has no fabricated win size or payoff',()=>{
 const r=report([-2,-4,-9]);
 assert.equal(r.metrics.averageWinningClose,null);
 assert.equal(r.metrics.averageLosingClose,5);
 assert.equal(r.metrics.payoffRatio,null);
 assert.equal(r.metrics.lossRatePct,100);
 assert.equal(r.metrics.winRatePct,0);
});
test('flat closing deals count in rate denominator but not win/loss cohort means',()=>{
 const r=report([0,5,-5,0]);
 assert.equal(r.sample.flat,2);
 assert.equal(r.metrics.winRatePct,25);
 assert.equal(r.metrics.lossRatePct,25);
 assert.equal(r.metrics.averageWinningClose,5);
 assert.equal(r.metrics.averageLosingClose,5);
 assert.equal(r.metrics.payoffRatio,1);
});
test('browser UI, share-safe receipt and Markdown note expose same observed payoff figures with no account leakage',()=>{
 const r=report([10,-5,3,-7,4,9]);
 r.account={login:'PRIVATE_BROKER_ID',password:'PRIVATE_SECRET'};
 r.rawRows=[{ticket:'PRIVATE_TRADE_TICKET'}];
 const ui=renderMt5ClosedDealEvidence(r,{id:'payoff-test'});
 const json=JSON.stringify(buildMt5ShareSafePackage(r));
 const note=buildMt5LocalResearchNote(r);
 for(const label of ['Observed win rate','Observed loss rate','Average winning close','Average losing close','Payoff ratio'])assert.match(ui,new RegExp(label));
 for(const key of ['lossRatePct','averageWinningClose','averageLosingClose','payoffRatio'])assert.match(json,new RegExp('"'+key+'"'));
 assert.match(note,/Average losing close \(absolute\)/);
 assert.match(note,/Payoff ratio \(average win \/ absolute average loss\)/);
 assert.match(note,/missing denominators yield Unavailable/i);
 for(const secret of ['PRIVATE_BROKER_ID','PRIVATE_SECRET','PRIVATE_TRADE_TICKET']){
  assert.ok(!ui.includes(secret));assert.ok(!json.includes(secret));assert.ok(!note.includes(secret));
 }
});
test('no winner is shown as Not available rather than a fake 0 payoff',()=>{
 const r=report([-3,-7]);
 const html=renderMt5ClosedDealEvidence(r);
 assert.match(html,/Payoff ratio<\/span><strong>Not available/);
 assert.match(buildMt5LocalResearchNote(r),/Payoff ratio.*Unavailable/);
});
test('source validation retains strict finite-number and validated-input boundaries',()=>{
 assert.throws(()=>analyzeMt5ClosedDeals([{pnl:NaN}],validation),/Nonfinite/);
 assert.throws(()=>analyzeMt5ClosedDeals([{pnl:'10'}],validation),/Nonfinite/);
 assert.throws(()=>analyzeMt5ClosedDeals([{pnl:5}],{}),/Validated MT5/);
});
