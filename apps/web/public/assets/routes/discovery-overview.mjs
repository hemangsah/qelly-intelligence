const cssHref=new URL('./discovery-overview.css?v=20260830-discovery1',import.meta.url).href;

const HORIZONS=Object.freeze({
  current:'current conditions',
  quarter:'the next quarter',
  cycle:'the next economic cycle'
});
const REGIONS=Object.freeze({global:'global markets',india:'India-linked markets',us:'United States-linked markets',asia:'Asia-linked markets'});
const OUTCOMES=Object.freeze({explain:'explain what could be driving the theme',compare:'compare competing explanations',monitor:'define what evidence should be monitored next'});
const CHECKS=Object.freeze({
  'risk-appetite':['Compare the sentiment reference with participation breadth.','Challenge the theme in another asset class before naming a regime.','Record source timing and define what would invalidate the conclusion.'],
  'crypto-breadth':['Separate participation breadth from asset performance ranking.','Compare the attributed sample with the independent venue observations.','Define the threshold that would make the theme too narrow to pursue.'],
  'currency-conditions':['Anchor every rate to the published ECB reference date.','Keep derived cross-rates separate from executable or remittance prices.','Identify the regional transmission question before opening a chart.'],
  'growth-divergence':['Align country, period and publication method before comparing values.','Keep World Bank history separate from IMF estimates or projections.','Seek a primary release or filing that could confirm or contradict the theme.']
});

function ensureStyles(){
  const existing=document.querySelector('link[data-qelly-discovery-overview-style]');
  if(existing){if(existing.href!==cssHref)existing.href=cssHref;return;}
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=cssHref;
  link.dataset.qellyDiscoveryOverviewStyle='true';
  document.head.append(link);
}

const safe=(value)=>String(value??'').replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const stateLabel=(value)=>({live:'LIVE',cached:'CACHED',reference:'REFERENCE',delayed:'DELAYED',partial:'PARTIAL',unavailable:'UNAVAILABLE'}[String(value||'').toLowerCase()]||String(value||'UNKNOWN').toUpperCase());
const stateTone=(value)=>({live:'live',cached:'cached',reference:'delayed',delayed:'delayed',partial:'cached',unavailable:'unavailable'}[String(value||'').toLowerCase()]||'cached');
const dateTime=(value)=>value?new Date(value).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'Reference cadence';
const evidenceValue=(item)=>{
  if(item?.value===null||item?.value===undefined||item?.value==='')return 'Unavailable';
  const numeric=Number(item.value);
  if(!Number.isFinite(numeric))return String(item.value);
  if(item.unit==='percent')return `${numeric>=0?'+':''}${numeric.toLocaleString('en-IN',{maximumFractionDigits:2})}%`;
  if(item.unit==='count')return numeric.toLocaleString('en-IN',{maximumFractionDigits:0});
  if(item.unit==='score')return numeric.toLocaleString('en-IN',{maximumFractionDigits:0});
  if(item.unit==='rate')return numeric.toLocaleString('en-IN',{maximumFractionDigits:6});
  return numeric.toLocaleString('en-IN',{maximumFractionDigits:2});
};

function fallbackOverview(network={}){
  const sources=network.sources||{};
  const diagnostics=network.networkDiagnostics||{};
  const unavailable=(id,label,purpose,question,nextRoute,nextLabel)=>({id,label,purpose,question,state:'unavailable',sourceIds:[],observations:[],limitation:'Required governed observations are unavailable. Qelly has not generated substitute evidence.',nextRoute,nextLabel,ready:false,evidenceCount:0});
  const lenses=[
    unavailable('risk-appetite','Risk appetite','Frame whether current market psychology deserves a deeper breadth check.','Is the current risk mood broad enough to justify a cross-asset research question?','live-markets','Check market breadth'),
    unavailable('crypto-breadth','Crypto breadth','Test whether a crypto theme is shared across the governed source sample.','Which part of the available crypto sample is participating in the current move?','asset-rankings','Narrow with declared criteria'),
    unavailable('currency-conditions','Currency conditions','Frame a currency question from official reference rates.','Do official reference rates suggest a currency condition worth researching by region?','converter','Model a reference conversion'),
    unavailable('growth-divergence','Growth divergence','Compare historical and forecast-labelled growth references.','Which regional growth differences deserve primary-source research?','research-workspace','Build a macro dossier')
  ];
  return {version:'governed-theme-framing-fallback',job:'Turn a broad market theme into a researchable question before choosing an asset.',lenses,sourceLedger:Object.entries(sources).map(([id,source])=>({id,label:source?.label||id,role:'Governed research source',truthState:source?.truthState||source?.state||'unavailable',observedAt:source?.observedAt,fetchedAt:source?.fetchedAt||source?.ingestedAt,attribution:source?.attribution||source?.label||id,cadence:source?.cadence||'Provider governed'})),readiness:{availableLenses:0,totalLenses:lenses.length,sourceCounts:diagnostics.sourceCounts||{total:Object.keys(sources).length,live:0,cached:0,delayed:0,unavailable:Object.keys(sources).length},decisionUse:'partial_source_coverage'},boundaries:{ranking:false,search:false,singleAssetAnalysis:false,execution:false,fabricatedFallback:false}};
}

function lensButton(lens,index){
  return `<button type="button" class="q-do-lens" data-lens="${safe(lens.id)}" aria-pressed="${index===0?'true':'false'}"><span>0${index+1}</span><div><strong>${safe(lens.label)}</strong><small>${safe(lens.purpose)}</small></div><em data-state="${safe(stateTone(lens.state))}">${safe(stateLabel(lens.state))}</em></button>`;
}

function observationRow(item,index,selected=false){
  const disabled=item.value==null;
  return `<label class="q-do-evidence" data-evidence-row="${safe(item.id)}" data-available="${disabled?'false':'true'}"><input type="checkbox" data-evidence-id="${safe(item.id)}" ${selected&&!disabled?'checked':''} ${disabled?'disabled':''}><span><strong>${safe(item.label)}</strong><small>${safe(item.provider)} · ${safe(stateLabel(item.truthState))}${item.context?` · ${safe(item.context)}`:''}</small></span><b>${safe(evidenceValue(item))}</b><i>${String(index+1).padStart(2,'0')}</i></label>`;
}

function sourceCard(source){
  return `<article class="q-do-source" data-source="${safe(source.id)}"><header><div><strong>${safe(source.label)}</strong><small>${safe(source.role)}</small></div><span data-state="${safe(stateTone(source.truthState))}">${safe(stateLabel(source.truthState))}</span></header><dl><div><dt>Observed</dt><dd>${safe(dateTime(source.observedAt))}</dd></div><div><dt>Fetched</dt><dd>${safe(dateTime(source.fetchedAt))}</dd></div><div><dt>Attribution</dt><dd>${safe(source.attribution)}</dd></div></dl><button type="button" data-source-toggle aria-expanded="false">Inspect source role</button><p hidden>${safe(source.cadence)}. This source supports discovery framing only; its observations retain their own timing and permitted-use boundary.</p></article>`;
}

function distinctionCards(){
  const cards=[
    ['Discovery Overview','Frame a broad theme into a researchable question.','Use before choosing an asset.'],
    ['Global Market Network','Check what is moving and whether sources agree.','Use for governed market orientation.'],
    ['Asset Rankings','Apply declared criteria to narrow candidates.','Use after the theme is defined.'],
    ['Universal Search','Find a known name, symbol, tool or workspace.','Use when the target is already known.'],
    ['Asset Intelligence','Investigate one selected instrument in depth.','Use after a candidate is chosen.']
  ];
  return cards.map(([title,job,use])=>`<article><strong>${title}</strong><p>${job}</p><small>${use}</small></article>`).join('');
}

function questionText(lens,horizon,region,outcome){
  return `For ${REGIONS[region]||REGIONS.global} over ${HORIZONS[horizon]||HORIZONS.current}, ${OUTCOMES[outcome]||OUTCOMES.explain}: ${String(lens.question||'What broad theme deserves further research?').replace(/\?$/,'').toLowerCase()}?`;
}

export async function renderDiscoveryOverview(main,deps){
  ensureStyles();
  const {api,pageHead,stateBanner,escapeHtml=safe,toast}=deps;
  main.setAttribute('aria-busy','true');
  let network;
  try{network=await api('/api/v1/market/network');}
  catch(error){network={sources:{},networkDiagnostics:{sourceCounts:{total:0,live:0,cached:0,delayed:0,unavailable:0}},error:error.message};}
  const overview=network.discoveryOverview||fallbackOverview(network);
  const lenses=Array.isArray(overview.lenses)?overview.lenses:[];
  const ledger=Array.isArray(overview.sourceLedger)?overview.sourceLedger:[];
  const first=lenses.find((item)=>item.ready)||lenses[0];
  const counts=overview.readiness?.sourceCounts||{};
  const selected=new Set((first?.observations||[]).filter((item)=>item.value!=null).slice(0,2).map((item)=>item.id));
  main.innerHTML=`<section class="q-page q-discovery-overview" data-discovery-experience="theme-framing-v1" data-active-lens="${safe(first?.id||'none')}">
    ${pageHead('Qelly Intelligence · Discovery Overview','Discovery Overview','Use this feature to turn a broad market theme into a bounded, evidence-backed research question before choosing an asset.',`<a class="q-button q-button--secondary" href="#/research-workspace">Open research workspace</a><button class="q-button q-button--primary" type="button" data-action="refresh-discovery">Refresh coverage</button>`)}${stateBanner()}
    <section class="q-do-mission" aria-labelledby="q-do-mission-title"><div><p class="q-eyebrow">Unique job · theme framing</p><h2 id="q-do-mission-title">${safe(overview.job)}</h2><p>Discovery Overview does not rank assets, duplicate universal search, publish a thesis or execute a trade. It helps you decide what question deserves deeper work.</p></div><aside><span>Outcome</span><strong>A bounded discovery brief</strong><p>One theme, selected evidence, explicit limitations and a clear next workspace.</p></aside></section>
    <section class="q-do-status" aria-label="Discovery coverage status"><div><span>Theme lenses</span><strong>${safe(`${overview.readiness?.availableLenses||0} / ${overview.readiness?.totalLenses||lenses.length} ready`)}</strong><small>Source-backed framing</small></div><div><span>Source health</span><strong>${safe(`${Math.max(0,Number(counts.total||0)-Number(counts.unavailable||0))} / ${counts.total||0} available`)}</strong><small>${safe(`${counts.live||0} live · ${counts.cached||0} cached · ${counts.delayed||0} delayed`)}</small></div><div><span>Fabricated evidence</span><strong>OFF</strong><small>Missing values stay unavailable</small></div><div><span>Asset selection</span><strong>NOT YET</strong><small>Frame the question first</small></div><div><span>Execution</span><strong>DISABLED</strong><small>Research workflow only</small></div></section>
    <section class="q-do-flow" aria-label="Discovery workflow"><span><b>01</b> Choose a lens</span><i></i><span><b>02</b> Select evidence</span><i></i><span><b>03</b> Frame the question</span><i></i><span><b>04</b> Open the right tool</span></section>
    <section class="q-do-workbench"><aside class="q-do-lenses"><header><p class="q-eyebrow">Step 01</p><h2>Choose the theme lens</h2><p>Each lens asks a different broad-market question.</p></header><div>${lenses.map(lensButton).join('')}</div></aside>
      <section class="q-do-stage"><header><div><p class="q-eyebrow">Step 02 · governed evidence</p><h2 data-lens-title>${safe(first?.label||'Coverage unavailable')}</h2><p data-lens-purpose>${safe(first?.purpose||'Required sources are unavailable.')}</p></div><span class="q-status q-status--${safe(stateTone(first?.state))}" data-lens-state>${safe(stateLabel(first?.state))}</span></header><div class="q-do-question"><span>Starting question</span><strong data-lens-question>${safe(first?.question||'Which broad theme deserves further research?')}</strong></div><div class="q-do-evidence-list" data-evidence-list>${(first?.observations||[]).map((item,index)=>observationRow(item,index,selected.has(item.id))).join('')||'<div class="q-empty-state"><strong>No governed evidence is available for this lens.</strong><p>Qelly has not generated substitute observations.</p></div>'}</div><div class="q-do-limitation"><span>What this does not prove</span><p data-lens-limitation>${safe(first?.limitation||'No conclusion can be drawn while the required evidence is unavailable.')}</p></div></section>
    </section>
    <section class="q-do-builder"><div class="q-do-builder__form"><header><p class="q-eyebrow">Step 03 · frame the question</p><h2>Build a discovery brief</h2><p>Scope the question without turning a broad signal into a recommendation.</p></header><div class="q-do-fields"><label><span>Horizon</span><select data-brief-horizon>${Object.entries(HORIZONS).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><label><span>Region</span><select data-brief-region>${Object.entries(REGIONS).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><label><span>Research outcome</span><select data-brief-outcome>${Object.entries(OUTCOMES).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label></div><div class="q-do-builder-actions"><button class="q-button q-button--secondary" type="button" data-action="clear-evidence">Clear evidence</button><button class="q-button q-button--primary" type="button" data-action="generate-brief">Generate research brief</button></div></div><aside class="q-do-brief" aria-live="polite"><span>Draft question</span><h3 data-brief-question>${safe(questionText(first,'current','global','explain'))}</h3><p><b data-selected-count>${selected.size}</b> governed observations selected</p><div data-brief-output><small>Select evidence and generate the brief to see its validation checklist and handoff.</small></div></aside></section>
    <section class="q-do-lens-map"><header><div><p class="q-eyebrow">Cross-lens map</p><h2>See every available framing path without mixing their purpose.</h2></div><span>${safe(`${overview.readiness?.availableLenses||0} ready`)}</span></header><div>${lenses.map((lens)=>`<button type="button" data-map-lens="${safe(lens.id)}"><span data-state="${safe(stateTone(lens.state))}">${safe(stateLabel(lens.state))}</span><strong>${safe(lens.label)}</strong><p>${safe(lens.question)}</p><small>${safe(`${lens.evidenceCount||0} governed observations`)}</small></button>`).join('')}</div></section>
    <section class="q-do-source-section"><header><div><p class="q-eyebrow">Evidence ledger</p><h2>Know the role and timing of every discovery source.</h2><p>Source states travel into the brief; cached and reference observations are never relabelled live.</p></div><span>${safe(`${ledger.length} sources`)}</span></header><div class="q-do-source-grid">${ledger.map(sourceCard).join('')}</div></section>
    <section class="q-do-distinction"><header><p class="q-eyebrow">Purpose boundary</p><h2>Choose the feature that matches the next job.</h2></header><div>${distinctionCards()}</div></section>
  </section>`;
  main.removeAttribute('aria-busy');
  const root=main.querySelector('[data-discovery-experience]');
  let active=first;
  const refreshEvidence=()=>{
    root.dataset.activeLens=active?.id||'none';
    main.querySelectorAll('[data-lens]').forEach((button)=>button.setAttribute('aria-pressed',String(button.dataset.lens===active?.id)));
    main.querySelector('[data-lens-title]').textContent=active?.label||'Coverage unavailable';
    main.querySelector('[data-lens-purpose]').textContent=active?.purpose||'Required sources are unavailable.';
    main.querySelector('[data-lens-question]').textContent=active?.question||'Which broad theme deserves further research?';
    main.querySelector('[data-lens-limitation]').textContent=active?.limitation||'No conclusion can be drawn while the required evidence is unavailable.';
    const stateNode=main.querySelector('[data-lens-state]');
    stateNode.textContent=stateLabel(active?.state);
    stateNode.className=`q-status q-status--${stateTone(active?.state)}`;
    const observations=active?.observations||[];
    main.querySelector('[data-evidence-list]').innerHTML=observations.map((item,index)=>observationRow(item,index,selected.has(item.id))).join('')||'<div class="q-empty-state"><strong>No governed evidence is available for this lens.</strong><p>Qelly has not generated substitute observations.</p></div>';
    main.querySelector('[data-brief-question]').textContent=questionText(active,main.querySelector('[data-brief-horizon]').value,main.querySelector('[data-brief-region]').value,main.querySelector('[data-brief-outcome]').value);
    main.querySelector('[data-selected-count]').textContent=String(selected.size);
  };
  const chooseLens=(id)=>{
    const next=lenses.find((item)=>item.id===id);
    if(!next)return;
    active=next;
    selected.clear();
    (active.observations||[]).filter((item)=>item.value!=null).slice(0,2).forEach((item)=>selected.add(item.id));
    refreshEvidence();
    main.querySelector('[data-brief-output]').innerHTML='<small>Evidence re-scoped to this lens. Review the selected observations, then generate the brief.</small>';
    main.querySelector('.q-do-stage')?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  };
  main.querySelectorAll('[data-lens]').forEach((button)=>button.addEventListener('click',()=>chooseLens(button.dataset.lens)));
  main.querySelectorAll('[data-map-lens]').forEach((button)=>button.addEventListener('click',()=>chooseLens(button.dataset.mapLens)));
  main.querySelector('[data-evidence-list]').addEventListener('change',(event)=>{
    const checkbox=event.target.closest('[data-evidence-id]');
    if(!checkbox)return;
    if(checkbox.checked&&selected.size>=5){checkbox.checked=false;toast?.('A discovery brief can carry up to five observations.',{tone:'warning'});return;}
    checkbox.checked?selected.add(checkbox.dataset.evidenceId):selected.delete(checkbox.dataset.evidenceId);
    main.querySelector('[data-selected-count]').textContent=String(selected.size);
  });
  ['[data-brief-horizon]','[data-brief-region]','[data-brief-outcome]'].forEach((selector)=>main.querySelector(selector).addEventListener('change',refreshEvidence));
  main.querySelector('[data-action="clear-evidence"]').addEventListener('click',()=>{selected.clear();refreshEvidence();main.querySelector('[data-brief-output]').innerHTML='<small>Evidence queue cleared. Select source-backed observations before generating a brief.</small>';});
  main.querySelector('[data-action="generate-brief"]').addEventListener('click',()=>{
    const chosen=(active?.observations||[]).filter((item)=>selected.has(item.id));
    const checks=CHECKS[active?.id]||['Verify source timing.','Record limitations.','Define the next evidence required.'];
    const output=main.querySelector('[data-brief-output]');
    output.innerHTML=`<div class="q-do-brief-ready"><span>Research brief ready</span><ol>${checks.map((item)=>`<li>${safe(item)}</li>`).join('')}</ol><div><strong>Evidence carried forward</strong><p>${chosen.length?chosen.map((item)=>safe(item.label)).join(' · '):'No evidence selected—add at least one governed observation before treating this as a usable brief.'}</p></div><a class="q-button q-button--primary" href="#/${safe(active?.nextRoute||'research-workspace')}">${safe(active?.nextLabel||'Open research workspace')}</a></div>`;
    toast?.(chosen.length?'Discovery brief generated from selected evidence.':'Brief generated with an empty evidence warning.',{tone:chosen.length?'success':'warning'});
  });
  main.querySelector('[data-action="refresh-discovery"]').addEventListener('click',()=>{void renderDiscoveryOverview(main,deps);});
  main.querySelectorAll('[data-source-toggle]').forEach((button)=>button.addEventListener('click',()=>{const detail=button.parentElement.querySelector('p[hidden],p[data-open]');const expanded=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!expanded));button.textContent=expanded?'Inspect source role':'Hide source role';detail.hidden=expanded;detail.toggleAttribute('data-open',!expanded);}));
}

export const __discoveryOverviewTest=Object.freeze({HORIZONS,REGIONS,OUTCOMES,CHECKS,evidenceValue,questionText,fallbackOverview});
