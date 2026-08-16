import {listFormulaDefinitions} from '../calculation/formula-engine-extended.mjs';

const CALCULATOR_DENSITY_STYLESHEET=new URL('../qelly-v54-calculator-progressive-density.css',import.meta.url).href;
const QUANT_V6_STYLESHEET=new URL('../qelly-v6-quant-workbench.css',import.meta.url).href;
const FEATURED_IDS=['position-size','risk-reward','cagr','black-scholes','kelly-criterion','maximum-drawdown'];
const titleCase=(value)=>String(value||'General').replaceAll('-',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());
const domainOf=(definition)=>definition.domain??definition.category??'general';
const fieldCount=(definition)=>Object.keys(definition.inputSchema?.properties??{}).length;
const requiredCount=(definition)=>Array.isArray(definition.inputSchema?.required)?definition.inputSchema.required.length:0;

function activateCalculatorDensity(){
  for(const [selector,href,dataset] of [
    ['link[data-qelly-v54-calculator-density="active"]',CALCULATOR_DENSITY_STYLESHEET,'qellyV54CalculatorDensity'],
    ['link[data-qelly-v6-quant-workbench="active"]',QUANT_V6_STYLESHEET,'qellyV6QuantWorkbench']
  ]){
    if(document.querySelector(selector))continue;
    const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset[dataset]='active';document.head.append(link);
  }
}

export async function renderCalculatorCenter(main,{pageHead,escapeHtml,navigate}){
  activateCalculatorDensity();
  const definitions=listFormulaDefinitions().sort((a,b)=>a.name.localeCompare(b.name));
  const domains=[...new Set(definitions.map(domainOf))].sort();
  const versioned=definitions.filter((definition)=>definition.version||definition.formulaVersion).length;
  const averageFields=definitions.length?Math.round(definitions.reduce((sum,definition)=>sum+fieldCount(definition),0)/definitions.length):0;
  const card=(definition,{featured=false}={})=>`<a class="q-calculator-card q-v6-workbench-card${featured?' is-featured':''}" href="#/calculator-detail/${encodeURIComponent(definition.formulaId)}" data-calculator-id="${escapeHtml(definition.formulaId)}">
    <div class="q-calculator-card__meta"><span>${escapeHtml(titleCase(domainOf(definition)))}</span><span>${fieldCount(definition)} fields</span></div>
    <h3>${escapeHtml(definition.name)}</h3>
    <p>${escapeHtml(definition.description)}</p>
    <div class="q-v6-quant-method-strip"><span>${escapeHtml(definition.formulaId)}</span><span>${escapeHtml(String(definition.version||definition.formulaVersion||'versioned'))}</span><span>read-only</span></div>
    <div class="q-calculator-card__footer"><span>${requiredCount(definition)} required · structured inputs</span><strong>Open calculator <span aria-hidden="true">→</span></strong></div>
  </a>`;
  const featured=FEATURED_IDS.map((id)=>definitions.find((item)=>item.formulaId===id)).filter(Boolean);
  const featuredLabel=`${featured.length} priority ${featured.length===1?'workflow':'workflows'}`;

  main.innerHTML=`<section class="q-page q-calculator-center-page q-calculator-workbench-page">
    ${pageHead('Deterministic quantitative workbench','Calculators','Choose a versioned method, enter explicit inputs and review explainable outputs. Qelly calculations are deterministic local computation; they are not simulated market data.',`<button class="q-button q-button--ghost" data-action="formula-library">Browse methodology</button><button class="q-button q-button--secondary" data-action="saved">Saved work</button>`)}
    <div class="q-v6-deterministic-banner"><span class="q-status q-status--deterministic">DETERMINISTIC LOCAL</span><p>Calculations run in your browser from the values you provide. No provider quote, broker account, exchange credential, custody service or execution path is consulted. If cloud sync is opted in, an explicit Save can synchronize the resulting record through the authenticated RLS workspace.</p></div>
    <section class="q-v6-quant-kpis" aria-label="Calculator library evidence"><div><span>Methods</span><strong>${definitions.length}</strong><small>registered deterministic calculators</small></div><div><span>Domains</span><strong>${domains.length}</strong><small>quantitative categories</small></div><div><span>Versioned</span><strong>${versioned}/${definitions.length}</strong><small>method identity exposed</small></div><div><span>Typical inputs</span><strong>${averageFields}</strong><small>average structured fields</small></div><div><span>Execution</span><strong>OFF</strong><small>analysis only</small></div></section>

    <section class="q-calculator-featured" aria-labelledby="calculator-featured-title">
      <div class="q-calculator-section-head"><div><p class="q-eyebrow">Priority workflows</p><h2 id="calculator-featured-title">Start with a proven calculation</h2><p>Common risk, return, portfolio and derivative methods with structured inputs and version-aware evidence.</p></div><span class="q-truth-pill is-cached">${featuredLabel}</span></div>
      <div class="q-calculator-card-grid is-featured">${featured.map((definition)=>card(definition,{featured:true})).join('')}</div>
    </section>

    <details id="calculator-complete-library" class="q-calculator-library-disclosure">
      <summary aria-controls="calculator-library-panel">
        <span class="q-calculator-library-disclosure__copy"><span class="q-eyebrow">Complete deterministic library</span><strong>Browse all ${definitions.length} calculators</strong><small>Open the full catalog when you need a less common quantitative workflow.</small></span>
        <span class="q-calculator-library-disclosure__action" aria-hidden="true">Open library <span>↓</span></span>
      </summary>
      <section id="calculator-library-panel" class="q-calculator-browser" aria-labelledby="calculator-browser-title">
        <div class="q-calculator-section-head"><div><p class="q-eyebrow">Complete library</p><h2 id="calculator-browser-title">Find the right method</h2><p class="q-v6-catalog-note">Search by name, purpose, stable formula ID or domain. Opening a calculator does not fetch market data implicitly.</p></div><span id="calculator-result-count" class="q-truth-pill is-cached">${definitions.length} tools</span></div>
        <div class="q-calculator-browser__toolbar">
          <label><span>Search calculators</span><input id="calculator-search" type="search" placeholder="Position size, CAGR, options, drawdown…" autocomplete="off"></label>
          <label><span>Category</span><select id="calculator-domain"><option value="">All categories</option>${domains.map((domain)=>`<option value="${escapeHtml(domain)}">${escapeHtml(titleCase(domain))}</option>`).join('')}</select></label>
        </div>
        <div id="calculator-catalog" class="q-calculator-card-grid" aria-live="polite"></div>
        <div id="calculator-empty" class="q-calculator-empty" hidden><h3>No calculator matches those filters</h3><p>Clear the search or choose another category.</p><button class="q-button q-button--secondary" type="button" data-action="clear-filters">Clear filters</button></div>
      </section>
    </details>
  </section>`;

  const disclosure=main.querySelector('#calculator-complete-library');
  const search=main.querySelector('#calculator-search'),domain=main.querySelector('#calculator-domain'),catalog=main.querySelector('#calculator-catalog'),count=main.querySelector('#calculator-result-count'),empty=main.querySelector('#calculator-empty');
  let catalogMaterialized=false;
  const render=()=>{
    if(!catalogMaterialized&&!disclosure.open)return;
    catalogMaterialized=true;
    const query=search.value.trim().toLowerCase(),category=domain.value;
    const filtered=definitions.filter((definition)=>{const itemDomain=domainOf(definition);return(!category||itemDomain===category)&&(!query||`${definition.name} ${definition.description} ${definition.formulaId} ${itemDomain}`.toLowerCase().includes(query));});
    catalog.innerHTML=filtered.map((definition)=>card(definition)).join('');
    count.textContent=`${filtered.length} ${filtered.length===1?'tool':'tools'}`;
    empty.hidden=filtered.length>0;
    catalog.hidden=filtered.length===0;
  };
  disclosure.addEventListener('toggle',()=>{if(disclosure.open)render();});
  search.addEventListener('input',render);
  domain.addEventListener('change',render);
  main.querySelector('[data-action="clear-filters"]').addEventListener('click',()=>{search.value='';domain.value='';render();search.focus();});
  main.querySelector('[data-action="formula-library"]').addEventListener('click',()=>navigate('formula-library'));
  main.querySelector('[data-action="saved"]').addEventListener('click',()=>navigate('saved-calculations'));
}
