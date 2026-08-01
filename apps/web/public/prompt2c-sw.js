const CACHE='qelly-public-beta-v1';
const SHELL=['./','./index.html','./qelly-config.js','./manifest.webmanifest','./favicon.svg','./assets/tokens.css','./assets/app.css','./assets/qelly-premium-reset.css','./assets/qelly-worldclass-uiux.css','./assets/prompt2c-public-beta.css','./assets/prompt2c-public-beta.mjs','./assets/app.js','./assets/calculation/formula-engine.mjs','./assets/calculation/indicator-engine.mjs','./legal/beta.html','./legal/risk.html','./legal/privacy.html','./legal/terms.html','./support.html'];
self.addEventListener('install',(event)=>event.waitUntil(caches.open(CACHE).then((cache)=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',(event)=>event.waitUntil(caches.keys().then((keys)=>Promise.all(keys.filter((key)=>key!==CACHE).map((key)=>caches.delete(key)))).then(()=>self.clients.claim())));
function privateOrApi(url){return url.pathname.includes('/api/')||/\/(auth|account|saved-calculations|secure-import|quarantine|delivery-operations)(?:\/|$)/i.test(url.pathname);}
self.addEventListener('fetch',(event)=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);if(url.origin!==self.location.origin||privateOrApi(url))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then((response)=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then((cache)=>cache.put('./index.html',copy));}return response;}).catch(()=>caches.match('./index.html')));return;
  }
  event.respondWith(caches.match(request).then((cached)=>cached||fetch(request).then((response)=>{if(response.ok&&['style','script','font','image','manifest'].includes(request.destination)){const copy=response.clone();caches.open(CACHE).then((cache)=>cache.put(request,copy));}return response;})));
});
