import {listFormulaDefinitions} from '../calculation/formula-engine-extended.mjs';

const FORMULA_DENSITY_STYLESHEET=new URL('../qelly-v54-formula-progressive-density.css',import.meta.url).href;
const FEATURED_IDS=['position-size','cagr','black-scholes','portfolio-volatility','kelly-criterion','emi'];
const titleCase=(value)=>String(value||'General').replaceAll('-',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());
const fieldCount=(definition)=>Object.keys(definition.inputSchema?.properties??{}).length;

function activateFormulaDensity(){
  if(document.querySelector('link[data-qelly-v54-formula-density="active"]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=FORMULA_DENSITY_STYLESHEET;
  link.dataset.qellyV54FormulaDensity='active';
  document.head.append(link);
}

export async function renderFormulaLibrary(main,{pageHead,escapeHtml,navigate}){
  activateFormulaDensity();
  const formulas=listFormulaDefinitions().sort((a,b)=>a.name.localeCompare(b.name));
  const domains=[...new Set(formulas.map((item)=>item.domain??item.category??'general'))].sort();
  const card=(definition,{featured=false}={})=>`<a class="q-calculator-card q-formula-card${featured?' is-featured':''}" href="#/formula-detail/${encodeURIComponent(definition.formulaId)}" data-formula-id="${escapeHtml(definition.formulaId)}">
    <div class="q-calculator-card__meta"><span>${escapeHtml(titleCase(definition.domain??definition.category))}</span><span>${fieldCount(definition)} inputs</span></div>
    <h3>${escapeHtml(definition.name)}</h3>
    <p>${escapeHtml(definition.description)}</p>
    <div class="q-calculator-card__footer"><span>${definition.externalProviderRequired?'Provider-dependent':'Your inputs only'}</span><strong>View method <span aria-hidden="true">→</span></strong></div>
  </a>`;
  const featured=FEATURED_IDS.map((id)=>formulas.find((item)=>item.formulaId===id)).filter(Boolean);

  main.innerHTML=`<section class="q-page q-calculator-center-page q-formula-center-page">
    ${pageHead('Quantitative methodology','Formulas','Browse documented risk, return, portfolio, derivatives, fixed-income and personal-finance methods. Each formula explains its assumptions before you open the structured calculator.',`<button class="q-button q-button--primary" data-action="open-calculators">Open calculators</button><button class="q-button q-button--secondary" data-action="open-indicators">Browse indicators</button>`)}
    <div class="q-state-banner is-simulated"><span class="q-status q-status--simulated">DETERMINISTIC METHODS</span><p>Formula results use the values you provide. They do not place trades, move funds or convert an illustrative output into personalized advice.</p></div>

    <section class="q-calculator-featured" aria-labelledby="formula-featured-title">
      <div class="q-calculator-section-head"><div><p class="q-eyebrow">Popular methodologies</p><h2 id="formula-featured-title">Understand the method before calculating</h2><p>Start with a governed method, inspect assumptions and units, then move into the structured calculator.</p></div><span class="q-truth-pill is-cached">6 priority methods</span></div>
      <div class="q-calculator-card-grid is-featured">${featured.map((definition)=>card(definition,{featured:true})).join('')}</div>
    </section>

    <details id="formula-complete-library" class="q-formula-library-disclosure">
      <summary aria-controls="formula-library-panel">
        <span class="q-formula-library-disclosure__copy"><span class="q-eyebrow">Complete governed library</span><strong>Browse all ${formulas.length} quantitative methods</strong><small>Search by method, purpose or financial domain only when you need the full catalog.</small></span>
        <span class="q-formula-library-disclosure__action" aria-hidden="true">Open library <span>↓</span></span>
      </summary>
      <section id="formula-library-panel" class="q-calculator-browser" aria-labelledby="formula-browser-title">
        <div class="q-calculator-section-head"><div><p class="q-eyebrow">Complete library</p><h2 id="formula-browser-title">Find a formula</h2><p>Search ${formulas.length} methods by name, purpose or financial domain.</p></div><span id="formula-result-count" class="q-truth-pill is-cached">${formulas.length} methods</span></div>
        <div class="q-calculator-browser__toolbar">
          <label><span>Search formulas</span><input id="formula-search" type="search" placeholder="Position sizing, CAGR, options, bonds…" autocomplete="off"></label>
          <label><span>Domain</span><select id="formula-domain"><option value="">All domains</option>${domains.map((domain)=>`<option value="${escapeHtml(domain)}">${escapeHtml(titleCase(domain))}</option>`).join('')}</select></label>
        </div>
        <div id="formula-catalog" class="q-calculator-card-grid" aria-live="polite"></div>
        <div id="formula-empty" class="q-calculator-empty" hidden><h3>No formula matches those filters</h3><p>Clear the search or choose another domain.</p><button class="q-button q-button--secondary" type="button" data-action="clear-filters">Clear filters</button></div>
      </section>
    </details>
  </section>`;

  const disclosure=main.querySelector('#formula-complete-library');
  const search=main.querySelector('#formula-search'),domain=main.querySelector('#formula-domain'),catalog=main.querySelector('#formula-catalog'),count=main.querySelector('#formula-result-count'),empty=main.querySelector('#formula-empty');
  let catalogMaterialized=false;
  const render=()=>{
    if(!catalogMaterialized&&!disclosure.open)return;
    catalogMaterialized=true;
    const query=search.value.trim().toLowerCase(),selectedDomain=domain.value;
    const filtered=formulas.filter((definition)=>{const itemDomain=definition.domain??definition.category??'general';return(!selectedDomain||itemDomain===selectedDomain)&&(!query||`${definition.name} ${definition.formulaId} ${itemDomain} ${definition.description}`.toLowerCase().includes(query));});
    catalog.innerHTML=filtered.map((definition)=>card(definition)).join('');
    count.textContent=`${filtered.length} ${filtered.length===1?'method':'methods'}`;
    empty.hidden=filtered.length>0;
    catalog.hidden=filtered.length===0;
  };
  disclosure.addEventListener('toggle',()=>{if(disclosure.open)render();});
  search.addEventListener('input',render);
  domain.addEventListener('change',render);
  main.querySelector('[data-action="clear-filters"]').addEventListener('click',()=>{search.value='';domain.value='';render();search.focus();});
  main.querySelector('[data-action="open-calculators"]').addEventListener('click',()=>navigate('calculator-center'));
  main.querySelector('[data-action="open-indicators"]').addEventListener('click',()=>navigate('indicator-library'));
}
