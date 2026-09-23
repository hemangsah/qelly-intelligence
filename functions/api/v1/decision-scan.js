import {buildDecisionIntelligence} from './decision-proven-graph.js';
import {HttpError,enforceRateLimit,errorResponse,responseJson} from '../../_lib/runtime.js';

export const DECISION_SCAN_ASSETS=Object.freeze(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
const INTERVALS=new Set(['1m','5m','15m','30m','1h','4h','1d']);
const HORIZONS=new Set(['1h','4h','12h','1d','3d','7d']);
const RR_VALUES=new Set(['auto','1','2','3','4','custom']);
const DIRECTIONS=new Set(['any','long','short']);
const LIQUIDITY_FILTERS=new Set(['any','live','tight']);
const VOLATILITY_FILTERS=new Set(['any','low','normal','elevated','high']);
const REGIME_FILTERS=new Set(['any','trending','ranging','transition','high_volatility']);
const EVENT_TOLERANCE=new Set(['any','low','medium','high']);
const FRESHNESS_FILTERS=new Set(['any','live','live_or_delayed']);
const SETUP_FRESHNESS=new Set(['any','current']);
const FEASIBILITY_WEIGHT=Object.freeze({'HIGHLY FEASIBLE':1,FEASIBLE:.8,CONDITIONAL:.55,'LOW FEASIBILITY':.2,'NOT FEASIBLE':0,UNAVAILABLE:0});
const ip=(request)=>request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'anonymous';
const finite=(value)=>Number.isFinite(Number(value))?Number(value):null;
const round=(value,digits=3)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,value));

const normalizeChoice=(value,allowed,fallback,name)=>{
  const resolved=String(value??fallback).trim().toLowerCase();
  if(!allowed.has(resolved))throw new HttpError(400,'unsupported_scan_filter',`Unsupported ${name} filter`);
  return resolved;
};
const threshold=(value,name)=>{
  const parsed=value===null||value===undefined||value===''?0:Number(value);
  if(!Number.isFinite(parsed)||parsed<0||parsed>1)throw new HttpError(400,'invalid_scan_threshold',`${name} must be between 0 and 1`);
  return parsed;
};
const resolveAssets=(value)=>{
  if(value===null||value===undefined||value===''||value==='all')return [...DECISION_SCAN_ASSETS];
  const requested=(Array.isArray(value)?value:String(value).split(',')).map(item=>String(item).trim().toUpperCase()).filter(Boolean);
  const unique=[...new Set(requested)];
  if(!unique.length||unique.some(asset=>!DECISION_SCAN_ASSETS.includes(asset)))throw new HttpError(400,'unsupported_scan_asset','Scanner assets must be drawn from BTC, ETH, SOL, HYPE, XRP and DOGE');
  return unique;
};

const rankingComponents=(result)=>{
  const view=result?.qellyView||{},gate=view.evidenceGate||{},trade=result?.tradeResearch||{},selected=trade.selected||{};
  const quality=clamp(finite(gate.qualityScore)??0);
  const calibratedConfidence=gate.calibrationEligible===true?clamp(finite(view.confidence)??0):0;
  const structureState=String(result?.quant?.structure?.state||'UNAVAILABLE');
  const structure=structureState==='HH_HL'||structureState==='LH_LL'?1:structureState==='EXPANDING_RANGE'?0.72:structureState==='CONTRACTING_RANGE'?0.62:structureState==='MIXED'?0.42:0;
  const rr=FEASIBILITY_WEIGHT[String(selected.feasibility||'UNAVAILABLE')]??0;
  const liquidity=result?.liquidity||result?.evidence?.liquidity||{};
  const spread=finite(liquidity?.spreadBps);
  const liquidityScore=String(liquidity?.state||'').toLowerCase()==='live'?(spread===null?0.6:spread<=5?1:spread<=15?0.72:0.2):.35;
  const volatilityState=String(result?.quant?.volatility?.regime||'UNKNOWN').toUpperCase();
  const volatility=volatilityState==='NORMAL'?1:volatilityState==='LOW'?0.78:volatilityState==='ELEVATED'?0.62:volatilityState==='HIGH'?0.32:.45;
  const contradiction=clamp(1-Math.min(1,(Array.isArray(view.contradictions)?view.contradictions.length:0)/4));
  const event=result?.eventRisk||result?.evidence?.eventRisk||{};
  const eventLevel=String(event?.level||'UNAVAILABLE').toUpperCase();
  const eventRisk=eventLevel==='LOW'?1:eventLevel==='MEDIUM'?0.72:eventLevel==='HIGH'?0.35:eventLevel==='EXTREME'?0:.45;
  const freshness=clamp(finite(gate.freshness)??(String(result?.truthState||'').toUpperCase()==='LIVE'?1:0));
  const congestion=String(selected?.targetCongestion||'UNAVAILABLE');
  const targetCongestion=congestion==='CLEAR'?1:congestion==='AT_TARGET'?0.82:congestion==='NEAR_TARGET'?0.65:congestion==='BEFORE_TARGET'?0.1:.45;
  return {quality,calibratedConfidence,structure,rr,liquidity:liquidityScore,volatility,contradiction,eventRisk,freshness,targetCongestion};
};

const researchPriority=(result)=>{
  const c=rankingComponents(result);
  return round(100*(.22*c.quality+.14*c.calibratedConfidence+.12*c.structure+.14*c.rr+.08*c.liquidity+.07*c.volatility+.08*c.contradiction+.05*c.eventRisk+.06*c.freshness+.04*c.targetCongestion),1);
};

const normalizeFilters=(filters={})=>({
  direction:normalizeChoice(filters.direction,DIRECTIONS,'any','direction'),
  minEvidenceQuality:threshold(filters.minEvidenceQuality,'minimum evidence quality'),
  minCalibratedConfidence:threshold(filters.minCalibratedConfidence,'minimum calibrated confidence'),
  minMtfAgreement:threshold(filters.minMtfAgreement,'minimum multi-timeframe agreement'),
  liquidity:normalizeChoice(filters.liquidity,LIQUIDITY_FILTERS,'any','liquidity'),
  volatility:normalizeChoice(filters.volatility,VOLATILITY_FILTERS,'any','volatility'),
  regime:normalizeChoice(filters.regime,REGIME_FILTERS,'any','regime'),
  eventRiskTolerance:normalizeChoice(filters.eventRiskTolerance,EVENT_TOLERANCE,'any','event-risk tolerance'),
  freshness:normalizeChoice(filters.freshness,FRESHNESS_FILTERS,'live_or_delayed','freshness'),
  setupFreshness:normalizeChoice(filters.setupFreshness,SETUP_FRESHNESS,'current','setup freshness')
});

const filterFailures=(result,filters,now)=>{
  const view=result?.qellyView||{},gate=view.evidenceGate||{},trade=result?.tradeResearch||{};
  const action=String(view.action||'NO TRADE').toUpperCase();
  const failures=[];
  if(filters.direction==='long'&&action!=='BUY')failures.push('direction_long_required');
  if(filters.direction==='short'&&action!=='SELL')failures.push('direction_short_required');
  const quality=finite(gate.qualityScore)??0;
  if(quality<filters.minEvidenceQuality)failures.push('evidence_quality_below_minimum');
  const confidence=gate.calibrationEligible===true?finite(view.confidence):null;
  if(filters.minCalibratedConfidence>0&&confidence===null)failures.push('calibrated_confidence_unavailable');
  else if((confidence??0)<filters.minCalibratedConfidence)failures.push('calibrated_confidence_below_minimum');
  const mtf=finite(gate.timeframeAgreement)??0;
  if(mtf<filters.minMtfAgreement)failures.push('mtf_agreement_below_minimum');

  const liquidity=result?.liquidity||result?.evidence?.liquidity||{};
  const liquidityLive=String(liquidity?.state||'').toLowerCase()==='live';
  if(filters.liquidity==='live'&&!liquidityLive)failures.push('live_liquidity_required');
  if(filters.liquidity==='tight'&&(!liquidityLive||String(liquidity?.spreadState||'').toUpperCase()!=='TIGHT'))failures.push('tight_liquidity_required');

  const volatility=String(result?.quant?.volatility?.regime||'unknown').toLowerCase();
  if(filters.volatility!=='any'&&volatility!==filters.volatility)failures.push('volatility_filter_mismatch');
  const regime=String(result?.quant?.regime||result?.market?.currentState?.regime||'unavailable').toLowerCase();
  if(filters.regime!=='any'&&regime!==filters.regime)failures.push('regime_filter_mismatch');

  const event=result?.eventRisk||result?.evidence?.eventRisk||{};
  const eventState=String(event?.state||'unavailable').toLowerCase();
  const eventLevel=String(event?.level||'UNAVAILABLE').toUpperCase();
  if(filters.eventRiskTolerance!=='any'){
    if(eventState==='unavailable'||eventLevel==='UNAVAILABLE')failures.push('event_risk_unavailable');
    else{
      const levels={LOW:1,MEDIUM:2,HIGH:3,EXTREME:4};
      const maximum={low:1,medium:2,high:3}[filters.eventRiskTolerance]??4;
      if((levels[eventLevel]??4)>maximum)failures.push('event_risk_above_tolerance');
    }
  }

  const truth=String(result?.truthState||'UNAVAILABLE').toUpperCase();
  if(filters.freshness==='live'&&truth!=='LIVE')failures.push('live_data_required');
  if(filters.freshness==='live_or_delayed'&&!['LIVE','DELAYED'].includes(truth))failures.push('freshness_below_requirement');

  if(filters.setupFreshness==='current'&&trade?.expiryAt){
    const expiry=Date.parse(trade.expiryAt);
    if(Number.isFinite(expiry)&&now>expiry)failures.push('setup_expired');
  }
  return failures;
};

const compactCandidate=(result,{filters=normalizeFilters(),now=Date.now()}={})=>{
  const view=result.qellyView||{},gate=view.evidenceGate||{},trade=result.tradeResearch||{},selected=trade.selected||null;
  const action=String(view.action||'NO TRADE');
  const lifecycleState=String(trade?.lifecycle?.state||'').toUpperCase();
  const entryReady=!trade?.lifecycle||['VALID','TRIGGERED','ACTIVE'].includes(lifecycleState);
  const selectedFeasibility=String(selected?.feasibility||'UNAVAILABLE');
  const baseDirectional=(action==='BUY'||action==='SELL')&&trade.status==='VALID'&&gate.calibrationEligible===true;
  const failures=filterFailures(result,filters,now);
  const conditional=baseDirectional&&(!entryReady||selectedFeasibility==='CONDITIONAL');
  const eligible=baseDirectional&&entryReady&&['HIGHLY FEASIBLE','FEASIBLE'].includes(selectedFeasibility)&&failures.length===0;
  const truthState=String(result.truthState||'UNAVAILABLE').toUpperCase();
  const state=['STALE','DEGRADED','ERROR'].includes(truthState)?'DATA_DEGRADED'
    :eligible?'VALID_SETUP'
    :conditional&&failures.length===0?'CONDITIONAL_SETUP'
    :action==='WAIT'?'WAIT'
    :'NO_ELIGIBLE_SETUP';
  const components=rankingComponents(result);
  const liquidity=result?.liquidity||result?.evidence?.liquidity||{};
  const event=result?.eventRisk||result?.evidence?.eventRisk||{};
  return {
    asset:result.asset,
    interval:result.interval,
    horizon:result.horizon,
    observedAt:result.observedAt,
    truthState:result.truthState,
    action,
    state,
    eligible,
    conditional,
    filterFailures:failures,
    researchPriority:researchPriority(result),
    researchPriorityComponents:Object.fromEntries(Object.entries(components).map(([key,value])=>[key,round(value,3)])),
    researchPriorityMeaning:'Evidence triage score only; it is not a probability, win rate, expected return or execution ranking.',
    evidence:{
      qualityScore:round(finite(gate.qualityScore),3),
      calibratedConfidence:gate.calibrationEligible===true?round(finite(view.confidence),3):null,
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
      expectedMovePct:round(finite(result.quant?.volatility?.expectedMovePct),3),
      structure:result.quant?.structure?.state||'UNAVAILABLE',
      liquidityState:liquidity?.state||'unavailable',
      spreadState:liquidity?.spreadState||'UNAVAILABLE',
      spreadBps:round(finite(liquidity?.spreadBps),3)
    },
    eventRisk:{state:event?.state||'unavailable',level:event?.level||'UNAVAILABLE'},
    trade:{
      status:trade.status||'NO_TRADE',
      lifecycle:lifecycleState||null,
      entryReady,
      reason:trade.reason||view.label||'No valid setup.',
      rr:selected?.label??null,
      feasibility:selected?.feasibility??null,
      selectionScore:round(finite(selected?.selectionScore),2),
      selectionReason:selected?.selectionReason??null,
      targetCongestion:selected?.targetCongestion??'UNAVAILABLE',
      nearestObstruction:finite(selected?.nearestObstruction),
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
  assets=null,
  direction='any',
  minEvidenceQuality=0,
  minCalibratedConfidence=0,
  minMtfAgreement=0,
  liquidity='any',
  volatility='any',
  regime='any',
  eventRiskTolerance='any',
  freshness='live_or_delayed',
  setupFreshness='current',
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
  const universe=resolveAssets(assets);
  const filters=normalizeFilters({direction,minEvidenceQuality,minCalibratedConfidence,minMtfAgreement,liquidity,volatility,regime,eventRiskTolerance,freshness,setupFreshness});

  const settled=await mapPool(universe,2,(asset)=>build(env,{
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
    const asset=universe[index];
    if(result.status==='fulfilled')candidates.push(compactCandidate(result.value,{filters,now:observedAt}));
    else failures.push({asset,state:'PROVIDER_UNAVAILABLE',reason:String(result.reason?.message||'Decision evidence unavailable').slice(0,240)});
  });

  if(!candidates.length)throw new HttpError(503,'provider_unavailable','No scan candidate could be verified from live provider evidence.',{retryable:true});

  candidates.sort((left,right)=>{
    if(left.eligible!==right.eligible)return left.eligible?-1:1;
    if(left.conditional!==right.conditional)return left.conditional?-1:1;
    if(left.researchPriority!==right.researchPriority)return (right.researchPriority??-1)-(left.researchPriority??-1);
    return left.asset.localeCompare(right.asset);
  });
  const eligible=candidates.filter(item=>item.eligible);
  const conditionalCount=candidates.filter(item=>item.state==='CONDITIONAL_SETUP').length;
  const allDegraded=candidates.every(item=>item.state==='DATA_DEGRADED');
  const hasWait=candidates.some(item=>item.state==='WAIT');
  const state=eligible.length?'VALID_SETUP':conditionalCount?'CONDITIONAL_SETUP':allDegraded?'DATA_DEGRADED':hasWait?'WAIT':'NO_ELIGIBLE_SETUP';

  return {
    schemaVersion:'qelly.decision-scan/2.0.0',
    generatedAt:new Date(observedAt).toISOString(),
    state,
    universe,
    governedUniverse:DECISION_SCAN_ASSETS,
    interval:resolvedInterval,
    horizon:resolvedHorizon,
    riskReward:resolvedRr==='custom'?{mode:'custom',value:customRr}:{mode:resolvedRr},
    filters,
    candidates,
    eligibleCount:eligible.length,
    conditionalCount,
    availableCount:candidates.length,
    unavailableCount:failures.length,
    failures,
    eventRisk:{
      state:'unavailable',
      connectedFeed:false,
      reason:'No approved production event feed is connected. Any strict event-risk filter therefore fails closed; QELLY does not invent scheduled catalyst risk.'
    },
    boundaries:{
      researchOnly:true,
      execution:false,
      brokerIntegration:false,
      targetTouchProbabilityCalibrated:false,
      expectedValueCalibrated:false,
      fabricatedFallback:false,
      rankingIsSuccessProbability:false,
      noTradeFirstClass:true
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
      customRr:url.searchParams.get('customRr'),
      assets:url.searchParams.get('assets'),
      direction:url.searchParams.get('direction')||'any',
      minEvidenceQuality:url.searchParams.get('minEvidenceQuality'),
      minCalibratedConfidence:url.searchParams.get('minCalibratedConfidence'),
      minMtfAgreement:url.searchParams.get('minMtfAgreement'),
      liquidity:url.searchParams.get('liquidity')||'any',
      volatility:url.searchParams.get('volatility')||'any',
      regime:url.searchParams.get('regime')||'any',
      eventRiskTolerance:url.searchParams.get('eventRiskTolerance')||'any',
      freshness:url.searchParams.get('freshness')||'live_or_delayed',
      setupFreshness:url.searchParams.get('setupFreshness')||'current'
    });
    return responseJson(request,env,result,200,{cache:'public, max-age=10, stale-while-revalidate=20'});
  }catch(error){return errorResponse(request,env,error);}
}

export const __decisionScanTest=Object.freeze({
  INTERVALS,HORIZONS,RR_VALUES,DIRECTIONS,LIQUIDITY_FILTERS,VOLATILITY_FILTERS,REGIME_FILTERS,EVENT_TOLERANCE,FRESHNESS_FILTERS,SETUP_FRESHNESS,
  resolveAssets,normalizeFilters,filterFailures,rankingComponents,researchPriority,compactCandidate,mapPool
});
