(()=>{
  const root=document.documentElement;
  let saved={};
  try{saved=JSON.parse(localStorage.getItem('qelly.theme-intelligence.v2')||'{}');}catch{}
  const requested=saved.appearance||'dark';
  const dark=matchMedia('(prefers-color-scheme: dark)').matches;
  const contrast=matchMedia('(prefers-contrast: more)').matches;
  const appearance=requested==='system'
    ? (contrast?'high-contrast':dark?'dark':'light')
    : (requested==='scheduled'?'dark':requested);
  root.dataset.appearance=appearance;
  root.dataset.themeFamily=saved.themeFamily||'sovereign-obsidian';
  root.dataset.themePersona=saved.persona||'quant-operator';
  root.style.colorScheme=appearance==='light'?'light':'dark';
  root.dataset.themeReady='true';
  // The build embeds a sanitized snapshot of the authoritative route registry
  // before this blocking script. Route identity is set before the first paint.
  const route=(location.hash||'').replace(/^#\/?/,'').split(/[/?#]/)[0]||'feature-universe';
  root.dataset.prepaintRoute=route;
  try{
    const titles=window.__QELLY_PREPAINT_ROUTE_TITLES__||null;
    const title=titles&&Object.prototype.hasOwnProperty.call(titles,route)?titles[route]:null;
    if(typeof title==='string'&&title.length>0&&title.length<=200)document.title=title;
  }catch{
    // Keep the safe static title when an unbuilt development page lacks the map.
  }
})();
