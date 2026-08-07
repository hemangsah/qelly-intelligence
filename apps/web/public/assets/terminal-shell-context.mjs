import {routeDefinitions} from './route-registry.mjs';
import {parseHashRoute} from './hash-route-state.mjs';

const CONTEXT_TYPE_BY_DOMAIN=Object.freeze({
  home:'Workspace',
  markets:'Instrument',
  tools:'Quant model',
  research:'Research',
  workspaces:'Workspace',
  evidence:'Decision',
  data:'Provider',
  operations:'Operations',
  account:'Organization',
  experience:'Workspace'
});

const clean=(value,fallback='Unavailable')=>{
  const text=String(value??'').trim();
  return text||fallback;
};
const shortSha=(value)=>{
  const sha=clean(value,'unresolved');
  return sha==='unresolved'?sha:sha.slice(0,8);
};
const titleCase=(value)=>clean(value).replace(/[-_]+/g,' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());
const html=(value)=>String(value??'').replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const routeContextType=(route)=>{
  if(route?.route?.startsWith('portfolio-'))return 'Portfolio';
  return CONTEXT_TYPE_BY_DOMAIN[route?.domain??'home']??titleCase(route?.kind??'Workspace');
};

export function deriveTerminalShellState({hash='',rootDataset={},config={},identity=null,staticVisualPreview=false}={}){
  const parsed=parseHashRoute(hash,{fallback:'market'});
  const route=routeDefinitions.find((item)=>item.route===parsed.route)??routeDefinitions.find((item)=>item.route==='market');
  const shell=identity?.shell??{};
  const asset=parsed.asset??null;
  const evidence=staticVisualPreview
    ? {source:'Qelly deterministic demonstration',freshness:'Simulated',confidence:'Not assessed'}
    : {source:'Panel-owned evidence',freshness:'Inspect panel',confidence:'Inspect evidence'};
  const capabilities=config?.capabilityTruth??{};
  const runtime=config?.runtime??{};
  const environment=shell.system?.environment??runtime.environment??(staticVisualPreview?'static-preview':'unresolved');
  const release=shell.system?.releaseSha??config?.release??runtime.releaseSha??'unresolved';
  const authenticated=Boolean(identity);
  return Object.freeze({
    context:Object.freeze({
      type:routeContextType(route),
      object:asset??route?.label??'Qelly',
      timeframe:clean(rootDataset.timeframe,'Route default'),
      source:evidence.source,
      freshness:evidence.freshness,
      confidence:evidence.confidence
    }),
    system:Object.freeze({
      workspace:identity?.workspace?.name??(staticVisualPreview?'Static visual preview':'Public read-only'),
      timezone:shell.defaults?.timezone??'UTC',
      baseCurrency:shell.defaults?.baseCurrency??'USD',
      environment:clean(environment),
      release:shortSha(release),
      session:authenticated?`${clean(identity?.session?.assurance,'authenticated')} assurance`:'Anonymous',
      providers:staticVisualPreview?'Unavailable':config?.cloud?.providerRuntime===true?'Rights-gated':'Unavailable',
      jobs:capabilities.persistentJobs===true?'Available':'Not enabled',
      notifications:capabilities.productionNotifications===true?'Available':'Not enabled',
      readOnly:true
    }),
    policy:Object.freeze({
      requiredEvidenceFields:shell.evidencePolicy?.requiredFields??[],
      contradictionsFirstClass:shell.evidencePolicy?.contradictionsFirstClass===true,
      sensitiveMaterialExposed:shell.safety?.secretsSerialized===true
    })
  });
}

const contextToken=(label,value,state='')=>`<span class="q-terminal-context__token${state?` is-${html(state)}`:''}"><small>${html(label)}</small><strong>${html(value)}</strong></span>`;
const activityItem=(label,value,state='')=>`<span class="q-terminal-activity__item${state?` is-${html(state)}`:''}"><small>${html(label)}</small><strong>${html(value)}</strong></span>`;

export function renderTerminalShellState(model,root=document){
  const context=root.getElementById?.('shell-context-contract');
  if(context){
    const values=[model.context.type,model.context.object,model.context.timeframe,model.context.source,model.context.freshness,model.context.confidence];
    const signature=JSON.stringify(values);
    if(context.dataset.shellContextSignature!==signature){
      context.innerHTML=[
        contextToken(model.context.type,model.context.object),
        contextToken('Time',model.context.timeframe),
        contextToken('Source',model.context.source),
        contextToken('Freshness',model.context.freshness,model.context.freshness==='Simulated'?'simulated':''),
        contextToken('Confidence',model.context.confidence)
      ].join('');
      context.dataset.shellContextSignature=signature;
    }
    context.dataset.contextType=model.context.type;
  }
  const activity=root.getElementById?.('shell-activity-contract');
  if(activity){
    const values=['READ ONLY',model.system.session,model.system.providers,model.system.jobs,model.system.notifications,model.system.release];
    const signature=JSON.stringify(values);
    if(activity.dataset.shellActivitySignature!==signature){
      activity.innerHTML=[
        activityItem('Safety','READ ONLY','safe'),
        activityItem('Session',model.system.session),
        activityItem('Providers',model.system.providers),
        activityItem('Jobs',model.system.jobs),
        activityItem('Notifications',model.system.notifications),
        activityItem('Release',model.system.release)
      ].join('');
      activity.dataset.shellActivitySignature=signature;
    }
    activity.title=`${model.system.workspace} · ${model.system.timezone} · ${model.system.environment}`;
  }
  const drawer=root.getElementById?.('context-drawer');
  if(drawer){
    drawer.setAttribute('aria-label','Intelligence Inspector');
    const eyebrow=drawer.querySelector('.q-context-head .q-eyebrow');
    const heading=drawer.querySelector('.q-context-head h2');
    if(eyebrow)eyebrow.textContent='Intelligence Inspector';
    if(heading)heading.textContent='Evidence context';
  }
}

const inspectorTabs=Object.freeze(['Explanation','Evidence','Contradictions','Sources','Assumptions','Methodology','Related decisions','Audit']);

function refreshInspectorTabs(root=document){
  const drawer=root.getElementById?.('context-drawer');
  const content=root.getElementById?.('context-content');
  if(!drawer||!content)return;
  let tablist=drawer.querySelector('[data-intelligence-inspector-tabs]');
  if(!tablist){
    tablist=document.createElement('div');
    tablist.className='q-intelligence-inspector-tabs';
    tablist.setAttribute('role','tablist');
    tablist.setAttribute('aria-label','Intelligence inspector sections');
    tablist.dataset.intelligenceInspectorTabs='true';
    drawer.querySelector('.q-context-head')?.after(tablist);
  }
  const text=content.textContent?.toLowerCase()??'';
  const availability={
    Explanation:/explain|methodology|provider observation/.test(text),
    Evidence:true,
    Contradictions:/contradict/.test(text),
    Sources:/source|provider|canonical|entitlement/.test(text),
    Assumptions:/assumption/.test(text),
    Methodology:/method|methodology/.test(text),
    'Related decisions':/decision/.test(text),
    Audit:/audit|version|hash|correlation/.test(text)
  };
  const signature=inspectorTabs.map((label)=>`${label}:${availability[label]===true?'1':'0'}`).join('|');
  if(tablist.dataset.inspectorSignature===signature)return;
  tablist.innerHTML=inspectorTabs.map((label)=>{
    const enabled=availability[label]===true;
    const selected=label==='Evidence';
    return `<button type="button" role="tab" aria-selected="${selected}" ${enabled?'':`aria-disabled="true" disabled title="No ${html(label.toLowerCase())} payload is available for the current evidence object"`} class="${selected?'is-active':''}">${html(label)}</button>`;
  }).join('');
  tablist.dataset.inspectorSignature=signature;
}

const runtimeConfig=()=>typeof window==='undefined'?{}:{...(window.__QELLY_CONFIG__??{})};
const apiUrl=(path)=>{
  const base=String(runtimeConfig().apiBaseUrl??'').replace(/\/$/,'');
  return base?new URL(path,`${base}/`).toString():path;
};

let cachedConfig=null;
let refreshTimer=null;
let refreshSequence=0;

async function fetchJson(path){
  const response=await fetch(apiUrl(path),{credentials:'include',headers:{Accept:'application/json'}});
  if(!response.ok)return null;
  return response.json().catch(()=>null);
}

async function synchronizeShell(){
  if(typeof document==='undefined')return;
  const sequence=++refreshSequence;
  const publicConfig=runtimeConfig();
  const staticVisualPreview=publicConfig.staticVisualPreview===true;
  let config=cachedConfig;
  let identity=null;
  if(staticVisualPreview){
    config={release:'static-preview',capabilityTruth:{persistentJobs:false,productionNotifications:false},cloud:{providerRuntime:false}};
  }else{
    if(!config){
      config=await fetchJson('/api/v1/config');
      if(config)cachedConfig=config;
    }
    identity=await fetchJson('/api/v1/session/context');
  }
  if(sequence!==refreshSequence)return;
  const model=deriveTerminalShellState({
    hash:location.hash,
    rootDataset:document.documentElement.dataset,
    config:config??{},
    identity,
    staticVisualPreview
  });
  renderTerminalShellState(model,document);
  refreshInspectorTabs(document);
}

function scheduleSynchronize(){
  if(typeof window==='undefined')return;
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(()=>{synchronizeShell().catch(()=>{});},40);
}

export function installTerminalShellContext(){
  if(typeof window==='undefined'||typeof document==='undefined')return;
  window.addEventListener('hashchange',scheduleSynchronize);
  window.addEventListener('qelly:shell-context-refresh',()=>{cachedConfig=null;scheduleSynchronize();});
  const app=document.getElementById('app');
  if(app){
    const observer=new MutationObserver((mutations)=>{
      if(mutations.some((mutation)=>mutation.type==='childList')){
        refreshInspectorTabs(document);
        if(document.getElementById('shell-context-contract')||document.getElementById('shell-activity-contract'))scheduleSynchronize();
      }
    });
    observer.observe(app,{childList:true,subtree:true});
  }
  scheduleSynchronize();
}

if(typeof window!=='undefined'&&typeof document!=='undefined')installTerminalShellContext();
