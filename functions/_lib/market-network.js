const REQUEST_TIMEOUT_MS=7000;

const nowIso=()=>new Date().toISOString();
const finiteOrNull=(value)=>Number.isFinite(Number(value))?Number(value):null;

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

const unavailable=(id,label,extra={})=>({id,label,state:'unavailable',observedAt:null,fetchedAt:nowIso(),data:null,...extra});
const success=(id,label,data,{state='live_external_reference',...extra}={})=>({id,label,state,observedAt:extra.observedAt??null,fetchedAt:nowIso(),data,...extra});

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

export async function buildExternalMarketNetwork(){
  const results=await Promise.all([alternativeCrypto(),hyperliquidMids(),worldBankMacro()]);
  return {
    generatedAt:nowIso(),
    sources:Object.fromEntries(results.map((item)=>[item.id,item])),
    policy:{
      fabricatedFallback:false,
      execution:false,
      custody:false,
      sourceFailuresRemainUnavailable:true,
      cacheSeconds:90,
      staleWhileRevalidateSeconds:900
    },
    researchLinks:[
      {id:'tradingview',label:'TradingView',url:'https://www.tradingview.com/',mode:'display_or_outbound',note:'External research/display boundary; widget values are not silently reused as Qelly analytical inputs.'},
      {id:'coinmarketcap',label:'CoinMarketCap',url:'https://coinmarketcap.com/',mode:'outbound',note:'Keyless API is documented for evaluation/prototyping; Qelly does not rely on it as an unrestricted production redistribution feed.'},
      {id:'coinpaprika',label:'CoinPaprika',url:'https://coinpaprika.com/',mode:'outbound',note:'Free API plan is non-commercial under current terms; no production redistribution feed is enabled.'},
      {id:'defillama',label:'DefiLlama',url:'https://defillama.com/',mode:'outbound',note:'Official research destination; Qelly does not republish restricted data without the applicable permission/plan.'},
      {id:'coinglass',label:'CoinGlass',url:'https://www.coinglass.com/',mode:'outbound',note:'Official research link; no hidden scraping.'},
      {id:'hypurrscan',label:'Hypurrscan',url:'https://hypurrscan.io/',mode:'outbound',note:'Hyperliquid explorer research link.'},
      {id:'x',label:'X / market community',url:'https://x.com/',mode:'outbound',note:'Community research link; no timeline scraping or fake embed.'},
      {id:'forex-factory',label:'Forex Factory',url:'https://www.forexfactory.com/calendar',mode:'outbound',note:'External macro calendar research link.'},
      {id:'ecb',label:'European Central Bank',url:'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html',mode:'outbound',note:'Official reference-rate source.'},
      {id:'world-bank',label:'World Bank Data',url:'https://data.worldbank.org/',mode:'outbound',note:'Official macro reference research.'}
    ]
  };
}

export const __test=Object.freeze({finiteOrNull,alternativeCrypto,hyperliquidMids,worldBankMacro});
