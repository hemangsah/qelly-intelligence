import {listFormulaDefinitions} from '../calculation/formula-engine-extended.mjs';

const CALCULATOR_DENSITY_STYLESHEET=new URL('../qelly-v54-calculator-progressive-density.css',import.meta.url).href;
const FEATURED_IDS=['position-size','risk-reward','cagr','black-scholes','kelly-criterion','maximum-drawdown'];
const titleCase=(value)=>String(value||'General').replaceAll('-',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());
const domainOf=(definition)=>definition.domain??definition.category??'general';
const fieldCount=(definition)=>Object.keys(definition.inputSchema?.properties??{}).length;
const requiredCount=(definition)=>Array.isArray(definition.inputSchema?.required)?definition.inputSchema.required.length:0;

function activateCalculatorDensity(){
  if(document.querySelector('link[data-qelly-v54-calculator-density="active"]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=CALCULATOR_DENSITY_STYLESHEET;
  link.dataset.qellyV54CalculatorDensity='active';
  document.head.append(link);
}

export async function renderCalculatorCenter(main,{pageHead,escapeHtml,navigate}){
  activateCalculatorDensity();
  const definitions=listFormulaDefinitions().sort((a,b)=>a.name.localeCompare(b.name));
  const domains=[...new Set(definitions.map(domainOf))].sort();
  const card=(definition,{featured=false}={})=>`<a class="q-calculator-card${featured?' is-featured':''}" href="#/calculator-detail/${encodeURIComponent(definition.formulaId)}" data-calculator-id="${escapeHtml(definition.formulaId)}">
    <div class="q-calculator-card__meta"><span>${escapeHtml(titleCase(domainOf(definition)))}</span><span>${fieldCount(definition)} fields</span></div>
    <h3>${escapeHtml(definition.name)}</h3>
    <p>${escapeHtml(definition.description)}</p>
    <div class="q-calculator-card__footer"><span>${requiredCount(definition)} required · structured inputs</span><strong>Open calculator <span aria-hidden="true">→</span></strong></div>
  </a>`;
  const featured=FEATURED_IDS.map((id)=>definitions.find((item)=>item.formulaId===id)).filter(Boolean);
  const featuredLabel=`${featured.length} priority ${featured.length===1?'workflow':'workflows'}`;

  main.innerHTML=`<section class="q-page q-calculator-center-page q-calculator-workbench-page">
    ${pageHead('Deterministic analysis tools','Calculators','Choose a documented method, enter clear structured inputs and review explainable outputs. Advanced JSON remains available only inside each calculator when a complex input requires it.',`<button class="q-button q-button--ghost" data-action="formula-library">Browse methodology</button><button class="q-button q-button--secondary" data-action="saved">Saved work</button>`)}
    <div class="q-state-banner is-simulated"><span class="q-status q-status--simulated">DETERMINISTIC LOCAL</span><p>Calculations run in your browser using versioned Qelly formulas. No broker, exchange, custody account or private market-data key is required.</p></div>

    <section class="q-calculator-featured" aria-labelledby="calculator-featured-title">
      <div class="q-calculator-section-head"><div><p class="q-eyebrow">Popular workflows</p><h2 id="calculator-featured-title">Start with a proven calculation</h2><p>Common risk, return, portfolio and derivative tools with human-readable fields.</p></div><span class="q-truth-pill is-cached">${featuredLabel}</span></div>
      <div class="q-calculator-card-grid is-featured">${featured.map((definition)=>card(definition,{featured:true})).join('')}</div>
    </section>

    <details id="calculator-complete-library" class="q-calculator-library-disclosure">
      <summary aria-controls="calculator-library-panel">
        <span class="q-calculator-library-disclosure__copy"><span class="q-eyebrow">Complete deterministic library</span><strong>Browse all ${definitions.length} calculators</strong><small>Open the full catalog only when you need a less common quantitative workflow.</small></span>
        <span class="q-calculator-library-disclosure__action" aria-hidden="true">Open library <span>↓</span></span>
      </summary>
      <section id="calculator-library-panel" class="q-calculator-browser" aria-labelledby="calculator-browser-title">
        <div class="q-calculator-section-head"><div><p class="q-eyebrow">Complete library</p><h2 id="calculator-browser-title">Find the right calculator</h2><p>Search ${definitions.length} deterministic methods by name, purpose or category.</p></div><span id="calculator-result-count" class="q-truth-pill is-cached">${definitions.length} tools</span></div>
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
