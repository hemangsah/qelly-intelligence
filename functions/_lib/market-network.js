import {providerDirectory,providerDirectorySummary} from './provider-directory.js';

const REQUEST_TIMEOUT_MS=7000;
const SOURCE_CACHE_TTL=Object.freeze({hyperliquid:8,'alternative-me':60,'world-bank':3600,imf:21600});

const nowIso=()=>new Date().toISOString();
const finiteOrNull=(value)=>Number.isFinite(Number(value))?Number(value):null;
const normalizedTruthState=(source)=>{
  const state=String(source?.truthState||source?.state||'unavailable').toLowerCase();
  if(state==='unavailable'||source?.data==null)return 'unavailable';
  if(state.includes('stale')||state.includes('delayed')||state==='reference_external')return 'delayed';
  if(state.includes('cache'))return 'cached';
  if(state.includes('live'))return 'live';
  return 'cached';
};
const sourceUsable=(source)=>normalizedTruthState(source)!=='unavailable';
const hasArrayData=(source)=>Array.isArray(source?.data)&&source.data.length>0;
const hasObjectData=(source,key)=>source?.data&&typeof source.data==='object'&&source.data[key]!=null;
const observation=(sourceId,source,label,value,unit='text',extra={})=>({
  id:`${sourceId}:${String(label).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`,
  label,
  value:value??null,
  unit,
  sourceId,
  provider:source?.attribution||source?.label||sourceId,
  truthState:normalizedTruthState(source),
  observedAt:extra.observedAt??source?.observedAt??null,
  context:extra.context??null
});
const lensState=(sources)=>{
  const states=sources.map(normalizedTruthState);
  if(states.every((state)=>state==='unavailable'))return 'unavailable';
  if(states.some((state)=>state==='unavailable'))return 'partial';
  if(states.some((state)=>state==='delayed'))return 'reference';
  if(states.some((state)=>state==='cached'))return 'cached';
  return 'live';
};

export function buildDiscoveryOverview(sources={},diagnostics=buildNetworkDiagnostics(sources)){
  const alternative=sources['alternative-me'];
  const hyperliquid=sources.hyperliquid;
  const ecb=sources.ecb;
  const worldBank=sources['world-bank'];
  const imf=sources.imf;
  const assets=Array.isArray(alternative?.data?.assets)?alternative.data.assets.filter((row)=>Number.isFinite(Number(row.change24hPct))):[];
  const advancing=assets.filter((row)=>Number(row.change24hPct)>0).length;
  const declining=assets.filter((row)=>Number(row.change24hPct)<0).length;
  const unchanged=Math.max(0,assets.length-advancing-declining);
  const sentiment=alternative?.data?.sentiment;
  const rates=ecb?.data?.rates&&typeof ecb.data.rates==='object'?ecb.data.rates:{};
  const eurUsd=finiteOrNull(rates.USD);
  const eurInr=finiteOrNull(rates.INR);
  const usdInr=eurUsd&&eurInr?eurInr/eurUsd:null;
  const worldRows=Array.isArray(worldBank?.data)?worldBank.data:[];
  const imfRows=Array.isArray(imf?.data)?imf.data:[];
  const country=(rows,id)=>rows.find((row)=>row.countryId===id);
  const wbIndia=country(worldRows,'IND');
  const wbUsa=country(worldRows,'USA');
  const wbChina=country(worldRows,'CHN');
  const imfIndia=country(imfRows,'IND');
  const imfUsa=country(imfRows,'USA');
  const lens=(record)=>({
    ...record,
    ready:record.state!=='unavailable'&&record.observations.some((item)=>item.value!=null),
    evidenceCount:record.observations.filter((item)=>item.value!=null).length
  });
  const lenses=[
    lens({
      id:'risk-appetite',
      label:'Risk appetite',
      purpose:'Frame whether current market psychology deserves a deeper breadth check.',
      question:'Is the current risk mood broad enough to justify a cross-asset research question?',
      state:lensState([alternative]),
      sourceIds:['alternative-me'],
      observations:[
        observation('alternative-me',alternative,'Fear & Greed score',sentiment?.value,'score',{observedAt:sentiment?.timestamp,context:sentiment?.classification||null}),
        observation('alternative-me',alternative,'Advancing assets in source sample',advancing,'count',{context:`${assets.length} attributed crypto assets sampled`}),
        observation('alternative-me',alternative,'Declining assets in source sample',declining,'count',{context:`${unchanged} unchanged`})
      ],
      limitation:'A sentiment reference and a small crypto sample do not establish a global risk regime.',
      nextRoute:'live-markets',
      nextLabel:'Check market breadth'
    }),
    lens({
      id:'crypto-breadth',
      label:'Crypto breadth',
      purpose:'Test whether a crypto theme is shared across the governed source sample.',
      question:'Which part of the available crypto sample is participating in the current move?',
      state:lensState([alternative,hyperliquid]),
      sourceIds:['alternative-me','hyperliquid'],
      observations:[
        observation('alternative-me',alternative,'Available asset observations',assets.length,'count'),
        observation('alternative-me',alternative,'Positive 24h observations',advancing,'count'),
        observation('alternative-me',alternative,'Negative 24h observations',declining,'count'),
        observation('hyperliquid',hyperliquid,'Independent venue observations',Array.isArray(hyperliquid?.data)?hyperliquid.data.length:0,'count')
      ],
      limitation:'Breadth describes participation in the current sample; it is not an asset ranking or trade signal.',
      nextRoute:'asset-rankings',
      nextLabel:'Narrow with declared criteria'
    }),
    lens({
      id:'currency-conditions',
      label:'Currency conditions',
      purpose:'Frame a currency question from official reference rates before using a converter or chart.',
      question:'Do official reference rates suggest a currency condition worth researching by region?',
      state:lensState([ecb]),
      sourceIds:['ecb'],
      observations:[
        observation('ecb',ecb,'EUR / USD reference',eurUsd,'rate'),
        observation('ecb',ecb,'EUR / INR reference',eurInr,'rate'),
        observation('ecb',ecb,'USD / INR derived cross-reference',usdInr,'rate',{context:'INR-per-EUR ÷ USD-per-EUR; reference only'}),
        observation('ecb',ecb,'Published currency references',Object.keys(rates).length,'count')
      ],
      limitation:'ECB rates are working-day references, not executable FX quotes, remittance rates or forecasts.',
      nextRoute:'converter',
      nextLabel:'Model a reference conversion'
    }),
    lens({
      id:'growth-divergence',
      label:'Growth divergence',
      purpose:'Compare historical and forecast-labelled growth references before forming a macro thesis.',
      question:'Which regional growth differences deserve primary-source research?',
      state:lensState([worldBank,imf]),
      sourceIds:['world-bank','imf'],
      observations:[
        observation('world-bank',worldBank,`India GDP growth · ${wbIndia?.year||'latest'}`,wbIndia?.gdpGrowthPct,'percent',{context:'World Bank historical observation'}),
        observation('world-bank',worldBank,`United States GDP growth · ${wbUsa?.year||'latest'}`,wbUsa?.gdpGrowthPct,'percent',{context:'World Bank historical observation'}),
        observation('world-bank',worldBank,`China GDP growth · ${wbChina?.year||'latest'}`,wbChina?.gdpGrowthPct,'percent',{context:'World Bank historical observation'}),
        observation('imf',imf,`India WEO growth · ${imfIndia?.year||'latest'}`,imfIndia?.growthPct,'percent',{context:imfIndia?.estimateOrProjection?'Estimate or projection':'Published observation'}),
        observation('imf',imf,`United States WEO growth · ${imfUsa?.year||'latest'}`,imfUsa?.growthPct,'percent',{context:imfUsa?.estimateOrProjection?'Estimate or projection':'Published observation'})
      ],
      limitation:'Annual history and WEO estimates use different publication methods and must not be treated as live market data.',
      nextRoute:'research-workspace',
      nextLabel:'Build a macro dossier'
    })
  ];
  const sourceRoles={
    'alternative-me':'Sentiment and attributed crypto sample',
    hyperliquid:'Independent read-only crypto venue context',
    ecb:'Official working-day FX reference',
    'world-bank':'Historical annual growth reference',
    imf:'WEO estimate and projection cross-check'
  };
  const sourceLedger=Object.entries(sources).map(([id,source])=>({
    id,
    label:source?.label||source?.attribution||id,
    role:sourceRoles[id]||'Governed research source',
    truthState:normalizedTruthState(source),
    observedAt:source?.observedAt??null,
    fetchedAt:source?.fetchedAt??source?.ingestedAt??null,
    cadence:source?.cadence??'Provider governed',
    attribution:source?.attribution??source?.label??id
  }));
  return {
    version:'governed-theme-framing-v1',
    job:'Turn a broad market theme into a researchable question before choosing an asset.',
    lenses,
    sourceLedger,
    readiness:{
      availableLenses:lenses.filter((item)=>item.ready).length,
      totalLenses:lenses.length,
      sourceCounts:diagnostics.sourceCounts,
      decisionUse:diagnostics.readiness?.decisionUse||'partial_source_coverage'
    },
    boundaries:{ranking:false,search:false,singleAssetAnalysis:false,execution:false,fabricatedFallback:false}
  };
}

export function buildNetworkDiagnostics(sources={}){
  const entries=Object.entries(sources).map(([id,source])=>({id,source,state:normalizedTruthState(source)}));
  const sourceCounts={total:entries.length,live:0,cached:0,delayed:0,unavailable:0};
  for(const entry of entries)sourceCounts[entry.state]+=1;
  const alternative=sources['alternative-me'];
  const hyperliquid=sources.hyperliquid;
  const ecb=sources.ecb;
  const worldBank=sources['world-bank'];
  const imf=sources.imf;
  const coverage=[
    {
      id:'crypto-pricing',
      label:'Crypto price context',
      purpose:'Compare two independent, read-only crypto observations.',
      mode:'market_observation',
      sources:['alternative-me','hyperliquid'],
      available:[alternative,hyperliquid].filter(sourceUsable).length,
      required:2,
      ready:sourceUsable(alternative)&&sourceUsable(hyperliquid)&&hasArrayData(hyperliquid)&&Array.isArray(alternative?.data?.assets)
    },
    {
      id:'market-sentiment',
      label:'Market sentiment',
      purpose:'Add a clearly attributed daily risk-appetite reference.',
      mode:'reference_observation',
      sources:['alternative-me'],
      available:sourceUsable(alternative)&&hasObjectData(alternative,'sentiment')?1:0,
      required:1,
      ready:sourceUsable(alternative)&&hasObjectData(alternative,'sentiment')
    },
    {
      id:'fx-reference',
      label:'FX reference rates',
      purpose:'Anchor currency research to official ECB reference data.',
      mode:'governed_reference',
      sources:['ecb'],
      available:sourceUsable(ecb)&&hasObjectData(ecb,'rates')?1:0,
      required:1,
      ready:sourceUsable(ecb)&&hasObjectData(ecb,'rates')
    },
    {
      id:'macro-context',
      label:'Macro context',
      purpose:'Compare annual World Bank history with IMF WEO estimates.',
      mode:'statistical_reference',
      sources:['world-bank','imf'],
      available:[worldBank,imf].filter(sourceUsable).length,
      required:2,
      ready:sourceUsable(worldBank)&&sourceUsable(imf)&&hasArrayData(worldBank)&&hasArrayData(imf)
    }
  ];
  const readyDomains=coverage.filter((item)=>item.ready).length;
  return {
    sourceCounts,
    coverage,
    readiness:{
      readyDomains,
      totalDomains:coverage.length,
      crossAssetContext:coverage.every((item)=>item.available>0),
      independentCryptoComparison:coverage.find((item)=>item.id==='crypto-pricing')?.ready===true,
      macroCrossCheck:coverage.find((item)=>item.id==='macro-context')?.ready===true,
      decisionUse:readyDomains===coverage.length?'ready_with_source_boundaries':'partial_source_coverage',
      execution:false
    }
  };
}

async function fetchJson(url,{method='GET',body=null,headers={}}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
  try{
    const response=await fetch(url,{method,body,headers:{Accept:'application/json',...headers},signal:controller.signal});
    if(!response.ok){
      const error=new Error(`Upstream returned HTTP ${response.status}`);
      error.status=response.status;
      throw error;
    }
    return await response.json();
  }finally{clearTimeout(timer);}
}

const unavailable=(id,label,extra={})=>({id,label,state:'unavailable',truthState:'unavailable',observedAt:null,fetchedAt:nowIso(),data:null,...extra});
const success=(id,label,data,{state='live_external_reference',...extra}={})=>({id,label,state,observedAt:extra.observedAt??null,fetchedAt:nowIso(),data,...extra});
const sourceTruthState=(value,cacheState='miss')=>{
  if(!value||value.state==='unavailable'||value.data==null)return 'unavailable';
  if(value.state==='reference_external')return 'delayed';
  if(cacheState==='hit')return 'cached';
  if(value.state==='live_external_reference')return 'live';
  return 'cached';
};
const withDelivery=(value,edgeCache,ttlSeconds)=>({
  ...value,
  truthState:sourceTruthState(value,edgeCache),
  delivery:{edgeCache,cacheTtlSeconds:ttlSeconds,scope:'cloudflare_poi_cache'}
});

function edgeCacheRequest(context,key){
  const request=context?.request;
  if(!request?.url)return null;
  const url=new URL(`/__qelly-edge-cache/market-network/${encodeURIComponent(key)}/v2`,request.url);
  return new Request(url.toString(),{method:'GET',headers:{Accept:'application/json'}});
}

async function cachedSource(context,key,ttlSeconds,loader){
  const cache=globalThis.caches?.default;
  const cacheRequest=edgeCacheRequest(context,key);
  if(!cache||!cacheRequest)return withDelivery(await loader(),'bypass',ttlSeconds);
  try{
    const hit=await cache.match(cacheRequest);
    if(hit){
      const cached=await hit.json();
      return withDelivery(cached,'hit',ttlSeconds);
    }
  }catch(error){
    console.warn(JSON.stringify({event:'qelly_market_source_cache_read_failed',source:key,message:error?.message||String(error)}));
  }
  const value=await loader();
  if(value?.state!=='unavailable'&&value?.data!=null){
    const response=new Response(JSON.stringify(value),{
      headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':`public, max-age=${ttlSeconds}`}
    });
    const write=cache.put(cacheRequest,response).catch((error)=>{
      console.warn(JSON.stringify({event:'qelly_market_source_cache_write_failed',source:key,message:error?.message||String(error)}));
    });
    if(typeof context?.waitUntil==='function')context.waitUntil(write);
    else await write;
  }
  return withDelivery(value,'miss',ttlSeconds);
}

async function alternativeCrypto(){
  const [tickerResult,fngResult]=await Promise.allSettled([
    fetchJson('https://api.alternative.me/v2/ticker/?limit=10&structure=array'),
    fetchJson('https://api.alternative.me/fng/?limit=1&format=json')
  ]);
  const ticker=tickerResult.status==='fulfilled'?tickerResult.value:null;
  const fng=fngResult.status==='fulfilled'?fngResult.value:null;
  const rows=Array.isArray(ticker?.data)?ticker.data.slice(0,10).map((item)=>({
    id:String(item.id??''),
    symbol:String(item.symbol??''),
    name:String(item.name??''),
    rank:finiteOrNull(item.rank),
    priceUsd:finiteOrNull(item.quotes?.USD?.price),
    marketCapUsd:finiteOrNull(item.quotes?.USD?.market_cap),
    volume24hUsd:finiteOrNull(item.quotes?.USD?.volume_24h),
    change24hPct:finiteOrNull(item.quotes?.USD?.percentage_change_24h),
    updatedAt:item.last_updated?new Date(Number(item.last_updated)*1000).toISOString():null
  })):[];
  const fngRow=Array.isArray(fng?.data)?fng.data[0]:null;
  if(!rows.length&&!fngRow)return unavailable('alternative-me','Alternative.me',{attribution:'Alternative.me',termsUrl:'https://alternative.me/crypto/api/',usage:'commercial_use_allowed_under_current_public_api_terms; fear-and-greed requires prominent source attribution'});
  return success('alternative-me','Alternative.me',{
    assets:rows,
    sentiment:fngRow?{value:finiteOrNull(fngRow.value),classification:String(fngRow.value_classification??''),timestamp:fngRow.timestamp?new Date(Number(fngRow.timestamp)*1000).toISOString():null}:null
  },{
    observedAt:rows.find((row)=>row.updatedAt)?.updatedAt??(fngRow?.timestamp?new Date(Number(fngRow.timestamp)*1000).toISOString():null),
    attribution:'Alternative.me',
    termsUrl:'https://alternative.me/crypto/api/',
    usage:'commercial_use_allowed_under_current_public_api_terms; fear-and-greed source attribution required next to display',
    cadence:'ticker approximately five-minute reference data; fear-and-greed daily'
  });
}

async function hyperliquidMids(){
  try{
    const payload=await fetchJson('https://api.hyperliquid.xyz/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'allMids'})});
    const preferred=['BTC','ETH','SOL','HYPE','XRP','DOGE'];
    const rows=preferred.filter((symbol)=>payload?.[symbol]!=null).map((symbol)=>({symbol,mid:finiteOrNull(payload[symbol])}));
    return success('hyperliquid','Hyperliquid',rows,{
      observedAt:nowIso(),
      attribution:'Hyperliquid public API',
      docsUrl:'https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint',
      rateLimit:'documented REST aggregate 1200 weight/minute per IP; allMids weight 2',
      usage:'public documented read endpoint; Qelly does not send exchange/trading actions'
    });
  }catch(error){
    return unavailable('hyperliquid','Hyperliquid',{attribution:'Hyperliquid public API',reason:error.message,docsUrl:'https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint'});
  }
}

async function worldBankMacro(){
  try{
    const countries='IND;USA;CHN;ARE;JPN;GBR;HKG';
    const url=`https://api.worldbank.org/v2/country/${countries}/indicator/NY.GDP.MKTP.KD.ZG?format=json&mrnev=1&per_page=100`;
    const payload=await fetchJson(url);
    const records=Array.isArray(payload)&&Array.isArray(payload[1])?payload[1]:[];
    const rows=records.map((row)=>({countryId:String(row.countryiso3code??''),country:String(row.country?.value??''),year:String(row.date??''),gdpGrowthPct:finiteOrNull(row.value)})).filter((row)=>row.countryId&&row.gdpGrowthPct!=null);
    return success('world-bank','World Bank',rows,{
      state:'reference_external',
      observedAt:null,
      attribution:'World Bank Indicators API',
      docsUrl:'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392',
      usage:'open Indicators API; annual macro reference data, not real-time market data',
      cadence:'latest non-empty annual GDP growth observation'
    });
  }catch(error){
    return unavailable('world-bank','World Bank',{attribution:'World Bank Indicators API',reason:error.message,docsUrl:'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392'});
  }
}

async function imfGrowthReference(){
  try{
    const countryNames={IND:'India',USA:'United States',CHN:'China',GBR:'United Kingdom',JPN:'Japan',ARE:'United Arab Emirates'};
    const url='https://www.imf.org/external/datamapper/api/v1/NGDP_RPCH/IND/USA/CHN/GBR/JPN/ARE';
    const payload=await fetchJson(url,{headers:{'User-Agent':'Qelly-Intelligence/1.0 (+https://qelly-intelligence.pages.dev/)'}});
    const values=payload?.values?.NGDP_RPCH??{};
    const currentYear=new Date().getUTCFullYear();
    const rows=Object.entries(countryNames).map(([countryId,country])=>{
      const periods=values?.[countryId]??{};
      const years=Object.keys(periods).filter((year)=>Number(year)<=currentYear&&finiteOrNull(periods[year])!=null).sort((a,b)=>Number(b)-Number(a));
      const year=years[0]??null;
      return {countryId,country,year,growthPct:year?finiteOrNull(periods[year]):null,estimateOrProjection:year?Number(year)>=currentYear:false};
    }).filter((row)=>row.year&&row.growthPct!=null);
    if(!rows.length)return unavailable('imf','IMF DataMapper',{attribution:'International Monetary Fund, World Economic Outlook',docsUrl:'https://www.imf.org/external/datamapper/api/help'});
    const latestYear=rows.map((row)=>Number(row.year)).sort((a,b)=>b-a)[0];
    return success('imf','IMF DataMapper',rows,{
      state:'reference_external',
      observedAt:null,
      attribution:'International Monetary Fund, World Economic Outlook',
      docsUrl:'https://www.imf.org/external/datamapper/api/help',
      usage:'official statistical reference data with attribution; estimates and projections are labelled and are not live market observations',
      cadence:`latest published WEO real-GDP-growth observation through ${latestYear}`
    });
  }catch(error){
    return unavailable('imf','IMF DataMapper',{attribution:'International Monetary Fund, World Economic Outlook',reason:error.message,docsUrl:'https://www.imf.org/external/datamapper/api/help'});
  }
}

export async function buildExternalMarketNetwork(context={}){
  const results=await Promise.all([
    cachedSource(context,'alternative-me',SOURCE_CACHE_TTL['alternative-me'],alternativeCrypto),
    cachedSource(context,'hyperliquid',SOURCE_CACHE_TTL.hyperliquid,hyperliquidMids),
    cachedSource(context,'world-bank',SOURCE_CACHE_TTL['world-bank'],worldBankMacro),
    cachedSource(context,'imf',SOURCE_CACHE_TTL.imf,imfGrowthReference)
  ]);
  return {
    generatedAt:nowIso(),
    sources:Object.fromEntries(results.map((item)=>[item.id,item])),
    providerDirectory:providerDirectory(),
    providerDirectorySummary:providerDirectorySummary(),
    policy:{
      fabricatedFallback:false,
      execution:false,
      custody:false,
      sourceFailuresRemainUnavailable:true,
      responseCacheSeconds:10,
      staleWhileRevalidateSeconds:30,
      sourceCacheSeconds:{...SOURCE_CACHE_TTL},
      edgeCacheScope:'cloudflare_point_of_presence'
    },
    researchLinks:[
      {id:'tradingview',label:'TradingView',url:'https://www.tradingview.com/',mode:'display_or_outbound',category:'market-research',note:'External research/display boundary; widget values are not silently reused as Qelly analytical inputs.'},
      {id:'forex-factory',label:'Forex Factory',url:'https://www.forexfactory.com/calendar',mode:'outbound',category:'market-research',note:'External macro calendar research link.'},
      {id:'cme',label:'CME Group Markets',url:'https://www.cmegroup.com/markets.html',mode:'outbound',category:'official-data',note:'Official derivatives, rates, FX, commodities and crypto futures research destination.'},
      {id:'fred',label:'FRED Economic Data',url:'https://fred.stlouisfed.org/',mode:'outbound',category:'official-data',note:'Federal Reserve Bank of St. Louis macroeconomic research destination.'},
      {id:'sec-edgar',label:'SEC EDGAR',url:'https://www.sec.gov/search-filings',mode:'outbound',category:'official-data',note:'Official US company filing search and disclosure research.'},
      {id:'rbi-data',label:'RBI Data / DBIE',url:'https://data.rbi.org.in/',mode:'outbound',category:'official-data',note:'Reserve Bank of India official statistics and Database on Indian Economy research destination.'},
      {id:'nse-market-data',label:'NSE India Market Data',url:'https://www.nseindia.com/market-data',mode:'outbound',category:'official-data',note:'National Stock Exchange of India official market-data research destination.'},
      {id:'imf-data',label:'IMF Data',url:'https://data.imf.org/en/',mode:'outbound',category:'official-data',note:'International Monetary Fund macroeconomic and financial statistics research destination.'},
      {id:'coinmarketcap',label:'CoinMarketCap',url:'https://coinmarketcap.com/',mode:'outbound',category:'crypto-research',note:'Keyless API is documented for evaluation/prototyping; Qelly does not rely on it as an unrestricted production redistribution feed.'},
      {id:'coinpaprika',label:'CoinPaprika',url:'https://coinpaprika.com/',mode:'outbound',category:'crypto-research',note:'Free API plan is non-commercial under current terms; no production redistribution feed is enabled.'},
      {id:'defillama',label:'DefiLlama',url:'https://defillama.com/',mode:'outbound',category:'crypto-research',note:'Official research destination; Qelly does not republish restricted data without the applicable permission/plan.'},
      {id:'coinglass',label:'CoinGlass',url:'https://www.coinglass.com/',mode:'outbound',category:'crypto-research',note:'Official research link; no hidden scraping.'},
      {id:'hypurrscan',label:'Hypurrscan',url:'https://hypurrscan.io/',mode:'outbound',category:'crypto-research',note:'Hyperliquid explorer research link.'},
      {id:'x',label:'X / market community',url:'https://x.com/',mode:'outbound',category:'community',note:'Community research link; no timeline scraping or fake embed.'},
      {id:'ecb',label:'European Central Bank',url:'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html',mode:'outbound',category:'official-data',note:'Official reference-rate source.'},
      {id:'world-bank',label:'World Bank Data',url:'https://data.worldbank.org/',mode:'outbound',category:'official-data',note:'Official macro reference research.'}
    ]
  };
}

export const __test=Object.freeze({finiteOrNull,normalizedTruthState,sourceUsable,buildNetworkDiagnostics,buildDiscoveryOverview,sourceTruthState,withDelivery,edgeCacheRequest,cachedSource,alternativeCrypto,hyperliquidMids,worldBankMacro,imfGrowthReference,SOURCE_CACHE_TTL});
