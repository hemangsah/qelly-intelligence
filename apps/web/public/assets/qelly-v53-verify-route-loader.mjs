const legacyInitial=/^#\/market\?[^#]*\bview=qelly-verify(?:&|$)/i.test(window.__QELLY_VERIFY_ROUTE__?.initialHash||location.hash);
let loaded=false;
async function load(){
  if(loaded||legacyInitial)return;
  if(!/^#\/qelly-verify(?:[/?#]|$)/i.test(location.hash))return;
  loaded=true;
  await import('./qelly-v53-verify-canonical.mjs');
}
window.addEventListener('hashchange',()=>void load());
void load();
