const tone=(value)=>{const state=String(value||'').toUpperCase();if(state==='LIVE')return 'live';if(state==='DELAYED')return 'delayed';if(state==='CACHED')return 'cached';if(state==='STALE')return 'stale';return 'unavailable';};
const format=(value)=>Number.isFinite(Number(value))?new Intl.NumberFormat('en-IN',{maximumFractionDigits:6}).format(Number(value)):'—';
const date=(value)=>{const parsed=new Date(value||'');return Number.isNaN(parsed.getTime())?'Not supplied':parsed.toLocaleString('en-IN');};

export async function renderInstrumentMasterV6(main,deps){
  const {api,pageHead,stateBanner,escapeHtml}=deps;
  const referenceHead=(...args)=>pageHead(...args).replaceAll('q-page-head','q-reference-page-head').replaceAll('q-page-actions','q-reference-page-actions').replaceAll('q-eyebrow','q-reference-eyebrow');
  let summary,search;
  try{[summary,search]=await Promise.all([api('/api/v1/instruments/summary'),api('/api/v1/instruments/search?limit=200')]);}
  catch(error){main.innerHTML=`<section class="q-page q-reference-page q-reference-instrument-page">${referenceHead('Qelly Intelligence · Instrument master','Instrument Master','The governed instrument registry is unavailable. No replacement identities are shown.','')}${stateBanner()}<section class="q-reference-surface"><div class="q-reference-body"><div class="q-reference-empty-state"><strong>Instrument registry unavailable</strong><p>${escapeHtml(error.message)}</p></div></div></section></section>`;return;}
  const items=Array.isArray(search.items)?search.items:[];
  const classes=Array.isArray(summary.byAssetClass)?summary.byAssetClass:[];
  const latest=items.map((item)=>new Date(item.observedAt||0).getTime()).filter(Number.isFinite).sort((a,b)=>b-a)[0]||null;
  main.innerHTML=`<section class="q-page q-reference-page q-reference-instrument-page">
    ${referenceHead('Qelly Intelligence · Governed reference foundation','Instrument Master','Browse governed instruments with their latest observation, source and identity evidence. Reference data is available for research only.',`<a class="q-reference-button q-reference-button--secondary" href="#/data-mesh">Provider runtime</a><a class="q-reference-button q-reference-button--primary" href="#/timeseries-lab">Reference history</a>`)}${stateBanner()}
    <section class="q-reference-runtime-kpis">
      <div><span>Instruments</span><strong>${Number(summary.instruments)||items.length}</strong><small>governed active records</small></div>
      <div><span>Asset classes</span><strong>${classes.length}</strong><small>${escapeHtml(classes.map((item)=>item.assetClass).join(' · ')||'not supplied')}</small></div>
      <div><span>Venues</span><strong>${Number(summary.venues)||0}</strong><small>normalized source venues</small></div>
      <div><span>Latest observed</span><strong>${latest?escapeHtml(new Date(latest).toLocaleDateString('en-IN')):'—'}</strong><small>provider observation time</small></div>
      <div><span>Production source</span><strong>${summary.productionReferenceData?'YES':'NO'}</strong><small>${escapeHtml(summary.systemOfRecord||'governed data plane')}</small></div>
      <div><span>Execution</span><strong>OFF</strong><small>reference / research only</small></div>
    </section>
    <section class="q-reference-surface q-reference-instrument-controls"><div class="q-reference-heading"><div><h2>Canonical registry</h2><p>Find an instrument by symbol, name, base or quote asset, or canonical key.</p></div><span class="q-reference-status q-reference-status--delayed">GOVERNED</span></div><div class="q-reference-body q-reference-control-row"><label class="q-reference-setting"><span>Search</span><input id="v6-instrument-filter" type="search" placeholder="EURINR, USD, Euro…"></label><label class="q-reference-setting"><span>Asset class</span><select id="v6-instrument-class"><option value="">All classes</option>${classes.map((item)=>`<option value="${escapeHtml(item.assetClass)}">${escapeHtml(item.assetClass)} · ${Number(item.count)||0}</option>`).join('')}</select></label><div class="q-reference-setting q-reference-query-boundary"><span>Boundary</span><strong>Provider-governed identity</strong><small>Only recorded provider relationships are shown.</small></div></div></section>
    <div class="q-reference-instrument-layout">
      <section class="q-reference-surface"><div class="q-reference-heading"><div><h2>Instrument universe</h2><p>Latest normalized observation attached to each active instrument.</p></div><span id="v6-instrument-count" class="q-reference-status q-reference-status--cached">${items.length} records</span></div><div id="v6-instrument-grid" class="q-reference-body q-reference-instrument-grid"></div></section>
      <aside class="q-reference-surface"><div class="q-reference-heading"><div><h2>Instrument evidence</h2><p>Select a registry row to inspect identity and provider state.</p></div></div><div id="v6-instrument-evidence" class="q-reference-body" aria-live="polite"><div class="q-reference-empty-state">Select an instrument.</div></div></aside>
    </div>
  </section>`;

  const grid=main.querySelector('#v6-instrument-grid'),evidence=main.querySelector('#v6-instrument-evidence'),count=main.querySelector('#v6-instrument-count'),query=main.querySelector('#v6-instrument-filter'),assetClass=main.querySelector('#v6-instrument-class');
  const inspect=(item)=>{
    evidence.innerHTML=`<dl class="q-reference-evidence-list"><dt>Canonical key</dt><dd>${escapeHtml(item.canonicalKey||item.canonicalId||'—')}</dd><dt>Symbol</dt><dd>${escapeHtml(item.symbol||item.primarySymbol||'—')}</dd><dt>Name</dt><dd>${escapeHtml(item.displayName||item.name||'—')}</dd><dt>Class</dt><dd>${escapeHtml(item.assetClass||'—')}</dd><dt>Venue</dt><dd>${escapeHtml(item.venue||'—')}</dd><dt>Base / Quote</dt><dd>${escapeHtml(`${item.baseAsset||'—'} / ${item.quoteAsset||item.currency||'—'}`)}</dd><dt>Series</dt><dd>${escapeHtml(item.seriesKey||'—')}</dd><dt>Metric</dt><dd>${escapeHtml(item.metric||'—')}</dd><dt>Latest value</dt><dd>${escapeHtml(format(item.value))}</dd><dt>Truth state</dt><dd><span class="q-reference-status q-reference-status--${tone(item.truthState)}">${escapeHtml(item.truthState||'UNAVAILABLE')}</span></dd><dt>Observed</dt><dd>${escapeHtml(date(item.observedAt))}</dd><dt>Ingested</dt><dd>${escapeHtml(date(item.ingestedAt))}</dd><dt>Execution</dt><dd>Disabled</dd></dl>`;
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
      const button=document.createElement('button');button.type='button';button.className='q-reference-instrument-row';button.setAttribute('aria-pressed','false');
      button.innerHTML=`<span><strong>${escapeHtml(item.symbol||item.primarySymbol||'—')}</strong><small>${escapeHtml(item.displayName||item.name||'—')}</small></span><span><b>${escapeHtml(format(item.value))}</b><small>${escapeHtml(item.unit||item.currency||'')}</small></span><span class="q-reference-status q-reference-status--${tone(item.truthState)}">${escapeHtml(item.truthState||'UNAVAILABLE')}</span>`;
      button.addEventListener('click',()=>{grid.querySelectorAll('.q-reference-is-selected').forEach((node)=>{node.classList.remove('q-reference-is-selected');node.setAttribute('aria-pressed','false');});button.classList.add('q-reference-is-selected');button.setAttribute('aria-pressed','true');inspect(item);});grid.append(button);
    }
    if(!filtered.length)grid.innerHTML='<div class="q-reference-empty-state"><strong>No governed instrument matches this filter.</strong></div>';
  };
  query.addEventListener('input',render);assetClass.addEventListener('change',render);render();if(items[0])inspect(items[0]);
}
