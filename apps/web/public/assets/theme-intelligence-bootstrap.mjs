// Compatibility bridge for the retained core module's browser global export.
globalThis.TYPOGRAPHY_LOCK='IBM Plex Sans Variable permanent canonical font · GT Eesti inactive licence gate';
const [{themeIntelligence,migrateThemeConfig,preferencePatch,PERSONAS},{renderThemeIntelligenceStudio}]=await Promise.all([import('./theme-intelligence.mjs'),import('./routes/theme-intelligence-studio.mjs')]);

const main=()=>document.getElementById('main');
const localState={prefs:migrateThemeConfig({})};
let mounted=false;
let observer=null;
let csrfToken=null;
let authenticated=false;
let applying=false;
const apiBase=String(window.__QELLY_CONFIG__?.apiBaseUrl??'').replace(/\/$/,'');
const apiPath=(pathname)=>apiBase?new URL(pathname,`${apiBase}/`).toString():pathname;

function toast(message,{tone='neutral'}={}){
  let stack=document.querySelector('.q-ti-toast-stack');
  if(!stack){stack=document.createElement('div');stack.className='q-ti-toast-stack';stack.setAttribute('aria-live','polite');document.body.append(stack);}
  const item=document.createElement('div');item.className=`q-ti-toast is-${tone}`;item.textContent=message;stack.append(item);setTimeout(()=>item.remove(),3200);
}
function navigate(route,child=''){
  const next=`#/${route}${child?`/${child}`:''}`;
  if(location.hash===next){mountRoute();return;}
  location.hash=next;
}
async function hydrateAuthenticatedPreferences(){
  if(window.__QELLY_CONFIG__?.staticVisualPreview)return;
  try{
    const config=await fetch(apiPath('/api/v1/config'),{credentials:'include'}).then((response)=>response.ok?response.json():null);
    authenticated=Boolean(config?.auth?.authenticated);csrfToken=config?.csrf?.token??null;
    if(!authenticated)return;
    const saved=await fetch(apiPath('/api/v1/preferences/layout'),{credentials:'include'}).then((response)=>response.ok?response.json():null);
    if(saved){localState.prefs={...saved,...preferencePatch(migrateThemeConfig(saved))};themeIntelligence.start(localState.prefs);}
  }catch{}
}
async function persistPreference(patch){
  localState.prefs={...localState.prefs,...patch};
  if(!authenticated)return localState.prefs;
  const response=await fetch(apiPath('/api/v1/preferences/layout'),{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json','X-Qelly-CSRF':csrfToken??'',...(localState.prefs.revision!=null?{'If-Match-Revision':String(localState.prefs.revision)}:{})},body:JSON.stringify(localState.prefs)});
  if(!response.ok)throw new Error((await response.json().catch(()=>null))?.error?.message??`Preference save failed (${response.status})`);
  localState.prefs=await response.json();return localState.prefs;
}
function studioRoute(){return /^#\/theme-lab(?:\/|$)/.test(location.hash);}
async function mountRoute(){
  if(!studioRoute())return;
  const target=main();if(!target)return;
  mounted=true;
  observer?.disconnect();
  await renderThemeIntelligenceStudio(target,{toast,navigate,state:localState,persistPreference,renderRoute:mountRoute});
  observer?.observe(target,{childList:true});
}
function installRouteGuard(){
  window.addEventListener('hashchange',(event)=>{if(studioRoute()){event.stopImmediatePropagation();mountRoute();}else mounted=false;},true);
  observer=new MutationObserver(()=>{if(studioRoute()&&!targetIsStudio())mountRoute();});
  const target=main();if(target)observer.observe(target,{childList:true});
}
function targetIsStudio(){return Boolean(main()?.querySelector('.q-ti-page'));}
function installLaunchers(){
  const shortcut=document.getElementById('theme-shortcut');
  shortcut?.setAttribute('aria-label','Open Theme Studio');shortcut?.setAttribute('title','Open Theme Studio');
  shortcut?.addEventListener('click',(event)=>{event.preventDefault();event.stopImmediatePropagation();navigate('theme-lab');},true);
  const actions=document.querySelector('.q-command-actions');
  if(actions&&!actions.querySelector('[data-ti-launcher]')){
    const button=document.createElement('button');button.type='button';button.className='q-ti-launcher';button.dataset.tiLauncher='true';button.textContent='Theme Studio';button.addEventListener('click',()=>navigate('theme-lab'));actions.prepend(button);
  }
  document.getElementById('global-theme-selector')?.addEventListener('change',(event)=>{
    const map={'burgundy-command':'scalper-velocity','porcelain-burgundy':'investor-compound','burgundy-night':'aggressive-alpha','graphite-terminal':'quant-operator','midnight-research':'research-oracle','high-contrast':'signal-access'};
    const persona=map[event.target.value];if(!persona)return;
    const profile=PERSONAS.find((item)=>item.id===persona);const patch={persona,mindset:profile?.mindsets[0],...(persona==='aggressive-alpha'?{themeFamily:'crimson-vector'}:{})};
    themeIntelligence.preview(patch);themeIntelligence.commit();localState.prefs={...localState.prefs,...preferencePatch(themeIntelligence.config)};
  });
}
function installPortalInheritance(){
  const apply=()=>{if(applying)return;applying=true;try{themeIntelligence.apply(themeIntelligence.config);}finally{applying=false;}};
  new MutationObserver((records)=>{if(records.some((record)=>[...record.addedNodes].some((node)=>node.nodeType===1&&node.matches?.('dialog,[role="dialog"],[role="tooltip"],[popover],.q-context-drawer,.q-command-dialog'))))apply();}).observe(document.body,{childList:true,subtree:true});
}

const shared=(()=>{const encoded=new URL(location.href).searchParams.get('qellyTheme');if(!encoded)return {};try{const value=encoded.replaceAll('-','+').replaceAll('_','/');return JSON.parse(decodeURIComponent(escape(atob(value+'='.repeat((4-value.length%4)%4)))));}catch{return {};}})();
themeIntelligence.start({...localState.prefs,...shared});localState.prefs={...localState.prefs,...preferencePatch(themeIntelligence.config)};
await hydrateAuthenticatedPreferences();
installRouteGuard();installLaunchers();installPortalInheritance();
if(studioRoute())queueMicrotask(mountRoute);
window.QellyThemeStudio=Object.freeze({open:()=>navigate('theme-lab'),gallery:()=>navigate('theme-lab','gallery'),compare:()=>navigate('theme-lab','compare')});
