import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeMt5ClosedDeals} from '../apps/web/public/assets/qelly-mt5-advanced-metrics.mjs';
import {buildMt5ChatDraft} from '../apps/web/public/assets/qelly-mt5-share-safe.mjs';
const validation={mt5:{format:'mt5-html',closingDealsWithMissingCosts:0}};
const report=(values)=>analyzeMt5ClosedDeals(values.map((pnl,i)=>({
 pnl,symbol:i%2?'EURUSD':'GBPUSD',side:i%2?'buy':'sell',
 closedAt:'2026.09.'+String(1+i%28).padStart(2,'0')+' 09:30',
 commission:0,swap:0,fee:0
})),validation);
test('Chat receives profit and loss shares from verified aggregate closing-deal evidence only',()=>{
 const a=report([-5,10,5,-5,5]);
 a.account={login:'PRIVATE_ACCOUNT',token:'PRIVATE_TOKEN'};
 a.rawRows=[{ticket:'PRIVATE_TICKET'}];
 const draft=buildMt5ChatDraft(a);
 assert.match(draft,/Largest winning close: 50% of observed gross winning closing-deal P&L across 3 winning closes/);
 assert.match(draft,/Largest losing close: 50% of observed gross losing closing-deal P&L across 2 losing closes/);
 assert.match(draft,/limited sample/);
 assert.match(draft,/not position-level risk, return on capital or a forecast/);
 assert.match(draft,/No raw trade rows, tickets, filenames or broker account identifiers were shared/);
 assert.ok(draft.length<=2200);
 for(const secret of ['PRIVATE_ACCOUNT','PRIVATE_TOKEN','PRIVATE_TICKET'])assert.ok(!draft.includes(secret));
});
test('absent winning and losing closes have explicit unavailable states without fabricated shares',()=>{
 const loss=buildMt5ChatDraft(report([-3,-2,-1]));
 assert.match(loss,/Largest winning close share unavailable: no observed winning closes/);
 assert.doesNotMatch(loss,/Largest winning close: 0%/);
 const win=buildMt5ChatDraft(report([3,2,1]));
 assert.match(win,/Largest losing close share unavailable: no observed losing closes/);
 assert.doesNotMatch(win,/Largest losing close: 0%/);
});
test('35 closes but one winner carries a SMALL WIN SET warning to Chat',()=>{
 const draft=buildMt5ChatDraft(report([100,...Array(34).fill(-1)]));
 assert.match(draft,/Largest winning close: 100%/);
 assert.match(draft,/small win set/);
 assert.doesNotMatch(draft,/a strategy advantage|predicted success/i);
});
test('dense dual-report evidence remains under governed prompt size and does not leak hostile labels',()=>{
 const a=report(Array.from({length:40},(_,i)=>i%3===0?-9:3));
 const b=report(Array.from({length:41},(_,i)=>i%4===0?-8:4));
 for(const r of [a,b]){
  r.account={id:'SECRET_ACCOUNT_ID'};
  r.groups.symbol=[{key:'MALICIOUS@EXAMPLE.COM',count:20,net:-90,wins:2,losses:18,winRatePct:10}];
  r.groups.side=[{key:'buy',count:20,net:-95,wins:1,losses:19,winRatePct:5}];
  r.groups.hour=[{key:'9',count:20,net:-100,wins:1,losses:19,winRatePct:5}];
 }
 const draft=buildMt5ChatDraft(a,b);
 assert.ok(draft.length<=2200,'governed Chat draft length');
 assert.match(draft,/Report A/);assert.match(draft,/Report B/);
 assert.match(draft,/Largest winning close:/);assert.match(draft,/Largest losing close:/);
 assert.match(draft,/monetary deltas withheld/);
 assert.doesNotMatch(draft,/SECRET_ACCOUNT_ID|MALICIOUS|EXAMPLE.COM|@/);
});
test('a malformed source cannot create an independently verified Chat handoff',()=>{
 assert.throws(()=>buildMt5ChatDraft({}),/Validated normalized MT5/);
});
