// Qelly Intelligence — V5.3 institutional-density lock candidate convergence.
// Presentation-only: renders the approved first-view reference shell for the 15 lock surfaces.
// Existing route DOM is preserved in a secondary governed tools section below the locked surface.

const STYLE_HREF=new URL('./qelly-v53-lock-candidate-convergence.css',import.meta.url).href;
const root=document.documentElement;
const main=document.getElementById('main');

const SPECS=Object.freeze({
  'live-markets':{slot:1,section:'MARKET COMMAND',title:'Market Command',subtitle:'Cross-asset context, liquidity, breadth and evidence',tone:'#6EA8FF'},
  market:{slot:1,section:'MARKET COMMAND',title:'Market Command',subtitle:'Cross-asset context, liquidity, breadth and evidence',tone:'#6EA8FF'},
  'advanced-chart':{slot:2,section:'ADVANCED CHART',title:'Advanced Chart Studio',subtitle:'Multi-timeframe analysis with overlays, events and provenance',tone:'#16A36A'},
  'research-workspace':{slot:3,section:'RESEARCH & EVIDENCE',title:'Research Workspace',subtitle:'Claims, citations, contradictions, methodology and audit trail',tone:'#6EA8FF'},
  'qelly-verify':{slot:4,section:'QUANT & VERIFICATION',title:'Qelly Verify',subtitle:'Formula validation, assumptions, sensitivity and reproducibility',tone:'#16A36A'},
  'screener-lab':{slot:5,section:'SCREENERS & QUANT',title:'Screener Lab',subtitle:'Evidence-aware factor filtering and ranked scenario comparison',tone:'#6EA8FF'},
  'portfolio-analytics':{slot:6,section:'PORTFOLIO & RISK',title:'Portfolio Risk',subtitle:'Exposure, attribution, drawdown, VaR and scenario intelligence',tone:'#16A36A'},
  'theme-lab':{slot:7,section:'THEME INTELLIGENCE',title:'Theme Studio',subtitle:'Governed appearance, density, persona and mindset controls',tone:'#A469D6'},
  'saved-calculations':{slot:8,section:'CLOUD & ACCOUNT',title:'Cloud Sync',subtitle:'Read-only preferences, revisions, offline queue and convergence',tone:'#6EA8FF'},
  'security-setup':{slot:9,section:'IDENTITY & SECURITY',title:'Security Center',subtitle:'Passkeys, MFA, sessions, policies and tenant isolation',tone:'#A469D6'},
  watchlist:{slot:10,section:'WORKSPACES & COLLABORATION',title:'Collaboration Hub',subtitle:'Comments, tasks, approvals and shared analytical context',tone:'#6EA8FF'},
  'delivery-operations':{slot:11,section:'OPERATIONS & GOVERNANCE',title:'Provider Runtime',subtitle:'Provider state, latency, incidents, jobs and release evidence',tone:'#D49A49'},
  'notification-center':{slot:12,section:'GLOBAL STATES',title:'Truth-State Matrix',subtitle:'Freshness, partiality, conflict and degraded-state behavior',tone:'#D49A49'},
  'about-qelly':{slot:13,section:'PUBLIC / COMPANY',title:'Enterprise Intelligence',subtitle:'Product boundaries, controls, governance and support surfaces',tone:'#6EA8FF'},
  'calculator-detail':{slot:14,section:'FORMULAE & CALCULATORS',title:'Formula Workbench',subtitle:'Transparent calculations with units, assumptions and sensitivity',tone:'#16A36A'},
  'decision-provenance':{slot:15,section:'DECISION PROVENANCE',title:'Decision Provenance',subtitle:'Observed facts, derived metrics, inference and contradiction graph',tone:'#E6A3BA'}
});

const REFERENCE_ROWS=Object.freeze([
  ['SPY','5,428.14','+0.42%','Fresh','NYSE','positive'],
  ['BTC-USD','67,420','-0.18%','Delayed','Coinbase','negative'],
  ['DXY','103.84','+0.11%','Fresh','ICE','positive'],
  ['XAUUSD','2,391.2','+0.31%','Fresh','CME','positive'],
  ['EURUSD','1.0862','-0.07%','Partial','ECB','negative'],
  ['US10Y','4.21%','+3bp','Fresh','UST','positive']
]);

function loadStyle(){
  if(document.querySelector('link[data-qelly-v53-lock-candidate="active"]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=STYLE_HREF;
  link.dataset.qellyV53LockCandidate='active';
  document.head.append(link);
}

function routeFromHash(){return location.hash.replace(/^#\//,'').split(/[?/#]/)[0]||'live-markets';}
function auditId(slot){return `Q5-${String(slot).padStart(3,'0')}`;}
function esc(value){return String(value).replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}

function chartMarkup(tone){
  const bars=[22,34,18,42,28,50,26,39,21,45,30,52,24,37,17,44,29,48,23,40,31,54,27,46];
  const barMarkup=bars.map((height,index)=>`<rect x="${18+index*28}" y="${176-height}" width="9" height="${height}" rx="1" class="${index%5===1||index%7===2?'is-negative':'is-positive'}"/>`).join('');
  return `<svg class="q-v53-lock-chart" viewBox="0 0 700 190" preserveAspectRatio="none" aria-label="Simulated reference analytical chart" role="img">
    <g class="q-v53-lock-grid">${[28,64,100,136,172].map(y=>`<line x1="0" y1="${y}" x2="700" y2="${y}"/>`).join('')}</g>
    <path d="M8 88 C58 126 93 126 137 91 S219 58 272 92 S351 135 402 105 S476 72 528 104 S611 142 690 94" fill="none" stroke="${esc(tone)}" stroke-width="2.2" stroke-linecap="round"/>
    <g class="q-v53-lock-bars">${barMarkup}</g>
  </svg>`;
}

function kpis(){
  return `<div class="q-v53-lock-kpis" aria-label="Reference intelligence summary">
    <article data-kpi="regime"><small>REGIME</small><strong>Neutral</strong></article>
    <article data-kpi="coverage"><small>COVERAGE</small><strong>87%</strong><em>+3%</em></article>
    <article data-kpi="confidence"><small>CONFIDENCE</small><strong>0.78</strong><em>+0.04</em></article>
    <article data-kpi="freshness"><small>FRESHNESS</small><strong>18 s</strong></article>
    <article data-kpi="contradictions"><small>CONTRADICTIONS</small><strong>2</strong></article>
    <article data-kpi="sources"><small>SOURCES</small><strong>14</strong></article>
  </div>`;
}

function signalTable(){
  return `<div class="q-v53-lock-signal"><h3>INSTRUMENT / SIGNAL GRID</h3><div class="q-v53-lock-table" role="table" aria-label="Simulated reference signal grid">
    <div class="q-v53-lock-tr q-v53-lock-th" role="row"><span>INSTRUMENT</span><span>VALUE</span><span>Δ</span><span>TRUTH</span><span>SOURCE</span></div>
    ${REFERENCE_ROWS.map(([instrument,value,delta,truth,source,polarity])=>`<div class="q-v53-lock-tr" role="row"><strong>${instrument}</strong><span>${value}</span><span class="is-${polarity}">${delta}</span><span>${truth}</span><span>${source}</span></div>`).join('')}
  </div></div>`;
}

function contextPanel(){
  const rows=[['REGIME','Neutral'],['LIQUIDITY','Normal'],['BREADTH','58 / 42'],['VOLATILITY','14.9'],['MACRO','Mixed'],['EVENT RISK','Medium'],['BIAS','Observe'],['HORIZON','1D–1W']];
  return `<aside class="q-v53-lock-context" aria-label="Reference market context"><h3>CONTEXT</h3>${rows.map(([label,value])=>`<div><small>${label}</small><strong>${value}</strong></div>`).join('')}<footer><strong>No action controls</strong><span>Decision support only</span></footer></aside>`;
}

function inspector(spec){
  const rows=[['TRUTH STATE','Simulated'],['OBSERVED AT','Reference'],['FRESHNESS','18 s'],['CONFIDENCE','0.78'],['COVERAGE','87%'],['METHOD','Q-MX 2.4'],['AUDIT ID',auditId(spec.slot)]];
  return `<aside class="q-v53-lock-inspector" aria-label="Intelligence Inspector"><h3>INTELLIGENCE INSPECTOR</h3><div class="q-v53-lock-tabs" role="tablist" aria-label="Inspector modes"><span>Explanation</span><span class="is-active">Evidence</span><span>Contradictions</span></div><div class="q-v53-lock-evidence-rows">${rows.map(([label,value])=>`<div><small>${label}</small><strong>${value}</strong></div>`).join('')}</div><section><h4>ASSUMPTION</h4><p>• Reference data only</p><p>• No execution capability</p><p>• Source coverage may vary</p></section></aside>`;
}

function activity(spec){
  const items=[['REF 00:18','Reference snapshot loaded','SIMULATED'],['REF 00:15','Reference contradiction included','CONFLICTING'],['REF 00:12','Reference scenario derived','DERIVED'],['REF 00:08',`${auditId(spec.slot)} design marker`,'AUDIT']];
  return `<section class="q-v53-lock-activity" aria-label="Reference activity and evidence"><h3>ACTIVITY / EVIDENCE</h3><div>${items.map(([time,label,state])=>`<article><time>${time}</time><span>${label}</span><em>${state}</em></article>`).join('')}</div></section>`;
}

function mobileNav(){
  return `<nav class="q-v53-lock-mobile-nav" aria-label="V5.3 mobile domains">
    <a href="#/live-markets"><strong>M</strong><span>Market</span></a>
    <a href="#/research-workspace"><strong>R</strong><span>Research</span></a>
    <a href="#/calculator-detail"><strong>Q</strong><span>Quant</span></a>
    <a href="#/decision-provenance"><strong>E</strong><span>Evidence</span></a>
    <a href="#/feature-universe"><strong>M</strong><span>More</span></a>
  </nav>`;
}

function buildSurface(spec,route){
  const surface=document.createElement('section');
  surface.className='q-v53-lock-page';
  surface.dataset.v53LockSurface=String(spec.slot);
  surface.dataset.v53LockRoute=route;
  surface.innerHTML=`
    <header class="q-v53-lock-heading"><div><p>${esc(spec.section)}</p><h1>${esc(spec.title)}</h1><span>${esc(spec.subtitle)}</span></div><em>SIMULATED REFERENCE DATA</em></header>
    ${kpis()}
    <div class="q-v53-lock-workspace">
      <article class="q-v53-lock-primary"><h2>PRIMARY ANALYTICAL WORKSPACE</h2>${chartMarkup(spec.tone)}${signalTable()}</article>
      ${contextPanel()}
      ${inspector(spec)}
    </div>
    ${activity(spec)}
    ${mobileNav()}`;
  return surface;
}

function wrapRoute(spec,route){
  if(!main||!main.firstElementChild)return;
  const current=main.querySelector(':scope > .q-v53-lock-page');
  if(current?.dataset.v53LockRoute===route){adoptStrays();return;}

  root.dataset.v53LockCandidate='true';
  root.dataset.v53LockSlot=String(spec.slot);
  main.dataset.v53LockCandidate='true';
  main.dataset.v53LockSlot=String(spec.slot);

  const originalNodes=[...main.childNodes];
  const tools=document.createElement('details');
  tools.className='q-v53-lock-route-tools';
  tools.innerHTML='<summary>Full route tools & governed evidence</summary><div class="q-v53-lock-route-tools-body"></div>';
  const body=tools.querySelector('.q-v53-lock-route-tools-body');
  originalNodes.forEach(node=>body.append(node));

  main.append(buildSurface(spec,route),tools);
  requestAnimationFrame(()=>root.dataset.v53LockReady='true');
}

function adoptStrays(){
  if(!main)return;
  const body=main.querySelector(':scope > .q-v53-lock-route-tools > .q-v53-lock-route-tools-body');
  if(!body)return;
  [...main.childNodes].forEach(node=>{
    if(node.nodeType===1&&(node.matches('.q-v53-lock-page')||node.matches('.q-v53-lock-route-tools')))return;
    if(node.nodeType===3&&!node.textContent.trim()){node.remove();return;}
    body.append(node);
  });
}

function clearLockState(){
  delete root.dataset.v53LockCandidate;
  delete root.dataset.v53LockSlot;
  delete root.dataset.v53LockReady;
  if(main){delete main.dataset.v53LockCandidate;delete main.dataset.v53LockSlot;}
}

let scheduled=false;
function refresh(){
  scheduled=false;
  const route=routeFromHash();
  const spec=SPECS[route];
  if(!spec){clearLockState();return;}
  if(!main||main.getAttribute('aria-busy')==='true'||!main.firstElementChild)return;
  wrapRoute(spec,route);
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(refresh);}

loadStyle();
window.addEventListener('hashchange',schedule);
window.addEventListener('pageshow',schedule);
if(main)new MutationObserver(schedule).observe(main,{childList:true});
for(const delay of [0,60,180,500,1200])setTimeout(schedule,delay);

window.QellyV53LockCandidate=Object.freeze({schedule,routeFromHash,specs:SPECS});
