import {isFiniteDecisionEvidence} from './decision-numeric-evidence.mjs';
const finite=(value)=>isFiniteDecisionEvidence(value)?Number(value):null;
const text=(value,fallback='UNAVAILABLE')=>String(value??fallback).trim()||fallback;
const uniqueBy=(items,key)=>{const seen=new Set();return items.filter(item=>{const value=key(item);if(!value||seen.has(value))return false;seen.add(value);return true;});};
const RR_PRESETS=Object.freeze([1,2,3,4]);
const LIFECYCLE=Object.freeze([
  ['NO_TRADE','—'],['FORMING','◌'],['VALID','✓'],['TRIGGERED','↗'],['ACTIVE','●'],['WEAKENING','△'],
  ['T1','①'],['T2','②'],['T3','③'],['T4','④'],['INVALIDATED','×'],['EXPIRED','⌛']
]);

const targetForRatio=(trade,ratio)=>(Array.isArray(trade?.matrix)?trade.matrix:[]).find(item=>Number(item?.ratio)===Number(ratio))||null;
const calibrationState=(data)=>data?.pastPresentFuture?.future?.probabilityCalibration||data?.confidence?.probabilityCalibration||data?.quant?.calibration||{};
const scenarioProbability=(raw,calibration)=>{
  const probability=finite(raw);
  if(probability===null)return {published:null,modelShare:null,state:'UNAVAILABLE',highProbabilityGate:false};
  const eligible=calibration?.eligible===true&&calibration?.diagnosticMetricsOnly!==true;
  const strictHighGate=calibration?.highProbabilityEligible===true||calibration?.strictHighProbabilityGate===true;
  const high=probability>=.8;
  const published=eligible&&(!high||strictHighGate)?probability:null;
  return {
    published,
    modelShare:probability,
    state:published!==null?(high?'STRICT_CALIBRATION_GATE_PASSED':'CALIBRATION_GATE_PASSED'):eligible&&high?'HIGH_PROBABILITY_WITHHELD':text(calibration?.calibrationState||calibration?.state,'UNCALIBRATED'),
    highProbabilityGate:high?strictHighGate:null
  };
};

const scenarioCards=(data)=>{
  const future=data?.pastPresentFuture?.future||{};
  const details=future.scenarioDetails||{};
  const calibration=calibrationState(data);
  const cards=[['bull','BULL'],['base','BASE'],['bear','BEAR']].map(([id,label])=>{
    const item=details[id]||{};
    const probability=scenarioProbability(item.probability,calibration);
    return {
      id,label,
      publishedProbability:probability.published,
      modelScenarioShare:probability.modelShare,
      probabilityState:probability.state,
      highProbabilityGate:probability.highProbabilityGate,
      calibrationSampleSize:Number(calibration?.sampleSize)||0,
      calibrationMinimumSampleGate:Number(calibration?.minimumSampleGate)||0,
      confidenceInterval95:calibration?.confidenceInterval95||null,
      targetRange:item.targetRange||null,
      whatMustHappen:item.trigger||'No evidence-backed trigger is available.',
      invalidation:item.invalidation||'Recompute when verified evidence changes.',
      whatChanges:item.whatChanges||''
    };
  });
  const tail=future.tail;
  if(tail?.state==='MODELLED_TAIL_BOUNDS')cards.push({
    id:'tail',label:'TAIL',publishedProbability:null,modelScenarioShare:null,probabilityState:'MODELLED_TAIL_BOUNDS',
    calibrationSampleSize:Number(calibration?.sampleSize)||0,calibrationMinimumSampleGate:Number(calibration?.minimumSampleGate)||0,
    confidenceInterval95:null,targetRange:{low:finite(tail.lower),high:finite(tail.upper)},
    whatMustHappen:tail.trigger||'Tail bounds are distribution limits, not a discrete event forecast.',
    invalidation:tail.invalidation||'Recompute when the observed sample changes.',
    whatChanges:tail.boundary||'',tailBoundary:true
  });
  return cards;
};

const watchNext=(data)=>{
  const details=data?.pastPresentFuture?.future?.scenarioDetails||{};
  const trade=data?.tradeResearch||{},evidence=data?.evidence||{};
  const candidates=[];
  const push=(kind,label,detail,state='WATCH')=>{if(detail)candidates.push({kind,label,detail,state});};
  push('structure','Bull trigger',details?.bull?.trigger);
  push('structure','Bear trigger',details?.bear?.trigger);
  push('setup','Entry confirmation',trade?.entry?.confirmationCondition||trade?.whatChangesView);
  const event=evidence.eventRisk||data?.eventRisk||{};
  if(String(event.state||'').toLowerCase()==='available'||Array.isArray(event.events)&&event.events.length){
    const next=event.events?.[0];
    push('event','Event risk',next?.name||next?.event||event.reason||'A verified event-risk condition is active.',text(event.level,'AVAILABLE'));
  }
  const derivatives=evidence.derivatives||{};
  if(String(derivatives.state||'').toLowerCase()!=='unavailable'){
    const parts=[];
    if(derivatives.fundingState)parts.push('funding '+text(derivatives.fundingState).replaceAll('_',' ').toLowerCase());
    if(derivatives.openInterestChangeState&&derivatives.openInterestChangeState!=='UNAVAILABLE')parts.push('OI '+text(derivatives.openInterestChangeState).replaceAll('_',' ').toLowerCase());
    if(parts.length)push('derivatives','Funding / OI shift','Current '+parts.join(' · ')+'. Reassess if this verified derivatives state changes materially.');
  }
  const cross=evidence.crossAsset||{};
  if(String(cross.state||'').toLowerCase()==='available'){
    push('cross-asset','Cross-asset confirmation',(cross.benchmark?text(cross.benchmark)+' · ':'')+text(cross.divergenceState,'UNAVAILABLE').replaceAll('_',' ')+'; reassess if the verified relationship changes materially.');
  }
  if(candidates.length<3)push('evidence','Evidence gate',data?.qellyView?.changesIf||trade?.whatChangesView||'Recompute when verified evidence changes.');
  if(candidates.length<3)push('freshness','Data freshness','Core market data must remain within the Decision freshness gate; stale or degraded core data can invalidate setup eligibility.');
  return uniqueBy(candidates,item=>item.label+'|'+item.detail).slice(0,5);
};

const lifecycleStages=(trade)=>{
  const current=text(trade?.lifecycle?.state||trade?.status,'NO_TRADE').replaceAll(' ','_').toUpperCase();
  return LIFECYCLE.map(([id,icon])=>({
    id,icon,label:id.replaceAll('_',' '),
    state:id===current?'CURRENT':id.startsWith('T')?'NOT_OBSERVED':'REFERENCE',
    current:id===current,
    observationBoundary:id.startsWith('T')?'Target milestones are not marked reached without persisted observed setup history.':null
  }));
};

const rrItem=(id,label,item,{active=false,kind='preset',reason=null}={})=>({
  id,label,kind,active,
  target:finite(item?.target),
  feasibility:text(item?.feasibility,'UNAVAILABLE'),
  feasibilityReason:item?.feasibilityReason||reason||'No target geometry is available.',
  probability:finite(item?.targetTouchProbability),
  probabilityState:finite(item?.targetTouchProbability)!==null?'CALIBRATED':'UNCALIBRATED',
  structuralObstruction:finite(item?.structuralBarrier??item?.nearestObstruction),
  structuralObstructionRr:finite(item?.structuralBarrierRr),
  targetCongestion:text(item?.targetCongestion,'UNAVAILABLE'),
  netRiskReward:finite(item?.netRiskReward)
});

const rrLadder=(trade,{requestedRr='auto',customRr=null}={})=>{
  const active=String(requestedRr??'auto');
  const cards=RR_PRESETS.map(ratio=>rrItem(String(ratio),'1:'+ratio,targetForRatio(trade,ratio),{active:active===String(ratio)}));
  cards.push(rrItem('auto','Auto',trade?.selected,{active:active==='auto',kind:'auto',reason:'Auto uses the existing governed target-selection score; it does not maximize nominal R:R.'}));
  const customRatio=finite(customRr??trade?.customRr);
  const customItem=customRatio===null?null:targetForRatio(trade,customRatio);
  cards.push(rrItem('custom',customRatio===null?'Custom':'1:'+customRatio+' Custom',customItem,{active:active==='custom',kind:'custom',reason:customRatio===null?'Choose a bounded custom R:R to calculate its target geometry.':'Custom target is unavailable until the existing trade-research engine returns it.'}));
  return cards;
};

const setupSummary=(data,{requestedRr='auto',customRr=null}={})=>{
  const trade=data?.tradeResearch||{},selected=trade.selected||null,lifecycle=text(trade?.lifecycle?.state||trade?.status,'NO_TRADE');
  const matrix=Array.isArray(trade.matrix)?trade.matrix:[];
  const targets=RR_PRESETS.map((ratio,index)=>{
    const item=matrix.find(candidate=>Number(candidate?.ratio)===ratio)||null;
    return {id:'T'+(index+1),ratio,target:finite(item?.target),feasibility:text(item?.feasibility,'UNAVAILABLE'),structuralObstruction:finite(item?.structuralBarrier??item?.nearestObstruction)};
  });
  const probability=finite(selected?.targetTouchProbability);
  return {
    status:lifecycle,
    direction:['BUY','SELL'].includes(text(trade?.action||data?.qellyView?.action))?text(trade?.action||data?.qellyView?.action):'NO TRADE',
    setupValid:trade?.status==='VALID',
    entry:trade?.entry?{method:text(trade.entry.method),preferred:finite(trade.entry.preferred),zone:Array.isArray(trade.entry.zone)?trade.entry.zone.map(finite):[],trigger:trade.entry.trigger||null,confirmation:trade.entry.confirmationCondition||null}:null,
    stop:finite(trade?.stop?.price),
    invalidation:trade?.invalidation||null,
    targets,
    selectedRr:selected?.label||text(trade?.requestedRr||requestedRr,'auto'),
    selectedTarget:finite(selected?.target),
    selectedFeasibility:text(selected?.feasibility,'UNAVAILABLE'),
    probability,
    probabilityState:probability===null?'UNCALIBRATED':'CALIBRATED',
    probabilityBoundary:trade?.calibration||'Target-touch probability is unavailable.',
    modelCalibrationState:text(trade?.calibrationState?.state,'UNCALIBRATED'),
    expiryAt:trade?.expiryAt||null,
    eventRisk:{state:text(trade?.riskContext?.eventRisk?.state,'UNAVAILABLE'),level:text(trade?.riskContext?.eventRisk?.level,'UNAVAILABLE'),reason:trade?.riskContext?.eventRisk?.reason||null},
    reason:trade?.reason||'No setup explanation is available.',
    requestedRr,
    customRr:finite(customRr)
  };
};

export function buildDecisionScenarioUx(data,options={}){
  return {
    schemaVersion:'qelly.decision-scenario-ux/1.0.0',
    scenarios:scenarioCards(data),
    watchNext:watchNext(data),
    setup:setupSummary(data,options),
    lifecycle:lifecycleStages(data?.tradeResearch||{}),
    rrLadder:rrLadder(data?.tradeResearch||{},options),
    boundaries:{
      derivedOnly:true,
      secondDecisionEngine:false,
      modelScenarioShareIsNotCalibratedProbability:true,
      targetTouchProbabilityNotFabricated:true,
      targetMilestonesRequireObservedHistory:true
    }
  };
}

export const __decisionScenarioUxTest=Object.freeze({finite,scenarioProbability,scenarioCards,watchNext,lifecycleStages,rrLadder,setupSummary,targetForRatio});
