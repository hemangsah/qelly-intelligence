import {calculateFormula,getFormulaDefinition} from '../calculation/formula-engine-extended.mjs';
import {saveCalculation,encodeShareState} from '../calculation/persistence.mjs';

const copy=async text=>{await navigator.clipboard?.writeText(text);};
const humanize=(value)=>String(value??'').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[-_]+/g,' ').replace(/^./,(character)=>character.toUpperCase());
const contractRows=(schema={})=>Object.entries(schema.properties||{}).map(([key,value])=>`<tr><th>${humanize(value.title||key)}</th><td>${value.type||'value'}</td><td>${value.unit||value.units||'Formula-specific'}</td><td>${value.description||'Documented input'}</td></tr>`).join('');

const renderSelectionRequired=(main,{pageHead,navigate,reason})=>{
  main.innerHTML=`<section class="q-page q-formula-detail-page">${pageHead('Quantitative methodology','Formula Detail','Select a formula to inspect its governed methodology, assumptions, inputs, worked example and version evidence.')}<div class="q-state-banner is-empty"><span class="q-status q-status--cached">SELECTION REQUIRED</span><p>${reason}</p></div><section class="q-panel"><div class="q-panel-head"><div><h2>No formula selected</h2><p>Choose a formula from the library to open its deterministic methodology detail.</p></div></div><div class="q-panel-body"><button class="q-button q-button--primary" data-action="library">Open formula library</button></div></section></section>`;
  main.querySelector('[data-action="library"]').addEventListener('click',()=>navigate('formula-library'));
};

export async function renderFormulaDetail(main,{pageHead,escapeHtml,toast,navigate,id}){
  if(!id){
    renderSelectionRequired(main,{pageHead,navigate,reason:'No formula identifier is present in this route. Qelly does not invent a formula selection.'});
    return;
  }
  let definition;
  try{definition=getFormulaDefinition(id);}catch{
    renderSelectionRequired(main,{pageHead,navigate,reason:'The current route context does not resolve to a governed formula. Qelly does not substitute another formula or redirect silently.'});
    return;
  }
  const reference=definition.referenceVector?.inputs??null;
  const result=reference?calculateFormula(definition.formulaId,reference,{calculatedAt:'2026-07-30T00:00:00.000Z'}):null;
  main.innerHTML=`<section class="q-page q-formula-detail-page">
    ${pageHead('Quantitative methodology','Formula',definition.name,`<button class="q-button q-button--primary" data-action="calculate">Use calculator</button>`)}
    <div class="q-state-banner is-simulated"><span class="q-status q-status--simulated">DETERMINISTIC</span><p>This formula runs locally from your inputs. It does not require live market data or execution access.</p></div>
    <section class="q-calculator-layout"><article class="q-panel"><div class="q-panel-head"><div><p class="q-eyebrow">${escapeHtml(humanize(definition.category??definition.domain))}</p><h2>${escapeHtml(definition.name)}</h2><p>${escapeHtml(definition.description)}</p></div></div><div class="q-panel-body">
      <dl class="q-evidence-grid"><div><dt>Method</dt><dd>${escapeHtml(definition.numericalMethod??definition.description)}</dd></div><div><dt>Output units</dt><dd>${escapeHtml(definition.units??'Formula-specific')}</dd></div><div><dt>Data requirement</dt><dd>${definition.externalProviderRequired?'External provider required':'Your inputs only'}</dd></div><div><dt>Calculation type</dt><dd>Deterministic local</dd></div></dl>
      <h3>Assumptions</h3><ul>${(definition.assumptions??[]).map((item)=>`<li>${escapeHtml(item)}</li>`).join('')||'<li>User inputs are authoritative.</li>'}</ul>
      ${contractRows(definition.inputSchema)?`<h3>Input guide</h3><div class="q-responsive-table"><table><thead><tr><th>Input</th><th>Type</th><th>Unit</th><th>Guidance</th></tr></thead><tbody>${contractRows(definition.inputSchema)}</tbody></table></div>`:''}
      <details><summary>Technical reference</summary><dl class="q-evidence-grid"><div><dt>Formula identifier</dt><dd><code>${escapeHtml(definition.formulaId)}</code></dd></div><div><dt>Version</dt><dd>${escapeHtml(definition.version)}</dd></div><div><dt>Reference source</dt><dd>${escapeHtml(definition.referenceSource??definition.description)}</dd></div><div><dt>Jurisdiction</dt><dd>${escapeHtml(definition.jurisdiction??'Global')}</dd></div></dl></details>
    </div></article>
    <article class="q-panel"><div class="q-panel-head"><div><p class="q-eyebrow">Example</p><h2>Worked calculation</h2><p>Use the documented example as a starting point, then replace it with your own assumptions.</p></div></div><div class="q-panel-body">${result?.status==='success'?`<div class="q-calculation-result-list">${Object.entries(result.outputs||{}).slice(0,8).map(([key,value])=>`<div class="q-calculation-result"><span>${escapeHtml(humanize(key))}</span><strong>${escapeHtml(typeof value==='number'?value.toLocaleString(undefined,{maximumFractionDigits:6}):String(value))}</strong></div>`).join('')}</div>`:'<div class="q-result-empty"><p>No reference calculation is available for this formula.</p></div>'}<div class="q-actions"><button class="q-button q-button--secondary" data-action="save" ${result?.status==='success'?'':'disabled'}>Save example</button><button class="q-button q-button--ghost" data-action="share">Copy formula link</button><button class="q-button q-button--ghost" data-action="library">Back to formulas</button></div></div></article></section>
  </section>`;
  main.querySelector('[data-action="calculate"]').addEventListener('click',()=>navigate('calculator-detail',definition.formulaId));
  main.querySelector('[data-action="library"]').addEventListener('click',()=>navigate('formula-library'));
  main.querySelector('[data-action="save"]')?.addEventListener('click',()=>{saveCalculation({name:`${definition.name} example`,result,tags:['formula','example',definition.category??definition.domain]});toast('Formula example saved locally',{tone:'success'});});
  main.querySelector('[data-action="share"]').addEventListener('click',async()=>{await copy(`${location.origin}${location.pathname}#/formula-detail/${definition.formulaId}?state=${encodeShareState({formulaId:definition.formulaId})}`);toast('Formula link copied',{tone:'success'});});
}
