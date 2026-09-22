import {buildDecisionIntelligence} from './decision-proven-graph.js';
import {HttpError,enforceRateLimit,errorResponse,responseJson} from '../../_lib/runtime.js';

export const DECISION_SCAN_ASSETS=Object.freeze(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
const INTERVALS=new Set(['1m','5m','15m','30m','1h','4h','1d']);
const HORIZONS=new Set(['1h','4h','12h','1d','3d','7d']);
const RR_VALUES=new Set(['auto','1','2','3','4','custom']);
const ip=(request)=>request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'anonymous';
const finite=(value)=>Number.isFinite(Number(value))?Number(value):null;
const round=(value,digits=3)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;

const researchPriority=(result)=>{
  const gate=result?.qellyView?.evidenceGate||{};
  const quality=finite(gate.qualityScore)??0;
  const separation=finite(gate.scenarioSeparation)??0;
  const agreement=finite(gate.timeframeAgreement)??0;
  const freshness=finite(gate.freshness)??0;
  return round(100*(.40*quality+.25*separation+.25*agreement+.10*freshness),1);
};

const compactCandidate=(result)=>{
  const view=result.qellyView||{},gate=view.evidenceGate||{},trade=result.tradeResearch||{},selected=trade.selected||null;
  const action=String(view.action||'NO TRADE');
  const eligible=(action==='BUY'||action==='SELL')&&trade.status==='VALID'&&gate.calibrationEligible===true;
  return {
    asset:result.asset,
    interval:result.interval,
    horizon:result.horizon,
    observedAt:result.observedAt,
    truthState:result.truthState,
    action,
    eligible,
    researchPriority:researchPriority(result),
    researchPriorityMeaning:'Evidence triage score only; it is not a probability, win rate, expected return or execution ranking.',
    evidence:{
      qualityScore:round(finite(gate.qualityScore),3),
      scenarioSeparation:round(finite(gate.scenarioSeparation),3),
      timeframeAgreement:round(finite(gate.timeframeAgreement),3),
      timeframeDirection:gate.timeframeDirection||'UNAVAILABLE',
      calibrationState:gate.calibrationState||'UNCALIBRATED',
      calibrationEligible:gate.calibrationEligible===true,
      quantCoverage:gate.quantCoverage||'insufficient'
    },
    market:{
      lastPrice:finite(result.market?.lastPrice),
      regime:result.market?.currentState?.regime||result.quant?.regime||'UNAVAILABLE',
      volatilityRegime:result.quant?.volatility?.regime||'UNKNOWN',
      expectedMovePct:round(finite(result.quant?.volatility?.expectedMovePct),3)
    },
    trade:{
      status:trade.status||'NO_TRADE',
      reason:trade.reason||view.label||'No valid setup.',
      rr:selected?.label??null,
      feasibility:selected?.feasibility??null,
      entry:finite(trade.entry?.preferred),
      stop:finite(trade.stop?.price),
      target:finite(selected?.target),
      expiryAt:trade.expiryAt??null,
      targetTouchProbability:null,
      expectedValue:null
    },
    contradictions:Array.isArray(view.contradictions)?view.contradictions.slice(0,8):[]
  };
};

async function mapPool(items,limit,worker){
  const results=new Array(items.length);
  let next=0;
  const run=async()=>{
    while(true){
      const index=next++;
      if(index>=items.length)return;
      try{results[index]={status:'fulfilled',value:await worker(items[index],index)};}
      catch(reason){results[index]={status:'rejected',reason};}
    }
  };
  await Promise.all(Array.from({length:Math.min(limit,items.length)},run));
  return results;
}

export async function runDecisionScan(env,{
  interval='15m',
  horizon='4h',
  requestedRr='auto',
  customRr=null,
  now=Date.now(),
  build=buildDecisionIntelligence
}={}){
  const resolvedInterval=String(interval||'15m');
  const resolvedHorizon=String(horizon||'4h');
  const resolvedRr=String(requestedRr||'auto');
  if(!INTERVALS.has(resolvedInterval))throw new HttpError(400,'unsupported_interval','Unsupported candle interval');
  if(!HORIZONS.has(resolvedHorizon))throw new HttpError(400,'unsupported_horizon','Supported horizons: 1h, 4h, 12h, 1d, 3d, 7d');
  if(!RR_VALUES.has(resolvedRr))throw new HttpError(400,'unsupported_risk_reward','Supported R:R choices: auto, 1, 2, 3, 4, custom');
  const observedAt=Number(now);
  if(!Number.isFinite(observedAt)||observedAt<=0)throw new HttpError(400,'invalid_observation_time','Observation time is invalid');

  const settled=await mapPool(DECISION_SCAN_ASSETS,2,(asset)=>build(env,{
    asset,
    interval:resolvedInterval,
    horizon:resolvedHorizon,
    requestedRr:resolvedRr,
    customRr,
    includeNews:false,
    now:observedAt
  }));

  const candidates=[];
  const failures=[];
  settled.forEach((result,index)=>{
    const asset=DECISION_SCAN_ASSETS[index];
    if(result.status==='fulfilled')candidates.push(compactCandidate(result.value));
    else failures.push({asset,state:'unavailable',reason:String(result.reason?.message||'Decision evidence unavailable').slice(0,240)});
  });

  if(!candidates.length)throw new HttpError(503,'provider_unavailable','No scan candidate could be verified from live provider evidence.',{retryable:true});

  candidates.sort((left,right)=>{
    if(left.eligible!==right.eligible)return left.eligible?-1:1;
    if(left.researchPriority!==right.researchPriority)return (right.researchPriority??-1)-(left.researchPriority??-1);
    return left.asset.localeCompare(right.asset);
  });
  const eligible=candidates.filter(item=>item.eligible);

  return {
    schemaVersion:'qelly.decision-scan/1.0.0',
    generatedAt:new Date(observedAt).toISOString(),
    state:eligible.length?'eligible_setups':failures.length?'partial_no_eligible_setup':'no_eligible_setup',
    universe:DECISION_SCAN_ASSETS,
    interval:resolvedInterval,
    horizon:resolvedHorizon,
    riskReward:resolvedRr==='custom'?{mode:'custom',value:customRr}:{mode:resolvedRr},
    candidates,
    eligibleCount:eligible.length,
    availableCount:candidates.length,
    unavailableCount:failures.length,
    failures,
    eventRisk:{
      state:'unavailable',
      connectedFeed:false,
      reason:'No approved production event feed is connected. QELLY does not invent scheduled catalyst risk during the scan.'
    },
    boundaries:{
      researchOnly:true,
      execution:false,
      brokerIntegration:false,
      targetTouchProbabilityCalibrated:false,
      expectedValueCalibrated:false,
      fabricatedFallback:false,
      rankingIsSuccessProbability:false
    }
  };
}

export async function onRequest({request,env}){
  try{
    if(request.method!=='GET')throw new HttpError(405,'method_not_allowed','Use GET for public Decision scanning');
    await enforceRateLimit(env,'decision-scan:'+ip(request),{limit:6,windowMs:60_000});
    const url=new URL(request.url);
    const result=await runDecisionScan(env,{
      interval:url.searchParams.get('interval')||'15m',
      horizon:url.searchParams.get('horizon')||'4h',
      requestedRr:url.searchParams.get('rr')||'auto',
      customRr:url.searchParams.get('customRr')
    });
    return responseJson(request,env,result,200,{cache:'public, max-age=10, stale-while-revalidate=20'});
  }catch(error){return errorResponse(request,env,error);}
}

export const __decisionScanTest=Object.freeze({INTERVALS,HORIZONS,RR_VALUES,researchPriority,compactCandidate,mapPool});
