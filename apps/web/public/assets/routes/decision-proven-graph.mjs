import {adSlot,mountAdSlots} from '../qelly-ad-slot.mjs';
const STYLESHEET=new URL('../qelly-decision-proven-graph.css',import.meta.url).href;
const installStyles=()=>{if(!document.querySelector('link[data-decision-proven-graph]')){const link=document.createElement('link');link.rel='stylesheet';link.href=STYLESHEET;link.dataset.decisionProvenGraph='v2';document.head.append(link);}};
const money=(value)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:Number(value)>=100?0:2}).format(value);
const pct=(value)=>Number(value).toFixed(2)+'%';
const compactMoney=(value)=>Number.isFinite(Number(value))?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(Number(value)):'Unavailable';
const compactNumber=(value)=>Number.isFinite(Number(value))?new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:3}).format(Number(value)):'Unavailable';
const download=(value)=>{const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='qelly-decision-intelligence-'+value.asset.toLowerCase()+'-'+value.interval+'.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),500);};
const INTERVAL_MS=Object.freeze({'1m':60_000,'5m':300_000,'15m':900_000,'30m':1_800_000,'1h':3_600_000,'4h':14_400_000,'1d':86_400_000});
const HORIZON_MS=Object.freeze({'1h':3_600_000,'4h':14_400_000,'12h':43_200_000,'1d':86_400_000,'3d':259_200_000,'7d':604_800_000});
const validHorizons=(interval)=>Object.keys(HORIZON_MS).filter(horizon=>{const bars=Math.ceil(HORIZON_MS[horizon]/INTERVAL_MS[interval]);return bars>=2&&bars<=168;});
const normalizeHorizon=(interval,horizon)=>validHorizons(interval).includes(horizon)?horizon:validHorizons(interval)[0];
const CHAT_DECISION_CONTEXT_KEY='qelly.decision.chat-context.v1';
const DECISION_ASSETS=new Set(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
const readChatDecisionContext=()=>{
  try{
    const storage=globalThis.sessionStorage;
    if(!storage)return {asset:'BTC',interval:'15m'};
    const raw=storage.getItem(CHAT_DECISION_CONTEXT_KEY);
    if(!raw)return {asset:'BTC',interval:'15m'};
    storage.removeItem(CHAT_DECISION_CONTEXT_KEY);
    const parsed=JSON.parse(raw),createdAt=Date.parse(parsed?.createdAt||'');
    if(!Number.isFinite(createdAt)||Date.now()-createdAt>15*60_000)return {asset:'BTC',interval:'15m'};
    const asset=DECISION_ASSETS.has(String(parsed?.asset||'').toUpperCase())?String(parsed.asset).toUpperCase():'BTC';
    const interval=Object.hasOwn(INTERVAL_MS,String(parsed?.timeframe||''))?String(parsed.timeframe):'15m';
    return {asset,interval};
  }catch{return {asset:'BTC',interval:'15m'};}
};
const displayTime=(value)=>{
  const raw=String(value||'').trim();
  const compact=raw.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/);
  const normalized=compact?`${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}Z`:raw;
  const parsed=new Date(normalized);
  return Number.isNaN(parsed.getTime())?'Time unavailable':parsed.toLocaleString();
};

function chart(data,escapeHtml){
  const history=data.market.candles,future=data.forecast.fan,all=[...history.flatMap(item=>[item.low,item.high]),...future.flatMap(item=>[item.p05,item.p95])],min=Math.min(...all),max=Math.max(...all),width=1000,height=430,pad=38,split=690;
  const y=(value)=>pad+(max-value)/(max-min||1)*(height-pad*2),hx=(index)=>pad+index/Math.max(1,history.length-1)*(split-pad),fx=(index)=>split+index/Math.max(1,future.length)*(width-split-pad);
  const line=(items,x,get)=>items.map((item,index)=>(index?'L':'M')+x(index).toFixed(1)+','+y(get(item)).toFixed(1)).join(' ');
  const band=(upper,lower)=>line(future,fx,item=>item[upper])+' '+[...future].reverse().map((item,index)=>'L'+fx(future.length-1-index).toFixed(1)+','+y(item[lower]).toFixed(1)).join(' ')+' Z';
  const candleWidth=Math.max(1.2,(split-pad)/history.length*.62);
  const candles=history.map((item,index)=>{const x=hx(index),up=item.close>=item.open,top=y(Math.max(item.open,item.close)),body=Math.max(1.5,Math.abs(y(item.open)-y(item.close)));return '<g class="q-dpg-candle '+(up?'is-up':'is-down')+'"><path d="M'+x+','+y(item.high)+'V'+y(item.low)+'"/><rect x="'+(x-candleWidth/2)+'" y="'+top+'" width="'+candleWidth+'" height="'+body+'"/></g>';}).join('');
  return '<svg class="q-dpg-chart" viewBox="0 0 '+width+' '+height+'" role="img" data-dpg-chart data-count="'+history.length+'" aria-label="Interactive '+escapeHtml(data.asset)+' candlestick chart. Drag across the observed chart to select a move for explanation."><defs><linearGradient id="dpg95"><stop stop-color="#7d2944" stop-opacity=".38"/><stop offset="1" stop-color="#b34566" stop-opacity=".08"/></linearGradient><linearGradient id="dpg50"><stop stop-color="#d36483" stop-opacity=".5"/><stop offset="1" stop-color="#e69aae" stop-opacity=".16"/></linearGradient></defs><g class="q-dpg-grid"><path d="M38 108H962M38 215H962M38 322H962"/><path d="M'+split+' 38V392"/></g><path class="q-dpg-band q-dpg-band--outer" d="'+band('p95','p05')+'"/><path class="q-dpg-band q-dpg-band--inner" d="'+band('p75','p25')+'"/>'+candles+'<path class="q-dpg-median" d="M'+split+','+y(data.market.lastPrice)+' '+line(future,fx,item=>item.p50).replace(/^M/,'L')+'"/><g data-dpg-selection class="q-dpg-selection" hidden><rect x="0" y="'+pad+'" width="0" height="'+(height-pad*2)+'"/></g><circle cx="'+split+'" cy="'+y(data.market.lastPrice)+'" r="6"/><text x="40" y="28">PAST · OBSERVED</text><text x="'+(split+16)+'" y="28">FUTURE · SCENARIOS</text><text x="'+(split-10)+'" y="'+Math.max(55,y(data.market.lastPrice)-12)+'" text-anchor="end">NOW '+money(data.market.lastPrice)+'</text></svg>';
}

const multiTimeframe=(data,escapeHtml)=>{const mtf=data.multiTimeframe,views=mtf?.views||[];if(!views.length)return '<section class="q-dpg-mtf"><header><div><small>MULTI-TIMEFRAME</small><h2>Cross-horizon confirmation unavailable</h2></div><span>Not inferred</span></header><p>Independent timeframe observations could not be verified, so no agreement claim is shown.</p></section>';return '<section class="q-dpg-mtf"><header><div><small>MULTI-TIMEFRAME</small><h2>'+escapeHtml(mtf.agreement.direction)+' · '+mtf.agreement.aligned+'/'+mtf.agreement.total+' aligned</h2></div><span>'+escapeHtml(mtf.state)+'</span></header><div>'+views.map(view=>'<article><span>'+escapeHtml(view.interval)+'</span><strong class="q-dpg-mtf__'+view.qellyView.action.toLowerCase().replace(/\s+/g,'-')+'">'+escapeHtml(view.qellyView.action)+'</strong><small>'+escapeHtml(view.marketState.label)+'</small><p>RSI '+view.metrics.rsi14+' · '+Math.round(view.probabilities.bull*100)+'% bull / '+Math.round(view.probabilities.bear*100)+'% bear</p></article>').join('')+'</div><p>Agreement compares independently observed timeframes. Mixed evidence is shown as mixed; it is never forced into a trade call.</p></section>';};

const derivativesContext=(data,escapeHtml)=>{
  const derivatives=data.evidence?.derivatives;
  if(!derivatives||derivatives.state!=='live'){
    return '<section class="q-dpg-derivatives"><header><div><small>DERIVATIVES CONTEXT</small><h2>Funding and open interest unavailable</h2></div><span>Not inferred</span></header><p>'+escapeHtml(derivatives?.message||'Current perpetual-market context could not be verified, so Qelly does not create substitute values.')+'</p><p class="q-dpg-derivatives__limit">Liquidations remain unavailable unless separately sourced.</p></section>';
  }
  const funding=derivatives.fundingPct==null?'Unavailable':Number(derivatives.fundingPct).toFixed(4)+'%';
  const basis=derivatives.markOracleBasisPct==null?'Unavailable':Number(derivatives.markOracleBasisPct).toFixed(4)+'%';
  return '<section class="q-dpg-derivatives"><header><div><small>DERIVATIVES CONTEXT · CURRENT</small><h2>Funding and open interest</h2></div><span>'+escapeHtml(derivatives.provider)+' · '+new Date(derivatives.observedAt).toLocaleString()+'</span></header><div class="q-dpg-derivatives__grid"><article><span>Current funding</span><strong>'+funding+'</strong></article><article><span>Open interest</span><strong>'+compactNumber(derivatives.openInterest)+' '+escapeHtml(data.asset)+'</strong></article><article><span>OI notional</span><strong>'+compactMoney(derivatives.openInterestNotionalUsd)+'</strong></article><article><span>24h perp volume</span><strong>'+compactMoney(derivatives.dayNotionalVolumeUsd)+'</strong></article><article><span>Mark / oracle basis</span><strong>'+basis+'</strong></article></div><p>'+escapeHtml(derivatives.message)+'</p><p class="q-dpg-derivatives__limit">Liquidations: unavailable, not inferred.</p></section>';
};

const actionTone=(action)=>action==='BUY'?'positive':action==='SELL'?'negative':action==='NO TRADE'?'muted':'neutral';
const levels=(view)=>{if(!view.levels)return '<p class="q-dpg-no-levels">No entry, target or invalidation levels are shown because the evidence threshold is not met.</p>';return '<div class="q-dpg-levels"><span>Entry zone<strong>'+money(view.levels.entryZone[0])+' – '+money(view.levels.entryZone[1])+'</strong></span><span>Invalidation<strong>'+money(view.levels.invalidation)+'</strong></span><span>Targets<strong>'+view.levels.targets.map(money).join(' · ')+'</strong></span><span>R:R<strong>'+view.levels.riskReward.map(value=>'1:'+value).join(' · ')+'</strong></span></div>';};

const heroSnapshot=(data,escapeHtml)=>{
  const view=data.qellyView||{},gate=view.evidenceGate||{},latestNews=data.evidence?.news?.articles?.[0]||null;
  const agreement=Number.isFinite(Number(gate.timeframeAgreement))?Math.round(Number(gate.timeframeAgreement)*100)+'%':'Unavailable';
  const derivatives=data.evidence?.derivatives?.state==='live'?'Funding / OI live':'Unavailable';
  const lastEvent=latestNews?latestNews.title:'No fresh sourced event verified';
  const lastEventTime=latestNews?.publishedAt||data.observedAt;
  return '<section class="q-dpg-hero-snapshot" aria-label="Decision Intelligence snapshot">'+
    '<article><span>Current price</span><strong>'+money(data.market.lastPrice)+'</strong><small>'+escapeHtml(data.asset)+' · '+escapeHtml(data.interval)+'</small></article>'+
    '<article><span>Freshness</span><strong>'+escapeHtml(data.truthState)+'</strong><small>'+escapeHtml(displayTime(data.observedAt))+'</small></article>'+
    '<article><span>Regime</span><strong>'+escapeHtml(data.market.currentState.label)+'</strong><small>Observed market state</small></article>'+
    '<article><span>Risk state</span><strong>'+escapeHtml(view.riskState?.label||'Unknown')+'</strong><small>ATR '+escapeHtml(String(view.riskState?.atrPct??'—'))+'%</small></article>'+
    '<article><span>Timeframe agreement</span><strong>'+escapeHtml(agreement)+'</strong><small>'+escapeHtml(String(gate.timeframeAligned??0)+'/'+String(gate.timeframeTotal??0)+' aligned')+'</small></article>'+
    '<article><span>Data coverage</span><strong>'+escapeHtml(String(data.market.points))+' candles</strong><small>'+escapeHtml(data.provenance.provider)+' public data</small></article>'+
    '<article><span>Derivatives</span><strong>'+escapeHtml(derivatives)+'</strong><small>Context only · never direction by itself</small></article>'+
    '<article class="q-dpg-hero-snapshot__event"><span>Last meaningful event</span><strong>'+escapeHtml(lastEvent)+'</strong><small>'+escapeHtml(displayTime(lastEventTime))+'</small></article>'+
  '</section>';
};

const tradeResearchMarkup=(data,escapeHtml)=>{
  const trade=data.tradeResearch;
  if(!trade)return '';
  const selected=trade.selected;
  const matrix=Array.isArray(trade.matrix)?trade.matrix:[];
  const matrixMarkup=matrix.length?matrix.map(item=>'<article class="q-dpg-rr-card q-dpg-rr-card--'+escapeHtml(String(item.feasibility||'unavailable').toLowerCase().replace(/\s+/g,'-'))+'"><span>'+escapeHtml(item.label)+'</span><strong>'+money(item.target)+'</strong><small>'+escapeHtml(item.feasibility)+'</small><p>'+escapeHtml(item.feasibilityReason)+'</p><em>Target-touch probability: uncalibrated</em></article>').join(''):'<p class="q-dpg-no-levels">No R:R matrix is available because the current evidence gate does not support a directional setup.</p>';
  const status=trade.status==='VALID'?'live':'warning';
  return '<section class="q-dpg-trade-research"><header><div><small>FIND TRADE NOW · RESEARCH ONLY</small><h2>'+(trade.status==='VALID'?'Evidence-qualified setup':'No valid setup')+'</h2><p>'+escapeHtml(trade.reason)+'</p></div><span class="q-status q-status--'+status+'">'+escapeHtml(trade.status)+'</span></header>'+
    (trade.entry?'<div class="q-dpg-trade-summary"><article><span>Entry</span><strong>'+money(trade.entry.preferred)+'</strong><small>'+escapeHtml(trade.entry.method)+' · '+money(trade.entry.zone[0])+' – '+money(trade.entry.zone[1])+'</small></article><article><span>Stop / invalidation</span><strong>'+money(trade.stop.price)+'</strong><small>'+escapeHtml(String(trade.stop.distancePct??'—'))+'% from price</small></article><article><span>Selected R:R</span><strong>'+(selected?escapeHtml(selected.label):'None')+'</strong><small>'+(selected?escapeHtml(selected.feasibility):'Not supported')+'</small></article><article><span>Setup expiry</span><strong>'+(trade.expiryAt?escapeHtml(displayTime(trade.expiryAt)):'Unavailable')+'</strong><small>Reassess after expiry or evidence change</small></article></div>':'')+
    '<div class="q-dpg-rr-grid">'+matrixMarkup+'</div>'+
    '<div class="q-dpg-trade-boundary"><strong>Calibration boundary</strong><p>'+escapeHtml(trade.calibration)+'</p></div>'+
    (Array.isArray(trade.contradictions)&&trade.contradictions.length?'<div class="q-dpg-contradictions"><strong>Contradictions</strong><ul>'+trade.contradictions.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul></div>':'')+
    '<p class="q-dpg-trade-change"><strong>What changes the view:</strong> '+escapeHtml(trade.whatChangesView)+'</p>'+
  '</section>';
};

const calibration=(view,escapeHtml)=>{
  const gate=view.evidenceGate||{};
  const scenario=view.scenario||{};
  const agreement=Number.isFinite(Number(gate.timeframeAgreement))?Math.round(Number(gate.timeframeAgreement)*100)+'%':'Unavailable';
  const edge=Number.isFinite(Number(scenario.gap))?Math.round(Number(scenario.gap)*100)+' pts':'Unavailable';
  const risk=view.riskState?.label||'Unknown';
  const contradictions=Array.isArray(view.contradictions)?view.contradictions:[];
  return '<div class="q-dpg-calibration"><article><span>Scenario edge</span><strong>'+escapeHtml(edge)+'</strong><small>'+escapeHtml(String(scenario.leading||'BALANCED'))+'</small></article><article><span>Timeframe agreement</span><strong>'+escapeHtml(agreement)+'</strong><small>'+escapeHtml(String(gate.timeframeAligned??0)+'/'+String(gate.timeframeTotal??0)+' observed')+'</small></article><article><span>Risk state</span><strong>'+escapeHtml(risk)+'</strong><small>ATR '+escapeHtml(String(view.riskState?.atrPct??'—'))+'%</small></article><article><span>Signal gate</span><strong>'+(gate.directionalEligible?'CLEARED':'NOT CLEARED')+'</strong><small>Base view '+escapeHtml(String(gate.baseAction||view.action))+'</small></article></div>'+(contradictions.length?'<div class="q-dpg-contradictions"><strong>Conflicting evidence</strong><ul>'+contradictions.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul></div>':'')+'<p class="q-dpg-confidence-note">Confidence measures evidence quality and agreement. It is not a success probability.</p>';
};



export async function renderDecisionProvenGraph(main,deps){
  installStyles();const {api,pageHead,stateBanner,escapeHtml,toast}=deps;
  const chatContext=readChatDecisionContext();
  let state={asset:chatContext.asset,interval:chatContext.interval,horizon:normalizeHorizon(chatContext.interval,'4h'),rr:'auto',customRr:'2.5',loading:true,data:null,error:null,draft:null,selection:null};
  const select=(name,values)=>'<label><span>'+name[0].toUpperCase()+name.slice(1)+'</span><select data-dpg-'+name+'>'+values.map(value=>'<option value="'+value+'" '+(state[name]===value?'selected':'')+'>'+value+'</option>').join('')+'</select></label>';
  const evidence=(data)=>{
    const move=data.selection,quant=move?.evidence||[],articles=data.evidence?.news?.articles||[];
    const items=[...quant.map(item=>({kind:item.type,title:item.title,detail:item.detail,meta:item.direction,score:item.strength})),...articles.slice(0,5).map(article=>({kind:'news',title:article.title,detail:article.source||'News report',meta:article.publishedAt,url:article.url,score:.45}))].sort((a,b)=>b.score-a.score);
    if(!items.length)return '<div class="q-dpg-empty">Select a candle range and choose <strong>Explain this move</strong> to rank the available price, volume, volatility and news evidence.</div>';
    return '<ol class="q-dpg-ranked">'+items.map((item,index)=>'<li><span>'+(index+1)+'</span><div><small>'+escapeHtml(item.kind)+'</small><strong>'+(item.url?'<a href="'+escapeHtml(item.url)+'" target="_blank" rel="noopener">'+escapeHtml(item.title)+'</a>':escapeHtml(item.title))+'</strong><p>'+escapeHtml(item.detail)+'</p><em>'+escapeHtml(item.meta||'context')+'</em></div></li>').join('')+'</ol>';
  };
  const content=(data)=>{
    const view=data.qellyView,move=data.selection;
    return '<section class="q-dpg-truth"><span class="q-status q-status--'+(data.truthState==='LIVE'?'live':data.truthState.toLowerCase())+'">'+escapeHtml(data.truthState)+'</span><strong>'+escapeHtml(data.asset)+' / '+escapeHtml(data.interval)+'</strong><span>'+escapeHtml(data.market.currentState.label)+' · updated '+new Date(data.observedAt).toLocaleString()+'</span></section>'+
      heroSnapshot(data,escapeHtml)+
      tradeResearchMarkup(data,escapeHtml)+
      '<section class="q-dpg-view q-dpg-view--'+actionTone(view.action)+'"><div><small>QELLY VIEW</small><h2>'+escapeHtml(view.action)+'</h2><p>'+escapeHtml(view.label)+'</p></div><div class="q-dpg-confidence"><span>Evidence confidence</span><strong>'+Math.round(view.confidence*100)+'%</strong></div>'+calibration(view,escapeHtml)+levels(view)+'<details><summary>Why this view?</summary><ul>'+view.why.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul><p><strong>What changes it:</strong> '+escapeHtml(view.changesIf)+'</p></details></section>'+
      '<section class="q-dpg-stage"><div class="q-dpg-chart-wrap"><div class="q-dpg-chart-help">Click one candle or drag across observed candles to select a move.</div>'+chart(data,escapeHtml)+'<div class="q-dpg-selection-actions"><span data-dpg-selection-label>'+(state.draft?(state.draft.end-state.draft.start<(INTERVAL_MS[state.interval]||0)?'Single candle selected':'Range selected'):'No range selected')+'</span><button class="q-button q-button--primary" data-dpg-explain '+(state.draft?'':'disabled')+'>'+(state.draft&&state.draft.end-state.draft.start<(INTERVAL_MS[state.interval]||0)?'Explain this candle':'Explain this move')+'</button><button class="q-button q-button--secondary" data-dpg-clear '+(state.draft||state.selection?'':'disabled')+'>Clear</button></div></div><aside class="q-dpg-scenarios">'+[['Bull',data.forecast.probabilities.bull],['Base',data.forecast.probabilities.base],['Bear',data.forecast.probabilities.bear]].map(([label,value])=>'<article><span>'+label+'</span><strong>'+Math.round(value*100)+'%</strong><meter min="0" max="1" value="'+value+'"></meter></article>').join('')+'<p>Modelled terminal range<br><strong>'+money(data.forecast.terminal.p05)+' – '+money(data.forecast.terminal.p95)+'</strong></p></aside></section>'+
      (move?'<section class="q-dpg-move"><header><div><small>SELECTED MOVE</small><h2>'+pct(move.changePct)+' across '+move.candles+' candles</h2></div><span>'+new Date(move.start).toLocaleString()+' → '+new Date(move.end).toLocaleString()+'</span></header><div><article><span>Range</span><strong>'+pct(move.rangePct)+'</strong></article><article><span>Volume vs prior</span><strong>'+(move.volumeRatio?move.volumeRatio+'×':'N/A')+'</strong></article><article><span>Volatility</span><strong>'+pct(move.volatilityPct)+'</strong></article><article><span>Prior volatility</span><strong>'+(move.priorVolatilityPct===null?'N/A':pct(move.priorVolatilityPct))+'</strong></article></div></section>':'')+
      '<section class="q-dpg-timeframe"><article><small>PAST</small><h3>What moved</h3><p>'+(move?escapeHtml(move.evidence[0]?.title||'Selected range analyzed.'):'Select the precise candles you want to investigate.')+'</p></article><article><small>PRESENT</small><h3>'+escapeHtml(data.market.currentState.label)+'</h3><p>RSI '+data.metrics.rsi14+' · ATR '+pct(data.metrics.atrPct)+' · return z-score '+data.metrics.returnZScore+'.</p></article><article><small>FUTURE</small><h3>Probability, not prediction</h3><p>'+Math.round(data.forecast.probabilities.bull*100)+'% bull · '+Math.round(data.forecast.probabilities.base*100)+'% base · '+Math.round(data.forecast.probabilities.bear*100)+'% bear over '+escapeHtml(data.horizon)+'.</p></article></section>'+
      multiTimeframe(data,escapeHtml)+derivativesContext(data,escapeHtml)+adSlot('decision-intelligence-inline')+'<section class="q-dpg-evidence"><header><div><small>EVIDENCE RANKING</small><h2>What best explains the move</h2></div><span>News: '+escapeHtml(data.evidence?.news?.state||'unavailable')+' · Funding/OI: '+escapeHtml(data.evidence?.derivatives?.state||'unavailable')+' · Liquidations: unavailable, not inferred</span></header>'+evidence(data)+'</section>'+
      '<details class="q-dpg-audit"><summary>Methodology and sources</summary><div><section><h3>Market data</h3><p>'+escapeHtml(data.provenance.provider)+' public candles. <a href="'+escapeHtml(data.provenance.documentation)+'" target="_blank" rel="noopener">Source documentation ↗</a></p></section><section><h3>Method</h3><p>'+data.provenance.model.features.map(escapeHtml).join(' · ')+'</p><p>'+escapeHtml(data.confidence.calibration)+'</p></section><section><h3>Limits</h3><ul>'+data.provenance.model.limitations.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul></section></div></details>';
  };
  const draw=()=>{
    const data=state.data;
    main.innerHTML='<section class="q-page q-dpg-page">'+pageHead('QELLY Decision Intelligence','Explain the move. Weigh the evidence. Decide with context.','Select any chart range to connect price action with ranked quantitative and live news evidence, then see a transparent research view across past, present and possible futures.','<button class="q-button q-button--secondary" data-dpg-export '+(data?'':'disabled')+'>Export research</button><button class="q-button q-button--primary" data-dpg-refresh>Refresh</button>')+stateBanner()+'<section class="q-dpg-controls q-dpg-controls--decision" aria-label="Decision controls">'+select('asset',['BTC','ETH','SOL','HYPE','XRP','DOGE'])+select('interval',['1m','5m','15m','30m','1h','4h','1d'])+select('horizon',validHorizons(state.interval))+'<label><span>Risk / reward</span><select data-dpg-rr><option value="auto" '+(state.rr==='auto'?'selected':'')+'>Auto</option><option value="1" '+(state.rr==='1'?'selected':'')+'>1:1</option><option value="2" '+(state.rr==='2'?'selected':'')+'>1:2</option><option value="3" '+(state.rr==='3'?'selected':'')+'>1:3</option><option value="4" '+(state.rr==='4'?'selected':'')+'>1:4</option><option value="custom" '+(state.rr==='custom'?'selected':'')+'>Custom</option></select></label>'+(state.rr==='custom'?'<label><span>Custom R:R</span><input data-dpg-custom-rr type="number" min="0.5" max="10" step="0.1" value="'+escapeHtml(state.customRr)+'"></label>':'')+'<button class="q-button q-button--primary q-dpg-find-trade" data-dpg-find-trade>Find Trade Now</button><p>Public research · no sign-in required · no trade execution</p></section>'+(state.loading?'<section class="q-dpg-state" role="status"><span class="q-spinner"></span><h2>Weighing fresh evidence</h2><p>Loading market observations and scenario ranges.</p></section>':'')+(state.error?'<section class="q-dpg-state q-dpg-state--error" role="alert"><h2>Live research unavailable</h2><p>'+escapeHtml(state.error)+'</p><button class="q-button q-button--secondary" data-dpg-refresh>Try again</button></section>':'')+(data?content(data):'')+'</section>';
    wire();mountAdSlots(main);
  };
  const wire=()=>{
    main.querySelectorAll('[data-dpg-asset],[data-dpg-interval],[data-dpg-horizon]').forEach(element=>element.addEventListener('change',()=>{
      const key=element.hasAttribute('data-dpg-asset')?'asset':element.hasAttribute('data-dpg-interval')?'interval':'horizon';
      state[key]=element.value;
      if(key==='interval')state.horizon=normalizeHorizon(state.interval,state.horizon);
      state.draft=null;state.selection=null;load();
    }));
    main.querySelector('[data-dpg-rr]')?.addEventListener('change',(event)=>{state.rr=event.currentTarget.value;load();});
    main.querySelector('[data-dpg-custom-rr]')?.addEventListener('change',(event)=>{state.customRr=event.currentTarget.value;load();});
    main.querySelector('[data-dpg-find-trade]')?.addEventListener('click',load);
    main.querySelectorAll('[data-dpg-refresh]').forEach(button=>button.addEventListener('click',load));main.querySelector('[data-dpg-export]')?.addEventListener('click',()=>{download(state.data);toast('Research package exported',{tone:'success'});});
    main.querySelector('[data-dpg-explain]')?.addEventListener('click',()=>{state.selection=state.draft;load();});main.querySelector('[data-dpg-clear]')?.addEventListener('click',()=>{state.draft=null;state.selection=null;load();});
    const svg=main.querySelector('[data-dpg-chart]');if(!svg||!state.data)return;let anchor=null;
    const indexAt=(event)=>{const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const local=point.matrixTransform(svg.getScreenCTM().inverse());return Math.max(0,Math.min(state.data.market.candles.length-1,Math.round((local.x-38)/(690-38)*(state.data.market.candles.length-1))));};
    svg.addEventListener('pointerdown',(event)=>{anchor=indexAt(event);svg.setPointerCapture(event.pointerId);});
    svg.addEventListener('pointerup',(event)=>{
      if(anchor===null)return;
      const end=indexAt(event),a=Math.min(anchor,end),b=Math.max(anchor,end),candles=state.data.market.candles,intervalMs=INTERVAL_MS[state.interval];
      anchor=null;
      state.draft={start:candles[a].time,end:b===a?candles[a].time+intervalMs-1:candles[b].time};
      draw();
    });
  };
  async function load(){state.loading=true;state.error=null;draw();try{const range=state.selection?'&selectionStart='+encodeURIComponent(state.selection.start)+'&selectionEnd='+encodeURIComponent(state.selection.end):'';const rr='&rr='+encodeURIComponent(state.rr)+(state.rr==='custom'?'&customRr='+encodeURIComponent(state.customRr):'');state.data=await api('/api/v1/decision-proven-graph?asset='+encodeURIComponent(state.asset)+'&interval='+encodeURIComponent(state.interval)+'&horizon='+encodeURIComponent(state.horizon)+rr+range);}catch(error){state.data=null;state.error=error?.message||'Fresh market evidence could not be reached. No substitute data was generated.';}finally{state.loading=false;draw();}}
  await load();
}

export const __decisionProvenGraphRouteTest=Object.freeze({CHAT_DECISION_CONTEXT_KEY,DECISION_ASSETS,readChatDecisionContext,normalizeHorizon,validHorizons});
