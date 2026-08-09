const PRIMARY_ID='qelly-verify-shell-primary';
const SHELF_VERIFY='qelly-verify-shell-shelf-verify';
const SHELF_METHOD='qelly-verify-shell-shelf-methodology';

const routeState=()=>{
  const raw=location.hash.replace(/^#\/?/,'');
  const [path,query='']=raw.split('?');
  return {route:path.split('/')[0]||'market',params:new URLSearchParams(query)};
};

const activeView=()=>{
  const {route,params}=routeState();
  if(route!=='market')return null;
  const view=params.get('view');
  return view==='qelly-verify'||view==='evidence-methodology'?view:null;
};

const navigate=(view)=>{
  const target=`#/market?view=${view}`;
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
      <button type="button" class="q-nav-link" data-qelly-verify-link="shell" aria-current="false"><span class="q-nav-icon" aria-hidden="true">V</span><span>Qelly Verify</span><span class="q-nav-meta">SUBVIEW</span></button>
      <button type="button" class="q-nav-link" data-qelly-methodology-link="shell" aria-current="false"><span class="q-nav-icon" aria-hidden="true">E</span><span>Evidence Methodology</span><span class="q-nav-meta">PUBLIC</span></button>`;
    group.querySelector('[data-qelly-verify-link]')?.addEventListener('click',()=>navigate('qelly-verify'));
    group.querySelector('[data-qelly-methodology-link]')?.addEventListener('click',()=>navigate('evidence-methodology'));
    nav.append(group);
  }
  const verify=group.querySelector('[data-qelly-verify-link]');
  const method=group.querySelector('[data-qelly-methodology-link]');
  verify?.classList.toggle('is-active',view==='qelly-verify');
  method?.classList.toggle('is-active',view==='evidence-methodology');
  verify?.setAttribute('aria-current',view==='qelly-verify'?'page':'false');
  method?.setAttribute('aria-current',view==='evidence-methodology'?'page':'false');
  const market=nav.querySelector('[data-route="market"]');
  if(market){
    market.classList.toggle('is-active',!view);
    market.setAttribute('aria-current',view?'false':'page');
  }
}

function ensureShelf(view){
  const shelf=document.querySelector('#context-shelf .q-category-shelf');
  if(!shelf)return;
  let verify=document.getElementById(SHELF_VERIFY);
  if(!verify){
    verify=document.createElement('button');
    verify.type='button';
    verify.id=SHELF_VERIFY;
    verify.dataset.qellyVerifyLink='shelf';
    verify.textContent='Qelly Verify';
    verify.addEventListener('click',()=>navigate('qelly-verify'));
  }
  let method=document.getElementById(SHELF_METHOD);
  if(!method){
    method=document.createElement('button');
    method.type='button';
    method.id=SHELF_METHOD;
    method.dataset.qellyMethodologyLink='shelf';
    method.textContent='Evidence Methodology';
    method.addEventListener('click',()=>navigate('evidence-methodology'));
  }
  if(shelf.firstElementChild!==verify)shelf.prepend(verify);
  if(verify.nextElementSibling!==method)shelf.insertBefore(method,verify.nextElementSibling);
  verify.classList.toggle('is-active',view==='qelly-verify');
  method.classList.toggle('is-active',view==='evidence-methodology');
  verify.setAttribute('aria-current',view==='qelly-verify'?'page':'false');
  method.setAttribute('aria-current',view==='evidence-methodology'?'page':'false');
}

function updateBreadcrumb(view){
  if(!view)return;
  const current=document.querySelector('#context-shelf .q-breadcrumbs [aria-current="page"]');
  if(current)current.textContent=view==='qelly-verify'?'Qelly Verify':'Evidence Methodology';
}

function clearShellLinks(){
  document.getElementById(PRIMARY_ID)?.remove();
  document.getElementById(SHELF_VERIFY)?.remove();
  document.getElementById(SHELF_METHOD)?.remove();
}

let scheduled=false;
function install(){
  scheduled=false;
  const {route}=routeState();
  if(route!=='market'){clearShellLinks();return;}
  const view=activeView();
  ensurePrimary(view);
  ensureShelf(view);
  updateBreadcrumb(view);
}
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(install);
}

new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('hashchange',schedule);
window.addEventListener('pageshow',schedule);
for(const delay of [0,80,250,700,1600])setTimeout(schedule,delay);

window.QellyVerifyShellNav=Object.freeze({schedule,activeView});
