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
  if(!state.requested)return;
  const view=state.requestedView||'verify';
  const method=view==='methodology'?'renderMethodology':'render';
  if(typeof window.QellyVerify?.[method]!=='function')return;
  const main=document.getElementById('main');
  const owner=view==='methodology'?'methodology':'true';
  const selector=view==='methodology'?'[data-qelly-methodology-surface]':'[data-qelly-verify-surface]';
  if(main?.dataset.qellyVerifyOwner===owner&&main.querySelector(selector))return;
  history.replaceState(null,'',view==='methodology'?'#/market?view=evidence-methodology':'#/market?view=qelly-verify');
  window.QellyVerify[method]();
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
