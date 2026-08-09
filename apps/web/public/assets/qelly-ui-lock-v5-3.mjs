// Qelly Intelligence — UI_LOCK_V5_3 runtime annotations.
// This layer changes presentation state only. Product routes/data/evidence remain authoritative.

const root=document.documentElement;
const rail=document.getElementById('rail');
const main=document.getElementById('main');
const contextDrawer=document.getElementById('context-drawer');
const compareTray=document.getElementById('compare-tray');
const collapseButton=document.getElementById('collapse-rail');
const DESKTOP_QUERY='(min-width: 1280px)';
const REDUCED_MOTION_QUERY='(prefers-reduced-motion: reduce)';
const RAIL_PREF='qelly.ui-lock-v5-3.rail';
const REFINEMENT_STYLESHEET=new URL('./qelly-v53-visible-refinement.css',import.meta.url).href;
const FAMILY_RUNTIME=new URL('./qelly-v53-family-harmonization.mjs',import.meta.url).href;
const COLOR_BLIND_MARKET_TOKENS=Object.freeze({positive:'#168AAD',negative:'#D1495B',warning:'#F3A712'});

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

async function activateFamilyHarmonization(){
  if(root.dataset.v53FamilyRuntimeRequested==='true')return;
  root.dataset.v53FamilyRuntimeRequested='true';
  try{
    await import(FAMILY_RUNTIME);
    root.dataset.v53FamilyRuntime='active';
  }catch(error){
    root.dataset.v53FamilyRuntime='unavailable';
    console.error('Qelly V5.3 family harmonization failed to load',error);
  }
}

async function activateThemePreferenceBridge(){
  if(root.dataset.v53ThemePreferenceBridgeRequested==='true')return;
  root.dataset.v53ThemePreferenceBridgeRequested='true';
  try{
    const {themeIntelligence}=await import('./theme-intelligence.mjs');
    const applyPalette=(snapshot=themeIntelligence.snapshot())=>{
      const palette=snapshot?.config?.marketPalette||'semantic';
      root.dataset.marketPalette=palette;
      if(palette!=='color-blind')return;
      const aliases={
        '--q-positive':COLOR_BLIND_MARKET_TOKENS.positive,
        '--q-negative':COLOR_BLIND_MARKET_TOKENS.negative,
        '--q-warning':COLOR_BLIND_MARKET_TOKENS.warning,
        '--q-premium-positive':COLOR_BLIND_MARKET_TOKENS.positive,
        '--q-premium-negative':COLOR_BLIND_MARKET_TOKENS.negative,
        '--q-premium-warning':COLOR_BLIND_MARKET_TOKENS.warning,
        '--q-market-positive':COLOR_BLIND_MARKET_TOKENS.positive,
        '--q-market-negative':COLOR_BLIND_MARKET_TOKENS.negative,
        '--q-market-warning':COLOR_BLIND_MARKET_TOKENS.warning
      };
      for(const [name,value] of Object.entries(aliases))root.style.setProperty(name,value);
    };
    applyPalette(themeIntelligence.snapshot());
    themeIntelligence.subscribe(applyPalette);
    root.dataset.v53ThemePreferenceBridge='active';
  }catch(error){
    root.dataset.v53ThemePreferenceBridge='unavailable';
    console.error('Qelly V5.3 Theme Intelligence preference bridge failed to load',error);
  }
}

function reducedMotionActive(){
  return root.dataset.motion==='reduced'||matchMedia(REDUCED_MOTION_QUERY).matches;
}

function revealReducedMotionContent(scope=document){
  if(!reducedMotionActive())return;
  scope.querySelectorAll?.('.q-motion-item:not(.is-inview)').forEach((item)=>item.classList.add('is-inview'));
  root.dataset.v53ReducedMotionReveal='immediate';
}

function annotateNavLinks(scope=document){
  scope.querySelectorAll?.('.q-nav-link').forEach((link)=>{
    const label=link.querySelector('span:not(.q-nav-icon):not(.q-nav-meta)')?.textContent?.trim();
    if(!label)return;
    if(!link.getAttribute('aria-label'))link.setAttribute('aria-label',label);
    if(!link.getAttribute('title'))link.setAttribute('title',label);
  });
}

function annotateDecisionProvenanceControls(scope=document){
  const confidence=scope.querySelector?.('input[name="evidenceConfidence"]');
  const scenario=scope.querySelector?.('input[name="scenarioMove"]');
  if(confidence&&!confidence.getAttribute('aria-label'))confidence.setAttribute('aria-label','User-assessed evidence confidence');
  if(scenario&&!scenario.getAttribute('aria-label'))scenario.setAttribute('aria-label','Scenario move');
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
  annotateDecisionProvenanceControls(scope);
  annotateEvidence(scope);
  revealReducedMotionContent(scope);
  markRoute();
}

collapseButton?.addEventListener('click',()=>requestAnimationFrame(persistRailPreference));
matchMedia(DESKTOP_QUERY).addEventListener?.('change',()=>{
  if(storedRailPreference()===null)applyCompactRailDefault();
});
const reducedMotionMedia=matchMedia(REDUCED_MOTION_QUERY);
reducedMotionMedia.addEventListener?.('change',()=>requestAnimationFrame(()=>revealReducedMotionContent(document)));
window.addEventListener('hashchange',()=>requestAnimationFrame(()=>refresh(main||document)));

if(main){
  const observer=new MutationObserver((mutations)=>{
    const relevant=mutations.some((mutation)=>(mutation.type==='childList'&&mutation.addedNodes.length)||mutation.type==='attributes');
    if(!relevant)return;
    requestAnimationFrame(()=>refresh(main));
  });
  observer.observe(main,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
}

activateVisibleRefinement();
void activateFamilyHarmonization();
void activateThemePreferenceBridge();
applyCompactRailDefault();
refresh();