import crypto from 'node:crypto';

const ALLOWED_EVENTS=new Set(['page_view','formula_opened','indicator_opened','calculation_completed','local_save_completed','cloud_opt_in_changed','sync_completed','sync_conflict','provider_state_changed','offline_state_changed','feedback_opened','account_export_requested','account_deletion_requested','error_boundary']);
const ALLOWED_PROPERTIES=new Set(['routeFamily','feature','state','providerId','truthState','releaseSha','deviceClass','theme','motion','errorClass','durationBucket','countBucket']);
const SENSITIVE_KEY=/(email|password|token|authorization|cookie|secret|input|output|result|payload|file|message|name|address|phone|wallet|seed|private.?key)/i;
const SENSITIVE_VALUE=/(bearer\s+[a-z0-9._-]+|-----BEGIN .*PRIVATE KEY-----|(?:seed|recovery) phrase)/i;

function bucketDuration(value){const n=Number(value);if(!Number.isFinite(n))return 'unknown';if(n<100)return '<100ms';if(n<500)return '100-499ms';if(n<1000)return '500-999ms';if(n<3000)return '1-2.9s';return '>=3s';}
function sanitizeProperties(properties={}){
  const safe={};
  for(const [key,value] of Object.entries(properties)){
    if(!ALLOWED_PROPERTIES.has(key)||SENSITIVE_KEY.test(key))continue;
    if(value==null||['string','number','boolean'].includes(typeof value)===false)continue;
    let normalized=String(value).slice(0,120);
    if(SENSITIVE_VALUE.test(normalized))continue;
    if(key==='durationBucket'&&typeof value==='number')normalized=bucketDuration(value);
    safe[key]=normalized;
  }
  return safe;
}
export function buildAnalyticsEvent(name,properties={},context={}){
  if(!ALLOWED_EVENTS.has(name))throw new Error('analytics_event_not_allowlisted');
  return Object.freeze({schemaVersion:1,event:name,properties:sanitizeProperties(properties),context:Object.freeze({releaseSha:String(context.releaseSha||'unresolved').slice(0,40),sessionId:context.sessionId?crypto.createHash('sha256').update(String(context.sessionId)).digest('hex').slice(0,16):null,occurredAt:new Date(context.occurredAt||Date.now()).toISOString()} )});
}
export class PrivacyAnalytics{
  constructor({enabled=false,consent=false,doNotTrack=globalThis.navigator?.doNotTrack==='1',send=async()=>{}}={}){this.enabled=enabled;this.consent=consent;this.doNotTrack=doNotTrack;this.send=send;this.queue=[];}
  canCollect(){return Boolean(this.enabled&&this.consent&&!this.doNotTrack);}
  track(name,properties,context){if(!this.canCollect())return {accepted:false,reason:this.doNotTrack?'do_not_track':!this.enabled?'disabled':'consent_required'};const event=buildAnalyticsEvent(name,properties,context);this.queue.push(event);return {accepted:true,event};}
  async flush(limit=50){if(!this.canCollect()||!this.queue.length)return {sent:0};const batch=this.queue.splice(0,Math.min(limit,this.queue.length));try{await this.send(batch);return {sent:batch.length};}catch(error){this.queue.unshift(...batch);return {sent:0,errorClass:error?.name||'analytics_transport_error'};}}
}

export function redactLogValue(value,depth=0){
  if(depth>8)return '[depth-redacted]';
  if(value==null||typeof value==='boolean'||typeof value==='number')return value;
  if(typeof value==='string')return SENSITIVE_VALUE.test(value)?'[redacted]':value.slice(0,500);
  if(Array.isArray(value))return value.slice(0,50).map((item)=>redactLogValue(item,depth+1));
  if(typeof value==='object'){
    const output={};
    for(const [key,nested] of Object.entries(value)){output[key]=SENSITIVE_KEY.test(key)?'[redacted]':redactLogValue(nested,depth+1);}
    return output;
  }
  return String(value).slice(0,120);
}
export function structuredLog(level,message,fields={}){
  if(!['debug','info','warn','error'].includes(level))throw new Error('invalid_log_level');
  return Object.freeze({timestamp:new Date().toISOString(),level,message:String(message).slice(0,300),correlationId:String(fields.correlationId||crypto.randomUUID()).slice(0,128),service:String(fields.service||'qelly-public-beta').slice(0,80),releaseSha:String(fields.releaseSha||'unresolved').slice(0,40),fields:redactLogValue(Object.fromEntries(Object.entries(fields).filter(([key])=>!['correlationId','service','releaseSha'].includes(key))))});
}
export function publicBetaReadiness({database='external_authorization_required',auth='external_authorization_required',providers='degraded_to_deterministic',quota='normal',deployment='validated_static_fallback',security='passing',rollback='documented'}={}){
  const dependencies={database,auth,providers,quota,deployment,security,rollback};
  const blockers=Object.entries(dependencies).filter(([,state])=>['failed','unknown','external_authorization_required'].includes(state)).map(([name,state])=>({name,state}));
  return {readyForDeterministicPublicBeta:security==='passing'&&deployment==='validated_static_fallback'&&quota!=='critical',readyForCloudPublicBeta:blockers.length===0,dependencies,blockers,truthBoundary:'Static deterministic readiness is independent from cloud authentication, persistence and provider activation.'};
}
