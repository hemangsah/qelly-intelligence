// Qelly Intelligence — deterministic V5.3 lock geometry reconciliation.
// Desktop uses a fixed 24/40/30 shell plus 64px rail, so the workspace must
// reserve 114px. Mobile's compact shell is absolutely positioned and the
// accepted lock surface already carries its correct first-view inset; do not
// add a second shell reserve. Keep this rule last in <head> so async stylesheet
// ordering cannot collapse or double-offset the accepted first-view geometry.

const STYLE_ID='qelly-v53-lock-geometry-fix';
const CSS=`
html[data-v53-lock-candidate="true"] .q-shell{
  display:block!important;
  min-height:100vh!important;
  background:var(--q-v53-lock-bg,#09070A)!important;
}
html[data-v53-lock-candidate="true"] #edge-dock,
html[data-v53-lock-candidate="true"] #rail{
  display:none!important;
}
html[data-v53-lock-candidate="true"] #main{
  display:block!important;
  width:calc(100% - 64px)!important;
  max-width:none!important;
  margin:0 0 0 64px!important;
  padding:114px 0 0!important;
  background:var(--q-v53-lock-bg,#09070A)!important;
}
html[data-v53-lock-candidate="true"] .q-v53-lock-page{
  width:100%!important;
  padding:12px 24px 10px 20px!important;
}
@media(max-width:900px){
  html[data-v53-lock-candidate="true"] #main{
    width:100%!important;
    margin:0!important;
    padding:0!important;
  }
  html[data-v53-lock-candidate="true"] .q-v53-lock-page{
    position:relative!important;
    min-height:844px!important;
    padding:11px 12px 92px!important;
  }

  /* Accepted V5.3 compact system identity: mark + QELLY, not the desktop
     reference-system sentence. Accessible text remains owned by the DOM. */
  html[data-v53-lock-candidate="true"] .q-v53-lock-system span{
    display:inline-flex!important;
    align-items:center!important;
    gap:6px!important;
    font-size:0!important;
  }
  html[data-v53-lock-candidate="true"] .q-v53-lock-system span::before{
    content:''!important;
    display:inline-block!important;
    width:14px!important;
    height:14px!important;
    box-sizing:border-box!important;
    border:1.5px solid var(--v53-shell-accent,#e6a3ba)!important;
    border-radius:50%!important;
    background:linear-gradient(142deg,transparent 44%,var(--v53-shell-accent,#e6a3ba) 45%,var(--v53-shell-accent,#e6a3ba) 52%,transparent 53%)!important;
  }
  html[data-v53-lock-candidate="true"] .q-v53-lock-system span::after{
    content:'QELLY'!important;
    color:var(--v53-shell-text,#f4eff2)!important;
    font:750 10px/1 var(--q-font-ui,"IBM Plex Sans Variable","IBM Plex Sans",Arial,sans-serif)!important;
    letter-spacing:.04em!important;
  }

  /* Accepted mobile command copy and compact shortcut. */
  html[data-v53-lock-candidate="true"] .q-v53-lock-command>span:nth-child(2){
    font-size:0!important;
  }
  html[data-v53-lock-candidate="true"] .q-v53-lock-command>span:nth-child(2)::after{
    content:'Search Qelly…'!important;
    font:500 10px/1 var(--q-font-ui,"IBM Plex Sans Variable","IBM Plex Sans",Arial,sans-serif)!important;
  }
  html[data-v53-lock-candidate="true"] .q-v53-lock-command kbd{
    font-size:0!important;
  }
  html[data-v53-lock-candidate="true"] .q-v53-lock-command kbd::after{
    content:'⌘K'!important;
    font:650 9px/20px var(--q-font-mono,"IBM Plex Mono",monospace)!important;
  }

  /* Mobile accepted-lock terminology is task-first. Keep the richer DOM labels
     for accessibility and desktop; only the compact visual copy changes. */
  html[data-v53-lock-candidate="true"] .q-v53-lock-primary>h2{
    font-size:0!important;
  }
  html[data-v53-lock-candidate="true"] .q-v53-lock-primary>h2::after{
    content:'PRIMARY TASK'!important;
    font-size:10px!important;
  }
  html[data-v53-lock-candidate="true"] .q-v53-lock-inspector>h3{
    font-size:0!important;
  }
  html[data-v53-lock-candidate="true"] .q-v53-lock-inspector>h3::after{
    content:'EVIDENCE SHEET'!important;
    font-size:10px!important;
  }

  /* Accepted mobile frames end with a route-specific V5.3 sign-off above the
     task nav. The real route remains present below this governed first view. */
  html[data-v53-lock-candidate="true"] .q-v53-lock-page::after{
    content:'V5.3 · ' attr(data-v53-lock-route)!important;
    position:absolute!important;
    right:14px!important;
    bottom:68px!important;
    color:var(--q-v53-lock-muted,#9f9399)!important;
    font:650 8px/1 var(--q-font-mono,"IBM Plex Mono",monospace)!important;
    letter-spacing:.02em!important;
  }
  html[data-v53-lock-candidate="true"] .q-v53-lock-page[data-v53-lock-route="market"]::after{content:'V5.3 · market-command'!important;}
  html[data-v53-lock-candidate="true"] .q-v53-lock-page[data-v53-lock-route="research-workspace"]::after{content:'V5.3 · research-evidence'!important;}
  html[data-v53-lock-candidate="true"] .q-v53-lock-page[data-v53-lock-route="security-setup"]::after{content:'V5.3 · identity-security'!important;}
}
`;

function ensureLast(){
  if(typeof document==='undefined')return null;
  let style=document.getElementById(STYLE_ID);
  if(!style){
    style=document.createElement('style');
    style.id=STYLE_ID;
    style.dataset.qellyV53LockGeometry='active';
    style.textContent=CSS;
  }
  if(document.head?.lastElementChild!==style)document.head?.append(style);
  return style;
}

if(typeof document!=='undefined'){
  const style=ensureLast();
  if(document.head&&style){
    const observer=new MutationObserver(()=>{
      if(document.head.lastElementChild!==style)document.head.append(style);
    });
    observer.observe(document.head,{childList:true});
  }
}

export const __v53LockGeometryTest=Object.freeze({STYLE_ID,CSS,ensureLast});
