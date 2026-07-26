const observedAt = '2026-07-24T09:15:00.000Z';
const receivedAt = '2026-07-24T09:15:01.250Z';
const source = 'Qelly deterministic public-discovery fixture';

function display(canonicalEntityId, value, unit, freshnessClass = 'simulated', confidence = 0.9, qualityFlags = ['deterministic-fixture'], methodologyVersion = null) {
  return { canonicalEntityId, value: value == null ? null : String(value), unit, currency: unit === 'USD' ? 'USD' : null, provider:'qelly-discovery-fixture', source, venue:null, observedAt, receivedAt, freshnessClass, confidence, qualityFlags, entitlementClass:'public-development-fixture', methodologyVersion };
}

const assetSeeds = [
  ['QI-CRYPTO-BTC','BTC','Bitcoin','crypto','Digital Assets','USD',118420.32,2.84,2358000000000,67200000000,'Global','Qelly Global'],
  ['QI-CRYPTO-ETH','ETH','Ethereum','crypto','Smart Contract Platforms','USD',3821.44,1.62,461000000000,28400000000,'Global','Qelly Global'],
  ['QI-CRYPTO-SOL','SOL','Solana','crypto','Smart Contract Platforms','USD',214.68,4.37,101000000000,6800000000,'Global','Qelly Global'],
  ['QI-CRYPTO-XRP','XRP','XRP','crypto','Payments','USD',3.21,-1.18,190000000000,9100000000,'Global','Qelly Global'],
  ['QI-CRYPTO-BNB','BNB','BNB','crypto','Exchange Tokens','USD',812.14,0.74,119000000000,2200000000,'Global','Qelly Global'],
  ['QI-EQUITY-AAPL','AAPL','Apple Inc.','equity','Technology','USD',224.91,-0.34,3380000000000,51100000,'US','NASDAQ'],
  ['QI-EQUITY-NVDA','NVDA','NVIDIA Corporation','equity','Semiconductors','USD',176.28,3.15,4300000000000,189000000,'US','NASDAQ'],
  ['QI-EQUITY-MSFT','MSFT','Microsoft Corporation','equity','Technology','USD',512.42,0.82,3810000000000,24600000,'US','NASDAQ'],
  ['QI-EQUITY-RELIANCE','RELIANCE','Reliance Industries','equity','Energy & Conglomerates','INR',1512.80,1.09,20500000000000,17200000,'IN','NSE'],
  ['QI-EQUITY-TCS','TCS','Tata Consultancy Services','equity','IT Services','INR',4215.35,-0.48,15200000000000,2100000,'IN','NSE'],
  ['QI-FUND-QQQ','QQQ','Invesco QQQ Trust','fund','US Growth ETFs','USD',586.35,0.91,360000000000,42800000,'US','NASDAQ'],
  ['QI-FUND-SPY','SPY','SPDR S&P 500 ETF Trust','fund','Broad Market ETFs','USD',639.84,0.42,610000000000,73100000,'US','NYSE Arca'],
  ['QI-FUND-GLD','GLD','SPDR Gold Shares','fund','Commodity ETFs','USD',312.44,0.71,93000000000,8200000,'US','NYSE Arca'],
  ['QI-FX-USDINR','USDINR','US Dollar / Indian Rupee','fx','Major FX','INR',86.42,0.08,null,null,'Global','Reference'],
  ['QI-FX-EURUSD','EURUSD','Euro / US Dollar','fx','Major FX','USD',1.1762,-0.12,null,null,'Global','Reference'],
  ['QI-FX-USDJPY','USDJPY','US Dollar / Japanese Yen','fx','Major FX','JPY',147.32,0.24,null,null,'Global','Reference'],
  ['QI-COMMODITY-GOLD','XAUUSD','Gold Spot','commodity','Precious Metals','USD',3388.20,0.77,null,18200000000,'Global','Reference'],
  ['QI-COMMODITY-OIL','WTI','WTI Crude Oil','commodity','Energy Commodities','USD',78.62,-0.56,null,12900000000,'Global','Reference'],
  ['QI-COMMODITY-COPPER','COPPER','Copper','commodity','Industrial Metals','USD',5.84,1.14,null,4700000000,'Global','Reference'],
  ['QI-INDEX-SPX','SPX','S&P 500 Index','index','US Equity Indices','USD',6382.71,0.44,null,null,'US','Reference'],
  ['QI-INDEX-NDX','NDX','Nasdaq-100 Index','index','US Equity Indices','USD',23544.12,0.86,null,null,'US','Reference'],
  ['QI-RATE-US10Y','US10Y','US 10-Year Treasury Yield','rate','Sovereign Rates','percent',4.18,-0.03,null,null,'US','Reference'],
  ['QI-RATE-IN10Y','IN10Y','India 10-Year Government Yield','rate','Sovereign Rates','percent',6.31,0.01,null,null,'IN','Reference'],
  ['QI-TOKENIZED-QQQB','QQQB','Invesco QQQ Tokenized bStock','tokenized','Tokenized Securities','USD',586.10,0.88,95000000,7400000,'Global','Fixture Venue']
];

export const discoveryAssets = assetSeeds.map((row,index)=>({
  canonicalId:row[0],symbol:row[1],name:row[2],assetClass:row[3],category:row[4],currency:row[5],price:row[6],change24h:row[7],marketCap:row[8],volume24h:row[9],region:row[10],venue:row[11],rank:index+1,
  freshnessClass:['equity','fund','index'].includes(row[3])?'delayed':row[3]==='fx'||row[3]==='rate'?'cached':'simulated',confidence:['equity','fund','index'].includes(row[3])?.88:.92,
  qualityFlags:['deterministic-fixture',row[3]==='tokenized'?'tokenized-relationship-demo':'normalized-discovery-record'],observedAt,receivedAt,source
}));

const categorySeeds = [
  ['digital-assets','Digital Assets','crypto',3.21,3110000000000,113000000000,68,5,'positive'],
  ['smart-contract-platforms','Smart Contract Platforms','crypto',2.48,742000000000,42100000000,71,2,'positive'],
  ['us-mega-cap','US Mega-Cap','equity',0.74,11500000000000,264000000,57,3,'positive'],
  ['india-large-cap','India Large-Cap','equity',0.36,35700000000000,19300000,52,2,'neutral'],
  ['us-growth-etfs','US Growth ETFs','fund',0.91,360000000000,42800000,63,1,'positive'],
  ['major-fx','Major FX','fx',-0.04,null,null,48,3,'neutral'],
  ['precious-metals','Precious Metals','commodity',0.77,null,18200000000,66,1,'positive'],
  ['energy-commodities','Energy Commodities','commodity',-0.56,null,12900000000,41,1,'negative'],
  ['sovereign-rates','Sovereign Rates','rate',-0.01,null,null,46,2,'neutral'],
  ['tokenized-securities','Tokenized Securities','tokenized',0.88,95000000,7400000,61,1,'positive']
];
export const categories = categorySeeds.map((row,index)=>({categoryId:row[0],name:row[1],assetClass:row[2],performance24h:row[3],marketValue:row[4],volume24h:row[5],breadth:row[6],constituentCount:row[7],trend:row[8],rank:index+1,source,observedAt,receivedAt,freshnessClass:'simulated'}));

export const venues = [
  {venueId:'venue-coinbase-fixture',name:'Coinbase Exchange',type:'spot',assetClass:'crypto',jurisdiction:'US',volume24h:13800000000,liquidityScore:91,depthScore:89,trustScore:94,reserveProof:'not-validated-in-local-fixture',status:'operational',fees:'fixture-only',incidentCount:0},
  {venueId:'venue-kraken-fixture',name:'Kraken',type:'spot',assetClass:'crypto',jurisdiction:'US/EU',volume24h:4200000000,liquidityScore:87,depthScore:84,trustScore:92,reserveProof:'not-validated-in-local-fixture',status:'operational',fees:'fixture-only',incidentCount:0},
  {venueId:'venue-binance-fixture',name:'Binance',type:'spot-derivatives',assetClass:'crypto',jurisdiction:'multi-region',volume24h:42800000000,liquidityScore:95,depthScore:96,trustScore:82,reserveProof:'not-validated-in-local-fixture',status:'operational',fees:'fixture-only',incidentCount:1},
  {venueId:'venue-uniswap-fixture',name:'Uniswap',type:'dex',assetClass:'crypto',jurisdiction:'decentralized',volume24h:3100000000,liquidityScore:84,depthScore:81,trustScore:86,reserveProof:'on-chain-pools-not-live',status:'operational',fees:'pool-dependent fixture',incidentCount:0},
  {venueId:'venue-nasdaq-fixture',name:'NASDAQ',type:'exchange',assetClass:'equity',jurisdiction:'US',volume24h:219000000000,liquidityScore:98,depthScore:98,trustScore:97,reserveProof:'not-applicable',status:'delayed-fixture',fees:'licensed-data-not-configured',incidentCount:0},
  {venueId:'venue-nse-fixture',name:'National Stock Exchange of India',type:'exchange',assetClass:'equity',jurisdiction:'IN',volume24h:1250000000000,liquidityScore:93,depthScore:91,trustScore:96,reserveProof:'not-applicable',status:'delayed-fixture',fees:'licensed-data-not-configured',incidentCount:0}
].map((item,index)=>({...item,rank:index+1,source,observedAt,receivedAt,freshnessClass:'simulated'}));

export const dexPairs = [
  ['dex-btc-usdc','WBTC / USDC','Ethereum','Uniswap V3',118380.2,1.92,86000000,2360000000,42,1840,713,0.87],
  ['dex-eth-usdc','WETH / USDC','Ethereum','Uniswap V3',3818.6,1.54,142000000,458000000000,1880,6240,3188,0.91],
  ['dex-sol-usdc','SOL / USDC','Solana','Orca',214.41,4.11,38000000,101000000000,860,4810,2201,0.78],
  ['dex-qelly-usdc','QELLY / USDC','Base','Fixture DEX',0.084,12.8,620000,8400000,7,943,401,0.52]
].map((row,index)=>({pairId:row[0],name:row[1],chain:row[2],venue:row[3],price:row[4],change24h:row[5],liquidity:row[6],fdv:row[7],ageDays:row[8],transactions24h:row[9],holders:row[10],securityScore:Math.round(row[11]*100),smartMoneySignal:row[11]>.85?'accumulation':row[11]>.7?'watch':'high-risk-fixture',rank:index+1,source,observedAt,receivedAt,freshnessClass:'simulated',qualityFlags:['deterministic-fixture','not-on-chain-live']}));

const makeSeries=(base,drift,amplitude,count=60)=>Array.from({length:count},(_,index)=>({at:new Date(Date.parse('2026-05-26T00:00:00.000Z')+index*86400000).toISOString(),value:Number((base+index*drift+Math.sin(index/4)*amplitude+Math.cos(index/9)*amplitude*.45).toFixed(4))}));
export const globalCharts = [
  {chartId:'global-market-cap',title:'Tracked global market value',unit:'USD-trillion',methodologyVersion:'market-value-1.0.0',series:makeSeries(7.8,.014,.18)},
  {chartId:'btc-dominance',title:'Bitcoin dominance',unit:'percent',methodologyVersion:'dominance-1.0.0',series:makeSeries(55.2,.035,1.1)},
  {chartId:'cross-asset-volatility',title:'Cross-asset volatility index',unit:'index',methodologyVersion:'volatility-1.0.0',series:makeSeries(19.4,-.025,2.3)},
  {chartId:'market-breadth',title:'Cross-asset breadth',unit:'percent',methodologyVersion:'breadth-1.0.0',series:makeSeries(49.2,.12,8.1)},
  {chartId:'etf-flow-fixture',title:'ETF net flow fixture',unit:'USD-billion',methodologyVersion:'flow-1.0.0',series:makeSeries(1.1,.018,.6)}
].map((item)=>({...item,source,observedAt,receivedAt,freshnessClass:'simulated',qualityFlags:['deterministic-fixture','methodology-demo']}));

export const predictionMarkets = [
  {marketId:'pm-fed-september',title:'Will the Federal Reserve cut rates by September 2026?',category:'Macro',probability:0.62,volume:18400000,liquidity:4100000,venue:'Fixture Prediction Venue',resolutionRule:'Resolves from the published target-rate decision.',closesAt:'2026-09-16T18:00:00.000Z'},
  {marketId:'pm-btc-150k',title:'Will Bitcoin trade above $150,000 before 2027?',category:'Crypto',probability:0.41,volume:27600000,liquidity:6900000,venue:'Fixture Prediction Venue',resolutionRule:'Resolves from a defined reference index observation.',closesAt:'2026-12-31T23:59:59.000Z'},
  {marketId:'pm-india-growth',title:'Will India real GDP growth exceed 7% for FY2026–27?',category:'Economy',probability:0.54,volume:8300000,liquidity:2100000,venue:'Fixture Prediction Venue',resolutionRule:'Resolves from the first official annual estimate.',closesAt:'2027-05-31T23:59:59.000Z'}
].map((item)=>({...item,source,observedAt,receivedAt,freshnessClass:'simulated',qualityFlags:['deterministic-fixture','not-tradable']}));

export const newsItems = [
  {newsId:'news-001',headline:'Cross-asset risk appetite improves in the deterministic morning fixture',summary:'Digital assets and semiconductor equities lead the fixture breadth measure while rates remain range-bound.',topics:['markets','crypto','equities'],assetIds:['QI-CRYPTO-BTC','QI-EQUITY-NVDA'],publisher:'Qelly Fixture Wire',publishedAt:'2026-07-24T08:45:00.000Z',sentiment:'positive',sourceQuality:92},
  {newsId:'news-002',headline:'USD/INR reference fixture remains within the defined cached band',summary:'The local reference fixture is unchanged and is explicitly not a live interbank quote.',topics:['fx','india'],assetIds:['QI-FX-USDINR'],publisher:'Qelly Macro Desk',publishedAt:'2026-07-24T08:12:00.000Z',sentiment:'neutral',sourceQuality:96},
  {newsId:'news-003',headline:'Provider gateway validation retains all production connectors in disabled state',summary:'The release confirms no external credential, licensed feed, transfer or live execution route is enabled.',topics:['platform','trust'],assetIds:[],publisher:'Qelly Status Desk',publishedAt:'2026-07-24T07:50:00.000Z',sentiment:'neutral',sourceQuality:100},
  {newsId:'news-004',headline:'Tokenized-security relationship fixture added to discovery graph',summary:'QQQB remains a deterministic relationship demonstration and is not a claim of ownership, custody or tradability.',topics:['tokenization','research'],assetIds:['QI-TOKENIZED-QQQB','QI-FUND-QQQ'],publisher:'Qelly Research Wire',publishedAt:'2026-07-24T07:15:00.000Z',sentiment:'neutral',sourceQuality:94}
].map((item)=>({...item,freshnessClass:'simulated',qualityFlags:['deterministic-fixture'],source}));

export const researchArticles = [
  {articleId:'research-cross-asset-regime',title:'Cross-Asset Regime Monitor: Fixture Method and Interpretation',collection:'Market Structure',author:'Qelly Research',publishedAt:'2026-07-24T06:30:00.000Z',version:'1.0.0',summary:'A transparent explanation of the deterministic breadth, risk-appetite and volatility fixtures.',body:['This local research note documents the calculation boundaries used by the public-discovery release.','No live market data, external model, licensed feed or investment recommendation is used.','Every figure links to a methodology version and a fixture source so unavailable data is never replaced by fabricated zero values.'],citations:[{citationId:'method-risk-appetite',label:'Risk appetite methodology v1.0.0',type:'methodology'},{citationId:'coverage-public-discovery',label:'Public discovery coverage matrix',type:'coverage'}],relatedAssetIds:['QI-CRYPTO-BTC','QI-EQUITY-NVDA','QI-COMMODITY-GOLD'],figures:['global-market-cap','cross-asset-volatility'],methodologyIds:['risk-appetite','market-value','breadth']},
  {articleId:'research-tokenized-relationships',title:'Tokenized Asset Relationships Without Custody Claims',collection:'Digital Market Structure',author:'Qelly Research',publishedAt:'2026-07-23T14:00:00.000Z',version:'1.0.0',summary:'How canonical relationships can represent underlying, wrapped and tokenized structures while keeping rights and tradability explicit.',body:['Canonical graph relationships describe data lineage, not legal title.','The QQQB fixture is marked simulated and cannot be traded, transferred or withdrawn.','Production support would require official issuer, venue, custody, entitlement and jurisdiction verification.'],citations:[{citationId:'method-canonical-identity',label:'Canonical identity methodology v1.0.0',type:'methodology'}],relatedAssetIds:['QI-TOKENIZED-QQQB','QI-FUND-QQQ'],figures:[],methodologyIds:['canonical-identity']},
  {articleId:'research-provider-truth',title:'Provider Truth Boundaries and Fallback Discipline',collection:'Platform Trust',author:'Qelly Platform Research',publishedAt:'2026-07-22T10:00:00.000Z',version:'1.0.0',summary:'A release note on source lineage, stale-state handling and disabled production providers.',body:['Fallback values retain their original observed timestamp and receive a visible freshness class.','A failed source never becomes a fabricated zero or an unlabeled live value.','External providers remain disabled until contractual, credential, entitlement and operational gates are complete.'],citations:[{citationId:'coverage-provider',label:'Provider coverage matrix',type:'coverage'},{citationId:'status-provider',label:'Provider status evidence',type:'status'}],relatedAssetIds:[],figures:[],methodologyIds:['freshness','provider-selection']}
];

export const methodologies = [
  {methodologyId:'market-value',name:'Tracked Market Value',version:'1.0.0',status:'candidate-local',description:'Aggregates eligible fixture market values while leaving unavailable values null.',inputs:['canonical entity','market value','currency','freshness','entitlement'],limitations:['fixture universe','no licensed global completeness'],history:[{version:'1.0.0',effectiveAt:'2026-07-24T00:00:00.000Z',change:'Initial local foundation'}]},
  {methodologyId:'risk-appetite',name:'Risk Appetite Index',version:'1.0.0',status:'candidate-local',description:'Combines normalized breadth, momentum and volatility fixture scores on a 0–100 scale.',inputs:['breadth','momentum','volatility'],limitations:['not an investment signal','fixture-only'],history:[{version:'1.0.0',effectiveAt:'2026-07-24T00:00:00.000Z',change:'Initial deterministic formula'}]},
  {methodologyId:'breadth',name:'Cross-Asset Breadth',version:'1.0.0',status:'candidate-local',description:'Percent of eligible entities with positive fixture change over the selected horizon.',inputs:['eligible universe','change'],limitations:['small deterministic universe'],history:[{version:'1.0.0',effectiveAt:'2026-07-24T00:00:00.000Z',change:'Initial local foundation'}]},
  {methodologyId:'liquidity',name:'Liquidity Score',version:'1.0.0',status:'candidate-local',description:'Fixture composite of volume, depth and continuity evidence.',inputs:['volume','depth','spread','continuity'],limitations:['not based on live order books'],history:[{version:'1.0.0',effectiveAt:'2026-07-24T00:00:00.000Z',change:'Initial fixture scale'}]},
  {methodologyId:'canonical-identity',name:'Canonical Entity Identity',version:'1.0.0',status:'implemented-local',description:'Maps symbols, venues and relationships to immutable QI identifiers.',inputs:['symbol history','venue','issuer','relationships'],limitations:['production identifier providers disabled'],history:[{version:'1.0.0',effectiveAt:'2026-07-24T00:00:00.000Z',change:'Persistent instrument-master foundation'}]},
  {methodologyId:'freshness',name:'Freshness and Availability',version:'1.0.0',status:'implemented-local',description:'Classifies values as live, delayed, cached, stale, simulated or unavailable.',inputs:['observedAt','receivedAt','provider contract'],limitations:['all public discovery values in this release are fixture, delayed or cached'],history:[{version:'1.0.0',effectiveAt:'2026-07-24T00:00:00.000Z',change:'Universal display contract'}]},
  {methodologyId:'provider-selection',name:'Provider Selection and Fallback',version:'1.0.0',status:'implemented-local',description:'Selects eligible deterministic adapters using entitlement, health and quality controls.',inputs:['capability','entitlement','health','quality','quota'],limitations:['external provider calls disabled'],history:[{version:'1.0.0',effectiveAt:'2026-07-24T00:00:00.000Z',change:'Wave 3 local runtime'}]}
];

export const coverage = {
  summary:{assetClasses:8,regions:4,entities:discoveryAssets.length,venues:venues.length,historyDepthDays:360,externalProvidersEnabled:0,licensedFeedsConfigured:0,qualityScore:92},
  assetClasses:[
    {assetClass:'crypto',entities:5,regions:['Global'],history:'360h local seed',delay:'simulated',license:'development fixture',qualityScore:94},
    {assetClass:'equity',entities:5,regions:['US','IN'],history:'360h local seed for selected instruments',delay:'15-minute fixture label',license:'licensed provider required for production',qualityScore:88},
    {assetClass:'fund',entities:3,regions:['US'],history:'360h local seed for QQQ',delay:'15-minute fixture label',license:'licensed provider required for production',qualityScore:88},
    {assetClass:'fx',entities:3,regions:['Global'],history:'360h local seed for USDINR',delay:'cached reference fixture',license:'official source review required',qualityScore:90},
    {assetClass:'commodity',entities:3,regions:['Global'],history:'360h local seed for gold',delay:'cached reference fixture',license:'production source required',qualityScore:89},
    {assetClass:'index',entities:2,regions:['US'],history:'360h local seed for SPX',delay:'15-minute fixture label',license:'licensed provider required',qualityScore:88},
    {assetClass:'rate',entities:2,regions:['US','IN'],history:'summary fixture only',delay:'cached reference fixture',license:'official-source validation required',qualityScore:87},
    {assetClass:'tokenized',entities:1,regions:['Global'],history:'relationship demonstration only',delay:'simulated',license:'issuer, venue and custody validation required',qualityScore:72}
  ],
  outages:[{incidentId:'coverage-001',scope:'external providers',status:'expected-disabled',startedAt:'2026-07-24T00:00:00.000Z',message:'External providers are intentionally disabled in this local release.'}],
  source,observedAt,receivedAt
};

export const platformStatus = {
  overall:'operational-local',updatedAt:receivedAt,productionDeployment:false,
  safety:{externalProviders:false,licensedFeeds:false,liveTrading:false,transfers:false,withdrawals:false,privateKeys:false,recoveryPhrases:false},
  components:[
    {componentId:'public-discovery-api',name:'Public Discovery API',status:'operational-local',uptimePercent:100,latencyMs:4},
    {componentId:'universal-search',name:'Universal Search',status:'operational-local',uptimePercent:100,latencyMs:3},
    {componentId:'instrument-master',name:'Instrument Master',status:'operational-local',uptimePercent:100,latencyMs:2},
    {componentId:'time-series',name:'Time-Series Store',status:'operational-local',uptimePercent:100,latencyMs:6},
    {componentId:'external-providers',name:'External Providers',status:'disabled-by-policy',uptimePercent:null,latencyMs:null},
    {componentId:'licensed-feeds',name:'Licensed Feeds',status:'not-configured',uptimePercent:null,latencyMs:null}
  ],
  incidents:[{incidentId:'status-001',severity:'information',status:'resolved',title:'Part 17 local discovery expansion',startedAt:'2026-07-24T09:00:00.000Z',resolvedAt:'2026-07-24T09:10:00.000Z',summary:'Discovery services initialized with deterministic fixture evidence.'}],
  maintenance:[{maintenanceId:'maint-001',status:'planned-contract-only',window:'not scheduled',summary:'Production provider onboarding remains gated.'}],
  securityNotices:[{noticeId:'security-001',severity:'information',title:'No production secrets or financial-action routes enabled',publishedAt:'2026-07-24T09:05:00.000Z'}],
  attestations:[{attestationId:'attest-001',name:'Local release safety boundary verification',status:'self-verified-evidence',scope:'release package',externalAudit:false}]
};

function normalize(value){return String(value??'').trim().toLowerCase();}
function encodeCursor(offset){return Buffer.from(JSON.stringify({offset})).toString('base64url');}
function decodeCursor(cursor){if(!cursor)return 0;try{const parsed=JSON.parse(Buffer.from(String(cursor),'base64url').toString('utf8'));return Math.max(0,Number(parsed.offset)||0);}catch{const error=new Error('Invalid cursor');error.status=400;error.code='cursor_invalid';throw error;}}
function paginate(items,{limit=25,cursor=null}={}){const bounded=Math.max(1,Math.min(Number(limit)||25,100));const offset=decodeCursor(cursor);const page=items.slice(offset,offset+bounded);return {items:page,total:items.length,nextCursor:offset+bounded<items.length?encodeCursor(offset+bounded):null};}
function scoreText(query,...values){if(!query)return 1;const text=values.map(normalize).join(' ');if(text===query)return 120;if(text.startsWith(query))return 100;if(text.includes(` ${query}`))return 85;if(text.includes(query))return 65;return query.split(/\s+/).reduce((score,term)=>score+(text.includes(term)?18:0),0);}

export class DiscoveryService {
  overview(){
    const advancers=discoveryAssets.filter((item)=>item.change24h>0).length;
    return {
      mode:'deterministic-public-discovery-foundation',truthBoundary:'All values are deterministic, delayed, cached or explicitly simulated. No external public or licensed provider call was performed.',
      kpis:[
        {label:'Discoverable entities',value:display('QI-DISCOVERY-ENTITIES',discoveryAssets.length,'count')},
        {label:'Tracked categories',value:display('QI-DISCOVERY-CATEGORIES',categories.length,'count')},
        {label:'Fixture breadth',value:display('QI-DISCOVERY-BREADTH',Math.round(advancers/discoveryAssets.length*100),'percent','simulated',.86,['deterministic-fixture','methodology-demo'],'breadth-1.0.0')},
        {label:'Coverage quality',value:display('QI-DISCOVERY-COVERAGE',coverage.summary.qualityScore,'score','cached',.95,['deterministic-fixture'],'coverage-1.0.0')}
      ],
      movers:[...discoveryAssets].sort((a,b)=>Math.abs(b.change24h)-Math.abs(a.change24h)).slice(0,8),
      categories:categories.slice(0,8),news:newsItems.slice(0,3),events:[
        {eventId:'event-fed-fixture',title:'Federal Reserve decision fixture window',at:'2026-09-16T18:00:00.000Z',importance:'high',source:'Qelly event fixture'},
        {eventId:'event-india-cpi-fixture',title:'India CPI fixture publication',at:'2026-08-12T12:00:00.000Z',importance:'medium',source:'Qelly event fixture'}
      ],source,observedAt,receivedAt
    };
  }

  rankings({assetClass=null,category=null,region=null,sort='marketCap',direction='desc',q='',limit=25,cursor=null}={}){
    let items=discoveryAssets.filter((item)=>(!assetClass||item.assetClass===assetClass)&&(!category||normalize(item.category)===normalize(category))&&(!region||normalize(item.region)===normalize(region)));
    const query=normalize(q);if(query)items=items.filter((item)=>scoreText(query,item.symbol,item.name,item.category,item.assetClass,item.region)>0);
    const allowed=new Set(['rank','name','symbol','price','change24h','marketCap','volume24h']);const key=allowed.has(sort)?sort:'marketCap';const factor=direction==='asc'?1:-1;
    items.sort((a,b)=>{const av=a[key]??(factor===1?Number.MAX_SAFE_INTEGER:Number.MIN_SAFE_INTEGER),bv=b[key]??(factor===1?Number.MAX_SAFE_INTEGER:Number.MIN_SAFE_INTEGER);return typeof av==='string'?String(av).localeCompare(String(bv))*factor:(Number(av)-Number(bv))*factor;});
    return {...paginate(items,{limit,cursor}),query:{assetClass,category,region,sort:key,direction,q},mode:'deterministic-public-discovery-foundation',source,observedAt,receivedAt};
  }

  categories({assetClass=null,limit=50,cursor=null}={}){const items=categories.filter((item)=>!assetClass||item.assetClass===assetClass);return {...paginate(items,{limit,cursor}),source,observedAt,receivedAt};}
  category(categoryId){const item=categories.find((entry)=>entry.categoryId===categoryId);if(!item)throw Object.assign(new Error('Category not found'),{status:404,code:'category_not_found'});const constituents=discoveryAssets.filter((asset)=>normalize(asset.category).replaceAll(' ','-')===categoryId||normalize(asset.category)===normalize(item.name)).sort((a,b)=>b.change24h-a.change24h);return {...item,constituents,news:newsItems.filter((news)=>news.assetIds.some((id)=>constituents.some((asset)=>asset.canonicalId===id))),events:this.overview().events,risk:{score:Math.round(100-item.breadth/2),methodologyVersion:'category-risk-1.0.0',status:'fixture-candidate'},correlations:constituents.map((asset,index)=>({canonicalId:asset.canonicalId,correlation:Number((.92-index*.11).toFixed(2))})),source,observedAt,receivedAt};}
  venues({type=null,assetClass=null,limit=25,cursor=null}={}){const items=venues.filter((item)=>(!type||item.type.includes(type))&&(!assetClass||item.assetClass===assetClass));return {...paginate(items,{limit,cursor}),source,observedAt,receivedAt};}
  venue(venueId){const item=venues.find((entry)=>entry.venueId===venueId);if(!item)throw Object.assign(new Error('Venue not found'),{status:404,code:'venue_not_found'});return {...item,markets:discoveryAssets.filter((asset)=>normalize(asset.venue).includes(normalize(item.name).split(' ')[0])).slice(0,12),volumeHistory:makeSeries(item.volume24h*.72,item.volume24h*.004,item.volume24h*.08,30),incidents:item.incidentCount?[{incidentId:`${venueId}-fixture`,status:'resolved-fixture',title:'Historical incident demonstration'}]:[],source,observedAt,receivedAt};}
  dex({chain=null,sort='change24h',limit=25,cursor=null}={}){let items=dexPairs.filter((item)=>!chain||normalize(item.chain)===normalize(chain));items.sort((a,b)=>Number(b[sort]??0)-Number(a[sort]??0));return {...paginate(items,{limit,cursor}),source,observedAt,receivedAt};}
  dexPair(pairId){const item=dexPairs.find((entry)=>entry.pairId===pairId);if(!item)throw Object.assign(new Error('DEX pair not found'),{status:404,code:'dex_pair_not_found'});return {...item,chart:makeSeries(item.price*.82,item.price*.003,item.price*.05,72),trades:Array.from({length:12},(_,index)=>({tradeId:`${pairId}-trade-${index+1}`,side:index%3?'buy':'sell',price:Number((item.price*(1+(index-5)*.0012)).toFixed(6)),size:Number((12+index*3.4).toFixed(2)),at:new Date(Date.parse(observedAt)-index*90000).toISOString()})),pools:[{poolId:`${pairId}-primary`,venue:item.venue,feeTier:'fixture',liquidity:item.liquidity}],source,observedAt,receivedAt};}
  charts(){return {items:globalCharts,source,observedAt,receivedAt};}
  predictionMarkets({category=null}={}){return {items:predictionMarkets.filter((item)=>!category||normalize(item.category)===normalize(category)),tradable:false,source,observedAt,receivedAt};}

  converter({amount,from,to,feeBps=0,slippageBps=0,at=null}={}){
    const numeric=Number(amount);if(!Number.isFinite(numeric)||numeric<0)throw Object.assign(new Error('Amount must be a non-negative number'),{status:400,code:'amount_invalid'});
    const sourceAsset=discoveryAssets.find((item)=>item.canonicalId===from||normalize(item.symbol)===normalize(from));const targetAsset=discoveryAssets.find((item)=>item.canonicalId===to||normalize(item.symbol)===normalize(to));
    if(!sourceAsset||!targetAsset)throw Object.assign(new Error('Converter asset not found'),{status:404,code:'converter_asset_not_found'});
    const gross=numeric*Number(sourceAsset.price)/Number(targetAsset.price);const boundedFee=Math.max(0,Math.min(Number(feeBps)||0,1000));const boundedSlippage=Math.max(0,Math.min(Number(slippageBps)||0,1000));const fee=gross*boundedFee/10000;const slippage=gross*boundedSlippage/10000;const net=gross-fee-slippage;
    return {conversionId:`conversion-${sourceAsset.symbol}-${targetAsset.symbol}-${Date.parse(observedAt)}`,from:{canonicalId:sourceAsset.canonicalId,symbol:sourceAsset.symbol,amount:String(numeric)},to:{canonicalId:targetAsset.canonicalId,symbol:targetAsset.symbol,grossAmount:String(Number(gross.toFixed(10))),netAmount:String(Number(net.toFixed(10)))},fee:{bps:boundedFee,amount:String(Number(fee.toFixed(10)))},slippage:{bps:boundedSlippage,amount:String(Number(slippage.toFixed(10)))},rate:String(Number((Number(sourceAsset.price)/Number(targetAsset.price)).toFixed(10))),historicalAt:at??null,source,observedAt,receivedAt,freshnessClass:'simulated',qualityFlags:['deterministic-fixture','not-executable','fees-and-slippage-simulation'],tradable:false};
  }
  news({q='',topic=null,assetId=null,limit=25,cursor=null}={}){const query=normalize(q);const items=newsItems.filter((item)=>(!topic||item.topics.includes(topic))&&(!assetId||item.assetIds.includes(assetId))&&(!query||scoreText(query,item.headline,item.summary,item.topics.join(' '))>0));return {...paginate(items,{limit,cursor}),source,observedAt,receivedAt};}
  research({q='',collection=null,author=null,limit=25,cursor=null}={}){const query=normalize(q);const items=researchArticles.filter((item)=>(!collection||normalize(item.collection)===normalize(collection))&&(!author||normalize(item.author)===normalize(author))&&(!query||scoreText(query,item.title,item.summary,item.collection,item.author)>0)).map(({body,...item})=>item);return {...paginate(items,{limit,cursor}),source,observedAt,receivedAt};}
  article(articleId){const article=researchArticles.find((item)=>item.articleId===articleId);if(!article)throw Object.assign(new Error('Research article not found'),{status:404,code:'research_article_not_found'});return {...article,relatedAssets:discoveryAssets.filter((asset)=>article.relatedAssetIds.includes(asset.canonicalId)),methodologies:methodologies.filter((item)=>article.methodologyIds.includes(item.methodologyId)),source,observedAt,receivedAt,exportEnabled:false,commentsEnabled:false};}
  methodologies(){return {items:methodologies,source,observedAt,receivedAt};}
  methodology(methodologyId){const item=methodologies.find((entry)=>entry.methodologyId===methodologyId);if(!item)throw Object.assign(new Error('Methodology not found'),{status:404,code:'methodology_not_found'});return {...item,source,observedAt,receivedAt};}
  coverage(){return coverage;}
  status(){return platformStatus;}

  search({q='',types=[],assetClass=null,limit=25,cursor=null}={}){
    const query=normalize(q);const selected=new Set(Array.isArray(types)?types:String(types||'').split(',').filter(Boolean));const include=(type)=>!selected.size||selected.has(type);
    const results=[];
    if(include('asset'))for(const item of discoveryAssets){const score=scoreText(query,item.symbol,item.name,item.category,item.assetClass,item.region,item.venue);if(!query||score>0)results.push({resultId:item.canonicalId,type:'asset',title:`${item.symbol} · ${item.name}`,subtitle:`${item.assetClass} · ${item.category}`,route:`asset/${item.canonicalId}`,score,entity:item});}
    if(include('category'))for(const item of categories){const score=scoreText(query,item.name,item.assetClass);if(!query||score>0)results.push({resultId:item.categoryId,type:'category',title:item.name,subtitle:`${item.assetClass} category`,route:`category-detail/${item.categoryId}`,score,entity:item});}
    if(include('venue'))for(const item of venues){const score=scoreText(query,item.name,item.type,item.jurisdiction);if(!query||score>0)results.push({resultId:item.venueId,type:'venue',title:item.name,subtitle:`${item.type} · ${item.jurisdiction}`,route:`venue-detail/${item.venueId}`,score,entity:item});}
    if(include('dex'))for(const item of dexPairs){const score=scoreText(query,item.name,item.chain,item.venue);if(!query||score>0)results.push({resultId:item.pairId,type:'dex',title:item.name,subtitle:`${item.chain} · ${item.venue}`,route:`dex-discovery/${item.pairId}`,score,entity:item});}
    if(include('news'))for(const item of newsItems){const score=scoreText(query,item.headline,item.summary,item.topics.join(' '));if(!query||score>0)results.push({resultId:item.newsId,type:'news',title:item.headline,subtitle:`${item.publisher} · ${item.publishedAt}`,route:'news-research',score,entity:item});}
    if(include('research'))for(const item of researchArticles){const score=scoreText(query,item.title,item.summary,item.collection,item.author);if(!query||score>0)results.push({resultId:item.articleId,type:'research',title:item.title,subtitle:`${item.collection} · ${item.author}`,route:`research-article/${item.articleId}`,score,entity:{...item,body:undefined}});}
    if(include('methodology'))for(const item of methodologies){const score=scoreText(query,item.name,item.description,item.methodologyId);if(!query||score>0)results.push({resultId:item.methodologyId,type:'methodology',title:item.name,subtitle:`Methodology ${item.version}`,route:`trust-center/${item.methodologyId}`,score,entity:item});}
    if(include('command'))for(const item of [{id:'market',title:'Open market overview'},{id:'discovery-hub',title:'Open discovery hub'},{id:'converter',title:'Open universal converter'},{id:'trust-center',title:'Open trust center'},{id:'theme-lab',title:'Open theme laboratory'}]){const score=scoreText(query,item.title,item.id);if(!query||score>0)results.push({resultId:`command-${item.id}`,type:'command',title:item.title,subtitle:'Application command',route:item.id,score,entity:item});}
    if(assetClass)results.splice(0,results.length,...results.filter((item)=>item.type!=='asset'||item.entity.assetClass===assetClass));
    results.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title));const page=paginate(results,{limit,cursor});return {...page,query:q,types:[...selected],facets:{types:Object.entries(Object.groupBy(results,(item)=>item.type)).map(([key,values])=>({value:key,count:values.length})),assetClasses:Object.entries(Object.groupBy(results.filter((item)=>item.type==='asset'),(item)=>item.entity.assetClass)).map(([key,values])=>({value:key,count:values.length}))},mode:'federated-local-search-foundation',source,observedAt,receivedAt};
  }

  suggestions(q=''){return this.search({q,limit:8}).items.map((item)=>({resultId:item.resultId,type:item.type,title:item.title,subtitle:item.subtitle,route:item.route}));}
}
