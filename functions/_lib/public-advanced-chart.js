import {buildPublicAssetIntelligence} from './public-asset-intelligence.js';

const STUDIES=Object.freeze([
  Object.freeze({id:'sma',label:'Simple moving average',family:'Trend baseline',job:'Test whether closes are holding above or below an equal-weighted baseline.',method:'Arithmetic mean of the latest closing observations.',defaultLength:20,minLength:2,maxLength:250,warmup:'length',interpretation:'Use slope, distance and repeated closes around the baseline as descriptive structure—not as a buy or sell instruction.',invalidation:'Treat a single cross as weak evidence; require the stated confirmation rule and inspect gaps.',failureModes:['Lag during fast regime changes','Whipsaw in range-bound markets','Sensitive to interval and sample window']}),
  Object.freeze({id:'ema',label:'Exponential moving average',family:'Responsive trend',job:'Test short-run direction with more weight on recent closes.',method:'Recursive exponentially weighted mean using α = 2 ÷ (length + 1).',defaultLength:21,minLength:2,maxLength:250,warmup:'length',interpretation:'Compare direction and persistence with a slower baseline; do not treat proximity as precision.',invalidation:'Invalidate a trend claim when the configured confirmation closes fail or continuity is broken.',failureModes:['Overreacts to short-lived moves','Seed method can alter early values','Not comparable across unaligned intervals']}),
  Object.freeze({id:'rsi',label:'Relative strength index',family:'Momentum regime',job:'Describe the balance of recent gains and losses without predicting reversal timing.',method:'Wilder-smoothed average gains and losses, transformed to a 0–100 oscillator.',defaultLength:14,minLength:2,maxLength:100,warmup:'length + 1',interpretation:'Thresholds describe the configured sample; elevated or depressed readings can persist.',invalidation:'Reject a divergence claim when peaks, troughs or observation cadence are not aligned.',failureModes:['Thresholds are regime-dependent','Divergence selection can be subjective','Gaps distort gain/loss smoothing']}),
  Object.freeze({id:'macd',label:'MACD',family:'Trend + momentum',job:'Compare fast and slow exponential trend estimates and inspect momentum change.',method:'Fast EMA minus slow EMA, with a signal EMA and histogram difference.',defaultLength:26,minLength:3,maxLength:250,warmup:'slow + signal',interpretation:'Use crossovers only with named fast, slow and signal parameters plus a confirmation rule.',invalidation:'Invalidate when the slow period is not greater than the fast period or the series lacks warm-up.',failureModes:['Multiple parameters increase sensitivity','Late in abrupt reversals','Histogram scale is instrument-dependent']}),
  Object.freeze({id:'bollinger',label:'Bollinger bands',family:'Dispersion envelope',job:'Place price relative to a rolling mean and sample-volatility envelope.',method:'Moving average plus and minus a configurable multiple of rolling standard deviation.',defaultLength:20,minLength:3,maxLength:250,warmup:'length',interpretation:'Band contact describes relative location; it does not establish reversal or breakout.',invalidation:'Reject squeeze or expansion claims when interval continuity or multiplier is unspecified.',failureModes:['Volatility clusters break stable-band assumptions','Band touches are not directional signals','Outliers can widen the envelope']}),
  Object.freeze({id:'atr',label:'Average true range',family:'Realized range',job:'Describe recent absolute range while accounting for gaps between bars.',method:'Wilder-smoothed true range from high, low and previous close.',defaultLength:14,minLength:2,maxLength:100,warmup:'length + 1',interpretation:'ATR measures magnitude in price units; normalize before cross-instrument comparison.',invalidation:'Reject volatility comparisons when currency, interval or adjustment policy differs.',failureModes:['Directionless by design','Price scale limits comparison','Bad highs or lows contaminate the window']}),
  Object.freeze({id:'volume',label:'Volume participation',family:'Participation check',job:'Test whether price structure is accompanied by reported venue activity.',method:'Compare reported bar volume with its rolling median and range.',defaultLength:20,minLength:3,maxLength:250,warmup:'length',interpretation:'Venue volume is partial market coverage and never a complete demand measure.',invalidation:'Reject participation claims when venue scope or unit definition is absent.',failureModes:['Fragmented venues understate total activity','Wash activity can contaminate volume','Units differ across venues and contracts']})
]);

const INTERVALS=Object.freeze([
  Object.freeze({id:'1h',label:'1 hour',job:'Inspect intraday structure; requires continuous hourly bars.'}),
  Object.freeze({id:'4h',label:'4 hours',job:'Reduce intraday noise while preserving multi-day transitions.'}),
  Object.freeze({id:'1d',label:'1 day',job:'Inspect daily structure with explicit UTC session boundaries.'})
]);

const RANGES=Object.freeze([
  Object.freeze({id:'7d',label:'7 days',targetBars:{'1h':168,'4h':42,'1d':7}}),
  Object.freeze({id:'30d',label:'30 days',targetBars:{'1h':720,'4h':180,'1d':30}}),
  Object.freeze({id:'90d',label:'90 days',targetBars:{'1h':2160,'4h':540,'1d':90}}),
  Object.freeze({id:'1y',label:'1 year',targetBars:{'1h':8760,'4h':2190,'1d':365}})
]);

const integer=(value,fallback,min,max)=>{const parsed=Number.parseInt(value,10);return Number.isFinite(parsed)?Math.max(min,Math.min(max,parsed)):fallback;};
const choice=(value,catalog,fallback)=>catalog.some((item)=>item.id===value)?value:fallback;

export function buildPublicAdvancedChart(sources={},requestedAsset='QI-CRYPTO-BTC',input={}){
  const intelligence=buildPublicAssetIntelligence(sources,requestedAsset);
  const studyId=choice(String(input.study||'sma').toLowerCase(),STUDIES,'sma');
  const study=STUDIES.find((item)=>item.id===studyId);
  const interval=choice(String(input.interval||'1d').toLowerCase(),INTERVALS,'1d');
  const range=choice(String(input.range||'90d').toLowerCase(),RANGES,'90d');
  const length=integer(input.length,study.defaultLength,study.minLength,study.maxLength);
  const confirmation=integer(input.confirmation,2,1,10);
  const rangeContract=RANGES.find((item)=>item.id===range);
  const targetBars=rangeContract.targetBars[interval];
  const minimumBars=study.id==='macd'?length+9:length+1;
  const historicalSeries={
    state:'unavailable',points:[],pointCount:0,provider:null,observedAt:null,
    reason:'No rights-authorized internal historical crypto series is active. Qelly will not generate replacement candles.',
    externalDisplay:{provider:'TradingView',usage:'display-only',url:`https://www.tradingview.com/symbols/${intelligence.selected.symbol}USD/`,consumedByAnalytics:false}
  };
  const qualityGates=[
    {id:'identity',label:'Canonical instrument',state:'ready',purpose:'Prevent symbol or venue ambiguity.',detail:`${intelligence.selected.id} · ${intelligence.selected.network}`},
    {id:'source-rights',label:'Source and display rights',state:'blocked',purpose:'Ensure the series may be used inside Qelly analytics.',detail:historicalSeries.reason},
    {id:'timestamps',label:'Timestamp semantics',state:'blocked',purpose:'Define timezone, bar close and observation ordering.',detail:'No historical series is connected, so timestamps cannot be validated.'},
    {id:'cadence',label:'Cadence alignment',state:'blocked',purpose:'Verify every bar represents the selected interval.',detail:`Requested ${interval}; no bars available for cadence inspection.`},
    {id:'continuity',label:'Continuity and gaps',state:'blocked',purpose:'Identify missing, duplicate or out-of-order bars.',detail:'Continuity requires at least two governed observations.'},
    {id:'transform',label:'Adjustment and unit policy',state:'ready',purpose:'State the transformation boundary before calculation.',detail:'Crypto spot study requested in source currency; corporate-action adjustment is not asserted.'}
  ];
  const readyGates=qualityGates.filter((item)=>item.state==='ready').length;
  return {
    version:'governed-technical-study-workspace-v2',state:'study-plan-ready',job:'Configure one reproducible technical study, prove its series is usable, and write the condition that would invalidate the interpretation.',
    assets:intelligence.assets.map(({id,symbol,name,assetClass,network,observation})=>({id,symbol,name,assetClass,network,observation})),selected:intelligence.selected,
    studies:STUDIES,intervals:INTERVALS,ranges:RANGES,
    configuration:{study:studyId,interval,range,length,confirmation,targetBars,minimumBars,parameterReceipt:`${study.label} · length ${length} · ${interval} bars · ${range} window · ${confirmation} confirmation ${confirmation===1?'close':'closes'}`},
    selectedStudy:study,historicalSeries,qualityGates,
    protocol:[
      {step:'01',label:'Resolve',job:'Lock the canonical instrument, venue scope, interval and timezone before calculating.'},
      {step:'02',label:'Qualify',job:'Pass source-rights, timestamp, cadence, continuity and transformation gates.'},
      {step:'03',label:'Compute',job:`Calculate ${study.label} only after ${minimumBars} or more valid observations are present.`},
      {step:'04',label:'Interpret',job:'Write a descriptive hypothesis, confirmation rule and explicit invalidation condition.'},
      {step:'05',label:'Provenance',job:'Send the parameter receipt, evidence boundary and human conclusion to Decision Provenance.'}
    ],
    readiness:{state:'blocked-no-series',readyGates,totalGates:qualityGates.length,missingBars:minimumBars,canCompute:false,computedStudies:0,forecastProduced:false,recommendationProduced:false},
    currentObservation:intelligence.selected.observation,
    sourceLedger:intelligence.sourceLedger,
    handoffs:[
      {route:'asset-intelligence',label:'Asset Intelligence',job:'Return to identity and evidence routing.'},
      {route:'indicator-library',label:'Indicator Library',job:'Inspect formulas and parameter definitions.'},
      {route:'timeseries-lab',label:'Time Series Lab',job:'Validate cadence, continuity and transformation contracts.'},
      {route:'news-research',label:'Qelly Chat & Research',job:'Investigate the hypothesis with sourced narrative evidence.'},
      {route:'decision-provenance',label:'Decision Provenance',job:'Record the study receipt, interpretation and invalidation.'}
    ],
    boundaries:{historicalSeriesAvailable:false,syntheticCandles:false,externalDisplayConsumedByAnalytics:false,personalizedRecommendation:false,forecast:false,execution:false,persistence:false,fabricatedFallback:false}
  };
}

export const __test=Object.freeze({STUDIES,INTERVALS,RANGES,integer,choice});
