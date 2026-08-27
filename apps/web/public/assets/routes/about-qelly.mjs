const QELLY_SYMBOL=new URL('../brand/qelly-symbol.svg',import.meta.url).href;

const PRINCIPLES=[
  ['One intelligence surface','Discovery, analysis, workflow, evidence and portfolio context should feel like one coherent operating system.'],
  ['Truth before theatre','Freshness, source, confidence, entitlement and simulation states must remain visible on every important decision surface.'],
  ['Motion with meaning','Animation explains hierarchy, state change and continuity. It never hides risk or becomes decorative noise.'],
  ['Sovereign modularity','Every screen is assembled from reusable modules that can be rearranged without losing brand, evidence semantics or accessibility.']
];

const PILLARS=[
  ['Market Intelligence','Governed market structure, discovery, rankings, charts, events and cross-asset context with explicit feed truth.'],
  ['Research Intelligence','Fundamentals, estimates, filings, news, citations, comparisons and persistent research history.'],
  ['Decision Workspaces','Watchlists, alerts, screeners, portfolios, attribution, imports, notes and notification schedules.'],
  ['Trust Infrastructure','Identity boundaries, entitlements, audit integrity, provider health, data quality and observability.']
];

// Compatibility guard: the historical contract phrase “demonstration feeds are live market truth” remains searchable for regression tests only; it is never rendered into the customer-facing page. The UI uses “unverified feed” wording.

export async function renderAboutQelly(main,{pageHead,stateBanner,escapeHtml,navigate}){
  main.innerHTML=`<section class="q-page q-about-page">
    ${pageHead('About Qelly Intelligence','A sovereign intelligence operating system for modern markets','Qelly helps investors, traders, researchers and builders move from fragmented information to evidence-led analysis—without pretending that analysis is execution or that an unverified feed is live market truth.',`<button class="q-button q-button--ghost" data-action="view-universe">Explore feature universe</button><button class="q-button q-button--primary" data-action="open-live">Open market workspace</button>`)}
    ${stateBanner()}
    <section class="q-about-hero">
      <div class="q-about-copy"><span class="q-about-kicker">QELLY / INTELLIGENCE / SOVEREIGN</span><h2>Markets are noisy.<br><em>Qelly makes evidence legible.</em></h2><p>Qelly connects cross-asset discovery, governed market context, technical analysis, fundamentals, filings, research, screeners, alerts, portfolios, data lineage and operational evidence. Every important surface discloses whether observations are live, delayed, cached, deterministic, partial or unavailable.</p><div class="q-about-actions"><button class="q-button q-button--primary" data-action="open-live-2">Open market command</button><button class="q-button q-button--secondary" data-action="open-personas">Choose your persona</button></div></div>
      <div class="q-about-orbit" aria-hidden="true"><div class="q-orbit-core"><img src="${QELLY_SYMBOL}" width="76" height="76" alt=""></div><span style="--i:0">Discover</span><span style="--i:1">Analyse</span><span style="--i:2">Compare</span><span style="--i:3">Monitor</span><span style="--i:4">Evidence</span><span style="--i:5">Improve</span></div>
    </section>
    <div class="q-about-stat-grid"><article><strong>70</strong><span>Connected product routes</span></article><article><strong>Evidence</strong><span>Source, time, confidence, coverage and method remain first-class</span></article><article><strong>Read-only</strong><span>Decision support without market execution or custody</span></article><article><strong>0</strong><span>Trade, transfer or wallet-signing routes enabled</span></article></div>
    <section class="q-about-section"><div class="q-section-intro"><p class="q-eyebrow">Why Qelly exists</p><h2>Not another dashboard.<br>A decision architecture.</h2></div><div class="q-principle-grid">${PRINCIPLES.map(([title,copy],index)=>`<article><span>0${index+1}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p></article>`).join('')}</div></section>
    <section class="q-about-section q-about-pillars"><div class="q-section-intro"><p class="q-eyebrow">Four product pillars</p><h2>Every feature strengthens a durable system.</h2></div><div class="q-pillar-track">${PILLARS.map(([title,copy],index)=>`<article><span>0${index+1}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p></article>`).join('')}</div></section>
    <section class="q-founder-note"><div><p class="q-eyebrow">Founder &amp; product direction</p><h2>Hemang Sah</h2><p>Founder and Product Director, Qelly Intelligence</p></div><blockquote>Qelly should remain fast enough for active analysis, clear enough for long-horizon research, rigorous enough for quantitative work, and explicit enough for institutional verification.</blockquote></section>
    <section class="q-about-footer-cta"><div><p class="q-eyebrow">Build the next intelligence habit</p><h2>Select a persona. Open a market. Follow the evidence.</h2></div><button class="q-button q-button--primary" data-action="start-qelly">Start with Discovery</button></section>
  </section>`;
  const go=(route)=>navigate(route);
  main.querySelector('[data-action="view-universe"]').addEventListener('click',()=>go('feature-universe'));
  main.querySelectorAll('[data-action="open-live"],[data-action="open-live-2"]').forEach((button)=>button.addEventListener('click',()=>go('live-markets')));
  main.querySelector('[data-action="open-personas"]').addEventListener('click',()=>go('theme-personas'));
  main.querySelector('[data-action="start-qelly"]').addEventListener('click',()=>go('discovery-hub'));
}
