const WORKER_URL=new URL('./qelly-mt5-analysis-worker.mjs',import.meta.url);
const VERIFY_WORKER_URL=new URL('./qelly-verify-analysis-worker.mjs',import.meta.url);
const cancellation=()=>new DOMException('Local analysis was cleared.','AbortError');

export const createLocalMt5Task=(payload,options)=>createLocalTask(payload,options,WORKER_URL,report=>Boolean(report?.sample));
export const createLocalVerifyTask=(payload,options)=>createLocalTask(payload,options,VERIFY_WORKER_URL,report=>Boolean(report?.validation&&(report.evidence||report.mt5Report)));

function createLocalTask(payload,{WorkerClass=globalThis.Worker,timeoutMs=45000}={},workerUrl,acceptReport){
  let worker,timer,settled=false,rejectTask;
  const finish=()=>{settled=true;clearTimeout(timer);worker?.terminate();};
  const promise=new Promise((resolve,reject)=>{
    rejectTask=reject;
    if(typeof WorkerClass!=='function'){settled=true;reject(new Error('Local background analysis is unavailable in this browser.'));return;}
    try{
      worker=new WorkerClass(workerUrl,{type:'module',name:'Qelly local analysis'});
      worker.onmessage=event=>{
        if(settled)return;
        finish();
        if(event.data?.ok===true&&acceptReport(event.data.report))resolve(event.data.report);
        else{const error=new Error(String(event.data?.error?.message||'Local MT5 analysis failed.').slice(0,240));error.code=String(event.data?.error?.code||'mt5_local_analysis_failed').slice(0,80);reject(error);}
      };
      worker.onerror=event=>{event.preventDefault?.();if(!settled){finish();reject(new Error('Local background analysis failed. Export the report again.'));}};
      worker.onmessageerror=()=>{if(!settled){finish();reject(new Error('Local analysis returned an unreadable result.'));}};
      timer=setTimeout(()=>{if(!settled){finish();reject(new Error('Local analysis exceeded its time limit. Try a smaller report.'));}},timeoutMs);
      const transfers=payload.source instanceof Uint8Array?[payload.source.buffer]:[];
      worker.postMessage(payload,transfers);
    }catch{finish();reject(new Error('Local background analysis could not start in this browser.'));}
  });
  return {promise,cancel(){if(!settled){finish();rejectTask(cancellation());}}};
}
