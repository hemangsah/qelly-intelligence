const VERIFY_HASH=/^#\/(?:qelly-verify|market\?[^#]*\bview=qelly-verify(?:&|$))/i;
const state=window.__QELLY_VERIFY_ROUTE__??{requested:false,initialHash:location.hash,lastIntent:'none'};
window.__QELLY_VERIFY_ROUTE__=state;

const matchesVerify=(value)=>VERIFY_HASH.test(String(value||''));
const setRequested=(requested,intent)=>{
  state.requested=Boolean(requested);
  state.lastIntent=String(intent||'unknown');
};

if(matchesVerify(location.hash))setRequested(true,'initial-url');

document.addEventListener('click',(event)=>{
  const link=event.target.closest?.('a[href^="#/"]');
  if(!link)return;
  const href=link.getAttribute('href')||'';
  setRequested(matchesVerify(href),matchesVerify(href)?'verify-link':'navigation-link');
},{capture:true});

window.addEventListener('hashchange',()=>{
  if(matchesVerify(location.hash))setRequested(true,'hash');
  else if(state.lastIntent==='navigation-link')setRequested(false,'hash-navigation');
});

let scheduled=false;
const handoff=()=>{
  scheduled=false;
  if(!state.requested||typeof window.QellyVerify?.render!=='function')return;
  const main=document.getElementById('main');
  const surface=main?.querySelector('[data-qelly-verify-surface]');
  if(main?.dataset.qellyVerifyOwner==='true'&&surface)return;
  history.replaceState(null,'','#/market?view=qelly-verify');
  window.QellyVerify.render();
};
const schedule=()=>{
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(handoff);
};

new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('pageshow',schedule);
for(const delay of [0,60,180,500,1200,2500])setTimeout(schedule,delay);

window.QellyVerifyBootstrap=Object.freeze({state,matchesVerify,schedule});
