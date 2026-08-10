import {listIndicatorDefinitions} from '../calculation/indicator-engine-extended.mjs';

const INDICATOR_DENSITY_STYLESHEET=new URL('../qelly-v54-indicator-progressive-density.css',import.meta.url).href;
const FEATURED_IDS=['rsi','macd','bollinger-bands','atr','vwap','fresh-rolling-z-score'];
const titleCase=(value)=>String(value||'General').replaceAll('-',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());

function activateIndicatorDensity(){
  if(document.querySelector('link[data-qelly-v54-indicator-density="active"]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=INDICATOR_DENSITY_STYLESHEET;
  link.dataset.qellyV54IndicatorDensity='active';
  document.head.append(link);
}

export async function renderIndicatorLibrary(main,{pageHead,escapeHtml,navigate}){
  activateIndicatorDensity();
  const definitions=listIndicatorDefinitions().sort((a,b)=>a.name.localeCompare(b.name));
  const categories=[...new Set(definitions.map((item)=>item.category))].sort();
  const card=(definition,{featured=false}={})=>{
    const requiredFields=definition.requiredFields.join(', ');
    return `<a class="q-calculator-card q-indicator-card${featured?' is-featured':''}" href="#/indicator-detail/${encodeURIComponent(definition.indicatorId)}" data-indicator-id="${escapeHtml(definition.indicatorId)}">
      <div class="q-calculator-card__meta"><span>${escapeHtml(titleCase(definition.category))}</span><span>${definition.requiredFields.length} data fields</span></div>
      <h3>${escapeHtml(definition.name)}</h3>
      <p>${escapeHtml(definition.referenceMethod??definition.reference??'Deterministic technical-analysis methodology using user-provided market history.')}</p>
      <div class="q-calculator-card__footer"><span title="${escapeHtml(requiredFields)}">${escapeHtml(requiredFields)}</span><strong>View methodology <span aria-hidden="true">→</span></strong></div>
    </a>`;
  };
  const featured=FEATURED_IDS.map((id)=>definitions.find((item)=>item.indicatorId===id)).filter(Boolean);
  const featuredLabel=`${featured.length} priority ${featured.length===1?'study':'studies'}`;

  main.innerHTML=`<section class="q-page q-calculator-center-page q-indicator-center-page q-indicator-workbench-page">
    ${pageHead('Deterministic market studies','Indicators','Explore documented trend, momentum, volatility, volume and statistical studies. Every methodology uses user-provided OHLCV and preserves warm-up and alignment rules.',`<button class="q-button q-button--secondary" data-action="formula-library">Browse formulas</button>`)}
    <div class="q-state-banner is-simulated"><span class="q-status q-status--simulated">USER-PROVIDED MARKET HISTORY</span><p>Qelly does not imply order-book, liquidation, options-chain or on-chain inputs when those sources are unavailable. Each detail page shows exactly which fields are required.</p></div>

    <section class="q-calculator-featured" aria-labelledby="indicator-featured-title">
      <div class="q-calculator-section-head"><div><p class="q-eyebrow">Widely used studies</p><h2 id="indicator-featured-title">Start with a familiar indicator</h2><p>Open a study to review its inputs, warm-up behavior, interpretation limits and deterministic sample evidence.</p></div><span class="q-truth-pill is-cached">${featuredLabel}</span></div>
      <div class="q-calculator-card-grid is-featured">${featured.map((definition)=>card(definition,{featured:true})).join('')}</div>
    </section>

    <details id="indicator-complete-library" class="q-indicator-library-disclosure">
      <summary aria-controls="indicator-library-panel">
        <span class="q-indicator-library-disclosure__copy"><span class="q-eyebrow">Complete governed library</span><strong>Browse all ${definitions.length} deterministic indicators</strong><small>Open the full catalog only when you need a less common technical or statistical study.</small></span>
        <span class="q-indicator-library-disclosure__action" aria-hidden="true">Open library <span>↓</span></span>
      </summary>
      <section id="indicator-library-panel" class="q-calculator-browser" aria-labelledby="indicator-browser-title">
        <div class="q-calculator-section-head"><div><p class="q-eyebrow">Complete library</p><h2 id="indicator-browser-title">Find an indicator</h2><p>Search ${definitions.length} studies by name, category or required data.</p></div><span id="indicator-result-count" class="q-truth-pill is-cached">${definitions.length} studies</span></div>
        <div class="q-calculator-browser__toolbar">
          <label><span>Search indicators</span><input id="indicator-search" type="search" placeholder="RSI, MACD, volatility, volume…" autocomplete="off"></label>
          <label><span>Category</span><select id="indicator-category"><option value="">All categories</option>${categories.map((category)=>`<option value="${escapeHtml(category)}">${escapeHtml(titleCase(category))}</option>`).join('')}</select></label>
        </div>
        <div id="indicator-catalog" class="q-calculator-card-grid" aria-live="polite"></div>
        <div id="indicator-empty" class="q-calculator-empty" hidden><h3>No indicator matches those filters</h3><p>Clear the search or choose another category.</p><button class="q-button q-button--secondary" type="button" data-action="clear-filters">Clear filters</button></div>
      </section>
    </details>
  </section>`;

  const disclosure=main.querySelector('#indicator-complete-library');
  const search=main.querySelector('#indicator-search'),category=main.querySelector('#indicator-category'),catalog=main.querySelector('#indicator-catalog'),count=main.querySelector('#indicator-result-count'),empty=main.querySelector('#indicator-empty');
  let catalogMaterialized=false;
  const render=()=>{
    if(!catalogMaterialized&&!disclosure.open)return;
    catalogMaterialized=true;
    const query=search.value.trim().toLowerCase(),selectedCategory=category.value;
    const filtered=definitions.filter((definition)=>(!selectedCategory||definition.category===selectedCategory)&&(!query||`${definition.name} ${definition.indicatorId} ${definition.category} ${definition.requiredFields.join(' ')}`.toLowerCase().includes(query)));
    catalog.innerHTML=filtered.map((definition)=>card(definition)).join('');
    count.textContent=`${filtered.length} ${filtered.length===1?'study':'studies'}`;
    empty.hidden=filtered.length>0;
    catalog.hidden=filtered.length===0;
  };
  disclosure.addEventListener('toggle',()=>{if(disclosure.open)render();});
  search.addEventListener('input',render);
  category.addEventListener('change',render);
  main.querySelector('[data-action="clear-filters"]').addEventListener('click',()=>{search.value='';category.value='';render();search.focus();});
  main.querySelector('[data-action="formula-library"]').addEventListener('click',()=>navigate('formula-library'));
}
