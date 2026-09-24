const LEDGER_STATES=Object.freeze(['FORMING','VALID','TRIGGERED','ACTIVE','WEAKENING','T1_REACHED','T2_REACHED','T3_REACHED','T4_REACHED','INVALIDATED','EXPIRED','NO_TRADE']);
const TERMINAL_OUTCOMES=new Set(['EXPIRED_UNTRIGGERED','INVALIDATED_FIRST','INVALIDATED_AFTER_TARGET','TARGET_LADDER_COMPLETE','AMBIGUOUS_INTRABAR']);
const finite=(value)=>{if(value==null||value==='')return null;const number=Number(value);return Number.isFinite(number)?number:null;};
const round=(value,digits=4)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const iso=(value)=>{if(value==null||value==='')return null;const date=new Date(value);return Number.isNaN(date.getTime())?null:date.toISOString();};
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

const componentSnapshot=(decision)=>{
  const quant=decision?.quant||{},calibration=quant?.calibration||{},mtf=decision?.multiTimeframe||{},evidence=decision?.evidence||{};
  const derivatives=evidence?.derivatives||decision?.derivatives||{},liquidity=evidence?.liquidity||decision?.liquidity||{};
  const macro=evidence?.macro||decision?.macro||{},crossAsset=evidence?.crossAsset||decision?.crossAsset||{},eventRisk=evidence?.eventRisk||decision?.eventRisk||{};
  const forecast=decision?.forecast||{},probabilities=forecast?.probabilities||{},metrics=decision?.metrics||{};
  return {
    schemaVersion:'qelly.setup-component-snapshot/1.0.0',
    structure:{state:quant?.structure?.state||'UNAVAILABLE',bias:quant?.structure?.bias||'MIXED',support:finite(quant?.structure?.support),resistance:finite(quant?.structure?.resistance)},
    trend:{regime:quant?.trend?.regime||decision?.market?.currentState?.trend||'UNAVAILABLE',adx14:finite(quant?.trend?.adx14),efficiencyRatio:finite(quant?.trend?.efficiencyRatio),roc14Pct:finite(quant?.trend?.roc14Pct),trendPerBarPct:finite(metrics?.trendPerBarPct)},
    momentum:{rsi14:finite(metrics?.rsi14),returnZScore:finite(metrics?.returnZScore),state:decision?.market?.currentState?.momentum||'UNAVAILABLE'},
    volatility:{regime:quant?.volatility?.regime||decision?.market?.currentState?.volatilityRegime||'UNKNOWN',atrPct:finite(metrics?.atrPct),expectedMovePct:finite(quant?.volatility?.expectedMovePct),percentile:finite(quant?.volatility?.percentile)},
    multiTimeframe:{state:mtf?.state||'unavailable',direction:mtf?.agreement?.direction||'UNAVAILABLE',aligned:finite(mtf?.agreement?.aligned),directional:finite(mtf?.agreement?.directional),total:finite(mtf?.agreement?.total)},
    derivatives:{state:derivatives?.state||'unavailable',fundingPct:finite(derivatives?.fundingPct),fundingChangeBps:finite(derivatives?.fundingChangeBps),fundingPercentile:finite(derivatives?.fundingPercentile),openInterestNotionalUsd:finite(derivatives?.openInterestNotionalUsd),openInterestChangeState:derivatives?.openInterestChangeState||'UNAVAILABLE',markOracleBasisBps:finite(derivatives?.markOracleBasisBps)},
    liquidity:{state:liquidity?.state||'unavailable',spreadBps:finite(liquidity?.spreadBps),spreadState:liquidity?.spreadState||'UNAVAILABLE',top5Imbalance:finite(liquidity?.top5Imbalance),top10Imbalance:finite(liquidity?.top10Imbalance),depthConsensus:liquidity?.depthConsensus||'UNAVAILABLE',micropriceBiasBps:finite(liquidity?.micropriceBiasBps)},
    macro:{state:macro?.state||'unavailable',level:macro?.level||'UNAVAILABLE',observedAt:macro?.observedAt||null,usdInr:finite(macro?.fxReference?.usdInr)},
    crossAsset:{state:crossAsset?.state||'unavailable',benchmark:crossAsset?.benchmark||null,correlation:finite(crossAsset?.correlation),beta:finite(crossAsset?.beta),relativeStrengthPct:finite(crossAsset?.relativeStrengthPct)},
    eventRisk:{state:eventRisk?.state||'unavailable',level:eventRisk?.level||'UNAVAILABLE',nextEventAt:eventRisk?.nextEventAt||null},
    news:{state:evidence?.news?.state||'unavailable',provider:evidence?.news?.provider||null,articleCount:Array.isArray(evidence?.news?.articles)?evidence.news.articles.length:0},
    calibration:{schemaVersion:calibration?.schemaVersion||null,state:calibration?.state||'UNCALIBRATED',eligible:calibration?.eligible===true,sampleSize:finite(calibration?.sampleSize),brierScore:finite(calibration?.brierScore),reliabilityGap:finite(calibration?.reliabilityGap)},
    scenario:{modelVersion:decision?.provenance?.model?.version||null,bull:finite(probabilities?.bull),base:finite(probabilities?.base),bear:finite(probabilities?.bear),paths:finite(forecast?.paths),neutralThresholdPct:finite(forecast?.neutralThresholdPct)}
  };
};

const provenanceSnapshot=(decision,{sourceSetupId=null,basis='server_live_decision'}={})=>{
  const trade=decision?.tradeResearch||{},model=decision?.provenance?.model||{},calibration=decision?.quant?.calibration||{};
  const versions={
    decision:decision?.schemaVersion||null,
    quant:decision?.quant?.schemaVersion||null,
    model:model?.version||null,
    scenario:model?.version||null,
    calibration:calibration?.schemaVersion||null,
    tradeResearch:trade?.schemaVersion||null,
    decisionSnapshot:decision?.decisionSnapshot?.schemaVersion||null,
    evidenceGraph:decision?.evidenceGraph?.schemaVersion||null,
    rrEngine:trade?.schemaVersion||null
  };
  const graphId=clean(decision?.graphId,240)||null;
  const fingerprint=clean(decision?.provenance?.dataFingerprint,240)||null;
  return {
    schemaVersion:'qelly.setup-provenance/1.0.0',
    ledgerVersion:'qelly.setup-outcome-ledger/1.1.0',
    basis,
    source:'QELLY Decision Intelligence server observation',
    sourceSetupId:clean(sourceSetupId||trade?.setupId,240)||null,
    sourceGraphId:graphId,
    provider:clean(decision?.provenance?.provider,120)||null,
    sourceType:clean(decision?.provenance?.sourceType,120)||null,
    providerRequest:decision?.provenance?.request?{type:clean(decision.provenance.request.type,80)||null,coin:clean(decision.provenance.request.coin,32)||null,interval:clean(decision.provenance.request.interval,16)||null}:null,
    dataFingerprint:fingerprint,
    inputTimestamp:iso(decision?.generatedAt||decision?.observedAt),
    evidenceTimestamp:iso(decision?.observedAt),
    asset:clean(decision?.asset,16).toUpperCase()||null,
    timeframe:clean(decision?.interval,16)||null,
    horizon:clean(decision?.horizon,16)||null,
    modelId:clean(model?.id,120)||null,
    versions,
    pipeline:[
      {stage:'RAW_SOURCE',ref:clean(decision?.provenance?.provider,120)||null},
      {stage:'NORMALIZED_DATA',ref:fingerprint},
      {stage:'QUANT_STATE',ref:versions.quant},
      {stage:'EVIDENCE',ref:'qelly.setup-evidence-snapshot/1.0.0'},
      {stage:'REGIME',ref:versions.quant},
      {stage:'SCENARIO',ref:versions.scenario},
      {stage:'QELLY_VIEW',ref:versions.decisionSnapshot||versions.decision},
      {stage:'SETUP',ref:versions.tradeResearch},
      {stage:'TARGET_INVALIDATION',ref:versions.rrEngine},
      {stage:'OUTCOME',ref:'qelly.setup-outcome-ledger/1.1.0'}
    ],
    backfilled:false,
    execution:false
  };
};

const evidenceSnapshot=(decision)=>({
  schemaVersion:'qelly.setup-evidence-snapshot/1.0.0',
  observedAt:decision?.observedAt||null,
  truthState:decision?.truthState||'UNAVAILABLE',
  action:decision?.qellyView?.action||'NO TRADE',
  confidence:finite(decision?.qellyView?.confidence),
  evidenceQuality:finite(decision?.qellyView?.evidenceGate?.qualityScore),
  calibrationState:decision?.quant?.calibration?.state||'UNCALIBRATED',
  calibrationVersion:decision?.quant?.calibration?.schemaVersion||null,
  contradictions:Array.isArray(decision?.qellyView?.contradictions)?decision.qellyView.contradictions.slice(0,20).map(item=>clean(item,320)):[],
  provider:decision?.provenance?.provider||null,
  decisionSnapshotVersion:decision?.decisionSnapshot?.schemaVersion||null,
  evidenceGraphVersion:decision?.evidenceGraph?.schemaVersion||null,
  components:componentSnapshot(decision)
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
        ...provenanceSnapshot(decision,{sourceSetupId,basis:'server_live_decision'}),
        createdFromLiveEvidence:true,
        noBackfillBeforeTracking:true
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
    provenance:provenanceSnapshot(decision,{sourceSetupId:record.source_setup_id,basis:'server_live_decision'})
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
    provenance:{...provenanceSnapshot(decision,{sourceSetupId:setup.source_setup_id,basis:'server_provider_reobservation'}),triggerBackfilled:false}
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

export const __decisionOutcomeLedgerTest=Object.freeze({LEDGER_STATES,TERMINAL_OUTCOMES,normalizedTargets,evidenceSnapshot,componentSnapshot,provenanceSnapshot,candleRange,setupEntry});
