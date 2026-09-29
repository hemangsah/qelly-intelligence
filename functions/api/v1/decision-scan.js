import {buildDecisionIntelligence} from './decision-proven-graph.js';
import {HttpError,enforceRateLimit,errorResponse,responseJson} from '../../_lib/runtime.js';
import {createDecisionLatencyTrace,estimateSerializedPayload} from '../../_lib/decision-latency.js';
import {DECISION_ASSET_SYMBOLS} from '../../_lib/decision-asset-capabilities.js';
import {coalesceDecisionWork,decisionWorkKey} from '../../_lib/decision-performance-cache.js';

export const DECISION_SCAN_ASSETS=DECISION_ASSET_SYMBOLS;
const INTERVALS=new Set(['1m','3m','5m','15m','30m','1h','2h','4h','1d']);
const HORIZONS=new Set(['1h','4h','12h','1d','3d','7d']);
const RR_VALUES=new Set(['auto','1','2','3','4','custom']);
const DIRECTIONS=new Set(['any','long','short']);
const LIQUIDITY_FILTERS=new Set(['any','live','tight']);
const VOLATILITY_FILTERS=new Set(['any','low','normal','elevated','high']);
const REGIME_FILTERS=new Set(['any','trending','ranging','transition','high_volatility']);
const EVENT_TOLERANCE=new Set(['any','low','medium','high']);
const FRESHNESS_FILTERS=new Set(['any','live','live_or_delayed']);
const SETUP_FRESHNESS=new Set(['any','current']);
const DISCOVERY_MODES=new Set(['validated','aggressive']);
const RANKING_PREFERENCES=new Set(['highest_quality','lowest_event_risk','closest_candidate']);
const INTERVAL_ORDER=Object.freeze(['1m','3m','5m','15m','30m','1h','2h','4h','1d']);
const INTERVAL_MS=Object.freeze({'1m':60_000,'3m':180_000,'5m':300_000,'15m':900_000,'30m':1_800_000,'1h':3_600_000,'2h':7_200_000,'4h':14_400_000,'1d':86_400_000});
const HORIZON_MS=Object.freeze({'1h':3_600_000,'4h':14_400_000,'12h':43_200_000,'1d':86_400_000,'3d':259_200_000,'7d':604_800_000});
const AGGRESSIVE_RELAXABLE_FILTER_FAILURES=new Set(['evidence_quality_below_minimum','mtf_agreement_below_minimum','live_liquidity_required','tight_liquidity_required','volatility_filter_mismatch','regime_filter_mismatch']);
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
  if(!unique.length||unique.some(asset=>!DECISION_SCAN_ASSETS.includes(asset)))throw new HttpError(400,'unsupported_scan_asset','Scanner assets must be drawn from '+DECISION_SCAN_ASSETS.join(', '));
  return unique;
};

const aggressiveIntervals=(interval,horizon)=>{
  const current=String(interval||'15m'),index=INTERVAL_ORDER.indexOf(current);
  if(index<0)return [current];
  const output=[current],horizonMs=HORIZON_MS[String(horizon||'4h')]??Infinity;
  const higher=INTERVAL_ORDER[index+1],lower=INTERVAL_ORDER[index-1];
  if(higher&&INTERVAL_MS[higher]<=horizonMs)output.push(higher);
  else if(lower)output.push(lower);
  return [...new Set(output)].slice(0,2);
};
const searchVariants=(universe,{mode='validated',interval='15m',horizon='4h'}={})=>{
  const intervals=mode==='aggressive'?aggressiveIntervals(interval,horizon):[interval];
  return universe.flatMap(asset=>intervals.map(timeframe=>({asset,interval:timeframe})));
};
const eventRiskScore=(candidate)=>{
  const level=String(candidate?.eventRisk?.level||'UNAVAILABLE').toUpperCase();
  return ({LOW:1,MEDIUM:.7,HIGH:.3,EXTREME:0,UNAVAILABLE:-1})[level]??-1;
};

const rankingComponents=(result)=>{
  const view=result?.qellyView||{},gate=view.evidenceGate||{},trade=result?.tradeResearch||{},selected=trade.selected||{};
  const quality=clamp(finite(gate.qualityScore)??0);
  const calibrationGatedEvidenceConfidence=gate.calibrationEligible===true?clamp(finite(view.confidence)??0):0;
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
  return {quality,calibrationGatedEvidenceConfidence,structure,rr,liquidity:liquidityScore,volatility,contradiction,eventRisk,freshness,targetCongestion};
};

const researchPriority=(result)=>{
  const c=rankingComponents(result);
  return round(100*(.22*c.quality+.14*c.calibrationGatedEvidenceConfidence+.12*c.structure+.14*c.rr+.08*c.liquidity+.07*c.volatility+.08*c.contradiction+.05*c.eventRisk+.06*c.freshness+.04*c.targetCongestion),1);
};

const normalizeFilters=(filters={})=>({
  direction:normalizeChoice(filters.direction,DIRECTIONS,'any','direction'),
  minEvidenceQuality:threshold(filters.minEvidenceQuality,'minimum evidence quality'),
  minCalibratedConfidence:threshold(filters.minCalibratedConfidence,'minimum calibration-gated evidence confidence'),
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
  const calibrationGatedEvidenceConfidence=gate.calibrationEligible===true?finite(view.confidence):null;
  if(filters.minCalibratedConfidence>0&&calibrationGatedEvidenceConfidence===null)failures.push('calibrated_confidence_unavailable');
  else if((calibrationGatedEvidenceConfidence??0)<filters.minCalibratedConfidence)failures.push('calibrated_confidence_below_minimum');
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

const feasibleDiscoveryTarget=(trade,mode)=>{
  const selected=trade?.selected||null;
  const feasible=(item)=>['HIGHLY FEASIBLE','FEASIBLE'].includes(String(item?.feasibility||''));
  if(mode!=='aggressive'||feasible(selected))return selected;
  const score=(item)=>{
    const feasibility=FEASIBILITY_WEIGHT[String(item?.feasibility||'UNAVAILABLE')]??0;
    const ratio=finite(item?.ratio);
    const boundedUtility=Number.isFinite(ratio)?Math.max(0,1-Math.abs(ratio-2)/4):0;
    const declared=finite(item?.selectionScore);
    return Number.isFinite(declared)?declared:100*(.8*feasibility+.2*boundedUtility);
  };
  return [...(Array.isArray(trade?.matrix)?trade.matrix:[]),...(Array.isArray(trade?.structuralTargets)?trade.structuralTargets:[])]
    .filter(feasible)
    .sort((a,b)=>score(b)-score(a)||(finite(a?.ratio)??99)-(finite(b?.ratio)??99))[0]||selected;
};

const coreValidationFailures=(result,{selected,entryReady}={})=>{
  const view=result?.qellyView||{},gate=view.evidenceGate||{},trade=result?.tradeResearch||{};
  const failures=[],action=String(view.action||'NO TRADE').toUpperCase(),truth=String(result?.truthState||'UNAVAILABLE').toUpperCase();
  if(!['LIVE','DELAYED'].includes(truth))failures.push('freshness_below_core_requirement');
  if(action!=='BUY'&&action!=='SELL')failures.push('directional_setup_unavailable');
  if(gate.calibrationEligible!==true)failures.push('calibration_gate_not_passed');
  if(!trade?.entry||!trade?.stop)failures.push('risk_structure_unavailable');
  if(!selected||!['HIGHLY FEASIBLE','FEASIBLE'].includes(String(selected.feasibility||'')))failures.push('feasible_rr_unavailable');
  if(!entryReady)failures.push('entry_condition_not_ready');
  const event=result?.eventRisk||result?.evidence?.eventRisk||{};
  if(String(event?.state||'').toLowerCase()==='available'&&String(event?.level||'').toUpperCase()==='EXTREME')failures.push('critical_event_risk');
  return [...new Set(failures)];
};

const humanCondition=(failure)=>({
  freshness_below_core_requirement:'Fresh live or delayed provider data must recover.',
  directional_setup_unavailable:'QELLY VIEW must become directionally eligible (BUY or SELL).',
  calibration_gate_not_passed:'The independent calibration gate must pass; probability cannot be fabricated.',
  risk_structure_unavailable:'A verified entry and invalidation structure must exist.',
  feasible_rr_unavailable:'At least one structurally feasible R:R target must exist.',
  entry_condition_not_ready:'The verified entry trigger must become ready without chasing price.',
  critical_event_risk:'Critical verified event risk must clear before validation.',
  direction_long_required:'A validated long setup must exist.',
  direction_short_required:'A validated short setup must exist.',
  event_risk_unavailable:'Verified event-risk evidence is required by the selected tolerance.',
  event_risk_above_tolerance:'Verified event risk must fall within the selected tolerance.',
  live_data_required:'Live provider data is required by the selected freshness filter.',
  freshness_below_requirement:'Provider freshness must meet the selected requirement.',
  setup_expired:'The setup must be recomputed from fresh evidence.',
  calibrated_confidence_unavailable:'Calibration-gated evidence confidence must become available.',
  calibrated_confidence_below_minimum:'Calibration-gated evidence confidence must meet the selected minimum.',
  evidence_quality_below_minimum:'Evidence quality should improve to the preferred threshold.',
  mtf_agreement_below_minimum:'Multi-timeframe agreement should improve to the preferred threshold.',
  live_liquidity_required:'Live L2 liquidity should become available.',
  tight_liquidity_required:'Verified spread should meet the preferred tight-liquidity condition.',
  volatility_filter_mismatch:'Volatility regime should match the selected preference.',
  regime_filter_mismatch:'Market regime should match the selected preference.'
})[failure]||String(failure||'condition').replaceAll('_',' ');

const closestCandidateSummary=(candidate)=>{
  if(!candidate)return null;
  const missing=[...new Set([...(candidate.validationFailures||[]),...(candidate.preferenceFailures||[])])];
  return {
    label:'CLOSEST CANDIDATE — NOT YET VALIDATED',
    validated:false,
    asset:candidate.asset,
    interval:candidate.interval,
    direction:candidate.action,
    possibleTrigger:candidate.trade?.trigger||candidate.trade?.reason||'Wait for a verified entry trigger.',
    missingConditions:missing,
    whatMustHappen:missing.map(humanCondition),
    probabilityState:candidate.evidence?.calibrationEligible?'CALIBRATION_GATE_PASSED':'UNCALIBRATED',
    calibratedProbability:null,
    contradiction:Array.isArray(candidate.contradictions)&&candidate.contradictions.length?candidate.contradictions[0]:null,
    eventRisk:candidate.eventRisk,
    researchPriority:candidate.researchPriority,
    boundary:'This is a research candidate only. It is not a valid setup, trade recommendation, target guarantee or substitute for missing evidence.'
  };
};

const candidateComparator=(ranking)=>(left,right)=>{
  if(left.eligible!==right.eligible)return left.eligible?-1:1;
  if(left.conditional!==right.conditional)return left.conditional?-1:1;
  if(ranking==='lowest_event_risk'){
    const eventDelta=eventRiskScore(right)-eventRiskScore(left);
    if(eventDelta)return eventDelta;
  }else if(ranking==='closest_candidate'){
    const distanceDelta=(left.validationDistance??999)-(right.validationDistance??999);
    if(distanceDelta)return distanceDelta;
  }
  if(left.researchPriority!==right.researchPriority)return (right.researchPriority??-1)-(left.researchPriority??-1);
  if(left.validationDistance!==right.validationDistance)return (left.validationDistance??999)-(right.validationDistance??999);
  return String(left.asset).localeCompare(String(right.asset))||String(left.interval).localeCompare(String(right.interval));
};

const compactCandidate=(result,{filters=normalizeFilters(),now=Date.now(),mode='validated'}={})=>{
  const view=result.qellyView||{},gate=view.evidenceGate||{},trade=result.tradeResearch||{};
  const selected=feasibleDiscoveryTarget(trade,mode);
  const action=String(view.action||'NO TRADE');
  const lifecycleState=String(trade?.lifecycle?.state||'').toUpperCase();
  const entryReady=!trade?.lifecycle||['VALID','TRIGGERED','ACTIVE'].includes(lifecycleState);
  const selectedFeasibility=String(selected?.feasibility||'UNAVAILABLE');
  const filterFailureList=filterFailures(result,filters,now);
  const relaxedPreferenceFailures=mode==='aggressive'?filterFailureList.filter(item=>AGGRESSIVE_RELAXABLE_FILTER_FAILURES.has(item)):[];
  const enforcedFilterFailures=mode==='aggressive'?filterFailureList.filter(item=>!AGGRESSIVE_RELAXABLE_FILTER_FAILURES.has(item)):filterFailureList;
  const coreFailures=coreValidationFailures(result,{selected,entryReady});
  const validationFailures=[...new Set([...coreFailures,...enforcedFilterFailures])];
  const baseDirectional=(action==='BUY'||action==='SELL')&&gate.calibrationEligible===true;
  const eligible=validationFailures.length===0;
  const conditional=!eligible&&baseDirectional&&validationFailures.length>0&&validationFailures.every(item=>item==='entry_condition_not_ready');
  const failures=[...validationFailures,...relaxedPreferenceFailures];
  const truthState=String(result.truthState||'UNAVAILABLE').toUpperCase();
  const state=['STALE','DEGRADED','ERROR'].includes(truthState)?'DATA_DEGRADED'
    :eligible?'VALID_SETUP'
    :conditional?'CONDITIONAL_SETUP'
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
    validationFailures,
    preferenceFailures:relaxedPreferenceFailures,
    relaxedPreferences:mode==='aggressive'?relaxedPreferenceFailures:[],
    validationDistance:round(validationFailures.length+relaxedPreferenceFailures.length*.25,2),
    discoveryMode:mode,
    researchPriority:researchPriority(result),
    researchPriorityComponents:Object.fromEntries(Object.entries(components).map(([key,value])=>[key,round(value,3)])),
    researchPriorityMeaning:'Evidence triage score only; it is not a probability, win rate, expected return or execution ranking.',
    evidence:{
      dataQualityState:result?.dataQuality?.state||'UNAVAILABLE',
      dataQualityScore:round(finite(result?.dataQuality?.score),3),
      qualityScore:round(finite(gate.qualityScore),3),
      calibrationGatedEvidenceConfidence:gate.calibrationEligible===true?round(finite(view.confidence),3):null,
      calibratedConfidence:gate.calibrationEligible===true?round(finite(view.confidence),3):null,
      confidenceMeaning:'Evidence-quality confidence exposed only when the independent scenario-calibration eligibility gate has passed. It is not a success probability, win rate or target-touch probability.',
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
      status:eligible?'VALID':trade.status||'NO_TRADE',
      sourceStatus:trade.status||'NO_TRADE',
      lifecycle:lifecycleState||null,
      entryReady,
      setupType:trade?.entry?.method||'UNAVAILABLE',
      trigger:trade?.entry?.trigger||null,
      confirmationCondition:trade?.entry?.confirmationCondition||null,
      reason:trade.reason||view.label||'No valid setup.',
      requestedRr:trade.requestedRr??null,
      rr:selected?.label??null,
      rrRelaxed:mode==='aggressive'&&Boolean(selected)&&selected!==trade.selected,
      searchedRiskRewards:[...new Set([...(Array.isArray(trade?.matrix)?trade.matrix:[]),...(Array.isArray(trade?.structuralTargets)?trade.structuralTargets:[])].map(item=>item?.label).filter(Boolean))],
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
  mode='validated',
  ranking='highest_quality',
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
  const resolvedMode=normalizeChoice(mode,DISCOVERY_MODES,'validated','discovery mode');
  const resolvedRanking=normalizeChoice(ranking,RANKING_PREFERENCES,'highest_quality','ranking preference');
  if(!INTERVALS.has(resolvedInterval))throw new HttpError(400,'unsupported_interval','Unsupported candle interval');
  if(!HORIZONS.has(resolvedHorizon))throw new HttpError(400,'unsupported_horizon','Supported horizons: 1h, 4h, 12h, 1d, 3d, 7d');
  if(!RR_VALUES.has(resolvedRr))throw new HttpError(400,'unsupported_risk_reward','Supported R:R choices: auto, 1, 2, 3, 4, custom');
  const observedAt=Number(now);
  if(!Number.isFinite(observedAt)||observedAt<=0)throw new HttpError(400,'invalid_observation_time','Observation time is invalid');
  const universe=resolveAssets(assets);
  const filters=normalizeFilters({direction,minEvidenceQuality,minCalibratedConfidence,minMtfAgreement,liquidity,volatility,regime,eventRiskTolerance,freshness,setupFreshness});
  const latency=createDecisionLatencyTrace();
  const variants=searchVariants(universe,{mode:resolvedMode,interval:resolvedInterval,horizon:resolvedHorizon});
  const concurrency=resolvedMode==='aggressive'?3:2;

  const settled=await mapPool(variants,concurrency,(variant)=>latency.time('asset:'+variant.asset+':'+variant.interval,()=>build(env,{
    asset:variant.asset,
    interval:variant.interval,
    horizon:resolvedHorizon,
    requestedRr:resolvedRr,
    customRr,
    includeNews:false,
    now:observedAt
  })));

  const candidates=[];
  const failures=[];
  const assetDecisionMs={};
  settled.forEach((result,index)=>{
    const variant=variants[index];
    if(result.status==='fulfilled'){
      candidates.push(compactCandidate(result.value,{filters,now:observedAt,mode:resolvedMode}));
      assetDecisionMs[variant.asset+':'+variant.interval]=finite(result.value?.performance?.totalMs);
    }else failures.push({asset:variant.asset,interval:variant.interval,state:'PROVIDER_UNAVAILABLE',reason:String(result.reason?.message||'Decision evidence unavailable').slice(0,240)});
  });

  if(!candidates.length)throw new HttpError(503,'provider_unavailable','No scan candidate could be verified from live provider evidence.',{retryable:true});

  candidates.sort(candidateComparator(resolvedRanking));
  const eligible=candidates.filter(item=>item.eligible);
  const conditionalCount=candidates.filter(item=>item.state==='CONDITIONAL_SETUP').length;
  const allDegraded=candidates.every(item=>item.state==='DATA_DEGRADED');
  const hasWait=candidates.some(item=>item.state==='WAIT');
  const state=eligible.length?'VALID_SETUP':conditionalCount?'CONDITIONAL_SETUP':allDegraded?'DATA_DEGRADED':hasWait?'WAIT':'NO_ELIGIBLE_SETUP';
  const closestPool=candidates.filter(item=>item.state!=='DATA_DEGRADED');
  const closestCandidate=eligible.length?null:closestCandidateSummary([...(closestPool.length?closestPool:candidates)].sort(candidateComparator('closest_candidate'))[0]||null);
  const setupTypes=[...new Set(candidates.map(item=>item.trade?.setupType).filter(item=>item&&item!=='UNAVAILABLE'))];
  const searchedRiskRewards=[...new Set(candidates.flatMap(item=>item.trade?.searchedRiskRewards||[]))];

  return {
    schemaVersion:'qelly.decision-scan/3.0.0',
    generatedAt:new Date(observedAt).toISOString(),
    state,
    mode:resolvedMode,
    ranking:resolvedRanking,
    universe,
    governedUniverse:DECISION_SCAN_ASSETS,
    interval:resolvedInterval,
    horizon:resolvedHorizon,
    riskReward:resolvedRr==='custom'?{mode:'custom',value:customRr}:{mode:resolvedRr},
    filters,
    searchPlan:{
      scope:universe.length===1?'CURRENT_ASSET':'ALL_SUPPORTED_MARKETS',
      assets:[...universe],
      intervals:[...new Set(variants.map(item=>item.interval))],
      directions:filters.direction==='any'?['LONG','SHORT']:[filters.direction.toUpperCase()],
      riskRewards:searchedRiskRewards.length?searchedRiskRewards:['1:1','1:2','1:3','1:4'],
      setupTypes,
      boundedVariantCount:variants.length,
      aggressiveBroadening:resolvedMode==='aggressive',
      boundary:'Aggressive Discovery broadens supported assets, adjacent supported timeframes and existing R:R/setup possibilities. It never fabricates direction, provider evidence, calibration, structural validity or event safety.'
    },
    validatedSetup:eligible[0]||null,
    closestCandidate,
    candidates,
    eligibleCount:eligible.length,
    conditionalCount,
    availableCount:candidates.length,
    unavailableCount:failures.length,
    failures,
    performance:latency.snapshot({
      assetDecisionMs,
      concurrency,
      database:{used:false,ms:null},
      network:'Measure end-to-end separately at the client or external probe; scanner timings exclude internet transit.'
    }),
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
      aggressiveCanFabricateValidSetup:false,
      aggressiveBypassesCalibration:false,
      aggressiveBypassesFreshness:false,
      aggressiveBypassesProviderFailure:false,
      aggressiveBypassesCriticalEventRisk:false,
      closestCandidateIsValidated:false,
      noTradeFirstClass:true
    }
  };
}

export async function onRequest({request,env}){
  try{
    if(request.method!=='GET')throw new HttpError(405,'method_not_allowed','Use GET for public Decision scanning');
    await enforceRateLimit(env,'decision-scan:'+ip(request),{limit:6,windowMs:60_000});
    const url=new URL(request.url);
    const params={
      interval:url.searchParams.get('interval')||'15m',
      horizon:url.searchParams.get('horizon')||'4h',
      requestedRr:url.searchParams.get('rr')||'auto',
      customRr:url.searchParams.get('customRr'),
      assets:url.searchParams.get('assets'),
      mode:url.searchParams.get('mode')||'validated',
      ranking:url.searchParams.get('ranking')||'highest_quality',
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
    };
    const workKey=decisionWorkKey('decision-scan',params,'scan-v3');
    const work=await coalesceDecisionWork(workKey,()=>runDecisionScan(env,params),{maxInflight:24});
    const result={...work.value,performance:{...work.value.performance,requestCoalescing:{coalesced:work.coalesced,capacityBypass:work.capacityBypass,activeAtJoin:work.activeAtJoin,maxInflight:24}}};
    const serialization=estimateSerializedPayload(result);
    result.performance={...result.performance,serializationEstimateMs:serialization.serializationMs,responseBytesEstimate:serialization.responseBytes};
    return responseJson(request,env,result,200,{cache:'public, max-age=2, must-revalidate'});
  }catch(error){return errorResponse(request,env,error);}
}

export const __decisionScanTest=Object.freeze({
  INTERVALS,HORIZONS,RR_VALUES,DIRECTIONS,LIQUIDITY_FILTERS,VOLATILITY_FILTERS,REGIME_FILTERS,EVENT_TOLERANCE,FRESHNESS_FILTERS,SETUP_FRESHNESS,DISCOVERY_MODES,RANKING_PREFERENCES,
  resolveAssets,aggressiveIntervals,searchVariants,normalizeFilters,filterFailures,rankingComponents,researchPriority,feasibleDiscoveryTarget,coreValidationFailures,closestCandidateSummary,candidateComparator,compactCandidate,mapPool
});
