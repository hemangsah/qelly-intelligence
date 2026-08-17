// Compatibility bridge for the retained core module's browser global export.
globalThis.TYPOGRAPHY_LOCK='IBM Plex Sans Variable permanent canonical font · GT Eesti inactive licence gate';
const [{themeIntelligence,migrateThemeConfig,preferencePatch,PERSONAS},{renderThemeIntelligenceStudio},{enhanceThemeIntelligenceVisuals}]=await Promise.all([import('./theme-intelligence.mjs'),import('./routes/theme-intelligence-studio.mjs'),import('./theme-intelligence-visual-correction.mjs')]);

const main=()=>document.getElementById('main');
const localState={prefs:migrateThemeConfig({})};
let mounted=false;
let observer=null;
let csrfToken=null;
let authenticated=false;
let applying=false;
const apiBase=String(window.__QELLY_CONFIG__?.apiBaseUrl??'').replace(/\/$/,'');
const apiPath=(pathname)=>apiBase?new URL(pathname,`${apiBase}/`).toString():pathname;
const LEGACY_THEME_PRESETS=Object.freeze({
  'burgundy-command':{themeFamily:'sovereign-obsidian',persona:'scalper-velocity',appearance:'dark'},
  'porcelain-burgundy':{themeFamily:'porcelain-signal',persona:'investor-compound',appearance:'light'},
  'burgundy-night':{themeFamily:'crimson-vector',persona:'aggressive-alpha',appearance:'dark'},
  'graphite-terminal':{themeFamily:'obsidian-strike',persona:'quant-operator',appearance:'dark'},
  'midnight-research':{themeFamily:'monochrome-ledger',persona:'research-oracle',appearance:'dark'},
  'high-contrast':{themeFamily:'signal-access',persona:'signal-access',appearance:'high-contrast'}
});

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
async function applyAndPersistTheme(patch,{notify=true}={}){
  const profile=patch.persona?PERSONAS.find((item)=>item.id===patch.persona):null;
  const complete={...patch,...(profile&&!patch.mindset?{mindset:profile.mindsets[0]}:{})};
  themeIntelligence.apply(complete);
  themeIntelligence.commit();
  const preference=preferencePatch(themeIntelligence.config);
  localState.prefs={...localState.prefs,...preference};
  let persisted=!authenticated;
  try{await persistPreference(preference);persisted=true;}
  catch(error){toast(`Appearance changed locally; cloud preference save failed: ${error.message}`,{tone:'warning'});}
  const detail={appearance:document.documentElement.dataset.resolvedAppearance||document.documentElement.dataset.appearance||themeIntelligence.config.appearance,requestedAppearance:themeIntelligence.config.appearance,themeFamily:themeIntelligence.config.themeFamily,persona:themeIntelligence.config.persona,persisted};
  document.dispatchEvent(new CustomEvent('qelly:appearance-changed',{detail}));
  if(notify)toast(`${detail.appearance==='light'?'Light':detail.appearance==='dark'?'Dark':detail.appearance} appearance applied${persisted?'':' locally'}.`,{tone:persisted?'positive':'warning'});
  return detail;
}
async function setAppearance(appearance,options={}){
  if(!['dark','light','oled','high-contrast','system','scheduled'].includes(String(appearance)))throw new TypeError('Unsupported Qelly appearance');
  return applyAndPersistTheme({appearance:String(appearance)},options);
}
async function toggleAppearance(options={}){
  const resolved=document.documentElement.dataset.resolvedAppearance||document.documentElement.dataset.appearance||'dark';
  return setAppearance(resolved==='light'?'dark':'light',options);
}
async function applyLegacyThemePreset(value,options={}){
  const preset=LEGACY_THEME_PRESETS[String(value||'')];
  if(!preset)return null;
  return applyAndPersistTheme(preset,options);
}
function studioRoute(){return /^#\/theme-lab(?:\/|$)/.test(location.hash);}
async function mountRoute(){
  if(!studioRoute())return;
  const target=main();if(!target)return;
  mounted=true;
  observer?.disconnect();
  await renderThemeIntelligenceStudio(target,{toast,navigate,state:localState,persistPreference,renderRoute:mountRoute});
  enhanceThemeIntelligenceVisuals(target);
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
  document.getElementById('global-theme-selector')?.addEventListener('change',(event)=>{void applyLegacyThemePreset(event.target.value);});
}
function installPortalInheritance(){
  const apply=()=>{if(applying)return;applying=true;try{themeIntelligence.apply(themeIntelligence.config);}finally{applying=false;}};
  new MutationObserver((records)=>{if(records.some((record)=>[...record.addedNodes].some((node)=>node.nodeType===1&&node.matches?.('dialog,[role="dialog"],[role="tooltip"],[popover],.q-context-drawer,.q-command-dialog'))))apply();}).observe(document.body,{childList:true,subtree:true});
}

const shared=(()=>{const encoded=new URL(location.href).searchParams.get('qellyTheme');if(!encoded)return {};try{const value=encoded.replaceAll('-','+').replaceAll('_','/');return JSON.parse(decodeURIComponent(escape(atob(value+'='.repeat((4-value.length%4)%4)))));}catch{return {};}})();
themeIntelligence.start(shared);localState.prefs={...localState.prefs,...preferencePatch(themeIntelligence.config)};
await hydrateAuthenticatedPreferences();
installRouteGuard();installLaunchers();installPortalInheritance();
enhanceThemeIntelligenceVisuals(document);
if(studioRoute())queueMicrotask(mountRoute);
window.QellyThemeStudio=Object.freeze({open:()=>navigate('theme-lab'),gallery:()=>navigate('theme-lab','gallery'),compare:()=>navigate('theme-lab','compare'),setAppearance,toggleAppearance,applyLegacyThemePreset,snapshot:()=>themeIntelligence.snapshot()});
document.dispatchEvent(new CustomEvent('qelly:appearance-changed',{detail:{appearance:document.documentElement.dataset.resolvedAppearance||document.documentElement.dataset.appearance||themeIntelligence.config.appearance,requestedAppearance:themeIntelligence.config.appearance,themeFamily:themeIntelligence.config.themeFamily,persona:themeIntelligence.config.persona,persisted:authenticated}}));
