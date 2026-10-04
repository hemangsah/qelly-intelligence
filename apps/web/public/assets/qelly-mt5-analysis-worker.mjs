import {analyzeLocalMt5} from './qelly-mt5-local-analysis.mjs';

self.onmessage=async event=>{
  try{self.postMessage({ok:true,report:await analyzeLocalMt5(event.data)});}
  catch(error){self.postMessage({ok:false,error:{code:String(error?.code||'mt5_local_analysis_failed').slice(0,80),message:String(error?.message||'Local MT5 analysis failed.').slice(0,240)}});}
  finally{self.close();}
};
