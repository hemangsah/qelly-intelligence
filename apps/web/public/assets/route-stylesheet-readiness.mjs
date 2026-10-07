// Route renderers must not expose content before its layout rules have loaded.
const pending=new WeakMap();
const awaitForRoute=(promise,signal)=>{
  if(!signal)return promise;
  const aborted=()=>new DOMException('Route was superseded','AbortError');
  if(signal.aborted)return Promise.reject(aborted());
  return new Promise((resolve,reject)=>{
    const cancel=()=>reject(aborted());
    signal.addEventListener('abort',cancel,{once:true});
    promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',cancel));
  });
};
export function ensureRouteStylesheet(href,{attribute,value,timeoutMs=8000,document:doc=globalThis.document,signal}={}){
  if(signal?.aborted)return awaitForRoute(Promise.resolve(),signal);
  let link=doc.querySelector('link['+attribute+']');
  if(link?.sheet)return Promise.resolve();
  if(link&&pending.has(link))return awaitForRoute(pending.get(link),signal);
  const created=!link;
  if(created){link=doc.createElement('link');link.rel='stylesheet';link.href=href;link.setAttribute(attribute,value);}
  const promise=new Promise((resolve,reject)=>{
    let timer,settled=false;
    const finish=(error)=>{
      if(settled)return;settled=true;
      clearTimeout(timer);
      link.removeEventListener('load',loaded);link.removeEventListener('error',failed);
      pending.delete(link);
      if(error){link.remove();reject(error);}else resolve();
    };
    const loaded=()=>finish();
    const failed=()=>finish(new Error('Workspace styles could not load. Please retry.'));
    link.addEventListener('load',loaded,{once:true});link.addEventListener('error',failed,{once:true});
    timer=setTimeout(failed,timeoutMs);
  });
  pending.set(link,promise);
  if(created)doc.head.append(link);
  return awaitForRoute(promise,signal);
}
