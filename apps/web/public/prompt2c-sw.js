const CACHE_PREFIX='qelly-public-beta-';
const FALLBACK_CACHE=`${CACHE_PREFIX}fallback-v3`;
const SHELL=['./','./index.html','./qelly-release.json','./qelly-config.js','./manifest.webmanifest','./favicon.svg','./assets/tokens.css','./assets/app.css','./assets/qelly-premium-reset.css','./assets/qelly-worldclass-uiux.css','./assets/qelly-verify.css','./assets/qelly-verify-evidence.css','./assets/qelly-verify-bootstrap.mjs','./assets/qelly-verify-engine.mjs','./assets/qelly-verify-methodology.mjs','./assets/qelly-verify-report.mjs','./assets/qelly-verify-product.mjs','./assets/prompt2c-public-beta.css','./assets/prompt2c-public-beta.mjs','./assets/qelly-production-v8.css','./assets/qelly-production-v8.mjs','./assets/app.js','./assets/calculation/formula-engine.mjs','./assets/calculation/indicator-engine.mjs','./legal/beta.html','./legal/risk.html','./legal/privacy.html','./legal/terms.html','./support.html'];
let resolvedCacheName=null;

async function cacheName(){
  if(resolvedCacheName)return resolvedCacheName;
  try{
    const response=await fetch('./qelly-release.json',{cache:'no-store'});
    if(!response.ok)throw new Error(`release ${response.status}`);
    const release=await response.json();
    const sha=String(release?.releaseSha||'').toLowerCase();
    resolvedCacheName=/^[0-9a-f]{40}$/.test(sha)?`${CACHE_PREFIX}${sha}`:FALLBACK_CACHE;
  }catch{resolvedCacheName=FALLBACK_CACHE;}
  return resolvedCacheName;
}

async function installShell(){
  const name=await cacheName();
  const cache=await caches.open(name);
  await cache.addAll(SHELL);
  await self.skipWaiting();
}

async function activateShell(){
  const name=await cacheName();
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==name).map(key=>caches.delete(key)));
  await self.clients.claim();
}

function privateOrApi(url){return url.pathname.includes('/api/')||/\/(auth|account|saved-calculations|secure-import|quarantine|delivery-operations)(?:\/|$)/i.test(url.pathname);}

async function remember(request,response){
  if(!response?.ok)return response;
  const cache=await caches.open(await cacheName());
  await cache.put(request,response.clone());
  return response;
}

async function networkFirst(request,fallback){
  try{return await remember(request,await fetch(request));}
  catch{return(await caches.match(request))||(fallback?await caches.match(fallback):undefined)||Response.error();}
}

async function cacheFirstWithRefresh(request){
  const cached=await caches.match(request);
  const refresh=fetch(request).then(response=>remember(request,response)).catch(()=>null);
  return cached||(await refresh)||Response.error();
}

self.addEventListener('install',event=>event.waitUntil(installShell()));
self.addEventListener('activate',event=>event.waitUntil(activateShell()));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||privateOrApi(url))return;
  if(request.mode==='navigate'){event.respondWith(networkFirst(request,'./index.html'));return;}
  if(['script','style','manifest'].includes(request.destination)||url.pathname.endsWith('/qelly-config.js')||url.pathname.endsWith('/qelly-release.json')){event.respondWith(networkFirst(request));return;}
  if(['font','image'].includes(request.destination)){event.respondWith(cacheFirstWithRefresh(request));return;}
  event.respondWith(networkFirst(request));
});
