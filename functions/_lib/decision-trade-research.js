const RR_PRESETS=Object.freeze([1,2,3,4]);
const finite=(value)=>{const number=Number(value);return Number.isFinite(number)?number:null;};
const round=(value,digits=4)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const parseRequested=(value,customRr)=>{
  const raw=String(value??'auto').trim().toLowerCase();
  if(raw==='auto')return {mode:'auto',ratio:null};
  if(raw==='custom'){
    const ratio=finite(customRr);
    return ratio!==null&&ratio>=.5&&ratio<=10?{mode:'custom',ratio:round(ratio,2)}:{mode:'custom',ratio:null};
  }
  const ratio=finite(raw.replace(/^1:/,''));
  return RR_PRESETS.includes(ratio)?{mode:'preset',ratio}:{mode:'auto',ratio:null};
};
const targetFor=(entry,risk,direction,ratio)=>round(entry+direction*risk*ratio,2);
const inRange=(value,range)=>Number.isFinite(value)&&Array.isArray(range)&&range.length===2&&value>=Math.min(...range)&&value<=Math.max(...range);

const feasibility=(direction,target,terminal,{entry=null,structure=null,expectedMovePct=null}={})=>{
  const p05=finite(terminal?.p05),p25=finite(terminal?.p25),p75=finite(terminal?.p75),p95=finite(terminal?.p95);
  if(![p05,p25,p75,p95].every(Number.isFinite))return {state:'UNAVAILABLE',reason:'Forecast quantiles are incomplete.',structuralBarrier:null};
  const resistance=finite(structure?.resistance),support=finite(structure?.support);
  const structuralBarrier=direction>0&&resistance!==null&&resistance>entry&&resistance<target?resistance:direction<0&&support!==null&&support<entry&&support>target?support:null;
  const expectedMove=Number.isFinite(entry)&&Number.isFinite(expectedMovePct)?Math.abs(entry*expectedMovePct/100):null;
  const distance=Number.isFinite(entry)?Math.abs(target-entry):null;
  if(direction>0){
    if(target>p95)return {state:'NOT FEASIBLE',reason:'Target lies beyond the model p95 favorable range.',structuralBarrier};
    if(structuralBarrier!==null)return {state:'LOW',reason:'A verified recent resistance level sits before the requested target.',structuralBarrier};
    if(expectedMove!==null&&distance>expectedMove*1.5)return {state:'LOW',reason:'Target distance materially exceeds the volatility-conditioned expected move.',structuralBarrier:null};
    if(target<=p75)return {state:'HIGH',reason:'Target remains inside the model p75 favorable range with no nearer structural barrier.',structuralBarrier:null};
    return {state:'MEDIUM',reason:'Target is inside the model p95 favorable tail but beyond p75.',structuralBarrier:null};
  }
  if(target<p05)return {state:'NOT FEASIBLE',reason:'Target lies beyond the model p05 favorable range.',structuralBarrier};
  if(structuralBarrier!==null)return {state:'LOW',reason:'A verified recent support level sits before the requested target.',structuralBarrier};
  if(expectedMove!==null&&distance>expectedMove*1.5)return {state:'LOW',reason:'Target distance materially exceeds the volatility-conditioned expected move.',structuralBarrier:null};
  if(target>=p25)return {state:'HIGH',reason:'Target remains inside the model p25 favorable range with no nearer structural barrier.',structuralBarrier:null};
  return {state:'MEDIUM',reason:'Target is inside the model p05 favorable tail but beyond p25.',structuralBarrier:null};
};

function expiryBars(intervalMs,horizonBars,volatilityRegime){
  const intraday=intervalMs<=15*60_000?6:intervalMs<=60*60_000?8:6;
  const volatilityFactor=volatilityRegime==='HIGH'?.6:volatilityRegime==='ELEVATED'?.8:volatilityRegime==='LOW'?1.25:1;
  return Math.max(2,Math.min(12,Math.min(horizonBars,Math.round(intraday*volatilityFactor))));
}

function entryPlan({action,lastPrice,entryZone,structure}){
  const low=Math.min(...entryZone),high=Math.max(...entryZone);
  const breakout=String(structure?.breakout||'NONE');
  if(inRange(lastPrice,entryZone))return {method:'NOW',trigger:'Price is inside the validated entry zone.',confirmation:'Evidence gate remains cleared while price holds the entry zone.',invalidCondition:'Price leaves the zone through the structural invalidation side before confirmation.'};
  if(action==='BUY'&&breakout==='UPSIDE'&&lastPrice>high)return {method:'RETEST',trigger:'Wait for a controlled retest of the validated entry zone after the upside break.',confirmation:'Retest holds and directional evidence remains aligned.',invalidCondition:'Retest fails through structural support or the evidence gate closes.'};
  if(action==='SELL'&&breakout==='DOWNSIDE'&&lastPrice<low)return {method:'RETEST',trigger:'Wait for a controlled retest of the validated entry zone after the downside break.',confirmation:'Retest rejects and directional evidence remains aligned.',invalidCondition:'Retest fails through structural resistance or the evidence gate closes.'};
  if(action==='BUY'&&lastPrice>high)return {method:'PULLBACK',trigger:'Do not chase price; wait for a pullback into the validated entry zone.',confirmation:'Pullback stabilizes without breaking structural invalidation.',invalidCondition:'Price invalidates structure before a pullback entry forms.'};
  if(action==='SELL'&&lastPrice<low)return {method:'PULLBACK',trigger:'Do not chase price; wait for a rebound into the validated entry zone.',confirmation:'Rebound rejects without breaking structural invalidation.',invalidCondition:'Price invalidates structure before a rebound entry forms.'};
  return {method:'WAIT',trigger:'Price is not in a supported entry location yet.',confirmation:'Wait for structure and price to align with the validated entry zone.',invalidCondition:'Evidence or structure changes before an entry trigger forms.'};
}

function structuralCandidate({entry,risk,direction,structure,terminal,expectedMovePct}){
  const level=direction>0?finite(structure?.resistance):finite(structure?.support);
  if(!Number.isFinite(level)||(direction>0?level<=entry:level>=entry))return null;
  const ratio=Math.abs(level-entry)/risk;
  if(!(ratio>=.5&&ratio<=10))return null;
  const support=feasibility(direction,level,terminal,{entry,structure:null,expectedMovePct});
  return {
    ratio:round(ratio,2),
    label:'1:'+round(ratio,2)+' structural',
    target:round(level,2),
    rewardDistance:round(Math.abs(level-entry),2),
    riskDistance:round(risk,2),
    feasibility:support.state,
    feasibilityReason:'Nearest validated structural barrier defines the target. '+support.reason,
    structuralBarrier:round(level,2),
    source:'STRUCTURE',
    targetTouchProbability:null,
    expectedValue:null,
    netRatio:null,
    costState:'UNAVAILABLE'
  };
}

function invalidationPlan({action,invalidation,structure,expiryAt,view,graph}){
  const directional=action==='BUY'||action==='SELL';
  const structuralLevel=action==='BUY'?finite(structure?.support):action==='SELL'?finite(structure?.resistance):null;
  const regime=String(graph?.quant?.regime||'UNKNOWN');
  const eventState=String(graph?.eventRisk?.state||graph?.evidence?.eventRisk?.state||'UNAVAILABLE').toUpperCase();
  return {
    price:{state:Number.isFinite(invalidation)?'AVAILABLE':'UNAVAILABLE',level:round(invalidation,2),reason:Number.isFinite(invalidation)?'Price crossing the validated stop level invalidates the current price thesis.':'No validated price stop is available.'},
    structural:{state:Number.isFinite(structuralLevel)?'AVAILABLE':'UNAVAILABLE',level:round(structuralLevel,2),reason:Number.isFinite(structuralLevel)?(action==='BUY'?'A break below recent structural support invalidates the long structure.':'A break above recent structural resistance invalidates the short structure.'):'A distinct structural invalidation level is unavailable.'},
    evidence:{state:directional?'AVAILABLE':'UNAVAILABLE',conditions:directional?['Multi-timeframe direction flips or becomes severely conflicted.','Walk-forward calibration loses eligibility.','Evidence quality/freshness falls below the directional gate.']:[],reason:view?.changesIf||'Reassess when material evidence changes.'},
    time:{state:expiryAt?'AVAILABLE':'UNAVAILABLE',expiresAt:expiryAt,reason:expiryAt?'Setup must be recomputed after expiry; validity is not carried forward indefinitely.':'A bounded expiry could not be established.'},
    event:{state:eventState==='LOW'||eventState==='MEDIUM'||eventState==='HIGH'||eventState==='EXTREME'?eventState:'UNAVAILABLE',reason:eventState==='UNAVAILABLE'?'No approved scheduled event-risk feed is connected, so event invalidation is not inferred.':'Reassess if verified event risk materially changes.'},
    regime:{state:regime==='UNKNOWN'?'UNAVAILABLE':'AVAILABLE',current:regime,invalidIf:'A material regime transition breaks the assumptions supporting entry, volatility or target feasibility.'}
  };
}

function lifecycleState({directional,valid,expired,entryMethod,truthState}){
  if(!directional)return 'NO_TRADE';
  if(expired)return 'EXPIRED';
  if(!valid)return 'FORMING';
  if(truthState==='STALE'||truthState==='DEGRADED')return 'WEAKENING';
  if(entryMethod==='NOW')return 'TRIGGERED';
  if(entryMethod==='WAIT')return 'FORMING';
  return 'VALID';
}

export function buildTradeResearch(graph,{requestedRr='auto',customRr=null,now=null}={}){
  const request=parseRequested(requestedRr,customRr);
  const view=graph?.qellyView||{};
  const action=String(view.action||'NO TRADE');
  const directional=action==='BUY'||action==='SELL';
  const levels=view.levels;
  const entryZone=Array.isArray(levels?.entryZone)?levels.entryZone.map(finite):[];
  const invalidation=finite(levels?.invalidation);
  const lastPrice=finite(graph?.market?.lastPrice);
  const intervalMs=finite(graph?.freshness?.intervalMs);
  const observedAt=Date.parse(graph?.observedAt||'');
  const generatedAt=Date.parse(graph?.generatedAt||graph?.observedAt||'');
  const evaluationTime=Number.isFinite(Number(now))?Number(now):(Number.isFinite(generatedAt)?generatedAt:Date.now());
  const horizonBars=Math.max(1,Number(graph?.horizonBars)||1);
  const contradictions=Array.isArray(view.contradictions)?view.contradictions:[];
  const volatilityRegime=String(graph?.quant?.volatility?.regime||'UNKNOWN');
  const structure=graph?.quant?.structure||null;
  const base={
    schemaVersion:'qelly.trade-research/1.1.0',
    requestedRr:request.mode==='custom'?'custom':request.mode==='preset'?'1:'+request.ratio:'auto',
    customRr:request.mode==='custom'?request.ratio:null,
    action,
    researchOnly:true,
    execution:false,
    confidence:finite(view.confidence),
    evidenceQuality:finite(view.evidenceGate?.qualityScore),
    contradictions,
    whatChangesView:view.changesIf||'Reassess when fresh evidence changes.',
    calibration:'Target-touch probability and trade win rate are not independently calibrated unless explicitly supplied by a validated target-touch model.',
    calibrationState:graph?.quant?.calibration||{state:'UNCALIBRATED',sampleSize:0,brierScore:null,reliabilityBins:[]},
    riskContext:{volatilityRegime,expectedMovePct:finite(graph?.quant?.volatility?.expectedMovePct),marketStructure:structure},
    costs:{state:'UNAVAILABLE',netRiskReward:null,reason:'Verified spread/fee inputs are not available in this research view, so net R:R is not fabricated.'}
  };
  if(!directional||entryZone.length!==2||!entryZone.every(Number.isFinite)||!Number.isFinite(invalidation)){
    return {...base,status:'NO_TRADE',reason:'The current evidence gate does not support a directional setup.',entry:null,stop:null,expiryAt:null,lifecycle:{state:'NO_TRADE',createdAt:null,lastValidatedAt:null,expiresAt:null,history:[]},invalidations:invalidationPlan({action,invalidation,structure,expiryAt:null,view,graph}),targets:[],matrix:[],selected:null};
  }
  const entry=round((entryZone[0]+entryZone[1])/2,2);
  const risk=Math.abs(entry-invalidation);
  if(!(risk>0))return {...base,status:'NO_TRADE',reason:'A valid risk distance could not be established.',entry:null,stop:null,expiryAt:null,lifecycle:{state:'NO_TRADE',createdAt:null,lastValidatedAt:null,expiresAt:null,history:[]},invalidations:invalidationPlan({action,invalidation,structure,expiryAt:null,view,graph}),targets:[],matrix:[],selected:null};

  const direction=action==='BUY'?1:-1;
  const terminalPoint=graph?.forecast?.fan?.at?.(-1)||null;
  const expectedMovePct=finite(graph?.quant?.volatility?.expectedMovePct);
  const ratios=[...RR_PRESETS];
  if(request.mode==='custom'&&Number.isFinite(request.ratio)&&!ratios.includes(request.ratio))ratios.push(request.ratio);
  ratios.sort((a,b)=>a-b);
  const matrix=ratios.map(ratio=>{
    const target=targetFor(entry,risk,direction,ratio);
    const support=feasibility(direction,target,terminalPoint,{entry,structure,expectedMovePct});
    return {
      ratio:round(ratio,2),
      label:'1:'+round(ratio,2),
      target,
      rewardDistance:round(risk*ratio,2),
      riskDistance:round(risk,2),
      feasibility:support.state,
      feasibilityReason:support.reason,
      structuralBarrier:support.structuralBarrier===null?null:round(support.structuralBarrier,2),
      source:'REQUESTED_RR',
      targetTouchProbability:null,
      expectedValue:null,
      netRatio:null,
      costState:'UNAVAILABLE'
    };
  });
  const structural=structuralCandidate({entry,risk,direction,structure,terminal:terminalPoint,expectedMovePct});
  let selected=null;
  if(request.mode==='auto'){
    const candidates=[...matrix.filter(item=>item.feasibility==='HIGH'||item.feasibility==='MEDIUM')];
    if(structural&&(structural.feasibility==='HIGH'||structural.feasibility==='MEDIUM'))candidates.push(structural);
    selected=candidates.sort((a,b)=>b.ratio-a.ratio)[0]||null;
  }else if(Number.isFinite(request.ratio)){
    selected=matrix.find(item=>item.ratio===request.ratio)||null;
  }

  const bars=expiryBars(intervalMs,horizonBars,volatilityRegime);
  const expiryAt=Number.isFinite(observedAt)&&Number.isFinite(intervalMs)?new Date(observedAt+intervalMs*bars).toISOString():null;
  const expired=expiryAt?evaluationTime>Date.parse(expiryAt):false;
  const plan=entryPlan({action,lastPrice,entryZone,structure});
  const invalidations=invalidationPlan({action,invalidation,structure,expiryAt,view,graph});
  const selectedValid=Boolean(selected&&!['LOW','NOT FEASIBLE','UNAVAILABLE'].includes(selected.feasibility)&&!expired);
  const lifecycle=lifecycleState({directional,valid:selectedValid,expired,entryMethod:plan.method,truthState:String(graph?.truthState||'')});
  const targets=[...(structural?[structural]:[]),...matrix.filter(item=>item.feasibility==='HIGH'||item.feasibility==='MEDIUM')]
    .filter((item,index,list)=>list.findIndex(other=>Math.abs(other.target-item.target)<1e-9)===index)
    .sort((a,b)=>a.ratio-b.ratio)
    .map((item,index)=>({...item,rank:index+1}));

  const common={
    entry:{zone:entryZone.map(value=>round(value,2)),preferred:entry,method:plan.method,trigger:plan.trigger,confirmation:plan.confirmation,invalidCondition:plan.invalidCondition,freshness:graph?.truthState||'UNKNOWN'},
    stop:{price:round(invalidation,2),distance:round(risk,2),distancePct:lastPrice?round(risk/lastPrice*100,3):null,atrMultiple:Number.isFinite(finite(graph?.metrics?.atrPct))&&lastPrice?round((risk/lastPrice*100)/finite(graph.metrics.atrPct),2):null,why:'The price stop is anchored to the current validated invalidation level rather than a fixed monetary amount.'},
    expiryAt,
    lifecycle:{state:lifecycle,createdAt:Number.isFinite(observedAt)?new Date(observedAt).toISOString():null,lastValidatedAt:Number.isFinite(generatedAt)?new Date(generatedAt).toISOString():null,expiresAt:expiryAt,expiryBars:bars,history:[],note:'Only the current observed lifecycle state is emitted; QELLY does not manufacture backfilled transitions.'},
    invalidations,
    targets,
    matrix,
    selected
  };

  if(!selectedValid){
    const reason=expired?'The setup has expired and must be recomputed from fresh evidence.':selected?.feasibilityReason||'The requested R:R cannot be validated from the current forecast range and structure.';
    return {...base,...common,status:'NO_TRADE',reason};
  }

  return {
    ...base,
    ...common,
    status:'VALID',
    reason:selected.source==='STRUCTURE'?'Directional evidence is live and Auto selected the nearest validated structural target instead of forcing a preset R:R.':'Directional evidence is live and the selected target remains inside the modelled favorable range without a nearer validated structural barrier.'
  };
}

export const DECISION_RR_PRESETS=RR_PRESETS;
export const __decisionTradeResearchTest=Object.freeze({parseRequested,feasibility,expiryBars,entryPlan,structuralCandidate,lifecycleState});
