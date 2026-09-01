const ISSUERS=Object.freeze([
  Object.freeze({id:'QI-EQUITY-AAPL',symbol:'AAPL',name:'Apple Inc.',assetClass:'Public equity',reportingFramework:'US GAAP',reportingCurrency:'USD',filingAuthority:'SEC EDGAR'}),
  Object.freeze({id:'QI-EQUITY-MSFT',symbol:'MSFT',name:'Microsoft Corporation',assetClass:'Public equity',reportingFramework:'US GAAP',reportingCurrency:'USD',filingAuthority:'SEC EDGAR'}),
  Object.freeze({id:'QI-EQUITY-NVDA',symbol:'NVDA',name:'NVIDIA Corporation',assetClass:'Public equity',reportingFramework:'US GAAP',reportingCurrency:'USD',filingAuthority:'SEC EDGAR'})
]);

const DEFINITIONS=Object.freeze([
  Object.freeze({id:'revenue-growth',label:'Revenue growth',family:'Operating performance',formula:'(Current-period revenue ÷ comparable prior-period revenue) − 1',purpose:'Measure top-line change only after period length, currency, perimeter and restatements align.',failure:'Acquisitions, currency translation and 53-week years can break comparability.'}),
  Object.freeze({id:'operating-margin',label:'Operating margin',family:'Profitability',formula:'Operating income ÷ revenue',purpose:'Separate operating conversion from financing and tax effects.',failure:'GAAP and adjusted operating income must never be mixed silently.'}),
  Object.freeze({id:'free-cash-flow',label:'Free cash flow',family:'Cash conversion',formula:'Operating cash flow − capital expenditure',purpose:'Inspect cash remaining after the declared reinvestment definition.',failure:'Capital expenditure taxonomy and working-capital timing require source review.'}),
  Object.freeze({id:'net-debt',label:'Net debt',family:'Balance sheet',formula:'Interest-bearing debt − cash and declared cash equivalents',purpose:'State the balance-sheet funding position under an explicit liquidity perimeter.',failure:'Restricted cash, leases and minority interests change the answer.'}),
  Object.freeze({id:'diluted-eps',label:'Diluted EPS bridge',family:'Per-share economics',formula:'Income available to common holders ÷ diluted weighted-average shares',purpose:'Connect operating assumptions to a per-share result while exposing dilution.',failure:'Options, convertibles, buybacks and loss-period anti-dilution require period-specific treatment.'}),
  Object.freeze({id:'ev-sales',label:'EV / revenue',family:'Valuation convention',formula:'Enterprise value ÷ comparable-period revenue',purpose:'Normalize a declared enterprise valuation against a named revenue period.',failure:'It is not intrinsic value and is invalid across misaligned dates, currencies or revenue definitions.'})
]);

const number=(value,fallback,min,max)=>{const parsed=Number(value);return Number.isFinite(parsed)?Math.max(min,Math.min(max,parsed)):fallback;};
const round=(value,digits=2)=>Number(Number(value).toFixed(digits));
const selectIssuer=(requested)=>ISSUERS.find((item)=>item.id===requested||item.symbol===String(requested||'').toUpperCase())||ISSUERS[0];

function calculateScenario(input={}){
  const assumptions={
    baseRevenue:number(input.baseRevenue,1000,1,1_000_000_000),
    revenueGrowthPct:number(input.revenueGrowthPct,8,-95,500),
    operatingMarginPct:number(input.operatingMarginPct,20,-100,100),
    taxRatePct:number(input.taxRatePct,21,0,100),
    dilutedShares:number(input.dilutedShares,100,0.01,1_000_000_000),
    earningsMultiple:number(input.earningsMultiple,15,0,500)
  };
  const revenue=assumptions.baseRevenue*(1+assumptions.revenueGrowthPct/100);
  const operatingIncome=revenue*assumptions.operatingMarginPct/100;
  const modeledNetIncome=operatingIncome*(1-assumptions.taxRatePct/100);
  const modeledEps=modeledNetIncome/assumptions.dilutedShares;
  const indicatedValue=modeledEps*assumptions.earningsMultiple;
  return {assumptions,outputs:{revenue:round(revenue),operatingIncome:round(operatingIncome),modeledNetIncome:round(modeledNetIncome),modeledEps:round(modeledEps),indicatedValue:round(indicatedValue)},units:{baseRevenue:'declared currency millions',dilutedShares:'millions',modeledEps:'declared currency per share',indicatedValue:'declared currency per share'}};
}

export function buildPublicFundamentalsEstimates(requestedIssuer='QI-EQUITY-AAPL',input={}){
  const selected=selectIssuer(requestedIssuer);
  const base=calculateScenario(input);
  const sensitivity=[
    {id:'lower',label:'Lower operating case',growthDelta:-2,marginDelta:-2},
    {id:'base',label:'Declared base case',growthDelta:0,marginDelta:0},
    {id:'higher',label:'Higher operating case',growthDelta:2,marginDelta:2}
  ].map((row)=>({...row,...calculateScenario({...base.assumptions,revenueGrowthPct:base.assumptions.revenueGrowthPct+row.growthDelta,operatingMarginPct:base.assumptions.operatingMarginPct+row.marginDelta}).outputs}));
  const qualityGates=[
    {id:'identity',label:'Issuer identity',state:'ready',purpose:'Lock the issuer and reporting framework before collecting numbers.',detail:`${selected.id} · ${selected.reportingFramework} · ${selected.reportingCurrency}`},
    {id:'statement-source',label:'Statement source lineage',state:'blocked',purpose:'Attach every value to a rights-authorized filing or statement source.',detail:'No production issuer-statement feed is connected; zero statement values are asserted.'},
    {id:'period-alignment',label:'Period and perimeter alignment',state:'blocked',purpose:'Match fiscal periods, consolidation perimeter and duration.',detail:'No statement periods are connected for comparison.'},
    {id:'currency-units',label:'Currency and unit normalization',state:'blocked',purpose:'Prevent scale, currency and per-share unit errors.',detail:'Scenario units are declared by the user; issuer reporting units are not asserted.'},
    {id:'restatement-policy',label:'Restatement policy',state:'ready',purpose:'Prefer the latest issuer-restated comparative and retain superseded lineage.',detail:'The workspace contract requires original and restated values to remain distinguishable.'},
    {id:'consensus-definition',label:'Estimate definition',state:'ready',purpose:'Require low, median, high, analyst count and as-of timestamp together.',detail:'Definition is ready; no licensed consensus observations are connected.'},
    {id:'consensus-feed',label:'Consensus source',state:'blocked',purpose:'Prove estimate licensing, contributor scope and freshness.',detail:'No production consensus feed is connected; zero analysts or estimates are shown.'}
  ];
  const readyGates=qualityGates.filter((item)=>item.state==='ready').length;
  return {
    version:'governed-fundamentals-workspace-v2',state:'assumption-model-ready',
    job:'Turn issuer disclosures and estimate definitions into a traceable operating model without confusing user assumptions with reported facts or consensus.',
    issuers:ISSUERS,selected,definitions:DEFINITIONS,scenario:{...base,sensitivity,receipt:`${selected.symbol} · user-declared model · revenue base ${base.assumptions.baseRevenue}m · growth ${base.assumptions.revenueGrowthPct}% · operating margin ${base.assumptions.operatingMarginPct}% · tax ${base.assumptions.taxRatePct}% · diluted shares ${base.assumptions.dilutedShares}m · multiple ${base.assumptions.earningsMultiple}x`},
    coverage:{statementPeriods:0,statementValues:0,estimateObservations:0,analystCount:0,reportedFactsAvailable:false,consensusAvailable:false,reason:'No rights-authorized production statement or consensus provider is active.'},
    qualityGates,readiness:{readyGates,totalGates:qualityGates.length,state:'blocked-source-evidence',scenarioComputable:true,reportedAnalysisReady:false,consensusAnalysisReady:false},
    workflow:[
      {step:'01',label:'Resolve',job:'Lock issuer, framework, currency, fiscal calendar and consolidation perimeter.'},
      {step:'02',label:'Acquire',job:'Attach statement values to exact filing sections and estimate values to a licensed as-of snapshot.'},
      {step:'03',label:'Normalize',job:'Align periods, units, restatements and GAAP versus adjusted definitions.'},
      {step:'04',label:'Model',job:'Keep reported facts, consensus and user assumptions in separate typed layers.'},
      {step:'05',label:'Challenge',job:'Apply mechanical sensitivity, counter-cases and explicit invalidation conditions.'},
      {step:'06',label:'Provenance',job:'Send formula receipts, evidence gaps and the human conclusion into Decision Provenance.'}
    ],
    acquisitionChecklist:[
      {label:'Identity and fiscal calendar',owner:'Instrument Master',state:'identity-ready'},
      {label:'Income statement, balance sheet and cash flow',owner:'Filing Workspace',state:'source-required'},
      {label:'Restatement and non-GAAP reconciliation',owner:'Filing Workspace',state:'source-required'},
      {label:'Consensus low / median / high / analyst count',owner:'Licensed estimate provider',state:'provider-required'},
      {label:'Share-count and corporate-action bridge',owner:'Issuer filing evidence',state:'source-required'}
    ],
    handoffs:[
      {route:'filing-workspace',label:'Filing Workspace',job:'Collect cited issuer disclosures and restatement evidence.'},
      {route:'comparison-lab',label:'Comparison Lab',job:'Align definitions and periods before comparing peers.'},
      {route:'news-research',label:'Qelly Chat & Research',job:'Research operating drivers, risks and counter-evidence.'},
      {route:'decision-provenance',label:'Decision Provenance',job:'Record assumptions, formula receipts and invalidation.'}
    ],
    boundaries:{fixtureFinancials:false,reportedFacts:false,consensus:false,providerEstimates:false,userAssumptions:true,mechanicalSensitivity:true,personalizedRecommendation:false,intrinsicValue:false,forecast:false,execution:false,persistence:false,fabricatedFallback:false}
  };
}

export const __test=Object.freeze({ISSUERS,DEFINITIONS,number,calculateScenario,selectIssuer});
