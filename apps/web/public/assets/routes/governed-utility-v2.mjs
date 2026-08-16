const safe=(value)=>String(value??'').replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const formatTime=(value)=>{const date=new Date(value||'');return Number.isNaN(date.getTime())?'Not supplied':date.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});};
const formatNumber=(value)=>Number.isFinite(Number(value))?new Intl.NumberFormat('en-IN',{maximumFractionDigits:6}).format(Number(value)):'—';
const externalLink=(href,label)=>`<a class="q-button q-button--secondary" href="${href}" target="_blank" rel="noopener noreferrer nofollow">${label} ↗</a>`;
const professionalLinks=()=>`${externalLink('https://www.tradingview.com/markets/','TradingView Markets')}${externalLink('https://www.forexfactory.com/calendar','Forex Factory Calendar')}${externalLink('https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html','ECB Reference Rates')}${externalLink('https://www.cmegroup.com/markets.html','CME Markets')}`;

function converterUnavailable(main,{pageHead,stateBanner,escapeHtml=safe},message){
  main.innerHTML=`<section class="q-page q-governed-converter" data-converter-runtime="unavailable-no-fabrication">
    ${pageHead('Qelly Intelligence · Reference converter','FX Reference Converter','The governed ECB reference observation is unavailable. Qelly will not substitute fixed or generated exchange rates.',professionalLinks())}${stateBanner()}
    <section class="q-v7-boundary-ribbon"><div><span>Source</span><strong>ECB</strong><small>Required governed provider</small></div><div><span>Capability state</span><strong>UNAVAILABLE</strong><small>${escapeHtml(message||'Provider observation unavailable')}</small></div><div><span>Fabricated rate</span><strong>OFF</strong><small>No fixed fallback</small></div><div><span>Execution</span><strong>DISABLED</strong><small>Reference only</small></div></section>
    <section class="q-panel"><div class="q-panel-head"><div><h2>No reference conversion available</h2><p>A conversion result is shown only when one governed ECB observation set is present.</p></div><span class="q-status q-status--unavailable">UNAVAILABLE</span></div><div class="q-panel-body"><div class="q-empty-state"><strong>No rate was generated.</strong><p>Retry the governed provider or use an external research surface. External values are not silently imported into Qelly.</p></div><div class="q-v7-link-grid">${professionalLinks()}</div></div></section>
  </section>`;
}

export async function renderGovernedConverterV2(main,deps){
  const {api,pageHead,stateBanner,escapeHtml=safe,toast}=deps;
  let ecb;
  try{ecb=await api('/api/v1/providers/ecb?capability=fx-reference-rates&symbol=EUR');}
  catch(error){converterUnavailable(main,deps,error?.message);return;}
  const rates={EUR:1,...(ecb?.data?.rates||{})};
  const currencies=Object.keys(rates).filter((code)=>/^[A-Z]{3}$/.test(code)&&Number(rates[code])>0).sort();
  if(currencies.length<2){converterUnavailable(main,deps,'ECB reference-rate set is incomplete.');return;}
  const option=(code)=>`<option value="${escapeHtml(code)}">${escapeHtml(code)}</option>`;
  const observedAt=ecb?.observationTime||ecb?.observedAt||null;
  const ingestedAt=ecb?.ingestionTime||ecb?.ingestedAt||null;
  main.innerHTML=`<section class="q-page q-governed-converter" data-converter-runtime="ecb-reference-v2">
    ${pageHead('Qelly Intelligence · Reference converter','FX Reference Converter','Cross-currency calculation derived only from one governed ECB euro reference-rate observation. This is not an executable quote, card rate, remittance rate or trading price.',professionalLinks())}${stateBanner()}
    <section class="q-v7-boundary-ribbon"><div><span>Source</span><strong>ECB</strong><small>Euro reference rates</small></div><div><span>Observation</span><strong>${escapeHtml(observedAt?new Date(observedAt).toISOString().slice(0,10):'—')}</strong><small>Working-day reference</small></div><div><span>Fabricated rate</span><strong>OFF</strong><small>Single governed source set</small></div><div><span>Execution</span><strong>DISABLED</strong><small>Reference calculation only</small></div></section>
    <div class="q-converter-shell"><section class="q-panel"><div class="q-panel-head"><div><h2>Reference conversion</h2><p>EUR cross-rate derivation: amount ÷ source-per-EUR × target-per-EUR.</p></div><span class="q-status q-status--delayed">REFERENCE</span></div><div class="q-panel-body q-converter-form"><label class="q-setting"><span>Amount</span><input id="governed-convert-amount" type="number" min="0" step="any" value="1"></label><label class="q-setting"><span>From</span><select id="governed-convert-from">${currencies.map(option).join('')}</select></label><button class="q-swap-button" data-action="governed-swap" aria-label="Swap currencies">⇄</button><label class="q-setting"><span>To</span><select id="governed-convert-to">${currencies.map(option).join('')}</select></label><button class="q-button q-button--primary" data-action="governed-convert">Calculate reference</button></div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Calculated reference</h2><p>Source, observation and derivation remain visible.</p></div><span class="q-status q-status--cached">READY</span></div><div id="governed-convert-result" class="q-panel-body"></div></section></div>
    <section class="q-panel"><div class="q-panel-head"><div><h2>Evidence envelope</h2><p>Reference values are not live executable FX quotes.</p></div></div><div class="q-panel-body q-v7-evidence-strip"><span>Provider: European Central Bank</span><span>Observed: ${escapeHtml(formatTime(observedAt))}</span><span>Ingested: ${escapeHtml(formatTime(ingestedAt))}</span><span>Truth: ${escapeHtml(String(ecb?.truthState||'delayed_provider'))}</span><span>Execution: disabled</span></div></section>
  </section>`;
  const amount=main.querySelector('#governed-convert-amount'),from=main.querySelector('#governed-convert-from'),to=main.querySelector('#governed-convert-to');
  if(currencies.includes('USD'))from.value='USD';
  if(currencies.includes('INR'))to.value='INR';else if(currencies.includes('GBP'))to.value='GBP';else to.value=currencies.find((code)=>code!==from.value)||currencies[0];
  const calculate=()=>{
    const input=Number(amount.value),sourceRate=Number(rates[from.value]),targetRate=Number(rates[to.value]);
    const target=Number.isFinite(input)&&input>=0&&sourceRate>0&&targetRate>0?(input/sourceRate)*targetRate:null;
    const cross=sourceRate>0&&targetRate>0?targetRate/sourceRate:null;
    main.querySelector('#governed-convert-result').innerHTML=target==null?'<div class="q-empty-state"><strong>Invalid reference input</strong><p>Enter a non-negative amount and choose currencies present in the ECB observation.</p></div>':`<div class="q-converter-result"><p>${escapeHtml(formatNumber(input))} <strong>${escapeHtml(from.value)}</strong></p><span>ECB reference conversion</span><h2>${escapeHtml(formatNumber(target))} ${escapeHtml(to.value)}</h2><dl><dt>Cross rate</dt><dd>${escapeHtml(formatNumber(cross))} ${escapeHtml(to.value)} per ${escapeHtml(from.value)}</dd><dt>Source</dt><dd>ECB euro foreign exchange reference rates</dd><dt>Observed</dt><dd>${escapeHtml(formatTime(observedAt))}</dd><dt>Tradable</dt><dd>No</dd></dl></div>`;
  };
  main.querySelector('[data-action="governed-convert"]')?.addEventListener('click',calculate);
  main.querySelector('[data-action="governed-swap"]')?.addEventListener('click',()=>{const prior=from.value;from.value=to.value;to.value=prior;calculate();});
  [amount,from,to].forEach((element)=>element?.addEventListener('change',calculate));
  calculate();
  toast?.('Converter uses ECB governed reference rates only.',{tone:'neutral'});
}

export async function renderGovernedTrustCenterV2(main,deps){
  const {api,pageHead,stateBanner,escapeHtml=safe}=deps;
  const [capabilitiesResult,providersResult,overviewResult]=await Promise.allSettled([api('/api/v1/platform/capabilities'),api('/api/v1/providers/status'),api('/api/v1/public/markets/overview')]);
  const capabilities=capabilitiesResult.status==='fulfilled'?capabilitiesResult.value:{};
  const providers=providersResult.status==='fulfilled'?providersResult.value:{};
  const overview=overviewResult.status==='fulfilled'?overviewResult.value:{};
  const providerItems=Array.isArray(providers.providers)?providers.providers:[];
  const unavailable=Array.isArray(capabilities.items)?capabilities.items:[];
  const canonicalRuntime=capabilities.canonicalRuntime||'cloudflare-pages-functions';
  main.innerHTML=`<section class="q-page q-governed-trust-center" data-trust-runtime="governed-v2">
    ${pageHead('Qelly Intelligence · Trust and data governance','Production Trust Center','Runtime capability, provider-rights and no-fabrication boundaries from canonical Cloudflare contracts. This is product evidence, not a claim of external certification.',professionalLinks())}${stateBanner()}
    <section class="q-v7-boundary-ribbon"><div><span>Providers registered</span><strong>${providerItems.length}</strong><small>Policy governed</small></div><div><span>Unavailable capabilities</span><strong>${unavailable.length}</strong><small>${escapeHtml(String(capabilities.unavailableCount??unavailable.length))} registry entries</small></div><div><span>Fabricated market fallback</span><strong>${overview?.guardrails?.fabricatedObservations===false?'OFF':'—'}</strong><small>No substitute observations</small></div><div><span>Execution</span><strong>DISABLED</strong><small>Read only</small></div></section>
    <div class="q-dashboard-grid"><section class="q-panel"><div class="q-panel-head"><div><h2>Provider policy matrix</h2><p>End-user display requires approved rights as well as technical integration.</p></div></div><div class="q-panel-body q-stack">${providerItems.length?providerItems.map((provider)=>`<div class="q-record-row"><span><strong>${escapeHtml(String(provider.id||'provider').toUpperCase())}</strong><small>${escapeHtml(provider.termsState||provider.reason||'not supplied')}</small></span><span class="q-status q-status--${provider.enabled?'delayed':'unavailable'}">${provider.enabled?'ENABLED REFERENCE':'BLOCKED'}</span></div>`).join(''):'<div class="q-empty-state"><strong>Provider registry unavailable</strong></div>'}</div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Unavailable capability registry</h2><p>Unavailable is a truthful runtime state, not an invitation to fabricate data.</p></div></div><div class="q-panel-body q-stack">${unavailable.slice(0,20).map((item)=>`<div class="q-record-row"><span><strong>${escapeHtml(item.label||item.id)}</strong><small>${escapeHtml(item.reason||item.category||'production dependency unavailable')}</small></span><span class="q-status q-status--unavailable">UNAVAILABLE</span></div>`).join('')||'<p>No unavailable inventory returned.</p>'}</div></section></div>
    <section class="q-panel"><div class="q-panel-head"><div><h2>Canonical runtime evidence</h2><p>Production contracts are inspectable without overstating assurance.</p></div></div><div class="q-panel-body"><pre class="q-json-evidence">${escapeHtml(JSON.stringify({releaseSha:providers.releaseSha||null,canonicalRuntime,capabilityTruth:capabilities.truthState||null,unavailableCount:capabilities.unavailableCount??unavailable.length,marketTruth:overview.truthState||'UNAVAILABLE',fabricatedObservations:overview?.guardrails?.fabricatedObservations??false,execution:false},null,2))}</pre></div></section>
  </section>`;
}

export const __governedUtilityV2Test=Object.freeze({formatNumber,formatTime});