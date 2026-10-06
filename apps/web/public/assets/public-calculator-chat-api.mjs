// One bounded same-origin adapter for the existing governed assistant.
// Creating it or loading capabilities never sends calculator inputs.
export function createPublicCalculatorChatApi({fetcher=globalThis.fetch}={}){
  return async(path,options={})=>{
    if(path!=='/api/v1/intelligence/chat')throw new Error('Unsupported public assistant endpoint.');
    const method=String(options.method||'GET').toUpperCase();
    if(!['GET','POST'].includes(method))throw new Error('Unsupported public assistant method.');
    let token='';
    if(method==='POST'){
      const configResponse=await fetcher('/api/v1/config',{credentials:'include',signal:options.signal});
      if(!configResponse.ok)throw new Error('Assistant session configuration is unavailable. Please retry.');
      const config=await configResponse.json();token=config.csrf?.token||'';
      if(typeof token!=='string'||!token)throw new Error('Assistant session protection is unavailable. Please reload and retry.');
    }
    const response=await fetcher(path,{method,credentials:'include',signal:options.signal,
      ...(method==='POST'?{body:options.body}:{}),
      headers:{'Content-Type':'application/json',...(method==='POST'?{'X-Qelly-CSRF':token}:{})}});
    const body=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(body.error?.message||`Assistant request failed (${response.status}).`);error.status=response.status;throw error;}
    return body;
  };
}
