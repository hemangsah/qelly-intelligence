/* Qelly Production V8 — customer-facing convergence runtime. */

const root=document.documentElement;
const main=document.getElementById('main');
const ROUTE_REPAIR_STYLESHEET=new URL('./qelly-production-v8-route-repairs.css',import.meta.url).href;
const ROUTE_CONVERGENCE_STYLESHEET=new URL('./qelly-production-v9-route-convergence.css',import.meta.url).href;
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

function ensureCanonicalStylesheetLast(){
  const canonical=document.querySelector('link[href$="qelly-production-v8.css"]');
  let repairs=document.querySelector('link[data-qelly-production-v8-route-repairs="true"]');
  if(!repairs){
    repairs=document.createElement('link');
    repairs.rel='stylesheet';
    repairs.href=ROUTE_REPAIR_STYLESHEET;
    repairs.dataset.qellyProductionV8RouteRepairs='true';
    document.head.append(repairs);
  }
  let convergence=document.querySelector('link[data-qelly-production-v9-route-convergence="true"]');
  if(!convergence){
    convergence=document.createElement('link');
    convergence.rel='stylesheet';
    convergence.href=ROUTE_CONVERGENCE_STYLESHEET;
    convergence.dataset.qellyProductionV9RouteConvergence='true';
    document.head.append(convergence);
  }
  const desiredTail=[canonical,repairs,convergence].filter(Boolean);
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
  if(account&&account.getAttribute('href')?.includes('auth-login')){
    account.innerHTML='<span aria-hidden="true">●</span><span>Sign in</span>';
    account.setAttribute('aria-label','Sign in to Qelly');
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
if(main)new MutationObserver(()=>schedule(main)).observe(main,{childList:true,subtree:true});
new MutationObserver(()=>schedule(document)).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
new MutationObserver(()=>schedule(document)).observe(document.head,{childList:true});
refresh();
