const CONSENT_KEY='qelly-consent-v1';
const ACTIVITY_KEY='qelly-growth-activity-v1';
const SESSION_KEY='qelly-growth-session-v1';
const PINNED_KEY='qelly-growth-pinned-v1';
const MAX_ACTIVITY=8;
const MAX_PINNED=6;
const ALLOWED_EVENTS=new Set([
  'route_view','calculator_open','calculator_complete','decision_open','decision_range_selected',
  'decision_explain','qelly_view_interaction','asset_search','research_click','india_finance_use',
  'ad_slot_eligibility','ad_slot_render','consent_status','degraded_state','client_error'
]);
const ALLOWED_PROPERTIES=new Set(['route','feature','action','state','surface','returning','count']);
const ANALYTICS_ROUTES=new Set(['market','asset-rankings','asset-intelligence','advanced-chart','decision-provenance','news-research','research-workspace','calculator-center','calculator-detail','india-finance','indicator-library','indicator-detail','formula-library','formula-detail','search','categories','venues','dex-discovery','global-charts','converter','event-calendar','comparison-lab']);
const SAFE_TOKEN=/^[a-z0-9][a-z0-9_.:-]{0,63}$/i;

const parseJson=(value,fallback)=>{try{return JSON.parse(value);}catch{return fallback;}};
const storageGet=(storage,key,fallback)=>parseJson(storage?.getItem?.(key)||'',fallback);
const storageSet=(storage,key,value)=>{try{storage?.setItem?.(key,JSON.stringify(value));return true;}catch{return false;}};
const cleanToken=(value)=>{const token=String(value??'').trim().toLowerCase();return SAFE_TOKEN.test(token)?token:null;};

export function sanitizeGrowthEvent(input,now=Date.now()){
  const name=cleanToken(input?.name);
  if(!name||!ALLOWED_EVENTS.has(name))return null;
  const properties={};
  for(const [key,value] of Object.entries(input?.properties??{})){
    if(!ALLOWED_PROPERTIES.has(key))continue;
    if(key==='count'){
      const count=Math.max(1,Math.min(100,Math.trunc(Number(value)||1)));
      properties.count=count;
      continue;
    }
    if(key==='returning'){
      properties.returning=value===true;
      continue;
    }
    const token=cleanToken(value);
    if(token)properties[key]=token;
  }
  return Object.freeze({name,properties:Object.freeze(properties),occurredAt:new Date(now).toISOString()});
}

export function readGrowthConsent(storage=globalThis.localStorage){
  const consent=storageGet(storage,CONSENT_KEY,{});
  return consent?.analytics===true;
}

export function updateGrowthConsent(granted,storage=globalThis.localStorage){
  const previous=storageGet(storage,CONSENT_KEY,{});
  return storageSet(storage,CONSENT_KEY,{...previous,analytics:granted===true,updatedAt:new Date().toISOString()});
}

const safeRecentHref=(value)=>{
  const href=String(value??'').trim();
  return /^#\/[a-z0-9._~:%/-]+(?:\?[a-z0-9._~:%&=+,-]*)?$/i.test(href)&&href.length<=240?href:null;
};

export function recordRecentActivity({route,label,kind='page',key=null,href=null},storage=globalThis.localStorage,now=Date.now()){
  const safeRoute=cleanToken(route);
  const safeKind=cleanToken(kind);
  const safeKey=cleanToken(key??route);
  const safeLabel=String(label??'').replace(/[<>]/g,'').trim().slice(0,80);
  const safeHref=safeRecentHref(href??(safeRoute?'#/'+safeRoute:''));
  if(!safeRoute||!safeKind||!safeKey||!safeLabel||!safeHref)return [];
  const current=storageGet(storage,ACTIVITY_KEY,[]);
  const identity=(item)=>cleanToken(item?.key??item?.route);
  const next=[{key:safeKey,route:safeRoute,href:safeHref,label:safeLabel,kind:safeKind,visitedAt:new Date(now).toISOString()},...current.filter((item)=>identity(item)!==safeKey)].slice(0,MAX_ACTIVITY);
  storageSet(storage,ACTIVITY_KEY,next);
  return next;
}

export function readRecentActivity(storage=globalThis.localStorage){
  const value=storageGet(storage,ACTIVITY_KEY,[]);
  return Array.isArray(value)?value.slice(0,MAX_ACTIVITY):[];
}

export function readPinnedActivity(storage=globalThis.localStorage){
  const value=storageGet(storage,PINNED_KEY,[]);
  return Array.isArray(value)?value.slice(0,MAX_PINNED):[];
}

const safePinnedDescriptor=(input)=>{
  const safeRoute=cleanToken(input?.route);
  const safeKind=cleanToken(input?.kind);
  const safeKey=cleanToken(input?.key??input?.route);
  const safeLabel=String(input?.label??'').replace(/[<>]/g,'').trim().slice(0,80);
  const safeHref=safeRecentHref(input?.href??(safeRoute?'#/'+safeRoute:''));
  if(!safeRoute||!safeKind||!safeKey||!safeLabel||!safeHref)return null;
  return {key:safeKey,route:safeRoute,href:safeHref,label:safeLabel,kind:safeKind};
};

export function togglePinnedActivity(descriptor,storage=globalThis.localStorage){
  const safe=safePinnedDescriptor(descriptor);
  if(!safe)return readPinnedActivity(storage);
  const current=readPinnedActivity(storage);
  const exists=current.some((item)=>cleanToken(item?.key)===safe.key);
  const next=exists
    ? current.filter((item)=>cleanToken(item?.key)!==safe.key)
    : [safe,...current.filter((item)=>cleanToken(item?.key)!==safe.key)].slice(0,MAX_PINNED);
  storageSet(storage,PINNED_KEY,next);
  return next;
}

export const isGrowthOpenTarget=(target)=>Boolean(target?.closest?.('[data-growth-open]'));

export function createGrowthAnalytics({config={},storage=globalThis.localStorage,navigatorObject=globalThis.navigator,fetchImpl=globalThis.fetch,now=()=>Date.now()}={}){
  const enabled=config?.enabled===true;
  const endpoint=String(config?.endpoint||'/api/v1/analytics/events');
  const dnt=String(navigatorObject?.doNotTrack||globalThis.doNotTrack||'')==='1'||navigatorObject?.globalPrivacyControl===true;
  let queue=[];
  let timer=null;
  const returning=storageGet(storage,SESSION_KEY,null)!=null;
  storageSet(storage,SESSION_KEY,{lastSeenAt:new Date(now()).toISOString()});

  const flush=async()=>{
    if(!queue.length||!enabled||dnt||!readGrowthConsent(storage))return false;
    const events=queue.splice(0,20);
    try{
      const response=await fetchImpl(endpoint,{method:'POST',credentials:'omit',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({schemaVersion:1,events})});
      if(!response?.ok)throw new Error('analytics delivery unavailable');
      return true;
    }catch{
      queue=[];
      return false;
    }
  };
  const track=(name,properties={})=>{
    if(!enabled||dnt||!readGrowthConsent(storage))return false;
    const event=sanitizeGrowthEvent({name,properties:{...properties,returning}},now());
    if(!event)return false;
    queue.push(event);
    if(queue.length>=10)void flush();
    else if(timer==null)timer=setTimeout(()=>{timer=null;void flush();},1500);
    return true;
  };
  return Object.freeze({track,flush,enabled:enabled&&!dnt,returning});
}

const routeFromHash=()=>location.hash.replace(/^#\/?/,'').split('?')[0].split('/')[0]||'market';
const routeLabel=(route)=>route.split('-').map((part)=>part.charAt(0).toUpperCase()+part.slice(1)).join(' ');
const decodeSegment=(value)=>{try{return decodeURIComponent(String(value??''));}catch{return String(value??'');}};
export function recentDescriptorFromHash(hash){
  const raw=String(hash??'').replace(/^#\/?/,'').split('?')[0];
  const segments=raw.split('/').filter(Boolean).map(decodeSegment);
  const route=cleanToken(segments[0]||'market')||'market';
  const detail=segments[1]||'';
  if(route==='asset'&&detail){
    const symbol=detail.toUpperCase().replace(/^QI-CRYPTO-/,'').replace(/[^A-Z0-9._-]/g,'').slice(0,20);
    if(symbol)return {route,key:'asset:'+symbol.toLowerCase(),href:'#/asset/'+encodeURIComponent(detail),label:symbol+' · Asset Dossier',kind:'asset'};
  }
  if(route==='calculator-detail'&&detail){
    const id=cleanToken(detail);
    if(id)return {route,key:'calculator:'+id,href:'#/calculator-detail/'+encodeURIComponent(detail),label:routeLabel(id)+' · Calculator',kind:'calculator'};
  }
  return {route,key:route,href:'#/'+route,label:routeLabel(route),kind:route.includes('calculator')?'calculator':route==='decision-provenance'?'decision_intelligence':'research_page'};
}
const escapeHtml=(value)=>String(value??'').replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));

function openGrowthPanel(analytics){
  document.querySelector('[data-qelly-growth-panel]')?.remove();
  const recent=readRecentActivity();
  const pinned=readPinnedActivity();
  const current=recentDescriptorFromHash(location.hash);
  const canPin=current.route==='asset'||ANALYTICS_ROUTES.has(current.route);
  const currentPinned=pinned.some((item)=>item?.key===current.key);
  const consent=readGrowthConsent();
  const dialog=document.createElement('dialog');
  dialog.className='q-growth-panel';dialog.dataset.qellyGrowthPanel='true';
  const pinnedMarkup=pinned.length?pinned.map((item)=>{const href=safeRecentHref(item.href)||safeRecentHref('#/'+item.route)||'#/market';return '<div class="q-growth-pin-row"><a href="'+escapeHtml(href)+'"><span>'+escapeHtml(item.label)+'</span><small>'+escapeHtml(item.kind.replaceAll('_',' '))+'</small></a><button type="button" data-growth-unpin="'+escapeHtml(item.key)+'" aria-label="Unpin '+escapeHtml(item.label)+'">Unpin</button></div>';}).join(''):'<p class="q-growth-panel__empty">Pin a public tool or research page to keep it here.</p>';
  const recentMarkup=recent.length?recent.map((item)=>{const href=safeRecentHref(item.href)||safeRecentHref('#/'+item.route)||'#/market';return '<a href="'+escapeHtml(href)+'"><span>'+escapeHtml(item.label)+'</span><small>'+escapeHtml(item.kind.replaceAll('_',' '))+'</small></a>';}).join(''):'<p class="q-growth-panel__empty">Open a market, calculator or research tool and it will appear here.</p>';
  dialog.innerHTML='<form method="dialog" class="q-growth-panel__head"><div><small>Your browser</small><h2>Recent Qelly activity</h2></div><button aria-label="Close recent activity">×</button></form><div class="q-growth-panel__body"><p>Return to recent public research without an account. Recent and pinned items stay in this browser.</p>'+(canPin?'<button type="button" class="q-growth-pin-current" data-growth-pin-current>'+ (currentPinned?'Unpin current':'Pin current') +'</button>':'')+'<section class="q-growth-section"><div class="q-growth-section__head"><strong>Pinned</strong><small>'+pinned.length+'/'+MAX_PINNED+'</small></div><div class="q-growth-panel__list q-growth-panel__list--pinned">'+pinnedMarkup+'</div></section><section class="q-growth-section"><div class="q-growth-section__head"><strong>Recent</strong><small>browser local</small></div><div class="q-growth-panel__list">'+recentMarkup+'</div></section><label class="q-growth-consent"><input type="checkbox" data-growth-consent '+(consent?'checked':'')+'><span><strong>Help improve Qelly</strong><small>Share coarse feature-use counts only. Inputs, outputs, searches, symbols and account data are never included.</small></span></label><a class="q-growth-privacy" href="./legal/privacy.html">Privacy details</a></div>';
  document.body.append(dialog);
  dialog.querySelector('[data-growth-pin-current]')?.addEventListener('click',()=>{
    togglePinnedActivity(current);
    openGrowthPanel(analytics);
  });
  dialog.querySelectorAll('[data-growth-unpin]').forEach((button)=>button.addEventListener('click',()=>{
    const item=pinned.find((entry)=>entry?.key===button.dataset.growthUnpin);
    if(item)togglePinnedActivity(item);
    openGrowthPanel(analytics);
  }));
  dialog.querySelector('[data-growth-consent]')?.addEventListener('change',(event)=>{
    updateGrowthConsent(event.currentTarget.checked);
    analytics.track('consent_status',{state:event.currentTarget.checked?'granted':'denied',surface:'recent_panel'});
  });
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  dialog.showModal();
}

export function installGrowthRuntime(config=window.__QELLY_CONFIG__||{}){
  const analytics=createGrowthAnalytics({config:config.analytics});
  const trackRoute=()=>{
    const recent=recentDescriptorFromHash(location.hash);
    const route=recent.route;
    recordRecentActivity(recent);
    if(ANALYTICS_ROUTES.has(route)){
      analytics.track('route_view',{route,feature:route==='decision-provenance'?'decision_intelligence':route});
      if(route==='decision-provenance')analytics.track('decision_open',{route,feature:'decision_intelligence'});
      if(route==='calculator-detail')analytics.track('calculator_open',{route,feature:'calculator'});
    }
  };
  document.addEventListener('qelly:product-event',(event)=>analytics.track(event.detail?.name,event.detail?.properties));
  document.addEventListener('qelly:ad',(event)=>analytics.track(event.detail?.state==='requested'?'ad_slot_render':'ad_slot_eligibility',{state:event.detail?.state,feature:event.detail?.placement}));
  document.addEventListener('click',(event)=>{if(isGrowthOpenTarget(event.target))openGrowthPanel(analytics);});
  document.addEventListener('click',(event)=>{const link=event.target.closest?.('a[href]');if(link&&routeFromHash()==='news-research')analytics.track('research_click',{route:'news-research',feature:link.origin===location.origin?'internal':'external',action:'open'});});
  window.addEventListener('hashchange',()=>setTimeout(trackRoute,0));
  window.addEventListener('pagehide',()=>void analytics.flush());
  window.addEventListener('error',()=>analytics.track('client_error',{route:routeFromHash(),state:'uncaught'}));
  const installButton=()=>{
    const actions=document.querySelector('.q-product-actions');
    if(!actions||actions.querySelector('[data-growth-open]'))return;
    const button=document.createElement('button');button.type='button';button.className='q-product-recent';button.dataset.growthOpen='true';button.textContent='Recent';
    actions.prepend(button);
  };
  new MutationObserver(installButton).observe(document.body,{childList:true,subtree:true});
  installButton();setTimeout(trackRoute,0);
  window.__QELLY_GROWTH__=Object.freeze({track:analytics.track,open:()=>openGrowthPanel(analytics),readRecentActivity,readPinnedActivity,togglePinnedActivity});
  return window.__QELLY_GROWTH__;
}

if(typeof window!=='undefined'&&typeof document!=='undefined')installGrowthRuntime();
