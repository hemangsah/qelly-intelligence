let densityMedia=null;
let observer=null;
let readyResolve=null;
let readySettled=false;

const PHONE_PRESENTATION=[
  ['.q-kpi-grid',{'display':'grid','grid-template-columns':'repeat(2,minmax(0,1fr))','gap':'8px'}],
  ['.q-kpi',{'min-height':'0','padding':'10px'}],
  ['.q-provider-grid',{'display':'flex','gap':'8px','overflow-x':'auto','overscroll-behavior-inline':'contain','scroll-snap-type':'x proximity','padding-bottom':'4px'}],
  ['.q-provider-grid > .q-provider-card',{'flex':'0 0 min(88vw,340px)','width':'auto','min-width':'0','scroll-snap-align':'start'}]
];

const isDataMeshHash=()=>location.hash==='#/data-mesh'||location.hash.startsWith('#/data-mesh?');

function setPresentation(element,styles,active){
  if(!element)return;
  for(const [name,value] of Object.entries(styles)){
    if(active)element.style.setProperty(name,value,'important');
    else element.style.removeProperty(name);
  }
}

function resolveReady(){
  if(readySettled)return;
  readySettled=true;
  readyResolve?.();
}

function applyDataMeshDensity(){
  const main=document.getElementById('main');
  const page=main?.querySelector('.q-page');
  const providerGrid=page?.querySelector('.q-provider-grid');
  const runtimeResult=page?.querySelector('#runtime-result');
  const quoteAction=page?.querySelector('[data-action="test-quote"]');
  const isDataMesh=Boolean(providerGrid&&runtimeResult&&quoteAction);
  if(!isDataMesh){
    document.documentElement.dataset.dataMeshDensity='inactive';
    if(!isDataMeshHash())resolveReady();
    return false;
  }
  const active=Boolean(densityMedia?.matches);
  for(const [selector,styles] of PHONE_PRESENTATION){
    page.querySelectorAll(selector).forEach((element)=>setPresentation(element,styles,active));
  }
  if(active){
    providerGrid.tabIndex=0;
    providerGrid.setAttribute('role','region');
    providerGrid.setAttribute('aria-label','Provider runtime registry');
  }else{
    providerGrid.removeAttribute('tabindex');
    providerGrid.removeAttribute('role');
    providerGrid.removeAttribute('aria-label');
  }
  page.dataset.dataMeshMobileDensity=active?'active':'desktop';
  document.documentElement.dataset.dataMeshDensity=active?'active':'desktop';
  resolveReady();
  return true;
}

function install(){
  const main=document.getElementById('main');
  if(!main||typeof MutationObserver!=='function'){
    resolveReady();
    return;
  }
  densityMedia=typeof globalThis.matchMedia==='function'?globalThis.matchMedia('(max-width: 620px)'):null;
  observer=new MutationObserver(()=>applyDataMeshDensity());
  observer.observe(main,{childList:true,subtree:true});
  densityMedia?.addEventListener?.('change',()=>applyDataMeshDensity());
  queueMicrotask(()=>applyDataMeshDensity());
}

window.__qellyDataMeshEnhancementReady=new Promise((resolve)=>{readyResolve=resolve;});
install();
