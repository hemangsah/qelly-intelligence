import {calculateFormula,getFormulaDefinition} from '../calculation/formula-engine-extended.mjs';
import {saveCalculation,encodeShareState} from '../calculation/persistence.mjs';

const copy=async text=>{await navigator.clipboard?.writeText(text);};
export async function renderFormulaDetail(main,{pageHead,escapeHtml,toast,navigate,id}){
  let definition;
  try{definition=getFormulaDefinition(id);}catch{navigate('formula-library');return;}
  const reference=definition.referenceVector?.inputs??null;
  const result=reference?calculateFormula(definition.formulaId,reference,{calculatedAt:'2026-07-30T00:00:00.000Z'}):null;
  main.innerHTML=`<section class="q-page q-formula-detail-page">
    ${pageHead('Deterministic methodology','Formula Detail',`${definition.name} · ${definition.formulaId}`,`<button class="q-button q-button--primary" data-action="calculate">Open calculator</button>`)}
    <div class="q-state-banner is-simulated"><span class="q-status q-status--simulated">${escapeHtml(definition.provenanceStatus??'DETERMINISTIC LOCAL')}</span><p>No live provider is required. Historical missing-module continuity is not claimed.</p></div>
    <section class="q-calculator-layout"><article class="q-panel"><div class="q-panel-head"><div><p class="q-eyebrow">${escapeHtml(definition.category??definition.domain)}</p><h2>${escapeHtml(definition.name)}</h2><p>${escapeHtml(definition.description)}</p></div><span class="q-status q-status--simulated">v${escapeHtml(definition.version)}</span></div><div class="q-panel-body">
      <dl class="q-evidence-grid"><div><dt>Stable ID</dt><dd><code>${escapeHtml(definition.formulaId)}</code></dd></div><div><dt>Numerical method</dt><dd>${escapeHtml(definition.numericalMethod??'documented deterministic implementation')}</dd></div><div><dt>Units</dt><dd>${escapeHtml(definition.units??'formula-specific')}</dd></div><div><dt>Reference</dt><dd>${escapeHtml(definition.referenceSource??definition.description)}</dd></div><div><dt>Truth</dt><dd>${escapeHtml(definition.productTruth??'DETERMINISTIC LOCAL')}</dd></div><div><dt>Provider required</dt><dd>${definition.externalProviderRequired?'Yes':'No'}</dd></div></dl>
      <h3>Assumptions</h3><ul>${(definition.assumptions??[]).map(item=>`<li>${escapeHtml(item)}</li>`).join('')||'<li>User inputs are authoritative.</li>'}</ul>
      <h3>Input contract</h3><pre>${escapeHtml(JSON.stringify(definition.inputSchema??{},null,2))}</pre>
      <h3>Output contract</h3><pre>${escapeHtml(JSON.stringify(definition.outputSchema??{},null,2))}</pre>
    </div></article>
    <article class="q-panel"><div class="q-panel-head"><div><p class="q-eyebrow">Reference evidence</p><h2>Primary vector</h2><p>Executable deterministic evidence retained with the definition.</p></div></div><div class="q-panel-body"><pre>${escapeHtml(JSON.stringify({inputs:reference,result},null,2))}</pre><div class="q-actions"><button class="q-button q-button--secondary" data-action="save" ${result?.status==='success'?'':'disabled'}>Save reference result</button><button class="q-button q-button--ghost" data-action="share">Copy share state</button><button class="q-button q-button--ghost" data-action="library">Back to library</button></div><details><summary>Validation status</summary><pre>${escapeHtml(JSON.stringify({referenceVectorStatus:definition.referenceVectorStatus,propertyTestStatus:definition.propertyTestStatus,fuzzStatus:definition.fuzzStatus,parityStatus:definition.parityStatus,performanceStatus:definition.performanceStatus,securityStatus:definition.securityStatus},null,2))}</pre></details></div></article></section>
  </section>`;
  main.querySelector('[data-action="calculate"]').addEventListener('click',()=>navigate('calculator-detail',definition.formulaId));
  main.querySelector('[data-action="library"]').addEventListener('click',()=>navigate('formula-library'));
  main.querySelector('[data-action="save"]')?.addEventListener('click',()=>{saveCalculation({name:`${definition.name} reference`,result,tags:['formula','reference',definition.category??definition.domain]});toast('Formula reference saved locally',{tone:'success'});});
  main.querySelector('[data-action="share"]').addEventListener('click',async()=>{await copy(`${location.origin}${location.pathname}#/formula-detail/${definition.formulaId}?state=${encodeShareState({formulaId:definition.formulaId})}`);toast('Formula detail share state copied',{tone:'success'});});
}
