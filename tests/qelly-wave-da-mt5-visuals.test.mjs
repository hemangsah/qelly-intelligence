import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeMt5ClosedDeals} from '../apps/web/public/assets/qelly-mt5-advanced-metrics.mjs';
import {renderMt5ClosedDealEvidence} from '../apps/web/public/assets/qelly-mt5-visuals.mjs';
const report=()=>analyzeMt5ClosedDeals(Array.from({length:50},(_,i)=>({pnl:i%3===0?-2:4,side:i%2?'sell':'buy',symbol:i%5?'EURUSD':'<img src=x onerror=alert(1)>'})),{mt5:{format:'mt5-html'}});
test('static report renders accessible closed-deal-only charts without executing uploaded values',()=>{
 const html=renderMt5ClosedDealEvidence(report());
 assert.match(html,/role="img"/);assert.match(html,/NOT broker account equity/);
 assert.match(html,/Cumulative closed-deal P&amp;L/);
 assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(html,/<img src=x onerror=/);
 assert.match(html,/small N/);assert.match(html,/do not predict future performance/);
});
test('unverified and missing reports fail closed and no statistical interval is invented for small N',()=>{
 assert.throws(()=>renderMt5ClosedDealEvidence({schema:'unknown'}),/Verified normalized/);
 const small=analyzeMt5ClosedDeals([{pnl:1},{pnl:-2}],{mt5:{format:'mt5-html'}});
 assert.match(renderMt5ClosedDealEvidence(small),/Statistical resampling withheld/);
 assert.doesNotMatch(renderMt5ClosedDealEvidence(small),/NaN|undefined/);
});
