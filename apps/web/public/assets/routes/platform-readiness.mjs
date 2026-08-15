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
  ${pageHead('Qelly Intelligence · Production evidence','Platform Readiness','Cloudflare runtime, persistence, identity, provider-rights and data-freshness evidence. Policy-disabled providers are not misreported as outages.')}
  <section class="q-kpi-grid" aria-label="Readiness gate summary">
   <article class="q-kpi"><div class="q-kpi-label">Ready</div><div class="q-kpi-value">${Number(summary.ready)||0}</div><div class="q-kpi-meta"><span>Evidence proven</span><span class="q-status q-status--live">READY</span></div></article>
   <article class="q-kpi"><div class="q-kpi-label">Partial</div><div class="q-kpi-value">${Number(summary.partial)||0}</div><div class="q-kpi-meta"><span>Capability degraded</span><span class="q-status q-status--warning">PARTIAL</span></div></article>
   <article class="q-kpi"><div class="q-kpi-label">Deferred</div><div class="q-kpi-value">${Number(summary.deferred)||0}</div><div class="q-kpi-meta"><span>Intentional / rights-gated</span><span class="q-status q-status--cached">DEFERRED</span></div></article>
   <article class="q-kpi"><div class="q-kpi-label">Blocked</div><div class="q-kpi-value">${Number(summary.blocked)||0}</div><div class="q-kpi-meta"><span>Required evidence missing</span><span class="q-status q-status--unavailable">BLOCKED</span></div></article>
  </section>
  <section class="q-panel" data-provenance="platform-runtime">
   <div class="q-panel-head"><div><h2>Runtime evidence</h2><p>Release and dependency state are derived from the running Cloudflare Functions environment.</p></div><span class="q-status q-status--${data.ready?'live':'warning'}">${escapeHtml(data.readinessStatus||'unknown')}</span></div>
   <div class="q-panel-body q-stack">
    <div class="q-record-row"><span><strong>Release SHA</strong><small>${escapeHtml(data.environment||'environment unavailable')}</small></span><code>${escapeHtml(data.releaseSha||'unresolved')}</code></div>
    <div class="q-record-row"><span><strong>Canonical terminal</strong><small>Dynamic runtime authority</small></span><span>${escapeHtml(data.canonicalSite||'unresolved')}</span></div>
    <div class="q-record-row"><span><strong>Readiness conclusion</strong><small>${escapeHtml(data.readinessReason||'No readiness reason supplied.')}</small></span><span class="q-status q-status--${data.ready?'live':'warning'}">${data.ready?'PROVEN':'NOT PROVEN'}</span></div>
   </div>
  </section>
  <section class="q-panel" data-provenance="dependency-gates">
   <div class="q-panel-head"><div><h2>Dependency & entitlement gates</h2><p>Infrastructure failures, data freshness and provider-rights restrictions are separate states.</p></div></div>
   <div class="q-panel-body q-stack">${gates.map((item)=>`<div class="q-record-row" data-gate="${escapeHtml(item.id)}"><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.kind||'dependency')} · ${escapeHtml(item.detail||'no detail')}${item.observedAt?` · observed ${escapeHtml(safeDate(item.observedAt))}`:''}</small></span><span><span class="q-status q-status--${truthTone(item.truthState)}">${escapeHtml(item.truthState||'UNAVAILABLE')}</span> <span class="q-status q-status--${statusTone(item.status)}">${escapeHtml(String(item.status||'unknown').toUpperCase())}</span></span></div>`).join('')}</div>
  </section>
  <section class="q-panel" data-provenance="provider-policy-matrix">
   <div class="q-panel-head"><div><h2>Provider policy matrix</h2><p>Provider enablement is an entitlement decision. Health is only sampled for providers that policy permits Qelly to call.</p></div></div>
   <div class="q-panel-body q-stack">${providers.map((provider)=>`<div class="q-record-row" data-provider="${escapeHtml(provider.id)}"><span><strong>${escapeHtml(provider.id)}</strong><small>${escapeHtml(provider.policyState||'unavailable')} · ${escapeHtml(provider.healthState||'health unavailable')} · ${escapeHtml((provider.capabilities||[]).join(', ')||'no capability')}</small>${provider.reason?`<small>${escapeHtml(provider.reason)}</small>`:''}</span><span><span class="q-status q-status--${provider.enabled?'live':'unavailable'}">${provider.enabled?'ENABLED':'DISABLED'}</span> <span class="q-status q-status--${truthTone(provider.truthState)}">${escapeHtml(provider.truthState||'UNAVAILABLE')}</span></span></div>`).join('')}</div>
  </section>
  <section class="q-panel" data-provenance="financial-safety-boundary">
   <div class="q-panel-head"><div><h2>Financial safety boundary</h2><p>These are product invariants, not temporary outages.</p></div><span class="q-status q-status--live">READ ONLY</span></div>
   <div class="q-panel-body q-stack">${Object.entries(safety).map(([key,value])=>`<div class="q-record-row"><span><strong>${escapeHtml(key.replace(/([A-Z])/g,' $1').replace(/^./,character=>character.toUpperCase()))}</strong></span><span class="q-status q-status--${key==='readOnly'&&value?'live':!value?'cached':'warning'}">${key==='readOnly'&&value?'ENFORCED':value?'ENABLED':'DISABLED'}</span></div>`).join('')}</div>
  </section>
 </section>`;
}
