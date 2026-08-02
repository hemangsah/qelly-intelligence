import {calculateFormula,getFormulaDefinition} from '../calculation/formula-engine-extended.mjs';
import {saveCalculation,encodeShareState,decodeShareState,resultToCsv} from '../calculation/persistence.mjs';

const download=(name,content,type)=>{const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),0);};
const humanize=(value)=>String(value??'').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[-_]+/g,' ').replace(/^./,(character)=>character.toUpperCase());
const unitFor=(key,schema={})=>schema.unit||schema.units||(/percent|rate|probability|utilization|margin/i.test(key)?'%':/price|value|amount|notional|equity|fees|cost|principal|payment|income|salary|target|entry|stop/i.test(key)?'currency':/years|tenure/i.test(key)?'years':/months/i.test(key)?'months':/days/i.test(key)?'days':/quantity|units|contracts|shares/i.test(key)?'units':'');
const typeFor=(schema,value)=>schema?.type||(Array.isArray(value)?'array':value===null?'string':typeof value);
const precision=(value)=>Number.isInteger(Number(value))?0:Math.abs(Number(value))>=100?2:6;
const formatValue=(value)=>typeof value==='number'?value.toLocaleString(undefined,{maximumFractionDigits:precision(value)}):Array.isArray(value)?value.join(', '):value&&typeof value==='object'?JSON.stringify(value):String(value??'—');

function fieldDefinitions(definition,inputs){
  const schema=definition.inputSchema||{};
  const properties=schema.properties||{};
  const keys=[...new Set([...Object.keys(properties),...Object.keys(inputs||{})])];
  const required=new Set(schema.required||keys.filter((key)=>inputs?.[key]!==undefined));
  return keys.map((key)=>({key,schema:properties[key]||{},value:inputs?.[key],required:required.has(key),type:typeFor(properties[key],inputs?.[key])}));
}

function serializeField(field,value){
  if(value===''&&!field.required)return undefined;
  if(field.type==='number'||field.type==='integer'){const parsed=Number(value);return Number.isFinite(parsed)?parsed:value;}
  if(field.type==='boolean')return value==='true';
  if(field.type==='array'){try{return JSON.parse(value);}catch{return String(value).split(',').map((item)=>item.trim()).filter(Boolean).map((item)=>Number.isFinite(Number(item))?Number(item):item);}}
  if(field.type==='object'){try{return JSON.parse(value);}catch{return value;}}
  return value;
}

function renderField(field,escapeHtml){
  const {key,schema,value,required,type}=field,unit=unitFor(key,schema),label=schema.title||humanize(key),description=schema.description||`Enter ${label.toLowerCase()}.`,id=`calculator-field-${key.replace(/[^a-z0-9_-]/gi,'-')}`;
  const meta=[required?'Required':'Optional',unit].filter(Boolean).join(' · ');
  let control='';
  if(Array.isArray(schema.enum))control=`<select id="${id}" name="${escapeHtml(key)}" data-structured-field data-field-type="${escapeHtml(type)}" ${required?'required':''}>${schema.enum.map((option)=>`<option value="${escapeHtml(option)}" ${String(option)===String(value)?'selected':''}>${escapeHtml(humanize(option))}</option>`).join('')}</select>`;
  else if(type==='boolean')control=`<select id="${id}" name="${escapeHtml(key)}" data-structured-field data-field-type="boolean" ${required?'required':''}><option value="true" ${value===true?'selected':''}>Yes</option><option value="false" ${value===false?'selected':''}>No</option></select>`;
  else if(type==='array'||type==='object')control=`<textarea id="${id}" name="${escapeHtml(key)}" data-structured-field data-field-type="${escapeHtml(type)}" rows="4" ${required?'required':''}>${escapeHtml(JSON.stringify(value??(type==='array'?[]:{}),null,2))}</textarea>`;
  else control=`<input id="${id}" name="${escapeHtml(key)}" data-structured-field data-field-type="${escapeHtml(type)}" type="${type==='number'||type==='integer'?'number':'text'}" value="${escapeHtml(value??'')}" ${type==='number'||type==='integer'?`step="${escapeHtml(schema.multipleOf||'any')}"`:''} ${schema.minimum!=null?`min="${escapeHtml(schema.minimum)}"`:''} ${schema.maximum!=null?`max="${escapeHtml(schema.maximum)}"`:''} ${required?'required':''} placeholder="${escapeHtml(schema.example??value??'')}">`;
  return `<label class="q-structured-field ${type==='array'||type==='object'?'is-wide':''}" for="${id}"><span class="q-structured-field__label"><span>${escapeHtml(label)}</span><span class="q-structured-field__meta">${escapeHtml(meta)}</span></span>${control}<small>${escapeHtml(description)}${schema.minimum!=null||schema.maximum!=null?` Allowed range: ${schema.minimum??'any'} to ${schema.maximum??'any'}.`:''}</small><small class="q-structured-field__error" data-field-error="${escapeHtml(key)}" aria-live="polite"></small></label>`;
}

export async function renderCalculatorDetail(main,{pageHead,escapeHtml,toast,navigate,id,query}){
  let definition;
  try{definition=getFormulaDefinition(id);}catch{navigate('calculator-center');return;}
  const reference=structuredClone(definition.referenceVector?.inputs??{});
  let initialInputs=structuredClone(reference),sharedState=false,sharedError='';
  const encoded=query?.get?.('state');
  if(encoded){try{const decoded=decodeShareState(encoded);if(decoded?.formulaId!==definition.formulaId)throw new Error('This shared calculation belongs to a different formula.');initialInputs=decoded.inputs??{};sharedState=true;}catch(error){sharedError=error.message;}}
  const fields=fieldDefinitions(definition,initialInputs);
  main.innerHTML=`<section class="q-page q-calculator-detail-page">
    ${pageHead('Deterministic calculator','Calculator',definition.name,`<button class="q-button q-button--ghost" data-action="method">Methodology</button>`)}
    <div class="q-state-banner is-simulated"><span class="q-status q-status--simulated">DETERMINISTIC</span><p>${sharedState?'Shared inputs restored. ':''}Calculations run locally using the documented Qelly formula. No provider, broker or exchange call is made.</p></div>
    <section class="q-structured-calculator">
      <article class="q-panel"><div class="q-panel-head"><div><p class="q-eyebrow">Structured inputs</p><h2>Enter calculation details</h2><p>Fields, units and validation are generated from the formula contract.</p></div></div><div class="q-panel-body">
        <form id="calculator-structured-form" class="q-structured-fields" novalidate>${fields.length?fields.map((field)=>renderField(field,escapeHtml)).join(''):'<div class="q-result-empty is-wide"><p>This formula uses an advanced input structure. Open Advanced JSON to enter its documented input object.</p></div>'}</form>
        <div id="calculator-detail-errors" class="q-form-errors" role="alert" aria-live="polite">${sharedError?escapeHtml(`Shared state rejected: ${sharedError}`):''}</div>
        <div class="q-actions"><button class="q-button q-button--primary" data-action="calculate">Calculate</button><button class="q-button q-button--secondary" data-action="reference">Load example</button><button class="q-button q-button--ghost" data-action="reset">Reset</button><button class="q-button q-button--ghost" data-action="center">All calculators</button></div>
        <details class="q-advanced-json"><summary>Advanced JSON</summary><p class="q-muted-copy">Use this editor for complex or programmatic inputs. Applying JSON updates the structured fields where possible.</p><label class="q-field"><span>Input object</span><textarea id="calculator-detail-input" rows="14" spellcheck="false">${escapeHtml(JSON.stringify(initialInputs,null,2))}</textarea></label><button class="q-button q-button--secondary" type="button" data-action="apply-json">Apply JSON to fields</button></details>
      </div></article>
      <article class="q-panel q-calculator-result-panel"><div class="q-panel-head"><div><p class="q-eyebrow">Calculation result</p><h2 id="calculator-detail-primary">Ready to calculate</h2><p id="calculator-detail-summary">Complete the required fields, then select Calculate.</p></div><span class="q-status q-status--simulated">LOCAL</span></div><div class="q-panel-body"><div id="calculator-detail-evidence" class="q-result-empty"><p>No result yet.<br>Results, units and validation details will appear here.</p></div><div class="q-actions"><button class="q-button q-button--secondary" data-action="save" disabled>Save</button><button class="q-button q-button--ghost" data-action="copy" disabled>Copy</button><button class="q-button q-button--ghost" data-action="json" disabled>Export JSON</button><button class="q-button q-button--ghost" data-action="csv" disabled>Export CSV</button><button class="q-button q-button--ghost" data-action="share" disabled>Copy share URL</button></div><details><summary>Method and assumptions</summary><div class="q-methodology"><p>${escapeHtml(definition.description)}</p><ul>${(definition.assumptions??[]).map((item)=>`<li>${escapeHtml(item)}</li>`).join('')||'<li>User inputs are authoritative and outputs are deterministic.</li>'}</ul></div></details></div></article>
    </section>
  </section>`;
  let result=null,input=null;
  const form=main.querySelector('#calculator-structured-form'),editor=main.querySelector('#calculator-detail-input'),errors=main.querySelector('#calculator-detail-errors'),evidence=main.querySelector('#calculator-detail-evidence'),primary=main.querySelector('#calculator-detail-primary'),summary=main.querySelector('#calculator-detail-summary');
  const actionButtons=()=>main.querySelectorAll('[data-action="save"],[data-action="copy"],[data-action="json"],[data-action="csv"],[data-action="share"]');
  const enableActions=(enabled)=>actionButtons().forEach((button)=>button.disabled=!enabled);
  const clearFieldErrors=()=>main.querySelectorAll('[data-field-error]').forEach((element)=>element.textContent='');
  const readStructured=()=>{const values={};for(const field of fields){const control=form.elements[field.key];if(!control)continue;const value=serializeField(field,control.value);if(value!==undefined)values[field.key]=value;}return values;};
  const updateStructured=(values)=>{for(const field of fields){const control=form.elements[field.key];if(!control||values[field.key]===undefined)continue;control.value=field.type==='array'||field.type==='object'?JSON.stringify(values[field.key],null,2):String(values[field.key]);}editor.value=JSON.stringify(values,null,2);};
  const renderOutputs=(calculation)=>{const units=calculation.outputUnits||{};const entries=Object.entries(calculation.outputs||{});evidence.className='q-calculation-result-list';evidence.innerHTML=entries.length?entries.map(([key,value])=>`<div class="q-calculation-result"><span>${escapeHtml(humanize(key))}${units[key]?` · ${escapeHtml(units[key])}`:''}</span><strong>${escapeHtml(formatValue(value))}</strong></div>`).join(''):'<div class="q-result-empty"><p>The formula completed without displayable outputs.</p></div>';const first=entries.find(([,value])=>typeof value==='number')??entries[0];primary.textContent=first?humanize(first[0]):'Calculated';summary.textContent=first?`${formatValue(first[1])}${units[first[0]]?` ${units[first[0]]}`:''}`:'Calculation completed';};
  const run=({announce=true,source='structured'}={})=>{
    clearFieldErrors();errors.textContent='';
    if(source==='json'){try{input=JSON.parse(editor.value);updateStructured(input);}catch(error){errors.textContent=`Advanced JSON is invalid: ${error.message}`;enableActions(false);return;}}
    else{if(!form.reportValidity()){errors.textContent='Complete the required fields and correct the highlighted values.';enableActions(false);return;}input=readStructured();editor.value=JSON.stringify(input,null,2);}
    result=calculateFormula(definition.formulaId,input);
    if(result.status!=='success'){
      const issues=result.validationErrors||[];for(const issue of issues){const fieldError=main.querySelector(`[data-field-error="${CSS.escape(issue.field||'')}"]`);if(fieldError)fieldError.textContent=issue.message;const control=form.elements[issue.field];control?.setAttribute('aria-invalid','true');}
      errors.innerHTML=issues.map((item)=>`<p><strong>${escapeHtml(humanize(item.field??'Input'))}:</strong> ${escapeHtml(item.message)}</p>`).join('')||'<p>Review the inputs and calculate again.</p>';primary.textContent='Check your inputs';summary.textContent='The formula did not run because one or more inputs are invalid.';evidence.className='q-result-empty';evidence.innerHTML='<p>Correct the highlighted fields to generate a result.</p>';enableActions(false);return;
    }
    form.querySelectorAll('[aria-invalid]').forEach((element)=>element.removeAttribute('aria-invalid'));renderOutputs(result);enableActions(true);if(announce)toast(`${definition.name} calculated locally`,{tone:'success'});
  };
  main.querySelector('[data-action="calculate"]').addEventListener('click',()=>run());
  main.querySelector('[data-action="reference"]').addEventListener('click',()=>{updateStructured(reference);errors.textContent='Example values loaded. Review them before calculating.';});
  main.querySelector('[data-action="reset"]').addEventListener('click',()=>{updateStructured(initialInputs);result=null;input=null;clearFieldErrors();errors.textContent='';primary.textContent='Ready to calculate';summary.textContent='Complete the required fields, then select Calculate.';evidence.className='q-result-empty';evidence.innerHTML='<p>No result yet.<br>Results, units and validation details will appear here.</p>';enableActions(false);});
  main.querySelector('[data-action="apply-json"]').addEventListener('click',()=>run({source:'json'}));
  main.querySelector('[data-action="center"]').addEventListener('click',()=>navigate('calculator-center'));
  main.querySelector('[data-action="method"]').addEventListener('click',()=>navigate('formula-detail',definition.formulaId));
  main.querySelector('[data-action="save"]').addEventListener('click',()=>{saveCalculation({name:definition.name,result,tags:['calculator',definition.category??definition.domain]});toast('Calculation saved locally',{tone:'success'});});
  main.querySelector('[data-action="copy"]').addEventListener('click',async()=>{await navigator.clipboard?.writeText(JSON.stringify({name:definition.name,inputs:input,outputs:result.outputs,units:result.outputUnits},null,2));toast('Calculation copied',{tone:'success'});});
  main.querySelector('[data-action="json"]').addEventListener('click',()=>download(`qelly-${definition.formulaId}.json`,JSON.stringify(result,null,2),'application/json'));
  main.querySelector('[data-action="csv"]').addEventListener('click',()=>download(`qelly-${definition.formulaId}.csv`,resultToCsv(result),'text/csv'));
  main.querySelector('[data-action="share"]').addEventListener('click',async()=>{const encodedState=encodeShareState({formulaId:definition.formulaId,inputs:input});await navigator.clipboard?.writeText(`${location.origin}${location.pathname}#/calculator-detail/${definition.formulaId}?state=${encodedState}`);toast('Share URL copied',{tone:'success'});});
  if(sharedState&&!sharedError){updateStructured(initialInputs);run({announce:false});}
}
