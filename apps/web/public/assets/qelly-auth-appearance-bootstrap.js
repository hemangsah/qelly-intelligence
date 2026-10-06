// Callback appearance uses saved appearance only; authorization URL values stay private.
(()=>{let saved={};try{saved=JSON.parse(localStorage.getItem('qelly.theme-intelligence.v2')||'{}');}catch{}
const requested=saved?.appearance,system=matchMedia('(prefers-color-scheme: dark)').matches;
const appearance=requested==='light'?'light':requested==='high-contrast'?'high-contrast':requested==='system'?(matchMedia('(prefers-contrast: more)').matches?'high-contrast':system?'dark':'light'):'dark';
document.documentElement.dataset.appearance=appearance;document.documentElement.style.colorScheme=appearance==='light'?'light':'dark';})();
