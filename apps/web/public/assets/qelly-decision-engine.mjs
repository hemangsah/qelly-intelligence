const ASSET_PROFILES=Object.freeze({
  'QI-CRYPTO-BTC':Object.freeze({symbol:'BTC',name:'Bitcoin',momentum:62,volatility:58,liquidity:94,evidence:82}),
  'QI-CRYPTO-ETH':Object.freeze({symbol:'ETH',name:'Ethereum',momentum:55,volatility:64,liquidity:91,evidence:79}),
  'QI-CRYPTO-SOL':Object.freeze({symbol:'SOL',name:'Solana',momentum:68,volatility:78,liquidity:76,evidence:70}),
  'QI-CRYPTO-BNB':Object.freeze({symbol:'BNB',name:'BNB',momentum:51,volatility:61,liquidity:78,evidence:68}),
  'QI-CRYPTO-XRP':Object.freeze({symbol:'XRP',name:'XRP',momentum:43,volatility:74,liquidity:73,evidence:61}),
  'QI-CRYPTO-ADA':Object.freeze({symbol:'ADA',name:'Cardano',momentum:47,volatility:72,liquidity:67,evidence:63})
});

const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
const riskPenalty=Object.freeze({conservative:18,balanced:10,aggressive:4});
const horizonAdjustment=Object.freeze({'24h':-4,'7d':0,'30d':3,'90d':5});

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
    scenarioMove:clamp(input.scenarioMove??0,-30,30)
  });
}

export function evaluateDecision(rawInput={}){
  const input=normalizeDecisionInput(rawInput);
  const asset=ASSET_PROFILES[input.assetId];
  const scenarioContribution=input.scenarioMove*0.55;
  const confidenceContribution=(input.evidenceConfidence-50)*0.28;
  const volatilityPenalty=(asset.volatility/100)*riskPenalty[input.risk];
  const score=clamp(
    asset.momentum*0.34+asset.liquidity*0.20+asset.evidence*0.22+
    confidenceContribution+scenarioContribution+horizonAdjustment[input.horizon]-volatilityPenalty,
    0,
    100
  );
  const posture=score>=72?'Research candidate':score>=55?'Monitor with conditions':score>=40?'Wait for stronger evidence':'Avoid new exposure';
  const confidenceBand=input.evidenceConfidence>=80?'High':input.evidenceConfidence>=60?'Moderate':'Low';
  const riskPosture=asset.volatility>=75?'Elevated':asset.volatility>=62?'Moderate-high':'Moderate';
  const supports=[
    `${asset.symbol} evidence quality scores ${asset.evidence}/100 in the deterministic review profile.`,
    `Liquidity resilience scores ${asset.liquidity}/100 for the selected horizon.`,
    input.scenarioMove>=0
      ?`The selected scenario contributes a ${input.scenarioMove.toFixed(1)}% constructive move assumption.`
      :`The selected scenario explicitly stress-tests a ${Math.abs(input.scenarioMove).toFixed(1)}% adverse move.`
  ];
  const contradictions=[
    `${asset.symbol} volatility scores ${asset.volatility}/100 and can invalidate a directional thesis quickly.`,
    confidenceBand==='Low'
      ?'Evidence confidence is below the threshold for a strong decision posture.'
      :'Confidence is user-selected and does not replace verified live evidence.',
    'The engine has no order execution, custody, wallet signing or personalized-advice capability.'
  ];
  const nextSteps=[
    'Verify provider freshness and agreement before relying on the posture.',
    `Re-run the scenario at both ${Math.min(-10,input.scenarioMove-5)}% and ${Math.max(10,input.scenarioMove+5)}% to test sensitivity.`,
    'Record the final human decision and the evidence that contradicted it.'
  ];
  return Object.freeze({
    input,
    asset:Object.freeze({...asset,id:input.assetId}),
    score:Number(score.toFixed(1)),
    posture,
    confidenceBand,
    riskPosture,
    supports:Object.freeze(supports),
    contradictions:Object.freeze(contradictions),
    nextSteps:Object.freeze(nextSteps),
    execution:false,
    modelState:'deterministic-explainable-framework',
    boundary:'Decision-support preview only. Not live AI, investment advice, or an execution instruction.'
  });
}
