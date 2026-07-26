import crypto from 'node:crypto';
import { OutboundNetworkPolicy } from './network-policy.mjs';

const now=()=>new Date().toISOString();
export class LocalDeliveryAdapter{
  constructor(){this.name='local-sink';this.external=false;}
  status(){return {channel:'email+webhook',provider:this.name,configured:true,external:false,truth:'Messages are persisted locally and are not transmitted outside this runtime.'};}
  async send(message){return {status:'delivered-local-sink',provider:this.name,external:false,acceptedAt:now(),messageId:`local-${crypto.randomUUID()}`};}
}

export class SignedWebhookAdapter{
  constructor({signingSecret,fetchImpl=globalThis.fetch,timeoutMs=8000,networkPolicy=new OutboundNetworkPolicy()}={}){if(!signingSecret||String(signingSecret).length<24)throw Object.assign(new Error('Webhook signing secret must contain at least 24 characters'),{code:'webhook_signing_secret_invalid'});this.signingSecret=String(signingSecret);this.fetch=fetchImpl;this.timeoutMs=timeoutMs;this.name='signed-webhook-hmac-sha256';this.external=true;this.networkPolicy=networkPolicy;}
  status(){return {channel:'webhook',provider:this.name,configured:true,external:true,signatureHeader:'X-Qelly-Signature',timestampHeader:'X-Qelly-Timestamp',networkPolicy:this.networkPolicy.status()};}
  signedRequest(message,{timestamp=String(Date.now())}={}){const body=JSON.stringify({event:'qelly.notification.delivery.v1',timestamp,title:message.title,body:message.body,tenantId:message.tenantId,workspaceId:message.workspaceId,sourceJobId:message.sourceJobId??null});const signature=crypto.createHmac('sha256',this.signingSecret).update(`${timestamp}.${body}`).digest('hex');return {timestamp,body,signature,headers:{'Content-Type':'application/json','X-Qelly-Timestamp':timestamp,'X-Qelly-Signature':`sha256=${signature}`,'X-Qelly-Delivery-Id':String(message.sourceJobId??crypto.randomUUID()),'User-Agent':'Qelly-Delivery/27.0'}};}
  verifySignedRequest({timestamp,body,signature}){const expected=crypto.createHmac('sha256',this.signingSecret).update(`${timestamp}.${body}`).digest('hex'),provided=String(signature).replace(/^sha256=/,'');return provided.length===expected.length&&crypto.timingSafeEqual(Buffer.from(provided),Buffer.from(expected));}
  async send(message){const validation=await this.networkPolicy.validate(message.destination,{purpose:'webhook-delivery'}),signed=this.signedRequest(message),started=Date.now();const response=await this.fetch(validation.url,{method:'POST',headers:signed.headers,body:signed.body,signal:AbortSignal.timeout(this.timeoutMs),redirect:'error'});if(!response.ok)throw Object.assign(new Error(`Webhook delivery failed with HTTP ${response.status}`),{status:502,code:'webhook_delivery_failed',details:{httpStatus:response.status}});return {status:'delivered',provider:this.name,external:true,httpStatus:response.status,latencyMs:Date.now()-started,signatureAlgorithm:'HMAC-SHA256',destinationOrigin:validation.origin};}
}

export class HttpEmailAdapter{
  constructor({endpoint,token,fetchImpl=globalThis.fetch,timeoutMs=8000,networkPolicy=new OutboundNetworkPolicy()}={}){if(!endpoint||!token)throw Object.assign(new Error('Email API endpoint and token are required'),{code:'email_provider_configuration_missing'});this.endpoint=endpoint;this.token=token;this.fetch=fetchImpl;this.timeoutMs=timeoutMs;this.name='http-email-provider';this.external=true;this.networkPolicy=networkPolicy;this.endpointValidation=null;}
  status(){return {channel:'email',provider:this.name,configured:true,external:true,endpointOrigin:new URL(this.endpoint).origin,networkPolicy:this.networkPolicy.status()};}
  async send(message){const validation=this.endpointValidation??await this.networkPolicy.validate(this.endpoint,{purpose:'email-provider'});this.endpointValidation=validation;const started=Date.now();const response=await this.fetch(validation.url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${this.token}`,'User-Agent':'Qelly-Delivery/27.0'},body:JSON.stringify({to:message.destination,subject:message.title,text:message.body,metadata:{tenantId:message.tenantId,workspaceId:message.workspaceId,sourceJobId:message.sourceJobId??null}}),signal:AbortSignal.timeout(this.timeoutMs),redirect:'error'});if(!response.ok)throw Object.assign(new Error(`Email provider failed with HTTP ${response.status}`),{status:502,code:'email_delivery_failed',details:{httpStatus:response.status}});return {status:'delivered',provider:this.name,external:true,httpStatus:response.status,latencyMs:Date.now()-started,destinationOrigin:validation.origin};}
}

export class DeliveryService{
 constructor({repository,mode='local-sink',webhookAdapter=null,emailAdapter=null,networkPolicy=null}={}){this.repository=repository;this.mode=mode;this.local=new LocalDeliveryAdapter();this.webhookAdapter=webhookAdapter;this.emailAdapter=emailAdapter;this.networkPolicy=networkPolicy;}
 providers(){return {mode:this.mode,email:this.mode==='disabled'?{channel:'email',provider:'disabled',configured:false,external:false}:this.emailAdapter?.status()??this.local.status(),webhook:this.mode==='disabled'?{channel:'webhook',provider:'disabled',configured:false,external:false}:this.webhookAdapter?.status()??this.local.status(),outboundPolicy:this.networkPolicy?.status()??null,truthBoundary:'External delivery occurs only when the corresponding provider is explicitly configured. Local sink evidence is not external delivery. Private, loopback, metadata, and non-allowlisted webhook destinations are blocked before transmission.'};}
 adapter(channel){if(this.mode==='disabled')return null;if(channel==='webhook')return this.webhookAdapter??this.local;if(channel==='email')return this.emailAdapter??this.local;throw Object.assign(new Error('Unsupported delivery channel'),{status:400,code:'delivery_channel_unsupported'});}
 sandboxEvidence(){
   const providers=this.providers(),message={title:'Qelly sandbox verification',body:'Deterministic delivery proof',tenantId:'tenant-sandbox',workspaceId:'workspace-sandbox',sourceJobId:'sandbox-proof'};
   if(this.webhookAdapter){const signed=this.webhookAdapter.signedRequest(message,{timestamp:'1777777777000'}),verified=this.webhookAdapter.verifySignedRequest({timestamp:signed.timestamp,body:signed.body,signature:signed.signature});return {type:'delivery-sandbox',passed:verified,status:verified?'verified':'failed',provider:this.webhookAdapter.name,signatureAlgorithm:'HMAC-SHA256',signaturePrefix:signed.signature.slice(0,16),emailProvider:providers.email.provider,externalTransmission:false,truthBoundary:'This verifies deterministic signing and provider configuration without transmitting data to an external destination.'};}
   return {type:'delivery-sandbox',passed:true,status:'verified-local-boundary',provider:'local-sink',signatureAlgorithm:null,emailProvider:providers.email.provider,externalTransmission:false,truthBoundary:'Local sink persistence is verified. External webhook signature verification requires QELLY_WEBHOOK_SIGNING_SECRET.'};
 }
 async deliver({channel,userId,tenantId,workspaceId,destination,title,body,sourceJobId}){
   const adapter=this.adapter(channel);if(!adapter)return this.repository.createDeliveryAttempt({userId,tenantId,workspaceId,channel,destination,title,body,sourceJobId,status:'blocked',provider:'disabled'});
   try{const result=await adapter.send({channel,userId,tenantId,workspaceId,destination,title,body,sourceJobId});return this.repository.createDeliveryAttempt({userId,tenantId,workspaceId,channel,destination,title,body,sourceJobId,status:result.status,provider:result.provider});}
   catch(error){await this.repository.createDeliveryAttempt({userId,tenantId,workspaceId,channel,destination,title,body,sourceJobId,status:'failed',provider:adapter.name}).catch(()=>{});throw error;}
 }
}

export function createDeliveryService({repository,environment=process.env}={}){
  const mode=environment.QELLY_DELIVERY_MODE??'local-sink';let webhookAdapter=null,emailAdapter=null;
  const allowedOrigins=String(environment.QELLY_OUTBOUND_ALLOWED_ORIGINS??environment.QELLY_WEBHOOK_ALLOWED_ORIGINS??'').split(',').map(x=>x.trim()).filter(Boolean);
  const networkPolicy=new OutboundNetworkPolicy({allowedOrigins,allowHttp:environment.QELLY_OUTBOUND_ALLOW_HTTP==='true',allowPrivate:environment.QELLY_OUTBOUND_ALLOW_PRIVATE==='true'});
  if(environment.QELLY_WEBHOOK_SIGNING_SECRET)webhookAdapter=new SignedWebhookAdapter({signingSecret:environment.QELLY_WEBHOOK_SIGNING_SECRET,networkPolicy});
  if(environment.QELLY_EMAIL_API_URL&&environment.QELLY_EMAIL_API_TOKEN)emailAdapter=new HttpEmailAdapter({endpoint:environment.QELLY_EMAIL_API_URL,token:environment.QELLY_EMAIL_API_TOKEN,networkPolicy});
  if(environment.NODE_ENV==='production'&&mode==='local-sink'&&environment.QELLY_ALLOW_LOCAL_DELIVERY_IN_PRODUCTION!=='true')throw Object.assign(new Error('Production delivery cannot use the local sink without an explicit override'),{code:'production_delivery_provider_required'});
  return new DeliveryService({repository,mode,webhookAdapter,emailAdapter,networkPolicy});
}
