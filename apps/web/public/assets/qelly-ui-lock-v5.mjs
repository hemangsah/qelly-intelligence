// Qelly Intelligence — UI_LOCK_V5 motion/runtime foundation.
// Non-destructive enhancement layer. Existing routes, truth states and product logic remain authoritative.

const root=document.documentElement;
const main=document.getElementById('main');
const commandBar=document.querySelector('.q-command-bar');
const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||root.dataset.motion==='reduced';

root.dataset.uiLockV5='active';
root.dataset.uiLockV5Approved='2026-08-07';

function markRouteEntry(){
  if(!main)return;
  main.dataset.v5RouteEnter='false';
  if(reduceMotion())return;
  requestAnimationFrame(()=>{
    main.dataset.v5RouteEnter='true';
    window.setTimeout(()=>{main.dataset.v5RouteEnter='false';},360);
  });
}

function refreshScrolledState(){
  if(!commandBar)return;
  commandBar.dataset.v5Scrolled=window.scrollY>10?'true':'false';
}

function annotateAnalyticalCurves(scope=document){
  const selectors=[
    '.q-ti-chart-line',
    '.q-mi-chart path[data-series]',
    '.q-chart path[data-series]',
    'svg [data-qelly-trajectory]'
  ];
  scope.querySelectorAll?.(selectors.join(',')).forEach((element)=>{
    if(element.closest('[aria-hidden="true"]'))return;
    element.classList.add('q-v5-animated-path');
  });
}

function protectSemanticMotion(){
  const prefersReduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.dataset.v5ReducedMotion=prefersReduced?'true':'false';
  if(prefersReduced)root.dataset.motion='reduced';
}

function refresh(){
  protectSemanticMotion();
  annotateAnalyticalCurves();
  refreshScrolledState();
}

let lastHash=location.hash;
window.addEventListener('hashchange',()=>{
  if(lastHash===location.hash)return;
  lastHash=location.hash;
  markRouteEntry();
  requestAnimationFrame(refresh);
});

window.addEventListener('scroll',refreshScrolledState,{passive:true});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',refresh);

if(main){
  const observer=new MutationObserver((mutations)=>{
    if(!mutations.some((mutation)=>mutation.type==='childList'&&mutation.addedNodes.length))return;
    annotateAnalyticalCurves(main);
  });
  observer.observe(main,{childList:true,subtree:true});
}

refresh();
markRouteEntry();
