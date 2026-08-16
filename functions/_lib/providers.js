import {HttpError,fetcher} from './runtime.js';

const SAFE_SYMBOL=/^[A-Z0-9-]{3,30}$/;
const BINANCE_INTERVALS=new Set(['1m','5m','15m','30m','1h','4h','1d']);
const COINBASE_GRANULARITY=new Map([['1m',60],['5m',300],['15m',900],['1h',3600],['6h',21600],['1d',86400]]);
const PROVIDER_POLICY=Object.freeze({
  binance:Object.freeze({
    id:'binance',
    enabled:false,
    capabilities:Object.freeze(['quote','candles']),
    termsState:'blocked_pending_redistribution_rights',
    reason:'provider_redistribution_rights_not_verified',
    termsUrl:'https://developers.binance.com/en/docs/introduction'
  }),
  coinbase:Object.freeze({
    id:'coinbase',
    enabled:false,
    capabilities:Object.freeze(['quote','candles']),
    termsState:'blocked_pending_written_end_user_display_permission',
    reason:'provider_end_user_display_rights_not_verified',
    termsUrl:'https://www.coinbase.com/en-in/legal/market_data'
  }),
  ecb:Object.freeze({
    id:'ecb',
    enabled:true,
    capabilities:Object.freeze(['fx-reference-rates']),
    termsState:'conditionally_approved_attributed_reference_data',
    reason:null,
    termsUrl:'https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html'
  })
});

const number=(value,name)=>{
  const parsed=Number(value);
  if(!Number.isFinite(parsed))throw new HttpError(503,'provider_schema_invalid',`Provider returned invalid ${name}`);
  return parsed;
};

const providerTimeout=(error)=>{
  if(error?.name==='AbortError')throw new HttpError(503,'provider_timeout','Provider request timed out',{retryable:true});
  throw error;
};

const fetchJson=async(env,url,{headers={},timeoutMs=6000}={})=>{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetcher(env)(url,{headers:{Accept:'application/json',...headers},signal:controller.signal});
    if(!response.ok)throw new HttpError(response.status===429?429:503,`provider_http_${response.status}`,`Provider request failed (${response.status})`,{retryable:true});
    if(!(response.headers.get('content-type')||'').toLowerCase().includes('json'))throw new HttpError(503,'provider_content_type_invalid','Provider content type is invalid');
    const text=await response.text();
    if(text.length>2_000_000)throw new HttpError(503,'provider_response_too_large','Provider response is too large');
    try{return JSON.parse(text);}catch{throw new HttpError(503,'provider_schema_invalid','Provider returned malformed JSON');}
  }catch(error){providerTimeout(error);}finally{clearTimeout(timeout);}
};

const fetchText=async(env,url,{timeoutMs=6000}={})=>{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetcher(env)(url,{headers:{Accept:'application/xml,text/xml'},signal:controller.signal});
    if(!response.ok)throw new HttpError(503,`provider_http_${response.status}`,`Provider request failed (${response.status})`,{retryable:true});
    const contentType=(response.headers.get('content-type')||'').toLowerCase();
    if(contentType&&!contentType.includes('xml'))throw new HttpError(503,'provider_content_type_invalid','Provider content type is invalid');
    const text=await response.text();
    if(text.length>2_000_000)throw new HttpError(503,'provider_response_too_large','Provider response is too large');
    return text;
  }catch(error){providerTimeout(error);}finally{clearTimeout(timeout);}
};

const live=async(env,provider,capability,source,params={})=>{
  const ingestionTime=new Date().toISOString();
  if(provider==='binance'){
    const symbol=String(source||'BTCUSDT').toUpperCase().replaceAll('-','');
    if(!SAFE_SYMBOL.test(symbol))throw new HttpError(400,'invalid_provider_symbol','Invalid Binance symbol');
    if(capability==='quote'){
      const data=await fetchJson(env,`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`);
      return {provider:'binance-spot-public',sourceIdentifier:symbol,truthState:'live_provider',observationTime:new Date(number(data.closeTime,'close time')).toISOString(),ingestionTime,freshness:'near-real-time',quality:'official-public-endpoint',confidence:.98,attribution:'Binance Spot public market data',license:'Binance terms and written redistribution approval required',data:{symbol,price:number(data.lastPrice,'price'),open:number(data.openPrice,'open'),high:number(data.highPrice,'high'),low:number(data.lowPrice,'low'),volume:number(data.volume,'volume'),quoteVolume:number(data.quoteVolume,'quote volume')}};
    }
    const interval=String(params.interval||'1h');
    if(!BINANCE_INTERVALS.has(interval))throw new HttpError(400,'invalid_provider_interval','Invalid Binance interval');
    const limit=Math.min(Math.max(Number(params.limit)||168,1),1000);
    const rows=await fetchJson(env,`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`);
    const candles=rows.map(row=>({time:new Date(number(row[0],'open time')).toISOString(),open:number(row[1],'open'),high:number(row[2],'high'),low:number(row[3],'low'),close:number(row[4],'close'),volume:number(row[5],'volume')}));
    return {provider:'binance-spot-public',sourceIdentifier:symbol,truthState:'live_provider',observationTime:candles.at(-1)?.time||ingestionTime,ingestionTime,freshness:'near-real-time',quality:'official-public-endpoint',confidence:.98,attribution:'Binance Spot public market data',license:'Binance terms and written redistribution approval required',data:{symbol,interval,candles}};
  }
  if(provider==='coinbase'){
    const product=String(source||'BTC-USD').toUpperCase();
    if(!SAFE_SYMBOL.test(product))throw new HttpError(400,'invalid_provider_symbol','Invalid Coinbase product');
    const headers={'User-Agent':'Qelly-Public-Beta/1.0'};
    if(capability==='quote'){
      const data=await fetchJson(env,`https://api.exchange.coinbase.com/products/${encodeURIComponent(product)}/ticker`,{headers});
      return {provider:'coinbase-exchange-public',sourceIdentifier:product,truthState:'live_provider',observationTime:new Date(data.time).toISOString(),ingestionTime,freshness:'near-real-time',quality:'official-public-endpoint',confidence:.98,attribution:'Coinbase Exchange public market data',license:'Written Coinbase permission required for Qelly end-user display',data:{product,price:number(data.price,'price'),bid:number(data.bid,'bid'),ask:number(data.ask,'ask'),volume:number(data.volume,'volume')}};
    }
    const interval=String(params.interval||'1h');
    if(!COINBASE_GRANULARITY.has(interval))throw new HttpError(400,'invalid_provider_interval','Invalid Coinbase interval');
    const granularity=COINBASE_GRANULARITY.get(interval);
    const limit=Math.min(Math.max(Number(params.limit)||168,1),300);
    const end=new Date(params.end||Date.now());
    const start=new Date(params.start||end.getTime()-granularity*1000*limit);
    const query=new URLSearchParams({granularity:String(granularity),start:start.toISOString(),end:end.toISOString()});
    const rows=await fetchJson(env,`https://api.exchange.coinbase.com/products/${encodeURIComponent(product)}/candles?${query}`,{headers});
    const candles=rows.map(row=>({time:new Date(number(row[0],'time')*1000).toISOString(),low:number(row[1],'low'),high:number(row[2],'high'),open:number(row[3],'open'),close:number(row[4],'close'),volume:number(row[5],'volume')})).sort((a,b)=>a.time.localeCompare(b.time));
    return {provider:'coinbase-exchange-public',sourceIdentifier:product,truthState:'live_provider',observationTime:candles.at(-1)?.time||ingestionTime,ingestionTime,freshness:'near-real-time',quality:'official-public-endpoint-may-have-gaps',confidence:.96,attribution:'Coinbase Exchange public market data',license:'Written Coinbase permission required for Qelly end-user display',data:{product,interval,candles}};
  }
  if(provider==='ecb'){
    const xml=await fetchText(env,'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml');
    const date=xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];
    if(!date)throw new HttpError(503,'provider_schema_invalid','ECB observation date is missing');
    const rates={EUR:1};
    for(const match of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g))rates[match[1]]=number(match[2],match[1]);
    if(Object.keys(rates).length<5)throw new HttpError(503,'provider_schema_invalid','ECB rate set is incomplete');
    return {provider:'ecb-reference-rates',sourceIdentifier:'EUR',truthState:'delayed_provider',observationTime:`${date}T16:00:00.000Z`,ingestionTime,freshness:'daily-working-day-reference',quality:'official-central-bank-reference',confidence:.99,attribution:'European Central Bank euro foreign exchange reference rates',license:'ECB/ESCB reuse conditions apply; source attribution and modification disclosure required',data:{base:'EUR',date,rates}};
  }
  throw new HttpError(404,'provider_not_found','Provider is not supported');
};

const normalizedCacheParams=(provider,capability,params={})=>{
  const allowed=capability==='candles'?['interval','limit','start','end']:[];
  return Object.fromEntries(allowed.filter(key=>params[key]!=null&&params[key]!=='').sort().map(key=>[key,String(params[key])]))
};

const cacheRequest=(provider,capability,source,params)=>new Request(`https://qelly-provider-cache.invalid/${provider}/${capability}/${encodeURIComponent(source||'default')}?${new URLSearchParams(normalizedCacheParams(provider,capability,params))}`);

const blockedProviderResult=(provider,source,policy)=>({
  provider,
  sourceIdentifier:source,
  truthState:'unavailable',
  observationTime:null,
  ingestionTime:new Date().toISOString(),
  freshness:'unavailable',
  quality:'unavailable',
  confidence:0,
  attribution:null,
  license:null,
  fallbackReason:policy.reason,
  termsState:policy.termsState,
  termsUrl:policy.termsUrl,
  cache:{hit:false,stale:false},
  data:null
});

export async function providerResult(context,provider,capability,source,params={}){
  const policy=PROVIDER_POLICY[provider];
  if(!policy)throw new HttpError(404,'provider_not_found','Provider is not supported');
  if(!policy.capabilities.includes(capability))throw new HttpError(400,'provider_capability_invalid','Provider capability is not supported');
  if(!policy.enabled)return blockedProviderResult(provider,source,policy);

  const ttl=provider==='ecb'?3600:10;
  const stale=provider==='ecb'?172800:120;
  const key=cacheRequest(provider,capability,source,params);
  const cache=globalThis.caches?.default;
  const cachedResponse=cache?await cache.match(key):null;
  const cached=cachedResponse?await cachedResponse.json().catch(()=>null):null;
  const now=Date.now();
  if(cached&&new Date(cached.freshUntil).getTime()>now)return {...cached.payload,truthState:'cached_provider',cache:{hit:true,stale:false,cachedAt:cached.cachedAt}};
  try{
    const payload=await live(context.env,provider,capability,source,params);
    const envelope={payload,cachedAt:new Date().toISOString(),freshUntil:new Date(now+ttl*1000).toISOString(),staleUntil:new Date(now+stale*1000).toISOString()};
    if(cache){
      const put=cache.put(key,new Response(JSON.stringify(envelope),{headers:{'Content-Type':'application/json','Cache-Control':`public, max-age=${stale}`}}));
      context.waitUntil?.(put);
    }
    return {...payload,cache:{hit:false,stale:false}};
  }catch(error){
    if(cached&&new Date(cached.staleUntil).getTime()>now)return {...cached.payload,truthState:'stale_provider',freshness:'stale',quality:'degraded',confidence:Math.min(Number(cached.payload.confidence)||.7,.7),fallbackReason:'provider_request_failed_using_stale_cache',cache:{hit:true,stale:true,cachedAt:cached.cachedAt}};
    return {provider,sourceIdentifier:source,truthState:'unavailable',observationTime:null,ingestionTime:new Date().toISOString(),freshness:'unavailable',quality:'unavailable',confidence:0,attribution:null,license:null,fallbackReason:error?.code||'provider_request_failed',cache:{hit:false,stale:false},data:null};
  }
}

export const providerCatalog=()=>Object.values(PROVIDER_POLICY).map(policy=>({
  id:policy.id,
  enabled:policy.enabled,
  capabilities:[...policy.capabilities],
  termsState:policy.termsState,
  reason:policy.reason,
  termsUrl:policy.termsUrl
}));

export const __providerTest=Object.freeze({normalizedCacheParams});
