import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalMt5Task} from '../apps/web/public/assets/qelly-mt5-worker-client.mjs';
import {analyzeLocalMt5} from '../apps/web/public/assets/qelly-mt5-local-analysis.mjs';

class LocalWorkerDouble{
  static latest;
  constructor(url,options){this.url=url;this.options=options;LocalWorkerDouble.latest=this;}
  postMessage(payload,transfers){this.payload=structuredClone(payload,{transfer:transfers});}
  terminate(){this.terminated=true;}
}
const start=(options={})=>createLocalMt5Task({source:new Uint8Array([1,2,3]),format:'xlsx'},{WorkerClass:LocalWorkerDouble,...options});

test('worker client transfers source ownership and releases worker after success',async()=>{
  const source=new Uint8Array([1,2,3]);
  const task=createLocalMt5Task({source,format:'xlsx'},{WorkerClass:LocalWorkerDouble});
  const worker=LocalWorkerDouble.latest;
  assert.equal(source.byteLength,0);
  assert.deepEqual([...worker.payload.source],[1,2,3]);
  assert.equal(worker.options.type,'module');
  assert.match(worker.url.pathname,/qelly-mt5-analysis-worker.mjs$/);
  worker.onmessage({data:{ok:true,report:{sample:{deals:12}}}});
  assert.deepEqual(await task.promise,{sample:{deals:12}});
  assert.equal(worker.terminated,true);
});
test('worker cancellation rejects pending job and ignores a late success',async()=>{
  const task=start(),worker=LocalWorkerDouble.latest;
  const rejected=assert.rejects(task.promise,error=>error.name==='AbortError');
  task.cancel();task.cancel();
  worker.onmessage({data:{ok:true,report:{sample:{deals:999}}}});
  await rejected;assert.equal(worker.terminated,true);
});
test('worker parser errors preserve safe code/message and release resources',async()=>{
  const task=start(),worker=LocalWorkerDouble.latest;
  worker.onmessage({data:{ok:false,error:{code:'mt5_xlsx_checksum_invalid',message:'Checksum mismatch.'}}});
  await assert.rejects(task.promise,error=>error.code==='mt5_xlsx_checksum_invalid'&&error.message==='Checksum mismatch.');
  assert.equal(worker.terminated,true);
});
test('worker crash, unreadable response, timeout and missing support fail closed',async()=>{
  for(const event of ['onerror','onmessageerror']){
    const task=start(),worker=LocalWorkerDouble.latest;
    worker[event]({preventDefault(){}});
    await assert.rejects(task.promise,/Local/);assert.equal(worker.terminated,true);
  }
  const task=start({timeoutMs:1}),worker=LocalWorkerDouble.latest;
  await assert.rejects(task.promise,/time limit/);assert.equal(worker.terminated,true);
  await assert.rejects(createLocalMt5Task({}, {WorkerClass:null}).promise,/unavailable/);
});
test('worker processor retains actual parser bounds and descriptive metric omissions',async()=>{
  const html='<table><tr><th>Time</th><th>Deal</th><th>Symbol</th><th>Type</th><th>Direction</th><th>Profit</th></tr>'+[3,-1,4].map((p,i)=>`<tr><td>2026.10.0${i+1} 11:30</td><td>${i+1}</td><td>EURUSD</td><td>buy</td><td>out</td><td>${p}</td></tr>`).join('')+'</table>';
  const report=await analyzeLocalMt5({source:new TextEncoder().encode(html),format:'html'});
  assert.equal(report.sample.deals,3);assert.equal(report.metrics.netPnl,6);
  assert.equal(report.metrics.sharpe,null);assert.equal(report.metrics.relativeAccountDrawdown,null);
  await assert.rejects(analyzeLocalMt5({source:new Uint8Array(5*1024*1024+1),format:'html'}),/5 MB/);
  await assert.rejects(analyzeLocalMt5({source:html,format:'exe'}),/HTML or XLSX/);
  await assert.rejects(analyzeLocalMt5({source:new Uint8Array([1,2,3]),format:'xlsx'}),error=>error.code==='mt5_xlsx_invalid');
});
