import {routeDefinitions} from '../route-registry.mjs';
import {ensureRouteStylesheet} from '../route-stylesheet-readiness.mjs';
/* Existing workflow and curated destination data are inserted by the guarded authoring helper. */
const WORKFLOWS=[
  {route:'market',eyebrow:'Markets',title:'Market Pulse',copy:'Scan cross-asset conditions, ranked observations and current source freshness.'},
  {route:'decision-provenance',eyebrow:'Decision Intelligence',title:'Explain a market move',copy:'Connect candlesticks, quantitative evidence and relevant news into an evidence-backed research view.'},
  {route:'formula-screener',eyebrow:'Screening',title:'Formula Screener',copy:'Rank supported assets with bounded quantitative metrics calculated from current market observations.'},
  {route:'asset',eyebrow:'Assets',title:'Asset Dossier',copy:'Review price, performance, range risk, evidence freshness and next research steps for an asset.'},
  {route:'calculator-center',eyebrow:'Quant tools',title:'Calculator workspace',copy:'Run transparent calculations with visible assumptions and reproducible results.'},
  {route:'india-finance',eyebrow:'India',title:'India intelligence',copy:'Review Indian market context and use finance calculators with clear source and effective-date context.'},
  {route:'news-research',eyebrow:'Research',title:'News & research',copy:'Find current evidence and connect it to a market or thesis without hiding source limitations.'},
  {route:'qelly-verify',eyebrow:'Verification',title:'Qelly Verify',copy:'Inspect the evidence chain behind a Qelly result and keep unavailable evidence explicit.'}
];

const PRINCIPLES=[
  ['Source-aware','Every observation exposes its source and availability state.'],
  ['Reproducible','Calculations preserve inputs, method version and result history.'],
  ['Read-only by design','The public terminal does not execute trades or hold assets.'],
  ['Coverage before claims','A market is displayed only when the required source coverage is available.']
];
const CLUSTERS=[
  {name:'Discover',copy:'Find markets, rankings, categories, venues, global context and current research.',routes:['discovery-hub','asset-rankings','search','categories','venues','dex-discovery','global-charts','converter','news-research','trust-center']},
  {name:'Analyse',copy:'Move from market context into assets, charts, filings, events, comparisons and Decision Intelligence.',routes:['market','asset','asset-intelligence','advanced-chart','fundamentals-estimates','filing-workspace','event-calendar','comparison-lab','decision-provenance']},
  {name:'Quant tools',copy:'Screen assets and run transparent formulas, indicators and financial calculations.',routes:['screener-lab','formula-screener','calculator-center','formula-library','indicator-library','india-finance','mt5-report-analyzer']},
  {name:'Research',copy:'Build evidence from news, filings, events and verification tools.',routes:['news-research','filing-workspace','event-calendar','comparison-lab','qelly-verify']},
  {name:'About',copy:'Understand Qelly, its research model and available public capabilities.',routes:['about-qelly','feature-universe']}
];
const UNIQUE_DESTINATIONS=new Set(CLUSTERS.flatMap(group=>group.routes)).size;
const stylesheet=new URL('./feature-index.css',import.meta.url).href;
export async function renderFeatureUniverse(main,{escapeHtml,navigate}){
 await ensureRouteStylesheet(stylesheet,{attribute:'data-feature-index-style',value:'true'});
 if(!main.isConnected||!location.hash.startsWith('#/feature-universe'))return;
 const safe=value=>escapeHtml(String(value??''));
 main.innerHTML=`<section class="q-feature-index" aria-labelledby="q-feature-title">
  <header class="q-feature-intro"><div><p class="q-feature-label">QELLY Intelligence</p><h1 id="q-feature-title">Find your next research step.</h1><p>Explore markets, understand an asset, test a calculation or inspect the evidence. Choose the task you have in mind.</p><nav aria-label="Quick start"><a href="#/market" data-directory-route="market">Explore Market Pulse</a><a href="#/calculator-center" data-directory-route="calculator-center">Run a calculation</a><a href="#/about-qelly" data-directory-route="about-qelly">How Qelly works</a></nav></div><aside aria-label="Research boundaries"><h2>Evidence before conclusion.</h2><p>Source availability and freshness stay visible. Public research is read-only; trading and custody are not provided.</p><p>An account is optional for public research.</p></aside></header>
  <section class="q-feature-workflows" aria-labelledby="q-feature-workflows-title"><header><p class="q-feature-label">Start with a question</p><h2 id="q-feature-workflows-title">A focused workspace for each task.</h2></header><ol>${WORKFLOWS.map(item=>`<li><a href="#/${safe(item.route)}" data-directory-route="${safe(item.route)}"><span>${safe(item.eyebrow)}</span><div><h3>${safe(item.route==='news-research'?'QELLY Chat':item.title)}</h3><p>${safe(item.copy)}</p></div><span aria-hidden="true">→</span></a></li>`).join('')}</ol></section>
  <section class="q-feature-directory" aria-labelledby="q-feature-directory-title"><header><p class="q-feature-label">Explore by task</p><h2 id="q-feature-directory-title">Your public research directory.</h2><p>Curated destinations grouped by purpose. Account and operational controls stay in their own navigation.</p></header><form role="search" aria-label="Workflow directory"><label><span>Find a Qelly workflow</span><input type="search" name="query" placeholder="Try liquidity, formulas or research" autocomplete="off"></label><label><span>Task group</span><select name="group"><option value="">All tasks</option>${CLUSTERS.map(group=>`<option value="${safe(group.name)}">${safe(group.name)}</option>`).join('')}</select></label><button type="reset">Reset filters</button></form><p class="q-feature-count" role="status" aria-live="polite">${UNIQUE_DESTINATIONS} destinations available</p><p class="q-feature-empty" hidden>No matching destination. Try a broader task or reset the filters.</p><div class="q-feature-groups">${CLUSTERS.map((group,index)=>`<details data-directory-group="${safe(group.name)}" ${index===0?'open':''}><summary><span>${safe(group.name)}</span><span>${group.routes.length} destinations</span></summary><p>${safe(group.copy)}</p><ul>${group.routes.map(route=>{const label=routeDefinitions.find((item)=>item.route===route)?.label??route.replaceAll('-',' ');return `<li data-directory-search="${safe([label,route,group.copy].join(' ').toLowerCase())}"><a href="#/${safe(route)}" data-directory-route="${safe(route)}"><span>${safe(label)}</span><span aria-hidden="true">→</span></a></li>`;}).join('')}</ul></details>`).join('')}</div></section>
  <section class="q-feature-principles" aria-labelledby="q-feature-principles-title"><h2 id="q-feature-principles-title">Built for explainable research.</h2><dl>${PRINCIPLES.map(([title,copy])=>`<div><dt>${safe(title)}</dt><dd>${safe(copy)}</dd></div>`).join('')}</dl></section>
 </section>`;
 const root=main.querySelector('.q-feature-index'),form=root.querySelector('form'),groups=[...root.querySelectorAll('[data-directory-group]')],initial=new Map(groups.map(group=>[group,group.open]));
 const update=()=>{const query=form.elements.query.value.trim().toLowerCase(),selected=form.elements.group.value,matched=new Set();for(const group of groups){let count=0;for(const item of group.querySelectorAll('[data-directory-search]')){const visible=(!selected||selected===group.dataset.directoryGroup)&&item.dataset.directorySearch.includes(query);item.hidden=!visible;if(visible){count++;matched.add(item.querySelector('a').dataset.directoryRoute);}}group.hidden=count===0;group.open=query||selected?count>0:initial.get(group);}root.querySelector('[role="status"]').textContent=`${matched.size} ${matched.size===1?'destination':'destinations'} available`;root.querySelector('.q-feature-empty').hidden=matched.size!==0;};
 form.addEventListener('submit',event=>event.preventDefault());form.addEventListener('input',update);form.addEventListener('change',update);form.addEventListener('reset',event=>{event.preventDefault();form.elements.query.value='';form.elements.group.value='';update();});
 for(const link of root.querySelectorAll('[data-directory-route]'))link.addEventListener('click',event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(link.dataset.directoryRoute);});
 main.removeAttribute('aria-busy');
}
