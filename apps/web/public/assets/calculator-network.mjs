import {calculateFormula} from './calculation/formula-engine-extended.mjs';
import {mountAdSlots} from './qelly-ad-slot.mjs';
import {collectPublicCalculatorInputs} from './calculation/public-calculator-inputs.mjs';
import {publicCalculatorExplanationDraft} from './calculation/public-calculator-explanation.mjs';

const config=JSON.parse(document.querySelector('#q-calculator-config')?.textContent||'{}');
const form=document.querySelector('[data-calculator-form]');
const result=document.querySelector('[data-calculator-result]');
const status=document.querySelector('[data-calculator-status]');
const explainButton=document.querySelector('[data-explain-result]'),explainStatus=document.querySelector('[data-explain-status]');
let explanationDraft=null,latestReceipt=null,lastPreparedDraft='';
const invalidateExplanation=()=>{explanationDraft=null;latestReceipt=null;if(explainButton)explainButton.disabled=true;if(explainStatus)explainStatus.textContent='';};
const humanize=(value)=>String(value).replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[-_]+/g,' ').replace(/^./,letter=>letter.toUpperCase());
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
    input.defaultChecked=input.checked;
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
      option.defaultSelected=option.selected;
      control.append(option);
    }
  }else if(schema.type==='array'||schema.type==='object'){
    control=node('textarea',{attributes:{id,name:key,rows:'3'}});
    control.value=JSON.stringify(value);
    control.defaultValue=control.value;
  }else{
    control=node('input',{attributes:{id,name:key,type:schema.type==='number'?'number':'text'}});
    control.value=value??'';
    control.defaultValue=control.value;
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
  return collectPublicCalculatorInputs(config.schema,key=>form.elements.namedItem(key));
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
    latestReceipt=receipt;explanationDraft=null;if(explainButton)explainButton.disabled=false;if(explainStatus)explainStatus.textContent='';
    status.textContent=`Calculated locally · ${receipt.formulaVersion} · ${new Date(receipt.calculatedAt).toLocaleString()}`;
    status.dataset.state='success';
    emit('calculation_completed');
    return true;
  }catch(error){
    invalidateExplanation();
    renderError(error);
    status.textContent='Result unavailable until every input is valid.';
    status.dataset.state='error';
    return false;
  }
}

mountFields();
const loadedSharedState=loadSharedInputs();
form.addEventListener('submit',event=>{event.preventDefault();calculate();});
let timer;form.addEventListener('input',()=>{invalidateExplanation();clearTimeout(timer);timer=setTimeout(calculate,160);});
explainButton?.addEventListener('click',()=>{
  if(!calculate()||!latestReceipt)return;
  try{explanationDraft=publicCalculatorExplanationDraft(latestReceipt);}
  catch(error){explainButton.disabled=true;explainStatus.textContent=error.message;return;}
  const input=document.querySelector('[data-q-ai-form] textarea');
  if(!input){explainStatus.textContent='Chat is still loading. Try again shortly.';return;}
  const current=input.value.trim();
  if(current&&input.value!==globalThis.__QELLY_CHAT_CONTEXT__?.prompt&&input.value!==lastPreparedDraft){explainStatus.textContent='Your unsent Chat draft was preserved. Clear its text, then choose Explain result again.';return;}
  document.dispatchEvent(new CustomEvent('qelly:open-ai',{detail:{prompt:explanationDraft,mode:'explain'}}));
  if(input.value!==explanationDraft){explainStatus.textContent='Your unsent Chat draft was preserved. Clear its text, then choose Explain result again.';return;}
  lastPreparedDraft=explanationDraft;explainStatus.textContent='Draft prepared locally. Review it in Chat; Send shares these inputs and this result with QELLY.';
});
document.querySelector('[data-reset]')?.addEventListener('click',()=>{history.replaceState(null,'',location.pathname+location.search);form.reset();calculate();});
document.querySelector('[data-share]')?.addEventListener('click',async()=>{try{const url=shareUrl(collectInputs());if(navigator.share)await navigator.share({title:document.title,url});else await navigator.clipboard.writeText(url);status.textContent='Share link ready · inputs are stored only in the URL fragment, not on QELLY servers.';status.dataset.state='success';emit('share');}catch(error){status.textContent=error?.message||'Share is unavailable in this browser.';status.dataset.state='error';}});
document.querySelectorAll('[data-related]').forEach(link=>link.addEventListener('click',()=>emit('related_calculator_click')));
mountAdSlots(document);emit('calculator_page_view');const initialCalculationSucceeded=calculate();
if(loadedSharedState&&initialCalculationSucceeded){status.textContent='Loaded shared inputs from this URL fragment · calculation remains local.';status.dataset.state='success';}
