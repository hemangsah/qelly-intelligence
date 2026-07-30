import { calculateFormula, listFormulaDefinitions, formulaEngineMetadata } from '../calculation/formula-engine-extended.mjs';
import { saveCalculation, encodeShareState, resultToCsv } from '../calculation/persistence.mjs';

const EXAMPLES={
  'position-size':{accountValue:100000,riskPercent:1,entry:250,stop:242,multiplier:1,estimatedFees:20,slippagePerUnit:0.05,quantityStep:1},
  'kelly-criterion':{winProbability:55,averageWin:1800,averageLoss:1000,fraction:0.5,maximumRiskPercent:10},
  'risk-reward':{entry:100,stop:95,target:112},
  expectancy:{winProbability:48,averageWin:2.2,averageLoss:1},
  'isolated-liquidation-estimate':{entry:65000,leverage:5,maintenanceMarginPercent:0.5,closeFeePercent:0.05,side:'long'},
  'round-trip-cost':{notional:250000,feeRatePercent:0.03,spreadPercent:0.02,slippagePercent:0.01,statutoryCosts:125,fixedCosts:20},
  cagr:{startValue:100000,endValue:175000,years:5},
  'sharpe-ratio':{returnsPercent:[1.2,-0.4,0.9,1.5,-0.7,0.8,1.1,-0.2],riskFreeRatePercent:5,periodsPerYear:12},
  'maximum-drawdown':{values:[100,108,104,111,93,96,89,101,116]},
  'portfolio-volatility':{weights:[0.6,0.4],covarianceMatrix:[[0.04,0.012],[0.012,0.0225]]},
  'black-scholes':{spot:100,strike:105,timeYears:0.5,riskFreeRatePercent:5,dividendYieldPercent:0,volatilityPercent:22,optionType:'call'},
  'bond-price':{faceValue:1000,couponRatePercent:7,yieldPercent:8,years:5,frequency:2},
  'futures-pnl':{entry:22300,exit:22540,contracts:2,multiplier:25,side:'long',totalCosts:420},
  'apr-to-apy':{aprPercent:12,compoundsPerYear:12},
  'impermanent-loss':{priceRatio:2},
  'historical-var':{returnsPercent:[1.1,-2.4,0.3,-1.2,0.8,-3.1,1.4,-0.6,0.4,-1.8],confidencePercent:95},
  correlation:{seriesA:[1,2,3,4,5],seriesB:[2,3,5,7,11]}
};

const pretty=(value)=>JSON.stringify(value,null,2);
const download=(name,content,type='application/json')=>{const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),0);};
const outputRows=(value,path='')=>{if(value==null||typeof value!=='object')return [[path||'value',value]];const rows=[];for(const [key,item] of Object.entries(value)){const next=path?`${path}.${key}`:key;if(Array.isArray(item)||item&&typeof item==='object'){if(Array.isArray(item)&&item.length>16)rows.push([next,`[${item.length} values]`]);else rows.push(...outputRows(item,next));}else rows.push([next,item]);}return rows;};
const fmt=(value)=>typeof value==='number'?new Intl.NumberFormat('en-US',{maximumFractionDigits:8}).format(value):String(value??'—');

export async function renderCalculatorCenter(main,{pageHead,escapeHtml,toast,navigate}){
  const definitions=listFormulaDefinitions();
  const domains=[...new Set(definitions.map(item=>item.domain))];
  main.innerHTML=`<section class="q-page q-calculator-page">
    ${pageHead('Qelly deterministic intelligence','Quant Calculator Center','One governed calculation engine for browser and server. Every result carries formula version, assumptions, warnings and a deterministic-local truth label.',`<button class="q-button q-button--ghost" data-action="formula-library">Formula library</button><button class="q-button q-button--secondary" data-action="saved">Saved calculations</button>`)}
    <div class="q-state-banner is-simulated"><span class="q-status q-status--simulated">DETERMINISTIC LOCAL</span><p>No market API, broker, exchange or private account is required. Educational calculation only; not personalized investment, legal or tax advice.</p></div>
    <section class="q-calculator-layout">
      <aside class="q-panel q-calculator-catalog" aria-label="Calculator catalogue">
        <div class="q-panel-head"><div><h2>Formula catalogue</h2><p>${definitions.length} executable formulas · engine ${formulaEngineMetadata.engineVersion}</p></div></div>
        <div class="q-panel-body">
          <label class="q-field"><span>Search</span><input id="calculator-search" type="search" placeholder="Kelly, CAGR, option, bond…" autocomplete="off"></label>
          <label class="q-field"><span>Category</span><select id="calculator-domain"><option value="">All categories</option>${domains.map(domain=>`<option value="${escapeHtml(domain)}">${escapeHtml(domain.replaceAll('-',' '))}</option>`).join('')}</select></label>
          <div id="calculator-list" class="q-calculator-list"></div>
        </div>
      </aside>
      <section class="q-panel q-calculator-workbench">
        <div class="q-panel-head"><div><p class="q-eyebrow">Versioned methodology</p><h2 id="calculator-title">Select a calculator</h2><p id="calculator-description">Choose any governed formula. The structured JSON editor keeps advanced inputs transparent and exportable.</p></div><span id="calculator-truth" class="q-status q-status--simulated">LOCAL</span></div>
        <div class="q-panel-body q-calculator-body">
          <div class="q-calculator-inputs">
            <label class="q-field"><span>Input JSON</span><textarea id="calculator-input" rows="16" spellcheck="false" aria-describedby="calculator-input-help"></textarea><small id="calculator-input-help">Numbers use canonical units shown in the methodology. Percent inputs are percentage values, not decimal fractions.</small></label>
            <div id="calculator-validation" class="q-form-errors" role="alert" aria-live="polite"></div>
            <div class="q-actions q-calculator-actions"><button class="q-button q-button--primary" data-action="calculate">Calculate</button><button class="q-button q-button--secondary" data-action="reset">Reset example</button><button class="q-button q-button--ghost" data-action="copy-input">Copy input</button></div>
          </div>
          <div class="q-calculator-results" aria-live="polite">
            <div class="q-result-priority"><p class="q-eyebrow">Result</p><h3 id="result-primary">Ready for deterministic calculation</h3><p id="result-summary">Run the formula to create a versioned evidence object.</p></div>
            <div class="q-table-shell"><table class="q-table"><thead><tr><th>Output</th><th>Value</th></tr></thead><tbody id="result-table"><tr><td colspan="2">No result yet</td></tr></tbody></table></div>
            <details class="q-methodology"><summary>Methodology, assumptions and evidence</summary><pre id="result-evidence">Select and run a formula.</pre></details>
            <div class="q-actions q-result-actions"><button class="q-button q-button--secondary" data-action="save" disabled>Save locally</button><button class="q-button q-button--ghost" data-action="copy-result" disabled>Copy result</button><button class="q-button q-button--ghost" data-action="share" disabled>Copy share URL</button><button class="q-button q-button--ghost" data-action="export-json" disabled>JSON</button><button class="q-button q-button--ghost" data-action="export-csv" disabled>CSV</button></div>
          </div>
        </div>
      </section>
    </section>
  </section>`;

  let selected=definitions.find(item=>item.formulaId==='position-size')??definitions[0],result=null;
  const search=main.querySelector('#calculator-search'),domain=main.querySelector('#calculator-domain'),list=main.querySelector('#calculator-list'),editor=main.querySelector('#calculator-input');
  const renderList=()=>{const q=search.value.trim().toLowerCase(),category=domain.value;const filtered=definitions.filter(item=>(!category||item.domain===category)&&(!q||`${item.name} ${item.description} ${item.formulaId}`.toLowerCase().includes(q)));list.innerHTML=filtered.map(item=>`<button type="button" class="q-calculator-list-item ${item.formulaId===selected.formulaId?'is-active':''}" data-formula="${item.formulaId}"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.domain.replaceAll('-',' '))}</small></span><span aria-hidden="true">→</span></button>`).join('')||'<div class="q-empty-state"><strong>No matching formula</strong><p>Clear the search or choose another category.</p></div>';list.querySelectorAll('[data-formula]').forEach(button=>button.addEventListener('click',()=>select(button.dataset.formula)));};
  const select=(id)=>{selected=definitions.find(item=>item.formulaId===id)??selected;result=null;main.querySelector('#calculator-title').textContent=selected.name;main.querySelector('#calculator-description').textContent=selected.description;editor.value=pretty(EXAMPLES[selected.formulaId]??{});main.querySelector('#calculator-validation').textContent='';main.querySelector('#result-primary').textContent='Ready for deterministic calculation';main.querySelector('#result-summary').textContent=`Formula ${selected.formulaId} · version ${selected.version}`;main.querySelector('#result-table').innerHTML='<tr><td colspan="2">No result yet</td></tr>';main.querySelector('#result-evidence').textContent=pretty(selected);toggleResultActions(false);renderList();};
  const toggleResultActions=(enabled)=>main.querySelectorAll('.q-result-actions button').forEach(button=>button.disabled=!enabled);
  const run=()=>{let inputs;try{inputs=JSON.parse(editor.value);}catch(error){main.querySelector('#calculator-validation').textContent=`Input JSON is invalid: ${error.message}`;return;}result=calculateFormula(selected.formulaId,inputs);if(result.status!=='success'){main.querySelector('#calculator-validation').innerHTML=result.validationErrors.map(item=>`<p><strong>${escapeHtml(item.field??'Input')}:</strong> ${escapeHtml(item.message)}</p>`).join('');main.querySelector('#result-primary').textContent='Inputs need attention';main.querySelector('#result-summary').textContent='No result was produced.';toggleResultActions(false);return;}main.querySelector('#calculator-validation').textContent='';const rows=outputRows(result.outputs).filter(([path])=>!path.includes('schedule.')).slice(0,80);main.querySelector('#result-table').innerHTML=rows.map(([key,value])=>`<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(fmt(value))}</td></tr>`).join('');const primary=rows.find(([,value])=>typeof value==='number')??rows[0];main.querySelector('#result-primary').textContent=primary?`${primary[0]}: ${fmt(primary[1])}`:'Calculation complete';main.querySelector('#result-summary').textContent=`${selected.name} · ${result.truthState} · ${new Date(result.calculatedAt).toLocaleString()}`;main.querySelector('#result-evidence').textContent=pretty(result);toggleResultActions(true);toast(`${selected.name} calculated locally`,{tone:'success'});};
  search.addEventListener('input',renderList);domain.addEventListener('change',renderList);
  main.querySelector('[data-action="calculate"]').addEventListener('click',run);
  main.querySelector('[data-action="reset"]').addEventListener('click',()=>select(selected.formulaId));
  main.querySelector('[data-action="copy-input"]').addEventListener('click',async()=>{await navigator.clipboard.writeText(editor.value);toast('Input JSON copied',{tone:'success'});});
  main.querySelector('[data-action="save"]').addEventListener('click',()=>{const name=prompt('Name this local calculation',selected.name);if(!name)return;saveCalculation({name,result});toast('Saved in this browser only',{tone:'success'});});
  main.querySelector('[data-action="copy-result"]').addEventListener('click',async()=>{await navigator.clipboard.writeText(pretty(result));toast('Evidence result copied',{tone:'success'});});
  main.querySelector('[data-action="share"]').addEventListener('click',async()=>{const encoded=encodeShareState({formulaId:selected.formulaId,inputs:JSON.parse(editor.value),formulaVersion:selected.version});const url=new URL(location.href);url.searchParams.set('calc',encoded);await navigator.clipboard.writeText(url.toString());toast('Share URL copied; no account data included',{tone:'success'});});
  main.querySelector('[data-action="export-json"]').addEventListener('click',()=>download(`qelly-${selected.formulaId}.json`,pretty(result)));
  main.querySelector('[data-action="export-csv"]').addEventListener('click',()=>download(`qelly-${selected.formulaId}.csv`,resultToCsv(result),'text/csv'));
  main.querySelector('[data-action="formula-library"]').addEventListener('click',()=>navigate('formula-library'));
  main.querySelector('[data-action="saved"]').addEventListener('click',()=>navigate('saved-calculations'));
  const shared=new URL(location.href).searchParams.get('calc');if(shared){try{const {decodeShareState}=await import('../calculation/persistence.mjs');const state=decodeShareState(shared);if(state.formulaId){selected=definitions.find(item=>item.formulaId===state.formulaId)??selected;select(selected.formulaId);editor.value=pretty(state.inputs??{});}}catch(error){toast(`Share state could not be loaded: ${error.message}`,{tone:'danger'});}}
  select(selected.formulaId);
}
