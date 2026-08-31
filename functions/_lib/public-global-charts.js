const SOURCE_IDS=new Set([
  'european-central-bank','world-bank','us-treasury','imf-data-api',
  'bls-bureau-of-labor-statistics','fred-federal-reserve','econocal',
  'econoday','trading-economics'
]);

const STAGES=Object.freeze({
  'governed-reference':Object.freeze({id:'governed-reference',label:'Governed reference'}),
  'reference-public':Object.freeze({id:'public-reference',label:'Public reference'}),
  'delivery-review':Object.freeze({id:'delivery-review',label:'Delivery review'}),
  'key-required':Object.freeze({id:'configuration-required',label:'Configuration required'}),
  'external-research':Object.freeze({id:'external-research',label:'External research'})
});

const ROLE=Object.freeze({
  'european-central-bank':'Official FX reference-rate context',
  'world-bank':'Cross-country development and macro indicators',
  'us-treasury':'Official US fiscal series and debt context',
  'imf-data-api':'International macro and financial indicators',
  'bls-bureau-of-labor-statistics':'Official US labor and price statistics',
  'fred-federal-reserve':'Economic time-series catalog candidate',
  econocal:'Economic-event research context',
  econoday:'Economic-calendar research context',
  'trading-economics':'External macro research context'
});

const NEXT_ACTION=Object.freeze({
  'governed-reference':'Confirm series identifier, observation date, cadence and attribution before comparison.',
  'reference-public':'Validate the official series definition, revision policy, units and release calendar.',
  'delivery-review':'Approve delivery, caching and redistribution behavior before any observation is displayed.',
  'configuration-required':'Configure the credential server-side and prove entitlement before requesting values.',
  'external-research':'Collect and cite observations manually; Qelly does not scrape the external surface.'
});

const SERIES_FAMILIES=Object.freeze([
  {id:'growth',label:'Growth',question:'Is economic activity accelerating or losing momentum?',examples:'GDP, industrial production, retail activity'},
  {id:'inflation',label:'Inflation',question:'Are price pressures broadening, persisting or cooling?',examples:'CPI, PPI, deflators, inflation expectations'},
  {id:'labor',label:'Labor',question:'Is employment strength confirming or contradicting the cycle?',examples:'Payrolls, unemployment, wages, participation'},
  {id:'rates',label:'Rates',question:'How is the policy and yield environment transmitting?',examples:'Policy rates, sovereign yields, curve spreads'},
  {id:'fx',label:'FX',question:'Is currency behavior confirming relative macro conditions?',examples:'Reference rates, effective exchange-rate indices'},
  {id:'fiscal',label:'Fiscal',question:'Is fiscal impulse or financing pressure changing?',examples:'Receipts, outlays, debt, issuance'},
  {id:'liquidity',label:'Liquidity',question:'Are financial conditions expanding or contracting?',examples:'Money, credit, reserves, balance-sheet measures'},
  {id:'commodities',label:'Commodities',question:'Are input prices confirming supply or demand pressure?',examples:'Energy, metals, agricultural benchmarks'}
]);

const PROTOCOL=Object.freeze([
  {id:'definition',label:'Definition gate',purpose:'Verify both series definitions, units, geography and revision policy.'},
  {id:'alignment',label:'Alignment gate',purpose:'Choose one calendar, cadence and missing-observation rule.'},
  {id:'transform',label:'Transformation gate',purpose:'Name level, change, index or standardized comparison before seeing a result.'},
  {id:'lag',label:'Lag gate',purpose:'Declare the lead/lag window instead of searching until a pattern appears.'},
  {id:'stability',label:'Stability gate',purpose:'Test subperiods, revisions and regime changes before trusting a relationship.'},
  {id:'boundary',label:'Decision boundary',purpose:'Record what the chart can support and what remains correlation, inference or unknown.'}
]);

const TRANSFORMS=Object.freeze([
  {id:'level',label:'Level',use:'Compare reported levels only when units are meaningfully compatible.'},
  {id:'change',label:'Period change',use:'Compare first differences or percentage changes over one selected cadence.'},
  {id:'year-over-year',label:'Year over year',use:'Compare annual change while naming base effects and release lags.'},
  {id:'index-100',label:'Index to 100',use:'Compare path since a declared base date without implying equal economic magnitude.'},
  {id:'z-score',label:'Standardized deviation',use:'Compare deviations only after declaring window, mean and volatility method.'}
]);

export function buildPublicGlobalCharts(directory=[]){
  const sources=(Array.isArray(directory)?directory:[]).filter((item)=>SOURCE_IDS.has(item.id)).map((item)=>{
    const stage=STAGES[item.integration]||Object.freeze({id:'unassessed',label:'Unassessed'});
    return {
      id:item.id,name:item.name,category:item.category,integration:item.integration,
      stage,role:ROLE[item.id]||'Macro research source',officialUrl:item.url||null,
      note:item.note||'No additional source note is available.',
      nextAction:NEXT_ACTION[item.integration]||'Complete source, rights and methodology review.',
      capabilities:{observationsDisplayed:item.integration==='governed-reference',correlationCalculated:false,forecasting:false,execution:false}
    };
  }).sort((a,b)=>a.name.localeCompare(b.name));
  const byStage=Object.fromEntries(['governed-reference','public-reference','delivery-review','configuration-required','external-research','unassessed'].map((id)=>[id,sources.filter((source)=>source.stage.id===id).length]));
  return {
    version:'governed-global-relationship-v1',
    state:sources.length?'relationship-planner-available':'unavailable',
    job:'Specify, source and challenge a cross-market relationship before interpreting a chart.',
    purpose:'Global Charts separates chart design from data permission, statistical evidence and causal claims.',
    summary:{total:sources.length,byStage,displayReady:sources.filter((source)=>source.capabilities.observationsDisplayed).length,correlationsCalculated:0,forecastsProduced:0},
    seriesFamilies:SERIES_FAMILIES,protocol:PROTOCOL,transforms:TRANSFORMS,
    horizons:['Daily','Weekly','Monthly','Quarterly','Annual'],sources,
    boundaries:{noSyntheticSeries:true,noCorrelationClaim:true,noCausalityClaim:true,noForecast:true,noRecommendation:true,noExecution:true},
    methodology:{version:'Global Relationship Protocol 1.0',measurement:'A relationship becomes measurable only after two governed series, compatible timestamps, declared transformations and a fixed lag rule are available.',comparison:'Global Charts tests relationships. Asset Rankings orders candidates. DEX Discovery maps on-chain mechanisms. Qelly Chat explains sourced evidence.'}
  };
}
