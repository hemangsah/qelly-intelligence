import crypto from 'node:crypto';

const ASSETS = Object.freeze([
  { canonicalId:'QI-CRYPTO-BTC', symbol:'BTC', providerSymbol:'BTCUSDT', name:'Bitcoin', assetClass:'crypto', currency:'USD', category:'Layer 1' },
  { canonicalId:'QI-CRYPTO-ETH', symbol:'ETH', providerSymbol:'ETHUSDT', name:'Ethereum', assetClass:'crypto', currency:'USD', category:'Smart-contract platforms' },
  { canonicalId:'QI-CRYPTO-BNB', symbol:'BNB', providerSymbol:'BNBUSDT', name:'BNB', assetClass:'crypto', currency:'USD', category:'Exchange ecosystems' },
  { canonicalId:'QI-CRYPTO-SOL', symbol:'SOL', providerSymbol:'SOLUSDT', name:'Solana', assetClass:'crypto', currency:'USD', category:'Smart-contract platforms' },
  { canonicalId:'QI-CRYPTO-XRP', symbol:'XRP', providerSymbol:'XRPUSDT', name:'XRP', assetClass:'crypto', currency:'USD', category:'Payments' },
  { canonicalId:'QI-CRYPTO-ADA', symbol:'ADA', providerSymbol:'ADAUSDT', name:'Cardano', assetClass:'crypto', currency:'USD', category:'Smart-contract platforms' }
]);

const FIXTURE = Object.freeze({
  BTCUSDT:{lastPrice:78000,priceChangePercent:1.42,highPrice:79120,lowPrice:76210,openPrice:76910,volume:18450,quoteVolume:1438000000},
  ETHUSDT:{lastPrice:4100,priceChangePercent:.86,highPrice:4168,lowPrice:4010,openPrice:4065,volume:282000,quoteVolume:1154000000},
  BNBUSDT:{lastPrice:760,priceChangePercent:-.31,highPrice:772,lowPrice:748,openPrice:762.4,volume:433000,quoteVolume:329000000},
  SOLUSDT:{lastPrice:210,priceChangePercent:2.18,highPrice:216,lowPrice:203,openPrice:205.5,volume:4920000,quoteVolume:1030000000},
  XRPUSDT:{lastPrice:3.2,priceChangePercent:-1.12,highPrice:3.28,lowPrice:3.12,openPrice:3.236,volume:218000000,quoteVolume:697000000},
  ADAUSDT:{lastPrice:1.1,priceChangePercent:.45,highPrice:1.13,lowPrice:1.06,openPrice:1.095,volume:387000000,quoteVolume:425000000}
});

function finite(value){const number=Number(value);return Number.isFinite(number)?number:null;}
function clamp(value,min,max){return Math.max(min,Math.min(max,Number(value)));}
function normalizeQuery(value){return String(value??'').trim().toLowerCase();}

async function fetchJson(fetchImpl,url,{timeoutMs=6500}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetchImpl(url,{signal:controller.signal,headers:{Accept:'application/json','User-Agent':'Qelly-Intelligence/1.0'}});
    if(!response.ok)throw Object.assign(new Error(`Provider returned HTTP ${response.status}`),{code:'provider_http_error',status:response.status});
    return await response.json();
  }finally{clearTimeout(timer);}
}

function fixtureObservation(asset,now,reason='public provider disabled'){
  return normalizeBinanceTicker(asset,FIXTURE[asset.providerSymbol],{
    now,
    provider:'qelly-fixture',
    providerName:'Qelly deterministic market fixture',
    sourceUrl:null,
    qualityState:'simulated',
    freshness:'simulated',
    confidence:.72,
    degraded:true,
    fallbackReason:reason
  });
}

function normalizeBinanceTicker(asset,row,evidence){
  const observedAt=evidence.observedAt??evidence.now().toISOString();
  return {
    canonicalId:asset.canonicalId,
    symbol:asset.symbol,
    providerSymbol:asset.providerSymbol,
    name:asset.name,
    assetClass:asset.assetClass,
    category:asset.category,
    currency:asset.currency,
    price:finite(row.lastPrice),
    change24h:finite(row.priceChangePercent),
    open24h:finite(row.openPrice),
    high24h:finite(row.highPrice),
    low24h:finite(row.lowPrice),
    volume24h:finite(row.volume),
    quoteVolume24h:finite(row.quoteVolume),
    marketCap:null,
    marketCapDefinition:'Unavailable from the selected public exchange ticker; Qelly does not fabricate it.',
    source:{
      provider:evidence.provider,
      providerName:evidence.providerName,
      sourceUrl:evidence.sourceUrl,
      attribution:evidence.attribution??evidence.providerName,
      observationTime:observedAt,
      ingestionTime:evidence.now().toISOString(),
      freshness:evidence.freshness,
      qualityState:evidence.qualityState,
      confidence:evidence.confidence,
      cacheState:evidence.cacheState??'miss',
      degraded:Boolean(evidence.degraded),
      fallbackReason:evidence.fallbackReason??null,
      entitlement:'public-read'
    }
  };
}

export class PublicMarketService {
  constructor({
    enabled=process.env.QELLY_PUBLIC_MARKET_DATA_ENABLED==='true'||process.env.QELLY_LIVE_MARKET_ENABLED==='true',
    fetchImpl=globalThis.fetch,
    now=()=>new Date(),
    cacheTtlMs=Number(process.env.QELLY_PUBLIC_MARKET_CACHE_TTL_MS??15000),
    staleTtlMs=Number(process.env.QELLY_PUBLIC_MARKET_STALE_TTL_MS??300000)
  }={}){
    this.enabled=Boolean(enabled);
    this.fetchImpl=fetchImpl;
    this.now=now;
    this.cacheTtlMs=clamp(cacheTtlMs,1000,300000);
    this.staleTtlMs=clamp(staleTtlMs,this.cacheTtlMs,3600000);
    this.cache=new Map();
    this.health={provider:'binance-public',status:this.enabled?'unknown':'disabled',lastAttemptAt:null,lastSuccessAt:null,lastError:null};
  }

  catalog(){
    return {
      canonicalAssets:ASSETS,
      providers:[{
        providerId:'binance-public',
        name:'Binance Public Market Data',
        baseUrl:'https://data-api.binance.vision',
        authentication:'none for public market endpoints',
        capabilities:['ticker-24h','candles'],
        enabled:this.enabled,
        attributionRequired:true
      },{
        providerId:'coindcx-public',
        name:'CoinDCX Public Market Data',
        baseUrl:'https://public.coindcx.com',
        authentication:'none for documented public candles',
        capabilities:['candles'],
        enabled:this.enabled,
        attributionRequired:true
      },{
        providerId:'qelly-fixture',
        name:'Qelly deterministic fallback',
        capabilities:['ticker-24h','candles'],
        enabled:true,
        mode:'simulated'
      }],
      guardrails:{readOnly:true,accountData:false,trading:false,transfers:false,withdrawals:false,privateKeys:false,recoveryPhrases:false,scraping:false}
    };
  }

  status(){
    return {...this.health,enabled:this.enabled,cacheEntries:this.cache.size,checkedAt:this.now().toISOString(),truthBoundary:this.enabled?'Public provider calls are attempted with deterministic fallback and explicit degraded labels.':'Public provider calls are disabled; all market values are simulated and labelled.'};
  }

  async assets({q='',sort='rank',direction='asc',limit=100}={}){
    const observations=await Promise.all(ASSETS.map(asset=>this.#ticker(asset)));
    const query=normalizeQuery(q);
    let items=observations.filter(item=>!query||`${item.symbol} ${item.name} ${item.category} ${item.canonicalId}`.toLowerCase().includes(query));
    const key={price:'price',change:'change24h',volume:'quoteVolume24h',symbol:'symbol',rank:'canonicalId'}[sort]??'canonicalId';
    items.sort((a,b)=>{
      const av=a[key],bv=b[key];
      const result=typeof av==='number'&&typeof bv==='number'?av-bv:String(av??'').localeCompare(String(bv??''));
      return direction==='desc'?-result:result;
    });
    items=items.slice(0,clamp(limit,1,250));
    return this.#collection(items);
  }

  async overview(){
    const result=await this.assets({limit:ASSETS.length});
    const live=result.items.filter(item=>item.source.qualityState==='live-public').length;
    const totalQuoteVolume=result.items.reduce((sum,item)=>sum+(item.quoteVolume24h??0),0);
    const advancers=result.items.filter(item=>(item.change24h??0)>0).length;
    const declining=result.items.filter(item=>(item.change24h??0)<0).length;
    return {
      mode:live===result.items.length?'live-public':live?'mixed':'simulated-fallback',
      truthBoundary:live===result.items.length?'All displayed market rows came from documented public provider endpoints.':live?'Some rows use public provider data and others are explicitly degraded or simulated.':'Public provider data was unavailable or disabled; displayed values are explicitly simulated.',
      kpis:[
        {label:'Tracked assets',value:result.items.length,unit:'count',definition:'Canonical assets included in this launch view.'},
        {label:'Quoted 24h volume',value:totalQuoteVolume,unit:'USD',definition:'Sum of provider-reported quote volume for tracked USDT markets; not total global volume.'},
        {label:'Advancers',value:advancers,unit:'count',definition:'Tracked assets with positive provider-reported 24-hour change.'},
        {label:'Live observations',value:live,unit:'count',definition:'Rows currently sourced from a documented public endpoint.'}
      ],
      breadth:{advancers,decliners:declining,unchanged:result.items.length-advancers-declining},
      items:result.items,
      providerStatus:this.status(),
      generatedAt:this.now().toISOString(),
      correlationId:crypto.randomUUID()
    };
  }

  async asset(idOrSymbol){
    const asset=ASSETS.find(item=>[item.canonicalId,item.symbol,item.providerSymbol].some(value=>String(value).toLowerCase()===String(idOrSymbol).toLowerCase()));
    if(!asset)throw Object.assign(new Error('Canonical public-market asset not found'),{status:404,code:'asset_not_found'});
    const observation=await this.#ticker(asset);
    return {
      ...observation,
      definitions:{
        price:'Latest price returned by the selected public exchange ticker.',
        change24h:'Provider-reported 24-hour percentage change.',
        volume24h:'Base-asset volume reported by the selected market.',
        quoteVolume24h:'Quote-currency volume reported by the selected market.',
        marketCap:observation.marketCapDefinition
      },
      actions:{watchlist:'authentication-required',portfolio:'authentication-required',alert:'authentication-required',compare:'available-public',evidence:'available-public'},
      generatedAt:this.now().toISOString()
    };
  }

  async #ticker(asset){
    const key=`ticker:${asset.providerSymbol}`;
    const cached=this.cache.get(key);
    const age=cached?this.now().getTime()-cached.storedAt:Infinity;
    if(cached&&age<=this.cacheTtlMs)return {...cached.value,source:{...cached.value.source,cacheState:'fresh-hit'}};
    if(!this.enabled)return fixtureObservation(asset,this.now,'public market provider disabled');

    this.health.lastAttemptAt=this.now().toISOString();
    try{
      const url=new URL('https://data-api.binance.vision/api/v3/ticker/24hr');
      url.searchParams.set('symbol',asset.providerSymbol);
      const row=await fetchJson(this.fetchImpl,url,{timeoutMs:6500});
      const value=normalizeBinanceTicker(asset,row,{
        now:this.now,
        provider:'binance-public',
        providerName:'Binance Public Market Data',
        sourceUrl:url.toString(),
        attribution:'Binance public market data',
        qualityState:'live-public',
        freshness:'live',
        confidence:.96,
        cacheState:'miss',
        degraded:false
      });
      this.cache.set(key,{storedAt:this.now().getTime(),value});
      this.health={provider:'binance-public',status:'healthy',lastAttemptAt:this.health.lastAttemptAt,lastSuccessAt:this.now().toISOString(),lastError:null};
      return value;
    }catch(error){
      this.health={provider:'binance-public',status:'degraded',lastAttemptAt:this.health.lastAttemptAt,lastSuccessAt:this.health.lastSuccessAt,lastError:error.message};
      if(cached&&age<=this.staleTtlMs)return {...cached.value,source:{...cached.value.source,cacheState:'stale-last-known-good',freshness:'stale',qualityState:'stale-public',degraded:true,fallbackReason:error.message}};
      return fixtureObservation(asset,this.now,error.message);
    }
  }

  #collection(items){
    const liveCount=items.filter(item=>item.source.qualityState==='live-public').length;
    return {
      items,
      total:items.length,
      liveCount,
      degradedCount:items.filter(item=>item.source.degraded).length,
      mode:liveCount===items.length?'live-public':liveCount?'mixed':'simulated-fallback',
      generatedAt:this.now().toISOString(),
      providerStatus:this.status(),
      truthBoundary:liveCount===items.length?'All rows are public-provider observations.':'Rows that could not be sourced publicly are explicitly marked degraded or simulated.'
    };
  }
}

export { ASSETS as publicMarketAssets };
