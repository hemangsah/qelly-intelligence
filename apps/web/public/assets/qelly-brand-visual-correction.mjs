const root=document.documentElement;
const stateValues=new Set(['loading','empty','offline','error']);

function reducedMotion(){
  return matchMedia('(prefers-reduced-motion: reduce)').matches||root.dataset.motion==='reduced'||root.dataset.motion==='none';
}

function correctOpening(){
  const opening=document.querySelector('.qelly-opening');
  if(!opening)return;
  const reduced=reducedMotion();
  opening.classList.toggle('is-reduced',reduced);
  opening.classList.toggle('is-full',!reduced);
  opening.dataset.finalBrandState='single-lockup';
  const symbol=opening.querySelector('.qelly-opening__symbol');
  const lockup=opening.querySelector('.qelly-opening__wordmark');
  if(symbol)symbol.setAttribute('aria-hidden','true');
  if(lockup){lockup.setAttribute('width','304');lockup.setAttribute('height','84');}
}

function correctAuthComposition(){
  const main=document.getElementById('main');
  const card=main?.querySelector('.q-auth-card');
  const brand=main?.querySelector('[data-qelly-auth-brand]');
  if(card&&brand&&brand.parentElement!==card)card.prepend(brand);
}

function correctStateComposition(){
  const main=document.getElementById('main');
  const selector=document.getElementById('state-selector');
  if(!main||!selector)return;
  const value=selector.value;
  if(stateValues.has(value)){
    main.dataset.qellyStatePage=value;
    main.querySelector('[data-qelly-brand-hero]')?.remove();
    const state=main.querySelector('.q-empty-state,.q-skeleton-grid');
    state?.setAttribute('data-qelly-state-priority','true');
  }else delete main.dataset.qellyStatePage;
}

function correctShellBranding(){
  document.querySelector('.q-edge-dock__brand')?.setAttribute('hidden','');
  const home=document.querySelector('.q-brand-home');
  home?.setAttribute('data-qelly-primary-lockup','true');
  document.querySelector('.q-avatar')?.setAttribute('data-qelly-functional-symbol','account');
}

function refresh(){
  correctOpening();
  correctAuthComposition();
  correctStateComposition();
  correctShellBranding();
}

refresh();
new MutationObserver(refresh).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-motion','data-resolved-appearance','aria-busy']});
document.getElementById('state-selector')?.addEventListener('change',()=>queueMicrotask(refresh));
window.addEventListener('hashchange',()=>requestAnimationFrame(refresh));
window.addEventListener('pageshow',refresh);
root.dataset.brandVisualCorrectionReady='true';
window.QellyBrandVisualCorrection=Object.freeze({refresh,reducedMotion,stateValues:[...stateValues]});
// Exact final-head validation trigger; no product behavior changes below this line.
