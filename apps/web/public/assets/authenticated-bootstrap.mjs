const BOOTSTRAP_PATH='/api/v1/bootstrap';
const PROJECTIONS=new Map([
  ['/api/v1/config','config'],
  ['/api/v1/session/context','context'],
  ['/api/v1/preferences/layout','preferences']
]);
const INVALIDATING_PREFIXES=[
  '/api/v1/auth/',
  '/api/v1/preferences/',
  '/api/v1/profile',
  '/api/v1/workspace',
  '/api/v1/cloud/',
  '/api/v1/account/'
];
const READ_METHODS=new Set(['GET','HEAD','OPTIONS']);

const requestUrl=(input,baseUrl)=>{
  if(input instanceof Request)return new URL(input.url);
  return new URL(String(input),baseUrl);
};

const requestMethod=(input,init)=>String(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
const shouldInvalidate=(pathname)=>INVALIDATING_PREFIXES.some((prefix)=>pathname.startsWith(prefix));

const responseFromRecord=(record,key)=>{
  if(!record.ok){
    return new Response(JSON.stringify(record.body||{error:{code:'bootstrap_unavailable',message:'Application bootstrap is unavailable'}}),{
      status:record.status,
      statusText:record.statusText,
      headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Qelly-Bootstrap':'error'}
    });
  }
  if(!record.body||!(key in record.body)){
    return new Response(JSON.stringify({error:{code:'bootstrap_projection_missing',message:'Application bootstrap did not include the requested projection'}}),{
      status:503,
      headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Qelly-Bootstrap':'invalid'}
    });
  }
  return new Response(JSON.stringify(record.body[key]),{
    status:200,
    headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Qelly-Bootstrap':'consolidated'}
  });
};

export function createAuthenticatedBootstrapFetch({fetchImpl,baseUrl='https://qelly.invalid/',ttlMs=5000,now=()=>Date.now()}={}){
  if(typeof fetchImpl!=='function')throw new TypeError('fetchImpl is required');
  const canonicalBase=new URL(baseUrl);
  const bootstrapUrl=new URL(BOOTSTRAP_PATH,canonicalBase).toString();
  let snapshot=null;
  let expiresAt=0;
  let inFlight=null;
  let generation=0;

  const invalidateBootstrap=()=>{
    generation+=1;
    snapshot=null;
    expiresAt=0;
  };

  const loadBootstrap=async()=>{
    if(snapshot&&now()<expiresAt)return snapshot;
    if(inFlight)return inFlight;
    const startedGeneration=generation;
    const request=Promise.resolve().then(async()=>{
      const response=await fetchImpl(bootstrapUrl,{method:'GET',credentials:'include',headers:{Accept:'application/json'}});
      const body=await response.clone().json().catch(()=>null);
      const record={ok:response.ok,status:response.status,statusText:response.statusText,body};
      if(response.ok&&startedGeneration===generation){
        snapshot=record;
        expiresAt=now()+Math.max(0,Number(ttlMs)||0);
      }
      return record;
    });
    inFlight=request;
    try{return await request;}
    finally{if(inFlight===request)inFlight=null;}
  };

  const wrappedFetch=async(input,init={})=>{
    const method=requestMethod(input,init);
    const url=requestUrl(input,canonicalBase);
    const projection=url.origin===canonicalBase.origin&&url.search===''&&method==='GET'?PROJECTIONS.get(url.pathname):null;
    if(projection){
      const record=await loadBootstrap();
      return responseFromRecord(record,projection);
    }

    const response=await fetchImpl(input,init);
    if(!READ_METHODS.has(method)&&url.origin===canonicalBase.origin&&response.ok&&shouldInvalidate(url.pathname))invalidateBootstrap();
    return response;
  };

  wrappedFetch.invalidateBootstrap=invalidateBootstrap;
  wrappedFetch.bootstrapState=()=>({cached:Boolean(snapshot&&now()<expiresAt),inFlight:Boolean(inFlight),generation,expiresAt});
  return wrappedFetch;
}

export const __authenticatedBootstrapTest=Object.freeze({BOOTSTRAP_PATH,PROJECTIONS,INVALIDATING_PREFIXES,shouldInvalidate});
