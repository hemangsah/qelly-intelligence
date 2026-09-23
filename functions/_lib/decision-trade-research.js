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
const FEASIBLE_STATES=new Set(['HIGHLY FEASIBLE','FEASIBLE','CONDITIONAL']);
const FEASIBILITY_WEIGHT=Object.freeze({'HIGHLY FEASIBLE':1,FEASIBLE:.78,CONDITIONAL:.52,'LOW FEASIBILITY':.18,'NOT FEASIBLE':0,UNAVAILABLE:0});

const feasibility=(direction,target,terminal,{entry=null,structure=null,expectedMovePct=null}={})=>{
  const p05=finite(terminal?.p05),p25=finite(terminal?.p25),p75=finite(terminal?.p75),p95=finite(terminal?.p95);
  const empty=(state,reason,structuralBarrier=null,targetCongestion='UNAVAILABLE')=>({
    state,reason,structuralBarrier,targetCongestion,
    nearestObstruction:Number.isFinite(structuralBarrier)?structuralBarrier:null
  });
  if(![p05,p25,p75,p95].every(Number.isFinite))return empty('UNAVAILABLE','Forecast quantiles are incomplete.');
  const resistance=finite(structure?.resistance),support=finite(structure?.support);
  const structuralBarrier=direction>0&&resistance!==null&&resistance>entry&&resistance<target?resistance:direction<0&&support!==null&&support<entry&&support>target?support:null;
  const expectedMove=Number.isFinite(entry)&&Number.isFinite(expectedMovePct)?Math.abs(entry*expectedMovePct/100):null;
  const distance=Number.isFinite(entry)?Math.abs(target-entry):null;
  if(direction>0){
    if(target>p95)return empty('NOT FEASIBLE','Target lies beyond the model p95 favorable range.',structuralBarrier,structuralBarrier!==null?'BEFORE_TARGET':'CLEAR');
    if(structuralBarrier!==null)return empty('LOW FEASIBILITY','A verified recent resistance level sits before the requested target.',structuralBarrier,'BEFORE_TARGET');
    if(expectedMove!==null&&distance>expectedMove*1.5)return empty('LOW FEASIBILITY','Target distance materially exceeds the volatility-conditioned expected move.',null,'CLEAR');
    if(expectedMove!==null&&distance>expectedMove*1.1)return empty('CONDITIONAL','Target is inside the favorable distribution but extends beyond the central volatility-conditioned expected move.',null,'CLEAR');
    if(target<=p75)return empty('HIGHLY FEASIBLE','Target remains inside the model p75 favorable range, within the volatility-conditioned move and with no nearer structural obstruction.',null,'CLEAR');
    return empty('FEASIBLE','Target remains inside the model p95 favorable tail with no nearer structural obstruction.',null,'CLEAR');
  }
  if(target<p05)return empty('NOT FEASIBLE','Target lies beyond the model p05 favorable range.',structuralBarrier,structuralBarrier!==null?'BEFORE_TARGET':'CLEAR');
  if(structuralBarrier!==null)return empty('LOW FEASIBILITY','A verified recent support level sits before the requested target.',structuralBarrier,'BEFORE_TARGET');
  if(expectedMove!==null&&distance>expectedMove*1.5)return empty('LOW FEASIBILITY','Target distance materially exceeds the volatility-conditioned expected move.',null,'CLEAR');
  if(expectedMove!==null&&distance>expectedMove*1.1)return empty('CONDITIONAL','Target is inside the favorable distribution but extends beyond the central volatility-conditioned expected move.',null,'CLEAR');
  if(target>=p25)return empty('HIGHLY FEASIBLE','Target remains inside the model p25 favorable range, within the volatility-conditioned move and with no nearer structural obstruction.',null,'CLEAR');
  return empty('FEASIBLE','Target remains inside the model p05 favorable tail with no nearer structural obstruction.',null,'CLEAR');
};

const autoSelectionScore=(item,{entry=null,expectedMovePct=null}={})=>{
  if(!item||!FEASIBLE_STATES.has(item.feasibility))return null;
  const feasibilityWeight=FEASIBILITY_WEIGHT[item.feasibility]??0;
  const expectedMove=Number.isFinite(entry)&&Number.isFinite(expectedMovePct)?Math.abs(entry*expectedMovePct/100):null;
  const distance=finite(item.rewardDistance);
  const moveFit=expectedMove>0&&Number.isFinite(distance)
    ?clamp(1-Math.max(0,distance-expectedMove)/(expectedMove*1.25),0,1)
    :.55;
  const congestion=String(item.targetCongestion||'UNAVAILABLE');
  const congestionWeight=congestion==='CLEAR'?1:congestion==='AT_TARGET'?.86:congestion==='NEAR_TARGET'?.68:congestion==='BEFORE_TARGET'?.12:.5;
  const rr=finite(item.ratio)??0;
  const rrUtility=clamp(Math.log1p(Math.max(0,rr))/Math.log(5),0,1);
  const structuralFit=String(item.source||'')==='RR_PRESET'?.72:.9;
  return round(100*(.46*feasibilityWeight+.24*moveFit+.16*congestionWeight+.09*rrUtility+.05*structuralFit),2);
};

const classifyEntry=(action,lastPrice,entryZone,structure)=>{
  if(!Number.isFinite(lastPrice)||entryZone.length!==2)return {method:'WAIT',trigger:'Fresh price must return before an entry can be classified.',confirmationCondition:'Live price and the evidence gate must remain valid.',invalidEntryCondition:'Price or evidence moves outside the verified setup before entry.'};
  const low=Math.min(...entryZone),high=Math.max(...entryZone);
  const breakout=String(structure?.breakout||'NONE');
  const inside=lastPrice>=low&&lastPrice<=high;
  if(inside&&((action==='BUY'&&breakout==='UPSIDE')||(action==='SELL'&&breakout==='DOWNSIDE'))){
    return {method:'BREAKOUT',trigger:'Price is inside the evidence-backed entry zone while structure is in a directional breakout state.',confirmationCondition:'The breakout must hold without losing the structural invalidation level.',invalidEntryCondition:'The breakout fails or the evidence gate loses directional eligibility.'};
  }
  if(inside)return {method:'NOW',trigger:'Live price is inside the evidence-backed entry zone.',confirmationCondition:'Directional evidence and structure must remain valid at entry.',invalidEntryCondition:'Price exits the zone in the adverse direction or the evidence gate weakens before entry.'};
  if(action==='BUY'&&lastPrice>high){
    if(breakout==='UPSIDE')return {method:'RETEST',trigger:'Price has moved beyond the entry zone after an upside breakout; wait for a structurally valid retest.',confirmationCondition:'A retest holds above the breakout structure and the evidence gate remains directional.',invalidEntryCondition:'Price loses the breakout structure before a valid retest.'};
    return {method:'PULLBACK',trigger:'Price is above the preferred entry zone; do not chase the move.',confirmationCondition:'A pullback returns into the verified zone without structural failure.',invalidEntryCondition:'Structure or evidence invalidates before price returns to the zone.'};
  }
  if(action==='SELL'&&lastPrice<low){
    if(breakout==='DOWNSIDE')return {method:'RETEST',trigger:'Price has moved below the entry zone after a downside breakout; wait for a structurally valid retest.',confirmationCondition:'A retest holds below the breakout structure and the evidence gate remains directional.',invalidEntryCondition:'Price regains the breakout structure before a valid retest.'};
    return {method:'PULLBACK',trigger:'Price is below the preferred entry zone; do not chase the move.',confirmationCondition:'A pullback returns into the verified zone without structural failure.',invalidEntryCondition:'Structure or evidence invalidates before price returns to the zone.'};
  }
  return {method:'WAIT',trigger:'Price is on the wrong side of the verified entry zone for the directional setup.',confirmationCondition:'Wait for price to return to a structurally valid location and revalidate the evidence.',invalidEntryCondition:'The setup expires or structure changes before a valid entry location forms.'};
};

const expiryBarsFor=(intervalMs,horizonBars,volatilityRegime,entryMethod)=>{
  const minutes=intervalMs/60_000;
  let bars=minutes<=5?6:minutes<=15?8:minutes<=60?6:4;
  bars=Math.min(Math.max(2,bars),Math.max(2,horizonBars));
  if(['HIGH','ELEVATED'].includes(String(volatilityRegime)))bars=Math.max(2,Math.floor(bars*.75));
  if(entryMethod==='RETEST'||entryMethod==='PULLBACK')bars=Math.min(Math.max(2,horizonBars),bars+1);
  return bars;
};

const costAdjusted=(entry,risk,rewardDistance,ratio,graph)=>{
  const roundTripPct=finite(graph?.costs?.roundTripPct);
  if(!Number.isFinite(roundTripPct)||roundTripPct<0)return {grossRiskReward:round(ratio,2),netRiskReward:null,costState:'UNAVAILABLE',estimatedCost:null,costReason:'Venue-specific spread and fee assumptions are unavailable, so net R:R is not fabricated.'};
  const costDistance=Math.abs(entry*roundTripPct/100);
  const netReward=Math.max(0,rewardDistance-costDistance);
  const netRisk=risk+costDistance;
  return {grossRiskReward:round(ratio,2),netRiskReward:netRisk>0?round(netReward/netRisk,2):null,costState:'ESTIMATED',estimatedCost:round(costDistance,6),costReason:'Net R:R uses the connected round-trip cost assumption.'};
};

const structuralTarget=(direction,entry,risk,terminal,structure,expectedMovePct,graph)=>{
  const barrier=direction>0?finite(structure?.resistance):finite(structure?.support);
  if(!Number.isFinite(barrier))return null;
  if((direction>0&&barrier<=entry)||(direction<0&&barrier>=entry))return null;
  const ratio=Math.abs(barrier-entry)/risk;
  if(!(ratio>=.5&&ratio<=10))return null;
  const support=feasibility(direction,barrier,terminal,{entry,structure:null,expectedMovePct});
  if(!FEASIBLE_STATES.has(support.state))return null;
  const rewardDistance=Math.abs(barrier-entry);
  return {
    ratio:round(ratio,2),
    label:'1:'+round(ratio,2)+' structural',
    target:round(barrier,2),
    rewardDistance:round(rewardDistance,2),
    riskDistance:round(risk,2),
    feasibility:support.state,
    feasibilityReason:'Nearest verified structural '+(direction>0?'resistance':'support')+' is a feasible target before forcing the next preset R:R.',
    structuralBarrier:null,
    nearestObstruction:round(barrier,2),
    targetCongestion:'AT_TARGET',
    source:direction>0?'RECENT_RESISTANCE':'RECENT_SUPPORT',
    ...costAdjusted(entry,risk,rewardDistance,ratio,graph),
    targetTouchProbability:null,
    expectedValue:null,
    timeToTargetBars:null
  };
};

const lifecycleFor=({status,entryMethod,truthState='LIVE',expired=false})=>{
  if(expired)return {state:'EXPIRED',historyAvailable:false,reason:'The bounded setup validity window has elapsed; fresh evidence is required before the setup can be considered again.'};
  if(status!=='VALID')return {state:'NO_TRADE',historyAvailable:false,reason:'No evidence-qualified setup exists, so no lifecycle transition is manufactured.'};
  if(truthState==='STALE'||truthState==='DEGRADED')return {state:'WEAKENING',historyAvailable:false,reason:'The setup was derived from directional evidence, but source freshness has degraded and immediate eligibility is withheld.'};
  if(entryMethod==='NOW'||entryMethod==='BREAKOUT')return {state:'TRIGGERED',historyAvailable:false,reason:'The current observation satisfies the entry condition. No earlier trigger or active history is backfilled without persisted prior setup state.'};
  return {state:'FORMING',historyAvailable:false,reason:'Directional evidence exists, but the entry condition is not currently satisfied. No trigger is backfilled.'};
};

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
  const structure=graph?.quant?.structure||null;
  const volatilityRegime=graph?.quant?.volatility?.regime||'UNKNOWN';
  const expectedMovePct=finite(graph?.quant?.volatility?.expectedMovePct);
  const regime=graph?.quant?.regime||graph?.market?.currentState?.regime||'UNKNOWN';
  const eventRisk=graph?.eventRisk||graph?.evidence?.eventRisk||{state:'UNAVAILABLE',level:'UNAVAILABLE',reason:'No verified event-risk feed is attached to this setup.'};
  const liquidity=graph?.liquidity||graph?.evidence?.liquidity||{state:'unavailable',currentOnly:true,reason:'No verified liquidity snapshot is attached to this setup.'};
  const derivatives=graph?.derivatives||graph?.evidence?.derivatives||{state:'unavailable'};
  const crossAsset=graph?.crossAsset||graph?.evidence?.crossAsset||{state:'unavailable'};
  const macro=graph?.macro||graph?.evidence?.macro||{state:'unavailable'};
  const base={
    schemaVersion:'qelly.trade-research/1.2.0',
    setupId:graph?.graphId?graph.graphId+'-trade':null,
    requestedRr:request.mode==='custom'?'custom':request.mode==='preset'?'1:'+request.ratio:'auto',
    customRr:request.mode==='custom'?request.ratio:null,
    action,
    researchOnly:true,
    execution:false,
    confidence:finite(view.confidence),
    evidenceQuality:finite(view.evidenceGate?.qualityScore),
    contradictions,
    whatChangesView:view.changesIf||'Reassess when fresh evidence changes.',
    calibration:'Target-touch probability, time-to-target and trade win rate are not yet independently calibrated, so they are not fabricated.',
    calibrationState:graph?.quant?.calibration||{state:'UNCALIBRATED',sampleSize:0,brierScore:null,reliabilityBins:[]},
    riskContext:{
      volatilityRegime,
      expectedMovePct,
      marketStructure:structure,
      regime,
      eventRisk,
      liquidity:{state:liquidity?.state||'unavailable',currentOnly:liquidity?.currentOnly!==false,spreadBps:finite(liquidity?.spreadBps),spreadState:liquidity?.spreadState||'UNAVAILABLE',top5Imbalance:finite(liquidity?.top5Imbalance),imbalanceState:liquidity?.imbalanceState||'UNAVAILABLE',reason:liquidity?.reason||null},
      derivatives:{state:derivatives?.state||'unavailable',fundingPct:finite(derivatives?.fundingPct),fundingChangeBps:finite(derivatives?.fundingChangeBps),fundingPercentile:finite(derivatives?.fundingPercentile),openInterestNotionalUsd:finite(derivatives?.openInterestNotionalUsd),openInterestChangeState:derivatives?.openInterestChangeState||'UNAVAILABLE'},
      crossAsset:{state:crossAsset?.state||'unavailable',benchmark:crossAsset?.benchmark||null,correlation:finite(crossAsset?.correlation),beta:finite(crossAsset?.beta),relativeStrengthPct:finite(crossAsset?.relativeStrengthPct),eligibilityImpact:crossAsset?.eligibilityImpact||'none'},
      macro:{state:macro?.state||'unavailable',level:macro?.level||'UNAVAILABLE',reason:macro?.reason||null}
    }
  };
  if(!directional||entryZone.length!==2||!entryZone.every(Number.isFinite)||!Number.isFinite(invalidation)){
    const lifecycle=lifecycleFor({status:'NO_TRADE',entryMethod:'WAIT',truthState:String(graph?.truthState||'')});
    return {...base,status:'NO_TRADE',reason:'The current evidence gate does not support a directional setup.',createdAt:null,lastValidatedAt:Number.isFinite(observedAt)?new Date(observedAt).toISOString():null,entry:null,stop:null,invalidation:null,expiryAt:null,lifecycle,matrix:[],structuralTargets:[],selected:null,targets:[]};
  }
  const entry=round((entryZone[0]+entryZone[1])/2,2);
  const risk=Math.abs(entry-invalidation);
  if(!(risk>0)){
    const lifecycle=lifecycleFor({status:'NO_TRADE',entryMethod:'WAIT',truthState:String(graph?.truthState||'')});
    return {...base,status:'NO_TRADE',reason:'A valid risk distance could not be established.',createdAt:null,lastValidatedAt:Number.isFinite(observedAt)?new Date(observedAt).toISOString():null,entry:null,stop:null,invalidation:null,expiryAt:null,lifecycle,matrix:[],structuralTargets:[],selected:null,targets:[]};
  }
  const direction=action==='BUY'?1:-1;
  const terminalPoint=graph?.forecast?.fan?.at?.(-1)||null;
  const entryState=classifyEntry(action,lastPrice,entryZone,structure);
  const expiryBars=Number.isFinite(intervalMs)?expiryBarsFor(intervalMs,horizonBars,volatilityRegime,entryState.method):null;
  const expiryAt=Number.isFinite(observedAt)&&Number.isFinite(intervalMs)&&Number.isFinite(expiryBars)?new Date(observedAt+intervalMs*expiryBars).toISOString():null;
  const expired=expiryAt?evaluationTime>Date.parse(expiryAt):false;
  const ratios=[...RR_PRESETS];
  if(request.mode==='custom'&&Number.isFinite(request.ratio)&&!ratios.includes(request.ratio))ratios.push(request.ratio);
  ratios.sort((a,b)=>a-b);
  const matrix=ratios.map(ratio=>{
    const target=targetFor(entry,risk,direction,ratio);
    const support=feasibility(direction,target,terminalPoint,{entry,structure,expectedMovePct});
    const rewardDistance=risk*ratio;
    const adjusted=costAdjusted(entry,risk,rewardDistance,ratio,graph);
    const barrierRatio=Number.isFinite(support.structuralBarrier)?round(Math.abs(support.structuralBarrier-entry)/risk,2):null;
    return {
      ratio:round(ratio,2),
      label:'1:'+round(ratio,2),
      target,
      rewardDistance:round(rewardDistance,2),
      riskDistance:round(risk,2),
      feasibility:support.state,
      feasibilityReason:support.reason,
      structuralBarrier:support.structuralBarrier===null?null:round(support.structuralBarrier,2),
      structuralBarrierRr:barrierRatio,
      nearestObstruction:support.nearestObstruction===null?null:round(support.nearestObstruction,2),
      targetCongestion:support.targetCongestion||'UNAVAILABLE',
      source:'RR_PRESET',
      ...adjusted,
      targetTouchProbability:null,
      expectedValue:null,
      timeToTargetBars:null
    };
  });
  const structural=structuralTarget(direction,entry,risk,terminalPoint,structure,expectedMovePct,graph);
  const structuralTargets=structural?[structural]:[];
  const selectable=[...matrix,...structuralTargets]
    .filter(item=>FEASIBLE_STATES.has(item.feasibility))
    .map(item=>({...item,selectionScore:autoSelectionScore(item,{entry,expectedMovePct})}));
  let selected=null;
  if(request.mode==='auto'){
    selected=selectable
      .sort((a,b)=>(b.selectionScore??-1)-(a.selectionScore??-1)||a.ratio-b.ratio)[0]||null;
    if(selected)selected={...selected,selectionReason:'Auto ranks structural validity, volatility fit, target congestion and bounded R:R utility; it does not simply choose the largest nominal R:R.'};
  }else if(Number.isFinite(request.ratio)){
    selected=matrix.find(item=>item.ratio===request.ratio)||null;
  }
  const stopDistancePct=lastPrice?round(risk/lastPrice*100,3):null;
  const structuralInvalidation=direction>0?finite(structure?.support):finite(structure?.resistance);
  const invalidationLayers={
    price:{state:'ACTIVE',price:round(invalidation,2),condition:(action==='BUY'?'Price closes through the evidence-backed downside stop.':'Price closes through the evidence-backed upside stop.'),basis:'Current Decision level derived from live volatility and directional evidence.'},
    structural:{state:Number.isFinite(structuralInvalidation)?'ACTIVE':'UNAVAILABLE',price:Number.isFinite(structuralInvalidation)?round(structuralInvalidation,2):null,condition:Number.isFinite(structuralInvalidation)?('Recent '+(action==='BUY'?'support':'resistance')+' fails and market structure no longer supports the setup.'):'A distinct structural invalidation level is unavailable.'},
    evidence:{state:'ACTIVE',condition:'Directional eligibility no longer clears, calibration degrades, or severe contradictory evidence emerges.'},
    time:{state:expiryAt?'ACTIVE':'UNAVAILABLE',at:expiryAt,condition:'The setup expires if the entry condition has not been satisfied before the bounded validity window ends.'},
    event:{state:String(eventRisk?.state||'UNAVAILABLE').toUpperCase(),level:eventRisk?.level||'UNAVAILABLE',condition:eventRisk?.reason||'Verified event-risk evidence is unavailable.'},
    regime:{state:'ACTIVE',regime,condition:'Reassess if the market regime changes materially or volatility becomes abnormal for the setup.'},
    liquidity:{
      state:String(liquidity?.state||'unavailable').toLowerCase()==='live'?'ACTIVE':'UNAVAILABLE',
      spreadBps:finite(liquidity?.spreadBps),
      spreadState:liquidity?.spreadState||'UNAVAILABLE',
      top5Imbalance:finite(liquidity?.top5Imbalance),
      imbalanceState:liquidity?.imbalanceState||'UNAVAILABLE',
      condition:String(liquidity?.state||'unavailable').toLowerCase()==='live'
        ?'Reassess if verified spread exceeds 15 bps or top-five depth becomes severely imbalanced against the setup direction.'
        :(liquidity?.reason||'Verified L2 liquidity evidence is unavailable.')
    }
  };
  const stop={price:round(invalidation,2),distance:round(risk,2),distancePct:stopDistancePct,atrMultiple:Number.isFinite(finite(graph?.metrics?.atrPct))&&lastPrice?round((risk/lastPrice*100)/finite(graph.metrics.atrPct),2):null,reason:'Price stop is distinct from structural, evidence, time, event, regime and liquidity invalidation.'};
  const entryResult={zone:entryZone.map(value=>round(value,2)),preferred:entry,method:entryState.method,trigger:entryState.trigger,confirmationCondition:entryState.confirmationCondition,invalidEntryCondition:entryState.invalidEntryCondition};
  const validSelection=selected&&FEASIBLE_STATES.has(selected.feasibility);
  const status=validSelection&&!expired?'VALID':'NO_TRADE';
  const lifecycle=lifecycleFor({status:validSelection?'VALID':'NO_TRADE',entryMethod:entryState.method,truthState:String(graph?.truthState||''),expired});
  const targets=[...matrix,...structuralTargets]
    .filter(item=>FEASIBLE_STATES.has(item.feasibility))
    .sort((a,b)=>a.ratio-b.ratio)
    .map((item,index)=>({rank:index+1,label:item.label,price:item.target,ratio:item.ratio,feasibility:item.feasibility,source:item.source,targetCongestion:item.targetCongestion||'UNAVAILABLE',nearestObstruction:item.nearestObstruction??null,selectionScore:autoSelectionScore(item,{entry,expectedMovePct})}));
  if(status!=='VALID'){
    return {...base,status:'NO_TRADE',reason:expired?'The setup has expired and must be recomputed from fresh evidence.':selected?.feasibilityReason||'The requested R:R cannot be validated from the current forecast range.',createdAt:Number.isFinite(observedAt)?new Date(observedAt).toISOString():null,lastValidatedAt:Number.isFinite(generatedAt)?new Date(generatedAt).toISOString():null,entry:entryResult,stop,invalidation:invalidationLayers,expiryAt,expiryBars,lifecycle,matrix,structuralTargets,selected,targets};
  }
  return {
    ...base,
    status:'VALID',
    reason:entryState.method==='NOW'||entryState.method==='BREAKOUT'?'Directional evidence is live and the selected target remains structurally feasible.':'Directional evidence is live, but entry timing is still forming; do not chase price outside the verified zone.',
    createdAt:Number.isFinite(observedAt)?new Date(observedAt).toISOString():null,
    lastValidatedAt:Number.isFinite(generatedAt)?new Date(generatedAt).toISOString():null,
    entry:entryResult,
    stop,
    invalidation:invalidationLayers,
    expiryAt,
    expiryBars,
    lifecycle,
    matrix,
    structuralTargets,
    selected,
    targets
  };
}

export const DECISION_RR_PRESETS=RR_PRESETS;
export const __decisionTradeResearchTest=Object.freeze({parseRequested,feasibility,autoSelectionScore,classifyEntry,expiryBarsFor,costAdjusted,lifecycleFor,FEASIBLE_STATES});
