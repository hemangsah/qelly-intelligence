const freezeModules=(rows)=>Object.freeze(rows.map((row)=>Object.freeze(row)));

const PROFILES=Object.freeze({
  crypto:Object.freeze({
    id:'crypto',label:'Crypto',state:'ACTIVE_DECISION_PROFILE',
    description:'Price/structure remains primary; derivatives, liquidity, protocol/regulatory, flow and cross-asset context are used only where governed data exists.',
    modules:freezeModules([
      ['market-structure','Market structure','CORE','structure','Structure / price action'],
      ['volume-volatility','Volume & volatility','CORE','market','Observed candles'],
      ['multi-timeframe','Multi-timeframe','CORE','multiTimeframe','Observed candles'],
      ['derivatives','Funding / OI / basis','RELEVANT','derivatives','Hyperliquid perpetuals'],
      ['liquidity','Liquidity / book depth','RELEVANT','liquidity','Hyperliquid L2'],
      ['news-events','Protocol / regulatory / market news','RELEVANT','news','GDELT context'],
      ['event-risk','Scheduled event risk','RELEVANT','eventRisk','Verified scheduled feed required'],
      ['cross-asset','Cross-asset context','RELEVANT','crossAsset','Same-venue crypto benchmark'],
      ['on-chain','On-chain evidence','OPTIONAL','onChain','Authorized on-chain source required'],
      ['exchange-flow','Exchange / ETF / institutional flow','OPTIONAL','institutionalFlow','Authorized flow source required'],
      ['macro','Macro / rates context','CONTEXT','macro','Governed macro source'],
      ['options','Options positioning','OPTIONAL','options','Authorized options source required'],
      ['fundamentals','Protocol fundamentals','OPTIONAL','fundamentals','Authorized protocol/fundamental source required']
    ])
  }),
  fx:Object.freeze({
    id:'fx',label:'Forex / FX',state:'REFERENCE_ONLY',
    description:'Decision-grade FX requires intraday candles plus central-bank, rates, inflation, labor, growth, yield-differential, risk-sentiment and positioning evidence.',
    modules:freezeModules([
      ['market-structure','Market structure','CORE',null,'Decision-grade FX candles required'],
      ['central-banks','Central banks / policy','RELEVANT',null,'Scheduled policy source required'],
      ['rates-yields','Rates / yield differentials','RELEVANT',null,'Governed yield source required'],
      ['inflation','CPI / inflation','RELEVANT',null,'Official release source required'],
      ['employment','Employment / labor','RELEVANT',null,'Official release source required'],
      ['growth','GDP / growth','RELEVANT',null,'Official release source required'],
      ['risk-sentiment','Risk sentiment / cross-asset','RELEVANT',null,'Governed cross-asset source required'],
      ['cot','COT / positioning','OPTIONAL',null,'Authorized positioning source required'],
      ['reference-rates','Reference FX rates','CONTEXT','macro','ECB daily reference only']
    ])
  }),
  'indian-equities':Object.freeze({
    id:'indian-equities',label:'Indian equities',state:'UNAVAILABLE',
    description:'Requires licensed intraday market data plus issuer results, corporate actions, exchange disclosures, sector/index context, domestic macro and regulator events.',
    modules:freezeModules([
      ['market-structure','Market structure','CORE',null,'Licensed NSE/BSE market data required'],
      ['results','Results / guidance','RELEVANT',null,'Issuer/exchange disclosure source required'],
      ['corporate-actions','Corporate actions','RELEVANT',null,'Official corporate-action source required'],
      ['exchange-disclosures','NSE / BSE disclosures','RELEVANT',null,'Authorized disclosure source required'],
      ['fii-dii','FII / DII flows','OPTIONAL',null,'Genuine governed flow source required'],
      ['rbi','RBI / domestic rates','RELEVANT',null,'Official scheduled macro source required'],
      ['sector-index','Sector / index context','RELEVANT',null,'Licensed index data required'],
      ['domestic-macro','Domestic macro','RELEVANT',null,'Official macro release source required'],
      ['sebi','SEBI / regulatory events','RELEVANT',null,'Official regulator source required']
    ])
  }),
  'global-equities':Object.freeze({
    id:'global-equities',label:'U.S. / global equities',state:'UNAVAILABLE',
    description:'Requires licensed equity market data plus issuer filings, earnings/guidance, sector/index, rates/macro and options where rights permit.',
    modules:freezeModules([
      ['market-structure','Market structure','CORE',null,'Licensed equity market data required'],
      ['earnings','Earnings / guidance','RELEVANT',null,'Issuer/authorized earnings source required'],
      ['filings','Regulatory filings','RELEVANT',null,'Official filing source required'],
      ['sector-index','Sector / index context','RELEVANT',null,'Licensed benchmark source required'],
      ['rates-macro','Rates / macro','RELEVANT',null,'Governed macro source required'],
      ['options','Options positioning','OPTIONAL',null,'Authorized options source required']
    ])
  }),
  indices:Object.freeze({
    id:'indices',label:'Indices',state:'UNAVAILABLE',
    description:'Requires governed index pricing plus breadth, sector contribution, macro/rates and flows where rights permit.',
    modules:freezeModules([
      ['market-structure','Index market structure','CORE',null,'Governed index candles required'],
      ['breadth','Breadth','RELEVANT',null,'Constituent breadth source required'],
      ['sector-contribution','Sector contribution','RELEVANT',null,'Constituent/sector source required'],
      ['macro-rates','Macro / rates','RELEVANT',null,'Governed macro source required'],
      ['flows','Index / futures flows','OPTIONAL',null,'Authorized flow source required']
    ])
  }),
  'metals-commodities':Object.freeze({
    id:'metals-commodities',label:'Metals / commodities',state:'UNAVAILABLE',
    description:'Requires governed commodity pricing plus USD/yields, inventories, futures positioning, macro and geopolitical supply evidence.',
    modules:freezeModules([
      ['market-structure','Market structure','CORE',null,'Governed commodity candles required'],
      ['usd-yields','USD / yields','RELEVANT',null,'Governed FX/yield source required'],
      ['inventories','Inventories / stocks','RELEVANT',null,'Official agency/source required'],
      ['futures-positioning','Futures positioning','RELEVANT',null,'Authorized futures positioning source required'],
      ['macro','Macro demand context','RELEVANT',null,'Governed macro source required'],
      ['geopolitics','Geopolitical supply risk','RELEVANT',null,'Source-backed event evidence required'],
      ['agency-reports','Agency reports','OPTIONAL',null,'Official agency reports required']
    ])
  }),
  'rates-bonds':Object.freeze({
    id:'rates-bonds',label:'Rates / bonds',state:'UNAVAILABLE',
    description:'Requires governed yield/price data plus central-bank policy, inflation, growth, curve, auctions and positioning.',
    modules:freezeModules([
      ['market-structure','Yield / price structure','CORE',null,'Governed rates market data required'],
      ['central-banks','Central-bank policy','RELEVANT',null,'Official policy source required'],
      ['inflation-growth','Inflation / growth','RELEVANT',null,'Official macro source required'],
      ['curve','Yield curve','RELEVANT',null,'Governed curve source required'],
      ['auctions','Auction / issuance','OPTIONAL',null,'Official issuance source required'],
      ['positioning','Futures positioning','OPTIONAL',null,'Authorized positioning source required']
    ])
  }),
  etfs:Object.freeze({
    id:'etfs',label:'ETFs',state:'UNAVAILABLE',
    description:'Requires licensed ETF market data plus flows, holdings, tracking/index context, macro and underlying-basket evidence.',
    modules:freezeModules([
      ['market-structure','Market structure','CORE',null,'Licensed ETF candles required'],
      ['flows','Fund flows','RELEVANT',null,'Authorized fund-flow source required'],
      ['holdings','Holdings / basket','RELEVANT',null,'Authorized holdings source required'],
      ['tracking','Index / tracking context','RELEVANT',null,'Licensed benchmark source required'],
      ['macro','Macro context','CONTEXT',null,'Governed macro source required']
    ])
  })
});

const normalizeProfileId=(assetClass)=>{
  const value=String(assetClass||'').toLowerCase();
  if(value==='crypto')return 'crypto';
  if(value==='fx'||value==='forex')return 'fx';
  if(value==='indian-equities')return 'indian-equities';
  if(value==='global-equities')return 'global-equities';
  if(value==='indian-indices'||value==='global-indices'||value==='indices')return 'indices';
  if(value==='metals'||value==='commodities'||value==='metals-commodities')return 'metals-commodities';
  if(value==='rates-bonds')return 'rates-bonds';
  if(value==='etfs')return 'etfs';
  return null;
};

const availabilityState=(value)=>{
  const raw=String(value?.state??value?.truthState??'').toLowerCase();
  if(['live','available','supported','ready'].includes(raw))return 'AVAILABLE';
  if(['partial','pending','delayed','cached','reference_only','reference-only'].includes(raw))return 'PARTIAL';
  if(raw&&raw!=='unavailable'&&raw!=='not_selected')return 'PARTIAL';
  return 'UNAVAILABLE';
};

export const evidenceProfileDefinition=(assetClass)=>{
  const id=normalizeProfileId(assetClass);
  return id?PROFILES[id]:null;
};

export function buildDecisionAssetEvidenceProfile({assetClass='crypto',graph=null,multiTimeframe=null,evidence={}}={}){
  const definition=evidenceProfileDefinition(assetClass);
  if(!definition)return {schemaVersion:'qelly.decision-evidence-profile/1.0.0',profileId:null,state:'UNAVAILABLE',modules:[],reason:'No governed evidence profile exists for this asset class.'};
  const sourceMap={
    structure:graph?.quant?.structure?{state:'available'}:null,
    market:graph?.market?.candles?.length?{state:'available'}:null,
    multiTimeframe:multiTimeframe?.agreement?{state:'available'}:null,
    derivatives:evidence.derivatives,
    liquidity:evidence.liquidity,
    news:evidence.news,
    eventRisk:evidence.eventRisk,
    crossAsset:evidence.crossAsset,
    onChain:evidence.onChain,
    institutionalFlow:evidence.institutionalFlow,
    macro:evidence.macro,
    options:evidence.options,
    fundamentals:evidence.fundamentals
  };
  const modules=definition.modules.map(([id,label,applicability,sourceKey,sourceRequirement])=>{
    const state=sourceKey?availabilityState(sourceMap[sourceKey]):'UNAVAILABLE';
    return {id,label,applicability,state,sourceKey,sourceRequirement,eligibilityImpact:applicability==='CORE'?'existing-engine-only':'none'};
  });
  const relevant=modules.filter(item=>item.applicability!=='NOT_APPLICABLE');
  const available=relevant.filter(item=>item.state==='AVAILABLE').length;
  const partial=relevant.filter(item=>item.state==='PARTIAL').length;
  const unavailable=relevant.length-available-partial;
  return {
    schemaVersion:'qelly.decision-evidence-profile/1.0.0',
    profileId:definition.id,
    label:definition.label,
    state:definition.state,
    description:definition.description,
    active:definition.id==='crypto',
    coverage:{applicable:relevant.length,available,partial,unavailable},
    modules,
    boundary:'Asset-class profiles control evidence applicability and disclosure only. They do not invent missing data, convert reference data into Decision-grade data, or independently create BUY/SELL eligibility.',
    weightingBoundary:'Only modules already consumed by the existing Decision engine can affect the current Decision. Profile relevance is not a new score, vote or probability input.'
  };
}

export const decisionEvidenceProfileCatalog=()=>Object.values(PROFILES).map(profile=>({
  id:profile.id,label:profile.label,state:profile.state,description:profile.description,
  modules:profile.modules.map(([id,label,applicability,,sourceRequirement])=>({id,label,applicability,sourceRequirement}))
}));

export const __decisionAssetEvidenceProfilesTest=Object.freeze({normalizeProfileId,availabilityState,PROFILES});
