import {renderCalculatorDetail as renderLegacyCalculatorDetail} from './calculator-detail.mjs';
import {getFormulaDefinition} from '../calculation/formula-engine-extended.mjs';
import {listSavedCalculations} from '../calculation/persistence.mjs';
import {syncSavedCalculationIfOptedIn} from '../calculation/connected-save.mjs';

const QUANT_V6_STYLESHEET=new URL('../qelly-v6-quant-workbench.css',import.meta.url).href;
function ensureStyles(){if(document.querySelector('link[data-qelly-v6-quant-workbench="active"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href=QUANT_V6_STYLESHEET;link.dataset.qellyV6QuantWorkbench='active';document.head.append(link);}
const countInputs=(definition)=>Object.keys(definition?.inputSchema?.properties||definition?.referenceVector?.inputs||{}).length;

function enhanceSemantics(main,definition,escapeHtml){
  main.querySelector('.q-calculator-detail-page')?.classList.add('q-calculator-workbench-page');
  const banner=main.querySelector('.q-calculator-detail-page > .q-state-banner.is-simulated');
  if(banner){
    banner.className='q-v6-deterministic-banner';
    const status=banner.querySelector('.q-status');if(status){status.className='q-status q-status--deterministic';status.textContent='DETERMINISTIC LOCAL';}
    const copy=banner.querySelector('p');if(copy)copy.textContent=`Calculations run locally from explicit inputs using the registered ${definition.formulaId} method. This is deterministic computation, not simulated market data, and no provider, broker or exchange call is made.`;
  }
  const resultStatus=main.querySelector('.q-calculator-result-panel .q-status');if(resultStatus){resultStatus.className='q-status q-status--deterministic';resultStatus.textContent='LOCAL ENGINE';}
  const workbench=main.querySelector('.q-structured-calculator');
  if(workbench&&!main.querySelector('.q-v6-quant-kpis')){
    const version=definition.version||definition.formulaVersion||'registered';
    const kpis=document.createElement('section');kpis.className='q-v6-quant-kpis';kpis.setAttribute('aria-label','Calculator method evidence');
    kpis.innerHTML=`<div><span>Formula ID</span><strong>${escapeHtml(definition.formulaId)}</strong><small>stable method identity</small></div><div><span>Version</span><strong>${escapeHtml(String(version))}</strong><small>method definition</small></div><div><span>Inputs</span><strong>${countInputs(definition)}</strong><small>structured contract fields</small></div><div><span>Engine</span><strong>LOCAL</strong><small>deterministic browser computation</small></div><div><span>Execution</span><strong>OFF</strong><small>analysis only</small></div>`;
    workbench.before(kpis);
  }
  const resultBody=main.querySelector('.q-calculator-result-panel .q-panel-body');
  if(resultBody&&!resultBody.querySelector('.q-v6-cloud-save-note')){
    const note=document.createElement('div');note.className='q-v6-cloud-save-note';note.textContent='Save always preserves a durable local record. If authenticated cloud synchronization is already opted in, that exact record is also synchronized or safely queued; conflicts are never silently overwritten.';resultBody.append(note);
  }
}

function installCloudSaveBridge(main,{api,toast}){
  if(main.__qellyV6CalculatorSaveListener)main.removeEventListener('click',main.__qellyV6CalculatorSaveListener);
  const listener=async(event)=>{
    const target=event.target?.closest?.('[data-action="save"]');if(!target||!main.contains(target))return;
    await Promise.resolve();
    const item=listSavedCalculations({sort:'updated-desc'})[0];if(!item)return;
    const outcome=await syncSavedCalculationIfOptedIn({api,item});
    if(outcome.state==='CLOUD')toast(outcome.message,{tone:'success'});
    else if(outcome.state==='QUEUED')toast(outcome.message,{tone:'neutral'});
    else if(outcome.state==='CONFLICT')toast(outcome.message,{tone:'danger'});
  };
  main.__qellyV6CalculatorSaveListener=listener;main.addEventListener('click',listener);
}

export async function renderCalculatorDetailV6(main,deps){
  ensureStyles();
  await renderLegacyCalculatorDetail(main,deps);
  if(!deps.id)return;
  let definition;try{definition=getFormulaDefinition(deps.id);}catch{return;}
  enhanceSemantics(main,definition,deps.escapeHtml);
  installCloudSaveBridge(main,deps);
}

export const __calculatorDetailV6Test=Object.freeze({countInputs});
