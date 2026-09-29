import {buildDecisionScenarioDistribution,buildDecisionWalkForwardCalibration} from './decision-proven-graph.js';

const round=(value,digits=4)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const classProbabilities=(forecast)=>Object.freeze({
  bullish:round(forecast?.probabilities?.bull??0,4),
  neutral:round(forecast?.probabilities?.base??0,4),
  bearish:round(forecast?.probabilities?.bear??0,4)
});
const ranked=(probabilities)=>Object.entries(probabilities).sort((a,b)=>b[1]-a[1]);
const matchingReliabilityBin=(calibration,probability)=>(calibration?.reliabilityBins||[]).find(bin=>probability>=Number(bin.low)&&probability<(Number(bin.high)===1?1.000001:Number(bin.high)))||null;

const publicationGate=(probabilities,calibration)=>{
  const [leading]=ranked(probabilities),[scenario,probability]=leading;
  const bin=matchingReliabilityBin(calibration,probability);
  const calibrated=calibration?.eligible===true;
  const elevated=probability>=.8,extreme=probability>=.9;
  const elevatedGate=calibrated&&Number(calibration.sampleSize)>=60&&Number(bin?.sampleSize)>=12&&Number(bin?.hitRate)>=Math.max(.7,probability-.1)&&Number(bin?.confidenceInterval95?.low)>=.5;
  const extremeGate=calibrated&&Number(calibration.sampleSize)>=200&&Number(bin?.sampleSize)>=200&&Number(bin?.hitRate)>=.85&&Number(bin?.confidenceInterval95?.low)>=.65;
  const probabilityPublishable=calibrated&&(!elevated||(extreme?extremeGate:elevatedGate));
  return {
    scenario,modelProbability:round(probability,4),calibrated,
    elevated,extreme,
    probabilityPublishable,
    state:!calibrated?'UNCALIBRATED':probabilityPublishable?'PUBLISHABLE':'HIGH_PROBABILITY_WITHHELD',
    reliabilityBin:bin?{...bin}:null,
    calibratedLeadingProbability:calibrated&&bin&&Number(bin.sampleSize)>=8?round(bin.hitRate,4):null,
    calibratedLeadingProbabilityConfidenceInterval95:calibrated&&bin&&Number(bin.sampleSize)>=8?bin.confidenceInterval95:null,
    rule:'Probabilities at or above 80% require stronger independent sample and reliability evidence; 90%+ requires at least 200 independent resolved outcomes in the relevant reliability bucket unless a statistically justified pooled model is implemented, plus >=85% empirical hit rate and a >=65% lower 95% confidence bound. No pooled-model exception is currently implemented.'
  };
};

const horizonResearch=(raw,{interval,bars,paths})=>{
  const distribution=buildDecisionScenarioDistribution(raw,{interval,horizonBars:bars,paths});
  const calibration=buildDecisionWalkForwardCalibration(raw,{interval,horizonBars:bars,minSamples:36});
  const modelProbabilities=classProbabilities(distribution);
  const gate=publicationGate(modelProbabilities,calibration);
  const order=ranked(modelProbabilities);
  const fan=distribution.fan.at(-1);
  const anchor=distribution.lastPrice;
  const expectedRangePct=anchor>0&&fan?round((fan.p75-fan.p25)/anchor*100,4):null;
  return {
    horizonBars:bars,
    horizonLabel:bars===1?'NEXT CANDLE':bars+' CANDLES',
    modelProbabilities,
    publishedProbabilities:gate.probabilityPublishable?modelProbabilities:null,
    probabilityState:gate.state,
    topScenario:{id:order[0][0],publishedProbability:gate.probabilityPublishable?order[0][1]:null},
    alternateScenario:{id:order[1][0],publishedProbability:gate.probabilityPublishable?order[1][1]:null},
    expectedRange:{p25:fan?.p25??null,p50:fan?.p50??null,p75:fan?.p75??null,widthPct:expectedRangePct},
    likelyBand:{low:fan?.p05??null,high:fan?.p95??null,innerLow:fan?.p25??null,innerHigh:fan?.p75??null},
    expectedVolatilityPct:distribution.expectedVolatilityPct,
    projection:{
      state:'PROJECTED',
      anchor,
      low:fan?.p05??null,
      innerLow:fan?.p25??null,
      median:fan?.p50??null,
      innerHigh:fan?.p75??null,
      high:fan?.p95??null,
      direction:fan?.p50>anchor?'UP':fan?.p50<anchor?'DOWN':'NEUTRAL',
      observed:false
    },
    calibration:{
      state:calibration.state,
      eligible:calibration.eligible===true,
      sampleSize:Number(calibration.sampleSize)||0,
      minimumSampleGate:Number(calibration.minimumSampleGate)||36,
      brierScore:calibration.brierScore??null,
      skillScore:calibration.skillScore??null,
      reliabilityGap:calibration.reliabilityGap??null,
      correctClassRate:calibration.correctClassRate??null,
      correctClassRateConfidenceInterval95:calibration.correctClassRateConfidenceInterval95??null,
      matchingReliabilityBin:gate.reliabilityBin,
      calibratedLeadingProbability:gate.calibratedLeadingProbability,
      calibratedLeadingProbabilityConfidenceInterval95:gate.calibratedLeadingProbabilityConfidenceInterval95,
      highProbabilityRule:gate.rule
    },
    invalidation:'Recompute when the next observed candle resolves, market-data freshness changes, the volatility/regime state changes, or the current observation set changes.',
    methodology:'Deterministic block-bootstrap distribution using only observations available at the current cut. Probability publication is separately governed by non-overlapping chronological walk-forward evidence.',
    boundary:gate.probabilityPublishable
      ?'Published probabilities remain research-model probabilities with an independently tested calibration gate; they are not guarantees.'
      :'Numeric next-move probabilities are withheld as UNCALIBRATED or insufficiently supported. Raw model probabilities remain diagnostic backend evidence and must not be presented as calibrated certainty.'
  };
};

export function buildDecisionNextMoveResearch(raw,{asset='BTC',interval='15m',customBars=null,paths=256}={}){
  const custom=customBars==null?null:Math.max(1,Math.min(12,Math.floor(Number(customBars)||1)));
  const horizons=[1,3,5,...(custom&&!([1,3,5].includes(custom))?[custom]:[])];
  const items=[...new Set(horizons)].map(bars=>horizonResearch(raw,{interval,bars,paths}));
  return {
    schemaVersion:'qelly.decision-next-move/1.0.0',
    asset,
    interval,
    state:'RESEARCH_ONLY',
    nextCandle:items.find(item=>item.horizonBars===1),
    horizons:items,
    customBars:custom,
    observedVsProjectedBoundary:'Observed candles end at the current market observation. Every next-move range, path and probability is projected research and must be visually distinct from observed data.',
    probabilityBoundary:'Evidence confidence, setup confidence and next-move probability are separate quantities. Numeric next-move probabilities are not published when the dedicated calibration gate fails.',
    execution:false
  };
}

export const __decisionNextMoveTest=Object.freeze({publicationGate,classProbabilities,matchingReliabilityBin});
