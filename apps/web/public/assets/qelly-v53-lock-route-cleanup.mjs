import './qelly-v53-lock-geometry-fix.mjs';

// Qelly Intelligence — synchronous V5.3 lock cleanup.
// Dedicated route implementations must render their real functional DOM instead
// of being covered by the historical simulated lock-candidate reference surface.

const LEGACY_VERIFY_VIEWS=new Set(['qelly-verify','evidence-methodology']);
const DEDICATED_REAL_ROUTES=new Set(['live-markets','market']);
const REAL_MARKET_STYLE_HREF=new URL('./qelly-v53-real-market.css',import.meta.url).href;

const routeState=(hash=globalThis.location?.hash||'')=>{
  const raw=String(hash).replace(/^#\/?/,'');
  const [path='',query='']=raw.split('?');
  return {route:path.split('/')[0]||'live-markets',params:new URLSearchParams(query)};
};

export function isLegacyVerifySubview(hash=globalThis.location?.hash||''){
  const {route,params}=routeState(hash);
  return route==='market'&&LEGACY_VERIFY_VIEWS.has(params.get('view'));
}

export function isDedicatedRealRoute(hash=globalThis.location?.hash||''){
  return DEDICATED_REAL_ROUTES.has(routeState(hash).route);
}

function ensureRealMarketStyle(){
  if(document.querySelector('link[data-qelly-v53-real-market="active"]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=REAL_MARKET_STYLE_HREF;
  link.dataset.qellyV53RealMarket='active';
  document.head.append(link);
}

export function syncRealMarketState(){
  const root=document.documentElement;
  if(routeState().route==='market'){
    ensureRealMarketStyle();
    root.dataset.v53RealMarket='active';
    return true;
  }
  delete root.dataset.v53RealMarket;
  return false;
}

function clearLockState(){
  const root=document.documentElement;
  const main=document.getElementById('main');
  main?.querySelectorAll(':scope > .q-v53-lock-page').forEach((node)=>node.remove());
  delete root.dataset.v53LockCandidate;
  delete root.dataset.v53LockSlot;
  delete root.dataset.v53LockReady;
  if(main){
    delete main.dataset.v53LockCandidate;
    delete main.dataset.v53LockSlot;
  }
}

export function clearLegacyVerifyLock(){
  if(!isLegacyVerifySubview())return false;
  clearLockState();
  return true;
}

export function clearDedicatedRealRouteLock(){
  if(!isDedicatedRealRoute())return false;
  clearLockState();
  return true;
}

function installDedicatedPrependGuard(){
  const main=document.getElementById('main');
  if(!main||main.dataset.v53DedicatedPrependGuard==='active')return;
  const originalPrepend=main.prepend.bind(main);
  main.prepend=(...nodes)=>{
    const synthetic=nodes.some((node)=>node?.classList?.contains?.('q-v53-lock-page'));
    if(synthetic&&isDedicatedRealRoute()){
      clearLockState();
      return;
    }
    return originalPrepend(...nodes);
  };
  main.dataset.v53DedicatedPrependGuard='active';
}

if(typeof window!=='undefined'&&typeof document!=='undefined'){
  installDedicatedPrependGuard();
  window.addEventListener('hashchange',clearLegacyVerifyLock);
  window.addEventListener('pageshow',clearLegacyVerifyLock);
  window.addEventListener('hashchange',clearDedicatedRealRouteLock);
  window.addEventListener('pageshow',clearDedicatedRealRouteLock);
  window.addEventListener('hashchange',syncRealMarketState);
  window.addEventListener('pageshow',syncRealMarketState);
  queueMicrotask(clearLegacyVerifyLock);
  queueMicrotask(clearDedicatedRealRouteLock);
  queueMicrotask(syncRealMarketState);
}
