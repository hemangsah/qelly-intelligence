import {HttpError,responseJson,restRequest} from './runtime.js';

const KNOWN_INSTRUMENTS=Object.freeze({
  'QI-CRYPTO-BTC':Object.freeze({symbol:'BTC',name:'Bitcoin',assetClass:'crypto'}),
  'QI-CRYPTO-ETH':Object.freeze({symbol:'ETH',name:'Ethereum',assetClass:'crypto'}),
  'QI-EQUITY-AAPL':Object.freeze({symbol:'AAPL',name:'Apple',assetClass:'equity'}),
  'QI-EQUITY-NVDA':Object.freeze({symbol:'NVDA',name:'NVIDIA',assetClass:'equity'}),
  'QI-FUND-QQQ':Object.freeze({symbol:'QQQ',name:'Invesco QQQ',assetClass:'fund'}),
  'QI-COMMODITY-GOLD':Object.freeze({symbol:'GOLD',name:'Gold',assetClass:'commodity'}),
  'QI-INDEX-SPX':Object.freeze({symbol:'SPX',name:'S&P 500',assetClass:'index'}),
  'QI-FX-USDINR':Object.freeze({symbol:'USDINR',name:'USD / INR',assetClass:'fx'})
});

const finiteOrNull=(value)=>{const number=Number(value);return value!==null&&value!==''&&Number.isFinite(number)?number:null;};
const instrumentDescriptor=(ref,type)=>{
  const value=String(ref||'');
  if(KNOWN_INSTRUMENTS[value])return KNOWN_INSTRUMENTS[value];
  const parts=value.split('-').filter(Boolean);
  return {symbol:parts.at(-1)||value||'—',name:value||'Unknown instrument',assetClass:String(type||parts[1]||'unknown').toLowerCase()};
};
const unavailableMarketEvidence=()=>Object.freeze({
  truthState:'UNAVAILABLE',
  provider:null,
  observedAt:null,
  freshness:'unavailable',
  attribution:'No rights-approved market observation is attached to persisted portfolio positions.'
});

export const positionToHolding=(row)=>{
  const descriptor=instrumentDescriptor(row.instrument_ref,row.instrument_type);
  const input=row.input_payload&&typeof row.input_payload==='object'&&!Array.isArray(row.input_payload)?row.input_payload:{};
  return {
    positionId:row.id,
    canonicalId:row.instrument_ref,
    symbol:descriptor.symbol,
    name:descriptor.name,
    assetClass:descriptor.assetClass,
    sourceKind:row.source_kind,
    quantity:finiteOrNull(input.quantity),
    userEnteredCost:finiteOrNull(input.costBasis??input.averageCost??input.unitCost),
    price:null,
    marketValue:null,
    unrealizedPnl:null,
    unrealizedPnlPct:null,
    weightPct:null,
    freshnessClass:'unavailable',
    marketTruthState:'UNAVAILABLE',
    observedAt:row.observed_at||null,
    provenance:row.provenance||{},
    inputPayload:input,
    createdAt:row.created_at,
    updatedAt:row.updated_at
  };
};

async function portfolioRows(env,session,workspaceId){
  const params=new URLSearchParams({select:'*',workspace_id:`eq.${workspaceId}`,deleted_at:'is.null',order:'updated_at.desc',limit:'100'});
  return restRequest(env,session.accessToken,`qelly_portfolios?${params.toString()}`);
}
async function positionRows(env,session,workspaceId,portfolioId){
  if(!portfolioId)return [];
  const params=new URLSearchParams({select:'*',workspace_id:`eq.${workspaceId}`,portfolio_id:`eq.${portfolioId}`,order:'created_at.asc',limit:'1000'});
  return restRequest(env,session.accessToken,`qelly_portfolio_positions?${params.toString()}`);
}

export async function portfolioEvidence(env,session,qelly){
  const portfolios=await portfolioRows(env,session,qelly.workspace.workspaceId);
  const portfolio=portfolios?.[0]||null;
  const positions=portfolio?await positionRows(env,session,qelly.workspace.workspaceId,portfolio.id):[];
  return {portfolios:portfolios||[],portfolio,positions:positions||[],holdings:(positions||[]).map(positionToHolding)};
}

export const portfolioOverview=(evidence)=>({
  portfolioId:evidence.portfolio?.id||null,
  name:evidence.portfolio?.name||'No portfolio',
  baseCurrency:evidence.portfolio?.base_currency||'USD',
  sourceKind:evidence.portfolio?.source_kind||null,
  portfolioCount:evidence.portfolios.length,
  holdingsCount:evidence.holdings.length,
  totalValue:null,
  unrealizedPnl:null,
  unrealizedPnlPct:null,
  dayPnl:null,
  dayPnlPct:null,
  cashValue:null,
  asOf:null,
  updatedAt:evidence.portfolio?.updated_at||null,
  persistence:'CLOUD RLS',
  truthState:evidence.portfolio?'PARTIAL':'UNAVAILABLE',
  valuationTruthState:'UNAVAILABLE',
  marketEvidence:unavailableMarketEvidence(),
  guardrails:{readOnly:true,brokerConnected:false,custody:false,execution:false,transfers:false,walletSigning:false}
});

export const portfolioHoldings=(evidence)=>({
  portfolioId:evidence.portfolio?.id||null,
  baseCurrency:evidence.portfolio?.base_currency||'USD',
  items:evidence.holdings,
  total:evidence.holdings.length,
  persistence:'CLOUD RLS',
  truthState:evidence.portfolio?'PARTIAL':'UNAVAILABLE',
  valuationTruthState:'UNAVAILABLE',
  marketEvidence:unavailableMarketEvidence(),
  guardrails:{readOnly:true,brokerReconciled:false,execution:false}
});

export const portfolioPerformance=(evidence,range='1y')=>({
  portfolioId:evidence.portfolio?.id||null,
  range:String(range||'1y').slice(0,20),
  points:[],
  benchmarkPoints:[],
  asOf:null,
  truthState:'UNAVAILABLE',
  methodology:'Performance requires governed historical valuations. Persisted positions alone are insufficient to calculate returns.',
  reason:'No rights-approved historical valuation series is attached to this portfolio.',
  marketEvidence:unavailableMarketEvidence()
});

export const portfolioRisk=(evidence)=>({
  portfolioId:evidence.portfolio?.id||null,
  truthState:'UNAVAILABLE',
  methodology:'Portfolio risk metrics require governed valuations and return history. Qelly does not derive VaR, volatility, drawdown or concentration weights from unpriced positions.',
  riskMetrics:{annualizedVolatilityPct:null,valueAtRisk95OneDayPct:null,maxDrawdownPct:null},
  concentration:{largestPosition:null,pricedPositions:0,totalPositions:evidence.holdings.length},
  stressScenarios:[],
  reason:'No rights-approved valuation series is attached to persisted positions.',
  marketEvidence:unavailableMarketEvidence(),
  guardrails:{readOnly:true,investmentAdvice:false,execution:false}
});

export const portfolioAttribution=(evidence,range='1y')=>({
  portfolioId:evidence.portfolio?.id||null,
  range:String(range||'1y').slice(0,20),
  totalContributionPct:null,
  activeContributionPct:null,
  byHolding:[],
  byAssetClass:[],
  asOf:null,
  truthState:'UNAVAILABLE',
  methodology:'Attribution requires governed portfolio and benchmark return series. Persisted position membership is not sufficient evidence for contribution calculations.',
  reason:'No governed valuation/benchmark series is attached to the portfolio.',
  marketEvidence:unavailableMarketEvidence(),
  guardrails:{readOnly:true,investmentAdvice:false,execution:false}
});

export async function handlePortfolioRead(context,relative,session,qelly){
  const {request,env}=context;
  const evidence=await portfolioEvidence(env,session,qelly);
  const url=new URL(request.url);
  if(relative==='overview')return responseJson(request,env,portfolioOverview(evidence),200,{cache:'no-store'});
  if(relative==='holdings')return responseJson(request,env,portfolioHoldings(evidence),200,{cache:'no-store'});
  if(relative==='performance')return responseJson(request,env,portfolioPerformance(evidence,url.searchParams.get('range')||'1y'),200,{cache:'no-store'});
  if(relative==='risk')return responseJson(request,env,portfolioRisk(evidence),200,{cache:'no-store'});
  if(relative==='attribution')return responseJson(request,env,portfolioAttribution(evidence,url.searchParams.get('range')||'1y'),200,{cache:'no-store'});
  throw new HttpError(501,'portfolio_capability_unavailable','This portfolio capability is not yet implemented in the canonical Cloudflare runtime',{details:{truthState:'UNAVAILABLE',capability:`portfolio/${relative||'unknown'}`},retryable:false});
}

export const __portfolioCloudTest=Object.freeze({finiteOrNull,instrumentDescriptor,unavailableMarketEvidence});
