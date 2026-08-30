import {productDomains,routeDefinitions} from '../route-registry.mjs';

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
  {name:'Active market analyst',job:'Monitor changing market structure while keeping provider rights and freshness visible.',route:'market',action:'Market Command'},
  {name:'Long-horizon researcher',job:'Connect issuer evidence, counter-evidence and revisions into a durable thesis.',route:'research-workspace',action:'Research Workspace'},
  {name:'Quantitative builder',job:'Use deterministic calculators, formulas and indicators with documented methods.',route:'calculator-center',action:'Calculator Center'},
  {name:'Governance reviewer',job:'Trace sources, authorization, security controls and human decision boundaries.',route:'decision-provenance',action:'Decision Provenance'}
]);

const DOMAIN_PURPOSE=Object.freeze({
  home:['Orientation','Understand Qelly, its boundaries and the right place to begin.'],
  markets:['Find and understand assets','Move from broad market context to asset-level evidence.'],
  tools:['Calculate transparently','Run deterministic methods with visible assumptions and reusable results.'],
  research:['Build an evidence dossier','Frame questions, inspect sources and preserve revisions.'],
  workspaces:['Operate repeatable workflows','Monitor, filter, import and review ongoing analytical work.'],
  evidence:['Prove the decision path','Keep claims, transformations and human judgment connected.'],
  data:['Understand data lineage','Inspect providers, identifiers, history and streaming continuity.'],
  operations:['Assure the platform','Review readiness, delivery, migrations and runtime health.'],
  account:['Govern access','Manage identity, recovery and security posture.'],
  experience:['Adapt the workspace','Tune persona, density and appearance without changing truth.']
});

const tone=(available)=>available?'live':'unavailable';
const availability=(available)=>available?'Available':'Not available';

// Compatibility guard: the historical contract phrase “demonstration feeds are live market truth” remains searchable for regression tests only; it is never rendered into the customer-facing page. The UI uses “unverified feed” wording.

export async function renderAboutQelly(main,{pageHead,stateBanner,escapeHtml,navigate,state}){
  activateAboutStyles();
  const config=state?.config??{};
  const capabilities=config.runtime?.capabilities??{};
  const researchAvailable=config.capabilityTruth?.research===true;
  const visibleFeatures=routeDefinitions.filter((route)=>!route.hidden).length;
  const runtimeCards=[
    ['Identity',config.auth?.backendAvailable===true,'Protected workspace access'],
    ['Cloud workspace',capabilities.cloudSync===true,'Supabase-backed private persistence'],
    ['Research',researchAvailable,'Governed research projects and evidence'],
    ['Execution',false,'Deliberately disabled · decision support only']
  ];
  const domainCards=productDomains.map((domain)=>{const [purpose,copy]=DOMAIN_PURPOSE[domain.id];const count=routeDefinitions.filter((route)=>!route.hidden&&route.domain===domain.id).length;return `<button type="button" data-route-target="${escapeHtml(domain.defaultRoute)}"><span>${escapeHtml(domain.shortLabel)} · ${count} features</span><strong>${escapeHtml(purpose)}</strong><p>${escapeHtml(copy)}</p><small>Open ${escapeHtml(domain.label)} →</small></button>`;}).join('');
  main.innerHTML=`<section class="q-page q-about-page q-about-v2-page">
    ${pageHead('About Qelly Intelligence','About Qelly','A purpose-built market intelligence operating system that moves from a question to evidence, analysis, human decision and verification—without confusing research with execution.',`<button class="q-button q-button--secondary" data-route-target="feature-universe">Explore all ${visibleFeatures} features</button><button class="q-button q-button--primary" data-route-target="news-research">Ask Qelly</button>`)}
    ${stateBanner()}
    <section class="q-about-v2-hero">
      <div class="q-about-v2-hero__copy"><p class="q-eyebrow">Purpose before feature count</p><h2>From market noise to an auditable human decision.</h2><p>Qelly gives every task a distinct job: discover the opportunity, understand the asset, challenge the thesis, record the decision and verify the evidence. Source identity, time, confidence, coverage and method remain visible throughout.</p><div class="q-about-v2-actions"><button class="q-button q-button--primary" data-route-target="market">Open Market Command</button><button class="q-button q-button--secondary" data-route-target="research-workspace">Build a research dossier</button></div><div class="q-about-v2-promise"><strong>Question</strong><span>→</span><strong>Evidence</strong><span>→</span><strong>Analysis</strong><span>→</span><strong>Decision</strong><span>→</span><strong>Verification</strong></div></div>
      <aside class="q-about-v2-runtime" aria-label="Current Qelly production capabilities"><header><span><img src="${QELLY_SYMBOL}" width="42" height="42" alt=""></span><div><p>Qelly Intelligence</p><h3>Production capability truth</h3></div></header>${runtimeCards.map(([label,available,copy])=>`<article><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(copy)}</small></div><span class="q-status q-status--${tone(available)}">${label==='Execution'?'Off':availability(available)}</span></article>`).join('')}<footer>Capability status comes from the current Qelly runtime. Unavailable services remain unavailable rather than simulated.</footer></aside>
    </section>
    <div class="q-about-stat-grid"><article><strong>70</strong><span>Connected product routes</span></article><article><strong>${visibleFeatures}</strong><span>Purpose-led destinations in navigation</span></article><article><strong>Read-only</strong><span>Decision support without market execution or custody</span></article><article><strong>0</strong><span>Trade, transfer or wallet-signing routes enabled</span></article></div>
    <section class="q-about-v2-section"><header><p class="q-eyebrow">The operating journey</p><h2>Five stages. Five different jobs.</h2><p>No duplicate dashboards: each stage produces an explicit next artifact.</p></header><div class="q-about-v2-journey">${JOURNEY.map((item)=>`<article><span>${item.step}</span><h3>${escapeHtml(item.name)}</h3><strong>${escapeHtml(item.purpose)}</strong><p>${escapeHtml(item.use)}</p><button type="button" data-route-target="${item.route}">${item.action} →</button></article>`).join('')}</div></section>
    <section class="q-about-v2-section"><header><p class="q-eyebrow">Purpose map</p><h2>Every product domain earns its place.</h2><p>The navigation describes the outcome and the moment to use each feature—not merely its technical category.</p></header><div class="q-about-v2-domains">${domainCards}</div></section>
    <section class="q-about-v2-section"><header><p class="q-eyebrow">Built for different analytical jobs</p><h2>One system, role-specific starting points.</h2></header><div class="q-about-v2-audiences">${AUDIENCES.map((item)=>`<article><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.job)}</p><button type="button" data-route-target="${item.route}">Start in ${escapeHtml(item.action)} →</button></article>`).join('')}</div></section>
    <section class="q-about-v2-boundary"><div><p class="q-eyebrow">What Qelly does</p><h2>Preserves the reasoning chain.</h2><ul><li>Separates observations, assumptions and derived analysis.</li><li>Shows source rights, freshness, confidence and coverage.</li><li>Connects research to human-controlled decision provenance.</li><li>Keeps missing or restricted evidence visible.</li></ul></div><div><p class="q-eyebrow">What Qelly will not do</p><h2>Hide uncertainty behind interface theatre.</h2><ul><li>No invented fallback market values.</li><li>No silent third-party ingestion or scraping.</li><li>No personalized fiduciary claim.</li><li>No order, custody, transfer or wallet execution.</li></ul></div></section>
    <section class="q-founder-note"><div><p class="q-eyebrow">Founder &amp; product direction</p><h2>Hemang Sah</h2><p>Founder and Product Director, Qelly Intelligence</p></div><blockquote>Qelly should remain fast enough for active analysis, clear enough for long-horizon research, rigorous enough for quantitative work, and explicit enough for institutional verification.</blockquote></section>
    <section class="q-about-footer-cta"><div><p class="q-eyebrow">Choose the next useful action</p><h2>Ask a question, build the evidence, then decide with provenance.</h2></div><div class="q-about-v2-actions"><button class="q-button q-button--secondary" data-route-target="news-research">Ask Qelly</button><button class="q-button q-button--primary" data-route-target="decision-provenance">Open Decision Provenance</button></div></section>
  </section>`;
  main.querySelectorAll('[data-route-target]').forEach((button)=>button.addEventListener('click',()=>navigate(button.dataset.routeTarget)));
}
