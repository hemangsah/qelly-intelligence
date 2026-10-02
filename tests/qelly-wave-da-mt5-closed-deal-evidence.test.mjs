import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeMt5ClosedDeals,mt5ReportClock} from '../apps/web/public/assets/qelly-mt5-advanced-metrics.mjs';
const validation={mt5:{format:'mt5-html',closingDealsWithMissingCosts:1}};
const values=[10,-5,3,-7,4,9];
const data=values.map((pnl,i)=>({pnl,side:i%2?'sell':'buy',symbol:i<3?'EURUSD':'GBPUSD',closedAt:'2026.10.'+String(i+1).padStart(2,'0')+' 13:55',commission:i===2?null:-0.25,fee:0,swap:0}));
test('closed deals calculate P&L, drawdown and direction without inventing equity',()=>{
 const v=analyzeMt5ClosedDeals(data,validation);
 assert.equal(v.metrics.netPnl,14);assert.equal(v.metrics.grossProfit,26);assert.equal(v.metrics.grossLoss,12);
 assert.equal(v.metrics.maxClosedDealDrawdown,9);assert.equal(v.metrics.profitFactor,2.1667);
 assert.equal(v.sample.wins,4);assert.equal(v.sample.losses,2);assert.equal(v.sample.grade,'LIMITED SAMPLE');
 assert.deepEqual(v.series.points.map(x=>x.cumulative),[10,5,8,1,5,14]);
 assert.equal(v.metrics.sharpe,null);assert.equal(v.metrics.relativeAccountDrawdown,null);
 assert.equal(v.series.chronological,true);
});
test('subgroup and cost totals have concrete sample counts and missingness',()=>{
 const v=analyzeMt5ClosedDeals(data,validation);
 assert.equal(v.groups.symbol.reduce((s,x)=>s+x.count,0),6);
 assert.equal(v.groups.side.reduce((s,x)=>s+x.count,0),6);
 assert.equal(v.groups.month[0].count,6);assert.equal(v.groups.hour[0].count,6);
 assert.equal(v.costs.commission.coveragePct,83.33);
 assert.equal(v.costs.commission.knownTotal,-1.25);
 assert.match(v.warnings.join(' '),/Entry-side costs/);
});
test('reported wall clock does not infer timezone and rejects invalid dates',()=>{
 assert.equal(mt5ReportClock('2026.02.30 19:00'),null);
 assert.equal(mt5ReportClock('2026.02.28 25:00'),null);
 assert.equal(mt5ReportClock('2026.10.01 13:55')?.hour,13);
 assert.equal(mt5ReportClock('2026-10-01 13:55')?.month,'2026-10');
 const v=analyzeMt5ClosedDeals([{pnl:2,closedAt:'unknown',side:'buy'}],validation);
 assert.equal(v.series.chronological,false);assert.deepEqual(v.groups.weekday,[]);
});
test('unvalidated CSV, empty reports and nonfinite deals fail closed',()=>{
 assert.throws(()=>analyzeMt5ClosedDeals(data,{}),/Validated MT5/);
 assert.throws(()=>analyzeMt5ClosedDeals([],validation),/Validated MT5/);
 assert.throws(()=>analyzeMt5ClosedDeals([{pnl:Infinity}],validation),/Nonfinite/);
 assert.throws(()=>analyzeMt5ClosedDeals([{pnl:'10'}],validation),/Nonfinite/);
});
test('large sequences retain first/last while bounding chart points',()=>{
 const v=analyzeMt5ClosedDeals(Array.from({length:1500},(_,i)=>({pnl:i%2?-1:2})),validation);
 assert.equal(v.sample.deals,1500);assert.ok(v.series.points.length<=170);assert.equal(v.series.points[0].index,1);
 assert.equal(v.series.points.at(-1).index,1500);assert.equal(v.sample.grade,'OBSERVED SAMPLE');
});
test('no losses or unknown costs are represented as unavailable, not fake zero ratios',()=>{
 const v=analyzeMt5ClosedDeals([{pnl:5},{pnl:6},{pnl:7}],validation);
 assert.equal(v.metrics.profitFactor,null);assert.equal(v.costs.commission.knownTotal,null);
 assert.equal(v.costs.swap.coveragePct,0);assert.equal(v.metrics.maxClosedDealDrawdown,0);
 assert.equal(v.metrics.recoveryFactor,null);
});

test('statistical output never implies predictive certainty and skips small samples',()=>{
 const v=analyzeMt5ClosedDeals(data,validation);assert.equal(v.statisticalEvidence.bootstrapMean95,null);assert.match(v.statisticalEvidence.status,/INSUFFICIENT/);
});
