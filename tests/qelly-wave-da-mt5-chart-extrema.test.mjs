import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeMt5ClosedDeals} from '../apps/web/public/assets/qelly-mt5-advanced-metrics.mjs';
import {renderMt5ClosedDealEvidence} from '../apps/web/public/assets/qelly-mt5-visuals.mjs';
const analyze=values=>analyzeMt5ClosedDeals(values.map(pnl=>({pnl})),{mt5:{}});
test('sampled curves preserve a short loss/recovery hidden between stride points',()=>{
 const report=analyze(Array.from({length:1000},(_,i)=>i===50?-100:i===51?100:0));
 assert.equal(report.metrics.maxClosedDealDrawdown,100);
 assert.equal(Math.max(...report.series.points.map(p=>p.drawdown)),100);
 assert.ok(report.series.points.some(p=>p.index===51&&p.cumulative===-100));
 assert.ok(report.series.points.some(p=>p.index===52&&p.cumulative===0));
 const html=renderMt5ClosedDealEvidence(report);
 assert.match(html,/L63\.03 188\.00/); // close 51 of 1,000, not its sampled array position
 assert.match(html,/Horizontal spacing follows closing-deal positions, not elapsed time/);
});
test('global positive/negative extrema and the peak preceding worst drawdown stay plotted',()=>{
 const values=Array(1000).fill(0);values[50]=200;values[51]=-350;values[52]=200;
 const report=analyze(values);
 for(const [index,cumulative] of [[51,200],[52,-150],[53,50]])assert.ok(report.series.points.some(p=>p.index===index&&p.cumulative===cumulative));
 assert.equal(Math.max(...report.series.points.map(p=>p.drawdown)),350);
 assert.equal(report.metrics.netPnl,50);
});
test('large curves stay bounded, ordered, unique and retain endpoints without changing metrics',()=>{
 const values=Array.from({length:100000},(_,i)=>i===513?100:i===514?-200:i===515?100:0);
 const report=analyze(values),points=report.series.points;
 assert.ok(points.length<=174);assert.equal(points[0].index,1);assert.equal(points.at(-1).index,100000);
 assert.equal(new Set(points.map(p=>p.index)).size,points.length);
 assert.ok(points.every((p,i)=>!i||p.index>points[i-1].index));
 assert.equal(report.metrics.netPnl,0);assert.equal(Math.max(...points.map(p=>p.drawdown)),report.metrics.maxClosedDealDrawdown);
 const single=analyze([5]);assert.deepEqual(single.series.points,[{index:1,cumulative:5,drawdown:0}]);
});
