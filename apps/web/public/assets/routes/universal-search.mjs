const STYLE_ID='qelly-universal-search-v2-style';
const TYPES=Object.freeze([
  {id:'all',label:'Everything',job:'Search the complete public catalog.'},
  {id:'asset',label:'Assets',job:'Find an attributed instrument observation.'},
  {id:'feature',label:'Features',job:'Find the Qelly workspace built for a task.'},
  {id:'formula',label:'Formulas',job:'Find a deterministic calculation method.'},
  {id:'indicator',label:'Indicators',job:'Find a governed technical study.'}
]);

function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const link=document.createElement('link');
  link.id=STYLE_ID;link.rel='stylesheet';link.href='./assets/routes/universal-search-v2.css?v=20260830-search2';
  document.head.append(link);
}

const tone=(state)=>['live','cached','delayed'].includes(String(state).toLowerCase())?String(state).toLowerCase():String(state).toLowerCase()==='unavailable'?'unavailable':'cached';
const label=(value)=>String(value??'unknown').replace(/[_-]+/g,' ').toUpperCase();
const dateLabel=(value)=>{const date=new Date(value||'');return Number.isNaN(date.getTime())?'Not supplied':date.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});};
const routeHref=(route)=>`#/${String(route||'feature-universe').replace(/^#\/?/,'')}`;

function emptyState(query){
  return `<div class="q-us-empty"><span>0 exact objects</span><h2>${query?'No governed match for this query.':'The catalog is preparing.'}</h2><p>${query?'Try a symbol, feature purpose, formula name, indicator, or a shorter task phrase. Missing results are never invented.':'Qelly is loading the governed catalog. No placeholder result will be inserted.'}</p><button type="button" data-search-reset>Reset search</button></div>`;
}

function resultCard(item,escapeHtml){
  const safe=(value)=>escapeHtml(String(value??''));
  const access=item.access==='workspace'?'SIGN IN':'PUBLIC';
  return `<article class="q-us-result" data-search-result="${safe(item.id)}">
    <a href="${safe(routeHref(item.route))}" data-search-open="${safe(item.route)}">
      <span class="q-us-type">${safe(item.type.slice(0,2).toUpperCase())}</span>
      <span class="q-us-copy"><span><b>${safe(item.title)}</b><em>${safe(access)}</em></span><small>${safe(item.subtitle)}</small><p>${safe(item.purpose)}</p><strong>${safe(item.whyMatched)} · relevance ${safe(item.score)}</strong></span>
      <span class="q-us-open">Open <b>↗</b></span>
    </a>
    <button type="button" data-search-inspect="${safe(item.id)}" aria-label="Inspect evidence for ${safe(item.title)}">Evidence</button>
  </article>`;
}

function inspectorMarkup(item,escapeHtml){
  const safe=(value)=>escapeHtml(String(value??''));
  const evidence=Object.entries(item.evidence||{}).filter(([,value])=>value!==null&&value!==undefined);
  return `<p class="q-eyebrow">Result evidence</p><h2>${safe(item.title)}</h2><p>${safe(item.purpose)}</p><section><strong>Use this when</strong><p>${safe(item.useCase)}</p></section><dl><div><dt>Object type</dt><dd>${safe(label(item.type))}</dd></div><div><dt>Access</dt><dd>${safe(label(item.access))}</dd></div><div><dt>Truth state</dt><dd>${safe(label(item.truthState))}</dd></div><div><dt>Search reason</dt><dd>${safe(item.whyMatched)}</dd></div><div><dt>Canonical ID</dt><dd>${safe(item.id)}</dd></div><div><dt>Source</dt><dd>${safe(item.source)}</dd></div>${evidence.map(([key,value])=>`<div><dt>${safe(label(key))}</dt><dd>${safe(typeof value==='number'?String(value):value)}</dd></div>`).join('')}</dl><a class="q-button q-button--primary" href="${safe(routeHref(item.route))}">Open canonical destination</a>`;
}

export async function renderUniversalSearch(main,{api,escapeHtml,toast,state}){
  ensureStyles();
  const initialQuery=state?.routeQuery?.get?.('q')||'';
  main.innerHTML=`<section class="q-us-page" data-universal-search="governed-public-v2" data-search-private-content="excluded">
    <header class="q-us-hero"><div><p class="q-eyebrow">Qelly Intelligence · Universal Search</p><h1>Find the exact Qelly object or task—without knowing where it lives.</h1><p>One governed query across public product capabilities, deterministic formulas, technical indicators, and the current attributed asset sample.</p><form data-search-form role="search"><label for="qelly-universal-query">Search Qelly</label><div><span aria-hidden="true">⌕</span><input id="qelly-universal-query" type="search" value="${escapeHtml(initialQuery)}" autocomplete="off" spellcheck="false" placeholder="Try BTC, decision evidence, position size, or RSI"><kbd>/</kbd><button type="submit">Search</button></div></form><div class="q-us-examples"><span>Start with a purpose</span>${['decision evidence','position size','market research','RSI','BTC'].map((query)=>`<button type="button" data-search-example="${escapeHtml(query)}">${escapeHtml(query)}</button>`).join('')}</div></div><aside><span>Unique job · exact retrieval</span><strong>Search finds. Rankings orders. Discovery frames.</strong><p>Universal Search does not rank the market, synthesize an answer, inspect private workspaces, or recommend an action.</p><div><b>0</b><small>profile signals used</small><b>0</b><small>private records indexed</small></div></aside></header>
    <section class="q-us-truth" role="status"><span></span><strong>Governed public catalog</strong><p>Private workspace contents excluded · generative synthesis off · execution disabled</p><button type="button" data-search-method>Review method</button></section>
    <section class="q-us-workbench">
      <div class="q-us-main"><nav class="q-us-types" aria-label="Search object types">${TYPES.map((item)=>`<button type="button" data-search-type="${item.id}" aria-pressed="${item.id==='all'}"><b>${item.label}</b><small>${item.job}</small></button>`).join('')}</nav><div class="q-us-toolbar"><div><p class="q-eyebrow">Governed results</p><h2 data-search-heading>Preparing catalog…</h2><p data-search-summary>Loading public metadata and current attributed observations.</p></div><label><span>Access boundary</span><select data-search-access><option value="all">All catalog entries</option><option value="public">Public destinations</option><option value="workspace">Sign-in destinations</option></select></label></div><div class="q-us-results" data-search-results aria-live="polite">${emptyState('')}</div></div>
      <aside class="q-us-context"><section><p class="q-eyebrow">Index coverage</p><h2>What this query can see</h2><div data-search-corpus><p>Catalog counts are loading.</p></div></section><section><p class="q-eyebrow">Result facets</p><div data-search-facets><p>Facets will reflect the active query.</p></div></section><section class="q-us-private"><span>Private boundary</span><h3>Your workspace is not in this index.</h3><p>Saved searches, portfolios, watchlists, research history, conversations, and account data require sign-in and are never exposed by the public endpoint.</p><a href="#/auth-login?returnTo=search">Sign in for private workspaces</a></section></aside>
    </section>
    <section class="q-us-method" data-search-methodology><div><p class="q-eyebrow">Deterministic retrieval method</p><h2>Why each result surfaced is visible.</h2><p>Qelly scores exact identifiers, exact names, prefixes, all-term matches, and related indexed metadata in that order. Stable type and title tie-breaks keep identical queries reproducible.</p></div><ol><li><span>01</span><strong>Normalize</strong><p>Case and punctuation are removed; the original query is retained.</p></li><li><span>02</span><strong>Match</strong><p>Name, ID, purpose, use case, domain, and declared metadata are searched.</p></li><li><span>03</span><strong>Explain</strong><p>Every result carries its score, match reason, source, access, and truth state.</p></li><li><span>04</span><strong>Handoff</strong><p>The canonical destination owns the next task; Search performs no analysis or mutation.</p></li></ol></section>
    <section class="q-us-distinctions"><header><p class="q-eyebrow">Choose the right surface</p><h2>Four different jobs—not duplicated features.</h2></header><div><a href="#/search"><b>Universal Search</b><span>Exact retrieval</span><p>“Where is the object or tool I already have in mind?”</p></a><a href="#/discovery-hub"><b>Discovery Overview</b><span>Theme framing</span><p>“What broad question deserves research?”</p></a><a href="#/asset-rankings"><b>Asset Rankings</b><span>Candidate narrowing</span><p>“Which evidenced assets score highest under this criterion?”</p></a><a href="#/asset-intelligence"><b>Asset Intelligence</b><span>Single-asset diligence</span><p>“What evidence matters for this selected asset?”</p></a></div></section>
    <aside class="q-us-inspector" data-search-inspector hidden><button type="button" data-search-inspector-close aria-label="Close result evidence">×</button><div data-search-inspector-body></div></aside>
  </section>`;
  main.removeAttribute('aria-busy');

  const input=main.querySelector('#qelly-universal-query');
  const results=main.querySelector('[data-search-results]');
  const inspector=main.querySelector('[data-search-inspector]');
  let selectedType='all';
  let selectedAccess='all';
  let timer=0;
  let sequence=0;
  let lastData={items:[]};

  const renderData=(data)=>{
    lastData=data;
    const items=Array.isArray(data.items)?data.items:[];
    main.querySelector('[data-search-heading]').textContent=data.query?`${data.total} matches for “${data.query}”`:`${data.total} purpose-led starting points`;
    main.querySelector('[data-search-summary]').textContent=`Showing ${items.length} of ${data.total} matches · ${label(data.mode)} · stable relevance order`;
    results.innerHTML=items.length?items.map((item)=>resultCard(item,escapeHtml)).join(''):emptyState(data.query);
    const corpus=data.corpus||{};
    main.querySelector('[data-search-corpus]').innerHTML=`<dl><div><dt>Product features</dt><dd>${corpus.features??0}</dd></div><div><dt>Formulas</dt><dd>${corpus.formulas??0}</dd></div><div><dt>Indicators</dt><dd>${corpus.indicators??0}</dd></div><div><dt>Attributed assets</dt><dd>${corpus.assets??0}</dd></div><div><dt>Total objects</dt><dd>${corpus.total??0}</dd></div></dl><small>Generated ${escapeHtml(dateLabel(data.generatedAt))}</small>`;
    const typeFacets=Array.isArray(data.facets?.types)?data.facets.types:[];
    const accessFacets=Array.isArray(data.facets?.access)?data.facets.access:[];
    main.querySelector('[data-search-facets]').innerHTML=`<div>${typeFacets.map((item)=>`<button type="button" data-facet-type="${escapeHtml(item.value)}"><span>${escapeHtml(label(item.value))}</span><b>${item.count}</b></button>`).join('')||'<p>No type facets for this query.</p>'}</div><div>${accessFacets.map((item)=>`<span><em>${escapeHtml(label(item.value))}</em><b>${item.count}</b></span>`).join('')}</div>`;
  };

  const runSearch=async()=>{
    const request=++sequence;
    results.setAttribute('aria-busy','true');
    main.querySelector('[data-search-summary]').textContent='Matching governed metadata…';
    try{
      const types=selectedType==='all'?'':selectedType;
      const data=await api(`/api/v1/search?q=${encodeURIComponent(input.value.trim())}&types=${encodeURIComponent(types)}&access=${encodeURIComponent(selectedAccess)}&limit=40`);
      if(request!==sequence)return;
      renderData(data);
      const query=input.value.trim();
      const next=`#/search${query?`?q=${encodeURIComponent(query)}`:''}`;
      if(location.hash!==next)history.replaceState(null,'',next);
    }catch(error){
      if(request!==sequence)return;
      results.innerHTML=`<div class="q-us-empty"><span>Search unavailable</span><h2>The governed index did not respond.</h2><p>${escapeHtml(error.message)} No local fixture or invented result was substituted.</p><button type="button" data-search-retry>Retry</button></div>`;
      toast?.('Universal Search could not refresh.',{tone:'warning'});
    }finally{if(request===sequence)results.removeAttribute('aria-busy');}
  };

  const schedule=()=>{clearTimeout(timer);timer=setTimeout(runSearch,260);};
  main.querySelector('[data-search-form]').addEventListener('submit',(event)=>{event.preventDefault();clearTimeout(timer);runSearch();});
  input.addEventListener('input',schedule);
  main.querySelectorAll('[data-search-type]').forEach((button)=>button.addEventListener('click',()=>{selectedType=button.dataset.searchType;main.querySelectorAll('[data-search-type]').forEach((item)=>item.setAttribute('aria-pressed',String(item===button)));runSearch();}));
  main.querySelector('[data-search-access]').addEventListener('change',(event)=>{selectedAccess=event.target.value;runSearch();});
  main.querySelectorAll('[data-search-example]').forEach((button)=>button.addEventListener('click',()=>{input.value=button.dataset.searchExample;runSearch();input.focus();}));
  main.addEventListener('click',(event)=>{
    const inspect=event.target.closest('[data-search-inspect]');
    if(inspect){const item=lastData.items.find((entry)=>entry.id===inspect.dataset.searchInspect);if(item){inspector.hidden=false;main.querySelector('[data-search-inspector-body]').innerHTML=inspectorMarkup(item,escapeHtml);}return;}
    const reset=event.target.closest('[data-search-reset]');if(reset){input.value='';selectedType='all';selectedAccess='all';main.querySelector('[data-search-access]').value='all';main.querySelectorAll('[data-search-type]').forEach((item)=>item.setAttribute('aria-pressed',String(item.dataset.searchType==='all')));runSearch();return;}
    const retry=event.target.closest('[data-search-retry]');if(retry){runSearch();return;}
    const facet=event.target.closest('[data-facet-type]');if(facet){selectedType=facet.dataset.facetType;main.querySelectorAll('[data-search-type]').forEach((item)=>item.setAttribute('aria-pressed',String(item.dataset.searchType===selectedType)));runSearch();return;}
  });
  main.querySelector('[data-search-inspector-close]').addEventListener('click',()=>{inspector.hidden=true;});
  main.querySelector('[data-search-method]').addEventListener('click',()=>main.querySelector('[data-search-methodology]').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
  const shortcut=(event)=>{if(event.key==='/'&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){event.preventDefault();input.focus();}};
  const shortcutController=new AbortController();
  document.addEventListener('keydown',shortcut,{signal:shortcutController.signal});
  window.addEventListener('hashchange',()=>shortcutController.abort(),{once:true,signal:shortcutController.signal});
  await runSearch();
}
