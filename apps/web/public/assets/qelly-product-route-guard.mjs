const main=document.getElementById('main');
const cache=new Map();
let restoring=false;
const routeKey=()=>location.hash.replace(/^#\/?/,'').split('?')[0].split('/')[0]||'market';
const selectorFor=(route)=>route==='market'?'.q-market-home':route==='status'?'.q-system-page':null;
const normalizeProviderIds=(root)=>{
  const aliases=new Map([
    ['coinbase exchange','coinbase'],
    ['european central bank','ecb'],
    ['binance','binance']
  ]);
  root?.querySelectorAll?.('.q-market-provider').forEach((card)=>{
    const name=card.querySelector('h3')?.textContent?.trim().toLowerCase();
    if(aliases.has(name))card.dataset.provider=aliases.get(name);
  });
};
const reconcile=()=>{
  if(!main||restoring)return;
  const route=routeKey(),selector=selectorFor(route);
  if(!selector)return;
  const current=main.querySelector(selector);
  if(current){normalizeProviderIds(current);cache.set(route,current);return;}
  const preserved=cache.get(route);
  if(!preserved)return;
  restoring=true;
  normalizeProviderIds(preserved);
  main.replaceChildren(preserved);
  main.dataset.qellyProductHome=route==='market'?'ready':main.dataset.qellyProductHome||'';
  main.setAttribute('aria-busy','false');
  queueMicrotask(()=>{restoring=false;});
};
if(main){
  new MutationObserver(reconcile).observe(main,{childList:true,subtree:false});
  window.addEventListener('hashchange',()=>queueMicrotask(reconcile));
  for(const delay of [0,100,300,800,1600,3000])setTimeout(reconcile,delay);
}
