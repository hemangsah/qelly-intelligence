import {analyzeLocalVerify} from './qelly-verify-local-analysis.mjs';
self.onmessage=async event=>{
  try{self.postMessage({ok:true,report:await analyzeLocalVerify(event.data)});}
  catch(error){self.postMessage({ok:false,error:{code:String(error?.code||'verify_local_analysis_failed').slice(0,80),message:String(error?.message||'Local analysis failed.').slice(0,240)}});}
  finally{self.close();}
};
