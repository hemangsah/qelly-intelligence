import {calculateIndicator,getIndicatorDefinition} from '../calculation/indicator-engine-extended.mjs';
import {createIndicatorSampleInputs} from '../calculation/indicator-sample-contracts.mjs';
import {saveCalculation,encodeShareState,resultToCsv} from '../calculation/persistence.mjs';

const download=(name,content,type)=>{const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),0);};
const fmt=(value)=>value==null?'—':typeof value==='number'?new Intl.NumberFormat('en-US',{maximumFractionDigits:6}).format(value):String(value);
const titleCase=(value)=>String(value||'General').replaceAll('-',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());
const humanParameter=(key,value)=>{
  if(Array.isArray(value))return `${value.length} values`;
  if(value&&typeof value==='object')return Object.entries(value).map(([name,item])=>`${titleCase(name)}: ${fmt(item)}`).join(' · ');
  return fmt(value);
};
const primarySeries=(outputs={})=>{
  const arrays=Object.entries(outputs).filter(([,value])=>Array.isArray(value));
  return arrays.find(([key])=>['value','macd','middle','k','rsi','atr','vwap'].includes(key))??arrays[0]??[null,[]];
};

export async function renderIndicatorDetail(main,{pageHead,escapeHtml,toast,navigate,id}){
  let definition;
  try{definition=getIndicatorDefinition(id);}catch{navigate('indicator-library');return;}
  const hasGovernedReference=Boolean(definition.referenceVector?.inputs);
  const inputs=definition.referenceVector?.inputs??createIndicatorSampleInputs(definition);
  const result=calculateIndicator(definition.indicatorId,inputs,{calculatedAt:'2026-07-30T00:00:00.000Z'});
  const [seriesName,series]=primarySeries(result?.outputs??{});
  const close=Array.isArray(inputs?.close)?inputs.close:[];
  const available=(series??[]).map((value,index)=>({value,index})).filter((item)=>item.value!=null&&Number.isFinite(Number(item.value)));
  const latest=available.at(-1);
  const firstAvailable=(series??[]).findIndex((value)=>value!=null);
  const warmup=firstAvailable<0?series?.length??0:firstAvailable;
  const recent=available.slice(-24).map((item)=>Number(item.value));
  const minimum=recent.length?Math.min(...recent):null,maximum=recent.length?Math.max(...recent):null,range=minimum==null?1:(maximum-minimum||1);
  const start=Math.max(0,Math.max(close.length,series?.length??0)-12);
  const parameterEntries=Object.entries(result?.outputs?.parameters??definition.parameters??{});
  const methodDescription=definition.referenceMethod??definition.reference??'A deterministic technical-analysis study using user-provided market history.';
  const technicalEvidence={
    indicatorId:definition.indicatorId,
    version:definition.version,
    sampleSource:hasGovernedReference?'governed reference vector':'presentation-only deterministic OHLCV contract',
    sampleObservationCount:close.length,
    provenanceStatus:definition.provenanceStatus,
    referenceVectorStatus:definition.referenceVectorStatus,
    propertyTestStatus:definition.propertyTestStatus,
    fuzzStatus:definition.fuzzStatus,
    parityStatus:definition.parityStatus,
    performanceStatus:definition.performanceStatus,
    securityStatus:definition.securityStatus,
    resultStatus:result?.status,
    truthState:result?.truthState,
    calculatedAt:result?.calculatedAt
  };

  main.innerHTML=`<section class="q-page q-indicator-detail-page">
    ${pageHead('Indicator methodology',definition.name,methodDescription,`<button class="q-button q-button--secondary" data-action="library">Back to indicators</button>`)}
    <div class="q-state-banner is-simulated"><span class="q-status q-status--simulated">DETERMINISTIC · USER-PROVIDED MARKET HISTORY</span><p>This study uses only the fields listed below. It does not infer order-book, liquidation, options-chain or on-chain data.</p></div>

    <section class="q-indicator-detail-grid">
      <article class="q-panel q-indicator-methodology">
        <div class="q-panel-head"><div><p class="q-eyebrow">${escapeHtml(titleCase(definition.category))}</p><h2>How this study works</h2><p>${escapeHtml(methodDescription)}</p></div></div>
        <div class="q-panel-body">
          <div class="q-method-card-grid">
            <article class="q-method-card"><span>Required data</span><strong>${escapeHtml(definition.requiredFields.join(', '))}</strong><p>Provide these fields in oldest-to-newest order.</p></article>
            <article class="q-method-card"><span>Warm-up</span><strong>${escapeHtml(definition.warmup)}</strong><p>Early observations remain unavailable until enough history exists.</p></article>
            <article class="q-method-card"><span>Output alignment</span><strong>${escapeHtml(definition.outputAlignment)}</strong><p>Values retain their relationship to the original market observations.</p></article>
            <article class="q-method-card"><span>Missing values</span><strong>${escapeHtml(definition.missingValueBehavior??'Rejected or preserved explicitly')}</strong><p>No missing value is silently converted to zero.</p></article>
          </div>
          <section class="q-indicator-parameters" aria-labelledby="indicator-parameters-title">
            <div class="q-indicator-subhead"><p class="q-eyebrow">Configuration</p><h3 id="indicator-parameters-title">Method parameters</h3></div>
            <dl>${parameterEntries.length?parameterEntries.map(([key,value])=>`<div><dt>${escapeHtml(titleCase(key))}</dt><dd>${escapeHtml(humanParameter(key,value))}</dd></div>`).join(''):'<div><dt>Parameters</dt><dd>This study has no adjustable parameter in the reference method.</dd></div>'}</dl>
          </section>
          <section class="q-indicator-limits" aria-labelledby="indicator-limits-title"><div class="q-indicator-subhead"><p class="q-eyebrow">Interpretation boundary</p><h3 id="indicator-limits-title">What the result does not prove</h3></div><p>${escapeHtml(definition.invalidInputBehavior??'Invalid or insufficient inputs fail explicitly.')} An indicator is descriptive evidence, not a forecast, recommendation or execution signal.</p></section>
        </div>
      </article>

      <article class="q-panel q-indicator-sample">
        <div class="q-panel-head"><div><p class="q-eyebrow">Deterministic sample evidence</p><h2>${latest?`${escapeHtml(titleCase(seriesName))}: ${escapeHtml(fmt(latest.value))}`:'Insufficient history'}</h2><p>${available.length} available observations · ${warmup} warm-up positions</p></div><span class="q-status q-status--simulated">LOCAL</span></div>
        <div class="q-panel-body">
          <div class="q-indicator-value-grid"><div><span>Latest value</span><strong>${latest?escapeHtml(fmt(latest.value)):'—'}</strong></div><div><span>Recent range</span><strong>${minimum==null?'—':`${escapeHtml(fmt(minimum))}–${escapeHtml(fmt(maximum))}`}</strong></div><div><span>Sample observations</span><strong>${Math.max(close.length,series?.length??0)}</strong></div></div>
          <div class="q-indicator-chart" role="img" aria-label="Recent ${escapeHtml(definition.name)} sample values">
            ${recent.length?`<div class="q-spark-bars">${recent.map((value)=>`<span style="height:${Math.max(6,((value-minimum)/range)*100)}%" title="${escapeHtml(fmt(value))}"></span>`).join('')}</div><p>Recent sample range ${escapeHtml(fmt(minimum))}–${escapeHtml(fmt(maximum))}. Exact values appear below.</p>`:'<p>Insufficient sample history for a visual result.</p>'}
          </div>
          <div class="q-table-shell q-indicator-exact-table"><table class="q-table"><thead><tr><th>Observation</th><th>Close</th><th>${escapeHtml(titleCase(seriesName??'Indicator'))}</th></tr></thead><tbody>${Array.from({length:Math.max(0,Math.max(close.length,series?.length??0)-start)},(_,offset)=>{const index=start+offset;return`<tr><td>${index+1}</td><td>${escapeHtml(fmt(close[index]))}</td><td>${escapeHtml(fmt(series?.[index]))}</td></tr>`;}).join('')||'<tr><td colspan="3">No sample values available</td></tr>'}</tbody></table></div>
          <div class="q-actions"><button class="q-button q-button--secondary" data-action="save" ${result?.status==='success'?'':'disabled'}>Save sample</button><button class="q-button q-button--ghost" data-action="csv" ${result?.status==='success'?'':'disabled'}>Export CSV</button><button class="q-button q-button--ghost" data-action="share">Copy share link</button></div>
          <details class="q-technical-details"><summary>Advanced technical evidence</summary><pre>${escapeHtml(JSON.stringify(technicalEvidence,null,2))}</pre></details>
        </div>
      </article>
    </section>
  </section>`;

  main.querySelector('[data-action="library"]').addEventListener('click',()=>navigate('indicator-library'));
  main.querySelector('[data-action="save"]')?.addEventListener('click',()=>{saveCalculation({name:`${definition.name} sample`,result,tags:['indicator','sample',definition.category]});toast('Indicator sample saved in this browser',{tone:'success'});});
  main.querySelector('[data-action="csv"]')?.addEventListener('click',()=>download(`qelly-${definition.indicatorId}-sample.csv`,resultToCsv(result),'text/csv'));
  main.querySelector('[data-action="share"]').addEventListener('click',async()=>{await navigator.clipboard?.writeText(`${location.origin}${location.pathname}#/indicator-detail/${definition.indicatorId}?state=${encodeShareState({indicatorId:definition.indicatorId})}`);toast('Indicator link copied',{tone:'success'});});
}
