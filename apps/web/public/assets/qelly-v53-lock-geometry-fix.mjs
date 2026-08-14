// Qelly Intelligence — deterministic V5.3 lock geometry reconciliation.
// Desktop uses a fixed 24/40/30 shell plus 64px rail, so the workspace must
// reserve 114px. Mobile's compact shell is already in normal flow; do not add
// a second vertical reserve. Keep this rule last in <head> so async stylesheet
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
    padding:11px 12px 92px!important;
  }
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
