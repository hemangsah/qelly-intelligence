import crypto from 'node:crypto';

const PROVIDERS = {
  binance: {
    providerId: 'binance-public',
    name: 'Binance Public Market Data',
    transport: ['REST', 'browser WebSocket'],
    intervals: ['1s','1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M'],
    symbols: ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT'],
    realtime: true,
    credentialsRequired: false,
    attribution: 'Binance public market data'
  },
  coindcx: {
    providerId: 'coindcx-public',
    name: 'CoinDCX Public Market Data',
    transport: ['REST', 'provider socket contract'],
    intervals: ['1m','5m','15m','30m','1h','2h','4h','6h','8h','1d','3d','1w','1M'],
    symbols: ['B-BTC_USDT','B-ETH_USDT','B-BNB_USDT','B-SOL_USDT','B-XRP_USDT'],
    realtime: true,
    credentialsRequired: false,
    attribution: 'CoinDCX public market data'
  },
  fixture: {
    providerId: 'qelly-fixture',
    name: 'Qelly Deterministic Market Fixture',
    transport: ['local deterministic'],
    intervals: ['1m','5m','15m','30m','1h','4h','1d'],
    symbols: ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT'],
    realtime: false,
    credentialsRequired: false,
    attribution: 'Qelly deterministic fallback'
  }
};

const DEFAULT_PRICES = { BTCUSDT: 78000, ETHUSDT: 4100, BNBUSDT: 760, SOLUSDT: 210, XRPUSDT: 3.2, ADAUSDT: 1.1 };
const INTERVAL_SECONDS = { '1s':1, '1m':60, '3m':180, '5m':300, '15m':900, '30m':1800, '1h':3600, '2h':7200, '4h':14400, '6h':21600, '8h':28800, '12h':43200, '1d':86400, '3d':259200, '1w':604800, '1M':2592000 };

function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value))); }
function normalizedSymbol(provider, symbol) {
  const raw=String(symbol||'BTCUSDT').toUpperCase().replace(/[^A-Z0-9_-]/g,'');
  if(provider==='coindcx') {
    if(raw.startsWith('B-')) return raw;
    const quote=raw.endsWith('USDT') ? raw.slice(0,-4) : raw;
    return `B-${quote}_USDT`;
  }
  return raw.replace(/^B-/,'').replace('_','');
}
function publicSymbol(symbol) { return String(symbol).replace(/^B-/,'').replace('_',''); }
function safeInterval(provider, interval) {
  const requested=String(interval||'1m');
  return PROVIDERS[provider]?.intervals.includes(requested) ? requested : '1m';
}
function seedFor(value) { return [...String(value)].reduce((acc,ch)=>((acc*31)+ch.charCodeAt(0))>>>0,2166136261); }
function randomFactory(seed) { let state=seed||1; return ()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;}; }
function fixtureCandles({symbol='BTCUSDT', interval='1m', limit=240}) {
  const canonical=publicSymbol(symbol); const seconds=INTERVAL_SECONDS[interval]||60; const now=Math.floor(Date.now()/1000/seconds)*seconds;
  const random=randomFactory(seedFor(`${canonical}:${interval}:${Math.floor(now/(seconds*limit))}`));
  let close=DEFAULT_PRICES[canonical]||100; const points=[];
  for(let i=limit-1;i>=0;i--) {
    const time=now-i*seconds; const volatility=canonical.startsWith('BTC')?.004:canonical.startsWith('ETH')?.006:.009;
    const open=close; const drift=(random()-.485)*volatility; close=Math.max(.0001,open*(1+drift));
    const high=Math.max(open,close)*(1+random()*volatility*.65); const low=Math.min(open,close)*(1-random()*volatility*.65);
    const volume=(500+random()*9500)*(canonical.startsWith('BTC')?1:4);
    points.push({time,open:+open.toFixed(8),high:+high.toFixed(8),low:+low.toFixed(8),close:+close.toFixed(8),volume:+volume.toFixed(3),closed:i>0});
  }
  return points;
}
async function fetchJson(url, timeoutMs=6500) {
  const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response=await fetch(url,{headers:{'Accept':'application/json','User-Agent':'Qelly-Intelligence/22'},signal:controller.signal});
    if(!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}
function normalizeBinanceRows(rows) {
  return rows.map((row)=>({time:Math.floor(Number(row[0])/1000),open:Number(row[1]),high:Number(row[2]),low:Number(row[3]),close:Number(row[4]),volume:Number(row[5]),closed:true})).sort((a,b)=>a.time-b.time);
}
function normalizeCoinDcxRows(rows) {
  const list=Array.isArray(rows)?rows:(Array.isArray(rows?.data)?rows.data:[]);
  return list.map((row)=>({time:Math.floor(Number(row.time)/1000),open:Number(row.open),high:Number(row.high),low:Number(row.low),close:Number(row.close),volume:Number(row.volume),closed:true})).filter((row)=>Number.isFinite(row.time)&&Number.isFinite(row.close)).sort((a,b)=>a.time-b.time);
}
function summarize(points) {
  const first=points[0], last=points.at(-1); if(!first||!last)return {last:null,change:null,changePercent:null,high:null,low:null,volume:null};
  const change=last.close-first.open; const changePercent=first.open?change/first.open*100:0;
  return {last:last.close,change:+change.toFixed(8),changePercent:+changePercent.toFixed(4),high:Math.max(...points.map(x=>x.high)),low:Math.min(...points.map(x=>x.low)),volume:+points.reduce((sum,x)=>sum+x.volume,0).toFixed(3)};
}

export class LiveMarketService {
  constructor({enabled=process.env.QELLY_LIVE_MARKET_ENABLED==='true'}={}) { this.enabled=enabled; this.lastSuccess=new Map(); }
  catalog() { return {brandChart:'TradingView Lightweight Charts compatible',liveModeEnabled:this.enabled,providers:Object.entries(PROVIDERS).map(([id,value])=>({id,...value})),guardrails:{publicMarketDataOnly:true,privateAccountEndpoints:false,trading:false,transfers:false,withdrawals:false,investingComScraping:false}}; }
  status() { return {enabled:this.enabled,mode:this.enabled?'live-with-fallback':'fixture-first',providers:Object.entries(PROVIDERS).map(([id,value])=>({id,name:value.name,realtime:value.realtime,credentialsRequired:value.credentialsRequired,lastSuccessAt:this.lastSuccess.get(id)||null})),checkedAt:new Date().toISOString()}; }
  async candles({provider='fixture',symbol='BTCUSDT',interval='1m',limit=240,mode='auto'}={}) {
    const providerId=PROVIDERS[provider]?provider:'fixture'; const finalInterval=safeInterval(providerId,interval); const finalLimit=clamp(limit,30,1000); const finalSymbol=normalizedSymbol(providerId,symbol);
    const correlationId=crypto.randomUUID(); const requestedLive=mode==='live'||(mode==='auto'&&providerId!=='fixture');
    if(!this.enabled || !requestedLive || providerId==='fixture') return this.#result({provider:'fixture',requestedProvider:providerId,symbol:publicSymbol(finalSymbol),interval:finalInterval,points:fixtureCandles({symbol:finalSymbol,interval:finalInterval,limit:finalLimit}),fallbackReason:this.enabled?null:'live market mode disabled'});
    try {
      let points=[];
      if(providerId==='binance') {
        const url=new URL('https://data-api.binance.vision/api/v3/klines'); url.searchParams.set('symbol',finalSymbol); url.searchParams.set('interval',finalInterval); url.searchParams.set('limit',String(finalLimit));
        points=normalizeBinanceRows(await fetchJson(url));
      } else if(providerId==='coindcx') {
        const url=new URL('https://public.coindcx.com/market_data/candles'); url.searchParams.set('pair',finalSymbol); url.searchParams.set('interval',finalInterval); url.searchParams.set('limit',String(finalLimit));
        points=normalizeCoinDcxRows(await fetchJson(url));
      }
      if(points.length<2)throw new Error('Provider returned insufficient candle data');
      this.lastSuccess.set(providerId,new Date().toISOString());
      return this.#result({provider:providerId,requestedProvider:providerId,symbol:publicSymbol(finalSymbol),interval:finalInterval,points,correlationId});
    } catch(error) {
      return this.#result({provider:'fixture',requestedProvider:providerId,symbol:publicSymbol(finalSymbol),interval:finalInterval,points:fixtureCandles({symbol:finalSymbol,interval:finalInterval,limit:finalLimit}),fallbackReason:error.message,correlationId});
    }
  }
  async ticker(input={}) { const result=await this.candles({...input,limit:Math.min(Number(input.limit||120),240)}); return {...result,points:undefined,summary:summarize(result.points)}; }
  #result({provider,requestedProvider,symbol,interval,points,fallbackReason=null,correlationId=crypto.randomUUID()}) {
    const definition=PROVIDERS[provider]; return {provider,requestedProvider,symbol,interval,points,summary:summarize(points),source:{name:definition.name,providerId:definition.providerId,attribution:definition.attribution,mode:provider==='fixture'?'simulated':'live-public',observedAt:new Date().toISOString(),fallbackReason},correlationId,guardrails:{readOnly:true,publicMarketDataOnly:true,executionDisabled:true}};
  }
}
