const truth=(value)=>String(value||'UNAVAILABLE').toUpperCase();
const tone=(value)=>{const state=truth(value);if(['LIVE','AVAILABLE','ACTIVE','COMPLETE','CLOUD'].includes(state))return 'live';if(['DELAYED','PARTIAL','DEGRADED','WARNING'].includes(state))return 'delayed';if(['CACHED','LOCAL','DETERMINISTIC'].includes(state))return 'cached';return 'unavailable';};
const number=(value)=>value===null||value===undefined||String(value).trim()===''?null:Number.isFinite(Number(value))?Number(value):null;
const money=(value,currency='USD')=>{const numeric=number(value);if(numeric==null)return '—';try{return new Intl.NumberFormat('en-IN',{style:'currency',currency,maximumFractionDigits:2}).format(numeric);}catch{return `${currency} ${numeric.toLocaleString('en-IN',{maximumFractionDigits:2})}`;}};
const amount=(value)=>{const numeric=number(value);return numeric==null?'—':new Intl.NumberFormat('en-IN',{maximumFractionDigits:6}).format(numeric);};
const date=(value)=>{const parsed=new Date(value||'');return Number.isNaN(parsed.getTime())?'Not supplied':parsed.toLocaleString('en-IN');};
const first=(object,keys,fallback=null)=>{for(const key of keys){if(object&&object[key]!=null)return object[key];}return fallback;};
const list=(payload)=>Array.isArray(payload)?payload:Array.isArray(payload?.items)?payload.items:Array.isArray(payload?.positions)?payload.positions:Array.isArray(payload?.holdings)?payload.holdings:[];
const stateOf=(payload)=>truth(first(payload,['truthState','state','status'],'UNAVAILABLE'));
const reasonOf=(payload)=>String(first(payload,['reason','fallbackReason','message','truthBoundary'],'')||'');

function panelState(label,payload,escapeHtml){
  const state=stateOf(payload),reason=reasonOf(payload);
  return `<div class="q-v6-portfolio-analytic"><div><span>${escapeHtml(label)}</span><strong>${escapeHtml(state)}</strong></div><span class="q-status q-status--${tone(state)}">${escapeHtml(state)}</span><p>${escapeHtml(reason||'No additional production evidence was supplied for this analytic.')}</p></div>`;
}

export async function renderPortfolioV6(main,deps){
  const {api,pageHead,stateBanner,escapeHtml}=deps;
  let overview,holdings,performance,risk,attribution;
  try{
    [overview,holdings,performance,risk,attribution]=await Promise.all([
      api('/api/v1/portfolio/overview'),
      api('/api/v1/portfolio/holdings'),
      api('/api/v1/portfolio/performance'),
      api('/api/v1/portfolio/risk'),
      api('/api/v1/portfolio/attribution')
    ]);
  }catch(error){
    main.innerHTML=`<section class="q-page q-v6-portfolio-page">${pageHead('Qelly Intelligence · Portfolio','Portfolio','The authenticated portfolio persistence service is unavailable. Qelly will not fabricate holdings, valuation or risk.', '')}${stateBanner()}<section class="q-panel"><div class="q-panel-body"><div class="q-empty-state"><strong>Portfolio service unavailable</strong><p>${escapeHtml(error.message)}</p></div></div></section></section>`;
    return;
  }

  const positions=list(holdings);
  const portfolio=first(overview,['portfolio','currentPortfolio'],overview)||{};
  const currency=String(first(portfolio,['baseCurrency','base_currency','currency'],first(overview,['baseCurrency','base_currency','currency'],'USD'))||'USD').toUpperCase();
  const userCost=positions.reduce((sum,item)=>sum+(number(first(item,['costBasis','cost_basis','investedAmount','invested_amount','bookValue','book_value']))||0),0);
  const quantityCount=positions.filter((item)=>number(first(item,['quantity','units','shares']))!=null).length;
  const pricedPositions=positions.filter((item)=>number(first(item,['marketPrice','market_price','price','mark']))!=null&&['LIVE','DELAYED','CACHED'].includes(truth(first(item,['truthState','priceTruthState','pricingState']))));
  const valuationCoverage=positions.length?Math.round((pricedPositions.length/positions.length)*100):0;
  const portfolioName=String(first(portfolio,['name','displayName','title'],'Primary portfolio')||'Primary portfolio');

  const rows=positions.map((item,index)=>{
    const symbol=String(first(item,['symbol','instrumentSymbol','instrument_symbol','ticker'],`Position ${index+1}`));
    const name=String(first(item,['displayName','name','instrumentName','instrument_name'],symbol));
    const quantity=first(item,['quantity','units','shares']);
    const cost=first(item,['costBasis','cost_basis','investedAmount','invested_amount','bookValue','book_value']);
    const mark=first(item,['marketPrice','market_price','price','mark']);
    const markState=truth(first(item,['truthState','priceTruthState','pricingState'],mark==null?'UNAVAILABLE':'UNVERIFIED'));
    const marketValue=number(mark)!=null&&number(quantity)!=null?number(mark)*number(quantity):null;
    const provenance=String(first(item,['source','provenance','origin'],'user-supplied portfolio record'));
    return `<article class="q-v6-portfolio-row"><div><strong>${escapeHtml(symbol)}</strong><small>${escapeHtml(name)}</small></div><div><span>Quantity</span><strong>${escapeHtml(amount(quantity))}</strong></div><div><span>Cost basis</span><strong>${escapeHtml(money(cost,currency))}</strong></div><div><span>Governed mark</span><strong>${escapeHtml(money(mark,currency))}</strong><small>${escapeHtml(mark==null?'No governed pricing observation attached':date(first(item,['observedAt','priceObservedAt','observed_at'])))}</small></div><div><span>Market value</span><strong>${escapeHtml(money(marketValue,currency))}</strong></div><span class="q-status q-status--${tone(markState)}">${escapeHtml(markState)}</span><small class="q-v6-portfolio-provenance">${escapeHtml(provenance)}</small></article>`;
  }).join('');

  main.innerHTML=`<section class="q-page q-v6-portfolio-page">
    ${pageHead('Qelly Intelligence · Governed portfolio','Portfolio','Authenticated portfolio records with strict separation between user-supplied holdings and governed market valuation. Missing pricing coverage stays unavailable rather than being replaced with demo marks.',`<a class="q-button q-button--secondary" href="#/instrument-master">Instrument master</a><a class="q-button q-button--primary" href="#/timeseries-lab">Governed reference data</a>`)}${stateBanner()}
    <div class="q-v6-deterministic-banner"><span class="q-status q-status--cached">RLS PORTFOLIO</span><p>Portfolio positions may contain user-entered quantity and cost information. A position receives market value, performance, risk or attribution only when a separately governed pricing observation covers the instrument and required period. Qelly does not substitute deterministic fixtures for missing portfolio prices.</p></div>
    <section class="q-v6-portfolio-kpis">
      <div><span>Portfolio</span><strong>${escapeHtml(portfolioName)}</strong><small>${escapeHtml(currency)} reporting currency</small></div>
      <div><span>Positions</span><strong>${positions.length}</strong><small>${quantityCount} with explicit quantity</small></div>
      <div><span>User cost basis</span><strong>${escapeHtml(money(userCost,currency))}</strong><small>sum of supplied position basis where present</small></div>
      <div><span>Pricing coverage</span><strong>${valuationCoverage}%</strong><small>${pricedPositions.length}/${positions.length||0} positions with governed marks</small></div>
      <div><span>Execution</span><strong>OFF</strong><small>read-only intelligence</small></div>
    </section>
    <div class="q-v6-portfolio-layout">
      <section class="q-panel"><div class="q-panel-head"><div><h2>Holdings ledger</h2><p>Persistence and pricing provenance are shown separately for every position.</p></div><span class="q-status q-status--${positions.length?'cached':'unavailable'}">${positions.length} POSITIONS</span></div><div class="q-panel-body q-v6-portfolio-ledger">${rows||'<div class="q-empty-state"><strong>No portfolio positions</strong><p>The authenticated portfolio store contains no holdings. No demo portfolio has been injected.</p></div>'}</div></section>
      <aside class="q-panel"><div class="q-panel-head"><div><h2>Analytic truth</h2><p>Availability is determined by data coverage, not UI expectations.</p></div></div><div class="q-panel-body q-v6-portfolio-analytics">${panelState('Performance',performance,escapeHtml)}${panelState('Risk',risk,escapeHtml)}${panelState('Attribution',attribution,escapeHtml)}</div></aside>
    </div>
    <section class="q-panel"><div class="q-panel-head"><div><h2>Portfolio evidence boundary</h2><p>What Qelly can and cannot prove from the current production data plane.</p></div><span class="q-status q-status--${valuationCoverage===100&&positions.length?'live':'delayed'}">${valuationCoverage===100&&positions.length?'COVERED':'PARTIAL / UNAVAILABLE'}</span></div><div class="q-panel-body"><dl class="q-v6-evidence-list"><dt>Persistence</dt><dd>Authenticated Supabase RLS portfolio records</dd><dt>Holdings</dt><dd>${positions.length?`${positions.length} persisted position record${positions.length===1?'':'s'}`:'No persisted positions'}</dd><dt>Pricing</dt><dd>${pricedPositions.length?`${pricedPositions.length} governed position mark${pricedPositions.length===1?'':'s'}`:'No governed position pricing coverage proven'}</dd><dt>Performance</dt><dd>${escapeHtml(stateOf(performance))}${reasonOf(performance)?` · ${escapeHtml(reasonOf(performance))}`:''}</dd><dt>Risk</dt><dd>${escapeHtml(stateOf(risk))}${reasonOf(risk)?` · ${escapeHtml(reasonOf(risk))}`:''}</dd><dt>Attribution</dt><dd>${escapeHtml(stateOf(attribution))}${reasonOf(attribution)?` · ${escapeHtml(reasonOf(attribution))}`:''}</dd><dt>Execution</dt><dd>Disabled by product constitution</dd></dl></div></section>
  </section>`;
}

export const __portfolioV6Test=Object.freeze({truth,tone,number,money,list,stateOf,reasonOf});
