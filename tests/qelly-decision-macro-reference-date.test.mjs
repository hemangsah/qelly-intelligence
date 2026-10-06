import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionMacroContext} from '../functions/_lib/decision-macro-events.js';
import {buildTradeResearch} from '../functions/_lib/decision-trade-research.js';
import {__decisionOutcomeLedgerTest as ledger} from '../functions/_lib/decision-outcome-ledger.js';
import {__decisionProvenGraphRouteTest as route} from '../apps/web/public/assets/routes/decision-proven-graph.mjs';
const provider=date=>({provider:'ecb-reference-rates',observationTime:'2026-10-05T16:00:00.000Z',data:{date,rates:{USD:1.1,INR:90}}});
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

test('Decision retains the source calendar date and removes a legacy invented ECB clock',()=>{
 const macro=buildDecisionMacroContext(provider('2026-10-05'));
 assert.equal(macro.referenceDate,'2026-10-05');assert.equal(macro.observedAt,null);
 assert.equal(macro.observationTimePrecision,'date');assert.equal(macro.eligibilityImpact,'none');assert.equal(macro.intradayFeedConnected,false);
});
test('invalid, missing and coerced dates cannot become a dated macro observation',()=>{
 for(const date of ['2026-02-30','2025-02-29','2026-10-05T00:00:00Z',null,0,'']){
  const macro=buildDecisionMacroContext(provider(date));
  assert.equal(macro.referenceDate,null);assert.equal(macro.observedAt,null);assert.equal(macro.observationTimePrecision,'unavailable');
 }
 assert.equal(buildDecisionMacroContext(provider('2024-02-29')).referenceDate,'2024-02-29');
});
test('unavailable macro evidence retains unavailable date precision',()=>{
 const macro=buildDecisionMacroContext({data:{date:'2026-10-05',rates:{}}});
 assert.equal(macro.state,'unavailable');assert.equal(macro.referenceDate,null);assert.equal(macro.observedAt,null);assert.equal(macro.observationTimePrecision,'unavailable');
});
test('trade research and outcome component snapshots preserve date-only provenance',()=>{
 const macro=buildDecisionMacroContext(provider('2026-10-05'));
 for(const snapshot of [buildTradeResearch({evidence:{macro}}).riskContext.macro,ledger.componentSnapshot({evidence:{macro}}).macro]){
  assert.equal(snapshot.referenceDate,'2026-10-05');assert.equal(snapshot.observedAt,null);assert.equal(snapshot.observationTimePrecision,'date');
 }
});
test('macro panel renders the literal calendar date without timezone conversion or a fabricated clock',()=>{
 const macro=buildDecisionMacroContext(provider('2026-10-05'));
 const markup=route.macroContext({evidence:{macro}},escape);
 assert.match(markup,/<span>Reference date<\/span><strong>2026-10-05<\/strong>/);
 assert.match(markup,/exact publication time unavailable/);assert.doesNotMatch(markup,/16:00|Time unavailable|1970/);
});
test('macro panel rejects impossible or hostile date strings without rendering a legacy clock',()=>{
 for(const referenceDate of ['2026-02-30','<img src=x onerror=alert(1)>',null]){
  const markup=route.macroContext({macro:{...buildDecisionMacroContext(provider('2026-10-05')),referenceDate,observedAt:'2026-10-05T16:00:00Z'}},escape);
  assert.match(markup,/<span>Reference date<\/span><strong>Date unavailable<\/strong>/);
  assert.doesNotMatch(markup,/<img|16:00/);
 }
});
