const LEDGER_STATES=Object.freeze(['FORMING','VALID','TRIGGERED','ACTIVE','WEAKENING','T1_REACHED','T2_REACHED','T3_REACHED','T4_REACHED','INVALIDATED','EXPIRED','NO_TRADE']);
const TERMINAL_OUTCOMES=new Set(['EXPIRED_UNTRIGGERED','INVALIDATED_FIRST','INVALIDATED_AFTER_TARGET','TARGET_LADDER_COMPLETE','AMBIGUOUS_INTRABAR']);
const finite=(value)=>{const number=Number(value);return Number.isFinite(number)?number:null;};
const round=(value,digits=4)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const iso=(value)=>{const date=new Date(value);return Number.isNaN(date.getTime())?null:date.toISOString();};
const clean=(value,max=160)=>String(value??'').trim().slice(0,max);
const state=(value,fallback='FORMING')=>LEDGER_STATES.includes(String(value||''))?String(value):fallback;
const millis=(later,earlier)=>{const a=Date.parse(later||''),b=Date.parse(earlier||'');return Number.isFinite(a)&&Number.isFinite(b)&&a>=b?a-b:null;};
const targetState=(slot)=>`T${slot}_REACHED`;

const normalizedTargets=(trade)=>{
  const seen=new Set();
  return (Array.isArray(trade?.targets)?trade.targets:[])
    .filter(item=>finite(item?.price)!==null&&finite(item?.ratio)!==null)
    .sort((a,b)=>Number(a.ratio)-Number(b.ratio))
    .filter(item=>{const key=String(round(Number(item.price),8));if(seen.has(key))return false;seen.add(key);return true;})
    .slice(0,4)
    .map((item,index)=>({
      slot:index+1,
      state:targetState(index+1),
      label:clean(item.label||`Target ${index+1}`,80),
      price:round(Number(item.price),8),
      ratio:round(Number(item.ratio),4),
      feasibility:clean(item.feasibility||'UNAVAILABLE',40),
      source:clean(item.source||'UNAVAILABLE',80)
    }));
};

const evidenceSnapshot=(decision)=>({
  observedAt:decision?.observedAt||null,
  truthState:decision?.truthState||'UNAVAILABLE',
  action:decision?.qellyView?.action||'NO TRADE',
  confidence:finite(decision?.qellyView?.confidence),
  evidenceQuality:finite(decision?.qellyView?.evidenceGate?.qualityScore),
  calibrationState:decision?.quant?.calibration?.state||'UNCALIBRATED',
  contradictions:Array.isArray(decision?.qellyView?.contradictions)?decision.qellyView.contradictions.slice(0,20):[],
  provider:decision?.provenance?.provider||null
});

export function setupRecordFromDecision(decision,{workspaceId,ownerId}={}){
  const trade=decision?.tradeResearch||{};
  const lifecycle=trade?.lifecycle||{};
  const direction=String(trade?.action||'');
  const observedAt=iso(trade?.createdAt||decision?.observedAt);
  const sourceSetupId=clean(trade?.setupId,240);
  const live=String(decision?.truthState||'')==='LIVE';
  const trackable=live&&trade?.status==='VALID'&&['BUY','SELL'].includes(direction)&&sourceSetupId&&observedAt&&trade?.selected&&['FORMING','TRIGGERED','VALID'].includes(String(lifecycle?.state||''));
  if(!trackable)return {trackable:false,reason:'Only a live, evidence-qualified setup can enter the observed ledger. WAIT / NO TRADE, expired, weakened, stale or incomplete setups are not persisted as historical setups.'};
  const targets=normalizedTargets(trade);
  if(!targets.length)return {trackable:false,reason:'The setup has no structurally feasible target ladder to observe.'};
  const entryZone=Array.isArray(trade?.entry?.zone)?trade.entry.zone.map(finite).filter(Number.isFinite):[];
  const stopPrice=finite(trade?.stop?.price);
  if(entryZone.length!==2||stopPrice===null)return {trackable:false,reason:'Entry and stop evidence are incomplete, so the setup cannot be tracked.'};
  const initialStatus=state(lifecycle.state,'FORMING');
  const triggered=initialStatus==='TRIGGERED';
  const metrics={
    triggerAt:triggered?observedAt:null,
    highestTarget:null,
    targetReachedAt:{},
    invalidatedAt:null,
    mfeR:null,
    maeR:null,
    timeToTriggerMs:triggered?0:null,
    timeToTargetMs:{},
    timeToInvalidationMs:null,
    historyCoverage:'OBSERVED_FROM_TRACKING_START',
    noBackfill:true
  };
  return {
    trackable:true,
    record:{
      workspace_id:workspaceId,
      owner_id:ownerId,
      source_setup_id:sourceSetupId,
      source_graph_id:clean(decision?.graphId,240)||null,
      asset:clean(decision?.asset,16).toUpperCase(),
      timeframe:clean(decision?.interval,16),
      horizon:clean(decision?.horizon,16),
      direction,
      created_observed_at:observedAt,
      last_observed_at:observedAt,
      expiry_at:iso(trade?.expiryAt),
      latest_status:initialStatus,
      resolved_at:null,
      entry:{...trade.entry,zone:entryZone,preferred:finite(trade?.entry?.preferred)},
      stop:{...trade.stop,price:stopPrice},
      invalidation:trade?.invalidation||{},
      targets,
      requested_rr:clean(trade?.requestedRr||'auto',40),
      selected_rr:finite(trade?.selected?.ratio),
      evidence_snapshot:evidenceSnapshot(decision),
      calibration_snapshot:decision?.quant?.calibration||{state:'UNCALIBRATED',sampleSize:0,brierScore:null,reliabilityBins:[]},
      regime:clean(decision?.quant?.regime||decision?.market?.currentState?.regime||'UNKNOWN',80),
      event_risk_state:clean(decision?.evidence?.eventRisk?.level||decision?.eventRisk?.level||'UNAVAILABLE',40),
      resolved_outcome:{state:'OPEN',highestTarget:null,ambiguous:false,calibrationEligible:false},
      metrics,
      provenance:{
        schemaVersion:'qelly.setup-outcome-ledger/1.0.0',
        source:'QELLY Decision Intelligence server observation',
        sourceSetupId,
        sourceGraphId:clean(decision?.graphId,240)||null,
        createdFromLiveEvidence:true,
        noBackfillBeforeTracking:true,
        execution:false
      }
    }
  };
}

const candleRange=(decision,startExclusive,endInclusive)=>{
  const start=Date.parse(startExclusive||''),end=Date.parse(endInclusive||'');
  return (Array.isArray(decision?.market?.candles)?decision.market.candles:[])
    .filter(candle=>Number.isFinite(Number(candle?.time))&&Number(candle.time)>start&&Number(candle.time)<=end)
    .sort((a,b)=>Number(a.time)-Number(b.time));
};

const setupEntry=(setup)=>{
  const preferred=finite(setup?.entry?.preferred);
  if(preferred!==null)return preferred;
  const zone=Array.isArray(setup?.entry?.zone)?setup.entry.zone.map(finite).filter(Number.isFinite):[];
  return zone.length===2?(zone[0]+zone[1])/2:null;
};

const cloneMetrics=(metrics)=>({
  triggerAt:metrics?.triggerAt||null,
  highestTarget:metrics?.highestTarget||null,
  targetReachedAt:{...(metrics?.targetReachedAt||{})},
  invalidatedAt:metrics?.invalidatedAt||null,
  mfeR:finite(metrics?.mfeR),
  maeR:finite(metrics?.maeR),
  timeToTriggerMs:finite(metrics?.timeToTriggerMs),
  timeToTargetMs:{...(metrics?.timeToTargetMs||{})},
  timeToInvalidationMs:finite(metrics?.timeToInvalidationMs),
  historyCoverage:metrics?.historyCoverage||'OBSERVED_FROM_TRACKING_START',
  noBackfill:true
});

const marketSnapshot=(decision)=>({
  observedAt:decision?.observedAt||null,
  lastPrice:finite(decision?.market?.lastPrice),
  truthState:decision?.truthState||'UNAVAILABLE',
  marketState:decision?.market?.currentState||null,
  qellyView:decision?.qellyView?.action||'NO TRADE'
});

export function initialObservationFromRecord(record,decision){
  return {
    workspace_id:record.workspace_id,
    owner_id:record.owner_id,
    observed_at:record.created_observed_at,
    status:record.latest_status,
    market:marketSnapshot(decision),
    evidence_snapshot:evidenceSnapshot(decision),
    target_events:[],
    invalidation_event:null,
    metrics:record.metrics,
    resolution:record.resolved_outcome,
    provenance:{basis:'server_live_decision',backfilled:false}
  };
}

export function observePersistedSetup(setup,decision){
  const observedAt=iso(decision?.observedAt);
  const lastObservedAt=iso(setup?.last_observed_at);
  if(!observedAt||!lastObservedAt)return {changed:false,reason:'Observation timestamps are unavailable.'};
  if(Date.parse(observedAt)<=Date.parse(lastObservedAt))return {changed:false,reason:'No newer provider observation is available.'};
  if(setup?.resolved_at)return {changed:false,reason:'The setup is already terminal and remains immutable.'};

  const metrics=cloneMetrics(setup?.metrics||{});
  const direction=String(setup?.direction||'');
  const currentTrade=decision?.tradeResearch||{};
  const sameDirection=String(currentTrade?.action||'')===direction;
  const currentLive=String(decision?.truthState||'')==='LIVE';
  const createdAt=iso(setup?.created_observed_at);
  const expiryAt=iso(setup?.expiry_at);
  const entry=setupEntry(setup);
  const stop=finite(setup?.stop?.price);
  const risk=entry!==null&&stop!==null?Math.abs(entry-stop):null;
  const targets=(Array.isArray(setup?.targets)?setup.targets:[]).filter(item=>finite(item?.price)!==null&&Number(item?.slot)>=1&&Number(item?.slot)<=4).sort((a,b)=>Number(a.slot)-Number(b.slot));
  let latestStatus=state(setup?.latest_status,'FORMING');
  let resolvedAt=null;
  let resolution={...(setup?.resolved_outcome||{state:'OPEN'}),state:'OPEN',ambiguous:false,calibrationEligible:false};
  const targetEvents=[];
  let invalidationEvent=null;
  let triggeredNow=false;

  if(!metrics.triggerAt){
    if(expiryAt&&Date.parse(observedAt)>Date.parse(expiryAt)){
      latestStatus='EXPIRED';
      resolvedAt=expiryAt;
      resolution={state:'EXPIRED_UNTRIGGERED',highestTarget:null,ambiguous:false,calibrationEligible:false,reason:'The persisted setup expired before an observed trigger.'};
    }else if(currentLive&&sameDirection&&currentTrade?.status==='VALID'&&String(currentTrade?.lifecycle?.state||'')==='TRIGGERED'){
      metrics.triggerAt=observedAt;
      metrics.timeToTriggerMs=millis(observedAt,createdAt);
      latestStatus='TRIGGERED';
      triggeredNow=true;
    }else{
      latestStatus=currentLive&&sameDirection&&currentTrade?.status==='VALID'?'FORMING':'WEAKENING';
    }
  }

  if(metrics.triggerAt&&!resolvedAt&&!triggeredNow&&entry!==null&&risk>0&&stop!==null){
    const candles=candleRange(decision,lastObservedAt,observedAt);
    let highestSlot=Number(String(metrics.highestTarget||'').match(/^T(\d)_REACHED$/)?.[1]||0);
    for(const candle of candles){
      const time=iso(Number(candle.time));
      const high=finite(candle.high),low=finite(candle.low);
      if(high===null||low===null)continue;
      const favorable=direction==='BUY'?high-entry:entry-low;
      const adverse=direction==='BUY'?entry-low:high-entry;
      metrics.mfeR=Math.max(metrics.mfeR??0,round(Math.max(0,favorable)/risk,4));
      metrics.maeR=Math.max(metrics.maeR??0,round(Math.max(0,adverse)/risk,4));

      const newlyHit=targets.filter(target=>{
        const key=`T${target.slot}`;
        if(metrics.targetReachedAt[key])return false;
        return direction==='BUY'?high>=Number(target.price):low<=Number(target.price);
      });
      const stopHit=direction==='BUY'?low<=stop:high>=stop;

      if(newlyHit.length){
        for(const target of newlyHit){
          const key=`T${target.slot}`;
          metrics.targetReachedAt[key]=time;
          metrics.timeToTargetMs[key]=millis(time,metrics.triggerAt);
          highestSlot=Math.max(highestSlot,Number(target.slot));
          targetEvents.push({slot:Number(target.slot),state:targetState(Number(target.slot)),price:Number(target.price),observedAt:time,basis:'provider_candle_touch_after_observed_trigger'});
        }
        metrics.highestTarget=targetState(highestSlot);
      }

      if(stopHit&&newlyHit.length){
        metrics.invalidatedAt=time;
        metrics.timeToInvalidationMs=millis(time,metrics.triggerAt);
        invalidationEvent={observedAt:time,price:stop,basis:'provider_candle_touch_after_observed_trigger',ordering:'AMBIGUOUS_WITH_TARGET_TOUCH'};
        latestStatus='INVALIDATED';
        resolvedAt=time;
        resolution={state:'AMBIGUOUS_INTRABAR',highestTarget:metrics.highestTarget||null,ambiguous:true,calibrationEligible:false,reason:'Target and invalidation were both touched inside the same provider candle, so event ordering is unknowable from OHLC data.'};
        break;
      }
      if(stopHit){
        metrics.invalidatedAt=time;
        metrics.timeToInvalidationMs=millis(time,metrics.triggerAt);
        invalidationEvent={observedAt:time,price:stop,basis:'provider_candle_touch_after_observed_trigger',ordering:'OBSERVED_BEFORE_ANY_NEW_TARGET_IN_CANDLE'};
        latestStatus='INVALIDATED';
        resolvedAt=time;
        resolution={state:highestSlot?'INVALIDATED_AFTER_TARGET':'INVALIDATED_FIRST',highestTarget:metrics.highestTarget||null,ambiguous:false,calibrationEligible:true};
        break;
      }
      if(highestSlot&&highestSlot===targets.length&&targets.length>0){
        latestStatus=targetState(highestSlot);
        resolvedAt=time;
        resolution={state:'TARGET_LADDER_COMPLETE',highestTarget:metrics.highestTarget,ambiguous:false,calibrationEligible:true};
        break;
      }
    }

    if(!resolvedAt){
      const highestSlot=Number(String(metrics.highestTarget||'').match(/^T(\d)_REACHED$/)?.[1]||0);
      if(highestSlot)latestStatus=targetState(highestSlot);
      else latestStatus=currentLive&&sameDirection&&currentTrade?.status==='VALID'?'ACTIVE':'WEAKENING';
    }
  }

  const patch={
    last_observed_at:observedAt,
    latest_status:latestStatus,
    resolved_at:resolvedAt,
    resolved_outcome:resolution,
    metrics
  };
  const observation={
    workspace_id:setup.workspace_id,
    owner_id:setup.owner_id,
    setup_id:setup.id,
    observed_at:observedAt,
    status:latestStatus,
    market:marketSnapshot(decision),
    evidence_snapshot:evidenceSnapshot(decision),
    target_events:targetEvents,
    invalidation_event:invalidationEvent,
    metrics,
    resolution,
    provenance:{basis:'server_provider_reobservation',backfilled:false,triggerBackfilled:false}
  };
  return {changed:true,patch,observation};
}

export function setupRowToClient(row){
  if(!row)return null;
  return {
    id:row.id,
    sourceSetupId:row.source_setup_id,
    sourceGraphId:row.source_graph_id,
    asset:row.asset,
    timeframe:row.timeframe,
    horizon:row.horizon,
    direction:row.direction,
    createdAt:row.created_observed_at,
    lastObservedAt:row.last_observed_at,
    expiryAt:row.expiry_at,
    latestStatus:row.latest_status,
    resolvedAt:row.resolved_at,
    entry:row.entry,
    stop:row.stop,
    invalidation:row.invalidation,
    targets:row.targets,
    requestedRr:row.requested_rr,
    selectedRr:row.selected_rr,
    evidenceSnapshot:row.evidence_snapshot,
    calibrationSnapshot:row.calibration_snapshot,
    regime:row.regime,
    eventRiskState:row.event_risk_state,
    resolvedOutcome:row.resolved_outcome,
    metrics:row.metrics,
    provenance:row.provenance,
    createdAtDatabase:row.created_at,
    updatedAt:row.updated_at
  };
}

export const __decisionOutcomeLedgerTest=Object.freeze({LEDGER_STATES,TERMINAL_OUTCOMES,normalizedTargets,evidenceSnapshot,candleRange,setupEntry});
