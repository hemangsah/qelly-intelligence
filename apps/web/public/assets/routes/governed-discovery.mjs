const ROUTE_COPY=Object.freeze({
  'discovery-hub':{eyebrow:'Qelly Intelligence · Discovery',title:'Discovery coverage',description:'Cross-asset discovery is not populated until a sourced, licensed and production-validated index is available.',capability:'Public discovery and search',reason:'No production-safe sourced discovery universe is configured.'},
  search:{eyebrow:'Qelly Intelligence · Search',title:'Universal Search',description:'Federated market search remains unavailable until canonical source indexing is proven.',capability:'Universal search',reason:'No production-safe external or canonical market index is configured.'},
  categories:{eyebrow:'Qelly Intelligence · Taxonomy',title:'Cross-Asset Categories',description:'Category performance, breadth and market-value aggregates require sourced constituent observations.',capability:'Category analytics',reason:'No rights-authorized constituent universe is available for category aggregation.'},
  'category-detail':{eyebrow:'Qelly Intelligence · Taxonomy',title:'Category dossier',description:'Category constituents and performance are withheld until the underlying observations are source-proven.',capability:'Category analytics',reason:'No governed category observation set is configured.'},
  venues:{eyebrow:'Qelly Intelligence · Venue intelligence',title:'Exchange and Venue Rankings',description:'Venue volume, depth, reserve, trust and incident metrics require official and licensed sources.',capability:'Venue discovery',reason:'No production venue-ranking provider has been approved.'},
  'venue-detail':{eyebrow:'Qelly Intelligence · Venue intelligence',title:'Venue dossier',description:'Venue-specific market, reserve and operational claims remain unavailable without official verification.',capability:'Venue discovery',reason:'No production venue dossier source has been approved.'},
  'dex-discovery':{eyebrow:'Qelly Intelligence · On-chain discovery',title:'DEX Pairs and Signals',description:'Pool liquidity, holder, security and smart-money metrics are unavailable until an on-chain provider is integrated and validated.',capability:'DEX discovery',reason:'No production on-chain provider is configured.'},
  'global-charts':{eyebrow:'Qelly Intelligence · Global intelligence',title:'Global Charts and Prediction Evidence',description:'Global market-value, dominance, flow and prediction probabilities require sourced observations. Production does not use simulated series.',capability:'Global charts and prediction markets',reason:'No licensed global aggregate or prediction-market feed is configured.'},
  'news-research':{eyebrow:'Qelly Intelligence · Research',title:'News and Research Hub',description:'External news, filings and research are shown only when content rights, citations and source ingestion are proven.',capability:'News and external research',reason:'No licensed news or external research corpus is configured.'},
  'research-article':{eyebrow:'Qelly Intelligence · Research',title:'Research article',description:'External research content is unavailable until a governed corpus with citation and content-rights evidence is configured.',capability:'External research article',reason:'No licensed article corpus is configured.'},
  asset:{eyebrow:'Qelly Intelligence · Public asset',title:'Public asset dossier',description:'Qelly does not publish an internal asset price when no rights-authorized market provider supplies the observation.',capability:'Public asset observations',reason:'No rights-authorized internal crypto price feed is available.'},
  rankings:{eyebrow:'Qelly Intelligence · Rankings',title:'Public Asset Rankings',description:'Rankings require rights-authorized market observations and are withheld when those inputs are unavailable.',capability:'Asset rankings',reason:'No rights-authorized ranking feed is available.'}
});

const safe=(value)=>String(value??'').replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const externalLink=(href,label)=>`<a class="q-button q-button--secondary" href="${href}" target="_blank" rel="noopener noreferrer nofollow">${label} ↗</a>`;
const formatTime=(value)=>{const date=new Date(value||'');return Number.isNaN(date.getTime())?'Not supplied':date.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});};
const formatNumber=(value)=>Number.isFinite(Number(value))?new Intl.NumberFormat('en-IN',{maximumFractionDigits:6}).format(Number(value)):'—';

function professionalLinks(){
  return `${externalLink('https://www.tradingview.com/markets/','TradingView Markets')}${externalLink('https://www.forexfactory.com/calendar','Forex Factory Calendar')}${externalLink('https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html','ECB Reference Rates')}${externalLink('https://www.cmegroup.com/markets.html','CME Markets')}`;
}

function sourceBoundary(){
  return `<section class="q-panel"><div class="q-panel-head"><div><h2>Professional research surfaces</h2><p>External sources open in a separate trust boundary and are not silently ingested into Qelly analytics.</p></div><span class="q-status q-status--cached">EXTERNAL</span></div><div class="q-panel-body q-v7-link-grid">${professionalLinks()}</div></section>`;
}

export async function renderGovernedUnavailable(main,deps,route){
  const {api,pageHead,stateBanner,escapeHtml=safe,navigate}=deps;
  const copy=ROUTE_COPY[route]||ROUTE_COPY['discovery-hub'];
  const [capabilitiesResult,providersResult]=await Promise.allSettled([
    api('/api/v1/platform/capabilities'),
    api('/api/v1/providers/status')
  ]);
  const capabilities=capabilitiesResult.status==='fulfilled'?capabilitiesResult.value:null;
  const providers=providersResult.status==='fulfilled'?providersResult.value:null;
  const providerItems=Array.isArray(providers?.providers)?providers.providers:[];
  const ecb=providerItems.find((provider)=>provider.id==='ecb');
  const blocked=providerItems.filter((provider)=>provider.enabled===false);
  main.innerHTML=`<section class="q-page q-governed-unavailable" data-governed-capability="${escapeHtml(route)}">
    ${pageHead(copy.eyebrow,copy.title,copy.description,`<a class="q-button q-button--primary" href="#/market">Market Command</a>`)}${stateBanner()}
    <section class="q-v7-boundary-ribbon" aria-label="Capability truth boundary">
      <div><span>Capability state</span><strong>UNAVAILABLE</strong><small>No fixture substitution</small></div>
      <div><span>Fabricated observations</span><strong>0</strong><small>Production contract</small></div>
      <div><span>Approved reference provider</span><strong>${ecb?.enabled?'ECB':'—'}</strong><small>${ecb?.enabled?'Delayed reference cadence':'Unavailable'}</small></div>
      <div><span>Execution</span><strong>DISABLED</strong><small>Research only</small></div>
    </section>
    <div class="q-dashboard-grid">
      <section class="q-panel"><div class="q-panel-head"><div><p class="q-eyebrow">Production capability boundary</p><h2>${escapeHtml(copy.capability)}</h2><p>${escapeHtml(copy.reason)}</p></div><span class="q-status q-status--unavailable">NOT SOURCED</span></div><div class="q-panel-body"><div class="q-empty-state"><strong>No production market facts are substituted.</strong><p>Qelly will activate this surface only when source identity, response schema, timestamp semantics, freshness, entitlement, licensing, monitoring and fallback behavior are proven.</p></div><div class="q-v7-evidence-strip"><span>Canonical runtime: Cloudflare</span><span>Discovery fallback: none</span><span>Blocked providers: ${blocked.length}</span><span>Fabrication: prohibited</span></div></div></section>
      <section class="q-panel"><div class="q-panel-head"><div><h2>Provider readiness</h2><p>Technical reachability alone does not authorize end-user display.</p></div></div><div class="q-panel-body q-stack">${providerItems.length?providerItems.map((provider)=>`<div class="q-record-row"><span><strong>${escapeHtml(String(provider.id||'provider').toUpperCase())}</strong><small>${escapeHtml(provider.termsState||provider.reason||'policy state unavailable')}</small></span><span class="q-status q-status--${provider.enabled?'delayed':'unavailable'}">${provider.enabled?'APPROVED REFERENCE':'BLOCKED'}</span></div>`).join(''):'<div class="q-empty-state"><strong>Provider status unavailable</strong><p>The provider registry could not be read.</p></div>'}</div></section>
    </div>
    ${sourceBoundary()}
    <section class="q-panel"><div class="q-panel-head"><div><h2>Platform capability inventory</h2><p>Unavailable capabilities are explicit product states, not hidden errors.</p></div></div><div class="q-panel-body"><pre class="q-json-evidence">${escapeHtml(JSON.stringify({route,capability:copy.capability,platform:capabilities?.runtime||'cloudflare',truthState:'UNAVAILABLE',fabricatedObservations:false},null,2))}</pre></div></section>
  </section>`;
  main.querySelector('[data-action="open-market"]')?.addEventListener('click',()=>navigate?.('market'));
}

export async function renderGovernedConverter(main,deps){
  const {api,pageHead,stateBanner,escapeHtml=safe,toast}=deps;
  let ecb;
  try{ecb=await api('/api/v1/providers/ecb?capability=fx-reference-rates&symbol=EUR');}
  catch(error){return renderGovernedUnavailable(main,deps,'converter');}
  const rates={EUR:1,...(ecb?.data?.rates||{})};
  const currencies=Object.keys(rates).filter((code)=>/^[A-Z]{3}$/.test(code)).sort();
  const option=(code)=>`<option value="${escapeHtml(code)}">${escapeHtml(code)}</option>`;
  const observedAt=ecb?.observationTime||ecb?.observedAt||null;
  const ingestedAt=ecb?.ingestionTime||ecb?.ingestedAt||null;
  main.innerHTML=`<section class="q-page q-governed-converter" data-converter-runtime="ecb-reference-v1">
    ${pageHead('Qelly Intelligence · Reference converter','FX Reference Converter','Cross-currency calculation derived only from the latest governed ECB euro reference-rate observation. It is not an executable quote, card rate, remittance rate or trading price.',professionalLinks())}${stateBanner()}
    <section class="q-v7-boundary-ribbon"><div><span>Source</span><strong>ECB</strong><small>Euro reference rates</small></div><div><span>Observation</span><strong>${escapeHtml(observedAt?new Date(observedAt).toISOString().slice(0,10):'—')}</strong><small>Working-day reference</small></div><div><span>Fabricated rate</span><strong>OFF</strong><small>Derived from one source set</small></div><div><span>Execution</span><strong>DISABLED</strong><small>Reference calculation only</small></div></section>
    <div class="q-converter-shell"><section class="q-panel"><div class="q-panel-head"><div><h2>Reference conversion</h2><p>EUR cross-rate derivation: amount ÷ source-per-EUR × target-per-EUR.</p></div><span class="q-status q-status--delayed">REFERENCE</span></div><div class="q-panel-body q-converter-form"><label class="q-setting"><span>Amount</span><input id="governed-convert-amount" type="number" min="0" step="any" value="1"></label><label class="q-setting"><span>From</span><select id="governed-convert-from">${currencies.map(option).join('')}</select></label><button class="q-swap-button" data-action="governed-swap" aria-label="Swap currencies">⇄</button><label class="q-setting"><span>To</span><select id="governed-convert-to">${currencies.map(option).join('')}</select></label><button class="q-button q-button--primary" data-action="governed-convert">Calculate reference</button></div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Calculated reference</h2><p>Source, observation and derivation remain visible.</p></div><span id="governed-convert-status" class="q-status q-status--cached">READY</span></div><div id="governed-convert-result" class="q-panel-body"></div></section></div>
    <section class="q-panel"><div class="q-panel-head"><div><h2>Evidence envelope</h2><p>Reference values are not live executable FX quotes.</p></div></div><div class="q-panel-body q-v7-evidence-strip"><span>Provider: European Central Bank</span><span>Observed: ${escapeHtml(formatTime(observedAt))}</span><span>Ingested: ${escapeHtml(formatTime(ingestedAt))}</span><span>Truth: ${escapeHtml(String(ecb?.truthState||'delayed_provider'))}</span><span>Execution: disabled</span></div></section>
  </section>`;
  const amount=main.querySelector('#governed-convert-amount');
  const from=main.querySelector('#governed-convert-from');
  const to=main.querySelector('#governed-convert-to');
  if(currencies.includes('USD'))from.value='USD';
  if(currencies.includes('INR'))to.value='INR';else if(currencies.includes('GBP'))to.value='GBP';
  const calculate=()=>{
    const input=Number(amount.value),sourceRate=Number(rates[from.value]),targetRate=Number(rates[to.value]);
    const target=Number.isFinite(input)&&input>=0&&sourceRate>0&&targetRate>0?(input/sourceRate)*targetRate:null;
    const cross=sourceRate>0&&targetRate>0?targetRate/sourceRate:null;
    main.querySelector('#governed-convert-result').innerHTML=target==null?'<div class="q-empty-state"><strong>Invalid reference input</strong><p>Enter a non-negative amount and choose currencies present in the ECB observation.</p></div>':`<div class="q-converter-result"><p>${escapeHtml(formatNumber(input))} <strong>${escapeHtml(from.value)}</strong></p><span>ECB reference conversion</span><h2>${escapeHtml(formatNumber(target))} ${escapeHtml(to.value)}</h2><dl><dt>Cross rate</dt><dd>${escapeHtml(formatNumber(cross))} ${escapeHtml(to.value)} per ${escapeHtml(from.value)}</dd><dt>Source</dt><dd>ECB euro foreign exchange reference rates</dd><dt>Observed</dt><dd>${escapeHtml(formatTime(observedAt))}</dd><dt>Tradable</dt><dd>No</dd></dl></div>`;
  };
  main.querySelector('[data-action="governed-convert"]')?.addEventListener('click',calculate);
  main.querySelector('[data-action="governed-swap"]')?.addEventListener('click',()=>{const value=from.value;from.value=to.value;to.value=value;calculate();});
  [amount,from,to].forEach((element)=>element?.addEventListener('change',calculate));
  calculate();
  toast?.('Converter uses ECB governed reference rates only.',{tone:'neutral'});
}

export async function renderGovernedTrustCenter(main,deps){
  const {api,pageHead,stateBanner,escapeHtml=safe}=deps;
  const [capabilitiesResult,providersResult,overviewResult]=await Promise.allSettled([
    api('/api/v1/platform/capabilities'),
    api('/api/v1/providers/status'),
    api('/api/v1/public/markets/overview')
  ]);
  const capabilities=capabilitiesResult.status==='fulfilled'?capabilitiesResult.value:{};
  const providers=providersResult.status==='fulfilled'?providersResult.value:{};
  const overview=overviewResult.status==='fulfilled'?overviewResult.value:{};
  const providerItems=Array.isArray(providers.providers)?providers.providers:[];
  const unavailable=Array.isArray(capabilities.unavailable)?capabilities.unavailable:[];
  main.innerHTML=`<section class="q-page q-governed-trust-center">
    ${pageHead('Qelly Intelligence · Trust and data governance','Production Trust Center','Runtime capability, provider-rights and no-fabrication boundaries from the canonical Cloudflare contracts.',professionalLinks())}${stateBanner()}
    <section class="q-v7-boundary-ribbon"><div><span>Providers registered</span><strong>${providerItems.length}</strong><small>Policy governed</small></div><div><span>Unavailable capabilities</span><strong>${unavailable.length}</strong><small>Explicit product states</small></div><div><span>Fabricated market fallback</span><strong>${overview?.guardrails?.fabricatedObservations===false?'OFF':'—'}</strong><small>No substitute observations</small></div><div><span>Execution</span><strong>DISABLED</strong><small>Read only</small></div></section>
    <div class="q-dashboard-grid"><section class="q-panel"><div class="q-panel-head"><div><h2>Provider policy matrix</h2><p>End-user display requires approved rights as well as technical integration.</p></div></div><div class="q-panel-body q-stack">${providerItems.map((provider)=>`<div class="q-record-row"><span><strong>${escapeHtml(String(provider.id||'provider').toUpperCase())}</strong><small>${escapeHtml(provider.termsState||provider.reason||'not supplied')}</small></span><span class="q-status q-status--${provider.enabled?'delayed':'unavailable'}">${provider.enabled?'ENABLED REFERENCE':'BLOCKED'}</span></div>`).join('')}</div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Unavailable capability registry</h2><p>Unavailable is a truthful runtime state, not an invitation to fabricate data.</p></div></div><div class="q-panel-body q-stack">${unavailable.slice(0,16).map((item)=>`<div class="q-record-row"><span><strong>${escapeHtml(item.label||item.id)}</strong><small>${escapeHtml(item.reason||item.category||'production dependency unavailable')}</small></span><span class="q-status q-status--unavailable">UNAVAILABLE</span></div>`).join('')||'<p>No unavailable inventory returned.</p>'}</div></section></div>
    <section class="q-panel"><div class="q-panel-head"><div><h2>Canonical runtime evidence</h2><p>Production contracts are inspectable without claiming external certification.</p></div></div><div class="q-panel-body"><pre class="q-json-evidence">${escapeHtml(JSON.stringify({releaseSha:providers.releaseSha||null,canonicalRuntime:'cloudflare-pages',marketTruth:overview.truthState||'UNAVAILABLE',fabricatedObservations:overview?.guardrails?.fabricatedObservations??false,execution:false},null,2))}</pre></div></section>
  </section>`;
}

export const __governedDiscoveryTest=Object.freeze({ROUTE_COPY});
