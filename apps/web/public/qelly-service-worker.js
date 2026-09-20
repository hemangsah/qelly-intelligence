const CACHE_PREFIX='qelly-public-runtime-';
const RELEASE_KEY='__QELLY_RELEASE_KEY__';
// BUILD_STAMP:SHELL
const SHELL=Object.freeze(['./','./index.html','./qelly-config.js','./qelly-release.json','./manifest.webmanifest','./favicon.svg']);
const CACHE_NAME=`${CACHE_PREFIX}${RELEASE_KEY}`;

function privateOrApi(url){
  return url.pathname.includes('/api/')||/\/(auth|account|saved-calculations|secure-import|quarantine|delivery-operations)(?:\/|$)/i.test(url.pathname);
}

async function releaseCache(){return caches.open(CACHE_NAME);}

async function installShell(){
  const cache=await releaseCache();
  await cache.addAll(SHELL);
  await self.skipWaiting();
}

async function activateShell(){
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)));
  await self.clients.claim();
}

async function remember(request,response){
  if(!response?.ok)return response;
  const cache=await releaseCache();
  await cache.put(request,response.clone());
  return response;
}

async function releaseMatch(request){
  const cache=await releaseCache();
  return cache.match(request);
}

async function networkFirst(request,fallback){
  try{return await remember(request,await fetch(request,{cache:'no-store'}));}
  catch{
    const cached=await releaseMatch(request);
    if(cached)return cached;
    if(fallback)return releaseMatch(fallback);
    return Response.error();
  }
}

async function cacheFirstWithRefresh(request){
  const cached=await releaseMatch(request);
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
