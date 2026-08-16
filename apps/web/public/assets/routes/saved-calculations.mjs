import {listSavedCalculations,removeSavedCalculation,clearSavedCalculations,exportSavedCalculations,exportSavedCalculationsCsv,importSavedCalculations} from '../calculation/persistence.mjs';
import {cloudStatus,setCloudOptIn,pushLocalToCloud,pullCloudToLocal,synchronizeCloud,installCloudResume,cloudMeta} from '../qelly-cloud-sync.mjs';

// Persistence contract retained below: DETERMINISTIC LOCAL behavior remains available;
// Local mode remains the default. Nothing uploads until you explicitly enable cloud sync.
// Conflicts stop automatic overwrite. Offline batches are never silently discarded.

const download=(name,content,type)=>{const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),0);};
const cloudCopy=(state)=>{
  if(!state)return '<span class="q-status q-status--warning">CHECKING</span><p>Reading the authenticated cloud state.</p>';
  if(!state.authenticated)return '<span class="q-status q-status--unavailable">SIGN-IN REQUIRED</span><p>Local calculations remain available. Sign in before opting in to cloud synchronization.</p>';
  if(!state.optIn)return `<span class="q-status q-status--cached">OPT-IN OFF</span><p>${state.cloudRecordCount||0} cloud records · ${state.queuedLocalBatches||0} queued local batches. Nothing uploads until you explicitly enable cloud sync.</p>`;
  return `<span class="q-status q-status--live">CLOUD OPT-IN ACTIVE</span><p>${state.cloudRecordCount||0} cloud records · ${state.pendingOperationCount||0} server operations · ${state.queuedLocalBatches||0} offline batches · last sync ${cloudMeta().lastSyncAt?new Date(cloudMeta().lastSyncAt).toLocaleString():'never'}.</p>`;
};
const pushNotice=(result,verb='upload')=>{
  const remaining=Number(result?.remaining)||0;
  const flushed=Number(result?.flushed)||0;
  const conflicts=result?.conflicts?.length||0;
  const failures=result?.failedBatches?.length||0;
  if(conflicts)return {tone:'danger',message:`${conflicts} cloud conflict${conflicts===1?'':'s'} require manual review. No conflicting record was silently overwritten.`};
  if(result?.offline)return {tone:'neutral',message:`Cloud ${verb} is queued while offline. ${remaining} batch${remaining===1?'':'es'} remain safely stored in this browser.`};
  if(failures&&flushed)return {tone:'neutral',message:`${flushed} record${flushed===1?'':'s'} transferred; ${remaining} batch${remaining===1?'':'es'} remain queued after ${failures} failed attempt${failures===1?'':'s'}.`};
  if(failures)return {tone:'danger',message:`Cloud ${verb} did not complete. ${remaining} batch${remaining===1?'':'es'} remain safely queued for retry.`};
  if(remaining)return {tone:'neutral',message:`Cloud ${verb} is incomplete. ${remaining} batch${remaining===1?'':'es'} remain safely queued.`};
  if(flushed)return {tone:'success',message:`${flushed} record${flushed===1?'':'s'} transferred to the cloud workspace.`};
  return {tone:'neutral',message:'No eligible local records required cloud upload.'};
};
const pullNotice=(result)=>{
  const imported=Number(result?.summary?.imported)||0;
  const deleted=Number(result?.deletedApplied)||0;
  if(result?.revisionHistoryPartial)return {tone:'neutral',message:`Cloud records downloaded: ${imported} imported, ${deleted} local deletion${deleted===1?'':'s'} applied. Revision history is bounded and may be partial.`};
  return {tone:'success',message:`Cloud records downloaded: ${imported} imported and ${deleted} local deletion${deleted===1?'':'s'} applied.`};
};
const syncNotice=(result)=>{
  if(result?.pull)return pullNotice(result.pull);
  return pushNotice(result?.push||result,'synchronization');
};

export async function renderSavedCalculations(main,{api,pageHead,escapeHtml,toast,navigate,state}){
  let filters={query:'',tag:null,favorite:null,sort:'updated-desc'},cloud=null,busy=false,disposeResume=()=>{};
  const authenticated=state?.config?.auth?.authenticated===true;
  const refreshCloud=async()=>{if(!api||!authenticated){cloud={authenticated:false,available:true,optIn:false,cloudRecordCount:0,pendingOperationCount:0,queuedLocalBatches:0};render();return;}try{cloud=await cloudStatus(api);}catch(error){cloud={authenticated:false,error:error.message};}render();};
  const action=async(handler)=>{if(busy)return;busy=true;render();try{const outcome=await handler();if(outcome?.message)toast(outcome.message,{tone:outcome.tone||'neutral'});}catch(error){toast(error.message,{tone:'danger'});}finally{busy=false;await refreshCloud();}};
  const render=()=>{
    let items=[];try{items=listSavedCalculations(filters);}catch(error){main.innerHTML=`<section class="q-page">${pageHead('Local persistence error','Saved Calculations','The browser storage record could not be read safely. No data was silently replaced.')}<div class="q-state-banner is-error"><span class="q-status q-status--unavailable">UNAVAILABLE</span><p>${escapeHtml(error.message)}</p></div></section>`;return;}
    const all=listSavedCalculations(),tags=[...new Set(all.flatMap(item=>item.tags))].sort(),meta=cloudMeta();
    const historyWarning=meta.revisionHistoryPartial?`<div class="q-state-banner is-simulated" data-cloud-history-warning><span class="q-status q-status--warning">PARTIAL REVISION WINDOW</span><p>The latest ${meta.revisionRowsImported||0} revision snapshots were imported within a ${meta.revisionRowsLimitTotal||0}-snapshot browser safety ceiling. Older cloud history remains stored remotely and is not presented as complete.</p></div>`:'';
    const cloudControls=api&&authenticated?`<section class="q-panel"><div class="q-panel-head"><div><h2>Workspace synchronization</h2><p>Keep saved research available across your signed-in devices.</p></div><div class="q-actions">${cloud?.authenticated?`<button class="q-button q-button--secondary" data-cloud-opt>${cloud?.optIn?'Disable sync':'Enable sync'}</button>`:''}<button class="q-button q-button--ghost" data-cloud-download ${!cloud?.authenticated||busy?'disabled':''}>Download</button><button class="q-button q-button--ghost" data-cloud-upload ${!cloud?.authenticated||!cloud?.optIn||busy?'disabled':''}>Upload</button><button class="q-button q-button--primary" data-cloud-sync ${!cloud?.authenticated||!cloud?.optIn||busy?'disabled':''}>Synchronize</button></div></div><div class="q-panel-body"><div class="q-state-banner ${cloud?.optIn?'is-live':'is-simulated'}">${cloudCopy(cloud)}</div>${historyWarning}<p class="q-muted-copy">Conflicts remain visible for review, and queued changes remain on this device until synchronization completes.</p></div></section>`:'';
    main.innerHTML=`<section class="q-page q-saved-calculations-page">
      ${pageHead('Research workspace','Saved Calculations','Reopen, rename, duplicate, revise, restore, import, export and synchronize your calculations.',`<button class="q-button q-button--primary" data-action="new">New calculation</button>`)}
      <div class="q-state-banner"><span class="q-status q-status--cached">AVAILABLE OFFLINE</span><p>Revision history is enabled. Saved calculations remain available on this device without a network connection.</p></div>
      ${cloudControls}
      <section class="q-panel"><div class="q-panel-head"><div><h2>${items.length} of ${all.length} saved item${all.length===1?'':'s'}</h2><p>Searchable, version-preserving and safe to export.</p></div><div class="q-actions"><button class="q-button q-button--secondary" data-action="export-json">Export JSON</button><button class="q-button q-button--ghost" data-action="export-csv">Export CSV</button><label class="q-button q-button--ghost q-file-button">Import JSON<input type="file" id="saved-import" accept="application/json" hidden></label><button class="q-button q-button--danger" data-action="clear" ${all.length?'':'disabled'}>Clear all</button></div></div><div class="q-panel-body">
        <div class="q-filter-bar"><label class="q-field"><span>Search</span><input id="saved-search" type="search" value="${escapeHtml(filters.query)}" placeholder="Name, note, tag or stable ID"></label><label class="q-field"><span>Tag</span><select id="saved-tag"><option value="">All tags</option>${tags.map(tag=>`<option ${filters.tag===tag?'selected':''}>${escapeHtml(tag)}</option>`).join('')}</select></label><label class="q-field"><span>Favorite</span><select id="saved-favorite"><option value="">All</option><option value="true" ${filters.favorite===true?'selected':''}>Favorites</option><option value="false" ${filters.favorite===false?'selected':''}>Not favorites</option></select></label><label class="q-field"><span>Sort</span><select id="saved-sort"><option value="updated-desc" ${filters.sort==='updated-desc'?'selected':''}>Recently updated</option><option value="updated-asc" ${filters.sort==='updated-asc'?'selected':''}>Oldest updated</option><option value="name-asc" ${filters.sort==='name-asc'?'selected':''}>Name A–Z</option><option value="name-desc" ${filters.sort==='name-desc'?'selected':''}>Name Z–A</option></select></label></div>
        <div class="q-saved-grid">${items.map(item=>`<article class="q-saved-card"><div><p class="q-eyebrow">${escapeHtml(item.result?.formulaId??item.result?.indicatorId??'calculation')}</p><h3>${escapeHtml(item.name)} ${item.favorite?'★':''}</h3><p>Version ${item.version} · ${item.revisions.length} revision${item.revisions.length===1?'':'s'} · ${new Date(item.updatedAt).toLocaleString()}</p><p>${item.tags.map(tag=>`<span class="q-chip">${escapeHtml(tag)}</span>`).join(' ')}</p></div><span class="q-status q-status--${item.truthState==='CLOUD RLS'?'live':'cached'}">${item.truthState==='CLOUD RLS'?'SYNCHRONIZED':'THIS DEVICE'}</span><div class="q-actions"><button class="q-button q-button--primary" data-open="${item.id}">Open detail</button><button class="q-button q-button--ghost" data-reopen="${item.id}">Reopen</button><button class="q-button q-button--ghost" data-remove="${item.id}">Remove</button></div></article>`).join('')||'<div class="q-empty-state"><strong>No saved calculations yet</strong><p>Run a calculator or indicator, then save it to your research workspace.</p><button class="q-button q-button--primary" data-action="new">Open Tools</button></div>'}</div>
      </div></section>
    </section>`;
    main.querySelectorAll('[data-action="new"]').forEach(button=>button.addEventListener('click',()=>navigate('calculator-center')));
    main.querySelector('#saved-search')?.addEventListener('input',event=>{filters.query=event.target.value;render();});main.querySelector('#saved-tag')?.addEventListener('change',event=>{filters.tag=event.target.value||null;render();});main.querySelector('#saved-favorite')?.addEventListener('change',event=>{filters.favorite=event.target.value===''?null:event.target.value==='true';render();});main.querySelector('#saved-sort')?.addEventListener('change',event=>{filters.sort=event.target.value;render();});
    main.querySelector('[data-action="export-json"]')?.addEventListener('click',()=>download('qelly-saved-calculations.json',exportSavedCalculations(),'application/json'));main.querySelector('[data-action="export-csv"]')?.addEventListener('click',()=>download('qelly-saved-calculations.csv',exportSavedCalculationsCsv(),'text/csv'));
    main.querySelector('[data-action="clear"]')?.addEventListener('click',()=>{if(confirm('Clear every locally saved calculation and revision?')){clearSavedCalculations();toast('Local saved calculations cleared',{tone:'success'});render();}});
    main.querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',()=>navigate('saved-calculation-detail',button.dataset.open)));main.querySelectorAll('[data-reopen]').forEach(button=>button.addEventListener('click',()=>{const item=all.find(candidate=>candidate.id===button.dataset.reopen);if(item?.result?.formulaId)navigate('calculator-detail',item.result.formulaId);else if(item?.result?.indicatorId)navigate('indicator-detail',item.result.indicatorId);else toast('This record has no executable formula or indicator ID',{tone:'danger'});}));
    main.querySelectorAll('[data-remove]').forEach(button=>button.addEventListener('click',()=>{if(confirm('Remove this saved calculation?')){removeSavedCalculation(button.dataset.remove);toast('Saved calculation removed',{tone:'success'});render();}}));
    main.querySelector('#saved-import')?.addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{const summary=importSavedCalculations(await file.text());toast(`${summary.imported} calculation${summary.imported===1?'':'s'} imported`,{tone:'success'});render();}catch(error){toast(`Import rejected: ${error.message}`,{tone:'danger'});}});
    main.querySelector('[data-cloud-opt]')?.addEventListener('click',()=>action(async()=>{const enabled=await setCloudOptIn(api,!cloud?.optIn);return {tone:'success',message:enabled?'Cloud synchronization enabled':'Cloud synchronization disabled'};}));
    main.querySelector('[data-cloud-upload]')?.addEventListener('click',()=>action(async()=>pushNotice(await pushLocalToCloud(api,all),'upload')));
    main.querySelector('[data-cloud-download]')?.addEventListener('click',()=>action(async()=>pullNotice(await pullCloudToLocal(api,{importSavedCalculations,removeSavedCalculation}))));
    main.querySelector('[data-cloud-sync]')?.addEventListener('click',()=>action(async()=>syncNotice(await synchronizeCloud(api,all,{importSavedCalculations,removeSavedCalculation}))));
  };
  render();
  if(api){
    disposeResume=installCloudResume(api,result=>{
      if(result.flushed||result.failedBatches?.length||result.offline){const notice=pushNotice(result,'resume');toast(notice.message,{tone:notice.tone});}
      refreshCloud();
    });
    await refreshCloud();
  }
  return ()=>disposeResume();
}
