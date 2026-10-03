import {humanizeOperationalState,providerPolicyMessage,readinessLabel,truthLabel} from '../customer-copy.mjs';

const statusTone=(status)=>status==='ready'?'live':status==='deferred'?'cached':status==='partial'?'warning':'unavailable';
const truthTone=(state)=>state==='LIVE'?'live':state==='DELAYED'||state==='CACHED'||state==='AUDIT'?'cached':state==='STALE'||state==='SIMULATED'?'warning':'unavailable';
const safeDate=(value)=>value?String(value):'not observed';

const PROVIDER_NAMES=Object.freeze({ecb:'European Central Bank',binance:'Binance market data',coinbase:'Coinbase market data','qelly-governed-demo':'QELLY local demonstration'});
const CAPABILITY_LABELS=Object.freeze({'fx-reference-rates':'FX reference rates',quote:'Quotes',candles:'Historical candles','deterministic-demonstration':'Local simulated observations'});
const POLICY_TRUTH=new Set(['LIVE','DELAYED','CACHED','STALE','UNAVAILABLE']);
export function providerDisplayModel(raw={}){
 const id=String(raw?.id||'unidentified').slice(0,64);
 const demo=id==='qelly-governed-demo';
 const enabled=raw?.enabled===true&&!demo;
 const observed=typeof raw?.observedAt==='string'&&raw.observedAt.length<=40
    &&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(raw.observedAt)
    &&Number.isFinite(Date.parse(raw.observedAt))?raw.observedAt:null;
 const sourceTruth=String(raw?.truthState||'UNAVAILABLE').toUpperCase();
 const truthState=demo?'SIMULATED':enabled&&POLICY_TRUTH.has(sourceTruth)?sourceTruth:'UNAVAILABLE';
 const capabilityIds=Array.isArray(raw?.capabilities)?raw.capabilities.slice(0,8):[];
 const capabilities=capabilityIds.map(key=>CAPABILITY_LABELS[key]||null).filter(Boolean);
 const policy=demo?'Deterministic local samples; no live market feed.'
   :enabled?providerPolicyMessage(raw):providerPolicyMessage(raw);
 const health=demo?'Local sample only; no independent provider status.'
   :!enabled?'Not polled while display approval is pending.'
   :String(raw?.healthState||'not-reported')==='enabled-health-not-sampled'
     ?'Policy enabled; runtime health has not been measured.'
     :humanizeOperationalState(raw?.healthState,{fallback:'Runtime health not reported.'});
 return Object.freeze({
  id,name:PROVIDER_NAMES[id]||'Unidentified provider',enabled,truthState,
  approval:demo?'Simulation only':enabled?'Policy enabled':'Display unavailable',
  policy,health,capabilities,
  observation:enabled&&observed?observed:null,
  latencyState:'Not measured',quotaState:'Not reported',failureCount:null
 });
}


export async function renderPlatformReadiness(main,{api,pageHead,escapeHtml}){
 const data=await api('/api/v1/platform/readiness');
 const summary=data.summary||{ready:0,partial:0,deferred:0,blocked:0};
 const gates=Array.isArray(data.gates)?data.gates:[];
 const providers=Array.isArray(data.providers)?data.providers.slice(0,20).map(providerDisplayModel):[];
 main.innerHTML=`<section class="q-page q-platform-readiness-v6" data-v6-readiness="evidence-first">
  ${pageHead('Qelly Intelligence · Service status','Platform Readiness','A customer-readable view of account services, private workspace protection and data freshness.')}
  <section class="q-kpi-grid" aria-label="Readiness gate summary">
   <article class="q-kpi"><div class="q-kpi-label">Ready</div><div class="q-kpi-value">${Number(summary.ready)||0}</div><div class="q-kpi-meta"><span>Evidence proven</span><span class="q-status q-status--live">READY</span></div></article>
   <article class="q-kpi"><div class="q-kpi-label">Partial</div><div class="q-kpi-value">${Number(summary.partial)||0}</div><div class="q-kpi-meta"><span>Capability degraded</span><span class="q-status q-status--warning">PARTIAL</span></div></article>
   <article class="q-kpi"><div class="q-kpi-label">Planned</div><div class="q-kpi-value">${Number(summary.deferred)||0}</div><div class="q-kpi-meta"><span>Coverage in progress</span><span class="q-status q-status--cached">PLANNED</span></div></article>
   <article class="q-kpi"><div class="q-kpi-label">Needs attention</div><div class="q-kpi-value">${Number(summary.blocked)||0}</div><div class="q-kpi-meta"><span>Required check pending</span><span class="q-status q-status--warning">REVIEW</span></div></article>
  </section>
  <section class="q-panel" data-provenance="platform-runtime">
   <div class="q-panel-head"><div><h2>Qelly service status</h2><p>Live checks from the running production application.</p></div><span class="q-status q-status--${data.ready?'live':'warning'}">${data.ready?'All core services ready':'Review in progress'}</span></div>
   <div class="q-panel-body q-stack">
    <div class="q-record-row"><span><strong>Production app</strong><small>The official Qelly web experience</small></span><span>${escapeHtml(data.canonicalSite||'Checking')}</span></div>
    <div class="q-record-row"><span><strong>Core service check</strong><small>${data.ready?'Required account and data checks passed.':'One or more required checks are still in progress.'}</small></span><span class="q-status q-status--${data.ready?'live':'warning'}">${data.ready?'Verified':'Review'}</span></div>
   </div>
  </section>
  <section class="q-panel" data-provenance="dependency-gates">
   <div class="q-panel-head"><div><h2>Service checks</h2><p>Account, privacy and data freshness are checked independently.</p></div></div>
   <div class="q-panel-body q-stack">${gates.map((item)=>`<div class="q-record-row" data-gate="${escapeHtml(item.id)}"><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(humanizeOperationalState(item.detail,{fallback:'Service status checked.'}))}${item.observedAt?` · checked ${escapeHtml(safeDate(item.observedAt))}`:''}</small></span><span><span class="q-status q-status--${truthTone(item.truthState)}">${escapeHtml(truthLabel(item.truthState))}</span> <span class="q-status q-status--${statusTone(item.status)}">${escapeHtml(readinessLabel(item.status))}</span></span></div>`).join('')}</div>
  </section>
  <section class="q-panel" data-provenance="governed-provider-coverage" aria-labelledby="q-provider-coverage-title">
   <div class="q-panel-head"><div><h2 id="q-provider-coverage-title">Provider coverage and freshness</h2><p>Reported provider policy, source observation and data availability. Restricted market feeds are not sampled or displayed as live.</p></div></div>
   <div class="q-panel-body q-stack" role="list" aria-label="Governed data provider status">
    ${providers.length?providers.map(provider=>`<div class="q-record-row" role="listitem" data-provider="${escapeHtml(provider.id)}">
      <span><strong>${escapeHtml(provider.name)}</strong>
      <small>${escapeHtml(provider.policy)}</small>
      <small>Coverage: ${escapeHtml(provider.capabilities.length?provider.capabilities.join(', '):'Not verified')}</small>
      <small>${escapeHtml(provider.health)}</small>
      <small>Last source observation: ${escapeHtml(provider.observation||'Not reported')} · Latency: Not measured · Quota: Not reported</small></span>
      <span><span class="q-status q-status--${truthTone(provider.truthState)}">${escapeHtml(truthLabel(provider.truthState))}</span>
      <span class="q-status q-status--${provider.enabled?'live':'cached'}">${escapeHtml(provider.approval)}</span></span>
     </div>`).join(''):'<p class="q-muted-copy">Provider policy and observation details are unavailable. No market coverage has been inferred.</p>'}
   </div>
   <div class="q-panel-body"><p class="q-muted-copy">This view does not claim measured uptime, request latency, error counts or remaining quota. Reference observations are not executable live trading quotes.</p></div>
  </section>
 </section>`;
}
