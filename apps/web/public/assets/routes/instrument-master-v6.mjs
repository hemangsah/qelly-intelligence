const tone=(value)=>{const state=String(value||'').toUpperCase();if(state==='LIVE')return 'live';if(state==='DELAYED')return 'delayed';if(state==='CACHED')return 'cached';if(state==='STALE')return 'stale';return 'unavailable';};
const format=(value)=>Number.isFinite(Number(value))?new Intl.NumberFormat('en-IN',{maximumFractionDigits:6}).format(Number(value)):'—';
const date=(value)=>{const parsed=new Date(value||'');return Number.isNaN(parsed.getTime())?'Not supplied':parsed.toLocaleString('en-IN');};

export async function renderInstrumentMasterV6(main,deps){
  const {api,pageHead,stateBanner,escapeHtml}=deps;
  let summary,search;
  try{[summary,search]=await Promise.all([api('/api/v1/instruments/summary'),api('/api/v1/instruments/search?limit=200')]);}
  catch(error){main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Instrument master','Instrument Master','The governed production instrument registry is unavailable. Qelly will not substitute local fixture identities.','')}${stateBanner()}<section class="q-panel"><div class="q-panel-body"><div class="q-empty-state"><strong>Instrument registry unavailable</strong><p>${escapeHtml(error.message)}</p></div></div></section></section>`;return;}
  const items=Array.isArray(search.items)?search.items:[];
  const classes=Array.isArray(summary.byAssetClass)?summary.byAssetClass:[];
  const latest=items.map((item)=>new Date(item.observedAt||0).getTime()).filter(Number.isFinite).sort((a,b)=>b-a)[0]||null;
  main.innerHTML=`<section class="q-page q-v6-instrument-page">
    ${pageHead('Qelly Intelligence · Governed reference foundation','Instrument Master','Canonical production instruments backed by the governed provider data plane. Identity, latest observation state and source evidence are shown without synthetic QI-* fixtures.',`<a class="q-button q-button--secondary" href="#/data-mesh">Provider runtime</a><a class="q-button q-button--primary" href="#/timeseries-lab">Reference history</a>`)}${stateBanner()}
    <section class="q-v6-runtime-kpis">
      <div><span>Instruments</span><strong>${Number(summary.instruments)||items.length}</strong><small>governed active records</small></div>
      <div><span>Asset classes</span><strong>${classes.length}</strong><small>${escapeHtml(classes.map((item)=>item.assetClass).join(' · ')||'not supplied')}</small></div>
      <div><span>Venues</span><strong>${Number(summary.venues)||0}</strong><small>normalized source venues</small></div>
      <div><span>Latest observed</span><strong>${latest?escapeHtml(new Date(latest).toLocaleDateString('en-IN')):'—'}</strong><small>provider observation time</small></div>
      <div><span>Production source</span><strong>${summary.productionReferenceData?'YES':'NO'}</strong><small>${escapeHtml(summary.systemOfRecord||'governed data plane')}</small></div>
      <div><span>Execution</span><strong>OFF</strong><small>reference / research only</small></div>
    </section>
    <section class="q-panel q-v6-instrument-controls"><div class="q-panel-head"><div><h2>Canonical registry</h2><p>Search the actual production master by symbol, name, base/quote asset or canonical key.</p></div><span class="q-status q-status--delayed">GOVERNED</span></div><div class="q-panel-body q-control-row"><label class="q-setting"><span>Search</span><input id="v6-instrument-filter" type="search" placeholder="EURINR, USD, Euro…"></label><label class="q-setting"><span>Asset class</span><select id="v6-instrument-class"><option value="">All classes</option>${classes.map((item)=>`<option value="${escapeHtml(item.assetClass)}">${escapeHtml(item.assetClass)} · ${Number(item.count)||0}</option>`).join('')}</select></label><div class="q-setting q-query-boundary"><span>Boundary</span><strong>Provider-governed identity</strong><small>No synthetic tokenized relationships are inferred.</small></div></div></section>
    <div class="q-v6-instrument-layout">
      <section class="q-panel"><div class="q-panel-head"><div><h2>Instrument universe</h2><p>Latest normalized observation attached to each active instrument.</p></div><span id="v6-instrument-count" class="q-status q-status--cached">${items.length} records</span></div><div id="v6-instrument-grid" class="q-panel-body q-v6-instrument-grid"></div></section>
      <aside class="q-panel"><div class="q-panel-head"><div><h2>Instrument evidence</h2><p>Select a registry row to inspect identity and provider state.</p></div></div><div id="v6-instrument-evidence" class="q-panel-body"><div class="q-empty-state">Select an instrument.</div></div></aside>
    </div>
  </section>`;

  const grid=main.querySelector('#v6-instrument-grid'),evidence=main.querySelector('#v6-instrument-evidence'),count=main.querySelector('#v6-instrument-count'),query=main.querySelector('#v6-instrument-filter'),assetClass=main.querySelector('#v6-instrument-class');
  const inspect=(item)=>{
    evidence.innerHTML=`<dl class="q-v6-evidence-list"><dt>Canonical key</dt><dd>${escapeHtml(item.canonicalKey||item.canonicalId||'—')}</dd><dt>Symbol</dt><dd>${escapeHtml(item.symbol||item.primarySymbol||'—')}</dd><dt>Name</dt><dd>${escapeHtml(item.displayName||item.name||'—')}</dd><dt>Class</dt><dd>${escapeHtml(item.assetClass||'—')}</dd><dt>Venue</dt><dd>${escapeHtml(item.venue||'—')}</dd><dt>Base / Quote</dt><dd>${escapeHtml(`${item.baseAsset||'—'} / ${item.quoteAsset||item.currency||'—'}`)}</dd><dt>Series</dt><dd>${escapeHtml(item.seriesKey||'—')}</dd><dt>Metric</dt><dd>${escapeHtml(item.metric||'—')}</dd><dt>Latest value</dt><dd>${escapeHtml(format(item.value))}</dd><dt>Truth state</dt><dd><span class="q-status q-status--${tone(item.truthState)}">${escapeHtml(item.truthState||'UNAVAILABLE')}</span></dd><dt>Observed</dt><dd>${escapeHtml(date(item.observedAt))}</dd><dt>Ingested</dt><dd>${escapeHtml(date(item.ingestedAt))}</dd><dt>Execution</dt><dd>Disabled</dd></dl>`;
  };
  const render=()=>{
    const q=String(query.value||'').trim().toLowerCase(),classFilter=String(assetClass.value||'').toLowerCase();
    const filtered=items.filter((item)=>{
      if(classFilter&&String(item.assetClass||'').toLowerCase()!==classFilter)return false;
      if(!q)return true;
      return [item.canonicalKey,item.canonicalId,item.symbol,item.primarySymbol,item.displayName,item.name,item.baseAsset,item.quoteAsset,item.currency,item.venue].some((value)=>String(value||'').toLowerCase().includes(q));
    });
    count.textContent=`${filtered.length} records`;
    grid.replaceChildren();
    for(const item of filtered){
      const button=document.createElement('button');button.type='button';button.className='q-v6-instrument-card';
      button.innerHTML=`<span><strong>${escapeHtml(item.symbol||item.primarySymbol||'—')}</strong><small>${escapeHtml(item.displayName||item.name||'—')}</small></span><span><b>${escapeHtml(format(item.value))}</b><small>${escapeHtml(item.unit||item.currency||'')}</small></span><span class="q-status q-status--${tone(item.truthState)}">${escapeHtml(item.truthState||'UNAVAILABLE')}</span>`;
      button.addEventListener('click',()=>{grid.querySelectorAll('.is-selected').forEach((node)=>node.classList.remove('is-selected'));button.classList.add('is-selected');inspect(item);});grid.append(button);
    }
    if(!filtered.length)grid.innerHTML='<div class="q-empty-state"><strong>No governed instrument matches this filter.</strong></div>';
  };
  query.addEventListener('input',render);assetClass.addEventListener('change',render);render();if(items[0])inspect(items[0]);
}
