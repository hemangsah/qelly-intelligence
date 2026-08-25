import {humanizeOperationalState,providerAvailability,providerPolicyMessage,readinessLabel,truthLabel} from '../customer-copy.mjs';

const statusTone=(status)=>status==='ready'?'live':status==='deferred'?'cached':status==='partial'?'warning':'unavailable';
const truthTone=(state)=>state==='LIVE'?'live':state==='DELAYED'||state==='CACHED'||state==='AUDIT'?'cached':state==='STALE'||state==='SIMULATED'?'warning':'unavailable';
const safeDate=(value)=>value?String(value):'not observed';

export async function renderPlatformReadiness(main,{api,pageHead,escapeHtml}){
 const data=await api('/api/v1/platform/readiness');
 const summary=data.summary||{ready:0,partial:0,deferred:0,blocked:0};
 const providers=Array.isArray(data.providers)?data.providers:[];
 const gates=Array.isArray(data.gates)?data.gates:[];
 const safety=data.safety||{};
 main.innerHTML=`<section class="q-page q-platform-readiness-v6" data-v6-readiness="evidence-first">
  ${pageHead('Qelly Intelligence · Service status','Platform Readiness','A customer-readable view of account services, private workspace protection, source coverage and data freshness.')}
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
   <div class="q-panel-head"><div><h2>Service checks</h2><p>Account, privacy, source permission and freshness are checked independently.</p></div></div>
   <div class="q-panel-body q-stack">${gates.map((item)=>`<div class="q-record-row" data-gate="${escapeHtml(item.id)}"><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(humanizeOperationalState(item.detail,{fallback:'Service status checked.'}))}${item.observedAt?` · checked ${escapeHtml(safeDate(item.observedAt))}`:''}</small></span><span><span class="q-status q-status--${truthTone(item.truthState)}">${escapeHtml(truthLabel(item.truthState))}</span> <span class="q-status q-status--${statusTone(item.status)}">${escapeHtml(readinessLabel(item.status))}</span></span></div>`).join('')}</div>
  </section>
  <section class="q-panel" data-provenance="provider-policy-matrix">
   <div class="q-panel-head"><div><h2>Data source permissions</h2><p>A source appears in Qelly only after customer-display permission is confirmed.</p></div></div>
   <div class="q-panel-body q-stack">${providers.map((provider)=>{const availability=providerAvailability(provider);return `<div class="q-record-row" data-provider="${escapeHtml(provider.id)}"><span><strong>${escapeHtml(String(provider.id||'provider').toUpperCase())}</strong><small>${escapeHtml(providerPolicyMessage(provider))}</small></span><span class="q-status q-status--${availability.tone}">${escapeHtml(availability.label)}</span></div>`;}).join('')}</div>
  </section>
  <section class="q-panel" data-provenance="financial-safety-boundary">
   <div class="q-panel-head"><div><h2>Financial safety boundary</h2><p>These are product invariants, not temporary outages.</p></div><span class="q-status q-status--live">READ ONLY</span></div>
   <div class="q-panel-body q-stack">${Object.entries(safety).map(([key,value])=>`<div class="q-record-row"><span><strong>${escapeHtml(key.replace(/([A-Z])/g,' $1').replace(/^./,character=>character.toUpperCase()))}</strong></span><span class="q-status q-status--${key==='readOnly'&&value?'live':!value?'cached':'warning'}">${key==='readOnly'&&value?'ENFORCED':value?'ENABLED':'DISABLED'}</span></div>`).join('')}</div>
  </section>
 </section>`;
}
