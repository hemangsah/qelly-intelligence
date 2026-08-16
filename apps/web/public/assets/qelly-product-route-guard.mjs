import './qelly-external-market-surfaces.mjs';

const main=document.getElementById('main');
const cache=new Map();
let restoring=false;
let reconciling=false;
let scheduled=false;
let pending=false;
let authState=null;
let authRequest=null;
const routeKey=()=>location.hash.replace(/^#\/?/,'').split('?')[0].split('/')[0]||'market';
const protectedRoutes=new Map([
  ['account-session','Account'],
  ['security-setup','Security setup'],
  ['passkey-center','Passkeys'],
  ['account-recovery','Recovery controls'],
  ['secure-import-vault','Secure import'],
  ['delivery-operations','Delivery operations'],
  ['platform-readiness','Platform readiness'],
  ['secret-rotation','Secret rotation'],
  ['quarantine-review','Quarantine review'],
  ['staging-assurance','Staging assurance'],
  ['watchlist','Watchlist'],
  ['alert-center','Alerts'],
  ['notification-center','Notifications'],
  ['portfolio-analytics','Portfolio analytics'],
  ['research-workspace','Research workspace']
]);
const selectorFor=(route)=>route==='market'?'.q-market-home':route==='status'?'.q-system-page':protectedRoutes.has(route)?`.q-access-gate[data-qelly-destination="${route}"]`:null;
const apiUrl=(path)=>window.__QELLY_CONFIG__?.apiBaseUrl?new URL(path,`${String(window.__QELLY_CONFIG__.apiBaseUrl).replace(/\/$/,'')}/`).toString():path;
const resolveAuthentication=()=>{
  if(authState!==null)return Promise.resolve(authState);
  if(authRequest)return authRequest;
  authRequest=fetch(apiUrl('/api/v1/auth/status'),{credentials:'include',headers:{Accept:'application/json'},cache:'no-store'})
    .then(async(response)=>response.ok?(await response.json()).authenticated===true:false)
    .catch(()=>false)
    .then((value)=>{authState=value;return value;});
  return authRequest;
};
const normalizeProviderIds=(root)=>{
  const aliases=new Map([
    ['coinbase exchange','coinbase'],
    ['european central bank','ecb'],
    ['binance','binance']
  ]);
  root?.querySelectorAll?.('.q-market-provider').forEach((card)=>{
    const name=card.querySelector('h3')?.textContent?.trim().toLowerCase();
    const canonical=aliases.get(name);
    if(canonical&&card.dataset.provider!==canonical)card.dataset.provider=canonical;
  });
};
const framingSentinels=()=>document.documentElement.dataset.productSurface==='production'?[]:[...main.children].filter((node)=>node.matches?.('.q-worldclass-context'));
const scheduleReconcile=()=>{
  if(scheduled){pending=true;return;}
  scheduled=true;
  queueMicrotask(()=>{
    scheduled=false;
    void reconcile();
  });
};
const releasePending=()=>{
  if(!pending)return;
  pending=false;
  setTimeout(scheduleReconcile,0);
};
const replaceProductContent=(route,node)=>{
  if(!node)return;
  const sentinels=framingSentinels().filter((sentinel)=>sentinel!==node);
  const existing=[...main.children];
  const allowed=new Set([...sentinels,node]);
  if(node.parentElement===main&&existing.every((child)=>allowed.has(child))&&existing.includes(node))return;
  restoring=true;
  main.replaceChildren(...sentinels,node);
  main.dataset.qellyProductHome=route==='market'?'ready':main.dataset.qellyProductHome||'';
  main.setAttribute('aria-busy','false');
  queueMicrotask(()=>{
    restoring=false;
    scheduleReconcile();
  });
};
const ownMain=(route,node)=>{
  if(!node||node.parentElement!==main)return;
  replaceProductContent(route,node);
};
const accessGate=(route)=>{
  const destination=protectedRoutes.get(route)||'this workspace';
  sessionStorage.setItem('qelly.returnTo',route);
  const section=document.createElement('section');
  section.className='q-access-gate';
  section.dataset.qellyDestination=route;
  section.innerHTML=`<div class="q-access-gate__icon" aria-hidden="true">↗</div><p class="q-market-kicker">Account required</p><h1>Sign in to continue</h1><p>${destination} uses your private Qelly workspace. Sign in to continue without losing this destination.</p><div class="q-access-gate__actions"><a class="q-button q-button--primary" href="#/auth-login">Sign in</a><a class="q-button q-button--secondary" href="#/auth-register">Create account</a><a class="q-button q-button--ghost" href="#/market">Return home</a></div><small>Public market observations and deterministic tools remain available without an account.</small>`;
  return section;
};
const reconcile=async()=>{
  if(!main)return;
  if(restoring||reconciling){pending=true;return;}
  reconciling=true;
  try{
    const route=routeKey(),selector=selectorFor(route);
    if(!selector)return;
    const current=main.querySelector(selector);
    if(current){
      normalizeProviderIds(current);
      cache.set(route,current);
      ownMain(route,current);
      return;
    }
    if(protectedRoutes.has(route)){
      const authenticated=await resolveAuthentication();
      if(route!==routeKey()||authenticated)return;
      const resolved=main.querySelector(selector);
      if(resolved){
        cache.set(route,resolved);
        ownMain(route,resolved);
        return;
      }
      const gate=cache.get(route)||accessGate(route);
      cache.set(route,gate);
      replaceProductContent(route,gate);
      document.title=`Sign in to continue · ${protectedRoutes.get(route)} · Qelly Intelligence`;
      return;
    }
    const preserved=cache.get(route);
    if(!preserved)return;
    normalizeProviderIds(preserved);
    replaceProductContent(route,preserved);
  }finally{
    reconciling=false;
    releasePending();
  }
};
if(main){
  new MutationObserver(scheduleReconcile).observe(main,{childList:true,subtree:false});
  window.addEventListener('hashchange',()=>{
    authState=null;
    authRequest=null;
    scheduleReconcile();
  });
  for(const delay of [0,100,300,800,1600,3000])setTimeout(scheduleReconcile,delay);
}