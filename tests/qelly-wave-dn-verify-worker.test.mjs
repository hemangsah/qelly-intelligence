import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeLocalVerify} from '../apps/web/public/assets/qelly-verify-local-analysis.mjs';
import {parseTradeCsv,analyzeTrades,sampleTradeCsv} from '../apps/web/public/assets/qelly-verify-engine.mjs';
import {composeStrategyEvidenceReport,stableEvidenceCore} from '../apps/web/public/assets/qelly-verify-report.mjs';
import {createLocalVerifyTask} from '../apps/web/public/assets/qelly-mt5-worker-client.mjs';

test('Verify worker preserves the existing evidence core and normalized source fingerprint',async()=>{
 const source=sampleTradeCsv(),parsed=parseTradeCsv(source),sourceName='sample.csv';
 const expected=await composeStrategyEvidenceReport({analysis:analyzeTrades(parsed.trades,{sourceName}),validation:parsed.validation,sourceText:source,sourceName});
 const actual=await analyzeLocalVerify({source,sourceName,format:'csv'});
 assert.deepEqual(stableEvidenceCore(actual.evidence),stableEvidenceCore(expected));
 assert.deepEqual(actual.evidence.source.fingerprint,expected.source.fingerprint);
 assert.deepEqual(Object.keys(actual).sort(),['evidence','mt5Report','validation']);
 assert.equal(actual.mt5Report,null);assert.equal('trades' in actual,false);assert.equal('sourceText' in actual,false);
});
test('Verify worker preserves limited MT5 evidence without invoking the general minimum-five engine',async()=>{
 const source='<table><tr><th>Deal</th><th>Symbol</th><th>Type</th><th>Direction</th><th>Profit</th></tr><tr><td>1</td><td>EURUSD</td><td>buy</td><td>out</td><td>7</td></tr></table>';
 const result=await analyzeLocalVerify({source,sourceName:'one.html',format:'mt5-html'});
 assert.equal(result.mt5Report.sample.deals,1);assert.equal(result.mt5Report.metrics.netPnl,7);assert.equal(result.evidence,null);
 await assert.rejects(analyzeLocalVerify({source:'x'.repeat(5*1024*1024+1),format:'csv'}),/5 MB/);
 await assert.rejects(analyzeLocalVerify({source,format:'exe'}),/CSV/);
});
test('Verify client uses the fixed local module and rejects invalid success payloads',async()=>{
 let worker;
 class Double{constructor(url,options){worker=this;this.url=url;this.options=options;}postMessage(){}terminate(){this.terminated=true;}}
 const task=createLocalVerifyTask({source:'pnl\n1',format:'csv'},{WorkerClass:Double});
 assert.match(worker.url.pathname,/qelly-verify-analysis-worker.mjs$/);assert.equal(worker.options.type,'module');
 worker.onmessage({data:{ok:true,report:{sample:{deals:1}}}});
 await assert.rejects(task.promise,/failed/);assert.equal(worker.terminated,true);
 const canceled=createLocalVerifyTask({}, {WorkerClass:Double});const rejection=assert.rejects(canceled.promise,error=>error.name==='AbortError');canceled.cancel();await rejection;
});
