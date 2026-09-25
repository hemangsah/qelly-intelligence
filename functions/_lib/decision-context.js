const finite=(value)=>{if(value==null||value==='')return null;const number=Number(value);return Number.isFinite(number)?number:null;};
const round=(value,digits=4)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
const state=(value,fallback='UNAVAILABLE')=>String(value??fallback).toUpperCase().replaceAll(' ','_');

const freshnessFrom=(value)=>['LIVE','DELAYED','STALE','DEGRADED','UNAVAILABLE'].includes(state(value))?state(value):'UNAVAILABLE';
const sourceNode=(id,kind,label,{stage=null,source='QELLY derived research',timestamp=null,freshness='UNAVAILABLE',importance='MEDIUM',directness='DERIVED',reliability='BOUNDED',role='neutral',supportState='NEUTRAL',confidence=null,methodology='',limitations=[]}={})=>({
  id,kind,label,stage,source,timestamp,freshness:freshnessFrom(freshness),importance,directness,reliability,role,
  supportState,confidence:finite(confidence),methodology,method:methodology,limitations
});

const articleTime=(article)=>article?.publishedAt||article?.seenAt||article?.seendate||article?.date||article?.timestamp||null;
const compactArticle=(article)=>({
  title:String(article?.title||'Untitled evidence'),
  source:String(article?.source||article?.domain||'External reporting'),
  publishedAt:articleTime(article),
  url:article?.url||null
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

function selectedMoveEvidence(move){
  const items=Array.isArray(move?.evidence)?move.evidence:[];
  const direction=(finite(move?.changePct)??0)>0?'UPSIDE':(finite(move?.changePct)??0)<0?'DOWNSIDE':'FLAT';
  const support=[],contradictions=[],neutral=[];
  for(const item of items){
    const label=String(item?.direction||'').toLowerCase();
    const supportsDirection=(direction==='UPSIDE'&&label.includes('supports upside'))||(direction==='DOWNSIDE'&&label.includes('supports downside'));
    const opposesDirection=(direction==='UPSIDE'&&label.includes('supports downside'))||(direction==='DOWNSIDE'&&label.includes('supports upside'));
    const momentumSupport=(direction==='UPSIDE'&&label.includes('momentum strengthened'))||(direction==='DOWNSIDE'&&label.includes('momentum weakened'));
    const momentumConflict=(direction==='UPSIDE'&&label.includes('momentum weakened'))||(direction==='DOWNSIDE'&&label.includes('momentum strengthened'));
    if(supportsDirection||momentumSupport||label.includes('confirms participation'))support.push(item);
    else if(opposesDirection||momentumConflict||label.includes('does not confirm'))contradictions.push(item);
    else neutral.push(item);
  }
  return {direction,support,contradictions,neutral,strongestSupport:support[0]||null,strongestContradiction:contradictions[0]||null};
}

const targetRange=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?{low:round(Math.min(a,b),2),high:round(Math.max(a,b),2)}:null;

function pastPresentFuture(graph,{multiTimeframe,tradeResearch,evidence,horizon,contradiction}){
  const move=graph?.selection;
  const quant=graph?.quant||{};
  const structure=quant.structure||{};
  const calibration=quant.calibration||{};
  const analogs=graph?.historicalAnalogs||{};
  const scenario=graph?.forecast?.probabilities||{};
  const terminal=graph?.forecast?.terminal||{};
  const terminalFan=Array.isArray(graph?.forecast?.fan)?graph.forecast.fan.at(-1):null;
  const matrix=Array.isArray(tradeResearch?.matrix)?tradeResearch.matrix:[];
  const selectedEvidence=selectedMoveEvidence(move);
  const news=evidence?.news||{};
  const articles=Array.isArray(news.articles)?news.articles.slice(0,8).map(compactArticle):[];
  const eventRisk=evidence?.eventRisk||{};
  const eventItems=Array.isArray(eventRisk.events)?eventRisk.events.slice(0,8):[];
  const support=finite(structure.support),resistance=finite(structure.resistance);
  const bull=finite(scenario.bull),base=finite(scenario.base),bear=finite(scenario.bear);
  const probabilityState=calibration.eligible===true?'CALIBRATION_GATE_PASSED':calibration.state==='WEAK_CALIBRATION'?'WEAK_CALIBRATION':'MODEL_OUTPUT_UNCALIBRATED';
  const bullTrigger=Number.isFinite(resistance)?'A sustained close above observed resistance '+round(resistance,2)+' with directional evidence still eligible.':'Bull probability must lead with aligned structure, momentum and multi-timeframe evidence.';
  const bearTrigger=Number.isFinite(support)?'A sustained close below observed support '+round(support,2)+' with directional evidence still eligible.':'Bear probability must lead with aligned structure, momentum and multi-timeframe evidence.';
  const baseTrigger=Number.isFinite(support)&&Number.isFinite(resistance)?'Price remains between '+round(support,2)+' support and '+round(resistance,2)+' resistance while no directional evidence gate clears.':'Directional evidence remains mixed and scenario separation stays narrow.';
  const scenarioDetails={
    bull:{
      probability:bull,
      targetRange:targetRange(finite(terminalFan?.p50??terminal.p50),finite(terminalFan?.p95??terminal.p95)),
      trigger:bullTrigger,
      invalidation:Number.isFinite(support)?'A close below observed support '+round(support,2)+' weakens the bull scenario.':'The bull scenario weakens if structure and scenario leadership turn against it.',
      whatChanges:'Stronger upside structure, multi-timeframe alignment and bull scenario separation increase weight; loss of support, stale evidence or calibration weakness reduce it.'
    },
    base:{
      probability:base,
      targetRange:targetRange(finite(terminalFan?.p25),finite(terminalFan?.p75)),
      trigger:baseTrigger,
      invalidation:'A verified directional break with clear scenario separation and evidence alignment invalidates the range/base case.',
      whatChanges:'The base case gains weight while evidence stays mixed and price remains structurally contained; a confirmed break shifts weight to bull or bear.'
    },
    bear:{
      probability:bear,
      targetRange:targetRange(finite(terminalFan?.p05??terminal.p05),finite(terminalFan?.p50??terminal.p50)),
      trigger:bearTrigger,
      invalidation:Number.isFinite(resistance)?'A close above observed resistance '+round(resistance,2)+' weakens the bear scenario.':'The bear scenario weakens if structure and scenario leadership turn against it.',
      whatChanges:'Stronger downside structure, multi-timeframe alignment and bear scenario separation increase weight; recovery above resistance, stale evidence or calibration weakness reduce it.'
    }
  };
  const tail=Number.isFinite(finite(terminal.p05))&&Number.isFinite(finite(terminal.p95))?{
    state:'MODELLED_TAIL_BOUNDS',
    lower:finite(terminal.p05),
    upper:finite(terminal.p95),
    combinedNominalTailMass:0.10,
    trigger:'Not a discrete event trigger. These are the modelled 5th/95th percentile terminal bounds for the selected horizon.',
    invalidation:'Recompute when the observation set, volatility regime, horizon or evidence freshness changes.',
    boundary:'Tail bounds are statistical scenario limits from the block-bootstrap distribution, not an event forecast or guarantee.'
  }:null;
  const currentSetup={
    status:tradeResearch?.status||'NO_TRADE',
    lifecycle:tradeResearch?.lifecycle||null,
    entry:tradeResearch?.entry||null,
    stop:tradeResearch?.stop||null,
    invalidation:tradeResearch?.invalidation||null,
    selectedTarget:tradeResearch?.selected||null,
    targets:Array.isArray(tradeResearch?.targets)?tradeResearch.targets:[],
    expiryAt:tradeResearch?.expiryAt||null
  };
  return {
    schemaVersion:'qelly.past-present-future/2.0.0',
    past:{
      selectedRange:move?{
        start:move.start,end:move.end,candles:move.candles,
        startPrice:finite(move.startPrice),endPrice:finite(move.endPrice),
        returnPct:finite(move.changePct),changePct:finite(move.changePct),rangePct:finite(move.rangePct),
        volumeRatio:finite(move.volumeRatio),averageVolume:finite(move.averageVolume),
        volatilityPct:finite(move.volatilityPct),priorVolatilityPct:finite(move.priorVolatilityPct),
        support:finite(move.support),resistance:finite(move.resistance),
        structure:move.structure||null,regime:move.regime||'UNAVAILABLE',trend:move.trend||null,
        technicalComparison:move.technicalComparison||null,
        evidence:Array.isArray(move.evidence)?move.evidence:[]
      }:null,
      moveDirection:selectedEvidence.direction,
      strongestSupport:selectedEvidence.strongestSupport,
      strongestContradiction:selectedEvidence.strongestContradiction,
      supportingEvidence:selectedEvidence.support,
      contradictoryEvidence:selectedEvidence.contradictions,
      neutralEvidence:selectedEvidence.neutral,
      newsTimeline:{
        state:news.state||'unavailable',
        provider:news.provider||null,
        items:articles,
        boundary:move?'Headlines returned for the selected Decision window are contextual evidence only; temporal overlap does not establish causality.':'Select a chart range before move-specific news context is requested.'
      },
      eventTimeline:{
        state:eventRisk.state||'unavailable',
        level:eventRisk.level||'UNAVAILABLE',
        items:eventItems,
        boundary:eventRisk.state==='available'?'Only verified scheduled events are shown.':'No verified machine-readable scheduled-event timeline is connected; events are not inferred.'
      },
      historicalDerivatives:evidence?.historicalDerivatives||{state:'not_selected',boundary:'Select a chart range before historical derivatives are evaluated.'},
      crossAsset:evidence?.selectedCrossAsset||{state:'unavailable',reason:'Move-specific cross-asset context is unavailable.'},
      historicalAnalogs:{
        state:analogs.state||'UNAVAILABLE',
        sampleSize:Number(analogs.sampledWindows)||0,
        summary:analogs.summary||null,
        eligibilityImpact:analogs.eligibilityImpact||'none',
        leakageGuard:analogs.leakageGuard||null,
        outcomeBoundary:analogs.outcomeBoundary||null
      },
      context:move?'Selected observed range plus move-specific evidence and leakage-guarded descriptive history.':'No chart range is selected; historical analog context remains descriptive only.'
    },
    present:{
      observedAt:graph?.observedAt||null,
      freshness:graph?.truthState||'UNAVAILABLE',
      freshnessDetail:graph?.freshness||null,
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
      news:{state:news.state||'unavailable',provider:news.provider||null,count:Array.isArray(news.articles)?news.articles.length:0},
      multiTimeframe:multiTimeframe||null,
      calibration:{
        state:calibration.state||'UNCALIBRATED',
        eligible:calibration.eligible===true,
        sampleSize:Number(calibration.sampleSize)||0,
        brierScore:finite(calibration.brierScore),
        skillScore:finite(calibration.skillScore),
        reliabilityGap:finite(calibration.reliabilityGap)
      },
      contradiction:contradiction||null,
      qellyView:{
        action:graph?.qellyView?.action||'NO TRADE',
        confidence:finite(graph?.qellyView?.confidence),
        evidenceQuality:finite(graph?.qellyView?.evidenceGate?.qualityScore),
        label:graph?.qellyView?.label||'',
        changesIf:graph?.qellyView?.changesIf||''
      },
      currentSetup,
      tradeResearch
    },
    future:{
      horizon:horizon||null,
      horizonBars:Number(graph?.horizonBars)||null,
      scenarios:{bull,base,bear},
      scenarioDetails,
      tail,
      probabilityCalibration:{
        state:probabilityState,
        calibrationState:calibration.state||'UNCALIBRATED',
        eligible:calibration.eligible===true,
        sampleSize:Number(calibration.sampleSize)||0,
        brierScore:finite(calibration.brierScore),
        reliabilityGap:finite(calibration.reliabilityGap),
        boundary:'Bull/base/bear values remain model scenario probabilities. A passed walk-forward calibration gate supports aggregate probability reliability; it does not guarantee any individual scenario.'
      },
      expectedRange:{
        p05:finite(terminal.p05),
        p25:finite(terminalFan?.p25),
        p50:finite(terminal.p50),
        p75:finite(terminalFan?.p75),
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
      invalidation:tradeResearch?.invalidation||null,
      expiryAt:tradeResearch?.expiryAt||null,
      whatChangesView:graph?.qellyView?.changesIf||'Reassess when fresh evidence changes.',
      boundary:'Scenario probabilities and percentile ranges are research model outputs with separate calibration state; they are not guaranteed outcomes.'
    }
  };
}

function evidenceSupportState(graph,contradiction){
  const action=String(graph?.qellyView?.action||'NO TRADE');
  if(action==='NO TRADE'&&contradiction?.unresolved)return 'CONTRADICTION';
  if(action==='BUY'||action==='SELL')return 'SUPPORT';
  return 'NEUTRAL';
}

function decisionTrace(graph,{multiTimeframe,tradeResearch,evidence,horizon,contradiction}){
  const observedAt=graph?.observedAt||null;
  const generatedAt=graph?.generatedAt||observedAt;
  const truth=graph?.truthState||'UNAVAILABLE';
  const calibration=graph?.quant?.calibration||{};
  const analogs=graph?.historicalAnalogs||{};
  const viewAction=String(graph?.qellyView?.action||'NO TRADE');
  const evidenceQuality=finite(graph?.qellyView?.evidenceGate?.qualityScore);
  const viewConfidence=finite(graph?.qellyView?.confidence);
  const scenario=graph?.forecast?.probabilities||{};
  const leading=finite(scenario.bull)>finite(scenario.bear)?'BULL':finite(scenario.bear)>finite(scenario.bull)?'BEAR':'BALANCED';
  const scenarioSupport=(viewAction==='BUY'&&leading==='BULL')||(viewAction==='SELL'&&leading==='BEAR')?'SUPPORT':(viewAction==='BUY'&&leading==='BEAR')||(viewAction==='SELL'&&leading==='BULL')?'CONTRADICTION':'NEUTRAL';
  const setupValid=tradeResearch?.status==='VALID';
  const selectedTarget=tradeResearch?.selected||null;
  const outcomeObserved=tradeResearch?.lifecycle?.historyAvailable===true;
  const core=[
    sourceNode('raw','raw-observation','Raw provider observation',{
      stage:'RAW_OBSERVATION',source:graph?.provenance?.provider||'Hyperliquid',timestamp:observedAt,freshness:truth,importance:'CRITICAL',directness:'DIRECT',reliability:'VENUE_OBSERVED',role:'observation',supportState:'OBSERVATION',
      methodology:'Public provider observations are received by the Decision endpoint before deterministic validation and normalization.',
      limitations:['Raw provider payloads are not treated as a Decision until validation, normalization and downstream evidence gates run.']
    }),
    sourceNode('normalized','normalized-data','Validated normalized market data',{
      stage:'NORMALIZED_DATA',source:'QELLY market normalization',timestamp:observedAt,freshness:truth,importance:'CRITICAL',directness:'DERIVED',reliability:'DETERMINISTIC',role:'observation',supportState:'OBSERVATION',
      methodology:'OHLCV observations are validated, deduplicated by timestamp, sorted and normalized before quantitative analysis.',
      limitations:['Normalization improves structural consistency but does not provide cross-venue confirmation.']
    }),
    sourceNode('quant','quant-signal','Quantitative signal state',{
      stage:'QUANT_SIGNAL',source:'QELLY derived research',timestamp:generatedAt,freshness:truth,importance:'HIGH',directness:'DERIVED',reliability:'DETERMINISTIC',role:'transformation',supportState:'TRANSFORMATION',confidence:finite(graph?.confidence?.score),
      methodology:'Returns, volatility, trend, momentum, drawdown, distribution and market-structure features are derived from normalized candles.',
      limitations:['Derived indicators depend on the observed sample and selected timeframe.']
    }),
    sourceNode('evidence','evidence-bundle','Evidence bundle + contradictions',{
      stage:'EVIDENCE',source:'QELLY evidence assembly',timestamp:generatedAt,freshness:truth,importance:'CRITICAL',directness:'COMPOSITE',reliability:'EVIDENCE_GATED',role:'evidence',supportState:evidenceSupportState(graph,contradiction),confidence:evidenceQuality,
      methodology:'Independent MTF, calibration, liquidity, derivatives, macro, cross-asset, news/event and historical evidence are assembled with explicit unavailable states.',
      limitations:['Evidence assembly explains and gates the existing Decision engine; it is not a second hidden direction engine.']
    }),
    sourceNode('regime','regime','Market regime '+String(graph?.quant?.regime||'UNKNOWN'),{
      stage:'REGIME',source:'QELLY quantitative risk engine',timestamp:generatedAt,freshness:truth,importance:'HIGH',directness:'DERIVED',reliability:'DETERMINISTIC',role:'context',supportState:'CONTEXT',
      methodology:'Regime and volatility state are derived from normalized market history and quantitative structure/trend features.',
      limitations:['Regime classification is sample-dependent and can change when new observations arrive.']
    }),
    sourceNode('scenario','scenario','Bull / base / bear scenario distribution',{
      stage:'SCENARIO',source:'QELLY derived research',timestamp:generatedAt,freshness:truth,importance:'HIGH',directness:'MODELLED',reliability:calibration.eligible?'CALIBRATION_GATE_PASSED':'MODEL_OUTPUT',role:'scenario',supportState:scenarioSupport,
      methodology:'A bounded block-bootstrap distribution produces bull/base/bear probabilities and terminal percentile ranges.',
      limitations:['Scenario probabilities are not guaranteed forecasts. Calibration state is reported separately and does not convert scenarios into certainty.']
    }),
    sourceNode('view','research-view','QELLY VIEW '+viewAction,{
      stage:'QELLY_VIEW',source:'QELLY derived research',timestamp:generatedAt,freshness:truth,importance:'CRITICAL',directness:'COMPOSITE',reliability:'EVIDENCE_GATED',role:'decision',supportState:viewAction==='BUY'||viewAction==='SELL'?'DECISION':viewAction==='NO TRADE'?'WITHHELD':'NEUTRAL',confidence:viewConfidence,
      methodology:'Evidence gates combine freshness, sample depth, scenario separation, MTF agreement, calibration and severe verified risk contradictions.',
      limitations:['Research-only; no execution or guaranteed outcome.']
    }),
    sourceNode('setup','trade-research','Trade research setup '+String(tradeResearch?.status||'NO_TRADE'),{
      stage:'SETUP',source:'QELLY trade research',timestamp:generatedAt,freshness:truth,importance:'HIGH',directness:'DERIVED',reliability:setupValid?'STRUCTURE_AND_EVIDENCE_GATED':'FAIL_CLOSED',role:'setup',supportState:setupValid?'ACTIVE':'WITHHELD',confidence:finite(tradeResearch?.confidence),
      methodology:'Entry, stop, expiry and target feasibility are derived only after the QELLY view clears evidence gates.',
      limitations:['Target-touch probability and EV remain unavailable unless independently calibrated.']
    }),
    sourceNode('target-invalidation','target-invalidation',selectedTarget?'Target '+String(selectedTarget.label||'selected')+' + invalidation':'Target / invalidation unavailable',{
      stage:'TARGET_INVALIDATION',source:'QELLY trade research',timestamp:generatedAt,freshness:setupValid?truth:'UNAVAILABLE',importance:'HIGH',directness:'DERIVED',reliability:setupValid?'STRUCTURE_AND_SCENARIO_GATED':'UNAVAILABLE',role:'risk_boundary',supportState:setupValid?'ACTIVE':'WITHHELD',
      methodology:'Target feasibility is checked against the scenario range, structural barriers and R:R rules; price, structure, evidence, time, event, regime and liquidity invalidations remain separate.',
      limitations:['A nominal R:R is not shown as feasible unless the structural and forecast-range gates support it.']
    }),
    sourceNode('outcome','outcome',outcomeObserved?'Observed setup outcome':'Observed outcome not yet available',{
      stage:'OUTCOME',source:'Authenticated observed setup ledger',timestamp:null,freshness:outcomeObserved?'DELAYED':'UNAVAILABLE',importance:'MEDIUM',directness:outcomeObserved?'OBSERVED':'UNAVAILABLE',reliability:outcomeObserved?'PERSISTED_OBSERVATION':'UNAVAILABLE',role:'outcome',supportState:outcomeObserved?'OBSERVED':'PENDING',
      methodology:'Outcome state is populated only from persisted setup observations. The public Decision response does not backfill a result from future or current price.',
      limitations:['No outcome is inferred when persisted observation history is absent.']
    })
  ];
  const satellite=[
    sourceNode('price','observation-compatibility','Validated price and volume observations',{
      source:graph?.provenance?.provider||'Hyperliquid',timestamp:observedAt,freshness:truth,importance:'CRITICAL',directness:'DIRECT',reliability:'VENUE_OBSERVED',role:'observation',supportState:'OBSERVATION',
      methodology:'Compatibility evidence node referencing the same validated normalized market observations used by the RAW OBSERVATION and NORMALIZED DATA pipeline stages; it performs no separate calculation.',
      limitations:['Compatibility alias only; no second provider request, normalization pass or Decision engine is introduced.']
    }),
    sourceNode('mtf','multi-timeframe','Multi-timeframe agreement',{
      source:graph?.provenance?.provider||'Hyperliquid',timestamp:observedAt,freshness:multiTimeframe?.state==='live'?truth:'UNAVAILABLE',importance:'HIGH',directness:'DERIVED',reliability:multiTimeframe?.state==='live'?'MULTI_WINDOW':'UNAVAILABLE',role:'support_or_contradiction',supportState:String(multiTimeframe?.agreement?.direction||'MIXED')===viewAction?'SUPPORT':String(multiTimeframe?.agreement?.direction||'MIXED')==='MIXED'?'NEUTRAL':'CONTRADICTION',
      methodology:'Independent supported timeframes are evaluated separately and summarized by directional agreement.',
      limitations:['Agreement is not probability and does not remove regime uncertainty.']
    }),
    sourceNode('calibration','calibration','Walk-forward probability calibration',{
      source:'QELLY derived research',timestamp:calibration.lastResolvedAt||null,freshness:calibration.state==='UNCALIBRATED'?'UNAVAILABLE':'DELAYED',importance:'CRITICAL',directness:'DERIVED',reliability:calibration.eligible?'OUT_OF_SAMPLE_GATE_PASSED':'GATE_NOT_PASSED',role:'eligibility_gate',supportState:calibration.eligible?'SUPPORT':viewAction==='BUY'||viewAction==='SELL'?'CONTRADICTION':'NEUTRAL',
      methodology:calibration.method||'Walk-forward calibration unavailable.',
      limitations:[calibration.reason||'Calibration evidence may be insufficient.']
    }),
    sourceNode('liquidity','liquidity','Current L2 liquidity',{
      source:evidence?.liquidity?.provider||'Hyperliquid',timestamp:evidence?.liquidity?.observedAt||observedAt,freshness:evidence?.liquidity?.state==='live'?'LIVE':'UNAVAILABLE',importance:'HIGH',directness:'DIRECT',reliability:evidence?.liquidity?.state==='live'?'POINT_IN_TIME':'UNAVAILABLE',role:'risk_context',supportState:'NEUTRAL',
      methodology:'Best bid/ask, displayed depth, visible 5/10/25 bps depth bands, adjacent-level gaps, imbalance/consensus and microprice are point-in-time marketability context.',
      limitations:['Point-in-time book state is not historical order-flow evidence.','CVD, aggressor flow and liquidation flow are not inferred when unavailable.']
    }),
    sourceNode('derivatives','derivatives','Funding and open-interest context',{
      source:evidence?.derivatives?.provider||'Hyperliquid',timestamp:evidence?.derivatives?.observedAt||observedAt,freshness:evidence?.derivatives?.state==='live'?'LIVE':'UNAVAILABLE',importance:'MEDIUM',directness:'DIRECT_AND_HISTORICAL_FUNDING',reliability:evidence?.derivatives?.state==='live'?'VENUE_OBSERVED':'UNAVAILABLE',role:'risk_context',supportState:'NEUTRAL',
      methodology:'Current funding, open interest, mark/oracle basis, premium and 24h perpetual volume plus same-provider settled funding/premium history when available.',
      limitations:['Historical open-interest change is not inferred when unavailable.','Historical mark/oracle basis change is not inferred from premium history.','Liquidation flow and the price/OI quadrant remain unavailable without verified source history.']
    }),
    sourceNode('cross-asset','cross-asset','Cross-asset dependence',{
      source:evidence?.crossAsset?.provider||'Hyperliquid candles',timestamp:evidence?.crossAsset?.observedAt||observedAt,freshness:evidence?.crossAsset?.state==='available'?truth:'UNAVAILABLE',importance:'MEDIUM',directness:'DERIVED',reliability:evidence?.crossAsset?.state==='available'?'BOUNDED_SAMPLE':'UNAVAILABLE',role:'context_only',supportState:'NEUTRAL',
      methodology:evidence?.crossAsset?.method||'Bounded same-venue return dependence comparison.',
      limitations:['Cross-asset context has no independent eligibility impact.','Correlation and exploratory lag relationships do not establish causality or cointegration.']
    }),
    sourceNode('macro','macro-reference','Governed macro reference',{
      source:evidence?.macro?.provider||'European Central Bank',timestamp:evidence?.macro?.observedAt||null,freshness:evidence?.macro?.state==='available'?'DELAYED':'UNAVAILABLE',importance:'MEDIUM',directness:evidence?.macro?.state==='available'?'DIRECT_REFERENCE':'UNAVAILABLE',reliability:evidence?.macro?.state==='available'?'OFFICIAL_REFERENCE':'UNAVAILABLE',role:'context_only',supportState:'NEUTRAL',
      methodology:evidence?.macro?.methodology||'Governed macro reference unavailable.',
      limitations:Array.isArray(evidence?.macro?.limitations)?evidence.macro.limitations:['Macro reference data has no independent eligibility impact.']
    }),
    sourceNode('event-risk','event-risk','Scheduled event risk',{
      source:evidence?.eventRisk?.provider||'No connected machine-readable feed',timestamp:evidence?.eventRisk?.nextEventAt||null,freshness:evidence?.eventRisk?.state==='available'?'LIVE':'UNAVAILABLE',importance:'HIGH',directness:evidence?.eventRisk?.state==='available'?'DIRECT':'UNAVAILABLE',reliability:evidence?.eventRisk?.state==='available'?'SCHEDULED_SOURCE':'UNAVAILABLE',role:'risk_context',supportState:evidence?.eventRisk?.state==='available'?'NEUTRAL':'UNAVAILABLE',
      methodology:evidence?.eventRisk?.gatingBoundary||'High-impact event gating is unavailable until a verified scheduled feed is connected.',
      limitations:[evidence?.eventRisk?.calendarBoundary||'Calendar embeds are not read into Decision Intelligence.',evidence?.eventRisk?.newsBoundary||'News is not converted into scheduled event risk.']
    }),
    sourceNode('news','news','Recent news evidence',{
      source:evidence?.news?.provider||'GDELT',timestamp:null,freshness:evidence?.news?.state==='live'?'LIVE':evidence?.news?.state==='no-matches'?'DELAYED':'UNAVAILABLE',importance:'MEDIUM',directness:'EXTERNAL_REPORTING',reliability:'SOURCE_DEPENDENT',role:'context_only',supportState:'NEUTRAL',
      methodology:'Recent relevant headlines are surfaced as evidence context.',
      limitations:['Headline presence is not converted into causality or scheduled event risk.']
    }),
    sourceNode('analogs','historical-analogs','Leakage-guarded historical analogs',{
      source:'QELLY derived research',timestamp:null,freshness:analogs.state==='AVAILABLE'?'DELAYED':'UNAVAILABLE',importance:'MEDIUM',directness:'DERIVED',reliability:analogs.state==='AVAILABLE'?'DESCRIPTIVE_ONLY':'UNAVAILABLE',role:'context_only',supportState:'NEUTRAL',
      methodology:analogs.method||'Historical analogs unavailable.',
      limitations:['Forward outcomes are attached after matching and are not win probability.']
    }),
    sourceNode('options','options','Options evidence',{
      source:'No connected authorized source',timestamp:null,freshness:evidence?.options?.state==='available'?'DELAYED':'UNAVAILABLE',importance:'LOW',directness:'UNAVAILABLE',reliability:'UNAVAILABLE',role:'context_only',supportState:'UNAVAILABLE',
      methodology:evidence?.options?.message||'Options evidence is unavailable and not inferred.',limitations:['No IV, skew, term structure or options positioning is inferred without authorized data.']
    }),
    sourceNode('onchain','on-chain','On-chain evidence',{
      source:'No connected authorized source',timestamp:null,freshness:evidence?.onChain?.state==='available'?'DELAYED':'UNAVAILABLE',importance:'LOW',directness:'UNAVAILABLE',reliability:'UNAVAILABLE',role:'context_only',supportState:'UNAVAILABLE',
      methodology:evidence?.onChain?.message||'On-chain evidence is unavailable and not inferred.',limitations:['Wallet/entity activity is not inferred without an authorized source.']
    }),
    sourceNode('liquidations','liquidations','Liquidation evidence',{
      source:'No connected verified source',timestamp:null,freshness:evidence?.liquidations?.state==='available'?'LIVE':'UNAVAILABLE',importance:'LOW',directness:'UNAVAILABLE',reliability:'UNAVAILABLE',role:'context_only',supportState:'UNAVAILABLE',
      methodology:evidence?.liquidations?.message||'Liquidation evidence is unavailable and not inferred.',limitations:['No liquidation clusters or flow are manufactured from price action.']
    })
  ];
  const nodes=[...core,...satellite];
  const edges=[
    ['raw','normalized','validated into'],
    ['normalized','quant','derives'],
    ['quant','regime','classifies'],
    ['quant','scenario','conditions'],
    ['quant','evidence','contributes deterministic state'],
    ['mtf','evidence','supports or contradicts'],
    ['calibration','evidence','gates'],
    ['calibration','view','gates'],
    ['liquidity','evidence','adds marketability risk'],
    ['derivatives','evidence','adds perpetual risk context'],
    ['cross-asset','evidence','adds descriptive dependence'],
    ['macro','evidence','adds delayed reference context'],
    ['event-risk','evidence','gates only when a verified schedule exists'],
    ['news','evidence','adds contextual reporting'],
    ['analogs','evidence','adds descriptive history'],
    ['options','evidence','records availability boundary'],
    ['onchain','evidence','records availability boundary'],
    ['liquidations','evidence','records availability boundary'],
    ['regime','scenario','conditions'],
    ['evidence','view','supports, contradicts or withholds'],
    ['scenario','view','informs'],
    ['view','setup','permits or withholds'],
    ['setup','target-invalidation','defines when evidence-qualified'],
    ['target-invalidation','outcome','is evaluated by observed ledger']
  ].map(([from,to,type])=>({from,to,type}));
  const byId=new Map(nodes.map(node=>[node.id,node]));
  const pipeline=['raw','normalized','quant','evidence','regime','scenario','view','setup','target-invalidation','outcome'].map((id,index)=>({
    order:index+1,id,label:byId.get(id)?.label||id,stage:byId.get(id)?.stage||null,freshness:byId.get(id)?.freshness||'UNAVAILABLE',supportState:byId.get(id)?.supportState||'NEUTRAL'
  }));
  return {
    schemaVersion:'qelly.evidence-graph/2.0.0',
    compatibilitySchema:'qelly.decision-trace/1.0.0',
    eligibilityImpact:'none',
    horizon:horizon||null,
    pipeline,
    nodes,
    edges,
    textAlternative:edges.map(edge=>(byId.get(edge.from)?.label||edge.from)+' '+edge.type+' '+(byId.get(edge.to)?.label||edge.to)+'.'),
    boundary:'Evidence Graph 2.0 explains the existing observed→derived→evidence→scenario→Decision→setup lifecycle. Edges describe data flow or gating relationships, not causality, and the graph does not add a second hidden Decision engine.'
  };
}

function snapshot(graph,{multiTimeframe,tradeResearch,evidence,contradiction}){
  const calibration=graph?.quant?.calibration||{};
  const structure=graph?.quant?.structure||{};
  const derivatives=evidence?.derivatives||{};
  const liquidity=evidence?.liquidity||{};
  const news=evidence?.news||{};
  const macro=evidence?.macro||{};
  const eventRisk=evidence?.eventRisk||{};
  const changeReasons={
    price:'Observed market price changed between comparable Decision snapshots.',
    truthState:'Primary market-data truth state changed; no fresher state is inferred when unavailable.',
    freshnessState:'Primary market-data freshness changed; freshness is a quality input, not a success probability.',
    trendState:'Observed/derived trend classification changed from the current normalized candle history.',
    regime:'Derived market regime changed from the current normalized candle history.',
    volatilityRegime:'Derived volatility regime changed from the current normalized candle sample.',
    liquidityState:'Current point-in-time L2 liquidity availability changed.',
    liquiditySpreadBps:'Current verified bid/ask spread changed; the existing bounded spread veto remains authoritative.',
    liquidityDepthConsensus:'Current displayed multi-depth liquidity consensus changed; this is point-in-time risk context.',
    derivativesState:'Current derivatives availability changed; derivatives remain risk context and do not independently force direction.',
    newsState:'Contextual news availability changed; news has no independent Decision eligibility impact.',
    action:contradiction?.strongestContradiction||graph?.qellyView?.label||'Current evidence mix changed.',
    contradictionState:contradiction?.strongestContradiction||graph?.qellyView?.label||'Current evidence mix changed.',
    contradictionScore:contradiction?.strongestContradiction||graph?.qellyView?.label||'Current evidence mix changed.',
    confidence:'Evidence confidence is recomputed from freshness, sample depth, scenario separation and multi-timeframe agreement; it is not a success probability.',
    evidenceQuality:'Evidence quality is recomputed from freshness, sample depth, scenario separation and multi-timeframe agreement.',
    calibrationState:calibration.reason||'Walk-forward calibration evidence changed.',
    calibrationBrierScore:calibration.reason||'Walk-forward calibration evidence changed.',
    selectedRr:tradeResearch?.selected?.feasibilityReason||tradeResearch?.reason||'Target feasibility changed with current structure and scenario range.',
    selectedRrFeasibility:tradeResearch?.selected?.feasibilityReason||tradeResearch?.reason||'Target feasibility changed with current structure and scenario range.',
    selectedTarget:tradeResearch?.selected?.feasibilityReason||tradeResearch?.reason||'Target feasibility changed with current structure and scenario range.',
    entryMethod:tradeResearch?.reason||'Setup state changed after current entry, invalidation or expiry checks.',
    entryPreferred:tradeResearch?.reason||'Setup state changed after current entry, invalidation or expiry checks.',
    stopPrice:tradeResearch?.reason||'Setup state changed after current entry, invalidation or expiry checks.',
    expiryAt:tradeResearch?.reason||'Setup state changed after current entry, invalidation or expiry checks.',
    macroLevel:macro.reason||'Governed macro reference context changed.',
    macroUsdInr:macro.reason||'Governed macro reference context changed.',
    eventRiskLevel:eventRisk.reason||'Scheduled event-risk context changed.',
    fundingPct:'Derivatives context changed; unavailable historical OI change is not inferred.',
    fundingChangeBps:'Derivatives context changed; unavailable historical OI change is not inferred.',
    openInterestNotionalUsd:'Derivatives context changed; unavailable historical OI change is not inferred.',
    openInterestChangeState:'Derivatives context changed; unavailable historical OI change is not inferred.',
    structureState:'Confirmed swing/range structure was recomputed from the current normalized candle history.',
    structureBias:'Confirmed swing/range structure was recomputed from the current normalized candle history.'
  };
  return {
    schemaVersion:'qelly.decision-snapshot/2.0.0',
    graphId:graph?.graphId||null,
    observedAt:graph?.observedAt||null,
    asset:graph?.asset||null,
    interval:graph?.interval||null,
    price:finite(graph?.market?.lastPrice),
    truthState:graph?.truthState||'UNAVAILABLE',
    freshnessState:graph?.freshness?.state||graph?.truthState||'UNAVAILABLE',
    trendState:graph?.market?.currentState?.trend||'UNKNOWN',
    action:graph?.qellyView?.action||'NO TRADE',
    confidence:finite(graph?.qellyView?.confidence),
    evidenceQuality:finite(graph?.qellyView?.evidenceGate?.qualityScore),
    calibrationState:calibration.state||'UNCALIBRATED',
    calibrationEligible:calibration.eligible===true,
    calibrationBrierScore:finite(calibration.brierScore),
    calibrationReliabilityGap:finite(calibration.reliabilityGap),
    regime:graph?.quant?.regime||'UNKNOWN',
    volatilityRegime:graph?.quant?.volatility?.regime||'UNKNOWN',
    structureState:structure.state||'UNAVAILABLE',
    structureBias:structure.bias||'MIXED',
    timeframeDirection:multiTimeframe?.agreement?.direction||'UNAVAILABLE',
    timeframeAgreement:Number(multiTimeframe?.agreement?.total)?round(Number(multiTimeframe.agreement.aligned||0)/Number(multiTimeframe.agreement.total),3):null,
    liquidityState:liquidity.state||'unavailable',
    liquiditySpreadBps:finite(liquidity.spreadBps),
    liquidityDepthConsensus:liquidity.depthConsensus||'UNAVAILABLE',
    derivativesState:derivatives.state||'unavailable',
    fundingPct:finite(derivatives.fundingPct),
    fundingChangeBps:finite(derivatives.fundingChangeBps),
    openInterestNotionalUsd:finite(derivatives.openInterestNotionalUsd),
    openInterestChangeState:derivatives.openInterestChangeState||'UNAVAILABLE',
    macroState:macro.state||'unavailable',
    macroLevel:macro.level||'UNAVAILABLE',
    macroUsdInr:finite(macro?.fxReference?.usdInr),
    eventRiskState:eventRisk.state||'unavailable',
    eventRiskLevel:eventRisk.level||'UNAVAILABLE',
    newsState:news.state||'unavailable',
    contradictionState:contradiction?.state||'MIXED',
    contradictionScore:finite(contradiction?.score),
    tradeStatus:tradeResearch?.status||'NO_TRADE',
    lifecycle:tradeResearch?.lifecycle?.state||tradeResearch?.lifecycle||null,
    entryMethod:tradeResearch?.entry?.method||null,
    entryPreferred:finite(tradeResearch?.entry?.preferred),
    selectedRr:tradeResearch?.selected?.label||null,
    selectedRrFeasibility:tradeResearch?.selected?.feasibility||null,
    selectedTarget:finite(tradeResearch?.selected?.target),
    selectedTargetReason:tradeResearch?.selected?.feasibilityReason||null,
    invalidationPrice:finite(tradeResearch?.stop?.price),
    stopPrice:finite(tradeResearch?.stop?.price),
    expiryAt:tradeResearch?.expiryAt||null,
    changeReasons
  };
}

export function buildDecisionContextBundle(graph,{multiTimeframe=null,tradeResearch=null,evidence=null,horizon=null}={}){
  const contradiction=contradictionAnalysis(graph,evidence);
  const trace=decisionTrace(graph,{multiTimeframe,tradeResearch,evidence,horizon,contradiction});
  return {
    pastPresentFuture:pastPresentFuture(graph,{multiTimeframe,tradeResearch,evidence,horizon,contradiction}),
    contradictionAnalysis:contradiction,
    decisionTrace:trace,
    evidenceGraph:trace,
    decisionSnapshot:snapshot(graph,{multiTimeframe,tradeResearch,evidence,contradiction}),
    boundary:'Structured context is explanatory only. Existing evidence, calibration, liquidity and NO TRADE gates remain authoritative.'
  };
}

export const __decisionContextTest=Object.freeze({contradictionAnalysis,selectedMoveEvidence,pastPresentFuture,decisionTrace,snapshot});
