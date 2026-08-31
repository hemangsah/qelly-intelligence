import {buildAssetRankings} from './market-network.js';

const IDENTITY_CATALOG=Object.freeze([
  Object.freeze({id:'QI-CRYPTO-BTC',symbol:'BTC',name:'Bitcoin',assetClass:'Digital asset',network:'Bitcoin',role:'Monetary and settlement asset'}),
  Object.freeze({id:'QI-CRYPTO-ETH',symbol:'ETH',name:'Ethereum',assetClass:'Digital asset',network:'Ethereum',role:'Programmable settlement network'}),
  Object.freeze({id:'QI-CRYPTO-SOL',symbol:'SOL',name:'Solana',assetClass:'Digital asset',network:'Solana',role:'High-throughput application network'}),
  Object.freeze({id:'QI-CRYPTO-BNB',symbol:'BNB',name:'BNB',assetClass:'Digital asset',network:'BNB Chain',role:'Exchange and application-network asset'}),
  Object.freeze({id:'QI-CRYPTO-XRP',symbol:'XRP',name:'XRP',assetClass:'Digital asset',network:'XRP Ledger',role:'Payments-network asset'}),
  Object.freeze({id:'QI-CRYPTO-ADA',symbol:'ADA',name:'Cardano',assetClass:'Digital asset',network:'Cardano',role:'Programmable proof-of-stake network'}),
  Object.freeze({id:'QI-CRYPTO-DOGE',symbol:'DOGE',name:'Dogecoin',assetClass:'Digital asset',network:'Dogecoin',role:'Community-led payment asset'}),
  Object.freeze({id:'QI-CRYPTO-TRX',symbol:'TRX',name:'TRON',assetClass:'Digital asset',network:'TRON',role:'Application and settlement network'}),
  Object.freeze({id:'QI-CRYPTO-USDT',symbol:'USDT',name:'Tether',assetClass:'Digital asset',network:'Multi-network',role:'Issuer-backed stable-value token'}),
  Object.freeze({id:'QI-CRYPTO-USDC',symbol:'USDC',name:'USDC',assetClass:'Digital asset',network:'Multi-network',role:'Issuer-backed stable-value token'})
]);

const finite=(value)=>Number.isFinite(Number(value))?Number(value):null;
const state=(value)=>['live','cached','delayed'].includes(String(value||'').toLowerCase())?String(value).toLowerCase():'unavailable';
const track=(id,label,purpose,status,detail,nextRoute,nextLabel)=>({id,label,purpose,state:status,detail,nextRoute,nextLabel});

export function buildPublicAssetIntelligence(sources={},requestedAsset='QI-CRYPTO-BTC'){
  const ranking=buildAssetRankings(sources);
  const rankedById=new Map(ranking.candidates.map((item)=>[item.id,item]));
  const assets=IDENTITY_CATALOG.map((identity)=>{
    const observed=rankedById.get(identity.id);
    return {
      ...identity,
      observation:observed?{
        priceUsd:finite(observed.priceUsd),change24hPct:finite(observed.change24hPct),marketCapUsd:finite(observed.marketCapUsd),volume24hUsd:finite(observed.volume24hUsd),turnoverPct:finite(observed.turnoverPct),observedAt:observed.observedAt??null,truthState:state(observed.truthState),provider:observed.provider??'Alternative.me'
      }:null,
      independentContext:observed?.contextMidUsd!=null?{
        valueUsd:finite(observed.contextMidUsd),differencePct:finite(observed.contextDifferencePct),label:observed.contextLabel,provider:'Hyperliquid',truthState:state(sources.hyperliquid?.truthState)
      }:null
    };
  });
  const requested=String(requestedAsset||'').toUpperCase();
  const selected=assets.find((item)=>item.id===requested||item.symbol===requested)||assets[0];
  const observationState=selected.observation?.truthState||'unavailable';
  const contextState=selected.independentContext?.truthState||'unavailable';
  const evidenceTracks=[
    track('identity','Instrument identity','Resolve the symbol to a stable Qelly identifier and analytical role.','available',`${selected.id} · ${selected.network}`,'instrument-master','Resolve aliases and venues'),
    track('market','Market observation','Establish one attributed observation before discussing price or participation.',observationState,selected.observation?`${selected.observation.provider} · observed ${selected.observation.observedAt||'time not supplied'}`:'No governed observation is available; values remain empty.','advanced-chart','Inspect governed history'),
    track('context','Independent context','Check whether a second source can contextualize—not confirm—the primary observation.',contextState,selected.independentContext?`${selected.independentContext.provider} · ${selected.independentContext.label}`:'No independent context is available for this instrument.','comparison-lab','Align a comparison'),
    track('economics','Economic model','Document supply, demand, incentives and value-accrual evidence.','unavailable','Network or issuer fundamentals are not connected to this public contract.','fundamentals-estimates','Investigate fundamentals'),
    track('catalysts','Dated catalysts','Attach dates, owners and primary-source evidence to future events.','unavailable','No governed event feed is connected to this public contract.','event-calendar','Build a catalyst calendar'),
    track('invalidation','Risk and invalidation','Write the condition that would overturn the working thesis.','available','Structured locally in the briefing builder; no recommendation is produced.','decision-provenance','Connect evidence to a decision')
  ];
  const lenses=[
    {id:'identity',label:'Identity & exposure',question:`What does ${selected.symbol} represent, and which network, issuer or venue dependencies define the exposure?`,outcome:'A resolved identity and dependency map.',requiredTracks:['identity'],nextRoute:'instrument-master'},
    {id:'market',label:'Market condition',question:`What does the latest attributed ${selected.symbol} observation show—and what can it not establish?`,outcome:'A bounded market-context note, not a signal.',requiredTracks:['market','context'],nextRoute:'advanced-chart'},
    {id:'economics',label:'Economic engine',question:`Which supply, demand and value-accrual mechanisms could explain ${selected.symbol}'s long-run economics?`,outcome:'A testable economic model with missing-data gates.',requiredTracks:['economics','identity'],nextRoute:'fundamentals-estimates'},
    {id:'catalysts',label:'Catalysts & timing',question:`Which dated events could change the ${selected.symbol} thesis, and which primary sources would confirm them?`,outcome:'A dated catalyst plan with source requirements.',requiredTracks:['catalysts'],nextRoute:'event-calendar'},
    {id:'risk',label:'Risk & invalidation',question:`What observable condition would make the current ${selected.symbol} thesis wrong?`,outcome:'An explicit invalidation rule and review trigger.',requiredTracks:['invalidation','market'],nextRoute:'decision-provenance'}
  ];
  return {
    version:'governed-asset-briefing-v2',state:'briefing-available',job:'Turn one instrument into a source-aware diligence plan before opening specialist analysis.',
    assets,selected,evidenceTracks,lenses,
    summary:{cataloguedAssets:assets.length,observedAssets:assets.filter((item)=>item.observation).length,independentContextAssets:assets.filter((item)=>item.independentContext).length,evidenceTracks:evidenceTracks.length,readyTracks:evidenceTracks.filter((item)=>item.state!=='unavailable').length},
    sourceLedger:ranking.sourceLedger.map((item)=>({...item,role:item.id==='alternative-me'?'Primary attributed market observation':'Independent venue context; not spot-price confirmation'})),
    handoffs:[
      {route:'advanced-chart',label:'Advanced Chart Studio',job:'Study governed price history and technical structure.'},
      {route:'fundamentals-estimates',label:'Fundamentals & Estimates',job:'Test economic, issuer and financial claims.'},
      {route:'filing-workspace',label:'Filing Workspace',job:'Anchor claims to stable issuer disclosures.'},
      {route:'event-calendar',label:'Event Calendar',job:'Track dated catalysts and review windows.'},
      {route:'comparison-lab',label:'Comparison Lab',job:'Compare candidates using aligned definitions.'},
      {route:'decision-provenance',label:'Decision Provenance',job:'Connect evidence, assumptions and invalidation to a human decision.'}
    ],
    boundaries:{identityCatalogIsObservation:false,missingValuesStayEmpty:true,independentContextIsConfirmation:false,personalizedRecommendation:false,forecast:false,execution:false,persistence:false,fabricatedFallback:false}
  };
}

export const __test=Object.freeze({IDENTITY_CATALOG,finite,state});
