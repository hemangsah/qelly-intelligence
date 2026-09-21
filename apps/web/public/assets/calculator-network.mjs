import {calculateFormula} from './calculation/formula-engine-extended.mjs';
import {mountAdSlots} from './qelly-ad-slot.mjs';

const config=JSON.parse(document.querySelector('#q-calculator-config')?.textContent||'{}');
const form=document.querySelector('[data-calculator-form]');
const result=document.querySelector('[data-calculator-result]');
const status=document.querySelector('[data-calculator-status]');
const humanize=(value)=>String(value).replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[-_]+/g,' ').replace(/^./,letter=>letter.toUpperCase());
const parse=(element,schema)=>{if(schema.type==='boolean')return element.checked;if(schema.type==='number')return Number(element.value);if(schema.type==='array'||schema.type==='object')return JSON.parse(element.value);return element.value;};
const format=(value)=>typeof value==='number'?new Intl.NumberFormat(undefined,{maximumFractionDigits:6}).format(value):value==null?'Not available':typeof value==='object'?JSON.stringify(value):String(value);
const emit=(type)=>document.dispatchEvent(new CustomEvent('qelly:calculator-event',{detail:{type,calculator:config.slug}}));
const node=(tag,{className,text,attributes}={})=>{
  const element=document.createElement(tag);
  if(className)element.className=className;
  if(text!=null)element.textContent=String(text);
  for(const [name,value] of Object.entries(attributes||{})){if(value!=null)element.setAttribute(name,String(value));}
  return element;
};

function fieldFor(key,schema){
  const value=config.example[key];
  const id=`calc-${key}`;
  if(schema.type==='boolean'){
    const label=node('label',{className:'q-cn-check',attributes:{for:id}});
    const input=node('input',{attributes:{id,name:key,type:'checkbox'}});
    input.checked=Boolean(value);
    label.append(input,node('span',{text:schema.title||humanize(key)}));
    return label;
  }

  const label=node('label',{attributes:{for:id}});
  const title=schema.title||humanize(key);
  label.append(node('span',{text:`${title}${schema.unit?` · ${schema.unit}`:''}`}));
  let control;

  if(Array.isArray(schema.enum)){
    control=node('select',{attributes:{id,name:key}});
    for(const item of schema.enum){
      const option=node('option',{text:item,attributes:{value:item}});
      option.selected=String(item)===String(value);
      control.append(option);
    }
  }else if(schema.type==='array'||schema.type==='object'){
    control=node('textarea',{attributes:{id,name:key,rows:'3'}});
    control.value=JSON.stringify(value);
  }else{
    control=node('input',{attributes:{id,name:key,type:schema.type==='number'?'number':'text'}});
    control.value=value??'';
    if(schema.type==='number')control.step='any';
  }

  label.append(control,node('small',{text:schema.description||''}));
  return label;
}

function mountFields(){
  const fragment=document.createDocumentFragment();
  for(const [key,schema] of Object.entries(config.schema.properties||{}))fragment.append(fieldFor(key,schema));
  form.replaceChildren(fragment);
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
function renderOutputs(outputs){
  const fragment=document.createDocumentFragment();
  for(const [key,value] of Object.entries(outputs||{})){
    const article=node('article');
    article.append(node('span',{text:humanize(key)}),node('strong',{text:format(value)}));
    fragment.append(article);
  }
  result.replaceChildren(fragment);
}
function renderError(error){
  const message=node('p',{className:'q-cn-error',text:String(error?.message||error),attributes:{role:'alert'}});
  result.replaceChildren(message);
}
function calculate(){
  try{
    const inputs=collectInputs();
    const receipt=calculateFormula(config.formulaId,inputs);
    if(receipt.status!=='success')throw new Error(receipt.validationErrors?.[0]?.message||'Check the inputs.');
    renderOutputs(receipt.outputs);
    status.textContent=`Calculated locally · ${receipt.formulaVersion} · ${new Date(receipt.calculatedAt).toLocaleString()}`;
    status.dataset.state='success';
    emit('calculation_completed');
  }catch(error){
    renderError(error);
    status.textContent='Result unavailable until every input is valid.';
    status.dataset.state='error';
  }
}

mountFields();
const loadedSharedState=loadSharedInputs();
form.addEventListener('submit',event=>{event.preventDefault();calculate();});
let timer;form.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(calculate,160);});
document.querySelector('[data-reset]')?.addEventListener('click',()=>{history.replaceState(null,'',location.pathname+location.search);form.reset();calculate();});
document.querySelector('[data-share]')?.addEventListener('click',async()=>{try{const url=shareUrl(collectInputs());if(navigator.share)await navigator.share({title:document.title,url});else await navigator.clipboard.writeText(url);status.textContent='Share link ready · inputs are stored only in the URL fragment, not on QELLY servers.';status.dataset.state='success';emit('share');}catch(error){status.textContent=error?.message||'Share is unavailable in this browser.';status.dataset.state='error';}});
document.querySelectorAll('[data-related]').forEach(link=>link.addEventListener('click',()=>emit('related_calculator_click')));
mountAdSlots(document);emit('calculator_page_view');calculate();
if(loadedSharedState){status.textContent='Loaded shared inputs from this URL fragment · calculation remains local.';status.dataset.state='success';}
