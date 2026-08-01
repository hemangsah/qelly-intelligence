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
})();
