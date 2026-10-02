import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {analyzeMt5ClosedDeals} from '../apps/web/public/assets/qelly-mt5-advanced-metrics.mjs';
import {buildMt5ObservedDiagnostics,renderMt5ObservedDiagnostics} from '../apps/web/public/assets/qelly-mt5-diagnostics.mjs';
const valid={mt5:{format:'mt5-html',closingDealsWithMissingCosts:0}};
const build=n=>analyzeMt5ClosedDeals(Array.from({length:n},(_,i)=>({
 pnl:i%3===0?-8:3,side:i%2?'sell':'buy',symbol:i%2?'EURUSD':'GBPUSD',
 closedAt:'2026.09.'+String(1+i%28).padStart(2,'0')+' 09:30',
 commission:-.25,fee:0,swap:0
})),valid);
test('diagnostics are bounded descriptive observations, with no predictive or broker-equity claims',()=>{
 const a=build(36),d=buildMt5ObservedDiagnostics(a);
 assert.equal(d.schema,'qelly.mt5.closed-deal-diagnostics/1.0');
 assert.equal(d.truthState,'DETERMINISTIC LOCAL DIAGNOSTICS');
 assert.equal(d.sample.grade,'OBSERVED_SAMPLE');
 assert.equal(d.findings[0].value,a.metrics.netPnl);
 assert.ok(d.findings.some(f=>f.id==='negative-symbol'&&f.group==='GBPUSD'));
 assert.ok(d.findings.some(f=>f.id==='negative-hour'&&f.group==='09:00 (report clock)'));
 assert.ok(d.findings.some(f=>f.id==='reported-commission'&&f.coveragePct===100));
 assert.match(d.warnings.join(' '),/not a forecast|not market sessions/);
 assert.equal(d.privacy.sourceRowsIncluded,false);
 assert.equal(d.privacy.uploaded,false);
});
test('limited samples and absent negative buckets never imply subgroup significance',()=>{
 const small=buildMt5ObservedDiagnostics(build(6));
 assert.equal(small.sample.grade,'LIMITED_SAMPLE');
 assert.ok(small.findings.every(f=>f.state==='LIMITED_SAMPLE'||f.id==='reported-commission'));
 assert.match(small.warnings.join(' '),/LIMITED SAMPLE/);
 const positive=analyzeMt5ClosedDeals(Array.from({length:33},()=>({pnl:2,symbol:'XAUUSD',side:'buy'})),valid);
 const d=buildMt5ObservedDiagnostics(positive);
 assert.equal(d.findings.some(f=>f.id.startsWith('negative-')),false);
 assert.ok(d.unavailable.length>=3);
});
test('missing cost observations and missing time are disclosed rather than filled with zero',()=>{
 const r=analyzeMt5ClosedDeals(Array.from({length:30},()=>({pnl:-1,symbol:'GBPUSD',side:'buy'})),valid);
 const d=buildMt5ObservedDiagnostics(r);
 assert.equal(d.findings.some(f=>f.id==='reported-commission'),false);
 assert.ok(d.unavailable.some(s=>s.includes('commission')));
 assert.ok(d.unavailable.some(s=>s.includes('hour')));
 assert.ok(d.warnings.some(s=>s.includes('ordering is unverified')));
});
test('privacy by construction: no copied account metadata, source rows, or uploaded HTML',()=>{
 const r=build(34);
 r.account={login:'PRIVATE_LOGIN',password:'PRIVATE_PASSWORD'};
 r.rawRows=[{ticket:'PRIVATE_TICKET'}];r.html='<script>PRIVATE_HTML</script>';
 const d=JSON.stringify(buildMt5ObservedDiagnostics(r));
 assert.doesNotMatch(d,/PRIVATE_LOGIN|PRIVATE_PASSWORD|PRIVATE_TICKET|PRIVATE_HTML/);
});
test('user-originated bucket labels are escaped in diagnostic markup',()=>{
 const r=build(36);
 r.groups.symbol=[{key:'<img src=x onerror=alert(1)>',count:20,net:-100,winRatePct:35}];
 const html=renderMt5ObservedDiagnostics(r);
 assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(html,/<img src=x/);
 assert.match(html,/data-mt5-observed-diagnostics/);
});
test('invalid schemas, unbounded deal counts and nonfinite observed P&L fail closed',()=>{
 assert.throws(()=>buildMt5ObservedDiagnostics({}),/Validated normalized/);
 const a=build(30);a.sample.deals=100001;
 assert.throws(()=>buildMt5ObservedDiagnostics(a),/Validated normalized/);
 const b=build(31);b.metrics.netPnl=Infinity;
 assert.throws(()=>buildMt5ObservedDiagnostics(b),/Validated normalized/);
});
test('QELLY Verify renders diagnostics and exports only derived summary, not source rows',async()=>{
 const [visuals,verify,css]=await Promise.all([
  readFile(new URL('../apps/web/public/assets/qelly-mt5-visuals.mjs',import.meta.url),'utf8'),
  readFile(new URL('../apps/web/public/assets/qelly-verify-product.mjs',import.meta.url),'utf8'),
  readFile(new URL('../apps/web/public/assets/qelly-mt5-visuals.css',import.meta.url),'utf8')
 ]);
 assert.match(visuals,/renderMt5ObservedDiagnostics\(report\)/);
 assert.match(verify,/mt5ObservedDiagnostics:buildMt5ObservedDiagnostics\(current\.mt5Report\)/);
 assert.match(css,/\.q-mt5-diagnostics/);
});
