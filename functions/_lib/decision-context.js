const finite=(value)=>{const number=Number(value);return Number.isFinite(number)?number:null;};
const round=(value,digits=4)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
const state=(value,fallback='UNAVAILABLE')=>String(value??fallback).toUpperCase().replaceAll(' ','_');

const freshnessFrom=(value)=>['LIVE','DELAYED','STALE','DEGRADED','UNAVAILABLE'].includes(state(value))?state(value):'UNAVAILABLE';
const sourceNode=(id,kind,label,{source='QELLY derived research',timestamp=null,freshness='UNAVAILABLE',importance='MEDIUM',directness='DERIVED',reliability='BOUNDED',role='neutral',methodology='',limitations=[]}={})=>({
  id,kind,label,source,timestamp,freshness:freshnessFrom(freshness),importance,directness,reliability,role,methodology,limitations
});

function contradictionAnalysis(graph,evidence){
  const view=graph?.qellyView||{};
  const contradictions=Array.isArray(view.contradictions)?view.contradictions.filter(Boolean):[];
  const supports=Array.isArray(view.why)?view.why.filter(Boolean):[];
  const neutral=[];
  for(const [key,label] of [
    ['macro','Macro'],
    ['eventRisk','Scheduled event risk'],
    ['liquidations','Liquidation evidence'],
    ['options','Options evidence'],
    ['onChain','On-chain evidence']
  ]){
    const item=evidence?.[key];
    if(!item||String(item.state||'unavailable').toLowerCase()==='unavailable')neutral.push(label+' unavailable; no directional inference was added.');
  }
  const unresolved=contradictions.length>0;
  const severe=view.action==='NO TRADE'&&contradictions.length>0;
  const score=round(Math.min(1,contradictions.length/4),3);
  return {
    state:severe?'SEVERE_CONFLICT':unresolved?'CONFLICT':supports.length?'RESOLVED_OR_LOW':'MIXED',
    score,
    strongestSupport:supports[0]||null,
    strongestContradiction:contradictions[0]||null,
    support:supports,
    contradictions,
    neutral,
    unresolved,
    eligibilityImpact:'descriptive',
    note:'Contradiction analysis explains the already-computed Decision state; it does not independently create direction.'
  };
}

function pastPresentFuture(graph,{multiTimeframe,tradeResearch,evidence,horizon}){
  const move=graph?.selection;
  const quant=graph?.quant||{};
  const structure=quant.structure||{};
  const calibration=quant.calibration||{};
  const analogs=graph?.historicalAnalogs||{};
  const scenario=graph?.forecast?.probabilities||{};
  const terminal=graph?.forecast?.terminal||{};
  const matrix=Array.isArray(tradeResearch?.matrix)?tradeResearch.matrix:[];
  return {
    past:{
      selectedRange:move?{
        start:move.start,end:move.end,candles:move.candles,changePct:finite(move.changePct),rangePct:finite(move.rangePct),
        volumeRatio:finite(move.volumeRatio),volatilityPct:finite(move.volatilityPct),priorVolatilityPct:finite(move.priorVolatilityPct),
        evidence:Array.isArray(move.evidence)?move.evidence:[]
      }:null,
      historicalAnalogs:{
        state:analogs.state||'UNAVAILABLE',
        sampleSize:Number(analogs.sampledWindows)||0,
        summary:analogs.summary||null,
        eligibilityImpact:analogs.eligibilityImpact||'none'
      },
      context:move?'Selected observed range plus leakage-guarded descriptive analog context.':'No chart range is selected; historical analog context remains descriptive only.'
    },
    present:{
      observedAt:graph?.observedAt||null,
      freshness:graph?.truthState||'UNAVAILABLE',
      price:finite(graph?.market?.lastPrice),
      marketState:graph?.market?.currentState||null,
      structure,
      trend:quant.trend||null,
      momentum:{rsi14:finite(graph?.metrics?.rsi14),returnZScore:finite(graph?.metrics?.returnZScore),roc14Pct:finite(quant?.trend?.roc14Pct)},
      volatility:quant.volatility||null,
      regime:quant.regime||'UNKNOWN',
      liquidity:evidence?.liquidity||null,
      derivatives:evidence?.derivatives||null,
      crossAsset:evidence?.crossAsset||null,
      macro:evidence?.macro||null,
      eventRisk:evidence?.eventRisk||null,
      multiTimeframe:multiTimeframe||null,
      calibration:{
        state:calibration.state||'UNCALIBRATED',
        eligible:calibration.eligible===true,
        sampleSize:Number(calibration.sampleSize)||0,
        brierScore:finite(calibration.brierScore),
        reliabilityGap:finite(calibration.reliabilityGap)
      },
      qellyView:{
        action:graph?.qellyView?.action||'NO TRADE',
        confidence:finite(graph?.qellyView?.confidence),
        evidenceQuality:finite(graph?.qellyView?.evidenceGate?.qualityScore),
        label:graph?.qellyView?.label||''
      },
      tradeResearch
    },
    future:{
      horizon:horizon||null,
      horizonBars:Number(graph?.horizonBars)||null,
      scenarios:{
        bull:finite(scenario.bull),
        base:finite(scenario.base),
        bear:finite(scenario.bear)
      },
      expectedRange:{
        p05:finite(terminal.p05),
        p50:finite(terminal.p50),
        p95:finite(terminal.p95)
      },
      targetFeasibility:matrix.map(item=>({
        label:item.label,
        ratio:finite(item.ratio),
        target:finite(item.target),
        feasibility:item.feasibility||'UNAVAILABLE',
        structuralBarrier:finite(item.structuralBarrier),
        reason:item.feasibilityReason||''
      })),
      selectedSetup:tradeResearch?.selected||null,
      expiryAt:tradeResearch?.expiryAt||null,
      whatChangesView:graph?.qellyView?.changesIf||'Reassess when fresh evidence changes.',
      boundary:'Scenario probabilities are model outputs with separate calibration state; they are not guaranteed outcomes.'
    }
  };
}

function decisionTrace(graph,{multiTimeframe,tradeResearch,evidence,horizon}){
  const observedAt=graph?.observedAt||null;
  const truth=graph?.truthState||'UNAVAILABLE';
  const calibration=graph?.quant?.calibration||{};
  const analogs=graph?.historicalAnalogs||{};
  const nodes=[
    sourceNode('price','observation','Validated price and volume observations',{
      source:graph?.provenance?.provider||'Hyperliquid',timestamp:observedAt,freshness:truth,importance:'CRITICAL',directness:'DIRECT',reliability:'VENUE_OBSERVED',role:'observation',
      methodology:'Normalized OHLCV observations from the configured public market-data provider.',
      limitations:['Single-venue observation; cross-provider agreement is not claimed.']
    }),
    sourceNode('quant','quant-state','Quantitative market state',{
      timestamp:graph?.generatedAt||observedAt,freshness:truth,importance:'HIGH',directness:'DERIVED',reliability:'DETERMINISTIC',role:'transformation',
      methodology:'Returns, volatility, trend, momentum, drawdown, distribution and structure features derived from observed candles.',
      limitations:['Derived indicators depend on the observed sample and selected timeframe.']
    }),
    sourceNode('mtf','multi-timeframe','Multi-timeframe agreement',{
      source:graph?.provenance?.provider||'Hyperliquid',timestamp:observedAt,freshness:multiTimeframe?.state==='live'?truth:'UNAVAILABLE',importance:'HIGH',directness:'DERIVED',reliability:multiTimeframe?.state==='live'?'MULTI_WINDOW':'UNAVAILABLE',role:'support_or_contradiction',
      methodology:'Independent supported timeframes are evaluated separately and summarized by directional agreement.',
      limitations:['Agreement is not probability and does not remove regime uncertainty.']
    }),
    sourceNode('calibration','calibration','Walk-forward probability calibration',{
      timestamp:calibration.lastResolvedAt||null,freshness:calibration.state==='UNCALIBRATED'?'UNAVAILABLE':'DELAYED',importance:'CRITICAL',directness:'DERIVED',reliability:calibration.eligible?'OUT_OF_SAMPLE_GATE_PASSED':'GATE_NOT_PASSED',role:'eligibility_gate',
      methodology:calibration.method||'Walk-forward calibration unavailable.',
      limitations:[calibration.reason||'Calibration evidence may be insufficient.']
    }),
    sourceNode('liquidity','liquidity','Current L2 liquidity',{
      source:evidence?.liquidity?.provider||'Hyperliquid',timestamp:evidence?.liquidity?.observedAt||observedAt,freshness:evidence?.liquidity?.state==='live'?'LIVE':'UNAVAILABLE',importance:'HIGH',directness:'DIRECT',reliability:evidence?.liquidity?.state==='live'?'POINT_IN_TIME':'UNAVAILABLE',role:'risk_context',
      methodology:'Best bid/ask and bounded top-of-book depth when official L2 data is available.',
      limitations:['Point-in-time book state is not historical order-flow evidence.']
    }),
    sourceNode('derivatives','derivatives','Funding and open-interest context',{
      source:evidence?.derivatives?.provider||'Hyperliquid',timestamp:evidence?.derivatives?.observedAt||observedAt,freshness:evidence?.derivatives?.state==='live'?'LIVE':'UNAVAILABLE',importance:'MEDIUM',directness:'DIRECT_AND_HISTORICAL_FUNDING',reliability:evidence?.derivatives?.state==='live'?'VENUE_OBSERVED':'UNAVAILABLE',role:'risk_context',
      methodology:'Current perpetual context plus settled funding history when available.',
      limitations:['Historical open-interest change is not inferred when unavailable.']
    }),
    sourceNode('cross-asset','cross-asset','Cross-asset dependence',{
      source:evidence?.crossAsset?.provider||'Hyperliquid candles',timestamp:observedAt,freshness:evidence?.crossAsset?.state==='available'?truth:'UNAVAILABLE',importance:'MEDIUM',directness:'DERIVED',reliability:evidence?.crossAsset?.state==='available'?'BOUNDED_SAMPLE':'UNAVAILABLE',role:'context_only',
      methodology:evidence?.crossAsset?.method||'Bounded same-venue return dependence comparison.',
      limitations:['Cross-asset context has no independent eligibility impact.']
    }),
    sourceNode('news','news','Recent news evidence',{
      source:evidence?.news?.provider||'GDELT',timestamp:null,freshness:evidence?.news?.state==='live'?'LIVE':evidence?.news?.state==='no-matches'?'DELAYED':'UNAVAILABLE',importance:'MEDIUM',directness:'EXTERNAL_REPORTING',reliability:'SOURCE_DEPENDENT',role:'context_only',
      methodology:'Recent relevant headlines are surfaced as evidence context.',
      limitations:['Headline presence is not converted into causality or scheduled event risk.']
    }),
    sourceNode('analogs','historical-analogs','Leakage-guarded historical analogs',{
      timestamp:null,freshness:analogs.state==='AVAILABLE'?'DELAYED':'UNAVAILABLE',importance:'MEDIUM',directness:'DERIVED',reliability:analogs.state==='AVAILABLE'?'DESCRIPTIVE_ONLY':'UNAVAILABLE',role:'context_only',
      methodology:analogs.method||'Historical analogs unavailable.',
      limitations:['Forward outcomes are attached after matching and are not win probability.']
    }),
    sourceNode('scenario','scenario','Bull / base / bear scenario distribution',{
      timestamp:graph?.generatedAt||observedAt,freshness:truth,importance:'HIGH',directness:'MODELLED',reliability:calibration.eligible?'CALIBRATED_GATE_AVAILABLE':'MODEL_OUTPUT',role:'scenario',
      methodology:'Bounded block-bootstrap scenario distribution anchored to the current observed price.',
      limitations:['Scenario probabilities are not guaranteed forecasts.']
    }),
    sourceNode('view','research-view','QELLY VIEW '+String(graph?.qellyView?.action||'NO TRADE'),{
      timestamp:graph?.generatedAt||observedAt,freshness:truth,importance:'CRITICAL',directness:'COMPOSITE',reliability:'EVIDENCE_GATED',role:'decision',
      methodology:'Evidence gates combine freshness, sample depth, scenario separation, MTF agreement, calibration and severe verified risk contradictions.',
      limitations:['Research-only; no execution or guaranteed outcome.']
    }),
    sourceNode('setup','trade-research','Trade research setup '+String(tradeResearch?.status||'NO_TRADE'),{
      timestamp:graph?.generatedAt||observedAt,freshness:truth,importance:'HIGH',directness:'DERIVED',reliability:tradeResearch?.status==='VALID'?'STRUCTURE_AND_EVIDENCE_GATED':'FAIL_CLOSED',role:'setup',
      methodology:'Entry, stop, invalidation, target feasibility, expiry and lifecycle are derived only after the QELLY view clears evidence gates.',
      limitations:['Target-touch probability and EV remain unavailable unless independently calibrated.']
    })
  ];
  const edges=[
    ['price','quant','derives'],
    ['price','mtf','re-evaluates across timeframes'],
    ['price','liquidity','anchors current marketability'],
    ['price','derivatives','anchors current perpetual context'],
    ['price','cross-asset','compares'],
    ['price','analogs','matches pre-anchor state'],
    ['quant','scenario','conditions'],
    ['mtf','view','supports or contradicts'],
    ['calibration','view','gates'],
    ['liquidity','view','can suppress on severe verified risk'],
    ['derivatives','view','adds risk context'],
    ['cross-asset','view','adds descriptive context'],
    ['news','view','adds contextual evidence'],
    ['analogs','view','adds descriptive history'],
    ['scenario','view','informs'],
    ['view','setup','permits or withholds']
  ].map(([from,to,type])=>({from,to,type}));
  const byId=new Map(nodes.map(node=>[node.id,node]));
  return {
    schemaVersion:'qelly.decision-trace/1.0.0',
    eligibilityImpact:'none',
    horizon:horizon||null,
    nodes,
    edges,
    textAlternative:edges.map(edge=>(byId.get(edge.from)?.label||edge.from)+' '+edge.type+' '+(byId.get(edge.to)?.label||edge.to)+'.'),
    boundary:'The trace explains observed and derived evidence flow. It does not add a second hidden decision engine.'
  };
}

function snapshot(graph,{multiTimeframe,tradeResearch}){
  return {
    schemaVersion:'qelly.decision-snapshot/1.0.0',
    graphId:graph?.graphId||null,
    observedAt:graph?.observedAt||null,
    asset:graph?.asset||null,
    interval:graph?.interval||null,
    action:graph?.qellyView?.action||'NO TRADE',
    confidence:finite(graph?.qellyView?.confidence),
    evidenceQuality:finite(graph?.qellyView?.evidenceGate?.qualityScore),
    regime:graph?.quant?.regime||'UNKNOWN',
    volatilityRegime:graph?.quant?.volatility?.regime||'UNKNOWN',
    timeframeDirection:multiTimeframe?.agreement?.direction||'UNAVAILABLE',
    timeframeAgreement:Number(multiTimeframe?.agreement?.total)?round(Number(multiTimeframe.agreement.aligned||0)/Number(multiTimeframe.agreement.total),3):null,
    tradeStatus:tradeResearch?.status||'NO_TRADE',
    lifecycle:tradeResearch?.lifecycle?.state||tradeResearch?.lifecycle||null,
    selectedRr:tradeResearch?.selected?.label||null,
    selectedRrFeasibility:tradeResearch?.selected?.feasibility||null,
    invalidationPrice:finite(tradeResearch?.stop?.price),
    expiryAt:tradeResearch?.expiryAt||null
  };
}

export function buildDecisionContextBundle(graph,{multiTimeframe=null,tradeResearch=null,evidence=null,horizon=null}={}){
  return {
    pastPresentFuture:pastPresentFuture(graph,{multiTimeframe,tradeResearch,evidence,horizon}),
    contradictionAnalysis:contradictionAnalysis(graph,evidence),
    decisionTrace:decisionTrace(graph,{multiTimeframe,tradeResearch,evidence,horizon}),
    decisionSnapshot:snapshot(graph,{multiTimeframe,tradeResearch}),
    boundary:'Structured context is explanatory only. Existing evidence, calibration, liquidity and NO TRADE gates remain authoritative.'
  };
}

export const __decisionContextTest=Object.freeze({contradictionAnalysis,pastPresentFuture,decisionTrace,snapshot});
