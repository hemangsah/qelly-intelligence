import {buildDecisionIntelligence} from '../decision-proven-graph.js';
import {initialObservationFromRecord,observePersistedSetup,setupRecordFromDecision,setupRowToClient} from '../../../_lib/decision-outcome-ledger.js';
import {HttpError,UUID,bootstrapContext,correlationId,enforceRateLimit,errorResponse,jsonBody,requireCsrf,requireOrigin,resolveSession,responseJson,restRequest} from '../../../_lib/runtime.js';

const routePath=(context)=>{
  const value=context.params?.route;
  return (Array.isArray(value)?value.join('/'):String(value||'')).replace(/^\/+|\/+$/g,'');
};
const ensureUuid=(value)=>{const id=String(value||'');if(!UUID.test(id))throw new HttpError(400,'decision_setup_id_invalid','Decision setup identifier is invalid');return id;};
const limitFor=(url)=>Math.max(1,Math.min(100,Number.parseInt(url.searchParams.get('limit')||'25',10)||25));
const setupRows=async(env,session,workspaceId,{id=null,sourceSetupId=null,limit=25}={})=>{
  const params=new URLSearchParams({select:'*',workspace_id:`eq.${workspaceId}`,order:'created_observed_at.desc',limit:String(limit)});
  if(id)params.set('id',`eq.${id}`);
  if(sourceSetupId)params.set('source_setup_id',`eq.${sourceSetupId}`);
  return restRequest(env,session.accessToken,`qelly_decision_setups?${params.toString()}`);
};
const observationRows=async(env,session,workspaceId,setupId)=>{
  const params=new URLSearchParams({select:'*',workspace_id:`eq.${workspaceId}`,setup_id:`eq.${setupId}`,order:'observed_at.asc',limit:'500'});
  return restRequest(env,session.accessToken,`qelly_decision_setup_observations?${params.toString()}`);
};
const requireSetup=async(env,session,workspaceId,id)=>{
  const rows=await setupRows(env,session,workspaceId,{id,limit:1});
  if(!rows?.length)throw new HttpError(404,'decision_setup_not_found','Tracked Decision setup was not found');
  return rows[0];
};
const decisionArgs=(body={})=>({
  asset:body.asset||'BTC',
  interval:body.interval||'15m',
  horizon:body.horizon||'4h',
  requestedRr:body.rr||body.requestedRr||'auto',
  customRr:body.customRr??null,
  includeNews:false
});
const argsFromRow=(row)=>({
  asset:row.asset,
  interval:row.timeframe,
  horizon:row.horizon,
  requestedRr:row.requested_rr||'auto',
  customRr:row.provenance?.customRr??null,
  includeNews:false
});

async function handleLedger(context,relative,method,session,qelly){
  const {request,env}=context;
  const workspaceId=qelly.workspace.workspaceId;
  const ownerId=qelly.user.userId;
  const url=new URL(request.url);
  const segments=relative.split('/').filter(Boolean);

  if(!relative&&method==='GET'){
    const rows=await setupRows(env,session,workspaceId,{limit:limitFor(url)});
    const items=(rows||[]).map(setupRowToClient);
    const calibrationEligible=items.filter(item=>item.resolvedOutcome?.calibrationEligible===true).length;
    return responseJson(request,env,{items,observedSetups:items.length,calibrationEligible,calibrationState:'UNCALIBRATED',minimumSampleGate:50,boundary:'Only setups created after tracking began are included. No historical setups are fabricated or backfilled.'});
  }

  if(!relative&&method==='POST'){
    await requireCsrf(request);
    const body=await jsonBody(request);
    const decision=await buildDecisionIntelligence(env,decisionArgs(body));
    const prepared=setupRecordFromDecision(decision,{workspaceId,ownerId});
    if(!prepared.trackable)throw new HttpError(409,'decision_setup_not_trackable',prepared.reason);
    prepared.record.provenance={...prepared.record.provenance,customRr:body.customRr??null};
    const existing=await setupRows(env,session,workspaceId,{sourceSetupId:prepared.record.source_setup_id,limit:1});
    if(existing?.length)return responseJson(request,env,{item:setupRowToClient(existing[0]),created:false,idempotent:true});
    const rows=await restRequest(env,session.accessToken,'qelly_decision_setups',{method:'POST',body:prepared.record,prefer:'return=representation'});
    const created=rows?.[0];
    if(!created)throw new HttpError(409,'decision_setup_track_failed','The observed setup could not be persisted');
    await restRequest(env,session.accessToken,'qelly_decision_setup_observations',{method:'POST',body:initialObservationFromRecord(created,decision),prefer:'return=minimal'});
    return responseJson(request,env,{item:setupRowToClient(created),created:true,idempotent:false},201);
  }

  const id=ensureUuid(segments[0]);
  const suffix=segments.slice(1).join('/');

  if(!suffix&&method==='GET'){
    const item=await requireSetup(env,session,workspaceId,id);
    const observations=await observationRows(env,session,workspaceId,id);
    return responseJson(request,env,{item:setupRowToClient(item),observations:observations||[],boundary:'Observation history is append-only and starts at the first explicit tracking event.'});
  }

  if(suffix==='observe'&&method==='POST'){
    await requireCsrf(request);
    const setup=await requireSetup(env,session,workspaceId,id);
    if(setup.resolved_at)return responseJson(request,env,{item:setupRowToClient(setup),observed:false,terminal:true});
    const decision=await buildDecisionIntelligence(env,argsFromRow(setup));
    const transition=observePersistedSetup(setup,decision);
    if(!transition.changed)return responseJson(request,env,{item:setupRowToClient(setup),observed:false,reason:transition.reason});
    const rows=await restRequest(env,session.accessToken,`qelly_decision_setups?id=eq.${id}&workspace_id=eq.${workspaceId}`,{method:'PATCH',body:transition.patch,prefer:'return=representation'});
    const updated=rows?.[0]||{...setup,...transition.patch};
    await restRequest(env,session.accessToken,'qelly_decision_setup_observations',{method:'POST',body:{...transition.observation,owner_id:ownerId},prefer:'return=minimal'});
    return responseJson(request,env,{item:setupRowToClient(updated),observed:true});
  }

  throw new HttpError(404,'decision_ledger_route_not_found','Decision outcome-ledger route was not found');
}

export async function onRequest(context){
  const {request,env}=context;
  const method=request.method.toUpperCase();
  const relative=routePath(context);
  let response;
  const started=Date.now();
  try{
    if(method==='OPTIONS')return context.next();
    if(!['GET','HEAD'].includes(method))requireOrigin(request,env);
    const session=await resolveSession(request,env,{required:true});
    await enforceRateLimit(env,`decision-ledger:${session.user.id}:${relative||'root'}`,{limit:60});
    const qelly=await bootstrapContext(env,session);
    response=await handleLedger(context,relative,method,session,qelly);
    return response;
  }catch(error){
    response=errorResponse(request,env,error);
    return response;
  }finally{
    try{console.log(JSON.stringify({event:'qelly_decision_ledger_request',correlationId:correlationId(request),method,path:new URL(request.url).pathname,status:response?.status??500,durationMs:Date.now()-started,bodyLogged:false}));}catch{}
  }
}

export const __decisionLedgerApiTest=Object.freeze({routePath,limitFor,decisionArgs,argsFromRow});
