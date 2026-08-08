// Qelly Intelligence — UI_LOCK_V5_3 runtime annotations.
// This layer changes presentation state only. Product routes/data/evidence remain authoritative.

const root=document.documentElement;
const rail=document.getElementById('rail');
const main=document.getElementById('main');
const contextDrawer=document.getElementById('context-drawer');
const compareTray=document.getElementById('compare-tray');
const collapseButton=document.getElementById('collapse-rail');
const DESKTOP_QUERY='(min-width: 1280px)';
const RAIL_PREF='qelly.ui-lock-v5-3.rail';
const REFINEMENT_STYLESHEET=new URL('./qelly-v53-visible-refinement.css',import.meta.url).href;

root.dataset.uiLockV53='active';
root.dataset.uiLockV53Approved='2026-08-08';
root.dataset.uiLockV53DesignSha='e077489ba482f0df9258a14c0074adb1bc9eee02d4740b7fb683fdf7df3b2855';
root.dataset.uiLockV53Refinement='2026-08-09';

function activateVisibleRefinement(){
  if(document.querySelector('link[data-qelly-v53-refinement="active"]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=REFINEMENT_STYLESHEET;
  link.dataset.qellyV53Refinement='active';
  document.head.append(link);
}

function annotateNavLinks(scope=document){
  scope.querySelectorAll?.('.q-nav-link').forEach((link)=>{
    const label=link.querySelector('span:not(.q-nav-icon):not(.q-nav-meta)')?.textContent?.trim();
    if(!label)return;
    if(!link.getAttribute('aria-label'))link.setAttribute('aria-label',label);
    if(!link.getAttribute('title'))link.setAttribute('title',label);
  });
}

function annotateEvidence(scope=document){
  scope.querySelectorAll?.('.q-panel,.q-card,.q-research-card').forEach((panel)=>{
    const hasEvidence=Boolean(panel.querySelector('.q-source-line,[data-evidence],[data-source],[data-provenance],.q-evidence,.q-methodology'));
    panel.dataset.v53EvidenceAdjacent=hasEvidence?'true':'false';
  });
}

function annotateShell(){
  document.querySelector('.q-global-strip')?.setAttribute('data-qelly-shell-layer','system-strip');
  document.querySelector('.q-command-bar')?.setAttribute('data-qelly-shell-layer','command-bar');
  rail?.setAttribute('data-qelly-shell-layer','navigation-rail');
  document.getElementById('context-shelf')?.setAttribute('data-qelly-shell-layer','context-bar');
  main?.setAttribute('data-qelly-shell-layer','analytical-workspace');
  if(contextDrawer){
    contextDrawer.setAttribute('data-qelly-shell-layer','intelligence-inspector');
    contextDrawer.setAttribute('aria-label','Intelligence Inspector — source context');
  }
  if(compareTray){
    compareTray.setAttribute('data-qelly-shell-layer','activity-tray');
    compareTray.classList.add('q-v53-activity-tray');
    compareTray.setAttribute('aria-label','Activity and intelligence actions');
  }
}

function storedRailPreference(){
  try{return localStorage.getItem(RAIL_PREF)}catch{return null}
}

function applyCompactRailDefault(){
  if(!rail)return;
  const desktop=matchMedia(DESKTOP_QUERY).matches;
  const stored=storedRailPreference();
  if(stored==='expanded')rail.classList.remove('is-collapsed');
  else if(stored==='compact')rail.classList.add('is-collapsed');
  else if(desktop)rail.classList.add('is-collapsed');
  annotateNavLinks(rail);
}

function persistRailPreference(){
  if(!rail)return;
  try{localStorage.setItem(RAIL_PREF,rail.classList.contains('is-collapsed')?'compact':'expanded')}catch{}
  annotateNavLinks(rail);
}

function markRoute(){
  if(!main)return;
  const route=location.hash.replace(/^#\//,'').split(/[?/#]/)[0]||'market';
  main.dataset.v53Route=route;
  root.dataset.v53Route=route;
}

function refresh(scope=document){
  annotateShell();
  annotateNavLinks(scope);
  annotateEvidence(scope);
  markRoute();
}

collapseButton?.addEventListener('click',()=>requestAnimationFrame(persistRailPreference));
matchMedia(DESKTOP_QUERY).addEventListener?.('change',()=>{
  if(storedRailPreference()===null)applyCompactRailDefault();
});
window.addEventListener('hashchange',()=>requestAnimationFrame(()=>refresh(main||document)));

if(main){
  const observer=new MutationObserver((mutations)=>{
    if(!mutations.some((mutation)=>mutation.type==='childList'&&mutation.addedNodes.length))return;
    requestAnimationFrame(()=>refresh(main));
  });
  observer.observe(main,{childList:true,subtree:true});
}

activateVisibleRefinement();
applyCompactRailDefault();
refresh();
