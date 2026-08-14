import './qelly-v53-lock-geometry-fix.mjs';

// Qelly Intelligence — synchronous V5.3 lock cleanup for legacy Verify subviews.
// The canonical first-view reference surface must not survive a hash transition
// into the historical CSV or evidence-methodology subviews.

const LEGACY_VERIFY_VIEWS=new Set(['qelly-verify','evidence-methodology']);

export function isLegacyVerifySubview(hash=globalThis.location?.hash||''){
  const raw=String(hash).replace(/^#\/?/,'');
  const [path='',query='']=raw.split('?');
  if(path.split('/')[0]!=='market')return false;
  return LEGACY_VERIFY_VIEWS.has(new URLSearchParams(query).get('view'));
}

export function clearLegacyVerifyLock(){
  if(!isLegacyVerifySubview())return false;
  const root=document.documentElement;
  const main=document.getElementById('main');
  main?.querySelectorAll(':scope > .q-v53-lock-page').forEach((node)=>node.remove());
  delete root.dataset.v53LockCandidate;
  delete root.dataset.v53LockSlot;
  delete root.dataset.v53LockReady;
  if(main){
    delete main.dataset.v53LockCandidate;
    delete main.dataset.v53LockSlot;
  }
  return true;
}

if(typeof window!=='undefined'&&typeof document!=='undefined'){
  window.addEventListener('hashchange',clearLegacyVerifyLock);
}
