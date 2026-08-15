// Qelly Intelligence — Theme Lab preview truth guard.
// Theme Lab intentionally renders static market-shaped sample values to validate
// semantic tokens. Those values must never be mistaken for a market feed.

const isThemeLab=()=>String(globalThis.location?.hash||'').replace(/^#\/?/,'').split(/[/?]/)[0]==='theme-lab';

export function applyThemePreviewTruth(root=document){
  if(!isThemeLab())return false;
  const preview=root.querySelector?.('.q-ti-preview-shell');
  if(!preview)return false;
  preview.dataset.qellyPreviewTruth='demonstration';
  if(!preview.querySelector('.q-ti-preview-truth-banner')){
    const banner=document.createElement('div');
    banner.className='q-ti-preview-truth-banner';
    banner.setAttribute('role','status');
    banner.textContent='THEME DEMONSTRATION · STATIC SAMPLE VALUES · NOT LIVE MARKET DATA';
    preview.prepend(banner);
  }
  preview.querySelectorAll('.q-ti-table tbody tr td:last-child').forEach((cell)=>{
    const value=cell.textContent?.trim().toLowerCase();
    if(value==='live')cell.textContent='Preview sample';
    else if(value==='delayed')cell.textContent='Preview delayed state';
    else if(value==='cached')cell.textContent='Preview cached state';
  });
  preview.querySelectorAll('[data-value]').forEach((cell)=>cell.dataset.sampleValue='true');
  return true;
}

function sync(){queueMicrotask(()=>applyThemePreviewTruth(document));}

if(typeof window!=='undefined'&&typeof document!=='undefined'){
  window.addEventListener('hashchange',sync);
  window.addEventListener('pageshow',sync);
  const main=document.getElementById('main');
  if(main&&typeof MutationObserver!=='undefined'){
    const observer=new MutationObserver(()=>{
      if(isThemeLab())applyThemePreviewTruth(document);
    });
    observer.observe(main,{childList:true,subtree:true});
  }
  sync();
}
