const DEFINITIONS=Object.freeze([
  {id:'monetary-networks',label:'Monetary networks',shortLabel:'Money',lens:'monetary-design',symbols:['BTC'],purpose:'Study scarce digital monetary systems whose primary role is value transfer and monetary settlement.',useCase:'Use when the research question is about digital scarcity, monetary premium, or network-level settlement.',riskLens:'Monetary adoption, custody concentration, security budget, and macro sensitivity.',questions:['Is activity consistent with monetary use or primarily speculative turnover?','Which evidence would challenge the store-of-value thesis?']},
  {id:'smart-contract-platforms',label:'Smart-contract platforms',shortLabel:'Platforms',lens:'network-layer',symbols:['ETH','SOL','BNB','TRX','ADA','AVAX','TON','SUI'],purpose:'Compare programmable base-layer networks that host applications, assets, and on-chain execution.',useCase:'Use when ecosystem capacity, developer activity, fees, or application demand is the central question.',riskLens:'Execution reliability, decentralization, fee economics, governance, and ecosystem concentration.',questions:['Which demand indicators are native rather than incentive-driven?','What technical or governance failure would invalidate the platform thesis?']},
  {id:'stable-value-assets',label:'Stable-value assets',shortLabel:'Stable value',lens:'stability-mechanism',symbols:['USDT','USDC','DAI','FDUSD','USDE'],purpose:'Inspect assets designed to track a reference value rather than compound directional market exposure.',useCase:'Use when reserve quality, redemption design, peg behavior, or settlement liquidity matters.',riskLens:'Reserve transparency, redemption access, counterparty exposure, and de-peg risk.',questions:['What evidence supports the stated reserve or stabilization mechanism?','Under which conditions could redemption or peg maintenance fail?']},
  {id:'payment-settlement-networks',label:'Payment & settlement networks',shortLabel:'Payments',lens:'settlement',symbols:['XRP','XLM','LTC','BCH'],purpose:'Explore networks primarily positioned for payments, remittance, or institutional settlement flows.',useCase:'Use when transaction utility, settlement partnerships, or payment-network adoption is the research focus.',riskLens:'Usage concentration, regulatory dependency, settlement finality, and competing rails.',questions:['Is observed usage tied to durable settlement demand?','Which competing rail could weaken the network advantage?']},
  {id:'privacy-preserving-networks',label:'Privacy-preserving networks',shortLabel:'Privacy',lens:'monetary-design',symbols:['XMR','ZEC'],purpose:'Examine monetary networks where transaction privacy is a defining design objective.',useCase:'Use when fungibility, disclosure controls, regulation, or privacy technology drives the thesis.',riskLens:'Exchange access, regulatory restrictions, cryptographic assumptions, and network liquidity.',questions:['Does privacy utility translate into defensible network demand?','What access or regulatory change would materially impair use?']},
  {id:'community-driven-assets',label:'Community-driven assets',shortLabel:'Community',lens:'social-sentiment',symbols:['DOGE','SHIB','PEPE','BONK'],purpose:'Separate assets whose demand is unusually dependent on culture, attention, and community coordination.',useCase:'Use when social reflexivity, holder concentration, or narrative persistence matters more than protocol cash flows.',riskLens:'Attention decay, concentration, liquidity shocks, and narrative reflexivity.',questions:['Is attention converting into persistent network participation?','Which concentration or liquidity evidence signals fragility?']}
]);

const number=(value)=>Number.isFinite(Number(value))?Number(value):null;
const median=(values)=>{
  const rows=values.map(number).filter((value)=>value!==null).sort((left,right)=>left-right);
  if(!rows.length)return null;
  const middle=Math.floor(rows.length/2);
  return rows.length%2?rows[middle]:(rows[middle-1]+rows[middle])/2;
};
const sum=(values)=>values.reduce((total,value)=>total+(number(value)??0),0);

function metrics(members){
  const changes=members.map((row)=>number(row.change24hPct)).filter((value)=>value!==null);
  const advancing=changes.filter((value)=>value>0).length;
  const declining=changes.filter((value)=>value<0).length;
  const unchanged=changes.filter((value)=>value===0).length;
  const marketValueUsd=sum(members.map((row)=>row.marketCapUsd));
  const volume24hUsd=sum(members.map((row)=>row.volume24hUsd));
  return {
    memberCount:members.length,
    advancing,
    declining,
    unchanged,
    breadthPct:changes.length?Math.round(advancing/changes.length*100):null,
    medianChange24hPct:median(changes),
    marketValueUsd:members.length?marketValueUsd:null,
    volume24hUsd:members.length?volume24hUsd:null,
    turnoverPct:marketValueUsd>0?volume24hUsd/marketValueUsd*100:null,
    crossSourceMembers:members.filter((row)=>number(row.contextMidUsd)!==null).length
  };
}

function member(row,category){
  return {
    id:row.id,
    symbol:String(row.symbol||'').toUpperCase(),
    name:String(row.name||row.symbol||''),
    categoryId:category.id,
    priceUsd:number(row.priceUsd),
    change24hPct:number(row.change24hPct),
    marketCapUsd:number(row.marketCapUsd),
    volume24hUsd:number(row.volume24hUsd),
    turnoverPct:number(row.turnoverPct),
    contextMidUsd:number(row.contextMidUsd),
    truthState:row.truthState||'unavailable',
    observedAt:row.observedAt??null,
    provider:row.provider??null
  };
}

export function buildPublicCategories(assetRankings={}){
  const candidates=Array.isArray(assetRankings.candidates)?assetRankings.candidates:[];
  const definitionBySymbol=new Map(DEFINITIONS.flatMap((definition)=>definition.symbols.map((symbol)=>[symbol,definition])));
  const assigned=new Map(DEFINITIONS.map((definition)=>[definition.id,[]]));
  const unmapped=[];
  for(const row of candidates){
    const symbol=String(row?.symbol||'').toUpperCase();
    const definition=definitionBySymbol.get(symbol);
    if(definition)assigned.get(definition.id).push(member(row,definition));
    else unmapped.push(row);
  }
  const definitions=unmapped.length?[...DEFINITIONS,{id:'other-observed-assets',label:'Other observed assets',shortLabel:'Other',lens:'classification-review',symbols:[],purpose:'Hold currently observed assets whose primary economic role is not yet mapped in this taxonomy version.',useCase:'Use to review classification gaps before relying on category-level analysis.',riskLens:'Classification uncertainty and incomplete taxonomy coverage.',questions:['Which primary economic role best explains this asset?','What evidence is required before assigning a governed category?']}]:DEFINITIONS;
  if(unmapped.length)assigned.set('other-observed-assets',unmapped.map((row)=>member(row,definitions.at(-1))));
  const categories=definitions.map((definition)=>{
    const members=assigned.get(definition.id)||[];
    return {...definition,symbols:undefined,metrics:metrics(members),members,observedAt:members.find((row)=>row.observedAt)?.observedAt??assetRankings.universe?.observedAt??null,truthState:members.length?(assetRankings.universe?.truthState||'unavailable'):'unavailable'};
  });
  const coveredCategories=categories.filter((category)=>category.members.length>0).length;
  return {
    version:'governed-category-taxonomy-v1',
    state:assetRankings.state==='available'&&candidates.length?'available':'unavailable',
    job:'Organize the current governed universe by primary economic role so a user can choose the right research lens before comparing assets.',
    purpose:'Explore why assets belong together, what question each group answers, and which attributed observations are currently available.',
    universe:{label:assetRankings.universe?.label||'Governed asset sample',candidateCount:candidates.length,observedAt:assetRankings.universe?.observedAt??null,truthState:assetRankings.universe?.truthState||'unavailable'},
    categories,
    readiness:{categoryCount:categories.length,coveredCategories,emptyCategories:categories.length-coveredCategories,classifiedCandidates:candidates.length-unmapped.length,unclassifiedCandidates:unmapped.length,totalCandidates:candidates.length},
    methodology:{
      version:'Qelly primary-role taxonomy 1.0',
      classificationMode:'One deterministic primary category per candidate; no asset is double-counted.',
      aggregation:'Breadth is advancing members divided by members with a 24h change. Category change is the unweighted median member change. Market value and volume are sums of attributed member observations.',
      reviewRule:'Unknown symbols enter Other observed assets until a taxonomy revision assigns a documented primary role.',
      lenses:[...new Set(definitions.map((item)=>item.lens))]
    },
    sourceLedger:Array.isArray(assetRankings.sourceLedger)?assetRankings.sourceLedger:[],
    boundaries:{currentSampleOnly:true,primaryRoleNotInvestmentSector:true,noForecast:true,noRecommendation:true,noExecution:true,fabricatedFallback:false}
  };
}

export const __categoriesTest=Object.freeze({DEFINITIONS,median,metrics});
