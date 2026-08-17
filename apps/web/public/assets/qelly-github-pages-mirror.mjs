// Qelly GitHub Pages public mirror guard.
// The mirror renders public terminal surfaces against the canonical Cloudflare
// read-only API. Authenticated/private routes stay on Cloudflare because
// HttpOnly session cookies are intentionally not shared across origins.

const config=window.__QELLY_CONFIG__||{};
const active=config.mirrorMode==='github-pages-public';
const canonical=String(config.canonicalSiteUrl||'').replace(/\/$/,'');
const routeState=(hash=location.hash)=>{
  const raw=String(hash||'').replace(/^#\/?/,'');
  const [path='',query='']=raw.split('?');
  return {route:path.split('/')[0]||'market',path,query};
};
const LOCAL_PUBLIC_ROUTES=new Set([
  'market','live-markets','asset-rankings','asset','calculator-center','india-finance','indicator-library','formula-library','saved-calculations',
  'formula-detail','indicator-detail','calculator-detail','saved-calculation-detail','feature-universe','about-qelly','decision-provenance'
]);
const CANONICAL_ONLY_ROUTES=new Set([
  'auth-login','auth-register','auth-recovery','account-session','security-setup','passkey-center','account-recovery','secure-import-vault',
  'delivery-operations','platform-readiness','secret-rotation','quarantine-review','staging-assurance','theme-personas',
  'discovery-hub','search','categories','category-detail','venues','venue-detail','dex-discovery','global-charts','converter','news-research',
  'research-article','trust-center','asset-intelligence','advanced-chart','fundamentals-estimates','filing-workspace','event-calendar','comparison-lab',
  'watchlist','alert-center','notification-center','screener-lab','portfolio-analytics','research-workspace','onboarding','notification-schedules',
  'formula-screener','portfolio-attribution','import-center','research-history','migration-center','theme-lab','data-mesh','instrument-master',
  'timeseries-lab','stream-operations','observability','data-quality','decision-provenance-admin'
]);

const canonicalUrl=(hash=location.hash)=>{
  if(!canonical)return null;
  const state=routeState(hash);
  const targetHash=state.path?`#/${state.path}${state.query?`?${state.query}`:''}`:'#/market';
  return `${canonical}/${targetHash}`;
};
const shouldHandoff=(hash=location.hash)=>{
  if(!active)return false;
  const {route}=routeState(hash);
  if(LOCAL_PUBLIC_ROUTES.has(route))return false;
  return CANONICAL_ONLY_ROUTES.has(route)||Boolean(route);
};
const handoff=(hash=location.hash)=>{
  if(!shouldHandoff(hash))return false;
  const target=canonicalUrl(hash);
  if(!target)return false;
  location.replace(target);
  return true;
};

if(active){
  document.documentElement.dataset.githubPagesMirror='public-read-only';
  document.addEventListener('click',(event)=>{
    const link=event.target.closest?.('a[href^="#/"]');
    if(!link)return;
    const href=link.getAttribute('href');
    if(!shouldHandoff(href))return;
    event.preventDefault();
    const target=canonicalUrl(href);
    if(target)location.assign(target);
  },{capture:true});
  window.addEventListener('hashchange',()=>handoff());
  queueMicrotask(()=>handoff());
}

window.QellyGithubPagesMirror=Object.freeze({active,canonical,routeState,shouldHandoff,canonicalUrl,handoff,LOCAL_PUBLIC_ROUTES,CANONICAL_ONLY_ROUTES});
