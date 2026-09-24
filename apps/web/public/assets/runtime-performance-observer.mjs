const MAX_ROUTE_SAMPLES=48;
const MAX_LONG_TASK_SAMPLES=64;
const MAX_RUNTIME_SIGNALS=80;
const LONG_TASK_NOTICE_MS=200;
const LONG_TASK_REPEATED_BUDGET_MS=500;
const PROVIDER_HOSTS=Object.freeze({
  tradingview:['tradingview.com','tradingview-widget.com'],
  coinmarketcap:['coinmarketcap.com'],
  x:['twitter.com','x.com','twimg.com'],
  hyperliquid:['hyperliquid.xyz']
});

const state={
  installed:false,
  installedAt:null,
  webVitals:{fcpMs:null,lcpMs:null,cls:0,inpMs:null,interactionCount:0},
  navigation:{domContentLoadedMs:null,responseStartMs:null,loadEventMs:null},
  routes:[],
  longTasks:[],
  externalResources:{},
  signals:[]
};
const observers=[];
const interactionDurations=new Map();

const now=()=>globalThis.performance?.now?.()??Date.now();
const round=(value,digits=2)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const boundedPush=(list,value,max)=>{list.push(value);if(list.length>max)list.splice(0,list.length-max);};
const safeRoute=(value)=>String(value||'unknown').replace(/[^a-zA-Z0-9/_-]+/g,'-').slice(0,96)||'unknown';
const durationBucket=(value)=>{
  const n=Number(value);
  if(!Number.isFinite(n))return 'unknown';
  if(n<100)return 'lt_100ms';
  if(n<200)return '100_199ms';
  if(n<500)return '200_499ms';
  if(n<1000)return '500_999ms';
  if(n<2000)return '1000_1999ms';
  if(n<4000)return '2000_3999ms';
  return 'gte_4000ms';
};
const providerFromUrl=(value)=>{
  try{
    const host=new URL(String(value||''),globalThis.location?.href||'https://qelly.invalid/').hostname.toLowerCase();
    for(const [provider,hosts] of Object.entries(PROVIDER_HOSTS))if(hosts.some(item=>host===item||host.endsWith('.'+item)))return provider;
    if(globalThis.location?.hostname&&(host===globalThis.location.hostname||host.endsWith('.'+globalThis.location.hostname)))return 'first_party';
  }catch{}
  return null;
};
const ownerFromAttribution=(entry)=>{
  const providers=new Set();
  for(const item of Array.from(entry?.attribution||[])){
    const provider=providerFromUrl(item?.containerSrc);
    if(provider)providers.add(provider);
  }
  if([...providers].some(value=>value!=='first_party'))return 'third_party';
  if(providers.has('first_party'))return 'first_party';
  return 'unattributed';
};
const emit=(detail)=>{
  if(typeof globalThis.window?.dispatchEvent!=='function'||typeof globalThis.CustomEvent!=='function')return;
  globalThis.window.dispatchEvent(new CustomEvent('qelly:runtime-signal',{detail}));
};
const observe=(type,callback,options={})=>{
  if(typeof globalThis.PerformanceObserver!=='function')return false;
  try{
    const observer=new PerformanceObserver(callback);
    observer.observe({type,buffered:true,...options});
    observers.push(observer);
    return true;
  }catch{return false;}
};

export function startRouteMeasure(route,request=null){
  return {route:safeRoute(route),request:Number.isFinite(Number(request))?Number(request):null,startedAt:now(),finished:false};
}

export function finishRouteMeasure(token,{state:outcome='success',root=null}={}){
  if(!token||token.finished)return null;
  token.finished=true;
  const durationMs=round(Math.max(0,now()-Number(token.startedAt||0)));
  const domNodes=root?.querySelectorAll?root.querySelectorAll('*').length:null;
  const memory=globalThis.performance?.memory;
  const sample={
    route:safeRoute(token.route),
    request:token.request,
    state:String(outcome||'success').slice(0,32),
    durationMs,
    durationBucket:durationBucket(durationMs),
    domNodes:Number.isFinite(Number(domNodes))?Number(domNodes):null,
    heapUsedMb:Number.isFinite(Number(memory?.usedJSHeapSize))?round(Number(memory.usedJSHeapSize)/(1024*1024),1):null
  };
  boundedPush(state.routes,sample,MAX_ROUTE_SAMPLES);
  emit({feature:'route',action:'render',state:sample.durationBucket,surface:sample.route});
  return sample;
}

export function runtimePerformanceSnapshot(){
  return {
    schemaVersion:'qelly.runtime-performance/1.0.0',
    installed:state.installed,
    installedAt:state.installedAt,
    budgets:{
      longTaskNoticeMs:LONG_TASK_NOTICE_MS,
      repeatedFirstPartyLongTaskMs:LONG_TASK_REPEATED_BUDGET_MS
    },
    webVitals:{...state.webVitals},
    navigation:{...state.navigation},
    routes:state.routes.map(item=>({...item})),
    longTasks:state.longTasks.map(item=>({...item})),
    externalResources:Object.fromEntries(Object.entries(state.externalResources).map(([key,value])=>[key,{...value}])),
    signals:state.signals.map(item=>({...item}))
  };
}

export function installRuntimePerformanceObserver(){
  if(state.installed)return runtimePerformanceSnapshot;
  state.installed=true;
  state.installedAt=new Date().toISOString();

  if(typeof globalThis.window?.addEventListener==='function'){
    globalThis.window.addEventListener('qelly:runtime-signal',(event)=>{
      const detail=event?.detail||{};
      boundedPush(state.signals,{
        feature:String(detail.feature||'unknown').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,48),
        action:String(detail.action||'unknown').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,48),
        state:String(detail.state||'unknown').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,48),
        surface:String(detail.surface||'unknown').replace(/[^a-zA-Z0-9/_-]+/g,'-').slice(0,96)
      },MAX_RUNTIME_SIGNALS);
    },{passive:true});
  }

  try{
    const navigation=globalThis.performance?.getEntriesByType?.('navigation')?.[0];
    if(navigation){
      state.navigation.domContentLoadedMs=round(navigation.domContentLoadedEventEnd);
      state.navigation.responseStartMs=round(navigation.responseStart);
      state.navigation.loadEventMs=round(navigation.loadEventEnd);
    }
  }catch{}

  observe('paint',(list)=>{
    for(const entry of list.getEntries())if(entry.name==='first-contentful-paint')state.webVitals.fcpMs=round(entry.startTime);
  });
  observe('largest-contentful-paint',(list)=>{
    for(const entry of list.getEntries())state.webVitals.lcpMs=round(entry.startTime);
  });
  observe('layout-shift',(list)=>{
    for(const entry of list.getEntries())if(!entry.hadRecentInput)state.webVitals.cls=round(Number(state.webVitals.cls||0)+Number(entry.value||0),5);
  });
  observe('event',(list)=>{
    for(const entry of list.getEntries()){
      const id=Number(entry.interactionId||0);
      if(!id)continue;
      interactionDurations.set(id,Math.max(Number(interactionDurations.get(id)||0),Number(entry.duration||0)));
    }
    const values=[...interactionDurations.values()].filter(Number.isFinite).sort((a,b)=>b-a);
    state.webVitals.interactionCount=values.length;
    state.webVitals.inpMs=values.length?round(values[Math.min(Math.floor(values.length/50),values.length-1)]):null;
  },{durationThreshold:16});
  observe('longtask',(list)=>{
    for(const entry of list.getEntries()){
      const durationMs=round(entry.duration);
      boundedPush(state.longTasks,{
        durationMs,
        durationBucket:durationBucket(durationMs),
        owner:ownerFromAttribution(entry),
        overNotice:Number(durationMs)>=LONG_TASK_NOTICE_MS,
        overRepeatedBudget:Number(durationMs)>=LONG_TASK_REPEATED_BUDGET_MS
      },MAX_LONG_TASK_SAMPLES);
    }
  });
  observe('resource',(list)=>{
    for(const entry of list.getEntries()){
      const provider=providerFromUrl(entry.name);
      if(!provider||provider==='first_party')continue;
      const aggregate=state.externalResources[provider]||{count:0,totalDurationMs:0,maxDurationMs:0};
      aggregate.count+=1;
      aggregate.totalDurationMs=round(Number(aggregate.totalDurationMs||0)+Number(entry.duration||0));
      aggregate.maxDurationMs=Math.max(Number(aggregate.maxDurationMs||0),round(entry.duration)||0);
      state.externalResources[provider]=aggregate;
    }
  });

  if(typeof globalThis.window==='object'){
    Object.defineProperty(globalThis.window,'__QELLY_RUNTIME_PERFORMANCE__',{
      configurable:true,
      value:Object.freeze({snapshot:runtimePerformanceSnapshot})
    });
  }
  return runtimePerformanceSnapshot;
}

export function disconnectRuntimePerformanceObserver(){
  while(observers.length)observers.pop()?.disconnect?.();
}

export const __runtimePerformanceTest=Object.freeze({
  MAX_ROUTE_SAMPLES,MAX_LONG_TASK_SAMPLES,MAX_RUNTIME_SIGNALS,LONG_TASK_NOTICE_MS,LONG_TASK_REPEATED_BUDGET_MS,PROVIDER_HOSTS,
  durationBucket,providerFromUrl,ownerFromAttribution,safeRoute
});
