const config=window.__QELLY_CONFIG__||{};
let releaseIdentity={releaseSha:config.releaseSha||'unresolved',workflowRun:null,deployedAt:null,mode:config.deploymentStage||'unknown'};

function stateChip(label,state='available'){
  const chip=document.createElement('span');chip.className='q-prompt2c-beta__state';chip.dataset.state=state;chip.textContent=label;return chip;
}
function link(label,href){const anchor=document.createElement('a');anchor.href=href;anchor.textContent=label;return anchor;}
function buildBanner(){
  if(document.querySelector('.q-prompt2c-beta'))return;
  const banner=document.createElement('section');banner.className='q-prompt2c-beta';banner.setAttribute('aria-label','Qelly public beta status');
  const identity=document.createElement('div');identity.className='q-prompt2c-beta__identity';
  const label=document.createElement('strong');label.className='q-prompt2c-beta__label';label.textContent=config.productMode||'QELLY GLOBAL PUBLIC BETA';identity.append(label);
  const truth=document.createElement('div');truth.className='q-prompt2c-beta__truth';
  truth.append(stateChip('Deterministic local · available'));
  const connectivity=stateChip(navigator.onLine?'Network · online':'Network · offline',navigator.onLine?'available':'offline');connectivity.id='q-prompt2c-connectivity';truth.append(connectivity);
  truth.append(stateChip(config.capabilities?.authentication?'Authentication · active':'Authentication · authorization required',config.capabilities?.authentication?'available':'unavailable'));
  truth.append(stateChip(config.capabilities?.cloudSync?'Cloud sync · opt-in available':'Cloud sync · unavailable',config.capabilities?.cloudSync?'available':'unavailable'));
  const release=stateChip(`Release · ${String(releaseIdentity.releaseSha).slice(0,8)}`,releaseIdentity.releaseSha==='source-unbuilt'?'unavailable':'available');release.id='q-prompt2c-release';truth.append(release);
  const links=document.createElement('nav');links.className='q-prompt2c-beta__links';links.setAttribute('aria-label','Public beta policies');
  links.append(link('Beta notice','./legal/beta.html'),link('Risk','./legal/risk.html'),link('Privacy','./legal/privacy.html'),link('Terms','./legal/terms.html'),link('Support','./support.html'));
  banner.append(identity,truth,links);document.body.prepend(banner);
}
function updateConnectivity(){const chip=document.getElementById('q-prompt2c-connectivity');if(!chip)return;chip.textContent=navigator.onLine?'Network · online':'Network · offline';chip.dataset.state=navigator.onLine?'available':'offline';}
function updateReleaseChip(){const chip=document.getElementById('q-prompt2c-release');if(!chip)return;chip.textContent=`Release · ${String(releaseIdentity.releaseSha||'unresolved').slice(0,8)}`;chip.dataset.state=/^[0-9a-f]{40}$/i.test(releaseIdentity.releaseSha||'')?'available':'unavailable';}
function exposeStatus(){window.__QELLY_PUBLIC_BETA_STATUS__=Object.freeze({mode:config.productMode||'QELLY GLOBAL PUBLIC BETA',releaseSha:releaseIdentity.releaseSha||'unresolved',workflowRun:releaseIdentity.workflowRun||null,deployedAt:releaseIdentity.deployedAt||null,deploymentStage:releaseIdentity.mode||config.deploymentStage||'unknown',deterministicLocal:true,authentication:Boolean(config.capabilities?.authentication),cloudSync:Boolean(config.capabilities?.cloudSync),protectedWrites:Boolean(config.capabilities?.protectedWrites),liveProviders:Boolean(config.capabilities?.liveProviders),online:navigator.onLine,truthBoundary:'Connected capabilities are unavailable until real external authorization and verification pass. Deterministic local calculations remain available.'});}
async function loadReleaseIdentity(){
  try{
    const response=await fetch('./qelly-release.json',{cache:'no-store',headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(`release_identity_${response.status}`);
    const payload=await response.json();
    releaseIdentity={...releaseIdentity,...payload};
  }catch(error){console.warn('[Qelly public beta] exact release identity unavailable',error?.message||error);}
  updateReleaseChip();exposeStatus();
}
async function registerServiceWorker(){
  if(!('serviceWorker'in navigator)||location.protocol==='file:')return;
  try{await navigator.serviceWorker.register('./prompt2c-sw.js',{scope:'./'});}catch(error){console.warn('[Qelly public beta] offline shell registration unavailable',error?.message||error);}
}
function install(){buildBanner();updateConnectivity();exposeStatus();loadReleaseIdentity();registerServiceWorker();window.addEventListener('online',()=>{updateConnectivity();exposeStatus();});window.addEventListener('offline',()=>{updateConnectivity();exposeStatus();});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
