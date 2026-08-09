const VIEW_PATTERNS=Object.freeze({
  verify:/^#\/(?:qelly-verify|market\?[^#]*\bview=qelly-verify(?:&|$))/i,
  methodology:/^#\/(?:evidence-methodology|market\?[^#]*\bview=evidence-methodology(?:&|$))/i
});
const state=window.__QELLY_VERIFY_ROUTE__??{requested:false,requestedView:null,initialHash:location.hash,lastIntent:'none'};
window.__QELLY_VERIFY_ROUTE__=state;

const viewFor=value=>{
  const candidate=String(value||'');
  if(VIEW_PATTERNS.verify.test(candidate))return'verify';
  if(VIEW_PATTERNS.methodology.test(candidate))return'methodology';
  return null;
};
const matchesVerify=value=>viewFor(value)==='verify';
const matchesMethodology=value=>viewFor(value)==='methodology';
const setRequested=(view,intent)=>{
  state.requested=Boolean(view);
  state.requestedView=view||null;
  state.lastIntent=String(intent||'unknown');
};
const normalizeNavigationMarkers=()=>{
  document.querySelectorAll('[data-qelly-verify-link="true"]').forEach(link=>{link.dataset.qellyVerifyLink='verify';});
  document.querySelectorAll('[data-qelly-methodology-link]').forEach(link=>{link.dataset.qellyVerifyLink='methodology';});
};

const initialView=viewFor(location.hash);
if(initialView)setRequested(initialView,'initial-url');

document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href^="#/"]');
  if(!link)return;
  const view=viewFor(link.getAttribute('href')||'');
  setRequested(view,view?`${view}-link`:'navigation-link');
},{capture:true});

window.addEventListener('hashchange',()=>{
  const view=viewFor(location.hash);
  if(view)setRequested(view,'hash');
  else if(state.lastIntent==='navigation-link')setRequested(null,'hash-navigation');
});

let scheduled=false;
const handoff=()=>{
  scheduled=false;
  normalizeNavigationMarkers();
  if(!state.requested)return;
  const view=state.requestedView||'verify';
  const method=view==='methodology'?'renderMethodology':'render';
  if(typeof window.QellyVerify?.[method]!=='function')return;
  const main=document.getElementById('main');
  const owner=view==='methodology'?'methodology':'true';
  const selector=view==='methodology'?'[data-qelly-methodology-surface]':'[data-qelly-verify-surface]';
  const canonicalHash=view==='methodology'?'#/market?view=evidence-methodology':'#/qelly-verify';
  if(location.hash!==canonicalHash)history.replaceState(null,'',canonicalHash);
  if(!(main?.dataset.qellyVerifyOwner===owner&&main.querySelector(selector)))window.QellyVerify[method]();
  normalizeNavigationMarkers();
  if(view==='verify')document.title='Qelly Verify · Qelly Intelligence';
};
const schedule=()=>{
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(handoff);
};

new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('pageshow',schedule);
for(const delay of [0,60,180,500,1200,2500])setTimeout(schedule,delay);

window.QellyVerifyBootstrap=Object.freeze({state,viewFor,matchesVerify,matchesMethodology,schedule});