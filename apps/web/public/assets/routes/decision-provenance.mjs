import {decisionAssets,evaluateDecision} from '../qelly-decision-engine.mjs';

const WAVE3_STYLESHEET=new URL('../qelly-v54-decision-provenance.css',import.meta.url).href;
const activateWave3Stylesheet=()=>{if(!document.querySelector('link[data-qelly-v54-decision-provenance="wave3"]')){const link=document.createElement('link');link.rel='stylesheet';link.href=WAVE3_STYLESHEET;link.dataset.qellyV54DecisionProvenance='wave3';document.head.append(link);}document.documentElement.dataset.v54DecisionProvenance='wave3';};

const downloadJson=(filename,value)=>{const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),500);};
const tone=(type)=>({SourceRecord:'cached',ProviderObservation:'live',NormalizedObservation:'cached',MarketMove:'warning',Hypothesis:'partial',DecisionRecord:'cached',RiskAssessment:'unavailable',Asset:'live'}[type]??'cached');
const nodeTone=(node,isDemo)=>isDemo?'simulated':tone(node.type);
const options=(values,current)=>values.map(([value,label])=>`<option value="${value}" ${value===current?'selected':''}>${label}</option>`).join('');
const listMarkup=(items,escapeHtml,{ordered=false,empty='None recorded.'}={})=>{const tag=ordered?'ol':'ul';return `<${tag}>${items.length?items.map((item)=>`<li>${escapeHtml(item)}</li>`).join(''):`<li>${escapeHtml(empty)}</li>`}</${tag}>`;};
const graphValue=(value)=>typeof value==='object'&&value!==null?JSON.stringify(value):String(value??'—');
const defaultGraphNodeId=(graph)=>graph?.nodes?.find((node)=>node.type==='DecisionRecord')?.nodeId??graph?.nodes?.[0]?.nodeId??null;

function decisionControls(result,isDemo,escapeHtml){
  return `<section class="q-panel q-decision-maker-panel"><div class="q-panel-head"><div><p class="q-eyebrow">Qelly Intelligence · explainable decision support</p><h2>AI Decision Maker · evidence mode</h2><p>Convert a human hypothesis into an auditable research posture. ${isDemo?'This surface runs a deterministic explainable framework over fixed scenario profiles; no live AI model or live market feed is running.':'The output remains decision support and requires human verification.'}</p></div><span class="q-status q-status--${isDemo?'simulated':'cached'}">${isDemo?'deterministic preview':'human in control'}</span></div><div class="q-panel-body">
    <form data-qelly-decision-form class="q-inline-form">
      <label class="q-setting"><span>Canonical asset</span><select name="assetId">${decisionAssets.map((asset)=>`<option value="${asset.id}" ${asset.id===result.input.assetId?'selected':''}>${escapeHtml(asset.name)} · ${escapeHtml(asset.symbol)}</option>`).join('')}</select></label>
      <label class="q-setting"><span>Horizon</span><select name="horizon">${options([['24h','24 hours'],['7d','7 days'],['30d','30 days'],['90d','90 days']],result.input.horizon)}</select></label>
      <label class="q-setting"><span>Risk posture</span><select name="risk">${options([['conservative','Conservative'],['balanced','Balanced'],['aggressive','Aggressive']],result.input.risk)}</select></label>
      <label class="q-setting"><span>User-assessed evidence confidence · <output>${result.input.evidenceConfidence}%</output></span><input name="evidenceConfidence" type="range" min="25" max="95" step="5" value="${result.input.evidenceConfidence}"><small>This is an assumption, not provider-derived source quality.</small></label>
      <label class="q-setting"><span>Scenario move · <output>${result.input.scenarioMove}%</output></span><input name="scenarioMove" type="range" min="-30" max="30" step="1" value="${result.input.scenarioMove}"></label>
      <label class="q-setting"><span>Human hypothesis</span><textarea name="thesis" rows="3" maxlength="1200" placeholder="State the thesis and the evidence supporting it.">${escapeHtml(result.input.thesis)}</textarea></label>
      <label class="q-setting"><span>Invalidation condition</span><textarea name="invalidationCondition" rows="3" maxlength="1200" placeholder="State the observable condition that would invalidate the thesis.">${escapeHtml(result.input.invalidationCondition)}</textarea></label>
      <div class="q-page-actions"><button class="q-button q-button--primary" type="submit">Run decision analysis</button>${isDemo?'':`<button class="q-button q-button--secondary" type="button" data-action="persist-decision">Persist evidence package</button>`}</div>
    </form>
    <section class="q-decision-result" aria-live="polite">
      <div class="q-decision-result__score"><span>Decision-support score</span><strong>${result.score}</strong><small>Transparent deterministic composite</small></div>
      <div><p class="q-eyebrow">Research posture</p><h2>${escapeHtml(result.posture)}</h2><p>${escapeHtml(result.asset.name)} · ${escapeHtml(result.input.horizon)} · ${escapeHtml(result.confidenceBand)} user-assessed confidence · ${escapeHtml(result.riskPosture)} scenario risk</p><div class="q-capabilities"><span class="q-capability">Execution disabled</span><span class="q-capability">Human verification required</span><span class="q-capability">considered-not-executed</span><span class="q-capability">${escapeHtml(result.methodology.id)}@${escapeHtml(result.methodology.version)}</span></div></div>
    </section>
    <div class="q-decision-evidence-grid"><article><h3>Supports</h3>${listMarkup(result.supports,escapeHtml)}</article><article><h3>Contradicts</h3>${listMarkup(result.contradictions,escapeHtml)}</article><article><h3>Verify next</h3>${listMarkup(result.nextSteps,escapeHtml,{ordered:true})}</article></div>
    <div class="q-truth-callout is-compact"><span class="q-status q-status--unavailable">no execution</span><p>${escapeHtml(result.boundary)}</p></div>
  </div></section>`;
}

function analysisAuditMarkup(result,escapeHtml){
  const dimensions=result.sourceQuality.dimensions;
  const componentRows=Object.entries(result.methodology.components).map(([key,value])=>`<div class="q-record-row"><span><strong>${escapeHtml(key)}</strong><small>Declared score contribution</small></span><span>${escapeHtml(String(value))}</span></div>`).join('');
  return `<section class="q-panel"><div class="q-panel-head"><div><p class="q-eyebrow">Evidence separation</p><h2>Analysis record</h2><p>Observed facts, scenario inputs, calculations and inferences remain distinct.</p></div><span class="q-status q-status--simulated">${escapeHtml(result.analysisId)}</span></div><div class="q-panel-body">
    <div class="q-decision-evidence-grid"><article><h3>Observed facts</h3>${listMarkup(result.observedFacts,escapeHtml,{empty:'No live observed facts are attached.'})}</article><article><h3>Scenario observations</h3>${listMarkup(result.scenarioObservations,escapeHtml)}</article><article><h3>Derived metrics</h3>${listMarkup(result.derivedMetrics,escapeHtml)}</article><article><h3>Inferences</h3>${listMarkup(result.inferences,escapeHtml)}</article><article><h3>Assumptions</h3>${listMarkup(result.assumptions,escapeHtml)}</article><article><h3>Uncertainty</h3>${listMarkup(result.uncertainty,escapeHtml)}</article><article><h3>Missing information</h3>${listMarkup(result.missingInformation,escapeHtml)}</article></div>
  </div></section>
  <section class="q-panel"><div class="q-panel-head"><div><p class="q-eyebrow">Source quality</p><h2>${result.sourceQuality.composite}/100 demonstration-package quality</h2><p>${escapeHtml(result.sourceQuality.interpretation)}</p></div><span class="q-status q-status--warning">not live evidence</span></div><div class="q-panel-body">
    <div class="q-kpi-grid"><article class="q-kpi"><div class="q-kpi-label">Data quality</div><div class="q-kpi-value">${dimensions.dataQuality}</div></article><article class="q-kpi"><div class="q-kpi-label">Provider agreement</div><div class="q-kpi-value">${dimensions.providerAgreement}</div></article><article class="q-kpi"><div class="q-kpi-label">Freshness</div><div class="q-kpi-value">${dimensions.freshness}</div></article><article class="q-kpi"><div class="q-kpi-label">Calculation repeatability</div><div class="q-kpi-value">${dimensions.modelCertainty}</div></article><article class="q-kpi"><div class="q-kpi-label">Historical stability</div><div class="q-kpi-value">${dimensions.historicalStability}</div></article></div>
    <div class="q-decision-evidence-grid"><article><h3>Quality warnings</h3>${listMarkup(result.sourceQuality.warnings,escapeHtml)}</article><article><h3>Source records</h3>${listMarkup(result.sourceRecords.map((record)=>`${record.provider} · ${record.freshnessState} · ${record.qualityFlags.join(', ')}`),escapeHtml)}</article></div>
  </div></section>
  <section class="q-panel"><div class="q-panel-head"><div><p class="q-eyebrow">Methodology</p><h2>${escapeHtml(result.methodology.id)} · v${escapeHtml(result.methodology.version)}</h2><p>${escapeHtml(result.methodology.formula)}</p></div><span class="q-status q-status--cached">versioned</span></div><div class="q-panel-body q-stack">${componentRows}<div class="q-truth-callout is-compact"><span class="q-status q-status--unavailable">boundary</span><p>${escapeHtml(result.methodology.boundary)}</p></div></div></section>`;
}

function graphMarkup(graph,isDemo,escapeHtml,selectedNodeId){
  if(!graph)return `<section class="q-panel"><div class="q-panel-body"><div class="q-empty"><h2>No persisted evidence package yet</h2><p>Backend unavailable. Backend persistence is unavailable in this mode. Run an analysis above; this surface supports considered decisions only.</p></div></div></section>`;
  const nodes=graph.nodes??[],edges=graph.edges??[];
  const selected=nodes.find((node)=>node.nodeId===selectedNodeId)??nodes.find((node)=>node.type==='DecisionRecord')??nodes[0]??null;
  if(!selected)return `<section class="q-panel"><div class="q-panel-body"><div class="q-empty"><h2>No evidence records in this graph</h2><p>The graph package is present but contains no traversable records.</p></div></div></section>`;
  const nodeIndex=new Map(nodes.map((node)=>[node.nodeId,node]));
  const connected=edges.filter((edge)=>edge.fromNodeId===selected.nodeId||edge.toNodeId===selected.nodeId);
  const details=Object.entries(selected.data??{});
  const selectedIndex=Math.max(0,nodes.findIndex((node)=>node.nodeId===selected.nodeId));
  const selectedTabId=`q-provenance-node-${selectedIndex}`;
  const nodeButtons=nodes.map((node,index)=>`<button type="button" role="tab" id="q-provenance-node-${index}" class="q-provenance-node${node.nodeId===selected.nodeId?' is-selected':''}" data-provenance-node="${escapeHtml(node.nodeId)}" aria-selected="${node.nodeId===selected.nodeId?'true':'false'}" aria-controls="q-provenance-focus" tabindex="${node.nodeId===selected.nodeId?'0':'-1'}"><span class="q-provenance-node__meta"><span class="q-status q-status--${nodeTone(node,isDemo)}">${escapeHtml(node.type)}</span><small>r${escapeHtml(String(node.revision))}</small></span><strong>${escapeHtml(node.label)}</strong><small>${escapeHtml(node.classification)}</small></button>`).join('');
  const relationButtons=connected.length?connected.map((edge)=>{
    const outbound=edge.fromNodeId===selected.nodeId;
    const counterpartId=outbound?edge.toNodeId:edge.fromNodeId;
    const counterpart=nodeIndex.get(counterpartId);
    const counterpartLabel=counterpart?.label??counterpartId;
    return `<button type="button" class="q-provenance-relation" data-provenance-related-node="${escapeHtml(counterpartId)}" aria-controls="q-provenance-focus" aria-label="Traverse ${escapeHtml(edge.type)} relationship to ${escapeHtml(counterpartLabel)}"><span class="q-provenance-relation__direction">${outbound?'outbound':'inbound'}</span><strong>${escapeHtml(edge.type)}</strong><span>${outbound?'→':'←'} ${escapeHtml(counterpartLabel)}</span><small>${escapeHtml(counterpart?.type??'record')}</small></button>`;
  }).join(''):`<div class="q-provenance-no-relations"><strong>No governed relationships</strong><p>This record is isolated in the current evidence package.</p></div>`;
  const detailMarkup=details.length?`<dl class="q-provenance-detail-grid">${details.map(([key,value])=>`<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(graphValue(value))}</dd></div>`).join('')}</dl>`:`<p class="q-provenance-empty-detail">No additional record payload is attached.</p>`;
  const allRelationships=edges.length?edges.map((edge)=>{const from=nodeIndex.get(edge.fromNodeId),to=nodeIndex.get(edge.toNodeId);return `<div class="q-record-row"><span><strong>${escapeHtml(from?.label??edge.fromNodeId)}</strong><small>${escapeHtml(edge.type)} → ${escapeHtml(to?.label??edge.toNodeId)}</small></span><span class="q-status q-status--${isDemo?'simulated':'cached'}">${isDemo?'demo link':'linked'}</span></div>`;}).join(''):`<div class="q-empty"><h3>No relationships recorded</h3><p>The graph contains records but no governed edges.</p></div>`;
  return `<section class="q-panel q-provenance-explorer" data-provenance-explorer><div class="q-panel-head"><div><p class="q-eyebrow">Evidence graph · traversal mode</p><h2>${escapeHtml(graph.title)}</h2><p>${escapeHtml(graph.truthBoundary)}</p></div><span class="q-status q-status--${isDemo?'simulated':graph.integrity?.valid?'live':'unavailable'}">${isDemo?'demo structure':graph.integrity?.valid?'integrity valid':'integrity unavailable'}</span></div><div class="q-panel-body q-provenance-panel-body">
    <div class="q-provenance-workbench">
      <nav class="q-provenance-node-navigator" aria-label="Evidence graph records"><div class="q-provenance-column-head"><span>Records</span><strong>${nodes.length}</strong></div><div class="q-provenance-node-list" role="tablist" aria-label="Evidence graph records">${nodeButtons}</div><p class="q-provenance-keyboard-hint">Use Tab to enter the graph. Arrow keys move between records.</p></nav>
      <article class="q-provenance-focus" id="q-provenance-focus" role="tabpanel" aria-labelledby="${selectedTabId}" data-provenance-focus aria-live="polite" aria-atomic="true"><div class="q-provenance-focus__head"><div><p class="q-eyebrow">Selected record</p><h3>${escapeHtml(selected.label)}</h3></div><span class="q-status q-status--${nodeTone(selected,isDemo)}">${escapeHtml(selected.type)}</span></div><div class="q-provenance-record-meta"><span>${escapeHtml(selected.classification)}</span><span>Revision ${escapeHtml(String(selected.revision))}</span><span>${escapeHtml(selected.nodeId)}</span></div>${detailMarkup}</article>
      <aside class="q-provenance-relations" aria-label="Relationships for selected record"><div class="q-provenance-column-head"><span>Connected evidence</span><strong>${connected.length}</strong></div><div class="q-provenance-relation-list">${relationButtons}</div></aside>
    </div>
    <div class="q-provenance-context-ribbon" data-provenance-context aria-live="polite"><span class="q-status q-status--${nodeTone(selected,isDemo)}">${escapeHtml(selected.type)}</span><strong>${escapeHtml(selected.label)}</strong><small>${connected.length} governed relationship${connected.length===1?'':'s'} · revision ${escapeHtml(String(selected.revision))}</small></div>
  </div></section>
  <section class="q-panel q-provenance-relationships-audit"><div class="q-panel-head"><div><h2>Governed relationships</h2><p>Every edge points to an existing record. Missing or orphaned evidence must remain visible.</p></div><span class="q-status q-status--${isDemo?'simulated':'cached'}">${edges.length} relationships</span></div><div class="q-panel-body q-stack">${allRelationships}</div></section>
  <section class="q-panel"><div class="q-panel-head"><div><h2>Accessible text alternative</h2><p>The full relationship remains usable without the visual graph.</p></div></div><div class="q-panel-body"><ol>${(graph.textAlternative?.steps??[]).map((step)=>`<li>${escapeHtml(step)}</li>`).join('')}</ol></div></section>`;
}

export async function renderDecisionProvenance(main,deps){
  activateWave3Stylesheet();
  const {api,pageHead,stateBanner,escapeHtml,toast,renderRoute,navigate}=deps;
  const listing=await api('/api/v1/evidence/graphs');
  const graph=listing.items?.[0]?await api(`/api/v1/evidence/graphs/${encodeURIComponent(listing.items[0].graphId)}`):null;
  const isDemo=listing.mode==='deterministic-demo';
  let result=evaluateDecision();
  let selectedNodeId=defaultGraphNodeId(graph);

  const bindGraph=()=>{
    const stack=main.querySelector('.q-decision-graph-stack');
    if(!stack||!graph)return;
    const activate=(nodeId,{focus=true}={})=>{
      if(!graph.nodes?.some((node)=>node.nodeId===nodeId))return;
      selectedNodeId=nodeId;
      stack.innerHTML=graphMarkup(graph,isDemo,escapeHtml,selectedNodeId);
      bindGraph();
      if(focus)requestAnimationFrame(()=>Array.from(stack.querySelectorAll('[data-provenance-node]')).find((button)=>button.dataset.provenanceNode===selectedNodeId)?.focus());
    };
    const buttons=Array.from(stack.querySelectorAll('[data-provenance-node]'));
    buttons.forEach((button,index)=>{
      button.addEventListener('click',()=>activate(button.dataset.provenanceNode));
      button.addEventListener('keydown',(event)=>{
        let nextIndex=null;
        if(event.key==='ArrowDown'||event.key==='ArrowRight')nextIndex=(index+1)%buttons.length;
        if(event.key==='ArrowUp'||event.key==='ArrowLeft')nextIndex=(index-1+buttons.length)%buttons.length;
        if(event.key==='Home')nextIndex=0;
        if(event.key==='End')nextIndex=buttons.length-1;
        if(nextIndex===null)return;
        event.preventDefault();
        activate(buttons[nextIndex].dataset.provenanceNode);
      });
    });
    stack.querySelectorAll('[data-provenance-related-node]').forEach((button)=>button.addEventListener('click',()=>activate(button.dataset.provenanceRelatedNode)));
  };

  const draw=()=>{
    main.innerHTML=`<section class="q-page q-decision-provenance-page">${pageHead('Explainable decision intelligence','Qelly AI Decision Support','Analyze a market hypothesis, separate evidence from inference, expose contradictions and preserve the path to a human decision.',`<button class="q-button q-button--secondary" data-action="market">Open market</button><button class="q-button q-button--secondary" data-action="export-decision">Export analysis</button><button class="q-button q-button--primary" data-action="export-graph" ${graph?'':'disabled'}>Export provenance</button>`)}${stateBanner()}
      <div class="q-truth-callout"><span class="q-status q-status--${isDemo?'simulated':'cached'}">${isDemo?'demo · not persisted · not live':'workspace evidence'}</span><p>${escapeHtml(listing.truthBoundary)}</p></div>
      <div class="q-kpi-grid"><article class="q-kpi"><div class="q-kpi-label">Research posture</div><div class="q-kpi-value">${escapeHtml(result.posture)}</div><div class="q-kpi-meta"><span>${escapeHtml(result.asset.symbol)} · ${escapeHtml(result.input.horizon)}</span><span class="q-status q-status--cached">score ${result.score}</span></div></article><article class="q-kpi"><div class="q-kpi-label">User-assessed confidence</div><div class="q-kpi-value">${result.input.evidenceConfidence}%</div><div class="q-kpi-meta"><span>${escapeHtml(result.confidenceBand)} band</span><span class="q-status q-status--warning">assumption</span></div></article><article class="q-kpi"><div class="q-kpi-label">Source quality</div><div class="q-kpi-value">${result.sourceQuality.composite}</div><div class="q-kpi-meta"><span>demo package</span><span class="q-status q-status--warning">freshness unavailable</span></div></article><article class="q-kpi"><div class="q-kpi-label">Execution</div><div class="q-kpi-value">Off</div><div class="q-kpi-meta"><span>decision support only</span><span class="q-status q-status--unavailable">disabled</span></div></article></div>
      <div class="q-decision-graph-stack">${graphMarkup(graph,isDemo,escapeHtml,selectedNodeId)}</div>
      ${decisionControls(result,isDemo,escapeHtml)}
      ${analysisAuditMarkup(result,escapeHtml)}
    </section>`;

    bindGraph();
    main.querySelector('[data-action="market"]')?.addEventListener('click',()=>navigate('market'));
    main.querySelector('[data-action="export-decision"]')?.addEventListener('click',()=>{downloadJson(`qelly-decision-${result.asset.symbol.toLowerCase()}.json`,{generatedAt:new Date().toISOString(),product:'Qelly Intelligence',...result});toast('Decision analysis exported',{tone:'success'});});
    main.querySelector('[data-action="export-graph"]')?.addEventListener('click',async()=>{if(!graph)return;const exported=await api(`/api/v1/evidence/graphs/${encodeURIComponent(graph.graphId)}/export`);downloadJson(`qelly-evidence-${graph.graphId}.json`,exported);toast('Provenance package exported',{tone:'success'});});
    const form=main.querySelector('[data-qelly-decision-form]');
    form?.querySelectorAll('input[type="range"]').forEach((input)=>input.addEventListener('input',()=>input.closest('label')?.querySelector('output')?.replaceChildren(`${input.value}%`)));
    form?.addEventListener('submit',(event)=>{event.preventDefault();const data=new FormData(form);result=evaluateDecision({assetId:data.get('assetId'),horizon:data.get('horizon'),risk:data.get('risk'),evidenceConfidence:Number(data.get('evidenceConfidence')),scenarioMove:Number(data.get('scenarioMove')),thesis:data.get('thesis'),invalidationCondition:data.get('invalidationCondition')});draw();toast('Decision-support record recalculated',{tone:'success'});});
    main.querySelector('[data-action="persist-decision"]')?.addEventListener('click',async()=>{const button=main.querySelector('[data-action="persist-decision"]');button.disabled=true;try{await api('/api/v1/evidence/explain-move',{method:'POST',headers:{'Idempotency-Key':`evidence-explain-${Date.now()}`},body:JSON.stringify({canonicalId:result.input.assetId,consideredAction:result.posture.toLowerCase().replaceAll(' ','-'),horizon:result.input.horizon,confidence:result.input.evidenceConfidence/100,thesis:result.input.thesis,notes:`Invalidation: ${result.input.invalidationCondition||'not supplied'}; decision-support score ${result.score}; source-package quality ${result.sourceQuality.composite}; execution disabled.`})});toast('Decision evidence package persisted',{tone:'success'});await renderRoute();}catch(error){toast(error.message,{tone:'danger'});}finally{button.disabled=false;}});
  };
  draw();
}
