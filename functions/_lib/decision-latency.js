const round=(value,digits=2)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const defaultClock=()=>typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now();

export function createDecisionLatencyTrace({clock=defaultClock}={}){
  const started=clock();
  const components={};
  const record=(name,start,state='ok')=>{
    const elapsed=Math.max(0,Number(clock())-Number(start));
    components[name]={ms:round(elapsed),state};
  };
  return {
    span(name){
      const start=clock();
      let finished=false;
      return (state='ok')=>{
        if(finished)return;
        finished=true;
        record(name,start,state);
      };
    },
    async time(name,task){
      const start=clock();
      try{
        const value=await task();
        record(name,start,'ok');
        return value;
      }catch(error){
        record(name,start,'error');
        throw error;
      }
    },
    measure(name,task){
      const start=clock();
      try{
        const value=task();
        record(name,start,'ok');
        return value;
      }catch(error){
        record(name,start,'error');
        throw error;
      }
    },
    snapshot(extra={}){
      return {
        schemaVersion:'qelly.decision-latency/1.0.0',
        totalMs:round(Math.max(0,Number(clock())-Number(started))),
        components:{...components},
        concurrencyBoundary:'Component durations may overlap because independent evidence providers are intentionally fetched concurrently; do not sum them to infer total latency.',
        ...extra
      };
    }
  };
}

export function estimateSerializedPayload(value,{clock=defaultClock}={}){
  const start=clock();
  const serialized=JSON.stringify(value);
  const serializationMs=round(Math.max(0,Number(clock())-Number(start)));
  const responseBytes=typeof TextEncoder!=='undefined'?new TextEncoder().encode(serialized).byteLength:serialized.length;
  return {serializationMs,responseBytes};
}
