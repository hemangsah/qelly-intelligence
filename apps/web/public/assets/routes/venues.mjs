const STYLE_ID='qelly-venues-v2-style';

function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const link=document.createElement('link');
  link.id=STYLE_ID;link.rel='stylesheet';link.href='./assets/routes/venues-v2.css?v=20260831-venues1';
  document.head.append(link);
}

const label=(value)=>String(value??'unavailable').replace(/[_-]+/g,' ').toUpperCase();
const tone=(value)=>['live','cached','delayed'].includes(String(value).toLowerCase())?String(value).toLowerCase():'unavailable';
const dateLabel=(value)=>{const date=new Date(value||'');return Number.isNaN(date.getTime())?'Not supplied':date.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});};

function venueCard(venue,selected,compared,escapeHtml){
  const safe=(value)=>escapeHtml(String(value??''));
  const cap=venue.capabilities||{};
  return `<article class="q-vn-card" data-venue-card="${safe(venue.id)}" data-active="${selected}" data-type="${safe(venue.venueType)}" data-stage="${safe(venue.stage.id)}">
    <header><span>${safe(venue.name.slice(0,2).toUpperCase())}</span><div><p>${safe(label(venue.venueType))}</p><h3>${safe(venue.name)}</h3></div><em class="q-status q-status--${tone(venue.stage.tone)}">${safe(label(venue.stage.label))}</em></header>
    <p>${safe(venue.purpose)}</p><dl><div><dt>Official destination</dt><dd>${cap.officialDestination?'RECORDED':'NOT RECORDED'}</dd></div><div><dt>Read-only data</dt><dd>${cap.readOnlyObservations?'AVAILABLE':'NOT CONNECTED'}</dd></div><div><dt>Execution</dt><dd>DISABLED</dd></div></dl>
    <footer><button type="button" data-venue-open="${safe(venue.id)}">Inspect boundary</button><label><input type="checkbox" data-venue-compare="${safe(venue.id)}" ${compared?'checked':''}><span>Compare</span></label></footer>
  </article>`;
}

function capabilityRows(venue,escapeHtml){
  const safe=(value)=>escapeHtml(String(value??''));
  const labels={catalogued:'Governed directory',officialDestination:'Official destination',readOnlyObservations:'Read-only observations',customerDisplay:'Customer display',persistence:'Persistent market data',accountConnection:'Account connection',orderRouting:'Order routing',execution:'Execution',custody:'Custody'};
  return Object.entries(venue.capabilities||{}).map(([key,enabled])=>`<div><dt>${safe(labels[key]||label(key))}</dt><dd data-enabled="${enabled}">${enabled?'AVAILABLE':'NOT ENABLED'}</dd></div>`).join('');
}

function inspectorMarkup(venue,escapeHtml){
  const safe=(value)=>escapeHtml(String(value??''));
  const observation=venue.observation||{};
  return `<header><div><p class="q-eyebrow">Selected venue boundary</p><h2>${safe(venue.name)}</h2><p>${safe(venue.useCase)}</p></div><span class="q-status q-status--${tone(venue.stage.tone)}">${safe(label(venue.stage.label))}</span></header>
    <section class="q-vn-inspector-summary"><div><span>VENUE TYPE</span><strong>${safe(label(venue.venueType))}</strong></div><div><span>OBSERVATION SOURCE</span><strong>${safe(observation.sourceLabel||'Not connected')}</strong></div><div><span>CURRENT SYMBOLS</span><strong>${safe(observation.count??0)}</strong></div><div><span>OBSERVED</span><strong>${safe(dateLabel(observation.observedAt))}</strong></div></section>
    <section class="q-vn-capabilities"><div><p class="q-eyebrow">Qelly capability contract</p><h3>What this integration does—and does not—permit</h3></div><dl>${capabilityRows(venue,escapeHtml)}</dl></section>
    ${observation.count?`<section class="q-vn-observation"><div><p class="q-eyebrow">Current read-only coverage</p><h3>${safe(observation.symbols.join(' · '))}</h3><p>${safe(observation.usage||'Governed source usage boundary.')}</p></div><span class="q-status q-status--${tone(observation.truthState)}">${safe(label(observation.truthState))}</span></section>`:''}
    ${venue.policy?`<section class="q-vn-policy"><p class="q-eyebrow">Configured provider policy</p><dl><div><dt>Provider</dt><dd>${safe(venue.policy.providerId)}</dd></div><div><dt>Enabled</dt><dd>${venue.policy.enabled?'YES':'NO'}</dd></div><div><dt>Terms state</dt><dd>${safe(label(venue.policy.termsState))}</dd></div><div><dt>Planned capabilities</dt><dd>${safe(venue.policy.capabilities.join(', ')||'None')}</dd></div></dl></section>`:''}
    <section class="q-vn-gaps"><div><p class="q-eyebrow">Evidence still required</p><h3>Do not infer what has not been verified.</h3></div><ul>${(venue.missingEvidence||[]).map((item)=>`<li>${safe(item)}</li>`).join('')}</ul></section>
    <section class="q-vn-questions"><div><p class="q-eyebrow">Venue diligence prompts</p><h3>Turn access questions into evidence requests.</h3></div><ol>${(venue.questions||[]).map((item,index)=>`<li><span>0${index+1}</span><p>${safe(item)}</p></li>`).join('')}</ol></section>
    <footer><p>${safe(venue.directoryNote)}</p><div>${venue.officialUrl?`<a class="q-button q-button--secondary" href="${safe(venue.officialUrl)}" target="_blank" rel="noopener noreferrer nofollow">Open official destination ↗</a>`:''}${venue.policy?.termsUrl?`<a class="q-button q-button--secondary" href="${safe(venue.policy.termsUrl)}" target="_blank" rel="noopener noreferrer nofollow">Review provider terms ↗</a>`:''}<a class="q-button q-button--primary" href="#/news-research">Ask Qelly with evidence</a></div></footer>`;
}

function comparisonMarkup(rows,escapeHtml){
  const safe=(value)=>escapeHtml(String(value??''));
  if(!rows.length)return '<div class="q-vn-empty"><strong>No venues selected.</strong><p>Add up to three venues. Comparison shows Qelly integration evidence—not venue quality or a recommendation.</p></div>';
  const capability=(venue,key)=>venue.capabilities?.[key]?'YES':'NO';
  return `<div class="q-vn-compare-table" role="table" aria-label="Selected venue integration comparison"><div class="is-head"><span>Venue</span><span>Stage</span><span>Read-only data</span><span>Display</span><span>Account</span><span>Execution</span><span>Missing evidence</span></div>${rows.map((venue)=>`<button type="button" data-venue-open="${safe(venue.id)}"><span><b>${safe(venue.name)}</b><small>${safe(label(venue.venueType))}</small></span><span>${safe(label(venue.stage.label))}</span><span>${capability(venue,'readOnlyObservations')}</span><span>${capability(venue,'customerDisplay')}</span><span>${capability(venue,'accountConnection')}</span><span>${capability(venue,'execution')}</span><span>${safe(`${venue.missingEvidence.length} gaps`)}</span></button>`).join('')}</div>`;
}

function permissionMarkup(rows,escapeHtml){
  const safe=(value)=>escapeHtml(String(value??''));
  return rows.map((row)=>`<article><header><div><strong>${safe(row.label)}</strong><small>${safe(row.role)}</small></div><span class="q-status q-status--${tone(row.truthState)}">${safe(label(row.stage))}</span></header><dl><div><dt>Customer display</dt><dd>${row.display?'ENABLED':'BLOCKED'}</dd></div><div><dt>Persistence</dt><dd>${row.persistence?'ENABLED':'DISABLED'}</dd></div><div><dt>Account</dt><dd>${row.account?'ENABLED':'DISABLED'}</dd></div><div><dt>Execution</dt><dd>${row.execution?'ENABLED':'DISABLED'}</dd></div></dl><p>${safe(row.termsState)}</p>${row.termsUrl?`<a href="${safe(row.termsUrl)}" target="_blank" rel="noopener noreferrer nofollow">Review source terms ↗</a>`:''}</article>`).join('');
}

export async function renderVenues(main,{api,escapeHtml,toast}){
  ensureStyles();
  let data;
  try{data=await api('/api/v1/discovery/venues');}
  catch(error){
    main.innerHTML=`<section class="q-vn-page"><div class="q-vn-error"><p class="q-eyebrow">Qelly Intelligence · Venues</p><h1>The governed venue directory could not refresh.</h1><p>${escapeHtml(error.message)} No venue rankings, liquidity claims, or fixture scores were substituted.</p><button type="button" data-venue-retry>Retry</button><a href="#/market">Open Market Command</a></div></section>`;
    main.querySelector('[data-venue-retry]').addEventListener('click',()=>void renderVenues(main,{api,escapeHtml,toast}));main.removeAttribute('aria-busy');return;
  }
  const venues=Array.isArray(data.venues)?data.venues:[];
  const summary=data.summary||{};
  const method=data.methodology||{};
  const safe=(value)=>escapeHtml(String(value??''));
  main.innerHTML=`<section class="q-vn-page" data-venues-experience="market-access-intelligence-v1" data-venue-state="${safe(data.state)}">
    <header class="q-vn-hero"><div><p class="q-eyebrow">Qelly Intelligence · Venues</p><h1>Know where market access begins—and where Qelly deliberately stops.</h1><p>${safe(data.job)}</p><div><a class="q-button q-button--secondary" href="#/market">Open Market Network</a><a class="q-button q-button--primary" href="#/news-research">Start venue research</a></div></div><aside><span>Unique job · market-access intelligence</span><strong>Venues explains the access boundary.</strong><p>Categories groups assets by economic role. Rankings orders observed candidates. Venues inspects destinations, data permissions, integration stages, and missing market-structure evidence.</p></aside></header>
    <section class="q-vn-truth" role="status"><span></span><strong>Governed directory—not an endorsement</strong><p>${safe(summary.total??0)} destinations · ${safe(summary.observationReady??0)} read-only observation integration · account, routing, execution and custody disabled</p><button type="button" data-venue-method>Review method</button></section>
    <section class="q-vn-status" aria-label="Venue integration coverage"><article><span>Venue destinations</span><strong>${safe(summary.total??0)}</strong><small>governed directory entries</small></article><article><span>Exchanges</span><strong>${safe(summary.byType?.exchange??0)}</strong><small>directory classification</small></article><article><span>Brokers</span><strong>${safe(summary.byType?.broker??0)}</strong><small>directory classification</small></article><article><span>Observation-ready</span><strong>${safe(summary.observationReady??0)}</strong><small>read-only source evidence</small></article><article><span>Rights review</span><strong>${safe(summary.rightsReview??0)}</strong><small>configured but display blocked</small></article><article><span>Executable</span><strong>0</strong><small>Qelly research boundary</small></article></section>
    <section class="q-vn-explorer"><header><div><p class="q-eyebrow">Step 01 · locate the access surface</p><h2>Filter destinations by type and Qelly integration truth.</h2><p>Venue listings are discovery metadata. They do not claim availability, regulation, liquidity, reserves, solvency, fees, or execution quality.</p></div><div class="q-vn-controls"><label><span>Find a venue</span><input type="search" data-venue-search placeholder="Venue or access purpose"></label><label><span>Venue type</span><select data-venue-type><option value="all">Exchanges and brokers</option><option value="exchange">Exchanges</option><option value="broker">Brokers</option></select></label><label><span>Integration stage</span><select data-venue-stage><option value="all">All stages</option><option value="read-only-observation">Read-only observations</option><option value="rights-review">Display rights review</option><option value="directory-only">Directory only</option></select></label></div></header><div class="q-vn-workbench"><div><div class="q-vn-results-head"><div><p class="q-eyebrow">Governed results</p><h3><b data-venue-count>${safe(venues.length)}</b> destinations match</h3></div><button type="button" data-venue-reset>Reset filters</button></div><div class="q-vn-grid" data-venue-grid></div></div><aside class="q-vn-inspector" data-venue-inspector></aside></div></section>
    <section class="q-vn-compare"><header><div><p class="q-eyebrow">Step 02 · compare access evidence</p><h2>Capability comparison—not a venue leaderboard.</h2></div><span><b data-venue-compare-count>0</b> / 3 selected</span></header><div data-venue-comparison>${comparisonMarkup([],escapeHtml)}</div><footer><button type="button" data-venue-clear>Clear comparison</button><p>Qelly does not score venue trust, liquidity, reserves, regulation, solvency, costs, or execution performance without approved evidence.</p></footer></section>
    <section class="q-vn-permissions"><header><div><p class="q-eyebrow">Configured source permissions</p><h2>Every connection has a different allowed role.</h2></div><span>${safe((data.permissionMatrix||[]).length)} configured surfaces</span></header><div>${permissionMarkup(data.permissionMatrix||[],escapeHtml)}</div></section>
    <section class="q-vn-method" data-venue-methodology><div><p class="q-eyebrow">Method audit</p><h2>Integration truth is kept separate from venue quality.</h2><p>${safe(method.comparison)}</p></div><ol><li><span>01</span><strong>Classify</strong><p>${safe(method.classification)}</p></li><li><span>02</span><strong>Resolve stage</strong><p>${safe(method.stageLogic)}</p></li><li><span>03</span><strong>Expose gaps</strong><p>Missing permissions and operational facts remain named, not silently inferred.</p></li><li><span>04</span><strong>Research externally</strong><p>Official destinations open outside Qelly’s analytical boundary with no account or order handoff.</p></li></ol><footer><strong>${safe(method.version)}</strong><span>No endorsement</span><span>No venue ranking</span><span>No account connection</span><span>No execution</span><span>No custody</span></footer></section>
    <section class="q-vn-distinctions"><header><p class="q-eyebrow">Choose the right surface</p><h2>Connected workflows with separate outcomes.</h2></header><div><a href="#/market"><b>Global Market Network</b><span>Source availability</span><p>See which governed sources currently return observations.</p></a><a href="#/categories"><b>Categories</b><span>Economic taxonomy</span><p>Understand why assets belong together.</p></a><a href="#/venues"><b>Venues</b><span>Access intelligence</span><p>Inspect destination, permission, and integration boundaries.</p></a><a href="#/dex-discovery"><b>DEX Discovery</b><span>On-chain market research</span><p>Investigate decentralized pools when approved coverage exists.</p></a></div></section>
  </section>`;
  main.removeAttribute('aria-busy');

  let selected=venues.find((venue)=>venue.stage.id==='read-only-observation')||venues[0]||null;
  const compared=new Set();
  let query='';let venueType='all';let stage='all';
  const grid=main.querySelector('[data-venue-grid]');
  const filtered=()=>venues.filter((venue)=>{
    if(venueType!=='all'&&venue.venueType!==venueType)return false;
    if(stage!=='all'&&venue.stage.id!==stage)return false;
    const haystack=`${venue.name} ${venue.venueType} ${venue.stage.label} ${venue.purpose} ${venue.useCase}`.toLowerCase();
    return !query||haystack.includes(query);
  });
  const renderComparison=()=>{const rows=venues.filter((venue)=>compared.has(venue.id));main.querySelector('[data-venue-compare-count]').textContent=String(rows.length);main.querySelector('[data-venue-comparison]').innerHTML=comparisonMarkup(rows,escapeHtml);};
  const renderGrid=()=>{const rows=filtered();main.querySelector('[data-venue-count]').textContent=String(rows.length);grid.innerHTML=rows.length?rows.map((venue)=>venueCard(venue,venue.id===selected?.id,compared.has(venue.id),escapeHtml)).join(''):'<div class="q-vn-empty"><strong>No venue matches these controls.</strong><p>Try another name, type, or integration stage.</p></div>';};
  const select=(id)=>{const next=venues.find((venue)=>venue.id===id);if(!next)return;selected=next;main.querySelector('[data-venue-inspector]').innerHTML=inspectorMarkup(next,escapeHtml);renderGrid();};
  select(selected?.id);renderComparison();
  main.querySelector('[data-venue-search]').addEventListener('input',(event)=>{query=event.target.value.trim().toLowerCase();renderGrid();});
  main.querySelector('[data-venue-type]').addEventListener('change',(event)=>{venueType=event.target.value;renderGrid();});
  main.querySelector('[data-venue-stage]').addEventListener('change',(event)=>{stage=event.target.value;renderGrid();});
  main.querySelector('[data-venue-reset]').addEventListener('click',()=>{query='';venueType='all';stage='all';main.querySelector('[data-venue-search]').value='';main.querySelector('[data-venue-type]').value='all';main.querySelector('[data-venue-stage]').value='all';renderGrid();});
  main.addEventListener('click',(event)=>{const open=event.target.closest('[data-venue-open]');if(open){select(open.dataset.venueOpen);main.querySelector('[data-venue-inspector]').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});return;}if(event.target.closest('[data-venue-clear]')){compared.clear();renderComparison();renderGrid();}});
  grid.addEventListener('change',(event)=>{const input=event.target.closest('[data-venue-compare]');if(!input)return;if(input.checked&&compared.size>=3){input.checked=false;toast?.('Compare up to three venue access boundaries at a time.',{tone:'warning'});return;}input.checked?compared.add(input.dataset.venueCompare):compared.delete(input.dataset.venueCompare);renderComparison();renderGrid();});
  main.querySelector('[data-venue-method]').addEventListener('click',()=>main.querySelector('[data-venue-methodology]').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
}

export const __venuesUiTest=Object.freeze({label,tone,dateLabel});
