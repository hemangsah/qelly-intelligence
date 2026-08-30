const STYLE_ID='qelly-categories-v2-style';

function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const link=document.createElement('link');
  link.id=STYLE_ID;link.rel='stylesheet';link.href='./assets/routes/categories-v2.css?v=20260830-categories1';
  document.head.append(link);
}

const number=(value)=>Number.isFinite(Number(value))?Number(value):null;
const money=(value)=>number(value)==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(Number(value));
const percent=(value,{signed=true}={})=>number(value)==null?'—':`${signed&&Number(value)>0?'+':''}${Number(value).toFixed(2)}%`;
const stateTone=(value)=>['live','cached','delayed'].includes(String(value).toLowerCase())?String(value).toLowerCase():'unavailable';
const label=(value)=>String(value??'unavailable').replace(/[_-]+/g,' ').toUpperCase();
const dateLabel=(value)=>{const date=new Date(value||'');return Number.isNaN(date.getTime())?'Not supplied':date.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});};

function categoryCard(category,selected,compared,escapeHtml){
  const safe=(value)=>escapeHtml(String(value??''));
  const metrics=category.metrics||{};
  const coverage=metrics.memberCount?`${metrics.memberCount} observed ${metrics.memberCount===1?'member':'members'}`:'Definition ready · observations unavailable';
  return `<article class="q-ct-card" data-category-card="${safe(category.id)}" data-active="${selected}" data-covered="${metrics.memberCount>0}">
    <header><span>${safe(category.shortLabel||category.label.slice(0,2))}</span><div><p>${safe(label(category.lens))}</p><h3>${safe(category.label)}</h3></div><em>${safe(coverage)}</em></header>
    <p>${safe(category.purpose)}</p><dl><div><dt>Median 24h</dt><dd data-tone="${number(metrics.medianChange24hPct)>0?'positive':number(metrics.medianChange24hPct)<0?'negative':'neutral'}">${safe(percent(metrics.medianChange24hPct))}</dd></div><div><dt>Breadth</dt><dd>${safe(percent(metrics.breadthPct,{signed:false}))}</dd></div><div><dt>Market value</dt><dd>${safe(money(metrics.marketValueUsd))}</dd></div></dl>
    <footer><button type="button" data-category-open="${safe(category.id)}">Inspect category</button><label><input type="checkbox" data-category-compare="${safe(category.id)}" ${compared?'checked':''}><span>Compare</span></label></footer>
  </article>`;
}

function memberRows(category,escapeHtml){
  const safe=(value)=>escapeHtml(String(value??''));
  const members=Array.isArray(category.members)?category.members:[];
  if(!members.length)return '<div class="q-ct-empty"><strong>No attributed members in the current sample.</strong><p>The category definition remains visible, but Qelly inserts no market observations or substitute assets.</p></div>';
  return `<div class="q-ct-member-table" role="table" aria-label="${safe(category.label)} current members"><div role="row" class="is-head"><span>Member</span><span>24h</span><span>Market value</span><span>Turnover</span><span>Evidence</span></div>${members.map((row)=>`<div role="row"><span><b>${safe(row.symbol)}</b><small>${safe(row.name)}</small></span><span data-tone="${number(row.change24hPct)>0?'positive':number(row.change24hPct)<0?'negative':'neutral'}">${safe(percent(row.change24hPct))}</span><span>${safe(money(row.marketCapUsd))}</span><span>${safe(percent(row.turnoverPct,{signed:false}))}</span><span><i class="q-status q-status--${stateTone(row.truthState)}">${safe(label(row.truthState))}</i><a href="#/search?q=${encodeURIComponent(row.symbol)}">Find ${safe(row.symbol)}</a></span></div>`).join('')}</div>`;
}

function inspector(category,escapeHtml){
  const safe=(value)=>escapeHtml(String(value??''));
  const metrics=category.metrics||{};
  return `<header><div><p class="q-eyebrow">Selected research lens</p><h2>${safe(category.label)}</h2><p>${safe(category.purpose)}</p></div><span class="q-status q-status--${stateTone(category.truthState)}">${safe(label(category.truthState))}</span></header>
    <section class="q-ct-use"><div><strong>Use this category when</strong><p>${safe(category.useCase)}</p></div><div><strong>Primary risk lens</strong><p>${safe(category.riskLens)}</p></div></section>
    <section class="q-ct-metrics"><article><span>Members</span><strong>${safe(metrics.memberCount??0)}</strong><small>one primary role each</small></article><article><span>Median 24h</span><strong>${safe(percent(metrics.medianChange24hPct))}</strong><small>unweighted member median</small></article><article><span>Breadth</span><strong>${safe(percent(metrics.breadthPct,{signed:false}))}</strong><small>${safe(`${metrics.advancing??0} up · ${metrics.declining??0} down`)}</small></article><article><span>24h volume</span><strong>${safe(money(metrics.volume24hUsd))}</strong><small>attributed member sum</small></article><article><span>Turnover</span><strong>${safe(percent(metrics.turnoverPct,{signed:false}))}</strong><small>volume ÷ market value</small></article><article><span>Cross-source</span><strong>${safe(metrics.crossSourceMembers??0)}</strong><small>independent midpoint context</small></article></section>
    <section class="q-ct-questions"><div><p class="q-eyebrow">Questions this lens should answer</p><h3>Move from grouping to research.</h3></div><ol>${(category.questions||[]).map((question,index)=>`<li><span>0${index+1}</span><p>${safe(question)}</p></li>`).join('')}</ol><a href="#/news-research">Ask Qelly with evidence</a></section>
    <section><div class="q-ct-section-head"><div><p class="q-eyebrow">Current governed membership</p><h3>What is actually observed now</h3></div><small>Observed ${safe(dateLabel(category.observedAt))}</small></div>${memberRows(category,escapeHtml)}</section>`;
}

function compareMarkup(categories,escapeHtml){
  const safe=(value)=>escapeHtml(String(value??''));
  if(!categories.length)return '<div class="q-ct-empty"><strong>No comparison lenses selected.</strong><p>Add up to three categories. Comparison preserves their different purpose; it does not rank them as investments.</p></div>';
  return `<div class="q-ct-compare-table"><div class="is-head"><span>Lens</span><span>Members</span><span>Median 24h</span><span>Breadth</span><span>Market value</span><span>Research use</span></div>${categories.map((category)=>`<div><span><b>${safe(category.label)}</b><small>${safe(label(category.lens))}</small></span><span>${safe(category.metrics.memberCount)}</span><span>${safe(percent(category.metrics.medianChange24hPct))}</span><span>${safe(percent(category.metrics.breadthPct,{signed:false}))}</span><span>${safe(money(category.metrics.marketValueUsd))}</span><span>${safe(category.useCase)}</span></div>`).join('')}</div>`;
}

function sourceCards(sources,escapeHtml){
  const safe=(value)=>escapeHtml(String(value??''));
  if(!sources.length)return '<div class="q-ct-empty"><strong>Source ledger unavailable.</strong><p>Market metrics remain withheld until governed source metadata returns.</p></div>';
  return sources.map((source)=>`<article><header><div><strong>${safe(source.label)}</strong><small>${safe(source.role)}</small></div><span class="q-status q-status--${stateTone(source.truthState)}">${safe(label(source.truthState))}</span></header><dl><div><dt>Observed</dt><dd>${safe(dateLabel(source.observedAt))}</dd></div><div><dt>Fetched</dt><dd>${safe(dateLabel(source.fetchedAt))}</dd></div></dl><p>${safe(source.usage||'Governed source boundary supplied by the runtime.')}</p></article>`).join('');
}

export async function renderCategories(main,{api,escapeHtml,toast}){
  ensureStyles();
  let data;
  try{data=await api('/api/v1/discovery/categories');}
  catch(error){
    main.innerHTML=`<section class="q-ct-page"><div class="q-ct-error"><p class="q-eyebrow">Qelly Intelligence · Categories</p><h1>The governed taxonomy could not refresh.</h1><p>${escapeHtml(error.message)} No fixture categories or invented market values were substituted.</p><button type="button" data-category-retry>Retry</button><a href="#/discovery-hub">Open Discovery Overview</a></div></section>`;
    main.querySelector('[data-category-retry]').addEventListener('click',()=>void renderCategories(main,{api,escapeHtml,toast}));
    main.removeAttribute('aria-busy');return;
  }
  const categories=Array.isArray(data.categories)?data.categories:[];
  const readiness=data.readiness||{};
  const methodology=data.methodology||{};
  const safe=(value)=>escapeHtml(String(value??''));
  main.innerHTML=`<section class="q-ct-page" data-categories-experience="taxonomy-exploration-v2" data-category-state="${safe(data.state)}">
    <header class="q-ct-hero"><div><p class="q-eyebrow">Qelly Intelligence · Categories</p><h1>Understand what an asset is for before comparing what it did.</h1><p>${safe(data.job)}</p><div><a class="q-button q-button--secondary" href="#/discovery-hub">Frame a broad theme</a><a class="q-button q-button--primary" href="#/asset-rankings">Rank candidates</a></div></div><aside><span>Unique job · taxonomy-led exploration</span><strong>Categories explains the grouping.</strong><p>Search finds a known object. Rankings orders a sample. Categories organizes the same governed universe by primary economic role and exposes the question each group is designed to answer.</p></aside></header>
    <section class="q-ct-truth" role="status"><span></span><strong>Governed primary-role taxonomy</strong><p>${safe(readiness.classifiedCandidates??0)} of ${safe(readiness.totalCandidates??0)} observed candidates classified · no double-counting · fabricated fallback off</p><button type="button" data-category-method>Review method</button></section>
    <section class="q-ct-status" aria-label="Category coverage"><article><span>Defined lenses</span><strong>${safe(readiness.categoryCount??categories.length)}</strong><small>distinct economic jobs</small></article><article><span>Covered now</span><strong>${safe(readiness.coveredCategories??0)}</strong><small>at least one observed member</small></article><article><span>Classified</span><strong>${safe(readiness.classifiedCandidates??0)}</strong><small>one category per candidate</small></article><article><span>Needs review</span><strong>${safe(readiness.unclassifiedCandidates??0)}</strong><small>held outside named lenses</small></article><article><span>Recommendations</span><strong>0</strong><small>research taxonomy only</small></article></section>
    <section class="q-ct-explorer"><header><div><p class="q-eyebrow">Step 01 · choose a lens</p><h2>Browse by purpose, not by a duplicated leaderboard.</h2><p>Every category states what it is for, when to use it, and which risk question belongs with it.</p></div><div class="q-ct-controls"><label><span>Find a category</span><input type="search" data-category-search placeholder="Purpose, risk, or category"></label><label><span>Observation coverage</span><select data-category-coverage><option value="all">All definitions</option><option value="covered">Observed now</option><option value="empty">No current members</option></select></label></div></header><div class="q-ct-lenses" role="toolbar" aria-label="Category research lenses"><button type="button" data-category-lens="all" aria-pressed="true">All lenses</button>${(methodology.lenses||[]).map((lens)=>`<button type="button" data-category-lens="${safe(lens)}" aria-pressed="false">${safe(label(lens))}</button>`).join('')}</div><div class="q-ct-grid" data-category-grid></div></section>
    <section class="q-ct-workbench"><div class="q-ct-inspector" data-category-inspector></div><aside class="q-ct-tray"><header><p class="q-eyebrow">Step 02 · compare lenses</p><h2>Category comparison</h2><span><b data-category-compare-count>0</b> / 3 selected</span></header><p>Compare the composition and research purpose of categories without converting them into recommendations.</p><div data-category-compare-list></div><button type="button" data-category-clear>Clear comparison</button><a href="#/asset-rankings">Continue to criterion-based ranking</a></aside></section>
    <section class="q-ct-compare" data-category-comparison><header><div><p class="q-eyebrow">Step 03 · inspect differences</p><h2>Purpose-preserving comparison</h2></div><small>Current sample only · no category forecast</small></header><div data-category-compare-table>${compareMarkup([],escapeHtml)}</div></section>
    <section class="q-ct-method" data-category-methodology><div><p class="q-eyebrow">Method audit</p><h2>A versioned classification, not an improvised market narrative.</h2><p>${safe(methodology.classificationMode)}</p></div><ol><li><span>01</span><strong>Classify</strong><p>Symbols map to one documented primary economic role.</p></li><li><span>02</span><strong>Aggregate</strong><p>${safe(methodology.aggregation)}</p></li><li><span>03</span><strong>Review gaps</strong><p>${safe(methodology.reviewRule)}</p></li><li><span>04</span><strong>Hand off</strong><p>Categories frames the research lens; Rankings or Qelly Chat owns the next analytical job.</p></li></ol><footer><strong>${safe(methodology.version)}</strong><span>Current sample only</span><span>Primary role ≠ investment sector</span><span>No recommendation</span><span>No execution</span></footer></section>
    <section class="q-ct-sources"><header><div><p class="q-eyebrow">Source ledger</p><h2>Classification metadata and market observations stay distinguishable.</h2></div><span>${safe((data.sourceLedger||[]).length)} governed sources</span></header><div>${sourceCards(data.sourceLedger||[],escapeHtml)}</div></section>
    <section class="q-ct-distinctions"><header><p class="q-eyebrow">Choose the right surface</p><h2>Four connected jobs, each with a separate outcome.</h2></header><div><a href="#/discovery-hub"><b>Discovery Overview</b><span>Frame a theme</span><p>Start with a broad market question.</p></a><a href="#/categories"><b>Categories</b><span>Choose a taxonomy lens</span><p>Understand why assets belong together.</p></a><a href="#/asset-rankings"><b>Asset Rankings</b><span>Order candidates</span><p>Apply a declared numeric criterion.</p></a><a href="#/search"><b>Universal Search</b><span>Retrieve an object</span><p>Find a known symbol, method, or task.</p></a></div></section>
  </section>`;
  main.removeAttribute('aria-busy');

  let selected=categories.find((category)=>category.metrics?.memberCount>0)||categories[0]||null;
  const compared=new Set();
  let query='';
  let coverage='all';
  let lens='all';
  const grid=main.querySelector('[data-category-grid]');
  const compareList=main.querySelector('[data-category-compare-list]');

  const filtered=()=>categories.filter((category)=>{
    if(lens!=='all'&&category.lens!==lens)return false;
    if(coverage==='covered'&&!category.metrics?.memberCount)return false;
    if(coverage==='empty'&&category.metrics?.memberCount)return false;
    const haystack=`${category.label} ${category.purpose} ${category.useCase} ${category.riskLens}`.toLowerCase();
    return !query||haystack.includes(query);
  });
  const renderComparison=()=>{
    const rows=categories.filter((category)=>compared.has(category.id));
    main.querySelector('[data-category-compare-count]').textContent=String(rows.length);
    compareList.innerHTML=rows.length?rows.map((category)=>`<button type="button" data-category-open="${safe(category.id)}"><span>${safe(category.shortLabel)}</span><b>${safe(category.label)}</b><small>${safe(`${category.metrics.memberCount} members`)}</small></button>`).join(''):'<div class="q-ct-empty"><strong>Build a lens comparison.</strong><p>Select Compare on up to three category cards.</p></div>';
    main.querySelector('[data-category-compare-table]').innerHTML=compareMarkup(rows,escapeHtml);
  };
  const renderGrid=()=>{
    const rows=filtered();
    grid.innerHTML=rows.length?rows.map((category)=>categoryCard(category,category.id===selected?.id,compared.has(category.id),escapeHtml)).join(''):'<div class="q-ct-empty"><strong>No category matches these controls.</strong><p>Try another purpose word or reset the coverage and lens filters.</p></div>';
  };
  const select=(id)=>{const next=categories.find((category)=>category.id===id);if(!next)return;selected=next;main.querySelector('[data-category-inspector]').innerHTML=inspector(next,escapeHtml);renderGrid();};
  select(selected?.id);
  renderComparison();

  main.querySelector('[data-category-search]').addEventListener('input',(event)=>{query=event.target.value.trim().toLowerCase();renderGrid();});
  main.querySelector('[data-category-coverage]').addEventListener('change',(event)=>{coverage=event.target.value;renderGrid();});
  main.querySelectorAll('[data-category-lens]').forEach((button)=>button.addEventListener('click',()=>{lens=button.dataset.categoryLens;main.querySelectorAll('[data-category-lens]').forEach((item)=>item.setAttribute('aria-pressed',String(item===button)));renderGrid();}));
  main.addEventListener('click',(event)=>{
    const open=event.target.closest('[data-category-open]');
    if(open){select(open.dataset.categoryOpen);main.querySelector('[data-category-inspector]').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});return;}
    if(event.target.closest('[data-category-clear]')){compared.clear();renderComparison();renderGrid();}
  });
  grid.addEventListener('change',(event)=>{
    const input=event.target.closest('[data-category-compare]');if(!input)return;
    if(input.checked&&compared.size>=3){input.checked=false;toast?.('Compare up to three category lenses at a time.',{tone:'warning'});return;}
    input.checked?compared.add(input.dataset.categoryCompare):compared.delete(input.dataset.categoryCompare);
    renderComparison();renderGrid();
  });
  main.querySelector('[data-category-method]').addEventListener('click',()=>main.querySelector('[data-category-methodology]').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
}

export const __categoriesUiTest=Object.freeze({money,percent,stateTone});
