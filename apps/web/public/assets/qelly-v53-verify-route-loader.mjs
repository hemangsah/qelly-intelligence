let loaded=false;

async function loadCanonicalVerify(){
  if(loaded)return;
  if(!/^#\/qelly-verify(?:[/?#]|$)/i.test(location.hash))return;
  loaded=true;
  await import('./qelly-v53-verify-convergence.mjs');
}

/* The legacy market subview is normalized by qelly-verify-bootstrap.mjs. Once
   that normalization reaches the canonical route, the accepted V5.3 formula
   workbench must own the primary surface as well. The CSV strategy analyzer
   remains available inside the canonical module as a secondary details tool. */
window.addEventListener('hashchange',()=>void loadCanonicalVerify());
window.addEventListener('pageshow',()=>void loadCanonicalVerify());
void loadCanonicalVerify();
