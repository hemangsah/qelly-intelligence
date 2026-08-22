const root=document.documentElement;
const asset=(name)=>new URL(`./brand/${name}`,import.meta.url).href;
const appearance=()=>root.dataset.resolvedAppearance||root.dataset.appearance||'dark';
const isLight=()=>appearance()==='light';
const horizontalLogo=()=>asset(isLight()?'qelly-logo-light.svg':'qelly-logo-dark.svg');
const symbolLogo=()=>asset(isLight()?'qelly-symbol.svg':'qelly-symbol-dark.svg');
const blockingStates=new Set(['loading','empty','offline','error']);
const productionProduct=()=>root.dataset.productSurface==='production'||window.__QELLY_CONFIG__?.staticVisualPreview===false;

function installShellBrand(){
  const target=document.querySelector('.q-brand-mark');
  if(target&&!target.dataset.brandInstalled){
    target.dataset.brandInstalled='true';
    target.innerHTML=`<a class="q-brand-home" href="#/market" aria-label="Qelly Intelligence home"><img data-lockup width="304" height="84" src="${horizontalLogo()}" alt="Qelly"><img class="q-brand-symbol" width="84" height="84" src="${symbolLogo()}" alt="" aria-hidden="true"></a>`;
  }
  const avatar=document.querySelector('.q-avatar');
  if(avatar&&!avatar.dataset.brandInstalled){
    avatar.dataset.brandInstalled='true';
    avatar.innerHTML=`<img class="q-brand-symbol" width="84" height="84" src="${symbolLogo()}" alt="">`;
  }
}
function updateVariants(){
  document.querySelectorAll('.q-brand-home img[data-lockup]').forEach((node)=>node.src=horizontalLogo());
  document.querySelectorAll('.q-brand-symbol').forEach((node)=>node.src=symbolLogo());
  const opening=document.querySelector('.qelly-opening');
  if(opening){
    const symbol=opening.querySelector('.qelly-opening__symbol');
    const wordmark=opening.querySelector('.qelly-opening__wordmark');
    if(symbol)symbol.src=symbolLogo();
    if(wordmark)wordmark.src=horizontalLogo();
  }
}
function installOpening(){
  if(document.querySelector('.qelly-opening'))return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||root.dataset.motion==='reduced'||root.dataset.motion==='none';
  const seen=sessionStorage.getItem('qelly.brand.opening.v1')==='seen';
  if(seen)return;
  const overlay=document.createElement('div');
  overlay.className=`qelly-opening ${reduced?'is-reduced':'is-full'}`;
  overlay.setAttribute('role','status');
  overlay.setAttribute('aria-label','Opening Qelly Intelligence');
  overlay.innerHTML=`<div class="qelly-opening__inner"><img class="qelly-opening__symbol" width="84" height="84" src="${symbolLogo()}" alt="" aria-hidden="true"><img class="qelly-opening__wordmark" width="304" height="84" src="${horizontalLogo()}" alt="Qelly"><span class="qelly-opening__line">Evidence before action</span></div>`;
  document.body.prepend(overlay);
  sessionStorage.setItem('qelly.brand.opening.v1','seen');
  const duration=reduced?120:1180;
  const finish=()=>{overlay.classList.add('is-leaving');setTimeout(()=>overlay.remove(),reduced?0:300)};
  const reviewHold=root.dataset.qellyReviewHoldOpening==='true';
  if(!reviewHold)setTimeout(finish,duration);
  overlay.addEventListener('click',finish,{once:true});
}
function heroMarkup(){
  return `<section class="qelly-hero" data-qelly-brand-hero aria-labelledby="qelly-hero-title">
    <div class="qelly-hero__grid">
      <div>
        <img class="qelly-hero__logo" width="304" height="84" src="${horizontalLogo()}" alt="Qelly">
        <p class="q-eyebrow">Verifiable market intelligence</p>
        <h1 id="qelly-hero-title">See the evidence behind every market signal.</h1>
        <p>Qelly unifies market structure, research context, source provenance and decision history in one governed intelligence workspace—without pretending simulated preview data is live.</p>
        <div class="qelly-hero__actions">
          <a class="qelly-hero__primary" href="#/asset-rankings">Explore Asset Rankings</a>
          <a class="qelly-hero__secondary" href="#/theme-personas">Open Theme Studio</a>
        </div>
        <div class="qelly-hero__truth">Static preview uses deterministic demo observations. Trading execution remains unavailable.</div>
      </div>
      <div class="qelly-product-preview" aria-label="Qelly product preview">
        <div class="qelly-product-preview__bar"><strong>Intelligence preview</strong><span class="q-status q-status--simulated">DEMO</span></div>
        <div class="qelly-product-preview__metrics">
          <div class="qelly-product-preview__metric"><small>BTC confidence</small><strong>82 / 100</strong></div>
          <div class="qelly-product-preview__metric"><small>Liquidity state</small><strong>Balanced</strong></div>
          <div class="qelly-product-preview__metric"><small>Evidence age</small><strong>2m 14s</strong></div>
        </div>
        <div class="qelly-product-preview__chart" aria-label="Illustrative market trajectory">
          <svg viewBox="0 0 520 130" role="img" aria-label="Illustrative rising and consolidating price path"><path d="M0 110 C65 96 88 103 130 72 S210 96 255 58 S335 72 390 35 S455 47 520 18" fill="none" stroke="var(--q-brand-burgundy)" stroke-width="4"/><circle cx="390" cy="35" r="5" fill="var(--q-brand-node-green)"/><circle cx="520" cy="18" r="5" fill="var(--q-brand-node-red)"/></svg>
        </div>
        <div class="qelly-product-preview__row"><strong>ETH</strong><span>Research aligned</span><span class="q-positive">+0.92%</span></div>
        <div class="qelly-product-preview__row"><strong>SOL</strong><span>Volatility elevated</span><span class="q-negative">−1.18%</span></div>
      </div>
    </div>
  </section>`;
}
function installHero(){
  if(productionProduct())return;
  const main=document.getElementById('main');
  const previewState=document.getElementById('state-selector')?.value;
  if(!main||!location.hash.match(/^#\/?market(?:$|[/?])/))return;
  if(main.dataset.qellyStatePage||blockingStates.has(previewState))return;
  if(main.querySelector('[data-qelly-brand-hero]'))return;
  main.insertAdjacentHTML('afterbegin',heroMarkup());
  const routeTitle=[...main.querySelectorAll('h1')].find((heading)=>!heading.closest('[data-qelly-brand-hero]'));
  if(routeTitle){
    const sectionTitle=document.createElement('h2');
    for(const attribute of routeTitle.attributes)sectionTitle.setAttribute(attribute.name,attribute.value);
    sectionTitle.append(...routeTitle.childNodes);
    routeTitle.replaceWith(sectionTitle);
  }
}
function installAuthBrand(){
  if(productionProduct())return;
  const main=document.getElementById('main');
  if(!main||!/^#\/?auth-(login|register|recovery)/.test(location.hash))return;
  const host=main.querySelector('.q-auth-card')||main.querySelector('.q-auth-shell,form')?.parentElement||main.firstElementChild;
  if(!host||host.querySelector('[data-qelly-auth-brand]'))return;
  const block=document.createElement('div');
  block.className='qelly-brand-auth';
  block.dataset.qellyAuthBrand='true';
  block.innerHTML=`<img width="304" height="84" src="${horizontalLogo()}" alt="Qelly"><p>Secure access to evidence-backed intelligence.</p>`;
  host.prepend(block);
}
function installStateBrand(){
  if(productionProduct()){
    document.querySelectorAll('.qelly-state-brand').forEach((node)=>node.remove());
    return;
  }
  document.querySelectorAll('.q-state-banner,.q-empty-state,.q-error-state,[data-state="empty"],[data-state="error"]').forEach((node)=>{
    if(node.querySelector('.qelly-state-brand'))return;
    const image=document.createElement('img');
    image.className='qelly-state-brand';
    image.width=84;
    image.height=84;
    image.src=symbolLogo();
    image.alt='';
    image.setAttribute('aria-hidden','true');
    node.prepend(image);
  });
}
function installCommandBrand(){
  const dialog=document.querySelector('[role="dialog"]');
  if(!dialog||dialog.querySelector('.qelly-command-brand'))return;
  const commandInput=dialog.querySelector('input,[role="combobox"]');
  if(!commandInput)return;
  const row=document.createElement('div');
  row.className='qelly-command-brand';
  row.innerHTML=`<img width="304" height="84" src="${horizontalLogo()}" alt="Qelly"><span>Command intelligence</span>`;
  dialog.prepend(row);
}
function enforceProductionBoundary(){
  if(!productionProduct())return;
  document.querySelectorAll('[data-qelly-brand-hero],[data-qelly-auth-brand]').forEach((node)=>node.remove());
}
function refresh(){
  installShellBrand();
  enforceProductionBoundary();
  if(!productionProduct()){
    installHero();
    installAuthBrand();
  }
  installStateBrand();
  installCommandBrand();
}
installOpening();
refresh();
new MutationObserver(refresh).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>requestAnimationFrame(refresh));
new MutationObserver(updateVariants).observe(root,{attributes:true,attributeFilter:['data-appearance','data-resolved-appearance','data-theme-family']});
window.addEventListener('pageshow',updateVariants);
root.dataset.brandReady='true';
