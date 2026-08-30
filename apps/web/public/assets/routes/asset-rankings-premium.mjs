import {providerAvailability,providerPolicyMessage} from '../customer-copy.mjs';

const STYLE_ID='qelly-asset-rankings-v2-style';
const FALLBACK_CRITERIA=Object.freeze([
  {id:'balanced',label:'Balanced evidence',purpose:'Combine momentum, turnover, size and independent context availability.'},
  {id:'momentum',label:'24h momentum',purpose:'Order the current sample by attributed 24-hour percentage change.'},
  {id:'liquidity',label:'Turnover intensity',purpose:'Order the current sample by 24-hour volume as a share of market value.'},
  {id:'size',label:'Market value',purpose:'Order the current sample by attributed market capitalization.'},
  {id:'coverage',label:'Source coverage',purpose:'Surface candidates with independent midpoint context.'}
]);

function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const link=document.createElement('link');
  link.id=STYLE_ID;link.rel='stylesheet';link.href='./assets/routes/asset-rankings-v2.css?v=20260830-rankings2';
  document.head.append(link);
}

const stateTone=(state)=>state==='live'?'live':state==='cached'?'cached':state==='delayed'||state==='reference'?'delayed':'unavailable';
const stateLabel=(state)=>String(state||'unavailable').replace(/[_-]+/g,' ').toUpperCase();
const number=(value)=>Number.isFinite(Number(value))?Number(value):null;
const money=(value,{compact=false}={})=>number(value)==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:compact?'compact':'standard',maximumFractionDigits:Math.abs(Number(value))<1?5:2}).format(Number(value));
const percent=(value,digits=2)=>number(value)==null?'—':`${Number(value)>0?'+':''}${Number(value).toFixed(digits)}%`;
const compact=(value)=>number(value)==null?'—':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(Number(value));
const dateLabel=(value)=>{const date=new Date(value||'');return Number.isNaN(date.getTime())?'Not supplied':date.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});};

function unavailableRanking(){
  return {version:'governed-candidate-ranking-v1',state:'unavailable',purpose:'Narrow the governed crypto sample into research candidates using declared, adjustable criteria.',universe:{label:'Governed crypto sample',candidateCount:0,truthState:'unavailable',observedAt:null},candidates:[],exclusions:[],methodology:{defaultCriterion:'balanced',criteria:FALLBACK_CRITERIA,scoreMeaning:'Scores are relative positions inside the current governed sample, not return forecasts, confidence probabilities or recommendations.'},readiness:{candidateCount:0,crossSourceCandidates:0,excludedCount:0,primaryReady:false,contextReady:false},sourceLedger:[],boundaries:{withinSampleOnly:true,crossAsset:false,personalizedRecommendation:false,execution:false,fabricatedFallback:false,externalWidgetValuesConsumed:false}};
}

function candidateCard(row,scoreKey,selected,escapeHtml){
  const safe=(value)=>escapeHtml(String(value??''));
  const score=number(row.scores?.[scoreKey])??0;
  const context=row.contextMidUsd==null?'PRIMARY ONLY':'CROSS-SOURCE CONTEXT';
  return `<article class="q-ar-candidate" data-candidate="${safe(row.id)}" data-selected="${selected?'true':'false'}">
    <label class="q-ar-select"><input type="checkbox" data-rank-select="${safe(row.id)}" ${selected?'checked':''}><span>Select ${safe(row.symbol)} for shortlist</span></label>
    <div class="q-ar-rank"><span>#${safe(row.displayRank)}</span><b>${safe(score)}</b><small>${safe(scoreKey)} score</small></div>
    <div class="q-ar-identity"><span>${safe(row.symbol.slice(0,2))}</span><div><strong>${safe(row.name)}</strong><small>${safe(row.symbol)} · source rank ${safe(row.sourceRank??'—')}</small></div></div>
    <dl><div><dt>Price</dt><dd>${safe(money(row.priceUsd))}</dd></div><div><dt>24h</dt><dd data-tone="${number(row.change24hPct)>0?'positive':number(row.change24hPct)<0?'negative':'neutral'}">${safe(percent(row.change24hPct))}</dd></div><div><dt>Turnover</dt><dd>${safe(percent(row.turnoverPct))}</dd></div><div><dt>Market value</dt><dd>${safe(money(row.marketCapUsd,{compact:true}))}</dd></div></dl>
    <footer><span class="q-status q-status--${stateTone(row.truthState)}">${safe(stateLabel(row.truthState))}</span><small>${safe(context)}</small><button type="button" data-rank-inspect="${safe(row.id)}">Inspect evidence</button></footer>
  </article>`;
}

function sourceCard(source,escapeHtml){
  const safe=(value)=>escapeHtml(String(value??''));
  return `<article class="q-ar-source"><header><div><strong>${safe(source.label)}</strong><small>${safe(source.role)}</small></div><span class="q-status q-status--${stateTone(source.truthState)}">${safe(stateLabel(source.truthState))}</span></header><dl><div><dt>Observed</dt><dd>${safe(dateLabel(source.observedAt))}</dd></div><div><dt>Fetched</dt><dd>${safe(dateLabel(source.fetchedAt))}</dd></div></dl><p>${safe(source.usage||'Governed source boundary supplied by the runtime.')}</p></article>`;
}

function referenceRows(ecb,escapeHtml){
  const rates=ecb?.data?.rates&&typeof ecb.data.rates==='object'?ecb.data.rates:{};
  const rows=['USD','INR','GBP','JPY','CHF','CNY'].filter((code)=>number(rates[code])!=null);
  if(!rows.length)return '<div class="q-empty-state"><strong>Reference coverage unavailable</strong><p>No ECB values were returned, and Qelly inserted no substitutes.</p></div>';
  return `<div class="q-ar-reference-grid">${rows.map((code)=>`<article><span>EUR / ${escapeHtml(code)}</span><strong>${escapeHtml(String(rates[code]))}</strong><small>${escapeHtml(dateLabel(ecb.observationTime||ecb.observedAt))}</small></article>`).join('')}</div>`;
}

function providerBoundary(providers,escapeHtml){
  const safe=(value)=>escapeHtml(String(value??''));
  const relevant=providers.filter((provider)=>['binance','coinbase','ecb'].includes(provider.id));
  return relevant.map((provider)=>{const availability=providerAvailability(provider);return `<article><div><strong>${safe(provider.id.toUpperCase())}</strong><span class="q-status q-status--${safe(availability.tone)}">${safe(availability.label.toUpperCase())}</span></div><p>${safe(provider.enabled?'Approved reference source; not a candidate-ranking feed.':providerPolicyMessage(provider))}</p>${provider.termsUrl?`<a href="${safe(provider.termsUrl)}" target="_blank" rel="noopener noreferrer nofollow">Review terms ↗</a>`:''}</article>`;}).join('');
}

export async function renderAssetRankings(main,{api,escapeHtml,toast}){
  ensureStyles();
  let network={sources:{}};
  let marketOverview={providers:[]};
  const [networkResult,overviewResult]=await Promise.allSettled([api('/api/v1/market/network'),api('/api/v1/public/markets/overview')]);
  if(networkResult.status==='fulfilled')network=networkResult.value||network;
  if(overviewResult.status==='fulfilled')marketOverview=overviewResult.value||marketOverview;
  const ranking=network.assetRankings||unavailableRanking();
  const candidates=Array.isArray(ranking.candidates)?ranking.candidates:[];
  const criteria=Array.isArray(ranking.methodology?.criteria)&&ranking.methodology.criteria.length?ranking.methodology.criteria:FALLBACK_CRITERIA;
  const ledger=Array.isArray(ranking.sourceLedger)?ranking.sourceLedger:[];
  const providers=Array.isArray(marketOverview.providers)?marketOverview.providers:[];
  const ecb=network.sources?.ecb||null;
  const safe=(value)=>escapeHtml(String(value??''));
  const sourceCounts=ranking.readiness||{};
  main.innerHTML=`<section class="q-ar-page" data-ranking-experience="candidate-narrowing-v2" data-market-ranking-runtime="no-fabrication" data-ranking-state="${safe(ranking.state)}">
    <header class="q-ar-hero"><div><p class="q-eyebrow">Qelly Intelligence · Asset Rankings</p><h1>Turn a governed market sample into a defensible shortlist.</h1><p>${safe(ranking.purpose)}</p><div class="q-ar-hero-actions"><a class="q-button q-button--secondary" href="#/discovery-hub">Back to theme framing</a><button class="q-button q-button--primary" type="button" data-action="refresh-rankings">Refresh observations</button></div></div><aside><span>Unique job · candidate narrowing</span><strong>Rank only what Qelly can evidence.</strong><p>No fixed crypto scenario is shown in production. Asset Rankings is not search, a recommendation engine or a trading surface.</p></aside></header>
    <section class="q-ar-truth" role="status"><span></span><strong>Governed production truth</strong><p>attributed sample ${ranking.state==='available'?'available':'unavailable'} · fabricated fallback off · execution disabled</p><button type="button" data-ranking-boundary>Review boundary</button></section>
    <section class="q-ar-status" aria-label="Asset ranking availability"><article><span>Eligible candidates</span><strong>${safe(sourceCounts.candidateCount||0)}</strong><small>Complete required observations</small></article><article><span>Cross-source context</span><strong>${safe(sourceCounts.crossSourceCandidates||0)}</strong><small>Independent midpoint available</small></article><article><span>Excluded rows</span><strong>${safe(sourceCounts.excludedCount||0)}</strong><small>Missing required evidence</small></article><article><span>Fabricated prices</span><strong>0</strong><small>Production no-fabrication contract</small></article><article><span>Executable rankings</span><strong>0</strong><small>Research only · no trading</small></article></section>
    <section class="q-ar-method"><div><p class="q-eyebrow">Step 01 · declare the criterion</p><h2>Choose what “rank higher” means.</h2><p>Every score is relative to ${safe(ranking.universe?.label||'the current governed sample')}.</p></div><div class="q-ar-criteria" role="toolbar" aria-label="Ranking criteria">${criteria.map((criterion,index)=>`<button type="button" data-rank-criterion="${safe(criterion.id)}" aria-pressed="${index===0?'true':'false'}"><strong>${safe(criterion.label)}</strong><span>${safe(criterion.purpose)}</span></button>`).join('')}</div><aside><strong>Score meaning</strong><p>${safe(ranking.methodology?.scoreMeaning||'Relative research ordering only.')}</p></aside></section>
    <section class="q-ar-controls" aria-label="Ranking filters"><label><span>Find in sample</span><input type="search" data-rank-search placeholder="Symbol or asset name"></label><label><span>24h direction</span><select data-rank-direction><option value="all">All candidates</option><option value="positive">Advancers</option><option value="negative">Decliners</option></select></label><label class="q-ar-check"><input type="checkbox" data-rank-context><span><strong>Require cross-source context</strong><small>Hyperliquid midpoint exists; it is not treated as spot confirmation.</small></span></label><button type="button" data-action="reset-rankings">Reset workspace</button></section>
    <section class="q-ar-workbench"><div class="q-ar-results"><header><div><p class="q-eyebrow">Step 02 · compare evidence</p><h2 data-ranking-title>Balanced evidence ranking</h2><p><b data-result-count>${safe(candidates.length)}</b> candidates match · observed ${safe(dateLabel(ranking.universe?.observedAt))}</p></div><span class="q-status q-status--${stateTone(ranking.universe?.truthState)}">${safe(stateLabel(ranking.universe?.truthState))}</span></header><div class="q-ar-candidate-grid" data-candidate-grid>${candidates.length?'':'<div class="q-empty-state"><strong>Ranking observations unavailable</strong><p>Explore verified market sources while coverage is prepared. Qelly has not generated candidate values.</p></div>'}</div></div>
      <aside class="q-ar-shortlist"><header><p class="q-eyebrow">Step 03 · create a handoff</p><h2>Research shortlist</h2><span><b data-shortlist-count>0</b> / 5 selected</span></header><div data-shortlist-items><p>Select candidates to preserve the reason they surfaced.</p></div><button class="q-button q-button--primary" type="button" data-action="build-shortlist">Build shortlist handoff</button><div data-shortlist-output aria-live="polite"><small>A shortlist is a research queue, not a recommendation.</small></div></aside>
    </section>
    <section class="q-ar-audit"><div><p class="q-eyebrow">Method audit</p><h2>Know exactly how the ordering was produced.</h2></div><div class="q-ar-formula"><article><span>35%</span><strong>24h momentum</strong><p>Relative change position inside the sample.</p></article><article><span>30%</span><strong>Turnover intensity</strong><p>24h volume divided by market value.</p></article><article><span>20%</span><strong>Market value</strong><p>Relative size within the current sample.</p></article><article><span>15%</span><strong>Source coverage</strong><p>Independent midpoint context availability.</p></article></div><p>Balanced score = 35% momentum + 30% turnover + 20% size + 15% coverage. Criterion modes use one component at a time. Ties use symbol ascending. Scores are not expected returns or confidence probabilities.</p></section>
    <section class="q-ar-evidence"><header><div><p class="q-eyebrow">Source ledger</p><h2>Ranking inputs and their exact roles.</h2></div><span>${safe(`${ledger.length} sources`)}</span></header><div>${ledger.map((source)=>sourceCard(source,escapeHtml)).join('')||'<div class="q-empty-state"><strong>Source ledger unavailable</strong><p>The ranking is withheld until governed source metadata returns.</p></div>'}</div></section>
    <section class="q-ar-boundaries"><div><p class="q-eyebrow">Data source permissions</p><h2>Blocked feeds stay outside the ranking.</h2></div><div>${providerBoundary(providers,escapeHtml)}</div></section>
    <section class="q-ar-reference"><header><div><p class="q-eyebrow">Reference, not ranking</p><h2>ECB euro reference-rate universe</h2><p>Approved reference source values remain visibly separate from candidate scores.</p></div><span class="q-status q-status--${ecb?'delayed':'unavailable'}">${ecb?'REFERENCE DATA':'UNAVAILABLE'}</span></header>${referenceRows(ecb,escapeHtml)}</section>
    <section class="q-ar-links"><div><h2>Professional research surfaces</h2><p>External display values remain outside Qelly's analytical trust boundary.</p></div><a href="https://www.tradingview.com/markets/" target="_blank" rel="noopener noreferrer nofollow">TradingView ↗</a><a href="https://www.cmegroup.com/markets.html" target="_blank" rel="noopener noreferrer nofollow">CME markets ↗</a><a href="https://www.forexfactory.com/calendar" target="_blank" rel="noopener noreferrer nofollow">Forex Factory ↗</a><a href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" target="_blank" rel="noopener noreferrer nofollow">ECB ↗</a></section>
    <aside class="q-ar-inspector" data-rank-inspector hidden aria-live="polite"><button type="button" data-action="close-inspector" aria-label="Close evidence inspector">×</button><div data-inspector-content></div></aside>
  </section>`;
  main.removeAttribute('aria-busy');

  const selected=new Set();
  let criterion=criteria[0]?.id||'balanced';
  let direction='all';
  let query='';
  let requireContext=false;
  const grid=main.querySelector('[data-candidate-grid]');
  const shortlistItems=main.querySelector('[data-shortlist-items]');
  const inspector=main.querySelector('[data-rank-inspector]');
  const visible=()=>candidates.filter((row)=>{
    if(query&&!`${row.symbol} ${row.name}`.toLowerCase().includes(query))return false;
    if(direction==='positive'&&number(row.change24hPct)<=0)return false;
    if(direction==='negative'&&number(row.change24hPct)>=0)return false;
    if(requireContext&&row.contextMidUsd==null)return false;
    return true;
  }).sort((left,right)=>(number(right.scores?.[criterion])??0)-(number(left.scores?.[criterion])??0)||left.symbol.localeCompare(right.symbol)).map((row,index)=>({...row,displayRank:index+1}));
  const renderShortlist=()=>{
    const rows=candidates.filter((row)=>selected.has(row.id));
    main.querySelector('[data-shortlist-count]').textContent=String(rows.length);
    shortlistItems.innerHTML=rows.length?rows.map((row)=>`<article><strong>${safe(row.symbol)}</strong><span>${safe(row.name)}</span><small>${safe(`${number(row.scores?.[criterion])??0} ${criterion} score`)}</small></article>`).join(''):'<p>Select candidates to preserve the reason they surfaced.</p>';
  };
  const renderCandidates=()=>{
    const rows=visible();
    main.querySelector('[data-result-count]').textContent=String(rows.length);
    const activeCriterion=criteria.find((item)=>item.id===criterion);
    main.querySelector('[data-ranking-title]').textContent=`${activeCriterion?.label||'Evidence'} ranking`;
    main.querySelectorAll('[data-rank-criterion]').forEach((button)=>button.setAttribute('aria-pressed',String(button.dataset.rankCriterion===criterion)));
    grid.innerHTML=rows.length?rows.map((row)=>candidateCard(row,criterion,selected.has(row.id),escapeHtml)).join(''):'<div class="q-empty-state"><strong>No candidates match these rules.</strong><p>Reset one filter or return to the complete governed sample.</p></div>';
    renderShortlist();
  };
  renderCandidates();

  main.querySelectorAll('[data-rank-criterion]').forEach((button)=>button.addEventListener('click',()=>{criterion=button.dataset.rankCriterion;renderCandidates();main.querySelector('[data-shortlist-output]').innerHTML='<small>The ordering changed. Rebuild the handoff to record the active criterion.</small>';}));
  main.querySelector('[data-rank-search]').addEventListener('input',(event)=>{query=event.target.value.trim().toLowerCase();renderCandidates();});
  main.querySelector('[data-rank-direction]').addEventListener('change',(event)=>{direction=event.target.value;renderCandidates();});
  main.querySelector('[data-rank-context]').addEventListener('change',(event)=>{requireContext=event.target.checked;renderCandidates();});
  grid.addEventListener('change',(event)=>{
    const input=event.target.closest('[data-rank-select]');
    if(!input)return;
    if(input.checked&&selected.size>=5){input.checked=false;toast?.('A research shortlist can contain up to five candidates.',{tone:'warning'});return;}
    input.checked?selected.add(input.dataset.rankSelect):selected.delete(input.dataset.rankSelect);
    renderCandidates();
  });
  grid.addEventListener('click',(event)=>{
    const button=event.target.closest('[data-rank-inspect]');
    if(!button)return;
    const row=candidates.find((item)=>item.id===button.dataset.rankInspect);
    if(!row)return;
    inspector.hidden=false;
    main.querySelector('[data-inspector-content]').innerHTML=`<p class="q-eyebrow">Evidence inspector</p><h2>${safe(row.name)} · ${safe(row.symbol)}</h2><p>This candidate is ordered within ${safe(ranking.universe?.label)}. It is not compared with every investable asset.</p><dl><div><dt>Attributed price</dt><dd>${safe(money(row.priceUsd))}</dd></div><div><dt>24h change</dt><dd>${safe(percent(row.change24hPct))}</dd></div><div><dt>24h volume</dt><dd>${safe(money(row.volume24hUsd,{compact:true}))}</dd></div><div><dt>Market value</dt><dd>${safe(money(row.marketCapUsd,{compact:true}))}</dd></div><div><dt>Turnover</dt><dd>${safe(percent(row.turnoverPct))}</dd></div><div><dt>Independent midpoint</dt><dd>${safe(money(row.contextMidUsd))}</dd></div><div><dt>Indicative basis difference</dt><dd>${safe(percent(row.contextDifferencePct))}</dd></div><div><dt>Observed</dt><dd>${safe(dateLabel(row.observedAt))}</dd></div></dl><section><strong>Score components</strong>${Object.entries(row.scores||{}).map(([key,value])=>`<span>${safe(key)} <b>${safe(value)}</b></span>`).join('')}</section><p>Hyperliquid context is a perpetual midpoint and is not treated as spot-price confirmation or an executable spread.</p>`;
  });
  main.querySelector('[data-action="close-inspector"]').addEventListener('click',()=>{inspector.hidden=true;});
  main.querySelector('[data-action="reset-rankings"]').addEventListener('click',()=>{criterion=criteria[0]?.id||'balanced';direction='all';query='';requireContext=false;selected.clear();main.querySelector('[data-rank-search]').value='';main.querySelector('[data-rank-direction]').value='all';main.querySelector('[data-rank-context]').checked=false;renderCandidates();main.querySelector('[data-shortlist-output]').innerHTML='<small>Workspace reset to the balanced governed sample.</small>';});
  main.querySelector('[data-action="build-shortlist"]').addEventListener('click',()=>{
    const rows=candidates.filter((row)=>selected.has(row.id));
    const output=main.querySelector('[data-shortlist-output]');
    output.innerHTML=rows.length?`<div><strong>Shortlist handoff ready</strong><p>${rows.map((row)=>safe(row.symbol)).join(' · ')}</p><ol><li>Criterion: ${safe(criteria.find((item)=>item.id===criterion)?.label||criterion)}</li><li>Direction: ${safe(direction)}</li><li>Cross-source context required: ${requireContext?'yes':'no'}</li></ol><a class="q-button q-button--secondary" href="#/research-workspace">Open research workspace</a><a class="q-button q-button--secondary" href="#/asset-intelligence">Open Asset Intelligence</a></div>`:'<small>Select at least one candidate before building a handoff.</small>';
    toast?.(rows.length?'Research shortlist prepared with its active method.':'Select at least one candidate first.',{tone:rows.length?'success':'warning'});
  });
  main.querySelector('[data-action="refresh-rankings"]').addEventListener('click',()=>{void renderAssetRankings(main,{api,escapeHtml,toast});});
  main.querySelector('[data-ranking-boundary]').addEventListener('click',()=>toast?.('This ranks only the current attributed sample. It excludes unavailable feeds, uses no fabricated prices, provides no personalized recommendation and cannot execute.',{tone:'neutral'}));
}

export const __assetRankingsTest=Object.freeze({FALLBACK_CRITERIA,unavailableRanking,money,percent,compact,stateTone});
