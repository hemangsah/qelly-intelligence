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

export function buildTradeResearch(graph,{requestedRr='auto',customRr=null}={}){
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
  const horizonBars=Math.max(1,Number(graph?.horizonBars)||1);
  const contradictions=Array.isArray(view.contradictions)?view.contradictions:[];
  const base={
    schemaVersion:'qelly.trade-research/1.0.0',
    requestedRr:request.mode==='custom'?'custom':request.mode==='preset'?'1:'+request.ratio:'auto',
    customRr:request.mode==='custom'?request.ratio:null,
    action,
    researchOnly:true,
    execution:false,
    confidence:finite(view.confidence),
    evidenceQuality:finite(view.evidenceGate?.qualityScore),
    contradictions,
    whatChangesView:view.changesIf||'Reassess when fresh evidence changes.',
    calibration:'Target-touch probability and trade win rate are not yet independently calibrated, so they are not fabricated.',
    calibrationState:graph?.quant?.calibration||{state:'UNCALIBRATED',sampleSize:0,brierScore:null,reliabilityBins:[]},
    riskContext:{volatilityRegime:graph?.quant?.volatility?.regime||'UNKNOWN',expectedMovePct:finite(graph?.quant?.volatility?.expectedMovePct),marketStructure:graph?.quant?.structure||null}
  };
  if(!directional||entryZone.length!==2||!entryZone.every(Number.isFinite)||!Number.isFinite(invalidation)){
    return {...base,status:'NO_TRADE',reason:'The current evidence gate does not support a directional setup.',entry:null,stop:null,expiryAt:null,matrix:[],selected:null};
  }
  const entry=round((entryZone[0]+entryZone[1])/2,2);
  const risk=Math.abs(entry-invalidation);
  if(!(risk>0))return {...base,status:'NO_TRADE',reason:'A valid risk distance could not be established.',entry:null,stop:null,expiryAt:null,matrix:[],selected:null};
  const direction=action==='BUY'?1:-1;
  const terminalPoint=graph?.forecast?.fan?.at?.(-1)||null;
  const ratios=[...RR_PRESETS];
  if(request.mode==='custom'&&Number.isFinite(request.ratio)&&!ratios.includes(request.ratio))ratios.push(request.ratio);
  ratios.sort((a,b)=>a-b);
  const matrix=ratios.map(ratio=>{
    const target=targetFor(entry,risk,direction,ratio);
    const support=feasibility(direction,target,terminalPoint,{entry,structure:graph?.quant?.structure,expectedMovePct:finite(graph?.quant?.volatility?.expectedMovePct)});
    return {
      ratio:round(ratio,2),
      label:'1:'+round(ratio,2),
      target,
      rewardDistance:round(risk*ratio,2),
      riskDistance:round(risk,2),
      feasibility:support.state,
      feasibilityReason:support.reason,
      structuralBarrier:support.structuralBarrier===null?null:round(support.structuralBarrier,2),
      targetTouchProbability:null,
      expectedValue:null
    };
  });
  let selected=null;
  if(request.mode==='auto'){
    selected=[...matrix].reverse().find(item=>item.feasibility==='HIGH'||item.feasibility==='MEDIUM')||null;
  }else if(Number.isFinite(request.ratio)){
    selected=matrix.find(item=>item.ratio===request.ratio)||null;
  }
  if(!selected||['LOW','NOT FEASIBLE','UNAVAILABLE'].includes(selected.feasibility)){
    return {...base,status:'NO_TRADE',reason:selected?.feasibilityReason||'The requested R:R cannot be validated from the current forecast range.',entry:{zone:entryZone.map(value=>round(value,2)),preferred:entry,method:lastPrice!==null&&lastPrice>=Math.min(...entryZone)&&lastPrice<=Math.max(...entryZone)?'NOW':'WAIT'},stop:{price:round(invalidation,2),distance:round(risk,2)},expiryAt:Number.isFinite(observedAt)&&Number.isFinite(intervalMs)?new Date(observedAt+intervalMs*Math.min(horizonBars,8)).toISOString():null,matrix,selected};
  }
  const stopDistancePct=lastPrice?round(risk/lastPrice*100,3):null;
  const expiryAt=Number.isFinite(observedAt)&&Number.isFinite(intervalMs)?new Date(observedAt+intervalMs*Math.min(horizonBars,8)).toISOString():null;
  const method=lastPrice!==null&&lastPrice>=Math.min(...entryZone)&&lastPrice<=Math.max(...entryZone)?'NOW':action==='BUY'&&lastPrice>Math.max(...entryZone)?'PULLBACK':action==='SELL'&&lastPrice<Math.min(...entryZone)?'PULLBACK':'WAIT';
  return {
    ...base,
    status:'VALID',
    reason:'Directional evidence is live and the selected target remains inside the modelled favorable range.',
    entry:{zone:entryZone.map(value=>round(value,2)),preferred:entry,method},
    stop:{price:round(invalidation,2),distance:round(risk,2),distancePct:stopDistancePct,atrMultiple:Number.isFinite(finite(graph?.metrics?.atrPct))&&lastPrice?round((risk/lastPrice*100)/finite(graph.metrics.atrPct),2):null},
    expiryAt,
    matrix,
    selected
  };
}

export const DECISION_RR_PRESETS=RR_PRESETS;
