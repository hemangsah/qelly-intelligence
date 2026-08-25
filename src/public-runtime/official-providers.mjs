const SAFE_SYMBOL=/^[A-Z0-9-]{3,30}$/;
const SAFE_INTERVALS=new Set(['1m','5m','15m','30m','1h','4h','1d']);
const COINBASE_GRANULARITY=new Map([['1m',60],['5m',300],['15m',900],['1h',3600],['4h',21600],['1d',86400]]);

async function fetchJson(fetchImpl,url,{timeoutMs=5000,headers={}}={}){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetchImpl(url,{headers:{Accept:'application/json',...headers},signal:controller.signal});
    if(!response.ok)throw Object.assign(new Error(`provider_http_${response.status}`),{status:response.status});
    return await response.json();
  }finally{clearTimeout(timeout);}
}
async function fetchText(fetchImpl,url,{timeoutMs=5000}={}){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{const response=await fetchImpl(url,{headers:{Accept:'application/xml,text/xml'},signal:controller.signal});if(!response.ok)throw new Error(`provider_http_${response.status}`);return await response.text();}finally{clearTimeout(timeout);}
}
function symbol(value){const normalized=String(value||'').toUpperCase();if(!SAFE_SYMBOL.test(normalized))throw new Error('invalid_provider_symbol');return normalized;}
function interval(value){const normalized=String(value||'1h');if(!SAFE_INTERVALS.has(normalized))throw new Error('invalid_provider_interval');return normalized;}
function numeric(value,name){const number=Number(value);if(!Number.isFinite(number))throw new Error(`invalid_${name}`);return number;}

export function createBinancePublicProvider({fetchImpl=globalThis.fetch,baseUrl='https://api.binance.com'}={}){
  return {
    id:'binance-spot-public',
    termsState:'approved_public_read_only',
    capabilities:['quote','candles'],
    attribution:'Binance Spot public market data',
    license:'Binance API terms apply; public market data only',
    ttlMs:10_000,
    staleTtlMs:120_000,
    async fetch({capability,sourceIdentifier,params={}}){
      const pair=symbol(sourceIdentifier).replaceAll('-','');
      if(capability==='quote'){
        const data=await fetchJson(fetchImpl,`${baseUrl}/api/v3/ticker/24hr?symbol=${encodeURIComponent(pair)}`);
        return {truthState:'live_provider',observationTime:new Date(numeric(data.closeTime,'close_time')).toISOString(),freshness:'near-real-time',quality:'official-public-endpoint',confidence:.98,data:{symbol:pair,price:numeric(data.lastPrice,'price'),open:numeric(data.openPrice,'open'),high:numeric(data.highPrice,'high'),low:numeric(data.lowPrice,'low'),volume:numeric(data.volume,'volume'),quoteVolume:numeric(data.quoteVolume,'quote_volume')}};
      }
      if(capability==='candles'){
        const frame=interval(params.interval),limit=Math.min(Math.max(Number(params.limit)||168,1),1000);
        const rows=await fetchJson(fetchImpl,`${baseUrl}/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${frame}&limit=${limit}`);
        const candles=rows.map((row)=>({time:new Date(numeric(row[0],'open_time')).toISOString(),open:numeric(row[1],'open'),high:numeric(row[2],'high'),low:numeric(row[3],'low'),close:numeric(row[4],'close'),volume:numeric(row[5],'volume')}));
        return {truthState:'live_provider',observationTime:candles.at(-1)?.time||new Date().toISOString(),freshness:'near-real-time',quality:'official-public-endpoint',confidence:.98,data:{symbol:pair,interval:frame,candles}};
      }
      throw new Error('unsupported_capability');
    }
  };
}

export function createCoinbaseExchangePublicProvider({fetchImpl=globalThis.fetch,baseUrl='https://api.exchange.coinbase.com'}={}){
  return {
    id:'coinbase-exchange-public',
    termsState:'approved_public_read_only',
    capabilities:['quote','candles'],
    attribution:'Coinbase Exchange public market data',
    license:'Coinbase Exchange Market Data Terms of Use apply',
    ttlMs:10_000,
    staleTtlMs:120_000,
    async fetch({capability,sourceIdentifier,params={}}){
      const product=symbol(sourceIdentifier);
      if(capability==='quote'){
        const data=await fetchJson(fetchImpl,`${baseUrl}/products/${encodeURIComponent(product)}/ticker`,{headers:{'User-Agent':'Qelly-Public-Beta/1.0'}});
        return {truthState:'live_provider',observationTime:new Date(data.time).toISOString(),freshness:'near-real-time',quality:'official-public-endpoint',confidence:.98,data:{product,price:numeric(data.price,'price'),bid:numeric(data.bid,'bid'),ask:numeric(data.ask,'ask'),volume:numeric(data.volume,'volume')}};
      }
      if(capability==='candles'){
        const frame=interval(params.interval),granularity=COINBASE_GRANULARITY.get(frame),limit=Math.min(Math.max(Number(params.limit)||168,1),300),end=new Date(params.end||Date.now()),start=new Date(params.start||end.getTime()-granularity*1000*limit);
        const query=new URLSearchParams({granularity:String(granularity),start:start.toISOString(),end:end.toISOString()});
        const rows=await fetchJson(fetchImpl,`${baseUrl}/products/${encodeURIComponent(product)}/candles?${query}`,{headers:{'User-Agent':'Qelly-Public-Beta/1.0'}});
        const candles=rows.map((row)=>({time:new Date(numeric(row[0],'time')*1000).toISOString(),low:numeric(row[1],'low'),high:numeric(row[2],'high'),open:numeric(row[3],'open'),close:numeric(row[4],'close'),volume:numeric(row[5],'volume')})).sort((a,b)=>a.time.localeCompare(b.time));
        return {truthState:'live_provider',observationTime:candles.at(-1)?.time||end.toISOString(),freshness:'near-real-time',quality:'official-public-endpoint-may-have-gaps',confidence:.96,data:{product,interval:frame,candles}};
      }
      throw new Error('unsupported_capability');
    }
  };
}

export function createEcbReferenceRateProvider({fetchImpl=globalThis.fetch,url='https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'}={}){
  return {
    id:'ecb-reference-rates',
    termsState:'approved_public_read_only',
    capabilities:['fx-reference-rates'],
    attribution:'European Central Bank euro foreign exchange reference rates',
    license:'Published for information purposes; transaction use is discouraged by the ECB',
    ttlMs:3_600_000,
    staleTtlMs:172_800_000,
    async fetch({capability}){
      if(capability!=='fx-reference-rates')throw new Error('unsupported_capability');
      const xml=await fetchText(fetchImpl,url,{timeoutMs:8000});
      const date=xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];if(!date)throw new Error('ecb_observation_time_missing');
      const rates={EUR:1};for(const match of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g))rates[match[1]]=numeric(match[2],match[1].toLowerCase());
      if(Object.keys(rates).length<5)throw new Error('ecb_rate_set_incomplete');
      return {truthState:'delayed_provider',observationTime:`${date}T16:00:00.000Z`,freshness:'daily-working-day-reference',quality:'official-central-bank-reference',confidence:.99,data:{base:'EUR',date,rates}};
    }
  };
}

export function officialProviderRegistry(options={}){return [createBinancePublicProvider(options.binance),createCoinbaseExchangePublicProvider(options.coinbase),createEcbReferenceRateProvider(options.ecb)];}
