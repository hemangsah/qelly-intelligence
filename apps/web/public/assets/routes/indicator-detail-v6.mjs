import {renderIndicatorDetail as renderLegacyIndicatorDetail} from './indicator-detail.mjs';
import {getIndicatorDefinition} from '../calculation/indicator-engine-extended.mjs';
import {listSavedCalculations} from '../calculation/persistence.mjs';
import {syncSavedCalculationIfOptedIn} from '../calculation/connected-save.mjs';

const QUANT_V6_STYLESHEET=new URL('../qelly-v6-quant-workbench.css',import.meta.url).href;
function ensureStyles(){if(document.querySelector('link[data-qelly-v6-quant-workbench="active"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href=QUANT_V6_STYLESHEET;link.dataset.qellyV6QuantWorkbench='active';document.head.append(link);}
const versionOf=(definition)=>definition.version||definition.indicatorVersion||'registered';

function enhanceSemantics(main,definition,escapeHtml){
  main.querySelector('.q-indicator-detail-page')?.classList.add('q-indicator-workbench-page');
  const source=definition.referenceVector?.inputs?'GOVERNED REFERENCE VECTOR':'PRESENTATION SAMPLE';
  const banner=main.querySelector('.q-indicator-detail-page > .q-state-banner.is-simulated');
  if(banner){
    banner.className='q-v6-indicator-truth';
    const status=banner.querySelector('.q-status');if(status){status.className='q-status q-status--deterministic';status.textContent=`${source} · DETERMINISTIC`;}
    const copy=banner.querySelector('p');if(copy)copy.textContent='The indicator engine is deterministic, but the detail-page input shown here is engine evidence rather than a live market feed. It must not be interpreted as a current quote, recommendation or execution signal.';
  }
  const detailGrid=main.querySelector('.q-indicator-detail-grid');
  if(detailGrid&&!main.querySelector('.q-v6-quant-kpis')){
    const kpis=document.createElement('section');kpis.className='q-v6-quant-kpis';kpis.setAttribute('aria-label','Indicator method evidence');
    kpis.innerHTML=`<div><span>Indicator ID</span><strong>${escapeHtml(definition.indicatorId)}</strong><small>stable method identity</small></div><div><span>Version</span><strong>${escapeHtml(String(versionOf(definition)))}</strong><small>engine definition</small></div><div><span>Required fields</span><strong>${definition.requiredFields?.length||0}</strong><small>${escapeHtml((definition.requiredFields||[]).join(' · ')||'none')}</small></div><div><span>Evidence input</span><strong>${escapeHtml(source)}</strong><small>not an implicit live feed</small></div><div><span>Execution</span><strong>OFF</strong><small>descriptive analysis only</small></div>`;
    detailGrid.before(kpis);
  }
  main.querySelectorAll('.q-indicator-detail-page .q-status--simulated').forEach((status)=>{status.classList.remove('q-status--simulated');status.classList.add('q-status--deterministic');if(status.textContent.trim()==='SIMULATED')status.textContent='DETERMINISTIC SAMPLE';});
  const sample=main.querySelector('.q-indicator-sample .q-panel-body');
  if(sample&&!sample.querySelector('.q-v6-cloud-save-note')){
    const note=document.createElement('div');note.className='q-v6-cloud-save-note';note.textContent='Save preserves the deterministic engine result locally. When cloud synchronization is opted in, the exact saved record is synchronized or safely queued; the sample input itself is not promoted to live market data.';sample.append(note);
  }
}

function installCloudSaveBridge(main,{api,toast}){
  if(main.__qellyV6IndicatorSaveListener)main.removeEventListener('click',main.__qellyV6IndicatorSaveListener);
  const listener=async(event)=>{
    const target=event.target?.closest?.('[data-action="save"]');if(!target||!main.contains(target))return;
    await Promise.resolve();
    const item=listSavedCalculations({sort:'updated-desc'})[0];if(!item)return;
    const outcome=await syncSavedCalculationIfOptedIn({api,item});
    if(outcome.state==='CLOUD')toast(outcome.message,{tone:'success'});
    else if(outcome.state==='QUEUED')toast(outcome.message,{tone:'neutral'});
    else if(outcome.state==='CONFLICT')toast(outcome.message,{tone:'danger'});
  };
  main.__qellyV6IndicatorSaveListener=listener;main.addEventListener('click',listener);
}

export async function renderIndicatorDetailV6(main,deps){
  ensureStyles();
  await renderLegacyIndicatorDetail(main,deps);
  if(!deps.id)return;
  let definition;try{definition=getIndicatorDefinition(deps.id);}catch{return;}
  enhanceSemantics(main,definition,deps.escapeHtml);
  installCloudSaveBridge(main,deps);
}

export const __indicatorDetailV6Test=Object.freeze({versionOf});
