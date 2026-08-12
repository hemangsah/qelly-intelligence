const itemTypeLabel=(value)=>String(value??'note').replaceAll('-',' ').replace(/\b\w/g,(character)=>character.toUpperCase());

export async function renderResearchWorkspace(main,deps){
 const {api,pageHead,stateBanner,escapeHtml,toast,navigate,renderRoute}=deps;
 const listing=await api('/api/v1/research/workspaces');
 const first=listing.items[0];
 const workspace=first?await api(`/api/v1/research/workspaces/${encodeURIComponent(first.researchWorkspaceId)}`):null;
 const items=workspace?.items??[];
 const references=items.filter((item)=>item.referenceId);
 const notes=items.filter((item)=>item.type==='note');
 const typeCount=new Set(items.map((item)=>item.type)).size;
 const persistence=workspace?.cloudSync?'cloud sync':workspace?.localPersistence?'local persistence':'persistence unavailable';
 const persistenceState=workspace?.cloudSync||workspace?.localPersistence?'cached':'unavailable';
 const lastUpdated=workspace?.updatedAt??listing.updatedAt??null;
 const recentItems=[...items].sort((left,right)=>String(right.addedAt).localeCompare(String(left.addedAt))).slice(0,4);
 const referenceRows=references.length?references.map((item)=>`<div class="q-research-truth-row" data-evidence="research-reference"><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(itemTypeLabel(item.type))}</small></span><code>${escapeHtml(item.referenceId)}</code></div>`).join(''):'<p class="q-research-empty">No external or canonical reference IDs are attached to this workspace yet.</p>';
 const evidenceCards=items.length?items.map((item)=>`<article class="q-research-evidence-card" data-evidence="research-item" data-source="${escapeHtml(item.referenceId??'local-note')}"><div class="q-research-evidence-card__head"><span class="q-status q-status--cached">${escapeHtml(itemTypeLabel(item.type))}</span><time datetime="${escapeHtml(item.addedAt)}">${escapeHtml(item.addedAt)}</time></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.note||'No note supplied.')}</p><div class="q-research-evidence-card__source"><span>Reference</span><strong>${escapeHtml(item.referenceId??'Local note · no external reference')}</strong></div></article>`).join(''):'<div class="q-research-empty-state"><strong>No evidence items</strong><p>Add a note, asset, filing, chart or event to begin the workspace evidence trail.</p></div>';
 const activityRows=recentItems.length?recentItems.map((item)=>`<div class="q-research-activity-item"><time datetime="${escapeHtml(item.addedAt)}">${escapeHtml(item.addedAt)}</time><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.referenceId??'local note')}</span></div>`).join(''):'<div class="q-research-activity-item"><strong>No research activity yet</strong><span>Workspace is empty.</span></div>';
 main.innerHTML=`<section class="q-page q-research-workspace-page">${pageHead('Qelly Intelligence · Research & Evidence','Research Workspace','Persistent evidence boards combining assets, filings, research references, chart references, events and notes. Structured contradiction and falsification fields are not yet modeled.',`<button class="q-button q-button--secondary" data-action="portfolio">Portfolio analytics</button><button class="q-button q-button--secondary" data-action="history">Version history</button><button class="q-button q-button--primary" data-action="create-workspace">New workspace</button>`)}${stateBanner()}
 <section class="q-research-kpi-strip" aria-label="Research workspace evidence summary">
  <article><span>Workspaces</span><strong>${listing.items.length}</strong><small>${escapeHtml(listing.localPersistence?'local':'scoped')} registry</small></article>
  <article><span>Evidence items</span><strong>${items.length}</strong><small>${typeCount} represented ${typeCount===1?'type':'types'}</small></article>
  <article><span>References</span><strong>${references.length}</strong><small>${notes.length} local ${notes.length===1?'note':'notes'}</small></article>
  <article><span>Revision</span><strong>${workspace?.revision??'—'}</strong><small>${workspace?'workspace revision':'no workspace'}</small></article>
  <article><span>Persistence</span><strong class="q-research-kpi-text">${escapeHtml(persistence)}</strong><small>collaboration ${listing.collaboration?'available':'off'}</small></article>
  <article><span>Contradictions</span><strong class="q-research-kpi-text">Not modeled</strong><small>no structured field</small></article>
 </section>
 ${workspace?`<section class="q-research-workstation" data-research-workspace-id="${escapeHtml(workspace.researchWorkspaceId)}">
  <aside class="q-research-context-rail" aria-label="Research workspace context">
   <div class="q-research-section-label">Research context</div>
   <div class="q-research-context-title"><strong>${escapeHtml(workspace.name)}</strong><span class="q-status q-status--cached">revision ${workspace.revision}</span></div>
   <p>${escapeHtml(workspace.description)}</p>
   <dl class="q-research-context-dl">
    <div><dt>Workspace ID</dt><dd>${escapeHtml(workspace.researchWorkspaceId)}</dd></div>
    <div><dt>Created</dt><dd>${escapeHtml(workspace.createdAt)}</dd></div>
    <div><dt>Updated</dt><dd>${escapeHtml(lastUpdated??'unavailable')}</dd></div>
    <div><dt>Storage</dt><dd>${escapeHtml(persistence)}</dd></div>
    <div><dt>Collaboration</dt><dd>Off</dd></div>
   </dl>
   <div class="q-research-tag-rail">${workspace.tags.length?workspace.tags.map((tag)=>`<span class="q-tag">${escapeHtml(tag)}</span>`).join(''):'<span class="q-tag">no tags</span>'}</div>
   <div class="q-research-context-actions"><button class="q-button q-button--secondary" data-action="history">Audit versions</button><button class="q-button q-button--secondary" data-action="portfolio">Portfolio context</button></div>
  </aside>
  <section class="q-research-primary" aria-label="Primary research evidence workspace">
   <div class="q-research-primary-head"><div><span class="q-research-section-label">Primary analytical workspace</span><h2>${escapeHtml(workspace.name)}</h2><p>Evidence items remain distinct from conclusions. References are displayed exactly as stored.</p></div><span class="q-status q-status--${persistenceState}">${escapeHtml(persistence)}</span></div>
   <div class="q-research-evidence-grid">${evidenceCards}</div>
   <section class="q-research-capture" aria-label="Add research evidence item">
    <div class="q-research-section-label">Capture evidence</div>
    <div class="q-inline-form q-research-capture-form"><label class="q-setting"><span>Title</span><input id="research-title" value="New research note" maxlength="120"></label><label class="q-setting"><span>Type</span><select id="research-type"><option value="note">Note</option><option value="asset">Asset</option><option value="filing">Filing</option><option value="chart">Chart</option><option value="event">Event</option></select></label><label class="q-setting q-research-note-field"><span>Note</span><input id="research-note" value="Add evidence and next action." maxlength="1000"></label><button class="q-button q-button--primary" data-action="add-research-item">Add item</button></div>
   </section>
  </section>
  <aside class="q-research-inspector" aria-label="Intelligence Inspector — research truth and evidence">
   <div class="q-research-section-label">Intelligence inspector</div>
   <section class="q-research-inspector-block" data-provenance="workspace-truth"><div class="q-research-inspector-head"><h3>Workspace truth</h3><span class="q-status q-status--cached">governed</span></div><div class="q-research-truth-row"><span>Evidence items</span><strong>${items.length}</strong></div><div class="q-research-truth-row"><span>References</span><strong>${references.length}</strong></div><div class="q-research-truth-row"><span>Revision</span><strong>${workspace.revision}</strong></div><div class="q-research-truth-row"><span>Updated</span><strong>${escapeHtml(lastUpdated??'unavailable')}</strong></div></section>
   <section class="q-research-inspector-block" data-provenance="source-references"><div class="q-research-inspector-head"><h3>Source references</h3><span>${references.length}</span></div>${referenceRows}</section>
   <section class="q-research-inspector-block q-research-inspector-block--warning" data-provenance="falsification-boundary"><div class="q-research-inspector-head"><h3>Contradiction / falsification</h3><span class="q-status q-status--unavailable">not modeled</span></div><p>The current research workspace schema stores evidence items, notes and reference IDs. It does not store structured contradiction, hypothesis confidence or falsification records. Qelly will not infer them from note text.</p></section>
   <section class="q-research-inspector-block" data-provenance="production-gates"><div class="q-research-inspector-head"><h3>Production gates</h3></div><div class="q-research-truth-row"><span>Comments / presence</span><strong>Deferred</strong></div><div class="q-research-truth-row"><span>External sharing</span><strong>Deferred</strong></div><div class="q-research-truth-row"><span>Research export</span><strong>Deferred</strong></div><p>These capabilities require real identity, permission inheritance, revocation and entitlement-aware services. They are not simulated as complete.</p></section>
  </aside>
 </section>
 <section class="q-research-activity" aria-label="Research activity and evidence trail"><div class="q-research-section-label">Activity / evidence</div><div class="q-research-activity-track">${activityRows}</div></section>`:`<section class="q-research-empty-state q-panel"><strong>No research workspace exists.</strong><p>Create a workspace to begin a persistent evidence board. No research content is simulated when the workspace registry is empty.</p></section>`}
 </section>`;
 main.querySelectorAll('[data-action="portfolio"]').forEach((button)=>button.addEventListener('click',()=>navigate('portfolio-analytics')));
 main.querySelectorAll('[data-action="history"]').forEach((button)=>button.addEventListener('click',()=>navigate('research-history')));
 main.querySelector('[data-action="create-workspace"]').addEventListener('click',async()=>{await api('/api/v1/research/workspaces',{method:'POST',headers:{'Idempotency-Key':`research-create-${Date.now()}`},body:JSON.stringify({name:`Research board ${listing.items.length+1}`,description:'Created from the Qelly research workspace.',tags:['research']})});toast('Research workspace created',{tone:'success'});renderRoute();});
 main.querySelector('[data-action="add-research-item"]')?.addEventListener('click',async()=>{await api(`/api/v1/research/workspaces/${encodeURIComponent(workspace.researchWorkspaceId)}/items`,{method:'POST',headers:{'Idempotency-Key':`research-item-${Date.now()}`},body:JSON.stringify({type:document.getElementById('research-type').value,title:document.getElementById('research-title').value,note:document.getElementById('research-note').value,referenceId:null})});toast('Research item added',{tone:'success'});renderRoute();});
}
