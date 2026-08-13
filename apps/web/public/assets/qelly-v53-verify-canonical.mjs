import {calculateFormula,listFormulaDefinitions,formulaEngineMetadata} from './calculation/formula-engine-extended.mjs';

const main=document.getElementById('main');
const esc=(value)=>String(value??'').replace(/[&<>'"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const title=(value)=>String(value??'').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[-_]+/g,' ').replace(/^./,(c)=>c.toUpperCase());
const show=(value)=>typeof value==='number'?new Intl.NumberFormat(undefined,{maximumFractionDigits:6}).format(value):String(value??'—');
const formulas=listFormulaDefinitions().slice().sort((a,b)=>String(a.name).localeCompare(String(b.name)));
const canonicalRoute=()=>location.hash.replace(/^#\/?/,'').split(/[/?]/)[0]==='qelly-verify';

function primaryOutput(result){
  if(result?.status!=='success')return ['Result','Unavailable'];
  const entry=Object.entries(result.outputs||{}).find(([,value])=>typeof value==='number'&&Number.isFinite(value))??Object.entries(result.outputs||{})[0];
  return entry?[title(entry[0]),show(entry[1])]:['Result','No scalar output'];
}

function sensitivity(definition,inputs){
  const numeric=Object.entries(inputs||{}).find(([,value])=>typeof value==='number'&&Number.isFinite(value)&&value!==0);
  if(!numeric)return null;
  const [key,value]=numeric;
  const run=(next)=>primaryOutput(calculateFormula(definition.formulaId,{...inputs,[key]:next},{calculatedAt:'2026-08-14T00:00:00.000Z'}))[1];
  return {key,low:run(value*.95),base:run(value),high:run(value*1.05)};
}

function render(host,id){
  const definition=formulas.find((item)=>item.formulaId===id)??formulas[0];
  if(!definition)return;
  const inputs=structuredClone(definition.referenceVector?.inputs??{});
  const result=calculateFormula(definition.formulaId,inputs,{calculatedAt:'2026-08-14T00:00:00.000Z'});
  const [outputLabel,outputValue]=primaryOutput(result);
  const stress=sensitivity(definition,inputs);
  const inputRows=Object.entries(inputs).slice(0,8);
  const assumptions=(definition.assumptions??[]).slice(0,6);
  host.innerHTML=`<div class="q-v53-verify-kpis"><article><span>Engine</span><strong>${esc(formulaEngineMetadata.engineVersion)}</strong><small>Deterministic local</small></article><article><span>Formulae</span><strong>${formulaEngineMetadata.definitionCount}</strong><small>Governed definitions</small></article><article><span>Provider</span><strong>None</strong><small>Inputs only</small></article><article><span>Method</span><strong>${esc(definition.version??'versioned')}</strong><small>${esc(definition.formulaId)}</small></article><article><span>Coverage</span><strong>${inputRows.length}</strong><small>Reference inputs</small></article><article><span>Truth state</span><strong>DETERMINISTIC</strong><small>Reproducible</small></article></div><div class="q-v53-verify-grid"><section class="q-panel q-v53-verify-primary"><div class="q-panel-head"><div><p class="q-eyebrow">Primary analytical workspace</p><h2>Formula validation</h2><p>Inspect method, assumptions, reference inputs, deterministic output and local sensitivity.</p></div></div><div class="q-panel-body"><label class="q-v53-verify-select">Governed formula<select data-v53-verify-formula>${formulas.map((item)=>`<option value="${esc(item.formulaId)}" ${item.formulaId===definition.formulaId?'selected':''}>${esc(item.name)}</option>`).join('')}</select></label><div class="q-v53-verify-result"><span>${esc(outputLabel)}</span><strong>${esc(outputValue)}</strong><small>${esc(definition.units??'Formula-specific units')}</small></div><div class="q-v53-verify-columns"><div><h3>Reference inputs</h3><dl>${inputRows.map(([key,value])=>`<div><dt>${esc(title(key))}</dt><dd>${esc(show(value))}</dd></div>`).join('')||'<div><dt>Inputs</dt><dd>User supplied</dd></div>'}</dl></div><div><h3>Assumptions</h3><ul>${assumptions.map((item)=>`<li>${esc(item)}</li>`).join('')||'<li>User inputs are authoritative.</li>'}</ul></div></div><div class="q-v53-verify-actions"><a class="q-button q-button--primary" href="#/calculator-detail/${esc(definition.formulaId)}">Use calculator</a><a class="q-button q-button--secondary" href="#/formula-detail/${esc(definition.formulaId)}">Open methodology</a><a class="q-button q-button--ghost" href="#/formula-library">Formula library</a></div></div></section><aside class="q-panel q-v53-verify-inspector" aria-label="Qelly Verify Intelligence Inspector"><div class="q-panel-head"><div><p class="q-eyebrow">Intelligence Inspector</p><h2>Evidence & reproducibility</h2></div></div><div class="q-panel-body"><dl class="q-v53-verify-evidence"><div><dt>Formula ID</dt><dd><code>${esc(definition.formulaId)}</code></dd></div><div><dt>Version</dt><dd>${esc(definition.version??'—')}</dd></div><div><dt>Calculation</dt><dd>${result?.status==='success'?'PASS':'UNAVAILABLE'}</dd></div><div><dt>External provider</dt><dd>${definition.externalProviderRequired?'Required':'Not required'}</dd></div><div><dt>Reference</dt><dd>${esc(definition.referenceSource??definition.description??'Governed formula definition')}</dd></div><div><dt>Contract</dt><dd>${esc(formulaEngineMetadata.presentationContractVersion)}</dd></div></dl>${stress?`<div class="q-v53-verify-sensitivity"><h3>Sensitivity · ${esc(title(stress.key))} ±5%</h3><div><span>−5%</span><strong>${esc(stress.low)}</strong></div><div><span>Base</span><strong>${esc(stress.base)}</strong></div><div><span>+5%</span><strong>${esc(stress.high)}</strong></div></div>`:'<p class="q-v53-verify-note">No scalar numeric reference input is available for a local sensitivity run.</p>'}<p class="q-v53-verify-note">Observed inputs, outputs and assumptions remain explicitly separated and reproducible from the governed formula definition.</p></div></aside></div>`;
  host.querySelector('[data-v53-verify-formula]')?.addEventListener('change',(event)=>render(host,event.currentTarget.value));
}

function converge(){
  if(!canonicalRoute())return;
  const page=main?.querySelector('.q-verify-page');
  if(!page||page.dataset.v53VerifyConverged==='true')return;
  page.dataset.v53VerifyConverged='true';
  page.classList.add('q-v53-verify-converged');
  const hero=page.querySelector('.q-verify-hero');
  hero?.querySelector('.q-verify-kicker')?.replaceChildren(document.createTextNode('Qelly Verify · Quantitative Methodology'));
  hero?.querySelector('h1')?.replaceChildren(document.createTextNode('Formula validation, assumptions, sensitivity and reproducibility.'));
  const description=hero?.querySelector('.q-verify-hero__copy>p:not(.q-verify-kicker)');
  if(description)description.textContent='Validate deterministic quantitative methods against governed definitions before using them in research or decision support.';
  const workbench=document.createElement('section');
  workbench.className='q-v53-verify-workbench';
  workbench.dataset.v53VerifyWorkbench='accepted-lock';
  const workspace=page.querySelector('.q-verify-workspace');
  if(workspace)workspace.before(workbench);else page.append(workbench);
  render(workbench,formulas[0]?.formulaId);
  if(workspace){
    const details=document.createElement('details');
    details.className='q-v53-strategy-tools';
    const summary=document.createElement('summary');
    summary.textContent='Strategy evidence tools · CSV analysis';
    workspace.before(details);
    details.append(summary,workspace);
  }
}

const observer=new MutationObserver(()=>requestAnimationFrame(converge));
if(main)observer.observe(main,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>requestAnimationFrame(converge));
converge();
