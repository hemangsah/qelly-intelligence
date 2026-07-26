const base=process.env.QELLY_STAGING_URL;
if(!base)throw new Error('QELLY_STAGING_URL is required');
const results=[];
for(const path of ['/api/health','/api/ready']){
  const started=Date.now();
  const response=await fetch(new URL(path,base),{headers:{'User-Agent':'Qelly-Staging-Health/27.0'},signal:AbortSignal.timeout(10000)});
  const body=await response.json().catch(()=>({}));
  results.push({path,status:response.status,ok:response.ok,latencyMs:Date.now()-started,body});
}
console.log(JSON.stringify({checkedAt:new Date().toISOString(),base,results,status:results.every(x=>x.ok)?'passed':'failed'},null,2));
if(results.some(x=>!x.ok))process.exitCode=1;
