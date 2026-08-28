import {providerDirectory,providerDirectorySummary} from './provider-directory.js';

const REQUEST_TIMEOUT_MS=7000;
const SOURCE_CACHE_TTL=Object.freeze({hyperliquid:8,'alternative-me':60,'world-bank':3600,'us-treasury':21600,imf:21600});

const nowIso=()=>new Date().toISOString();
const finiteOrNull=(value)=>Number.isFinite(Number(value))?Number(value):null;

async function fetchJson(url,{method='GET',body=null,headers={},timeoutMs=REQUEST_TIMEOUT_MS}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
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

async function usTreasuryRates(){
  try{
    const url='https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates?fields=record_date,security_type_desc,security_desc,avg_interest_rate_amt&sort=-record_date&page%5Bsize%5D=25';
    const payload=await fetchJson(url,{headers:{'User-Agent':'Qelly-Intelligence/1.0 (+https://qelly-intelligence.pages.dev/)'},timeoutMs:12000});
    const records=Array.isArray(payload?.data)?payload.data:[];
    const latestDate=records.find((row)=>row?.record_date)?.record_date??null;
    const rows=records.filter((row)=>row?.record_date===latestDate).map((row)=>({
      securityType:String(row.security_type_desc??''),
      security:String(row.security_desc??''),
      averageInterestRatePct:finiteOrNull(row.avg_interest_rate_amt),
      recordDate:String(row.record_date??'')
    })).filter((row)=>row.security&&row.averageInterestRatePct!=null).slice(0,12);
    if(!rows.length)return unavailable('us-treasury','US Treasury Fiscal Data',{attribution:'U.S. Department of the Treasury, Fiscal Data',docsUrl:'https://fiscaldata.treasury.gov/api-documentation/'});
    return success('us-treasury','US Treasury Fiscal Data',rows,{
      state:'reference_external',
      observedAt:latestDate?`${latestDate}T00:00:00.000Z`:null,
      attribution:'U.S. Department of the Treasury, Fiscal Data',
      docsUrl:'https://fiscaldata.treasury.gov/api-documentation/',
      usage:'official open-data API; monthly average interest-rate reference observations, not tradable yields',
      cadence:'monthly average interest rates on U.S. Treasury securities'
    });
  }catch(error){
    return unavailable('us-treasury','US Treasury Fiscal Data',{attribution:'U.S. Department of the Treasury, Fiscal Data',reason:error.message,docsUrl:'https://fiscaldata.treasury.gov/api-documentation/'});
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
    cachedSource(context,'us-treasury',SOURCE_CACHE_TTL['us-treasury'],usTreasuryRates),
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
      {id:'tradingview',label:'TradingView',url:'https://www.tradingview.com/',mode:'display_or_outbound',note:'External research/display boundary; widget values are not silently reused as Qelly analytical inputs.'},
      {id:'forex-factory',label:'Forex Factory',url:'https://www.forexfactory.com/calendar',mode:'outbound',note:'External macro calendar research link.'},
      {id:'cme',label:'CME Group Markets',url:'https://www.cmegroup.com/markets.html',mode:'outbound',note:'Official derivatives, rates, FX, commodities and crypto futures research destination.'},
      {id:'fred',label:'FRED Economic Data',url:'https://fred.stlouisfed.org/',mode:'outbound',note:'Federal Reserve Bank of St. Louis macroeconomic research destination.'},
      {id:'sec-edgar',label:'SEC EDGAR',url:'https://www.sec.gov/search-filings',mode:'outbound',note:'Official US company filing search and disclosure research.'},
      {id:'rbi-data',label:'RBI Data / DBIE',url:'https://data.rbi.org.in/',mode:'outbound',note:'Reserve Bank of India official statistics and Database on Indian Economy research destination.'},
      {id:'nse-market-data',label:'NSE India Market Data',url:'https://www.nseindia.com/market-data',mode:'outbound',note:'National Stock Exchange of India official market-data research destination.'},
      {id:'imf-data',label:'IMF Data',url:'https://data.imf.org/en/',mode:'outbound',note:'International Monetary Fund macroeconomic and financial statistics research destination.'},
      {id:'coinmarketcap',label:'CoinMarketCap',url:'https://coinmarketcap.com/',mode:'outbound',note:'Keyless API is documented for evaluation/prototyping; Qelly does not rely on it as an unrestricted production redistribution feed.'},
      {id:'coinpaprika',label:'CoinPaprika',url:'https://coinpaprika.com/',mode:'outbound',note:'Free API plan is non-commercial under current terms; no production redistribution feed is enabled.'},
      {id:'defillama',label:'DefiLlama',url:'https://defillama.com/',mode:'outbound',note:'Official research destination; Qelly does not republish restricted data without the applicable permission/plan.'},
      {id:'coinglass',label:'CoinGlass',url:'https://www.coinglass.com/',mode:'outbound',note:'Official research link; no hidden scraping.'},
      {id:'hypurrscan',label:'Hypurrscan',url:'https://hypurrscan.io/',mode:'outbound',note:'Hyperliquid explorer research link.'},
      {id:'x',label:'X / market community',url:'https://x.com/',mode:'outbound',note:'Community research link; no timeline scraping or fake embed.'},
      {id:'ecb',label:'European Central Bank',url:'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html',mode:'outbound',note:'Official reference-rate source.'},
      {id:'world-bank',label:'World Bank Data',url:'https://data.worldbank.org/',mode:'outbound',note:'Official macro reference research.'}
    ]
  };
}

export const __test=Object.freeze({finiteOrNull,sourceTruthState,withDelivery,edgeCacheRequest,cachedSource,alternativeCrypto,hyperliquidMids,worldBankMacro,usTreasuryRates,imfGrowthReference,SOURCE_CACHE_TTL});
