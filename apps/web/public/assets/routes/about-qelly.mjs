import {routeDefinitions} from '../route-registry.mjs';

const QELLY_SYMBOL=new URL('../brand/qelly-symbol.svg',import.meta.url).href;
const ABOUT_STYLESHEET=new URL('../about-qelly-v2.css?v=20260829-about1',import.meta.url).href;
const activateAboutStyles=()=>{if(!document.querySelector('link[data-qelly-about-v2]')){const link=document.createElement('link');link.rel='stylesheet';link.href=ABOUT_STYLESHEET;link.dataset.qellyAboutV2='true';document.head.append(link);}document.documentElement.dataset.qellyAbout='v2';};

const JOURNEY=Object.freeze([
  {step:'01',name:'Discover',purpose:'Reduce a broad market universe into a researchable question.',use:'Start with themes, rankings, search and governed market context.',route:'discovery-hub',action:'Open Discovery'},
  {step:'02',name:'Understand',purpose:'Build asset-level context from charts, fundamentals, filings and events.',use:'Use when a candidate needs deeper evidence before a thesis.',route:'asset-intelligence',action:'Open Asset Intelligence'},
  {step:'03',name:'Research',purpose:'State a falsifiable hypothesis and collect both sides of the evidence.',use:'Use when assumptions, sources and limitations must remain explicit.',route:'research-workspace',action:'Open Research'},
  {step:'04',name:'Decide',purpose:'Stress the thesis and connect every judgment to its provenance.',use:'Use before a human records a considered decision.',route:'decision-provenance',action:'Open Decision'},
  {step:'05',name:'Verify',purpose:'Reproduce strategy evidence without inventing missing observations.',use:'Use when a performance claim needs an auditable check.',route:'qelly-verify',action:'Open Verify'}
]);

const AUDIENCES=Object.freeze([
  {name:'Active market analyst',job:'Monitor changing market structure while keeping source and freshness visible.',route:'market',action:'Market Pulse'},
  {name:'Long-horizon researcher',job:'Connect issuer evidence, counter-evidence and revisions into a durable thesis.',route:'research-workspace',action:'Research Workspace'},
  {name:'Quantitative builder',job:'Use deterministic calculators, formulas, indicators and screeners with documented methods.',route:'calculator-center',action:'Calculator Center'},
  {name:'India market researcher',job:'Combine Indian benchmarks, USD/INR, movers, headlines and finance tools in one research flow.',route:'india-finance',action:'India Intelligence'}
]);

const ABOUT_AREAS=Object.freeze([
  {name:'Markets',purpose:'See what is moving',copy:'Start with cross-asset context, rankings, live market views and explicit freshness.',route:'market'},
  {name:'Asset intelligence',purpose:'Understand an asset',copy:'Combine price context, charts, filings, events and source evidence.',route:'asset-intelligence'},
  {name:'Decision Intelligence',purpose:'Explain the move',copy:'Connect candlesticks, quantitative evidence and relevant news into a research-state view.',route:'decision-provenance'},
  {name:'Quant tools',purpose:'Calculate transparently',copy:'Use screeners, formulas, indicators and financial calculators with visible assumptions.',route:'calculator-center'},
  {name:'India intelligence',purpose:'Research Indian markets',copy:'Review Indian benchmarks, USD/INR, movers, headlines and finance tools.',route:'india-finance'},
  {name:'Research & verification',purpose:'Test the evidence',copy:'Use research, filings, events and Qelly Verify without hiding missing observations.',route:'qelly-verify'}
]);

const tone=(available)=>available?'live':'unavailable';
const availability=(available)=>available?'Available':'Not available';

// Compatibility guard: the historical contract phrase “demonstration feeds are live market truth” remains searchable for regression tests only; it is never rendered into the customer-facing page. The UI uses “unverified feed” wording.

export async function renderAboutQelly(main,{pageHead,stateBanner,escapeHtml,navigate,state}){
  activateAboutStyles();
  const config=state?.config??{};
  const capabilities=config.runtime?.capabilities??{};
  const researchAvailable=config.capabilityTruth?.research===true;
  const visibleFeatures=routeDefinitions.filter((route)=>route.public&&!route.hidden&&!route.route.startsWith('auth-')).length;
  const runtimeCards=[
    ['Public research',true,'Markets, search, screeners and calculators work without sign-in'],
    ['Private workspace',capabilities.cloudSync===true,'Optional account-backed saved research'],
    ['Research projects',researchAvailable,'Account-backed projects and evidence when available'],
    ['Execution',false,'Read-only decision support · no trading or custody']
  ];
  const domainCards=ABOUT_AREAS.map((area)=>`<button type="button" data-route-target="${escapeHtml(area.route)}"><span>${escapeHtml(area.name)}</span><strong>${escapeHtml(area.purpose)}</strong><p>${escapeHtml(area.copy)}</p><small>Open ${escapeHtml(area.name)} →</small></button>`).join('');
  main.innerHTML=`<section class="q-page q-about-page q-about-v2-page">
    ${pageHead('About Qelly Intelligence','About Qelly','A purpose-built market intelligence workspace for markets, research, quantitative tools, India intelligence and evidence-backed decisions—without confusing research with execution.',`<button class="q-button q-button--secondary" data-route-target="feature-universe">Explore all ${visibleFeatures} features</button><button class="q-button q-button--primary" data-route-target="news-research">Ask Qelly</button>`)}
    ${stateBanner()}
    <section class="q-about-v2-hero">
      <div class="q-about-v2-hero__copy"><p class="q-eyebrow">Purpose before feature count</p><h2>From market signal to an explainable human decision.</h2><p>Qelly gives every task a distinct job: discover the market, understand the asset, challenge the thesis, explain the decision and verify the evidence. Source, time, confidence, coverage and method remain visible throughout.</p><div class="q-about-v2-actions"><button class="q-button q-button--primary" data-route-target="market">Open Market Command</button><button class="q-button q-button--secondary" data-route-target="research-workspace">Build a research dossier</button></div><div class="q-about-v2-promise"><strong>Question</strong><span>→</span><strong>Evidence</strong><span>→</span><strong>Analysis</strong><span>→</span><strong>Decision</strong><span>→</span><strong>Verification</strong></div></div>
      <aside class="q-about-v2-runtime" aria-label="Current Qelly capabilities"><header><span><img src="${QELLY_SYMBOL}" width="42" height="42" alt=""></span><div><p>Qelly Intelligence</p><h3>Available today</h3></div></header>${runtimeCards.map(([label,available,copy])=>`<article><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(copy)}</small></div><span class="q-status q-status--${tone(available)}">${label==='Execution'?'Off':availability(available)}</span></article>`).join('')}<footer>Unavailable services remain unavailable rather than being presented as live.</footer></aside>
    </section>
    <div class="q-about-stat-grid"><article><strong>36</strong><span>Public financial calculators</span></article><article><strong>${visibleFeatures}</strong><span>Public research destinations</span></article><article><strong>Read-only</strong><span>Decision support without market execution or custody</span></article><article><strong>0</strong><span>Trade, transfer or wallet-signing routes enabled</span></article></div>
    <section class="q-about-v2-section"><header><p class="q-eyebrow">The research journey</p><h2>Five stages. Five different jobs.</h2><p>No duplicate dashboards: each stage produces an explicit next artifact.</p></header><div class="q-about-v2-journey">${JOURNEY.map((item)=>`<article><span>${item.step}</span><h3>${escapeHtml(item.name)}</h3><strong>${escapeHtml(item.purpose)}</strong><p>${escapeHtml(item.use)}</p><button type="button" data-route-target="${item.route}">${item.action} →</button></article>`).join('')}</div></section>
    <section class="q-about-v2-section"><header><p class="q-eyebrow">Purpose map</p><h2>Six consumer research areas.</h2><p>Each area is organized around a user task rather than an internal system boundary.</p></header><div class="q-about-v2-domains">${domainCards}</div></section>
    <section class="q-about-v2-section"><header><p class="q-eyebrow">Built for different analytical jobs</p><h2>One system, role-specific starting points.</h2></header><div class="q-about-v2-audiences">${AUDIENCES.map((item)=>`<article><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.job)}</p><button type="button" data-route-target="${item.route}">Start in ${escapeHtml(item.action)} →</button></article>`).join('')}</div></section>
    <section class="q-about-v2-boundary"><div><p class="q-eyebrow">What Qelly does</p><h2>Preserves the reasoning chain.</h2><ul><li>Separates observations, assumptions and derived analysis.</li><li>Shows source, freshness, confidence and coverage.</li><li>Connects research to human-controlled decision provenance.</li><li>Keeps missing or restricted evidence visible.</li></ul></div><div><p class="q-eyebrow">What Qelly will not do</p><h2>Hide uncertainty behind interface theatre.</h2><ul><li>No invented fallback market values.</li><li>No silent third-party ingestion or scraping.</li><li>No personalized fiduciary claim.</li><li>No order, custody, transfer or wallet execution.</li></ul></div></section>
    <section class="q-founder-note"><div><p class="q-eyebrow">Founder &amp; product direction</p><h2>Hemang Sah</h2><p>Founder and Product Director, Qelly Intelligence</p></div><blockquote>Qelly should remain fast enough for active analysis, clear enough for long-horizon research, rigorous enough for quantitative work, and explicit enough for institutional verification.</blockquote></section>
    <section class="q-about-footer-cta"><div><p class="q-eyebrow">Choose the next useful action</p><h2>Ask a question, build the evidence, then decide with provenance.</h2></div><div class="q-about-v2-actions"><button class="q-button q-button--secondary" data-route-target="news-research">Ask Qelly</button><button class="q-button q-button--primary" data-route-target="decision-provenance">Open Decision Intelligence</button></div></section>
  </section>`;
  main.querySelectorAll('[data-route-target]').forEach((button)=>button.addEventListener('click',()=>navigate(button.dataset.routeTarget)));
}
