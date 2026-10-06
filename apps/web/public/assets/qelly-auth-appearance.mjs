import {themeIntelligence} from './theme-intelligence-core.mjs';
themeIntelligence.start();
const button=document.querySelector('[data-auth-appearance]');
const sync=()=>{const light=document.documentElement.dataset.resolvedAppearance==='light';document.documentElement.style.colorScheme=light?'light':'dark';button.textContent=light?'Dark mode':'Light mode';button.setAttribute('aria-label',`Switch to ${light?'dark':'light'} appearance`);};
themeIntelligence.subscribe(sync);sync();
button.addEventListener('click',()=>{themeIntelligence.apply({appearance:document.documentElement.dataset.resolvedAppearance==='light'?'dark':'light'});try{themeIntelligence.commit();}catch{button.title='Appearance changed for this page; browser preference storage is unavailable.';}});
