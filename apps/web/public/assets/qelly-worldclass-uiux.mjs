import {routeDefinitions,domainForRoute,productDomains} from './route-registry.mjs';

const main=document.querySelector('#main');
const root=document.documentElement;
const routeByKey=new Map(routeDefinitions.map(item=>[item.route,item]));
const domainById=new Map(productDomains.map(item=>[item.id,item]));
const relatedByDomain=new Map();
for(const route of routeDefinitions){
  if(route.hidden)continue;
  const bucket=relatedByDomain.get(route.domain)??[];
  bucket.push(route);
  relatedByDomain.set(route.domain,bucket);
}

const prompt2bTruth={
  'calculator-center':{purpose:'Run deterministic financial calculations from user-entered inputs, inspect methodology and retain evidence without an external provider.',source:'User-entered inputs · deterministic local engine',status:'Deterministic local',tone:'deterministic',assumptions:'Inputs are authoritative; no market feed, broker or personalized recommendation is used.',limitations:'Results depend on supplied assumptions and formula version.',method:'Versioned formula catalog with reproducible outputs.',related:['formula-library','saved-calculations','india-finance']},
  'india-finance':{purpose:'Model SIP, lumpsum, tax and charge scenarios while clearly separating user-entered rates from unavailable official rules.',source:'User-entered values · effective-dated rule state',status:'User entered / unavailable',tone:'user',assumptions:'Official rates are never inferred when an effective-dated primary source is unavailable.',limitations:'Not tax, legal or investment advice; verify current rules independently.',method:'Deterministic scenario mathematics with explicit rule-state labels.',related:['calculator-center','formula-library','saved-calculations']},
  'formula-library':{purpose:'Discover all 151 deterministic formulas, compare contracts and open complete versioned methodology.',source:'151 versioned local formulas',status:'Deterministic catalog',tone:'deterministic',assumptions:'Definitions and vectors are repository-governed.',limitations:'No provider-dependent or autonomous execution capability.',method:'50 foundation formulas plus 101 fresh reimplementations with new provenance.',related:['calculator-center','formula-detail','indicator-library']},
  'formula-detail':{purpose:'Inspect one formula’s inputs, outputs, assumptions, evidence, version and reference vector before calculating or saving.',source:'FRESH_REIMPLEMENTATION_2026 or governed foundation',status:'Versioned deterministic',tone:'deterministic',assumptions:'The displayed formula contract controls validation and output units.',limitations:'Historical missing-module continuity is not claimed.',method:'Reference, property, fuzz and browser/server parity governed by stable ID.',related:['formula-library','calculator-detail','saved-calculations']},
  'indicator-library':{purpose:'Run and compare all 54 deterministic indicators against user-provided OHLCV series with aligned output evidence.',source:'User-provided OHLCV · 54 local indicators',status:'Deterministic local',tone:'deterministic',assumptions:'Series alignment and minimum history requirements must be satisfied.',limitations:'No live order book, exchange, wallet or external indicator API.',method:'20 foundation indicators plus 34 fresh reimplementations with deterministic series output.',related:['indicator-detail','formula-library','saved-calculations']},
  'indicator-detail':{purpose:'Inspect one indicator’s required series, output contract, history requirements, provenance and methodology before execution.',source:'FRESH_REIMPLEMENTATION_2026 or governed foundation',status:'Versioned deterministic',tone:'deterministic',assumptions:'OHLCV inputs are user-provided and length-aligned.',limitations:'Insufficient history returns an explicit validation state; no provider fallback.',method:'Stable-ID engine with reference, property, fuzz, performance and parity checks.',related:['indicator-library','calculator-center','saved-calculations']},
  'calculator-detail':{purpose:'Execute a selected formula in a focused workspace, review evidence and save or share the resulting deterministic record.',source:'User-entered inputs · versioned local formula',status:'Deterministic local',tone:'deterministic',assumptions:'The active formula schema defines required fields and valid domains.',limitations:'No broker, exchange or provider execution is connected.',method:'Validated formula adapter with reproducible evidence envelope.',related:['formula-detail','calculator-center','saved-calculations']},
  'saved-calculations':{purpose:'Search, filter, import, export and reopen browser-local calculation evidence with explicit cloud-unavailable truth.',source:'Browser-local saved records',status:'Local persistence',tone:'user',assumptions:'The current browser profile is the active persistence boundary.',limitations:'Production cloud synchronization is unavailable in Prompt 2B.',method:'Versioned JSON schema with safe import, export and migration behavior.',related:['saved-calculation-detail','calculator-center','formula-library']},
  'saved-calculation-detail':{purpose:'Review a saved evidence record, update metadata, inspect revisions, restore history and create compact share state.',source:'Browser-local evidence · revision metadata',status:'Saved locally',tone:'user',assumptions:'Restores create a new revision rather than rewriting history.',limitations:'Shared URLs are compact evidence packages; cloud collaboration is unavailable.',method:'Versioned lifecycle with duplicate, delete, revision restore, import, export and share.',related:['saved-calculations','calculator-detail','formula-detail']}
};

const generalByKind={
  analytical:{source:'Configured application data source',status:'Evidence state shown in route',tone:'user',assumptions:'Source, freshness and confidence labels remain authoritative.',limitations:'Unavailable providers remain unavailable rather than silently simulated.',method:'Route-specific analytical workflow with evidence-first presentation.'},
  research:{source:'Repository-governed research evidence',status:'Read-only research',tone:'user',assumptions:'Citations and effective dates define the evidence boundary.',limitations:'Research views do not execute transactions.',method:'Source-linked research and decision provenance.'},
  operational:{source:'Repository and service-state evidence',status:'Operational evidence',tone:'user',assumptions:'Environment and service state are reported explicitly.',limitations:'Controls do not imply production deployment.',method:'Scoped operational workflow with audit and isolation boundaries.'},
  access:{source:'Local demonstration identity boundary',status:'Authentication demo',tone:'simulated',assumptions:'No production credential is requested by the static preview.',limitations:'Production identity provider behavior is not represented as connected.',method:'Accessible account and recovery workflow specification.'},
  'public-story':{source:'Repository-governed product narrative',status:'Read-only',tone:'user',assumptions:'Implemented and planned capabilities are distinguished.',limitations:'Narrative content is not execution evidence.',method:'Product-truth presentation mapped to runtime routes.'}
};

const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const parseHash=()=>{
  const raw=(location.hash||'#/feature-universe').replace(/^#\/?/,'');
  const [pathPart,query='']=raw.split('?');
  const [route,...segments]=pathPart.split('/').filter(Boolean);
  return {route:route||'feature-universe',segments,query:new URLSearchParams(query)};
};
const inferPurpose=(route,definition)=>{
  const copy=main.querySelector('.q-page-head p:not(.q-eyebrow), .q-page>p, main p');
  const text=(copy?.textContent??'').trim();
  if(text.length>=24&&text.length<=280)return text;
  return `Use ${definition?.label??route} within Qelly’s evidence-backed ${domainById.get(definition?.domain)?.label?.toLowerCase()??'intelligence'} workspace.`;
};
const hrefFor=route=>`#/${route}`;
const relationLinks=(current,domain,preferred=[])=>{
  const keys=[...preferred,...(relatedByDomain.get(domain)??[]).map(item=>item.route)]
    .filter((value,index,array)=>value!==current&&array.indexOf(value)===index)
    .slice(0,3);
  return keys.map(key=>{const item=routeByKey.get(key);return `<a href="${hrefFor(key)}">${escapeHtml(item?.label??key.replaceAll('-',' '))}</a>`;}).join('');
};
const currentState=()=>document.querySelector('#state-selector')?.value??'default';
const enhance=()=>{
  if(!main||main.getAttribute('aria-busy')==='true'||!main.firstElementChild)return;
  const {route}=parseHash();
  const definition=routeByKey.get(route)??{route,label:route.replaceAll('-',' '),domain:domainForRoute(route),kind:'analytical'};
  if(main.dataset.worldclassRoute===route&&main.querySelector(':scope > .q-worldclass-context'))return;
  main.querySelector(':scope > .q-worldclass-context')?.remove();
  const domain=domainById.get(definition.domain)??{label:definition.domain??'Workspace',defaultRoute:'feature-universe'};
  const specific=prompt2bTruth[route];
  const base=generalByKind[definition.kind]??generalByKind.analytical;
  const truth={...base,...specific};
  const context=document.createElement('section');
  context.className='q-worldclass-context';
  context.setAttribute('aria-label','Route context and product truth');
  context.dataset.route=route;
  context.innerHTML=`
    <div class="q-worldclass-context__main">
      <nav class="q-worldclass-breadcrumb" aria-label="Breadcrumb">
        <a href="#/feature-universe">Qelly</a><span aria-hidden="true">/</span>
        <a href="${hrefFor(domain.defaultRoute??route)}">${escapeHtml(domain.label)}</a><span aria-hidden="true">/</span>
        <span aria-current="page">${escapeHtml(definition.label)}</span>
      </nav>
      <p class="q-worldclass-purpose">${escapeHtml(specific?.purpose??inferPurpose(route,definition))}</p>
      <div class="q-worldclass-truth" aria-label="Data and truth state">
        <span class="q-worldclass-truth-chip" data-tone="${escapeHtml(truth.tone)}">${escapeHtml(truth.status)}</span>
        <span class="q-worldclass-truth-chip" data-tone="user">${escapeHtml(truth.source)}</span>
        <span class="q-worldclass-truth-chip" data-tone="${currentState()==='offline'?'unavailable':'user'}">State: ${escapeHtml(currentState())}</span>
      </div>
    </div>
    <div class="q-worldclass-context__aside">
      <div class="q-worldclass-related" aria-label="Related tools">${relationLinks(route,definition.domain,specific?.related)}</div>
      <details class="q-worldclass-method">
        <summary>Method & limits</summary>
        <div class="q-worldclass-method__panel">
          <dl>
            <dt>Method</dt><dd>${escapeHtml(truth.method)}</dd>
            <dt>Assumptions</dt><dd>${escapeHtml(truth.assumptions)}</dd>
            <dt>Limitations</dt><dd>${escapeHtml(truth.limitations)}</dd>
            <dt>Primary action</dt><dd>${escapeHtml(main.querySelector('[data-action],.q-button--primary')?.textContent?.trim()||'Review the route evidence and available controls.')}</dd>
          </dl>
        </div>
      </details>
    </div>`;
  main.prepend(context);
  main.dataset.worldclassRoute=route;
  root.dataset.worldclassReady='true';
  root.dataset.previewState=currentState();
};
let queued=false;
const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;enhance();});};
new MutationObserver(schedule).observe(main,{childList:true,subtree:false,attributes:true,attributeFilter:['aria-busy']});
window.addEventListener('hashchange',()=>{delete main.dataset.worldclassRoute;schedule();});
document.querySelector('#state-selector')?.addEventListener('change',()=>{delete main.dataset.worldclassRoute;schedule();});
schedule();
