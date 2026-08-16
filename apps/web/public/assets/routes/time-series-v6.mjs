const number=(value)=>Number.isFinite(Number(value))?Number(value):null;
const format=(value)=>number(value)==null?'—':new Intl.NumberFormat('en-IN',{maximumFractionDigits:6}).format(Number(value));
const dateLabel=(value)=>{const date=new Date(value||'');return Number.isNaN(date.getTime())?'—':date.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});};
const stateTone=(value)=>String(value||'').toUpperCase()==='DELAYED'?'delayed':String(value||'').toUpperCase()==='LIVE'?'live':String(value||'').toUpperCase()==='CACHED'?'cached':String(value||'').toUpperCase()==='STALE'?'stale':'unavailable';

function chartSvg(points){
  const usable=(Array.isArray(points)?points:[]).map((point)=>({at:point.observedAt,value:number(point.value)})).filter((point)=>point.value!=null);
  if(usable.length<2)return '<div class="q-empty-state">Not enough governed observations to draw this series.</div>';
  const width=920,height=310,padX=34,padY=26;
  const values=usable.map((point)=>point.value),minimum=Math.min(...values),maximum=Math.max(...values),span=Math.max(maximum-minimum,Math.abs(maximum)*.002,1e-9);
  const x=(index)=>padX+(index/(usable.length-1))*(width-padX*2);
  const y=(value)=>height-padY-((value-minimum)/span)*(height-padY*2);
  const path=usable.map((point,index)=>`${index?'L':'M'} ${x(index).toFixed(2)} ${y(point.value).toFixed(2)}`).join(' ');
  const grid=Array.from({length:5},(_,index)=>{const gy=padY+(index/4)*(height-padY*2);return `<line x1="${padX}" y1="${gy.toFixed(2)}" x2="${width-padX}" y2="${gy.toFixed(2)}"/>`;}).join('');
  return `<svg class="q-v6-series-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Governed reference-rate history"><g class="q-v6-series-grid">${grid}</g><path class="q-v6-series-line" d="${path}" fill="none"/><circle class="q-v6-series-last" cx="${x(usable.length-1).toFixed(2)}" cy="${y(usable.at(-1).value).toFixed(2)}" r="4"/></svg>`;
}

export async function renderTimeSeriesV6(main,deps){
  const {api,pageHead,stateBanner,escapeHtml}=deps;
  let summary;
  try{summary=await api('/api/v1/timeseries/summary');}
  catch(error){main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Governed history','Reference Time Series','The governed time-series service is unavailable. Qelly will not substitute synthetic history.', '')}${stateBanner()}<section class="q-panel"><div class="q-panel-body"><div class="q-empty-state"><strong>Time-series service unavailable</strong><p>${escapeHtml(error.message)}</p></div></div></section></section>`;return;}
  const suppliedItems=Array.isArray(summary.items)?summary.items.filter((item)=>String(item.assetClass||'').toLowerCase()==='fx'):[];
  const items=(suppliedItems.length?suppliedItems:[{canonicalId:'QI-FX-USDINR',symbol:'USDINR',displayName:'US Dollar / Indian Rupee',assetClass:'fx'}]).map((item)=>({...item,id:item.canonicalId||item.id||item.symbol}));
  const preferred=['EURINR','EURUSD','EURGBP','EURJPY','EURCHF'];
  items.sort((a,b)=>{const ai=preferred.indexOf(a.symbol),bi=preferred.indexOf(b.symbol);return (ai<0?999:ai)-(bi<0?999:bi)||String(a.symbol).localeCompare(String(b.symbol));});
  const selected=items[0]?.id||'QI-FX-USDINR';
  main.innerHTML=`<section class="q-page q-v6-series-page">
    ${pageHead('Qelly Intelligence · Governed provider history','Reference Time Series','Production ECB reference-rate history with explicit observation cadence, rights and provenance. These values are informational reference rates, not executable spot prices.',`<span class="q-status q-status--delayed">REFERENCE · 1D</span>`)}${stateBanner()}
    <section class="q-v6-series-summary">
      <div><span>Instruments</span><strong>${Number(summary.instruments)||items.length}</strong><small>Governed active master</small></div>
      <div><span>Series</span><strong>${Number(summary.series)||items.length}</strong><small>Normalized reference series</small></div>
      <div><span>Observations</span><strong>${Number(summary.points||0).toLocaleString('en-IN')}</strong><small>Persisted provider points</small></div>
      <div><span>Interval</span><strong>1D</strong><small>ECB working-day reference</small></div>
      <div><span>Execution</span><strong>OFF</strong><small>Research / reference only</small></div>
    </section>
    <section class="q-panel q-v6-series-control"><div class="q-panel-head"><div><h2>Series selector</h2><p>Only normalized, rights-approved production series are selectable.</p></div><span id="v6-series-status" class="q-status q-status--delayed">loading</span></div><div class="q-panel-body q-control-row"><label class="q-setting"><span>Reference series</span><select id="v6-series-symbol">${items.map((item)=>`<option value="${escapeHtml(item.id)}" ${item.id===selected?'selected':''}>${escapeHtml(item.symbol)} · ${escapeHtml(item.displayName||item.name||item.symbol)}</option>`).join('')}</select></label><label class="q-setting"><span>History</span><select id="v6-series-limit"><option value="30">30 observations</option><option value="65" selected>65 observations</option><option value="90">90 observations</option></select></label><div class="q-setting q-query-boundary"><span>Truth boundary</span><strong>DELAYED · provider reference data</strong><small>No OHLC or volume fields are fabricated.</small></div></div></section>
    <div class="q-v6-series-layout">
      <section class="q-panel"><div class="q-panel-head"><div><h2 id="v6-series-title">${escapeHtml(selected)} history</h2><p id="v6-series-subtitle">Loading governed observations…</p></div><strong id="v6-series-latest" class="q-v6-series-latest">—</strong></div><div class="q-panel-body"><div id="v6-series-chart" class="q-v6-series-chart"></div><div id="v6-series-range" class="q-v6-series-range"></div></div></section>
      <aside class="q-panel"><div class="q-panel-head"><div><h2>Evidence</h2><p>Provider, rights, method and observation state.</p></div></div><div id="v6-series-evidence" class="q-panel-body"></div></aside>
    </div>
    <section class="q-panel"><div class="q-panel-head"><div><h2>Normalized observations</h2><p>Latest governed values. Observation and ingestion time remain distinct.</p></div><span id="v6-series-count" class="q-status q-status--cached">0 points</span></div><div class="q-panel-body"><div id="v6-series-table" class="q-v6-series-table"></div></div></section>
  </section>`;

  const symbol=main.querySelector('#v6-series-symbol'),limit=main.querySelector('#v6-series-limit'),status=main.querySelector('#v6-series-status');
  const load=async()=>{
    status.textContent='loading';status.className='q-status q-status--delayed';
    try{
      const result=await api(`/api/v1/timeseries/${encodeURIComponent(symbol.value)}?interval=1d&limit=${encodeURIComponent(limit.value)}`);
      const points=(Array.isArray(result.points)?result.points:[]).map((point)=>({...point,value:point.value??point.close,observedAt:point.observedAt??point.at,ingestedAt:point.ingestedAt??point.receivedAt??point.at,truthState:point.truthState??point.freshnessClass??result.metadata?.freshnessClass})),last=points.at(-1),first=points[0],values=points.map((point)=>number(point.value)).filter((value)=>value!=null);
      const min=values.length?Math.min(...values):null,max=values.length?Math.max(...values):null,change=first&&last&&number(first.value)!=null&&number(last.value)!=null?Number(last.value)-Number(first.value):null;
      const truth=last?.truthState||'UNAVAILABLE';
      status.textContent=truth;status.className=`q-status q-status--${stateTone(truth)}`;
      const selectedItem=items.find((item)=>item.id===symbol.value);
      main.querySelector('#v6-series-title').textContent=`${result.instrument?.symbol||selectedItem?.symbol||symbol.value} · ${result.series?.metric||'reference rate'}`;
      main.querySelector('#v6-series-subtitle').textContent=`${result.instrument?.displayName||selectedItem?.displayName||''} · ${result.series?.unit||result.metadata?.unit||''} · ${points.length} governed observations`;
      main.querySelector('#v6-series-latest').textContent=format(last?.value);
      main.querySelector('#v6-series-chart').innerHTML=chartSvg(points);
      main.querySelector('#v6-series-range').innerHTML=`<span>Start <strong>${format(first?.value)}</strong></span><span>Latest <strong>${format(last?.value)}</strong></span><span>Low <strong>${format(min)}</strong></span><span>High <strong>${format(max)}</strong></span><span>Net <strong>${change==null?'—':`${change>=0?'+':''}${format(change)}`}</strong></span>`;
      main.querySelector('#v6-series-evidence').innerHTML=`<dl class="q-v6-evidence-list"><dt>Truth state</dt><dd><span class="q-status q-status--${stateTone(truth)}">${escapeHtml(truth)}</span></dd><dt>Provider</dt><dd>${escapeHtml(result.provider?.displayName||result.provider?.providerKey||result.metadata?.providerId||'Qelly governed series')}</dd><dt>Observed</dt><dd>${escapeHtml(dateLabel(last?.observedAt))}</dd><dt>Ingested</dt><dd>${escapeHtml(dateLabel(last?.ingestedAt))}</dd><dt>Rights</dt><dd>${escapeHtml(`${result.provider?.commercialRightsStatus||result.metadata?.entitlementClass||'workspace'} / ${result.provider?.redistributionRightsStatus||'not redistributed'}`)}</dd><dt>Method</dt><dd>${escapeHtml(result.series?.methodology||result.metadata?.methodologyVersion||'Normalized time series')}</dd><dt>Attribution</dt><dd>${escapeHtml(result.provider?.attribution||result.metadata?.source||'Qelly workspace')}</dd><dt>Execution</dt><dd>Disabled</dd></dl>`;
      const rows=points.slice().reverse().slice(0,30).map((point)=>`<div class="q-v6-series-row"><span>${escapeHtml(dateLabel(point.observedAt))}</span><strong>${escapeHtml(format(point.value))}</strong><span>${escapeHtml(result.series?.unit||'')}</span><span class="q-status q-status--${stateTone(point.truthState)}">${escapeHtml(point.truthState||'UNAVAILABLE')}</span><small>ingested ${escapeHtml(dateLabel(point.ingestedAt))}</small></div>`).join('');
      main.querySelector('#v6-series-table').innerHTML=rows||'<div class="q-empty-state">No governed observations.</div>';
      main.querySelector('#v6-series-count').textContent=`${points.length} points`;
    }catch(error){status.textContent='UNAVAILABLE';status.className='q-status q-status--unavailable';main.querySelector('#v6-series-chart').innerHTML=`<div class="q-empty-state"><strong>Series unavailable</strong><p>${escapeHtml(error.message)}</p></div>`;}
  };
  symbol?.addEventListener('change',load);limit?.addEventListener('change',load);await load();
}

export const __timeSeriesV6Test=Object.freeze({chartSvg,stateTone});
