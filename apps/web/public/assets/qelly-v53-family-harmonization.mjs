// Qelly Intelligence — V5.3 route-family harmonization.
// Presentation metadata only: no provider, auth, persistence or write semantics.

export const ROUTE_FAMILIES=Object.freeze({
  'market-command':Object.freeze(['live-markets','advanced-chart','market','rankings','asset','asset-intelligence','asset-rankings','discovery-hub','search','categories','category-detail','venues','venue-detail','dex-discovery','global-charts','converter','timeseries-lab','stream-operations','instrument-master']),
  'research-evidence':Object.freeze(['news-research','research-article','research-workspace','research-history','filing-workspace','fundamentals-estimates','event-calendar','comparison-lab']),
  'portfolio-risk':Object.freeze(['watchlist','alert-center','notification-center','notification-schedules','screener-lab','formula-screener','portfolio-analytics','portfolio-attribution','onboarding','import-center']),
  'quant-verify':Object.freeze(['calculator-center','india-finance','indicator-library','formula-library','saved-calculations','formula-detail','indicator-detail','calculator-detail','saved-calculation-detail','qelly-verify']),
  'theme-security':Object.freeze(['theme-personas','theme-lab','identity-access','security-setup','passkey-center','account-recovery','account-session','auth-login','auth-register','auth-recovery','secret-rotation','security-evidence']),
  'operations-public':Object.freeze(['secure-import-vault','delivery-operations','platform-readiness','quarantine-review','staging-assurance','migration-center','data-mesh','observability','decision-provenance','feature-universe','about-qelly','trust-center'])
});

export const FAMILY_ROUTE_COUNT=Object.values(ROUTE_FAMILIES).reduce((total,routes)=>total+routes.length,0);
export const FAMILY_STYLESHEET=new URL('./qelly-v53-family-harmonization.css',import.meta.url).href;
const ROUTE_TO_FAMILY=new Map(Object.entries(ROUTE_FAMILIES).flatMap(([family,routes])=>routes.map((route)=>[route,family])));
const CLOUD_SELECTORS='[data-cloud-state],[data-sync-state],[data-cloud-status],[data-sync-status],.q-cloud-state,.q-sync-state,.q-cloud-status,.q-sync-status';

export function routeFamilyFor(route){return ROUTE_TO_FAMILY.get(route)||'unmapped';}
export function currentRoute(hash=''){
  return String(hash||'').replace(/^#\//,'').split(/[?/#]/)[0]||'market';
}
export function viewportMode(width){
  const value=Number(width)||0;
  if(value<=360)return'phone-360';
  if(value<=390)return'phone-390';
  if(value<=430)return'phone-430';
  if(value<=768)return'tablet-768';
  if(value<=1024)return'tablet-1024';
  if(value<1280)return'compact-desktop';
  if(value<1440)return'desktop-1280';
  if(value<1728)return'desktop-1440';
  if(value<1920)return'desktop-1728';
  return'desktop-1920';
}

function loadFamilyStyles(){
  if(document.querySelector('link[data-qelly-v53-family-harmonization="active"]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=FAMILY_STYLESHEET;
  link.dataset.qellyV53FamilyHarmonization='active';
  document.head.append(link);
}

function normalizedCloudLifecycle(node){
  const raw=[node.dataset?.cloudState,node.dataset?.syncState,node.dataset?.cloudStatus,node.dataset?.syncStatus,node.getAttribute?.('aria-label'),node.textContent]
    .filter(Boolean).join(' ').toLowerCase();
  if(/conflict/.test(raw))return'conflict';
  if(/offline/.test(raw))return'offline';
  if(/stale/.test(raw))return'stale';
  if(/partial|degraded|delayed/.test(raw))return'partial';
  if(/queue|pending|syncing|uploading|downloading/.test(raw))return'pending';
  if(/error|fail|unavailable|blocked/.test(raw))return'unavailable';
  if(/complete|synced|ready|online|available/.test(raw))return'ready';
  return'unknown';
}

function decorateCloudStates(scope=document){
  scope.querySelectorAll?.(CLOUD_SELECTORS).forEach((node)=>{
    node.dataset.v53CloudLifecycle=normalizedCloudLifecycle(node);
    node.dataset.v53CloudPresentation='existing-state';
  });
}

function annotateVerify(scope=document){
  scope.querySelectorAll?.('.q-verify-page').forEach((page)=>{
    page.dataset.v53ProductFamily='qelly-verify';
    page.dataset.v53EvidenceAdjacent='true';
  });
  scope.querySelectorAll?.('.q-verify-report,.q-verify-panel,.q-verify-evidence-grid>article').forEach((node)=>{
    node.dataset.v53EvidenceAdjacent='true';
  });
}

function annotateCurrentRoute(){
  const route=currentRoute(location.hash);
  const family=routeFamilyFor(route);
  const main=document.getElementById('main');
  document.documentElement.dataset.v53Route=route;
  document.documentElement.dataset.v53Family=family;
  document.documentElement.dataset.v53FamilyRouteCount=String(FAMILY_ROUTE_COUNT);
  if(main){
    main.dataset.v53Route=route;
    main.dataset.v53Family=family;
    main.dataset.v53PrimaryTask='true';
  }
}

function annotateViewport(){
  document.documentElement.dataset.v53Viewport=viewportMode(window.innerWidth);
}

function refresh(scope=document){
  annotateCurrentRoute();
  annotateViewport();
  annotateVerify(scope);
  decorateCloudStates(scope);
}

function start(){
  const root=document.documentElement;
  root.setAttribute('data-ui-lock-v5-3','active');
  root.dataset.v53ActivationContract='canonical-with-v53-compatibility-alias';
  root.dataset.v53FamilyHarmonization='active';
  loadFamilyStyles();
  refresh(document);

  const main=document.getElementById('main');
  if(main){
    const observer=new MutationObserver((mutations)=>{
      if(!mutations.some((mutation)=>mutation.type==='childList'||mutation.type==='attributes'))return;
      requestAnimationFrame(()=>refresh(main));
    });
    observer.observe(main,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-cloud-state','data-sync-state','data-cloud-status','data-sync-status']});
  }

  window.addEventListener('hashchange',()=>requestAnimationFrame(()=>refresh(document)));
  window.addEventListener('resize',()=>requestAnimationFrame(annotateViewport),{passive:true});
}

if(typeof document!=='undefined'&&typeof window!=='undefined')start();