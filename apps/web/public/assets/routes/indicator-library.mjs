import {listIndicatorDefinitions} from '../calculation/indicator-engine-extended.mjs';

const INDICATOR_DENSITY_STYLESHEET=new URL('../qelly-v54-indicator-progressive-density.css',import.meta.url).href;
const QUANT_V6_STYLESHEET=new URL('../qelly-v6-quant-workbench.css',import.meta.url).href;
const FEATURED_IDS=['rsi','macd','bollinger-bands','atr','vwap','fresh-rolling-z-score'];
const titleCase=(value)=>String(value||'General').replaceAll('-',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());

function activateIndicatorDensity(){
  for(const [selector,href,dataset] of [
    ['link[data-qelly-v54-indicator-density="active"]',INDICATOR_DENSITY_STYLESHEET,'qellyV54IndicatorDensity'],
    ['link[data-qelly-v6-quant-workbench="active"]',QUANT_V6_STYLESHEET,'qellyV6QuantWorkbench']
  ]){
    if(document.querySelector(selector))continue;
    const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset[dataset]='active';document.head.append(link);
  }
}

export async function renderIndicatorLibrary(main,{pageHead,escapeHtml,navigate}){
  activateIndicatorDensity();
  const definitions=listIndicatorDefinitions().sort((a,b)=>a.name.localeCompare(b.name));
  const categories=[...new Set(definitions.map((item)=>item.category))].sort();
  const versioned=definitions.filter((definition)=>definition.version||definition.indicatorVersion).length;
  const withReference=definitions.filter((definition)=>definition.referenceVector?.inputs).length;
  const card=(definition,{featured=false}={})=>{
    const requiredFields=definition.requiredFields.join(', ');
    return `<a class="q-calculator-card q-indicator-card q-v6-workbench-card${featured?' is-featured':''}" href="#/indicator-detail/${encodeURIComponent(definition.indicatorId)}" data-indicator-id="${escapeHtml(definition.indicatorId)}">
      <div class="q-calculator-card__meta"><span>${escapeHtml(titleCase(definition.category))}</span><span>${definition.requiredFields.length} data fields</span></div>
      <h3>${escapeHtml(definition.name)}</h3>
      <p>${escapeHtml(definition.referenceMethod??definition.reference??'Deterministic technical-analysis methodology using explicitly supplied market history.')}</p>
      <div class="q-v6-quant-method-strip"><span>${escapeHtml(definition.indicatorId)}</span><span>${escapeHtml(String(definition.version||definition.indicatorVersion||'versioned'))}</span><span>${definition.referenceVector?.inputs?'reference vector':'sample contract'}</span></div>
      <div class="q-calculator-card__footer"><span title="${escapeHtml(requiredFields)}">${escapeHtml(requiredFields)}</span><strong>View methodology <span aria-hidden="true">→</span></strong></div>
    </a>`;
  };
  const featured=FEATURED_IDS.map((id)=>definitions.find((item)=>item.indicatorId===id)).filter(Boolean);
  const featuredLabel=`${featured.length} priority ${featured.length===1?'study':'studies'}`;

  main.innerHTML=`<section class="q-page q-calculator-center-page q-indicator-center-page q-indicator-workbench-page">
    ${pageHead('Deterministic technical-analysis workbench','Indicators','Explore versioned trend, momentum, volatility, volume and statistical studies. Indicator engines consume explicitly supplied OHLCV/history; the library itself does not imply a live market feed.',`<button class="q-button q-button--secondary" data-action="formula-library">Browse formulas</button>`)}
    <div class="q-v6-indicator-truth"><span class="q-status q-status--deterministic">DETERMINISTIC ENGINE</span><p>Detail pages evaluate either a governed reference vector or a clearly labeled presentation sample. Those sample observations are evidence for engine behavior, not live market data, recommendations or execution signals.</p></div>
    <section class="q-v6-quant-kpis" aria-label="Indicator library evidence"><div><span>Studies</span><strong>${definitions.length}</strong><small>registered indicator engines</small></div><div><span>Categories</span><strong>${categories.length}</strong><small>technical/statistical groups</small></div><div><span>Versioned</span><strong>${versioned}/${definitions.length}</strong><small>method identity exposed</small></div><div><span>Reference vectors</span><strong>${withReference}</strong><small>governed sample evidence</small></div><div><span>Execution</span><strong>OFF</strong><small>descriptive analysis only</small></div></section>

    <section class="q-calculator-featured" aria-labelledby="indicator-featured-title">
      <div class="q-calculator-section-head"><div><p class="q-eyebrow">Priority studies</p><h2 id="indicator-featured-title">Start with a familiar methodology</h2><p>Review required data, warm-up behavior, output alignment and interpretation limits before using a study.</p></div><span class="q-truth-pill is-cached">${featuredLabel}</span></div>
      <div class="q-calculator-card-grid is-featured">${featured.map((definition)=>card(definition,{featured:true})).join('')}</div>
    </section>

    <details id="indicator-complete-library" class="q-indicator-library-disclosure">
      <summary aria-controls="indicator-library-panel">
        <span class="q-indicator-library-disclosure__copy"><span class="q-eyebrow">Complete governed library</span><strong>Browse all ${definitions.length} deterministic indicators</strong><small>Open the full catalog when you need a less common technical or statistical study.</small></span>
        <span class="q-indicator-library-disclosure__action" aria-hidden="true">Open library <span>↓</span></span>
      </summary>
      <section id="indicator-library-panel" class="q-calculator-browser" aria-labelledby="indicator-browser-title">
        <div class="q-calculator-section-head"><div><p class="q-eyebrow">Complete library</p><h2 id="indicator-browser-title">Find an indicator</h2><p class="q-v6-catalog-note">Search by method name, stable indicator ID, category or required input field. No market source is fetched implicitly.</p></div><span id="indicator-result-count" class="q-truth-pill is-cached">${definitions.length} studies</span></div>
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
