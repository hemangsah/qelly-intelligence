const root=document.documentElement;
const header=()=>document.querySelector('header.q-product-header');
let frame=0;
const interactiveSelector='button:not(:disabled),a[href],[role="button"]:not([aria-disabled="true"]),[role="link"]:not([aria-disabled="true"]),[role="tab"]:not([aria-disabled="true"])';
let engagedControl=null;

function updateScrollState(){
  frame=0;
  header()?.classList.toggle('is-scrolled',window.scrollY>8);
}

function requestScrollUpdate(){
  if(frame)return;
  frame=requestAnimationFrame(updateScrollState);
}

function releaseControl(){
  engagedControl?.classList.remove('is-interacting');
  engagedControl=null;
}

function engageControl(target){
  const control=target instanceof Element?target.closest(interactiveSelector):null;
  if(!control)return;
  releaseControl();
  engagedControl=control;
  control.classList.add('is-interacting');
}

function normalizeInteractionContracts(scope=document){
  const links=scope instanceof Element&&scope.matches('a[target="_blank"]')?[scope]:[...scope.querySelectorAll?.('a[target="_blank"]')||[]];
  for(const link of links){
    const rel=new Set((link.getAttribute('rel')||'').split(/\s+/).filter(Boolean));
    rel.add('noopener');
    rel.add('noreferrer');
    link.setAttribute('rel',[...rel].join(' '));
  }
  const controls=scope instanceof Element&&scope.matches('button:disabled,[role="button"][aria-disabled="true"]')?[scope]:[...scope.querySelectorAll?.('button:disabled,[role="button"][aria-disabled="true"]')||[]];
  for(const control of controls)control.setAttribute('aria-disabled','true');
}

document.addEventListener('pointerdown',(event)=>engageControl(event.target),{passive:true});
document.addEventListener('pointerup',releaseControl,{passive:true});
document.addEventListener('pointercancel',releaseControl,{passive:true});
document.addEventListener('keydown',(event)=>{if(event.key==='Enter'||event.key===' ')engageControl(event.target)});
document.addEventListener('keyup',(event)=>{if(event.key==='Enter'||event.key===' ')releaseControl()});
window.addEventListener('blur',releaseControl);

const interactionObserver=new MutationObserver((records)=>{
  for(const record of records)for(const node of record.addedNodes)if(node instanceof Element)normalizeInteractionContracts(node);
});

root.dataset.productExperience='ready';
root.dataset.interactionDiscipline='ready';
window.addEventListener('scroll',requestScrollUpdate,{passive:true});
window.addEventListener('hashchange',()=>requestAnimationFrame(updateScrollState));
normalizeInteractionContracts();
interactionObserver.observe(document.body,{childList:true,subtree:true});
updateScrollState();
