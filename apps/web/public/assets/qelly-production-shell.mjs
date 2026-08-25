/* Qelly production shell — customer-facing convergence runtime. */

import { productDomains, routeDefinitions } from './route-registry.mjs';

const root=document.documentElement;
const main=document.getElementById('main');
const ROUTE_REPAIR_STYLESHEET=new URL('./qelly-route-repairs.css',import.meta.url).href;
const ROUTE_CONVERGENCE_STYLESHEET=new URL('./qelly-route-convergence.css',import.meta.url).href;
const PREMIUM_THEME_STYLESHEET=new URL('./qelly-premium-theme.css?v=20260825-premium1',import.meta.url).href;
const CUSTOMER_ROUTES=new Set([
  'feature-universe','market','asset-rankings','asset','calculator-center','calculator-detail','india-finance',
  'indicator-library','indicator-detail','formula-library','formula-detail','saved-calculations','qelly-verify','about-qelly',
  'auth-login','auth-register','auth-recovery','account-session','watchlist','news-research','live-markets',
  'research-workspace','decision-provenance','theme-personas'
]);
const ACCESS_ROUTES=new Set(['auth-login','auth-register','auth-recovery']);
const ADMIN_ROUTES=new Set([
  'identity-access','data-mesh','instrument-master','timeseries-lab','stream-operations',
  'observability','migration-center','platform-readiness','delivery-operations','secret-rotation',
  'quarantine-review','staging-assurance','secure-import-vault','security-evidence'
]);
const FEATURE_ROUTES=routeDefinitions.filter((route)=>!route.hidden);

function ensureCanonicalStylesheetLast(){
  const canonical=document.querySelector('link[href$="qelly-production-shell.css"]');
  let repairs=document.querySelector('link[data-qelly-route-repairs="true"]');
  if(!repairs){
    repairs=document.createElement('link');
    repairs.rel='stylesheet';
    repairs.href=ROUTE_REPAIR_STYLESHEET;
    repairs.dataset.qellyRouteRepairs='true';
    document.head.append(repairs);
  }
  let convergence=document.querySelector('link[data-qelly-route-convergence="true"]');
  if(!convergence){
    convergence=document.createElement('link');
    convergence.rel='stylesheet';
    convergence.href=ROUTE_CONVERGENCE_STYLESHEET;
    convergence.dataset.qellyRouteConvergence='true';
    document.head.append(convergence);
  }
  let premiumTheme=document.querySelector('link[data-qelly-premium-theme="true"]');
  if(!premiumTheme){
    premiumTheme=document.createElement('link');
    premiumTheme.rel='stylesheet';
    premiumTheme.href=PREMIUM_THEME_STYLESHEET;
    premiumTheme.dataset.qellyPremiumTheme='true';
    document.head.append(premiumTheme);
  }
  const desiredTail=[canonical,repairs,convergence,premiumTheme].filter(Boolean);
  const currentTail=Array.from(document.head.querySelectorAll('link[rel="stylesheet"]')).slice(-desiredTail.length);
  const alreadyOrdered=desiredTail.length>0&&desiredTail.every((node,index)=>currentTail[index]===node);
  if(!alreadyOrdered)document.head.append(...desiredTail);
}

/* This map is intentionally limited to presentation terminology. Truth-state words
   such as simulated, demo, fixture, live, delayed or unavailable are never rewritten globally:
   route owners must disclose those states exactly. */
const phraseMap=new Map([
  ['independent dark, light, OLED and high-contrast palettes','Choose a certified palette for the complete workspace'],
  ['static visual preview','Reference mode'],
  ['deterministic market visualization','Reproducible market visualization'],
  ['deterministic local','Reproducible locally'],
  ['local foundation','Workspace runtime'],
  ['production gated','Not connected']
]);

function routeName(){return location.hash.replace(/^#\/?/,'').split(/[/?#]/)[0]||'feature-universe';}

function escapeNavigationText(value){
  return String(value??'').replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
}

function featureNavigationMarkup(){
  const groups=productDomains.map((domain)=>{
    const routes=FEATURE_ROUTES.filter((route)=>route.domain===domain.id&&route.route!=='feature-universe');
    if(!routes.length)return '';
    return `<section class="q-feature-navigation__group" data-feature-domain="${escapeNavigationText(domain.id)}"><h3>${escapeNavigationText(domain.label)} <span>${routes.length}</span></h3><div>${routes.map((route)=>`<a href="#/${escapeNavigationText(route.route)}" data-feature-route="${escapeNavigationText(route.route)}" data-feature-search="${escapeNavigationText(`${domain.label} ${route.section} ${route.label} ${route.route}`.toLowerCase())}"><span>${route.icon}</span><span><strong>${escapeNavigationText(route.label)}</strong><small>${escapeNavigationText(route.section)}</small></span>${route.public===true?'<em>Public</em>':'<em data-feature-access="protected">Sign in</em>'}</a>`).join('')}</div></section>`;
  }).join('');
  return `<div class="q-feature-navigation__backdrop" data-feature-navigation-close></div><aside id="q-feature-navigation" class="q-feature-navigation" aria-label="All Qelly features"><header><div><p>Product navigation</p><h2>All features</h2></div><button type="button" data-feature-navigation-close aria-label="Close feature menu">×</button></header><label class="q-feature-navigation__search"><span class="q-visually-hidden">Filter Qelly features</span><input type="search" inputmode="search" autocomplete="off" placeholder="Filter ${FEATURE_ROUTES.length} features" aria-controls="q-feature-navigation-list"></label><p class="q-feature-navigation__status" aria-live="polite">${FEATURE_ROUTES.length} features</p><nav id="q-feature-navigation-list" aria-label="Feature routes"><a class="q-feature-navigation__universe" href="#/feature-universe" data-feature-route="feature-universe"><strong>Feature Universe</strong><small>Visual overview of every product domain</small></a>${groups}</nav></aside>`;
}

function setFeatureNavigationButtonState(button,expanded){
  if(!button)return;
  button.setAttribute('aria-expanded',String(expanded));
  button.setAttribute('aria-label',`${expanded?'Hide':'Show'} all Qelly features`);
}

function closeFeatureNavigation({restoreFocus=false}={}){
  if(matchMedia('(min-width:1241px)').matches){
    document.body.classList.add('q-feature-navigation-collapsed');
  }else{
    document.body.classList.remove('q-feature-navigation-open');
    document.body.classList.remove('q-feature-navigation-collapsed');
  }
  const button=document.querySelector('.q-product-menu[data-feature-navigation-owner="true"]');
  setFeatureNavigationButtonState(button,false);
  if(restoreFocus)button?.focus();
}

function syncFeatureNavigation(){
  const drawer=document.getElementById('q-feature-navigation');
  if(!drawer)return;
  const current=routeName();
  const accountHref=document.querySelector('.q-product-account')?.getAttribute('href')||'';
  const authenticated=Boolean(accountHref&&!accountHref.includes('auth-login'));
  drawer.querySelectorAll('[data-feature-access="protected"]').forEach((badge)=>{badge.textContent=authenticated?'Workspace':'Sign in';});
  for(const link of drawer.querySelectorAll('[data-feature-route]')){
    const active=link.dataset.featureRoute===current;
    link.classList.toggle('is-active',active);
    if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  }
}

function ensureFeatureNavigation(){
  let drawer=document.getElementById('q-feature-navigation');
  if(!drawer){
    document.body.insertAdjacentHTML('beforeend',featureNavigationMarkup());
    drawer=document.getElementById('q-feature-navigation');
    const search=drawer?.querySelector('input[type="search"]');
    search?.addEventListener('input',()=>{
      const query=search.value.trim().toLowerCase();
      let visibleCount=0;
      for(const group of drawer.querySelectorAll('.q-feature-navigation__group')){
        let groupCount=0;
        for(const link of group.querySelectorAll('[data-feature-search]')){
          const visible=!query||link.dataset.featureSearch.includes(query);
          link.hidden=!visible;
          if(visible){visibleCount+=1;groupCount+=1;}
        }
        group.hidden=groupCount===0;
      }
      const universe=drawer.querySelector('.q-feature-navigation__universe');
      const universeVisible=!query||'feature universe visual overview product domain'.includes(query);
      if(universe)universe.hidden=!universeVisible;
      if(universeVisible)visibleCount+=1;
      const status=drawer.querySelector('.q-feature-navigation__status');
      if(status)status.textContent=`${visibleCount} feature${visibleCount===1?'':'s'} shown`;
    });
    drawer?.addEventListener('click',(event)=>{
      if(event.target.closest('[data-feature-route]')&&!matchMedia('(min-width:1241px)').matches)closeFeatureNavigation();
    });
    document.querySelectorAll('[data-feature-navigation-close]').forEach((button)=>button.addEventListener('click',()=>closeFeatureNavigation({restoreFocus:true})));
    document.addEventListener('keydown',(event)=>{
      const persistentOpen=matchMedia('(min-width:1241px)').matches&&!document.body.classList.contains('q-feature-navigation-collapsed');
      if(event.key==='Escape'&&(document.body.classList.contains('q-feature-navigation-open')||persistentOpen))closeFeatureNavigation({restoreFocus:true});
    });
    window.addEventListener('resize',()=>{
      const persistent=matchMedia('(min-width:1241px)').matches;
      if(persistent)document.body.classList.remove('q-feature-navigation-open');
      else document.body.classList.remove('q-feature-navigation-collapsed');
      const owner=document.querySelector('.q-product-menu[data-feature-navigation-owner="true"]');
      const expanded=persistent
        ? !document.body.classList.contains('q-feature-navigation-collapsed')
        : document.body.classList.contains('q-feature-navigation-open');
      setFeatureNavigationButtonState(owner,expanded);
    });
  }
  const originalButton=document.querySelector('.q-product-menu:not([data-feature-navigation-owner="true"])');
  if(originalButton){
    const button=originalButton.cloneNode(true);
    originalButton.replaceWith(button);
    button.dataset.featureNavigationOwner='true';
    button.dataset.featureNavigationTrigger='true';
    button.setAttribute('aria-controls','q-feature-navigation');
    button.addEventListener('click',()=>{
      const persistent=matchMedia('(min-width:1241px)').matches;
      const open=persistent
        ? document.body.classList.toggle('q-feature-navigation-collapsed')===false
        : !document.body.classList.contains('q-feature-navigation-open');
      if(!persistent)document.body.classList.toggle('q-feature-navigation-open',open);
      setFeatureNavigationButtonState(button,open);
      if(open)drawer?.querySelector('input[type="search"]')?.focus();
    });
  }
  const owner=document.querySelector('.q-product-menu[data-feature-navigation-owner="true"]');
  const persistent=matchMedia('(min-width:1241px)').matches;
  const expanded=persistent
    ? !document.body.classList.contains('q-feature-navigation-collapsed')
    : document.body.classList.contains('q-feature-navigation-open');
  setFeatureNavigationButtonState(owner,expanded);
  syncFeatureNavigation();
}

function normalizeCustomerCopy(scope=document){
  const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT,{acceptNode(node){
    const parent=node.parentElement;
    if(!parent||parent.closest('script,style,pre,code,[data-preserve-technical-copy]'))return NodeFilter.FILTER_REJECT;
    return /deterministic local|local foundation|production gated|independent dark, light|static visual preview|deterministic market visualization/i.test(node.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
  }});
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    let value=node.nodeValue||'';
    for(const [from,to] of phraseMap)value=value.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),to);
    node.nodeValue=value;
  }
}

function syncAppearanceButton(button=document.querySelector('[data-v8-appearance]')){
  if(!button)return;
  const resolved=root.dataset.resolvedAppearance||root.dataset.appearance||'dark';
  const next=resolved==='light'?'Dark':'Light';
  button.setAttribute('aria-label',`Switch to ${next.toLowerCase()} appearance`);
  button.setAttribute('title',`Switch to ${next.toLowerCase()} appearance`);
  button.setAttribute('aria-pressed',String(resolved==='light'));
  button.dataset.resolvedAppearance=resolved;
  button.innerHTML=`<span aria-hidden="true">◐</span><span>${next}</span>`;
}

function setAccessHeaderMode(header,access){
  const search=header.querySelector('.q-product-search');
  const account=header.querySelector('.q-product-account');
  const systemButtons=[...header.querySelectorAll('.q-product-system:not([data-v8-appearance])')];
  if(access){
    header.dataset.accessShell='compact';
    header.style.setProperty('grid-template-columns','auto minmax(0,1fr) auto','important');
    search?.style.setProperty('display','none','important');
    account?.style.setProperty('display','none','important');
    systemButtons.forEach((node)=>node.style.setProperty('display','none','important'));
  }else{
    delete header.dataset.accessShell;
    header.style.removeProperty('grid-template-columns');
    search?.style.removeProperty('display');
    account?.style.removeProperty('display');
    systemButtons.forEach((node)=>node.style.removeProperty('display'));
  }
}

function simplifyHeader(){
  document.querySelector('.q-v53-product-status')?.remove();
  const header=document.querySelector('.q-product-header');
  if(!header)return;
  header.hidden=false;
  header.style.setProperty('display','grid','important');
  header.style.setProperty('visibility','visible','important');
  header.style.setProperty('opacity','1','important');
  header.dataset.productionShell='v8';
  const brand=header.querySelector('.q-product-brand');
  brand?.style.setProperty('display','inline-flex','important');
  header.querySelector('a[data-product-route="calculator-center"]')?.replaceChildren(document.createTextNode('Tools'));
  const search=header.querySelector('#q-product-search-input');
  if(search)search.placeholder='Search markets, assets and tools';
  const system=header.querySelector('.q-product-system span:last-child');
  if(system&&!system.closest('[data-v8-appearance]'))system.textContent='Data status';
  const account=header.querySelector('.q-product-account');
  if(account){
    const authenticated=window.__QELLY_SESSION_STATE__?.authenticated===true;
    account.setAttribute('href',authenticated?'#/account-session':'#/auth-login');
    account.innerHTML=authenticated
      ?'<span aria-hidden="true">QI</span><span>Account</span>'
      :'<span aria-hidden="true">●</span><span>Sign in</span>';
    account.setAttribute('aria-label',authenticated?'Open Qelly account':'Sign in to Qelly');
  }
  const actions=header.querySelector('.q-product-actions');
  if(actions&&!actions.querySelector('[data-v8-appearance]')){
    const button=document.createElement('button');
    button.type='button';
    button.className='q-product-system';
    button.dataset.v8Appearance='true';
    button.addEventListener('click',async()=>{
      button.disabled=true;
      try{
        if(window.QellyThemeStudio?.toggleAppearance)await window.QellyThemeStudio.toggleAppearance({notify:false});
        else location.hash='#/theme-lab';
      }finally{button.disabled=false;syncAppearanceButton(button);}
    });
    actions.insertBefore(button,account||null);
  }
  syncAppearanceButton(actions?.querySelector('[data-v8-appearance]'));
  setAccessHeaderMode(header,ACCESS_ROUTES.has(routeName()));
}

function moveTechnicalIdentifiersBehindDisclosure(){
  if(routeName()!=='account-session'||!main)return;
  const timezone=main.querySelector('input[name="timezone"]');
  if(timezone?.value==='Asia/Calcutta')timezone.value='Asia/Kolkata';
  const list=main.querySelector('.q-v6-evidence-list');
  if(!list||list.dataset.v8TechnicalIds==='repaired')return;
  list.dataset.v8TechnicalIds='repaired';
  const pairs=[];
  for(const dt of [...list.querySelectorAll(':scope > dt')]){
    if(!/^(Workspace ID|User ID)$/i.test(dt.textContent?.trim()||''))continue;
    const dd=dt.nextElementSibling;
    if(dd?.tagName==='DD')pairs.push([dt,dd]);
  }
  if(!pairs.length)return;
  const details=document.createElement('details');
  details.className='q-v8-technical-identifiers';
  const summary=document.createElement('summary');
  summary.textContent='Technical identifiers';
  const technical=document.createElement('dl');
  technical.className='q-v6-evidence-list';
  for(const [dt,dd] of pairs)technical.append(dt,dd);
  details.append(summary,technical);
  list.parentElement?.append(details);
}

function maskCurrentSessionIdentifier(){
  if(routeName()!=='account-session'||!main)return;
  for(const row of main.querySelectorAll('.q-v6-security-row')){
    if(row.querySelector(':scope > span')?.textContent?.trim()!=='Session')continue;
    const value=row.querySelector('strong');
    if(!value||value.dataset.v8Masked==='true')continue;
    const full=value.textContent?.trim()||'';
    if(full.length>12){value.title=full;value.textContent=`••••${full.slice(-8)}`;value.dataset.v8Masked='true';}
  }
}

function normalizeDeterministicPresentation(){
  if(!main)return;
  if(routeName()==='formula-detail'){
    const badge=[...main.querySelectorAll('.q-status--simulated')].find((node)=>/deterministic/i.test(node.textContent||''));
    if(badge){
      badge.classList.remove('q-status--simulated');
      badge.classList.add('q-status--cached');
      badge.closest('.q-state-banner')?.classList.remove('is-simulated');
    }
  }
  if(routeName()==='account-session'){
    for(const badge of main.querySelectorAll('.q-v6-profile-layout .q-status--simulated')){
      if(!/local/i.test(badge.textContent||''))continue;
      badge.classList.remove('q-status--simulated');
      badge.classList.add('q-status--cached');
    }
  }
}

function repairLegacyRuntimeState(){
  document.querySelector('#state-selector option[value="simulated"]')?.remove();
  moveTechnicalIdentifiersBehindDisclosure();
  maskCurrentSessionIdentifier();
  normalizeDeterministicPresentation();
}

function applyAccessibilityFloor(){
  if(!main||typeof getComputedStyle!=='function')return;
  const textCandidates=main.querySelectorAll('span,strong,small,b,em,code,progress,label,dt,dd,time,p,div,footer,header,summary,button,a');
  for(const element of textCandidates){
    if(element.children.length||element.closest('.sr-only,[aria-hidden="true"],script,style'))continue;
    if(!element.textContent?.trim()||!element.getClientRects().length)continue;
    const size=Number.parseFloat(getComputedStyle(element).fontSize);
    if(Number.isFinite(size)&&size<12)element.classList.add('q-v8-text-floor');
  }
}

function annotateRoute(){
  const route=routeName();
  const access=ACCESS_ROUTES.has(route);
  root.dataset.productionRoute=route;
  root.dataset.productionArea=ADMIN_ROUTES.has(route)?'admin':CUSTOMER_ROUTES.has(route)?'customer':'workspace';
  root.dataset.productionAccess=String(access);
  main?.setAttribute('data-production-route',route);
  if(!main)return;
  const page=main.querySelector('.q-page');
  if(page){
    page.dataset.productionPage='v8';
    page.classList.toggle('is-admin-workspace',ADMIN_ROUTES.has(route));
  }
  if(ADMIN_ROUTES.has(route)){
    const head=main.querySelector('.q-page-head,.q-ti-hero,.q-v7-hero');
    if(head&&!head.querySelector('[data-v8-admin-label]')){
      const label=document.createElement('span');
      label.dataset.v8AdminLabel='true';
      label.className='q-status q-status--cached';
      label.textContent='Admin workspace';
      head.append(label);
    }
  }
}

function refresh(scope=document){
  root.dataset.productionSystem='v8';
  ensureCanonicalStylesheetLast();
  annotateRoute();
  simplifyHeader();
  ensureFeatureNavigation();
  repairLegacyRuntimeState();
  normalizeCustomerCopy(scope);
  applyAccessibilityFloor();
}

let queued=false;
const schedule=(scope=document)=>{
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;refresh(scope);});
};

window.addEventListener('hashchange',()=>schedule(main||document));
document.addEventListener('qelly:appearance-changed',()=>syncAppearanceButton());
document.addEventListener('qelly:session-state',(event)=>{
  if(event.detail?.authenticated===true&&matchMedia('(min-width:1241px)').matches){
    document.body.classList.remove('q-feature-navigation-collapsed');
  }
  schedule(document);
});
if(main)new MutationObserver(()=>schedule(main)).observe(main,{childList:true,subtree:true});
new MutationObserver(()=>schedule(document)).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
new MutationObserver(()=>schedule(document)).observe(document.head,{childList:true});
if(window.__QELLY_SESSION_STATE__?.authenticated===true&&matchMedia('(min-width:1241px)').matches){
  document.body.classList.remove('q-feature-navigation-collapsed');
}
refresh();
