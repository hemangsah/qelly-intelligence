import {evidenceProfileDefinition} from './decision-asset-evidence-profiles.js';

const BANDS=Object.freeze(['SCALP','INTRADAY','SWING','POSITION']);
const bandWeights=(scalp,intraday,swing,position)=>Object.freeze({SCALP:scalp,INTRADAY:intraday,SWING:swing,POSITION:position});
const row=(id,label,weights,purpose)=>Object.freeze({id,label,weights:bandWeights(...weights),purpose});
const freezePolicy=(rows)=>Object.freeze(rows.map(item=>row(...item)));

const POLICIES=Object.freeze({
  crypto:freezePolicy([
    ['market-structure','Market structure',[1,1,.95,.8],'Observed structure and price action.'],
    ['volume-volatility','Volume & volatility',[1,.95,.85,.7],'Observed participation and risk regime.'],
    ['multi-timeframe','Multi-timeframe',[.8,.9,.95,1],'Independent timeframe agreement.'],
    ['derivatives','Funding / OI / basis',[.9,.9,.8,.65],'Perpetual carry and positioning context where verified.'],
    ['liquidity','Liquidity / book depth',[1,.9,.65,.4],'Point-in-time execution/liquidity risk where verified.'],
    ['news-events','Protocol / regulatory / market news',[.85,.85,.8,.75],'Time-bounded source-backed event context.'],
    ['event-risk','Scheduled event risk',[.9,.9,.85,.8],'Verified scheduled risk only; never inferred from headlines.'],
    ['cross-asset','Cross-asset context',[.6,.75,.85,.9],'Relative/dependence context where governed.'],
    ['on-chain','On-chain evidence',[.2,.35,.65,.85],'Network activity where authorized data exists.'],
    ['exchange-flow','Exchange / ETF / institutional flow',[.45,.6,.75,.85],'Attributed or governed flow only.'],
    ['macro','Macro / rates context',[.1,.25,.5,.75],'Macro relevance increases with holding horizon.'],
    ['options','Options positioning',[.25,.4,.6,.75],'Options context where authorized data exists.'],
    ['fundamentals','Protocol fundamentals',[.05,.15,.45,.8],'Protocol/issuance/staking fundamentals matter more at longer horizons.']
  ]),
  fx:freezePolicy([
    ['market-structure','Market structure',[1,.95,.85,.7],'Decision-grade FX price structure.'],
    ['central-banks','Central banks / policy',[.55,.75,.95,1],'Policy decisions and guidance.'],
    ['rates-yields','Rates / yield differentials',[.55,.75,.95,1],'Relative rates and curve evidence.'],
    ['inflation','CPI / inflation',[.35,.6,.9,1],'Inflation releases and trends.'],
    ['employment','Employment / labor',[.35,.6,.9,1],'Labor releases and trends.'],
    ['growth','GDP / growth',[.25,.5,.85,1],'Growth releases and trends.'],
    ['risk-sentiment','Risk sentiment / cross-asset',[.75,.85,.9,.85],'Cross-asset risk context.'],
    ['cot','COT / positioning',[.1,.25,.55,.75],'Positioning where authorized and timely.'],
    ['reference-rates','Reference FX rates',[.05,.1,.2,.3],'Reference observations are context, not executable intraday quotes.']
  ]),
  'indian-equities':freezePolicy([
    ['market-structure','Market structure',[1,.95,.8,.65],'Licensed market structure.'],
    ['results','Results / guidance',[.35,.6,.9,1],'Issuer results and guidance.'],
    ['corporate-actions','Corporate actions',[.6,.75,.85,.9],'Official corporate-action evidence.'],
    ['exchange-disclosures','NSE / BSE disclosures',[.55,.75,.9,1],'Authorized exchange disclosures.'],
    ['fii-dii','FII / DII flows',[.65,.8,.85,.8],'Governed flow context.'],
    ['rbi','RBI / domestic rates',[.35,.55,.8,.95],'Domestic rates and policy.'],
    ['sector-index','Sector / index context',[.7,.8,.85,.85],'Sector and benchmark context.'],
    ['domestic-macro','Domestic macro',[.25,.45,.75,.9],'Domestic macro relevance increases with horizon.'],
    ['sebi','SEBI / regulatory events',[.5,.65,.8,.85],'Official regulatory events.']
  ]),
  'global-equities':freezePolicy([
    ['market-structure','Market structure',[1,.95,.8,.65],'Licensed market structure.'],
    ['earnings','Earnings / guidance',[.4,.65,.95,1],'Reported earnings and guidance.'],
    ['filings','Regulatory filings',[.15,.35,.8,1],'Official issuer filings.'],
    ['sector-index','Sector / index context',[.7,.8,.9,.9],'Benchmark and sector evidence.'],
    ['rates-macro','Rates / macro',[.3,.5,.8,.95],'Rates and macro context.'],
    ['options','Options positioning',[.55,.7,.75,.65],'Options evidence where authorized.']
  ]),
  indices:freezePolicy([
    ['market-structure','Index market structure',[1,.95,.8,.7],'Governed index structure.'],
    ['breadth','Breadth',[.8,.9,.9,.8],'Constituent participation.'],
    ['sector-contribution','Sector contribution',[.7,.85,.9,.85],'Sector drivers.'],
    ['macro-rates','Macro / rates',[.35,.55,.85,.95],'Macro/rates context.'],
    ['flows','Index / futures flows',[.65,.8,.9,.9],'Authorized flow evidence.']
  ]),
  'metals-commodities':freezePolicy([
    ['market-structure','Market structure',[1,.95,.8,.7],'Governed commodity structure.'],
    ['usd-yields','USD / yields',[.65,.75,.9,.95],'Currency and yield context.'],
    ['inventories','Inventories / stocks',[.3,.55,.9,1],'Official inventory evidence.'],
    ['futures-positioning','Futures positioning',[.35,.55,.8,.9],'Authorized positioning.'],
    ['macro','Macro demand context',[.3,.5,.8,.9],'Demand/macro context.'],
    ['geopolitics','Geopolitical supply risk',[.8,.85,.9,.85],'Source-backed supply disruption risk.'],
    ['agency-reports','Agency reports',[.15,.35,.7,.9],'Official agency reports.']
  ]),
  'rates-bonds':freezePolicy([
    ['market-structure','Yield / price structure',[.85,.85,.75,.7],'Governed rates-market structure.'],
    ['central-banks','Central-bank policy',[.7,.85,1,1],'Policy decisions and guidance.'],
    ['inflation-growth','Inflation / growth',[.5,.7,.95,1],'Macro releases and trends.'],
    ['curve','Yield curve',[.65,.8,.95,1],'Governed curve context.'],
    ['auctions','Auction / issuance',[.55,.7,.8,.85],'Official issuance evidence.'],
    ['positioning','Futures positioning',[.35,.55,.75,.8],'Authorized positioning.']
  ]),
  etfs:freezePolicy([
    ['market-structure','Market structure',[1,.95,.8,.65],'Licensed ETF structure.'],
    ['flows','Fund flows',[.7,.85,.95,.95],'Authorized fund-flow evidence.'],
    ['holdings','Holdings / basket',[.25,.45,.75,.9],'Authorized holdings evidence.'],
    ['tracking','Index / tracking context',[.55,.7,.85,.9],'Benchmark/tracking context.'],
    ['macro','Macro context',[.25,.45,.75,.9],'Macro relevance increases with horizon.']
  ])
});

const intervalBand=(interval)=>{
  const value=String(interval||'').toLowerCase();
  if(['1m','3m','5m'].includes(value))return 'SCALP';
  if(['15m','30m','1h'].includes(value))return 'INTRADAY';
  if(['2h','4h','8h','12h'].includes(value))return 'SWING';
  if(['1d','1w','1mo','1mth'].includes(value))return 'POSITION';
  return 'INTRADAY';
};
const horizonBand=(horizon)=>{
  const value=String(horizon||'').toLowerCase();
  if(['1h','4h'].includes(value))return 'SCALP';
  if(['12h'].includes(value))return 'INTRADAY';
  if(['1d','3d'].includes(value))return 'SWING';
  if(['7d','1w','1mo','1mth'].includes(value))return 'POSITION';
  return 'INTRADAY';
};
export const resolveEvidenceHorizonBand=(interval,horizon)=>{
  const i=intervalBand(interval),h=horizonBand(horizon);
  return BANDS[Math.max(BANDS.indexOf(i),BANDS.indexOf(h))]||'INTRADAY';
};
const availabilityFactor=(state)=>String(state||'UNAVAILABLE').toUpperCase()==='AVAILABLE'?1:String(state||'').toUpperCase()==='PARTIAL'?.45:0;
const round=(value,digits=3)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):0;

export const decisionAssetClassEvidencePolicy=(assetClass)=>{
  const definition=evidenceProfileDefinition(assetClass);
  return definition?POLICIES[definition.id]||Object.freeze([]):Object.freeze([]);
};

export function buildDecisionAssetClassEvidence({assetClass='crypto',interval='15m',horizon='4h',profile=null,evidence={}}={}){
  const definition=evidenceProfileDefinition(assetClass);
  if(!definition)return {schemaVersion:'qelly.decision-asset-class-evidence/1.0.0',profileId:null,state:'UNAVAILABLE',band:resolveEvidenceHorizonBand(interval,horizon),modules:[],reason:'No governed evidence profile exists for this asset class.'};
  const band=resolveEvidenceHorizonBand(interval,horizon);
  const policy=POLICIES[definition.id]||[];
  const profileModules=new Map((profile?.modules||[]).map(item=>[item.id,item]));
  const modules=policy.map(item=>{
    const profileModule=profileModules.get(item.id)||{};
    const state=String(profileModule.state||'UNAVAILABLE').toUpperCase();
    const sourceKey=profileModule.sourceKey||null;
    const source=sourceKey?evidence?.[sourceKey]:null;
    const baseRelevanceWeight=Number(item.weights[band])||0;
    const factor=availabilityFactor(state);
    const effectiveRelevanceWeight=round(baseRelevanceWeight*factor);
    const existingEngine=profileModule.eligibilityImpact==='existing-engine-only';
    const referenceOnly=source?.referenceOnly===true||source?.eligibilityImpact==='none';
    return {
      id:item.id,label:item.label,purpose:item.purpose,applicability:profileModule.applicability||'RELEVANT',
      sourceKey,sourceRequirement:profileModule.sourceRequirement||null,state,
      baseRelevanceWeight:round(baseRelevanceWeight),availabilityFactor:factor,effectiveRelevanceWeight,
      decisionRole:existingEngine?'ALREADY_IN_CORE_ENGINE':state==='UNAVAILABLE'?'UNAVAILABLE':'CONTEXT_ONLY',
      directionalWeight:0,
      referenceOnly,
      eligibilityImpact:existingEngine?'existing-engine-only':'none',
      boundary:existingEngine?'This relevance layer does not re-score evidence already consumed by the core Decision engine.':referenceOnly?'Reference/context evidence is disclosed but cannot create directional eligibility.':'No directional adapter is defined for this evidence module in this wave.'
    };
  });
  const available=modules.filter(item=>item.state==='AVAILABLE');
  const partial=modules.filter(item=>item.state==='PARTIAL');
  const missingHighRelevance=modules.filter(item=>item.state==='UNAVAILABLE'&&item.baseRelevanceWeight>=.5);
  const effectiveTotal=modules.reduce((sum,item)=>sum+item.effectiveRelevanceWeight,0);
  return {
    schemaVersion:'qelly.decision-asset-class-evidence/1.0.0',
    profileId:definition.id,label:definition.label,state:definition.state,band,interval:String(interval),horizon:String(horizon),
    modules,
    coverage:{
      total:modules.length,available:available.length,partial:partial.length,unavailable:modules.length-available.length-partial.length,
      effectiveRelevanceTotal:round(effectiveTotal),
      highRelevanceMissing:missingHighRelevance.length
    },
    availableRelevant:modules.filter(item=>item.effectiveRelevanceWeight>0).sort((a,b)=>b.effectiveRelevanceWeight-a.effectiveRelevanceWeight).map(item=>item.id),
    missingHighRelevance:missingHighRelevance.map(item=>({id:item.id,label:item.label,baseRelevanceWeight:item.baseRelevanceWeight,sourceRequirement:item.sourceRequirement})),
    horizonPolicy:{
      rule:'Use the longer of the selected chart timeframe band and research horizon band.',
      shortHorizon:'Scalp/intraday emphasizes observed structure, volatility, flow/liquidity and event risk.',
      longHorizon:'Swing/position increases macro and fundamental relevance where genuine data exists.'
    },
    boundary:'These are evidence-relevance weights, not directional votes or probabilities. Unavailable evidence receives zero effective relevance. Context/reference evidence has zero directional weight. Existing core evidence is not counted again.',
    providerBoundary:'A provider-directory listing, user assumption, embed, or unlicensed dataset never upgrades an unavailable module to available evidence.'
  };
}

export const decisionAssetClassEvidenceCatalog=()=>Object.entries(POLICIES).map(([profileId,modules])=>({
  profileId,
  bands:[...BANDS],
  modules:modules.map(item=>({id:item.id,label:item.label,weights:{...item.weights},purpose:item.purpose}))
}));

export const __decisionAssetClassEvidenceTest=Object.freeze({POLICIES,BANDS,intervalBand,horizonBand,availabilityFactor});
