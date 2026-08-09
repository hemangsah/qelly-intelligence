const PRIMARY_ID='qelly-verify-shell-primary';
const PRIMARY_VERIFY='qelly-verify-shell-primary-verify';
const SHELF_VERIFY='qelly-verify-shell-shelf-verify';
const SHELF_METHOD='qelly-verify-shell-shelf-methodology';
const CONTEXT_VERIFY='qelly-verify-worldclass-verify';
const CONTEXT_METHOD='qelly-verify-worldclass-methodology';
const ROOT_STATE='qellyVerifySubview';
const MOBILE_SHELL_QUERY='(max-width: 920px)';
const shelfDisplayState=new WeakMap();

const routeState=()=>{
  const raw=location.hash.replace(/^#\/?/,'');
  const [path,query='']=raw.split('?');
  return {route:path.split('/')[0]||'market',params:new URLSearchParams(query)};
};

const activeView=()=>{
  const {route,params}=routeState();
  if(route==='qelly-verify')return'qelly-verify';
  if(route!=='market')return null;
  const view=params.get('view');
  return view==='qelly-verify'||view==='evidence-methodology'?view:null;
};

const navigate=(view)=>{
  const target=view==='qelly-verify'?'#/qelly-verify':`#/market?view=${view}`;
  if(location.hash===target){window.QellyVerifyBootstrap?.schedule?.();return;}
  location.hash=target;
};

function ensurePrimary(view){
  const nav=document.getElementById('primary-nav');
  if(!nav)return;
  let group=document.getElementById(PRIMARY_ID);
  if(!group){
    group=document.createElement('div');
    group.id=PRIMARY_ID;
    group.dataset.qellyVerifyShellNav='primary';
    group.innerHTML=`<div class="q-nav-section">Strategy evidence</div>
      <button type="button" id="${PRIMARY_VERIFY}" class="q-nav-link" data-qelly-verify-link="shell" aria-current="false"><span class="q-nav-icon" aria-hidden="true">V</span><span>Qelly Verify</span><span class="q-nav-meta">PUBLIC</span></button>
      <button type="button" class="q-nav-link" data-qelly-methodology-link="shell" aria-current="false"><span class="q-nav-icon" aria-hidden="true">E</span><span>Evidence Methodology</span><span class="q-nav-meta">PUBLIC</span></button>`;
    group.querySelector('[data-qelly-verify-link="shell"]')?.addEventListener('click',()=>navigate('qelly-verify'));
    group.querySelector('[data-qelly-methodology-link]')?.addEventListener('click',()=>navigate('evidence-methodology'));
    nav.append(group);
  }
  const canonicalVerify=nav.querySelector('[data-route="qelly-verify"]');
  const fallbackVerify=group.querySelector('[data-qelly-verify-link="shell"]');
  if(canonicalVerify){
    canonicalVerify.dataset.qellyVerifyLink='shell';
    canonicalVerify.classList.toggle('is-active',view==='qelly-verify');
    canonicalVerify.setAttribute('aria-current',view==='qelly-verify'?'page':'false');
    fallbackVerify?.setAttribute('hidden','');
    fallbackVerify?.setAttribute('aria-hidden','true');
    fallbackVerify?.setAttribute('tabindex','-1');
  }else{
    fallbackVerify?.removeAttribute('hidden');
    fallbackVerify?.removeAttribute('aria-hidden');
    fallbackVerify?.removeAttribute('tabindex');
    fallbackVerify?.classList.toggle('is-active',view==='qelly-verify');
    fallbackVerify?.setAttribute('aria-current',view==='qelly-verify'?'page':'false');
  }
  const method=group.querySelector('[data-qelly-methodology-link]');
  method?.classList.toggle('is-active',view==='evidence-methodology');
  method?.setAttribute('aria-current',view==='evidence-methodology'?'page':'false');
  const market=nav.querySelector('[data-route="market"]');
  if(market&&view==='evidence-methodology'){
    market.classList.remove('is-active');
    market.setAttribute('aria-current','false');
  }
}

function exposeShelf(shelf){
  if(!shelfDisplayState.has(shelf))shelfDisplayState.set(shelf,{value:shelf.style.getPropertyValue('display'),priority:shelf.style.getPropertyPriority('display')});
  shelf.style.setProperty('display','flex','important');
  shelf.dataset.qellyVerifyDiscoverability='active';
}

function restoreShelf(){
  const shelf=document.querySelector('#context-shelf .q-category-shelf');
  if(!shelf||!shelfDisplayState.has(shelf))return;
  const previous=shelfDisplayState.get(shelf);
  if(previous.value)shelf.style.setProperty('display',previous.value,previous.priority);
  else shelf.style.removeProperty('display');
  delete shelf.dataset.qellyVerifyDiscoverability;
  shelfDisplayState.delete(shelf);
}

function ensureShelf(view){
  const shelf=document.querySelector('#context-shelf .q-category-shelf');
  if(!shelf)return;
  exposeShelf(shelf);
  let verify=document.getElementById(SHELF_VERIFY);
  if(!verify){
    verify=document.createElement('button');
    verify.type='button';
    verify.id=SHELF_VERIFY;
    verify.dataset.qellyVerifyLink='shelf';
    verify.textContent='Qelly Verify';
    verify.setAttribute('aria-label','Qelly Verify');
    verify.addEventListener('click',()=>navigate('qelly-verify'));
  }
  let method=document.getElementById(SHELF_METHOD);
  if(!method){
    method=document.createElement('button');
    method.type='button';
    method.id=SHELF_METHOD;
    method.dataset.qellyMethodologyLink='shelf';
    method.textContent='Evidence';
    method.setAttribute('aria-label','Evidence Methodology');
    method.title='Evidence Methodology';
    method.addEventListener('click',()=>navigate('evidence-methodology'));
  }
  if(shelf.firstElementChild!==verify)shelf.prepend(verify);
  if(verify.nextElementSibling!==method)shelf.insertBefore(method,verify.nextElementSibling);
  verify.classList.toggle('is-active',view==='qelly-verify');
  method.classList.toggle('is-active',view==='evidence-methodology');
  verify.setAttribute('aria-current',view==='qelly-verify'?'page':'false');
  method.setAttribute('aria-current',view==='evidence-methodology'?'page':'false');
}

function clearShelfControls(){
  restoreShelf();
  document.getElementById(SHELF_VERIFY)?.remove();
  document.getElementById(SHELF_METHOD)?.remove();
}

function ensureWorldclassContext(view){
  const related=document.querySelector('#main .q-worldclass-context .q-worldclass-related');
  if(!related)return;
  let verify=document.getElementById(CONTEXT_VERIFY);
  if(!verify){
    verify=document.createElement('a');
    verify.id=CONTEXT_VERIFY;
    verify.href='#/qelly-verify';
    verify.dataset.qellyVerifyLink='worldclass';
    verify.textContent='Qelly Verify';
    verify.setAttribute('aria-label','Qelly Verify');
  }
  let method=document.getElementById(CONTEXT_METHOD);
  if(!method){
    method=document.createElement('a');
    method.id=CONTEXT_METHOD;
    method.href='#/market?view=evidence-methodology';
    method.dataset.qellyMethodologyLink='worldclass';
    method.textContent='Evidence';
    method.setAttribute('aria-label','Evidence Methodology');
    method.title='Evidence Methodology';
  }
  if(related.firstElementChild!==verify)related.prepend(verify);
  if(verify.nextElementSibling!==method)related.insertBefore(method,verify.nextElementSibling);
  verify.classList.toggle('is-active',view==='qelly-verify');
  method.classList.toggle('is-active',view==='evidence-methodology');
  verify.setAttribute('aria-current',view==='qelly-verify'?'page':'false');
  method.setAttribute('aria-current',view==='evidence-methodology'?'page':'false');
}

function clearWorldclassControls(){
  document.getElementById(CONTEXT_VERIFY)?.remove();
  document.getElementById(CONTEXT_METHOD)?.remove();
}

function updateResponsiveDiscoverability(view){
  if(matchMedia(MOBILE_SHELL_QUERY).matches){
    clearWorldclassControls();
    ensureShelf(view);
    return;
  }
  clearShelfControls();
  ensureWorldclassContext(view);
}

function updateBreadcrumb(view){
  if(!view)return;
  const current=document.querySelector('#context-shelf .q-breadcrumbs [aria-current="page"]');
  if(current)current.textContent=view==='qelly-verify'?'Qelly Verify':'Evidence Methodology';
}

function clearShellLinks(){
  delete document.documentElement.dataset[ROOT_STATE];
  clearShelfControls();
  clearWorldclassControls();
  document.getElementById(PRIMARY_ID)?.remove();
  document.querySelector('#primary-nav [data-route="qelly-verify"]')?.removeAttribute('data-qelly-verify-link');
}

let scheduled=false;
function install(){
  scheduled=false;
  const {route}=routeState();
  if(route!=='market'&&route!=='qelly-verify'){clearShellLinks();return;}
  const view=activeView();
  if(view)document.documentElement.dataset[ROOT_STATE]=view;
  else delete document.documentElement.dataset[ROOT_STATE];
  ensurePrimary(view);
  updateResponsiveDiscoverability(view);
  updateBreadcrumb(view);
}
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(install);
}

const responsiveShell=matchMedia(MOBILE_SHELL_QUERY);
responsiveShell.addEventListener?.('change',schedule);
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('hashchange',schedule);
window.addEventListener('pageshow',schedule);
for(const delay of [0,80,250,700,1600])setTimeout(schedule,delay);

window.QellyVerifyShellNav=Object.freeze({schedule,activeView});
