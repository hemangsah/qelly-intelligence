const safe=(value)=>String(value??'').replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const formatTime=(value)=>{const date=new Date(value||'');return Number.isNaN(date.getTime())?'Not supplied':date.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});};
const formatNumber=(value)=>Number.isFinite(Number(value))?new Intl.NumberFormat('en-IN',{maximumFractionDigits:6}).format(Number(value)):'—';
const externalLink=(href,label)=>`<a class="q-button q-button--secondary" href="${href}" target="_blank" rel="noopener noreferrer nofollow">${label} ↗</a>`;
const professionalLinks=()=>`${externalLink('https://www.tradingview.com/markets/','TradingView Markets')}${externalLink('https://www.forexfactory.com/calendar','Forex Factory Calendar')}${externalLink('https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html','ECB Reference Rates')}${externalLink('https://www.cmegroup.com/markets.html','CME Markets')}`;

function converterUnavailable(main,{pageHead,stateBanner,escapeHtml=safe},message){
  main.innerHTML=`<section class="q-page q-governed-converter" data-converter-runtime="unavailable-no-fabrication">
    ${pageHead('Qelly Intelligence · Reference converter','FX Reference Converter','Reference-rate coverage is refreshing. Qelly keeps the result empty until the approved ECB source responds.',professionalLinks())}${stateBanner()}
    <section class="q-v7-boundary-ribbon"><div><span>Source</span><strong>ECB</strong><small>Approved reference provider</small></div><div><span>Coverage</span><strong>REFRESHING</strong><small>Try again shortly</small></div><div><span>Placeholder rate</span><strong>OFF</strong><small>No invented result</small></div><div><span>Purpose</span><strong>REFERENCE</strong><small>Not a tradable quote</small></div></section>
    <section class="q-panel"><div class="q-panel-head"><div><h2>Reference rates are refreshing</h2><p>Your conversion will appear only when the approved ECB observation is available.</p></div><span class="q-status q-status--cached">CHECKING</span></div><div class="q-panel-body"><div class="q-empty-state"><strong>Continue with a verified external source.</strong><p>Use one of the trusted research links below, or return shortly and retry the conversion.</p></div><div class="q-v7-link-grid">${professionalLinks()}</div></div></section>
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
    <section class="q-panel"><div class="q-panel-head"><div><h2>Source details</h2><p>Reference values are informational, not live executable FX quotes.</p></div></div><div class="q-panel-body q-v7-evidence-strip"><span>Provider: European Central Bank</span><span>Observed: ${escapeHtml(formatTime(observedAt))}</span><span>Updated: ${escapeHtml(formatTime(ingestedAt))}</span><span>Quality: ${escapeHtml(truthLabel(ecb?.truthState||'delayed_provider'))}</span><span>Research only</span></div></section>
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
  const unavailableCount=Number(capabilities.unavailableCount??unavailable.length);
  main.innerHTML=`<section class="q-page q-governed-trust-center" data-trust-runtime="governed-v2">
    ${pageHead('Qelly Intelligence · Trust and data governance','Trust Center','Understand source permissions, coverage progress and the safeguards protecting your research.',professionalLinks())}${stateBanner()}
    <section class="q-v7-boundary-ribbon"><div><span>Registered sources</span><strong>${providerItems.length}</strong><small>Permission reviewed</small></div><div><span>Coverage in progress</span><strong>${unavailableCount}</strong><small>Clearly identified</small></div><div><span>Invented market values</span><strong>${overview?.guardrails?.fabricatedObservations===false?'OFF':'—'}</strong><small>No hidden substitutes</small></div><div><span>Product mode</span><strong>RESEARCH</strong><small>No trade execution</small></div></section>
    <div class="q-dashboard-grid"><section class="q-panel"><div class="q-panel-head"><div><h2>Data source permissions</h2><p>Every source needs confirmed customer-display permission.</p></div></div><div class="q-panel-body q-stack">${providerItems.length?providerItems.map((provider)=>{const availability=providerAvailability(provider);return `<div class="q-record-row"><span><strong>${escapeHtml(String(provider.id||'provider').toUpperCase())}</strong><small>${escapeHtml(providerPolicyMessage(provider))}</small></span><span class="q-status q-status--${availability.tone}">${escapeHtml(availability.label)}</span></div>`;}).join(''):'<div class="q-empty-state"><strong>Source status is refreshing</strong><p>Try again shortly.</p></div>'}</div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Coverage roadmap</h2><p>These areas will appear when their verified sources are ready.</p></div></div><div class="q-panel-body q-stack">${unavailable.slice(0,8).map((item)=>`<div class="q-record-row"><span><strong>${escapeHtml(item.label||humanizeOperationalState(item.id).replace(/\.$/,''))}</strong><small>Source and product checks are in progress.</small></span><span class="q-status q-status--cached">COMING SOON</span></div>`).join('')||'<p>All listed coverage is ready.</p>'}</div></section></div>
    <section class="q-panel"><div class="q-panel-head"><div><h2>What Qelly guarantees</h2><p>A short summary of the production trust boundary.</p></div><span class="q-status q-status--live">ACTIVE</span></div><div class="q-panel-body q-v7-evidence-strip"><span>Sources are named</span><span>Missing values stay empty</span><span>Reference timing is visible</span><span>Private workspaces stay private</span><span>${escapeHtml(truthLabel(overview.truthState||'UNAVAILABLE'))} market coverage</span></div></section>
  </section>`;
}

export const __governedUtilityV2Test=Object.freeze({formatNumber,formatTime});
import {humanizeOperationalState,providerAvailability,providerPolicyMessage,truthLabel} from '../customer-copy.mjs';
