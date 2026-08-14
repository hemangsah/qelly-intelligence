import './qelly-v53-verify-canonical.mjs';

const main=document.getElementById('main');
const canonicalRoute=()=>/^#\/qelly-verify(?:[/?#]|$)/i.test(location.hash);

/* The legacy CSV analyzer intentionally remains secondary inside <details>.
   Its own render replaces the Verify DOM after a sample/file is analyzed.
   When that replacement contains a completed report, keep the secondary tool
   expanded so the user can actually see the result that was just generated. */
function preserveSecondaryReportVisibility(){
  if(!canonicalRoute())return;
  const details=main?.querySelector('.q-v53-strategy-tools');
  const report=details?.querySelector('.q-verify-report');
  if(details&&report&&!details.open)details.open=true;
}

let scheduled=false;
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    preserveSecondaryReportVisibility();
  });
}

if(main)new MutationObserver(schedule).observe(main,{childList:true,subtree:true});
window.addEventListener('hashchange',schedule);
window.addEventListener('pageshow',schedule);
for(const delay of [0,80,250,700])setTimeout(schedule,delay);
