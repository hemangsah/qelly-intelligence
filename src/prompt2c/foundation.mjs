import crypto from 'node:crypto';

const CLOUD_MODES = new Set(['local-only','supabase','hybrid']);
const FORBIDDEN_JSON_KEYS = new Set(['__proto__','prototype','constructor']);
const PROVIDER_TRUTH = new Set(['live_provider','delayed_provider']);

function absoluteHttpUrl(value,name,{required=false}={}){
  if(!value){if(required)throw new Error(`${name} is required`);return null;}
  let url;try{url=new URL(value);}catch{throw new Error(`${name} must be an absolute URL`);}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error(`${name} is unsafe`);
  return url.toString().replace(/\/$/,'');
}
function bool(value,fallback=false){
  if(value==null||value==='')return fallback;
  if(/^(1|true|yes|on)$/i.test(String(value)))return true;
  if(/^(0|false|no|off)$/i.test(String(value)))return false;
  throw new Error(`Invalid boolean value: ${value}`);
}
export function assertNoBrowserSecrets(input){
  const text=typeof input==='string'?input:JSON.stringify(input);
  const findings=[];
  for(const match of text.matchAll(/QELLY_[A-Z0-9_]+/g)){
    const key=match[0];
    if(!key.startsWith('QELLY_PUBLIC_')&&/(secret|service[_-]?role|private[_-]?key|password|token|signing|smtp|database_url)/i.test(key))findings.push(key);
  }
  if(/service_role|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(text))findings.push('secret-material');
  if(findings.length)throw new Error(`Browser secret markers detected: ${[...new Set(findings)].join(', ')}`);
  return true;
}
export function parsePrompt2CConfig(env=process.env,{strictCloud=false}={}){
  const mode=String(env.QELLY_CLOUD_MODE||'local-only').toLowerCase();
  if(!CLOUD_MODES.has(mode))throw new Error('Invalid QELLY_CLOUD_MODE');
  const supabaseUrl=absoluteHttpUrl(env.QELLY_PUBLIC_SUPABASE_URL,'QELLY_PUBLIC_SUPABASE_URL',{required:strictCloud&&mode!=='local-only'});
  const anonKey=env.QELLY_PUBLIC_SUPABASE_ANON_KEY||null;
  const serviceRoleKey=env.QELLY_SUPABASE_SERVICE_ROLE_KEY||null;
  const turnstileSiteKey=env.QELLY_PUBLIC_TURNSTILE_SITE_KEY||null;
  const turnstileSecret=env.QELLY_TURNSTILE_SECRET_KEY||null;
  if(strictCloud&&mode!=='local-only'&&(!anonKey||!serviceRoleKey))throw new Error('Cloud mode requires public anon and server-only service credentials');
  if(strictCloud&&turnstileSiteKey&&!turnstileSecret)throw new Error('Turnstile server secret required');
  const publicConfig=Object.freeze({
    mode,
    publicBaseUrl:absoluteHttpUrl(env.QELLY_PUBLIC_BASE_URL||'https://hemangsah.github.io/qelly-intelligence','QELLY_PUBLIC_BASE_URL'),
    apiBaseUrl:absoluteHttpUrl(env.QELLY_PUBLIC_API_BASE_URL,'QELLY_PUBLIC_API_BASE_URL'),
    supabaseUrl,
    supabaseAnonKey:anonKey,
    turnstileSiteKey,
    releaseSha:env.QELLY_PUBLIC_RELEASE_SHA||'unresolved',
    deploymentEnvironment:env.QELLY_PUBLIC_DEPLOYMENT_ENVIRONMENT||'github-pages-fallback',
    cloudSyncAvailable:mode!=='local-only'&&Boolean(supabaseUrl&&anonKey),
    authAvailable:mode!=='local-only'&&Boolean(supabaseUrl&&anonKey),
    protectedWritesAvailable:Boolean(turnstileSiteKey&&turnstileSecret)
  });
  assertNoBrowserSecrets(publicConfig);
  return Object.freeze({mode,public:publicConfig,private:Object.freeze({serviceRoleKey,turnstileSecret,databaseUrl:env.QELLY_DATABASE_URL||null}),featureFlags:Object.freeze({auth:bool(env.QELLY_ENABLE_AUTH,mode!=='local-only'),cloudSync:bool(env.QELLY_ENABLE_CLOUD_SYNC,mode!=='local-only'),providers:bool(env.QELLY_ENABLE_LIVE_PROVIDERS,false),feedbackWrites:bool(env.QELLY_ENABLE_FEEDBACK_WRITES,false),analytics:bool(env.QELLY_ENABLE_ANALYTICS,false)})});
}

export function buildSecurityHeaders({https=true,connectSrc=["'self'"]}={}){
  const headers={
    'Content-Security-Policy':[`default-src 'self'`,`base-uri 'none'`,`object-src 'none'`,`frame-ancestors 'none'`,`form-action 'self'`,`script-src 'self'`,`style-src 'self' 'unsafe-inline'`,`font-src 'self'`,`img-src 'self' data: blob:`,`connect-src ${connectSrc.join(' ')}`,`worker-src 'self' blob:`,`manifest-src 'self'`,`upgrade-insecure-requests`].join('; '),
    'Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Resource-Policy':'same-origin'
  };
  if(https)headers['Strict-Transport-Security']='max-age=31536000; includeSubDomains; preload';
  return Object.freeze(headers);
}
export function enforceCsrf({method,origin,secFetchSite,allowlist=[],csrfHeader,expectedCsrf}){
  if(['GET','HEAD','OPTIONS'].includes(String(method).toUpperCase()))return true;
  let allowed=false;try{const actual=new URL(origin).origin;allowed=allowlist.some((entry)=>new URL(entry).origin===actual);}catch{}
  if(secFetchSite==='cross-site'&&!allowed)throw Object.assign(new Error('Cross-site state change blocked'),{status:403,code:'csrf_blocked'});
  const a=Buffer.from(String(csrfHeader||'')),b=Buffer.from(String(expectedCsrf||''));
  if(!a.length||a.length!==b.length||!crypto.timingSafeEqual(a,b))throw Object.assign(new Error('Invalid CSRF proof'),{status:403,code:'csrf_invalid'});
  return true;
}
export function escapeCsvCell(value){let text=value==null?'':String(value);if(/^[=+\-@\t\r]/.test(text))text=`'${text}`;return /[",\n\r]/.test(text)?`"${text.replaceAll('"','""')}"`:text;}
function inspectJson(value,state,depth=0){
  if(depth>state.maxDepth)throw Object.assign(new Error('JSON depth exceeded'),{code:'json_depth_exceeded'});
  if(value==null||typeof value!=='object')return;
  if(Array.isArray(value)){for(const item of value)inspectJson(item,state,depth+1);return;}
  for(const [key,nested] of Object.entries(value)){
    if(FORBIDDEN_JSON_KEYS.has(key))throw Object.assign(new Error('Prototype pollution rejected'),{code:'prototype_pollution_rejected'});
    if(++state.keys>state.maxKeys)throw Object.assign(new Error('JSON key limit exceeded'),{code:'json_key_limit_exceeded'});
    inspectJson(nested,state,depth+1);
  }
}
export function safeJsonParse(input,{maxBytes=1_000_000,maxDepth=32,maxKeys=20_000}={}){
  const text=typeof input==='string'?input:Buffer.from(input).toString('utf8');
  if(Buffer.byteLength(text)>maxBytes)throw Object.assign(new Error('JSON too large'),{status:413,code:'json_too_large'});
  let parsed;try{parsed=JSON.parse(text);}catch{throw Object.assign(new Error('Malformed JSON'),{status:400,code:'malformed_json'});}
  inspectJson(parsed,{maxDepth,maxKeys,keys:0});return parsed;
}
export function validateImportFile({name,type,size},{maxBytes=2_000_000}={}){
  if(!name||size<0||size>maxBytes)throw Object.assign(new Error('Import file rejected'),{code:'file_rejected'});
  const expected=type==='application/json'?'.json':type==='text/csv'?'.csv':null;
  if(!expected||!name.toLowerCase().endsWith(expected))throw Object.assign(new Error('MIME or extension rejected'),{code:'mime_rejected'});
  return true;
}
export class SlidingWindowRateLimiter{
  constructor({limit=20,windowMs=60_000,maxKeys=10_000}={}){this.limit=limit;this.windowMs=windowMs;this.maxKeys=maxKeys;this.events=new Map();}
  consume(key,now=Date.now()){
    if(!this.events.has(key)&&this.events.size>=this.maxKeys)this.events.delete(this.events.keys().next().value);
    const current=(this.events.get(key)||[]).filter((ts)=>ts>now-this.windowMs),allowed=current.length<this.limit;
    if(allowed)current.push(now);this.events.set(key,current);
    return {allowed,remaining:Math.max(0,this.limit-current.length),resetAt:current[0]?current[0]+this.windowMs:now+this.windowMs};
  }
}
export async function verifyTurnstileToken({token,secret,remoteIp=null,expectedHostname=null,fetchImpl=globalThis.fetch,timeoutMs=5000}){
  if(!token||!secret)return {success:false,code:'turnstile_not_configured'};
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const body=new URLSearchParams({secret,response:token});if(remoteIp)body.set('remoteip',remoteIp);
    const response=await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body,signal:controller.signal});
    if(!response.ok)return {success:false,code:'turnstile_upstream_error'};
    const payload=await response.json();
    if(!payload.success)return {success:false,code:'turnstile_rejected',errors:payload['error-codes']||[]};
    if(expectedHostname&&payload.hostname!==expectedHostname)return {success:false,code:'turnstile_hostname_mismatch'};
    return {success:true,hostname:payload.hostname||null,action:payload.action||null};
  }catch(error){return {success:false,code:error?.name==='AbortError'?'turnstile_timeout':'turnstile_unavailable'};}finally{clearTimeout(timeout);}
}

export class ProviderGateway{
  constructor({clock=()=>Date.now()}={}){this.clock=clock;this.providers=new Map();this.cache=new Map();}
  register(provider){
    if(!provider?.id||typeof provider.fetch!=='function'||!['approved_public_read_only','authorization_required','prohibited'].includes(provider.termsState))throw new Error('Invalid provider');
    this.providers.set(provider.id,Object.freeze({ttlMs:30_000,staleTtlMs:300_000,attribution:null,license:null,...provider}));return this;
  }
  catalog(){return [...this.providers.values()].map(({fetch,...provider})=>({...provider,configured:provider.termsState==='approved_public_read_only'}));}
  async request({providerId,capability,sourceIdentifier,params={},fallback=null}){
    const provider=this.providers.get(providerId),now=this.clock(),key=JSON.stringify([providerId,capability,sourceIdentifier,params]),cached=this.cache.get(key);
    const degraded=(reason)=>fallback?{data:structuredClone(fallback.data),provider:provider?.id||'deterministic-local',sourceIdentifier,observationTime:fallback.observationTime||new Date(now).toISOString(),ingestionTime:new Date(now).toISOString(),truthState:fallback.truthState||'simulated_demonstration',freshness:'not-live',quality:'deterministic',confidence:fallback.confidence??1,fallbackReason:reason,attribution:provider?.attribution||null,license:provider?.license||null}:{data:null,provider:provider?.id||null,sourceIdentifier,observationTime:null,ingestionTime:new Date(now).toISOString(),truthState:'unavailable',freshness:'unavailable',quality:'unavailable',confidence:0,fallbackReason:reason};
    if(!provider||provider.termsState==='prohibited')return degraded('provider_terms_prohibited');
    if(provider.termsState==='authorization_required')return degraded('provider_authorization_required');
    if(!provider.capabilities?.includes(capability))return degraded('provider_capability_unavailable');
    if(cached&&now-new Date(cached.observationTime).getTime()<=provider.ttlMs)return {...cached,truthState:'cached_provider',cache:{hit:true,stale:false}};
    try{
      const result=await provider.fetch({capability,sourceIdentifier,params});
      if(!result||!PROVIDER_TRUTH.has(result.truthState)||!result.observationTime)throw new Error('Unproven provider result');
      const response={data:result.data,provider:provider.id,sourceIdentifier,observationTime:new Date(result.observationTime).toISOString(),ingestionTime:new Date(now).toISOString(),truthState:result.truthState,freshness:result.freshness||'fresh',quality:result.quality||'verified',confidence:Math.min(1,Math.max(0,result.confidence??0.98)),fallbackReason:null,attribution:provider.attribution,license:provider.license,cache:{hit:false,stale:false}};
      this.cache.set(key,response);return structuredClone(response);
    }catch{
      if(cached&&now-new Date(cached.observationTime).getTime()<=provider.staleTtlMs)return {...cached,truthState:'stale_provider',freshness:'stale',quality:'degraded',confidence:Math.min(cached.confidence??0.7,0.7),fallbackReason:'provider_request_failed_using_stale_cache',cache:{hit:true,stale:true}};
      return degraded('provider_request_failed');
    }
  }
}

export class LocalFirstSyncEngine{
  constructor({userId=null,cloudOptIn=false,clock=()=>new Date().toISOString()}={}){this.userId=userId;this.cloudOptIn=cloudOptIn;this.clock=clock;this.state=cloudOptIn?'idle':'local-only';this.records=new Map();this.queue=[];this.conflicts=new Map();}
  setCloudOptIn(enabled){if(enabled&&!this.userId)throw new Error('Authenticated user required');this.cloudOptIn=Boolean(enabled);this.state=this.cloudOptIn?(this.queue.length?'queued':'idle'):'local-only';return this.snapshot();}
  upsertLocal(input){
    const id=input.id||crypto.randomUUID(),existing=this.records.get(id),record=Object.freeze({id,ownerId:this.userId,title:String(input.title||existing?.title||'Untitled calculation').slice(0,160),payload:structuredClone(input.payload??existing?.payload??{}),revision:(existing?.revision||0)+1,revisionId:crypto.randomUUID(),baseCloudRevision:input.baseCloudRevision??existing?.baseCloudRevision??null,updatedAt:this.clock(),deletedAt:null,syncStatus:this.cloudOptIn?'queued':'local-only'});
    this.records.set(id,record);if(this.cloudOptIn){this.queue.push({operationId:crypto.randomUUID(),type:'upsert',record:structuredClone(record),enqueuedAt:this.clock()});this.state='queued';}return structuredClone(record);
  }
  applyRemote(remote){
    if(!this.cloudOptIn)throw new Error('Cloud opt-in required');
    if(remote.ownerId!==this.userId)throw Object.assign(new Error('Cross-user record rejected'),{code:'tenant_isolation_violation'});
    const local=this.records.get(remote.id);
    if(local&&local.syncStatus!=='synced'&&local.baseCloudRevision!=null&&local.baseCloudRevision!==remote.revision){const conflict={id:remote.id,local:structuredClone(local),remote:structuredClone(remote),detectedAt:this.clock()};this.conflicts.set(remote.id,conflict);this.state='conflict';return {status:'conflict',conflict};}
    const accepted=Object.freeze({...structuredClone(remote),syncStatus:'synced'});this.records.set(remote.id,accepted);return {status:'applied',record:structuredClone(accepted)};
  }
  resolveConflict(id,strategy){const conflict=this.conflicts.get(id);if(!conflict)throw new Error('Conflict not found');let winner;if(strategy==='keep-local')winner=this.upsertLocal({...conflict.local,baseCloudRevision:conflict.remote.revision});else if(strategy==='keep-remote'){winner=Object.freeze({...structuredClone(conflict.remote),syncStatus:'synced'});this.records.set(id,winner);}else throw new Error('Invalid conflict strategy');this.conflicts.delete(id);this.state=this.conflicts.size?'conflict':this.queue.length?'queued':'idle';return structuredClone(winner);}
  nextBatch(limit=50){if(!this.cloudOptIn)return [];this.state=this.queue.length?'syncing':'idle';return structuredClone(this.queue.slice(0,limit));}
  acknowledge(operationIds,cloudRevisions={}){const accepted=new Set(operationIds);this.queue=this.queue.filter((operation)=>!accepted.has(operation.operationId));for(const [id,revision] of Object.entries(cloudRevisions)){const record=this.records.get(id);if(record)this.records.set(id,Object.freeze({...record,baseCloudRevision:revision,syncStatus:'synced'}));}this.state=this.conflicts.size?'conflict':this.queue.length?'queued':'idle';return this.snapshot();}
  exportUserData(){return {schemaVersion:1,exportedAt:this.clock(),userId:this.userId,cloudOptIn:this.cloudOptIn,records:[...this.records.values()].map(structuredClone),pendingOperations:structuredClone(this.queue)};}
  deleteAccountData(){this.records.clear();this.queue=[];this.conflicts.clear();this.cloudOptIn=false;this.userId=null;this.state='local-only';return this.snapshot();}
  snapshot(){return {state:this.state,cloudOptIn:this.cloudOptIn,userId:this.userId,records:this.records.size,queued:this.queue.length,conflicts:this.conflicts.size};}
}

export const QELLY_FREE_TIER_LIMITS_2026_08_01=Object.freeze({cloudflarePages:{buildsPerMonth:500,concurrentBuilds:1,filesPerSite:20_000,maxAssetBytes:25*1024*1024},cloudflareWorkers:{requestsPerDay:100_000},cloudflareTurnstile:{widgets:20,hostnamesPerWidget:10},supabase:{activeProjects:2,databaseBytes:500*1024*1024,monthlyActiveUsers:50_000,egressBytes:5*1024**3,cachedEgressBytes:5*1024**3,storageBytes:1*1024**3,edgeFunctionInvocations:500_000,realtimeMessages:2_000_000,realtimePeakConnections:200,inactivityPauseDays:7}});
export function assessQuota(usage,limits=QELLY_FREE_TIER_LIMITS_2026_08_01,{warn=.7,degrade=.85,stopWrites=.95}={}){
  const checks=[],add=(service,metric,used,limit)=>{const utilization=(used||0)/limit,action=utilization>=stopWrites?'stop-nonessential-writes':utilization>=degrade?'degrade-to-cache-and-local':utilization>=warn?'warn-admin':'normal';checks.push({service,metric,used:used||0,limit,utilization,action});};
  if(usage.cloudflarePages){add('cloudflarePages','buildsPerMonth',usage.cloudflarePages.buildsPerMonth,limits.cloudflarePages.buildsPerMonth);add('cloudflarePages','filesPerSite',usage.cloudflarePages.filesPerSite,limits.cloudflarePages.filesPerSite);}
  if(usage.cloudflareWorkers)add('cloudflareWorkers','requestsPerDay',usage.cloudflareWorkers.requestsPerDay,limits.cloudflareWorkers.requestsPerDay);
  if(usage.supabase)for(const metric of ['databaseBytes','monthlyActiveUsers','egressBytes','cachedEgressBytes','storageBytes','edgeFunctionInvocations','realtimeMessages','realtimePeakConnections'])add('supabase',metric,usage.supabase[metric],limits.supabase[metric]);
  const severity=checks.some((c)=>c.action==='stop-nonessential-writes')?'critical':checks.some((c)=>c.action==='degrade-to-cache-and-local')?'degraded':checks.some((c)=>c.action==='warn-admin')?'warning':'normal';
  return {severity,checks,safeguards:['no-payment-method-required','no-paid-plan','no-billable-overages','deterministic-local-fallback','cached-provider-fallback','nonessential-write-suspension']};
}
