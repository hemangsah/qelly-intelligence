import {calculateFormula} from './calculation/formula-engine-extended.mjs';
import {mountAdSlots} from './qelly-ad-slot.mjs';

const config=JSON.parse(document.querySelector('#q-calculator-config')?.textContent||'{}');
const form=document.querySelector('[data-calculator-form]');const result=document.querySelector('[data-calculator-result]');const status=document.querySelector('[data-calculator-status]');
const humanize=(value)=>String(value).replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[-_]+/g,' ').replace(/^./,letter=>letter.toUpperCase());
const parse=(element,schema)=>{if(schema.type==='boolean')return element.checked;if(schema.type==='number')return Number(element.value);if(schema.type==='array'||schema.type==='object')return JSON.parse(element.value);return element.value;};
const format=(value)=>typeof value==='number'?new Intl.NumberFormat(undefined,{maximumFractionDigits:6}).format(value):value==null?'Not available':typeof value==='object'?JSON.stringify(value):String(value);
const emit=(type)=>document.dispatchEvent(new CustomEvent('qelly:calculator-event',{detail:{type,calculator:config.slug}}));

function fields(){
  return Object.entries(config.schema.properties||{}).map(([key,schema])=>{const value=config.example[key];const id=`calc-${key}`;if(schema.enum)return `<label for="${id}"><span>${schema.title||humanize(key)}</span><select id="${id}" name="${key}">${schema.enum.map(item=>`<option value="${item}" ${String(item)===String(value)?'selected':''}>${item}</option>`).join('')}</select><small>${schema.description||''}</small></label>`;if(schema.type==='boolean')return `<label class="q-cn-check" for="${id}"><input id="${id}" name="${key}" type="checkbox" ${value?'checked':''}><span>${schema.title||humanize(key)}</span></label>`;const structured=schema.type==='array'||schema.type==='object';return `<label for="${id}"><span>${schema.title||humanize(key)}${schema.unit?` · ${schema.unit}`:''}</span>${structured?`<textarea id="${id}" name="${key}" rows="3">${JSON.stringify(value)}</textarea>`:`<input id="${id}" name="${key}" type="${schema.type==='number'?'number':'text'}" value="${value??''}" ${schema.type==='number'?'step="any"':''}>`}<small>${schema.description||''}</small></label>`;}).join('');
}
function collectInputs(){
  const inputs={};
  for(const [key,schema] of Object.entries(config.schema.properties||{})){const element=form.elements.namedItem(key);inputs[key]=parse(element,schema);}
  return inputs;
}
function applyInputs(inputs){
  if(!inputs||typeof inputs!=='object'||Array.isArray(inputs))return false;
  let applied=0;
  for(const [key,schema] of Object.entries(config.schema.properties||{})){
    if(!Object.prototype.hasOwnProperty.call(inputs,key))continue;
    const element=form.elements.namedItem(key);if(!element)continue;
    const value=inputs[key];
    if(schema.type==='boolean')element.checked=Boolean(value);
    else if(schema.type==='array'||schema.type==='object')element.value=JSON.stringify(value);
    else element.value=String(value??'');
    applied+=1;
  }
  return applied>0;
}
function loadSharedInputs(){
  const raw=location.hash.startsWith('#q=')?location.hash.slice(3):'';
  if(!raw||raw.length>8000)return false;
  try{return applyInputs(JSON.parse(decodeURIComponent(raw)));}catch{return false;}
}
function shareUrl(inputs){
  const encoded=encodeURIComponent(JSON.stringify(inputs));
  if(encoded.length>8000)throw new Error('These inputs are too large for a shareable URL. Export or copy them instead.');
  const url=new URL(location.href);url.hash=`q=${encoded}`;return url.toString();
}
function calculate(){
  try{const inputs=collectInputs();const receipt=calculateFormula(config.formulaId,inputs);if(receipt.status!=='success')throw new Error(receipt.validationErrors?.[0]?.message||'Check the inputs.');result.innerHTML=Object.entries(receipt.outputs||{}).map(([key,value])=>`<article><span>${humanize(key)}</span><strong>${format(value)}</strong></article>`).join('');status.textContent=`Calculated locally · ${receipt.formulaVersion} · ${new Date(receipt.calculatedAt).toLocaleString()}`;status.dataset.state='success';emit('calculation_completed');}catch(error){result.innerHTML=`<p class="q-cn-error" role="alert">${String(error.message||error)}</p>`;status.textContent='Result unavailable until every input is valid.';status.dataset.state='error';}
}
form.innerHTML=fields();
const loadedSharedState=loadSharedInputs();
form.addEventListener('submit',event=>{event.preventDefault();calculate();});
let timer;form.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(calculate,160);});
document.querySelector('[data-reset]')?.addEventListener('click',()=>{history.replaceState(null,'',location.pathname+location.search);form.reset();calculate();});
document.querySelector('[data-share]')?.addEventListener('click',async()=>{try{const url=shareUrl(collectInputs());if(navigator.share)await navigator.share({title:document.title,url});else await navigator.clipboard.writeText(url);status.textContent='Share link ready · inputs are stored only in the URL fragment, not on QELLY servers.';status.dataset.state='success';emit('share');}catch(error){status.textContent=error?.message||'Share is unavailable in this browser.';status.dataset.state='error';}});
document.querySelectorAll('[data-related]').forEach(link=>link.addEventListener('click',()=>emit('related_calculator_click')));
mountAdSlots(document);emit('calculator_page_view');calculate();
if(loadedSharedState){status.textContent='Loaded shared inputs from this URL fragment · calculation remains local.';status.dataset.state='success';}
