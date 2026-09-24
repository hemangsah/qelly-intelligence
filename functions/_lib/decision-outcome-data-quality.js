const TERMINAL_OUTCOMES=new Set(['EXPIRED_UNTRIGGERED','INVALIDATED_FIRST','INVALIDATED_AFTER_TARGET','TARGET_LADDER_COMPLETE','AMBIGUOUS_INTRABAR']);
const TERMINAL_STATUSES=new Set(['INVALIDATED','EXPIRED','T1_REACHED','T2_REACHED','T3_REACHED','T4_REACHED']);
const asArray=(value)=>Array.isArray(value)?value:[];
const asObject=(value)=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const finite=(value)=>{if(value==null||value==='')return null;const number=Number(value);return Number.isFinite(number)?number:null;};
const instant=(value)=>{if(value==null||value==='')return null;const time=Date.parse(value);return Number.isFinite(time)?time:null;};
const add=(items,code,severity,row,detail)=>items.push({code,severity,setupId:String(row?.id||''),sourceSetupId:String(row?.source_setup_id||row?.sourceSetupId||''),detail});
const ordered=(values)=>values.every((value,index)=>index===0||value>values[index-1]);

export function auditDecisionOutcomeData(setups,observations=[],{now=new Date().toISOString(),futureToleranceMs=300000,maxViolations=200}={}){
  const rows=asArray(setups),obs=asArray(observations),violations=[];
  const nowMs=instant(now)??Date.now(),ids=new Set(),sources=new Set();
  let resolved=0,open=0,calibrationEligible=0;
  for(const row of rows){
    const id=String(row?.id||''),source=String(row?.source_setup_id||row?.sourceSetupId||'');
    if(!id)add(violations,'MISSING_SETUP_ID','ERROR',row,'Setup identifier is missing.');
    else if(ids.has(id))add(violations,'DUPLICATE_SETUP_ID','ERROR',row,'Duplicate setup identifier appears in the audit sample.');
    else ids.add(id);
    if(source){if(sources.has(source))add(violations,'DUPLICATE_SOURCE_SETUP_ID','ERROR',row,'Duplicate source setup identifier appears in the audit sample.');else sources.add(source);}
    const created=instant(row?.created_observed_at||row?.createdAt),last=instant(row?.last_observed_at||row?.lastObservedAt),expiry=instant(row?.expiry_at||row?.expiryAt),resolvedAt=instant(row?.resolved_at||row?.resolvedAt);
    if(created===null)add(violations,'INVALID_CREATED_TIME','ERROR',row,'Creation timestamp is missing or invalid.');
    if(last===null)add(violations,'INVALID_LAST_OBSERVED_TIME','ERROR',row,'Last-observed timestamp is missing or invalid.');
    if(created!==null&&last!==null&&last<created)add(violations,'LAST_BEFORE_CREATED','ERROR',row,'Last-observed timestamp precedes creation.');
    if(created!==null&&expiry!==null&&expiry<created)add(violations,'EXPIRY_BEFORE_CREATED','ERROR',row,'Expiry precedes creation.');
    if(created!==null&&resolvedAt!==null&&resolvedAt<created)add(violations,'RESOLUTION_BEFORE_CREATED','ERROR',row,'Resolution precedes creation.');
    for(const pair of [['created',created],['lastObserved',last],['expiry',expiry],['resolved',resolvedAt]])if(pair[1]!==null&&pair[1]>nowMs+futureToleranceMs)add(violations,'FUTURE_TIMESTAMP','ERROR',row,pair[0]+' timestamp exceeds clock-skew tolerance.');
    const outcome=asObject(row?.resolved_outcome||row?.resolvedOutcome),outcomeState=String(outcome.state||'OPEN');
    if(resolvedAt===null){open+=1;if(outcomeState!=='OPEN')add(violations,'OUTCOME_WITHOUT_RESOLUTION_TIME','ERROR',row,'Terminal outcome exists without resolved_at.');}
    else{resolved+=1;if(!TERMINAL_OUTCOMES.has(outcomeState))add(violations,'RESOLUTION_WITH_NONTERMINAL_OUTCOME','ERROR',row,'resolved_at is present but outcome state is not terminal.');}
    if(outcome.calibrationEligible===true)calibrationEligible+=1;
    const latestStatus=String(row?.latest_status||row?.latestStatus||'');
    if(latestStatus==='EXPIRED'&&outcomeState!=='EXPIRED_UNTRIGGERED')add(violations,'EXPIRED_OUTCOME_AMBIGUITY','ERROR',row,'EXPIRED status does not map to EXPIRED_UNTRIGGERED.');
    if(resolvedAt!==null&&!TERMINAL_STATUSES.has(latestStatus)&&outcomeState!=='AMBIGUOUS_INTRABAR')add(violations,'RESOLVED_STATUS_NONTERMINAL','WARN',row,'Resolved setup retains a nonterminal lifecycle status.');
    const targets=asArray(row?.targets),slots=targets.map(target=>Number(target?.slot)).filter(Number.isFinite);
    if(slots.length&&!ordered(slots))add(violations,'TARGET_SLOT_ORDER','ERROR',row,'Target slots are duplicated or out of order.');
    const prices=targets.map(target=>finite(target?.price)),direction=String(row?.direction||'');
    if(prices.length>1&&prices.every(Number.isFinite)){
      const monotonic=direction==='BUY'?prices.every((price,index)=>index===0||price>prices[index-1]):direction==='SELL'?prices.every((price,index)=>index===0||price<prices[index-1]):true;
      if(!monotonic)add(violations,'TARGET_PRICE_ORDER','ERROR',row,'Target prices are not monotonic for setup direction.');
    }
    const metrics=asObject(row?.metrics);
    for(const name of ['mfeR','maeR']){const value=finite(metrics[name]);if(value!==null&&value<0)add(violations,'NEGATIVE_EXCURSION','ERROR',row,name+' cannot be negative.');}
    const trigger=instant(metrics.triggerAt),invalidated=instant(metrics.invalidatedAt),targetEvents=Object.entries(asObject(metrics.targetReachedAt)).map(([key,value])=>({key,at:instant(value)})).filter(item=>item.at!==null);
    for(const event of targetEvents){
      if(created!==null&&event.at<created)add(violations,'TARGET_BEFORE_CREATED','ERROR',row,event.key+' precedes setup creation.');
      if(trigger!==null&&event.at<trigger)add(violations,'TARGET_BEFORE_TRIGGER','ERROR',row,event.key+' precedes trigger.');
      if(resolvedAt!==null&&event.at>resolvedAt)add(violations,'TARGET_AFTER_RESOLUTION','ERROR',row,event.key+' occurs after resolution.');
    }
    if(invalidated!==null&&created!==null&&invalidated<created)add(violations,'INVALIDATION_BEFORE_CREATED','ERROR',row,'Invalidation precedes setup creation.');
    if(invalidated!==null&&resolvedAt!==null&&invalidated>resolvedAt)add(violations,'INVALIDATION_AFTER_RESOLUTION','ERROR',row,'Invalidation occurs after resolution.');
    const evidenceTime=instant(asObject(row?.evidence_snapshot||row?.evidenceSnapshot).observedAt);
    if(created!==null&&evidenceTime!==null&&evidenceTime>created+futureToleranceMs)add(violations,'FUTURE_EVIDENCE_LEAKAGE','ERROR',row,'Evidence snapshot is newer than setup creation.');
    const calibrationLast=instant(asObject(row?.calibration_snapshot||row?.calibrationSnapshot).lastResolvedAt);
    if(created!==null&&calibrationLast!==null&&calibrationLast>created)add(violations,'FUTURE_CALIBRATION_LEAKAGE','ERROR',row,'Calibration snapshot includes an outcome resolved after setup creation.');
  }
  const bySetup=new Map();
  for(const observation of obs){
    const setupId=String(observation?.setup_id||observation?.setupId||'');
    if(!ids.has(setupId)){add(violations,'ORPHAN_OBSERVATION','ERROR',{id:setupId},'Observation references a setup outside the audited setup set.');continue;}
    const list=bySetup.get(setupId)||[];list.push(observation);bySetup.set(setupId,list);
  }
  for(const [setupId,list] of bySetup){
    list.sort((a,b)=>(instant(a?.observed_at||a?.observedAt)??0)-(instant(b?.observed_at||b?.observedAt)??0));
    let terminal=null;
    for(const observation of list){
      const at=instant(observation?.observed_at||observation?.observedAt);
      if(at===null)add(violations,'INVALID_OBSERVATION_TIME','ERROR',{id:setupId},'Observation timestamp is missing or invalid.');
      const resolution=asObject(observation?.resolution),state=String(resolution.state||'OPEN');
      if(TERMINAL_OUTCOMES.has(state)){if(terminal===null)terminal=JSON.stringify(resolution);else if(JSON.stringify(resolution)!==terminal)add(violations,'TERMINAL_OUTCOME_MUTATION','ERROR',{id:setupId},'A later observation changes a terminal resolution.');}
    }
  }
  const violationCounts={};for(const item of violations)violationCounts[item.code]=(violationCounts[item.code]||0)+1;
  const errorCount=violations.filter(item=>item.severity==='ERROR').length,warningCount=violations.filter(item=>item.severity==='WARN').length;
  return {
    schemaVersion:'qelly.decision-outcome-data-quality/1.0.0',
    state:rows.length===0?'NO_OBSERVED_DATA':errorCount?'CONTAMINATED':warningCount?'REVIEW':'VALID',
    scientificallyUsable:rows.length>0&&errorCount===0,
    setupSampleSize:rows.length,observationSampleSize:obs.length,resolvedSetups:resolved,openSetups:open,calibrationEligibleResolutions:calibrationEligible,
    missingness:{setupRows:rows.length===0?1:0,observationRows:rows.length>0&&obs.length===0?1:0},
    violationCounts,errorCount,warningCount,violations:violations.slice(0,Math.max(1,Number(maxViolations)||200)),
    limits:{futureToleranceMs,maxViolations,observationMutationCheck:obs.length>0},
    boundary:'Scientific calibration must not use rows when state is CONTAMINATED. NO_OBSERVED_DATA means no empirical performance claim is available.'
  };
}

export const __decisionOutcomeDataQualityTest=Object.freeze({TERMINAL_OUTCOMES,finite,instant,ordered});
