import {buildDecisionIntelligence} from '../decision-proven-graph.js';
import {initialObservationFromRecord,observePersistedSetup,setupRecordFromDecision,setupRowToClient} from '../../../_lib/decision-outcome-ledger.js';
import {buildTargetTouchCalibration} from '../../../_lib/decision-target-touch-calibration.js';
import {auditDecisionOutcomeData} from '../../../_lib/decision-outcome-data-quality.js';
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
const calibrationRows=async(env,session,workspaceId,{limit=2000}={})=>{
  const params=new URLSearchParams({
    select:'id,targets,metrics,resolved_outcome,regime,resolved_at,created_observed_at',
    workspace_id:`eq.${workspaceId}`,
    resolved_at:'not.is.null',
    order:'resolved_at.asc',
    limit:String(limit)
  });
  return restRequest(env,session.accessToken,`qelly_decision_setups?${params.toString()}`);
};
const researchSetupRows=async(env,session,workspaceId,{limit=2000}={})=>{
  const params=new URLSearchParams({select:'*',workspace_id:`eq.${workspaceId}`,order:'created_observed_at.asc',limit:String(limit)});
  return restRequest(env,session.accessToken,`qelly_decision_setups?${params.toString()}`,{exactCount:true});
};
const researchObservationRows=async(env,session,workspaceId,{limit=5000}={})=>{
  const params=new URLSearchParams({select:'*',workspace_id:`eq.${workspaceId}`,order:'observed_at.asc',limit:String(limit)});
  return restRequest(env,session.accessToken,`qelly_decision_setup_observations?${params.toString()}`,{exactCount:true});
};
// Research audits must not promote a bounded workspace sample to a complete
// scientific history. Reaching a cap is conservatively treated as incomplete.
export const parseExactCount=(contentRange)=>{
  const match=String(contentRange||'').trim().match(/^(?:\d+-\d+|\*)\/(\d+)$/);
  if(!match)return null;
  const count=Number(match[1]);
  return Number.isSafeInteger(count)&&count>=0?count:null;
};

export const researchHistoryBoundary=(setups,observations,{setupLimit=2000,observationLimit=5000,verifiedSetupTotal=null,verifiedObservationTotal=null}={})=>{
  const setupCount=Array.isArray(setups)?setups.length:0;
  const observationCount=Array.isArray(observations)?observations.length:0;
  const setupLimitReached=setupCount>=setupLimit;
  const observationLimitReached=observationCount>=observationLimit;
  const setupCountVerified=Number.isSafeInteger(verifiedSetupTotal)&&verifiedSetupTotal===setupCount;
  const observationCountVerified=Number.isSafeInteger(verifiedObservationTotal)&&verifiedObservationTotal===observationCount;
  const historyComplete=!setupLimitReached&&!observationLimitReached&&setupCountVerified&&observationCountVerified;
  return Object.freeze({
    setupLimit,observationLimit,setupCount,observationCount,
    verifiedSetupTotal,verifiedObservationTotal,setupCountVerified,observationCountVerified,
    setupLimitReached,observationLimitReached,historyComplete,
    state:historyComplete?'COMPLETE_WITHIN_RETRIEVAL_LIMITS':'INCOMPLETE_RETRIEVAL',
    boundary:historyComplete
      ?'No research retrieval cap was reached; observational validity is checked separately.'
      :'A research retrieval cap was reached or exact workspace totals do not match the returned rows. Unseen setups or observations could change outcome labels; scientific calibration is withheld.'
  });
};

export const buildResearchOutcomeAudit=(setups,observations,{setupLimit=2000,observationLimit=5000,verifiedSetupTotal=null,verifiedObservationTotal=null}={})=>{
  const sampleBoundary=researchHistoryBoundary(setups,observations,{setupLimit,observationLimit,verifiedSetupTotal,verifiedObservationTotal});
  const incomplete=!sampleBoundary.historyComplete;
  const visibleQuality=auditDecisionOutcomeData(setups||[],observations||[]);
  const dataQuality=incomplete
    ?{...visibleQuality,scientificallyUsable:false,assessmentScope:'CAPPED_VISIBLE_SAMPLE',
        boundary:visibleQuality.boundary+' The source history hit a retrieval cap; the visible data-quality result cannot establish complete-workspace integrity.'}
    :{...visibleQuality,assessmentScope:'COMPLETE_WITHIN_RETRIEVAL_LIMITS'};
  const contaminated=dataQuality.state==='CONTAMINATED';
  const blocked={schemaVersion:'qelly.target-touch-calibration/1.0.0',
    state:'UNCALIBRATED',eligible:false,eligibleResolvedSetups:0,minimumSampleGate:50,metrics:{}};
  const calibration=contaminated
    ?{...blocked,
        reason:'Outcome data-quality gate failed. Contaminated labels are excluded from scientific calibration.',
        qualityGate:'BLOCKED'
      }
    :incomplete
      ?{...blocked,
          reason:'Research setup or observation history is incomplete, capped, or lacks verified exact workspace totals. Scientific calibration is withheld.',
          qualityGate:'BLOCKED_INCOMPLETE_HISTORY'
        }
      :{
          ...buildTargetTouchCalibration(setups||[],{minSamples:50,warmup:20,minSegmentSamples:50,historyLimitReached:false}),
          qualityGate:dataQuality.state==='VALID'?'PASSED':dataQuality.state
        };
  return Object.freeze({dataQuality,calibration,sampleBoundary});
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

  if(relative==='research-audit'&&method==='GET'){
    const setupLimit=2000,observationLimit=5000;
    const [setupPage,observationPage]=await Promise.all([
      researchSetupRows(env,session,workspaceId,{limit:setupLimit}),
      researchObservationRows(env,session,workspaceId,{limit:observationLimit})
    ]);
    const setups=Array.isArray(setupPage?.data)?setupPage.data:[];
    const observations=Array.isArray(observationPage?.data)?observationPage.data:[];
    const verifiedSetupTotal=parseExactCount(setupPage?.contentRange);
    const verifiedObservationTotal=parseExactCount(observationPage?.contentRange);
    const {dataQuality,calibration,sampleBoundary}=buildResearchOutcomeAudit(setups,observations,{setupLimit,observationLimit,verifiedSetupTotal,verifiedObservationTotal});
    return responseJson(request,env,{
      dataQuality,
      calibration,
      sampleBoundary,
      boundary:'This audit uses only persisted observed Decision setup history. Empty history is NO_OBSERVED_DATA; contaminated or incomplete observation histories are never calibrated.'
    });
  }

  if(!relative&&method==='GET'){
    const historyLimit=2000;
    const [rows,history]=await Promise.all([
      setupRows(env,session,workspaceId,{limit:limitFor(url)}),
      calibrationRows(env,session,workspaceId,{limit:historyLimit})
    ]);
    const items=(rows||[]).map(setupRowToClient);
    const calibration=buildTargetTouchCalibration(history||[],{minSamples:50,warmup:20,minSegmentSamples:50,historyLimitReached:(history||[]).length>=historyLimit});
    return responseJson(request,env,{
      items,
      observedSetups:items.length,
      calibrationEligible:calibration.eligibleResolvedSetups,
      calibrationState:calibration.state,
      minimumSampleGate:calibration.minimumSampleGate,
      calibration,
      boundary:'Only setups created after tracking began are included. No historical setups are fabricated or backfilled.'
    });
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

export const __decisionLedgerApiTest=Object.freeze({routePath,limitFor,decisionArgs,argsFromRow,calibrationRows,researchSetupRows,researchObservationRows,parseExactCount,researchHistoryBoundary,buildResearchOutcomeAudit});
