import {themeIntelligence,preferencePatch} from './theme-intelligence-core.mjs';
import {createThemePreferenceStore} from './theme-preference-store.mjs';

// Use the terminal's authoritative preference, token resolver and storage key.
// Calculator inputs remain local. Only authenticated appearance preferences
// use the terminal's existing CSRF-protected preference endpoint.
themeIntelligence.start();
const preferences=createThemePreferenceStore({apiBase:globalThis.__QELLY_CONFIG__?.apiBaseUrl??'',staticVisualPreview:globalThis.__QELLY_CONFIG__?.staticVisualPreview===true});
const button=document.querySelector('[data-public-appearance]');
const sync=()=>{
  const light=document.documentElement.dataset.resolvedAppearance==='light';
  document.documentElement.style.colorScheme=light?'light':'dark';
  if(button){button.textContent=light?'Dark mode':'Light mode';button.setAttribute('aria-label',`Switch to ${light?'dark':'light'} appearance`);}
};
themeIntelligence.subscribe(sync);
sync();
const hydrated=preferences.hydrate().then(saved=>{if(saved)themeIntelligence.start(saved);}).catch(()=>{});
button?.addEventListener('click',async()=>{
  await hydrated;
  button.title='';
  themeIntelligence.apply({appearance:document.documentElement.dataset.resolvedAppearance==='light'?'dark':'light'});
  try{themeIntelligence.commit();}catch{button.title='Appearance changed for this page; browser preference storage is unavailable.';}
  try{await preferences.persist(preferencePatch(themeIntelligence.config));}
  catch{button.title='Appearance changed locally; cloud preference save failed.';}
});
window.addEventListener('storage',event=>{
  if(event.key==='qelly.theme-intelligence.v2'){themeIntelligence.load();themeIntelligence.apply();}
});
