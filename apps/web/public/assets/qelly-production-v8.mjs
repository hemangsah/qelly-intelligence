/* Qelly Production V8 — customer-facing convergence runtime. */

const root=document.documentElement;
const main=document.getElementById('main');
const CUSTOMER_ROUTES=new Set([
  'feature-universe','market','asset-rankings','asset','calculator-center','india-finance',
  'indicator-library','formula-library','saved-calculations','qelly-verify','about-qelly',
  'auth-login','auth-register','auth-recovery','account-session','watchlist','news-research'
]);
const ADMIN_ROUTES=new Set([
  'identity-access','data-mesh','instrument-master','timeseries-lab','stream-operations',
  'observability','migration-center','platform-readiness','delivery-operations','secret-rotation',
  'quarantine-review','staging-assurance','secure-import-vault','security-evidence'
]);

function ensureCanonicalStylesheetLast(){
  const stylesheet=document.querySelector('link[href$="qelly-production-v8.css"]');
  if(stylesheet&&document.head.lastElementChild!==stylesheet)document.head.append(stylesheet);
}

const phraseMap=new Map([
  ['independent dark, light, OLED and high-contrast palettes','Choose a certified palette for the complete workspace'],
  ['static visual preview','Reference mode'],
  ['deterministic demo · not live','Reference data · not live'],
  ['deterministic demo data · backend unavailable · no live services','Reference data · live services unavailable'],
  ['demo observations only','Reference observations only'],
  ['governed public demo + explicit provider state','Source, freshness and provider state'],
  ['deterministic market visualization','Reproducible market visualization'],
  ['deterministic local','Reproducible locally'],
  ['local foundation','Workspace runtime'],
  ['production gated','Not connected'],
  ['fixture method and interpretation','Reference method and interpretation'],
  ['fixture data','Reference data'],
  ['fixture state','Reference state'],
  ['simulated','Indicative'],
  ['demo','Reference']
]);

function routeName(){return location.hash.replace(/^#\/?/,'').split(/[/?#]/)[0]||'feature-universe';}

function normalizeCustomerCopy(scope=document){
  const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT,{acceptNode(node){
    const parent=node.parentElement;
    if(!parent||parent.closest('script,style,pre,code,[data-preserve-technical-copy]'))return NodeFilter.FILTER_REJECT;
    return /simulated|demo|fixture|deterministic local|local foundation|production gated|independent dark, light/i.test(node.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
  }});
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    let value=node.nodeValue||'';
    for(const [from,to] of phraseMap)value=value.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),to);
    value=value
      .replace(/Indicative-Reference/gi,'Reference')
      .replace(/deterministic Reference/gi,'reference')
      .replace(/Qelly reference/gi,'Qelly reference dataset');
    node.nodeValue=value;
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
  if(system)system.textContent='Data status';
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
    button.setAttribute('aria-label','Open appearance settings');
    button.innerHTML='<span aria-hidden="true">◐</span><span>Appearance</span>';
    button.addEventListener('click',()=>{location.hash='#/theme-lab';});
    actions.insertBefore(button,account||null);
  }
}

function annotateRoute(){
  const route=routeName();
  root.dataset.productionRoute=route;
  root.dataset.productionArea=ADMIN_ROUTES.has(route)?'admin':CUSTOMER_ROUTES.has(route)?'customer':'workspace';
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
  ensureCanonicalStylesheetLast();
  simplifyHeader();
  annotateRoute();
  normalizeCustomerCopy(scope);
  root.dataset.productionSystem='v8';
}

let queued=false;
const schedule=(scope=document)=>{
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;refresh(scope);});
};

window.addEventListener('hashchange',()=>schedule(main||document));
if(main)new MutationObserver(()=>schedule(main)).observe(main,{childList:true,subtree:true});
new MutationObserver(()=>schedule(document)).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
new MutationObserver(()=>schedule(document)).observe(document.head,{childList:true});
refresh();
