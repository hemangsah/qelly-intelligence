const root=document.documentElement;
const stateValues=new Set(['loading','empty','offline','error']);
const productSymbolAsset=new URL('./brand/qelly-symbol.svg',import.meta.url).href;
const primaryLogoAsset=new URL('./brand/qelly-logo-primary.svg',import.meta.url).href;

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

function officialImage(element,{compact=false}={}){
  if(!element)return null;
  let image=element.querySelector('img');
  if(!image){
    element.replaceChildren();
    image=document.createElement('img');
    element.append(image);
  }
  image.src=compact?productSymbolAsset:primaryLogoAsset;
  image.alt='';
  image.decoding='async';
  image.setAttribute('aria-hidden','true');
  image.dataset.qellyOfficialMark='true';
  image.width=compact?42:181;
  image.height=compact?42:50;
  return image;
}

function correctShellBranding(){
  const globalBrand=document.querySelector('.q-brand-home,[data-qelly-primary-lockup]');
  if(globalBrand){
    globalBrand.dataset.qellyPrimaryLockup='true';
    officialImage(globalBrand);
  }
  const edgeBrand=document.querySelector('.q-edge-dock__brand');
  if(edgeBrand){
    edgeBrand.removeAttribute('hidden');
    edgeBrand.dataset.qellyOfficialBrand='true';
    edgeBrand.setAttribute('aria-label','Qelly Intelligence home');
    officialImage(edgeBrand,{compact:true});
  }
  document.querySelectorAll('.q-edge-dock__brand').forEach((brand)=>{
    for(const node of [...brand.childNodes]){
      if(node.nodeType===Node.TEXT_NODE&&node.textContent?.trim())node.remove();
    }
  });
  document.querySelector('.q-avatar')?.setAttribute('data-qelly-functional-symbol','account');
}

function correctProductHeaderBrand(){
  const brand=document.querySelector('.q-product-brand');
  const mark=brand?.querySelector('.q-product-brand__mark');
  if(!brand||!mark)return;
  let image=mark;
  if(mark.tagName!=='IMG'){
    image=document.createElement('img');
    image.className=mark.className;
    mark.replaceWith(image);
  }
  image.src=productSymbolAsset;
  image.alt='';
  image.width=38;
  image.height=38;
  image.decoding='async';
  image.setAttribute('aria-hidden','true');
  image.dataset.qellyOfficialMark='true';
  image.style.setProperty('box-sizing','border-box');
  image.style.setProperty('object-fit','contain');
  image.style.setProperty('padding','3px');
  image.style.setProperty('background','#f8f5f2');
  brand.dataset.qellyOfficialBrand='true';
}

function refresh(){
  correctOpening();
  correctAuthComposition();
  correctStateComposition();
  correctShellBranding();
  correctProductHeaderBrand();
}

refresh();
new MutationObserver(refresh).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-motion','data-resolved-appearance','aria-busy']});
document.getElementById('state-selector')?.addEventListener('change',()=>queueMicrotask(refresh));
window.addEventListener('hashchange',()=>requestAnimationFrame(refresh));
window.addEventListener('pageshow',refresh);
root.dataset.brandVisualCorrectionReady='true';
window.QellyBrandVisualCorrection=Object.freeze({refresh,reducedMotion,stateValues:[...stateValues]});
