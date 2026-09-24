const finite=(value)=>value==null||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const round=(value,digits=6)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;

const macroUnavailable=(reason='Governed macro reference data is unavailable.')=>({
  state:'unavailable',
  level:'UNAVAILABLE',
  provider:null,
  observedAt:null,
  freshness:'UNAVAILABLE',
  intradayFeedConnected:false,
  eligibilityImpact:'none',
  fxReference:{eurUsd:null,usdInr:null,eurInr:null},
  unavailableSeries:['DXY','US_2Y','US_10Y','YIELD_CURVE','EQUITY_INDEXES','VOLATILITY_INDEXES','GOLD','OIL','POLICY_RATE','CPI','PCE','JOBS'],
  reason,
  cadenceBoundary:'Daily reference data is not substituted for intraday market evidence or directional eligibility.'
});

export function buildDecisionMacroContext(providerResult){
  const rates=providerResult?.data?.rates;
  const usd=finite(rates?.USD),inr=finite(rates?.INR);
  if(!rates||usd===null||usd<=0||inr===null||inr<=0)return macroUnavailable(providerResult?.fallbackReason||'ECB reference-rate data is unavailable or incomplete.');
  const stale=String(providerResult?.truthState||'').toLowerCase().includes('stale');
  return {
    state:'available',
    level:'DAILY_REFERENCE',
    provider:providerResult?.provider||'ecb-reference-rates',
    observedAt:providerResult?.observationTime||null,
    ingestionTime:providerResult?.ingestionTime||null,
    freshness:providerResult?.freshness||'daily-working-day-reference',
    truthState:providerResult?.truthState||'delayed_provider',
    quality:providerResult?.quality||'official-central-bank-reference',
    attribution:providerResult?.attribution||'European Central Bank euro foreign exchange reference rates',
    license:providerResult?.license||null,
    cache:providerResult?.cache||null,
    referenceOnly:true,
    stale,
    intradayFeedConnected:false,
    eligibilityImpact:'none',
    fxReference:{
      eurUsd:round(usd,6),
      usdInr:round(inr/usd,6),
      eurInr:round(inr,6)
    },
    unavailableSeries:['DXY','US_2Y','US_10Y','YIELD_CURVE','EQUITY_INDEXES','VOLATILITY_INDEXES','GOLD','OIL','POLICY_RATE','CPI','PCE','JOBS'],
    reason:'Official ECB daily working-day FX reference rates are available as delayed macro context only.',
    cadenceBoundary:'ECB reference rates are daily reference observations, not executable or intraday market quotes. They do not create, strengthen or suppress Decision eligibility.',
    methodology:'EUR/USD and EUR/INR use ECB quote-per-EUR reference rates; USD/INR is the same-day ECB INR-per-EUR rate divided by USD-per-EUR.',
    limitations:[
      'No DXY, U.S. sovereign-yield, equity-index, volatility-index, commodity, policy-rate or economic-release series is connected to this Decision view.',
      'Daily ECB reference FX is not used as a proxy for DXY, live USD/INR, risk-on/risk-off state or scheduled event risk.'
    ]
  };
}

export function buildUnavailableDecisionEventRisk(){
  return {
    state:'unavailable',
    level:'UNAVAILABLE',
    provider:null,
    scheduledFeedConnected:false,
    eventCount:0,
    events:[],
    nextEventAt:null,
    timeUntilNextEventMs:null,
    affectedAssets:[],
    supportedRiskLevels:['LOW','MEDIUM','HIGH','EXTREME'],
    eligibilityImpact:'none',
    reason:'No verified machine-readable scheduled-event feed is connected to this Decision view, so no event-risk score or time-to-event is manufactured.',
    calendarBoundary:'The TradingView Economic Calendar is an isolated display embed. QELLY does not read widget values into Decision Intelligence.',
    newsBoundary:'Recent news is evidence context only and is not converted into a scheduled central-bank, CPI, PCE, jobs, GDP, earnings, unlock, protocol, regulatory, ETF or India-market event.',
    gatingBoundary:'High-impact event gating remains unavailable until a verified scheduled feed supplies event identity, source, scheduled time, affected assets and impact level.'
  };
}

export const __decisionMacroEventsTest=Object.freeze({finite,macroUnavailable});
