const ASSET_PROFILES=Object.freeze({
  'QI-CRYPTO-BTC':Object.freeze({symbol:'BTC',name:'Bitcoin',momentum:62,volatility:58,liquidity:94,evidence:82,stability:74}),
  'QI-CRYPTO-ETH':Object.freeze({symbol:'ETH',name:'Ethereum',momentum:55,volatility:64,liquidity:91,evidence:79,stability:70}),
  'QI-CRYPTO-SOL':Object.freeze({symbol:'SOL',name:'Solana',momentum:68,volatility:78,liquidity:76,evidence:70,stability:54}),
  'QI-CRYPTO-BNB':Object.freeze({symbol:'BNB',name:'BNB',momentum:51,volatility:61,liquidity:78,evidence:68,stability:61}),
  'QI-CRYPTO-XRP':Object.freeze({symbol:'XRP',name:'XRP',momentum:43,volatility:74,liquidity:73,evidence:61,stability:48}),
  'QI-CRYPTO-ADA':Object.freeze({symbol:'ADA',name:'Cardano',momentum:47,volatility:72,liquidity:67,evidence:63,stability:52})
});

const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
const cleanText=(value,max=1200)=>String(value??'').trim().replace(/\s+/g,' ').slice(0,max);
const riskPenalty=Object.freeze({conservative:18,balanced:10,aggressive:4});
const horizonAdjustment=Object.freeze({'24h':-4,'7d':0,'30d':3,'90d':5});
const METHOD=Object.freeze({
  id:'qelly-deterministic-decision-support',
  version:'2.0.0',
  type:'deterministic-explainable-framework',
  formula:'momentum×0.34 + liquidity×0.20 + scenario-profile-quality×0.22 + user-confidence-adjustment + scenario-move-adjustment + horizon-adjustment − volatility-risk-penalty',
  boundary:'Not live AI. Fixed demonstration profiles only. No live provider observations, prediction model, personalized suitability assessment, order execution, custody or wallet signing.'
});

const stableId=(value)=>{
  let hash=2166136261;
  for(const character of value){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return `qelly-analysis-${(hash>>>0).toString(16).padStart(8,'0')}`;
};
const freezeList=(values)=>Object.freeze(values.map((value)=>typeof value==='object'&&value!==null?Object.freeze({...value}):value));

export const decisionAssets=Object.freeze(Object.entries(ASSET_PROFILES).map(([id,profile])=>Object.freeze({id,...profile})));

export function normalizeDecisionInput(input={}){
  const assetId=ASSET_PROFILES[input.assetId]?input.assetId:'QI-CRYPTO-BTC';
  const horizon=Object.hasOwn(horizonAdjustment,input.horizon)?input.horizon:'7d';
  const risk=Object.hasOwn(riskPenalty,input.risk)?input.risk:'balanced';
  return Object.freeze({
    assetId,
    horizon,
    risk,
    evidenceConfidence:clamp(input.evidenceConfidence??70,25,95),
    scenarioMove:clamp(input.scenarioMove??0,-30,30),
    thesis:cleanText(input.thesis),
    invalidationCondition:cleanText(input.invalidationCondition)
  });
}

export function evaluateDecision(rawInput={}){
  const input=normalizeDecisionInput(rawInput);
  const asset=ASSET_PROFILES[input.assetId];
  const scenarioContribution=input.scenarioMove*0.55;
  const confidenceContribution=(input.evidenceConfidence-50)*0.28;
  const volatilityPenalty=(asset.volatility/100)*riskPenalty[input.risk];
  const components=Object.freeze({
    momentum:Number((asset.momentum*0.34).toFixed(2)),
    liquidity:Number((asset.liquidity*0.20).toFixed(2)),
    scenarioProfileQuality:Number((asset.evidence*0.22).toFixed(2)),
    userConfidenceAdjustment:Number(confidenceContribution.toFixed(2)),
    scenarioMoveAdjustment:Number(scenarioContribution.toFixed(2)),
    horizonAdjustment:horizonAdjustment[input.horizon],
    volatilityRiskPenalty:Number((-volatilityPenalty).toFixed(2))
  });
  const score=clamp(Object.values(components).reduce((sum,value)=>sum+value,0),0,100);
  const posture=score>=72?'Research candidate':score>=55?'Monitor with conditions':score>=40?'Wait for stronger evidence':'Avoid new exposure';
  const confidenceBand=input.evidenceConfidence>=80?'High':input.evidenceConfidence>=60?'Moderate':'Low';
  const riskPosture=asset.volatility>=75?'Elevated':asset.volatility>=62?'Moderate-high':'Moderate';
  const qualityDimensions=Object.freeze({
    dataQuality:asset.evidence,
    providerAgreement:0,
    freshness:0,
    modelCertainty:100,
    historicalStability:asset.stability
  });
  const sourceQualityComposite=Number((
    qualityDimensions.dataQuality*0.30+
    qualityDimensions.providerAgreement*0.20+
    qualityDimensions.freshness*0.20+
    qualityDimensions.modelCertainty*0.15+
    qualityDimensions.historicalStability*0.15
  ).toFixed(1));
  const sourceQuality=Object.freeze({
    dimensions:qualityDimensions,
    composite:sourceQualityComposite,
    interpretation:'Composite describes the demonstration package, not current market truth. Zero freshness and provider agreement prevent a live-evidence classification.',
    warnings:Object.freeze([
      'No live provider observation is attached.',
      'Provider agreement and freshness are unavailable.',
      'Model certainty means calculation repeatability, not predictive accuracy.',
      'User-assessed confidence is an assumption and is not source quality.'
    ])
  });
  const scoreForScenario=(move)=>{
    const scenarioScore=score-components.scenarioMoveAdjustment+move*0.55;
    const normalized=Number(clamp(scenarioScore,0,100).toFixed(1));
    return Object.freeze({
      move,
      score:normalized,
      posture:normalized>=72?'Research candidate':normalized>=55?'Monitor with conditions':normalized>=40?'Wait for stronger evidence':'Avoid new exposure'
    });
  };
  const counterfactuals=freezeList([-20,-10,0,10,20].map(scoreForScenario));
  const decisionGates=freezeList([
    {id:'hypothesis',label:'Hypothesis stated',state:input.thesis?'pass':'attention',detail:input.thesis?'A human thesis is recorded.':'Add a falsifiable human thesis.'},
    {id:'invalidation',label:'Invalidation defined',state:input.invalidationCondition?'pass':'blocked',detail:input.invalidationCondition?'An observable invalidation condition is recorded.':'Decision reliance is blocked until an invalidation condition is stated.'},
    {id:'freshness',label:'Fresh evidence attached',state:'blocked',detail:'No timestamped live provider observations are attached.'},
    {id:'agreement',label:'Independent agreement',state:'blocked',detail:'No cross-provider agreement measure is available.'},
    {id:'execution',label:'Human control preserved',state:'pass',detail:'Execution, custody and wallet signing remain disabled.'}
  ]);
  const passedGates=decisionGates.filter((gate)=>gate.state==='pass').length;
  const blockedGates=decisionGates.filter((gate)=>gate.state==='blocked').length;
  const readiness=Object.freeze({
    state:blockedGates?'research-only':passedGates===decisionGates.length?'review-ready':'needs-review',
    passed:passedGates,
    blocked:blockedGates,
    total:decisionGates.length,
    label:blockedGates?'Research only · evidence incomplete':'Ready for human review'
  });
  const sourceRecords=freezeList([
    {
      sourceId:'qelly-fixed-scenario-profile-v2',
      provider:'Qelly deterministic scenario library',
      sourceUrl:null,
      observedAt:null,
      ingestedAt:null,
      freshnessState:'not-live',
      entitlement:'internal-demonstration',
      qualityFlags:['simulated','fixed-profile','no-provider-agreement','no-live-freshness'],
      inputReferences:[input.assetId]
    }
  ]);
  const observedFacts=Object.freeze([]);
  const scenarioObservations=Object.freeze([
    `${asset.symbol} fixed-profile momentum input: ${asset.momentum}/100.`,
    `${asset.symbol} fixed-profile liquidity input: ${asset.liquidity}/100.`,
    `${asset.symbol} fixed-profile volatility input: ${asset.volatility}/100.`,
    `${asset.symbol} fixed-profile evidence-quality input: ${asset.evidence}/100.`
  ]);
  const derivedMetrics=Object.freeze([
    `Explainable composite score: ${Number(score.toFixed(1))}/100.`,
    `Source-package quality composite: ${sourceQualityComposite}/100 with live freshness and provider agreement unavailable.`,
    `Scenario contribution: ${components.scenarioMoveAdjustment}; volatility-risk penalty: ${components.volatilityRiskPenalty}.`
  ]);
  const inferences=Object.freeze([
    `The deterministic framework maps the selected inputs to “${posture}”.`,
    `${riskPosture} scenario risk follows from the fixed volatility profile and selected risk posture.`,
    'This posture is a research triage inference, not a forecast, recommendation or instruction.'
  ]);
  const assumptions=Object.freeze([
    `The user-assessed evidence confidence is ${input.evidenceConfidence}%.`,
    `The selected scenario move is ${input.scenarioMove.toFixed(1)}%.`,
    `The analysis horizon is ${input.horizon} and risk posture is ${input.risk}.`,
    input.thesis?`Human thesis: ${input.thesis}`:'No human thesis was supplied.',
    input.invalidationCondition?`Human invalidation condition: ${input.invalidationCondition}`:'No explicit invalidation condition was supplied.'
  ]);
  const supports=Object.freeze([
    `The fixed ${asset.symbol} scenario profile assigns ${asset.evidence}/100 to demonstration evidence quality.`,
    `The fixed liquidity-resilience input is ${asset.liquidity}/100 for the selected horizon.`,
    input.scenarioMove>=0
      ?`The user-selected scenario assumes a ${input.scenarioMove.toFixed(1)}% constructive move.`
      :`The user-selected scenario stress-tests a ${Math.abs(input.scenarioMove).toFixed(1)}% adverse move.`
  ]);
  const contradictions=Object.freeze([
    `${asset.symbol} fixed-profile volatility is ${asset.volatility}/100 and can invalidate a directional thesis quickly.`,
    confidenceBand==='Low'
      ?'User-assessed confidence is below the threshold for a strong research posture.'
      :'User-assessed confidence does not replace verified provider evidence.',
    'No current price, volume, order-book, derivatives, macro, news or cross-provider evidence is attached.',
    input.invalidationCondition?'The supplied invalidation condition must be checked before the posture is relied on.':'The absence of an explicit invalidation condition weakens auditability.'
  ]);
  const uncertainty=Object.freeze([
    'Current market state is unknown because live observations are absent.',
    'The score is sensitive to user-selected confidence and scenario move.',
    'Historical calibration, forecast error and out-of-sample stability are not measured.',
    'Transaction costs, liquidity at execution, portfolio exposure and suitability are not assessed.'
  ]);
  const missingInformation=Object.freeze([
    'Timestamped provider observations and source URLs.',
    'Freshness, cross-provider agreement and anomaly flags.',
    'Current volatility regime, liquidity depth and derivatives positioning.',
    'Relevant macro, event, filing and news evidence.',
    input.invalidationCondition?'Evidence showing whether the invalidation condition has occurred.':'A precise human invalidation condition.'
  ]);
  const nextSteps=Object.freeze([
    'Attach timestamped provider records and verify freshness before relying on the posture.',
    'Compare at least two independent providers and surface disagreements.',
    `Re-run the scenario at ${Math.min(-10,input.scenarioMove-5)}% and ${Math.max(10,input.scenarioMove+5)}% to test sensitivity.`,
    'Record the final human decision, rejected alternatives and contradictory evidence.'
  ]);
  const analysisKey=JSON.stringify(input);
  const analysisId=stableId(`${METHOD.version}:${analysisKey}`);
  const decisionRecord=Object.freeze({
    analysisId,
    consideredAction:posture,
    alternatives:Object.freeze(['Research candidate','Monitor with conditions','Wait for stronger evidence','Avoid new exposure']),
    rationale:`Deterministic composite ${Number(score.toFixed(1))}/100 under method ${METHOD.id}@${METHOD.version}.`,
    confidence:input.evidenceConfidence/100,
    status:'considered-not-executed',
    humanOverrideRequired:true,
    executionStatus:'disabled'
  });
  return Object.freeze({
    schemaVersion:'qelly.decision-support/2.0.0',
    analysisId,
    input,
    asset:Object.freeze({...asset,id:input.assetId}),
    score:Number(score.toFixed(1)),
    posture,
    confidenceBand,
    riskPosture,
    supports,
    contradictions,
    nextSteps,
    observedFacts,
    scenarioObservations,
    derivedMetrics,
    inferences,
    assumptions,
    uncertainty,
    missingInformation,
    sourceRecords,
    sourceQuality,
    counterfactuals,
    decisionGates,
    readiness,
    methodology:Object.freeze({...METHOD,components}),
    decisionRecord,
    execution:false,
    modelState:METHOD.type,
    boundary:`Decision-support preview only. ${METHOD.boundary}`
  });
}
