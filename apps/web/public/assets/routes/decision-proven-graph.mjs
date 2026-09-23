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

const multiTimeframe=(data,escapeHtml)=>{const mtf=data.multiTimeframe,views=mtf?.views||[];if(!views.length)return '<section id="qelly-decision-mtf" class="q-dpg-mtf"><header><div><small>MULTI-TIMEFRAME</small><h2>Cross-horizon confirmation unavailable</h2></div><span>Not inferred</span></header><p>Independent timeframe observations could not be verified, so no agreement claim is shown.</p></section>';return '<section id="qelly-decision-mtf" class="q-dpg-mtf"><header><div><small>MULTI-TIMEFRAME</small><h2>'+escapeHtml(mtf.agreement.direction)+' · '+mtf.agreement.aligned+'/'+mtf.agreement.total+' aligned</h2></div><span>'+escapeHtml(mtf.state)+'</span></header><div>'+views.map(view=>'<article><span>'+escapeHtml(view.interval)+'</span><strong class="q-dpg-mtf__'+view.qellyView.action.toLowerCase().replace(/\s+/g,'-')+'">'+escapeHtml(view.qellyView.action)+'</strong><small>'+escapeHtml(view.marketState.label)+'</small><p>RSI '+view.metrics.rsi14+' · '+Math.round(view.probabilities.bull*100)+'% bull / '+Math.round(view.probabilities.bear*100)+'% bear</p></article>').join('')+'</div><p>Agreement compares independently observed timeframes. Mixed evidence is shown as mixed; it is never forced into a trade call.</p></section>';};

const derivativesContext=(data,escapeHtml)=>{
  const derivatives=data.evidence?.derivatives;
  if(!derivatives||derivatives.state!=='live'){
    return '<section class="q-dpg-derivatives"><header><div><small>DERIVATIVES CONTEXT</small><h2>Funding and open interest unavailable</h2></div><span>Not inferred</span></header><p>'+escapeHtml(derivatives?.message||'Current perpetual-market context could not be verified, so Qelly does not create substitute values.')+'</p><p class="q-dpg-derivatives__limit">Liquidations remain unavailable unless separately sourced.</p></section>';
  }
  const funding=derivatives.fundingPct==null?'Unavailable':Number(derivatives.fundingPct).toFixed(4)+'%';
  const basis=derivatives.markOracleBasisPct==null?'Unavailable':Number(derivatives.markOracleBasisPct).toFixed(4)+'%';
  return '<section class="q-dpg-derivatives"><header><div><small>DERIVATIVES CONTEXT · CURRENT</small><h2>Funding and open interest</h2></div><span>'+escapeHtml(derivatives.provider)+' · '+new Date(derivatives.observedAt).toLocaleString()+'</span></header><div class="q-dpg-derivatives__grid"><article><span>Current funding</span><strong>'+funding+'</strong></article><article><span>Open interest</span><strong>'+compactNumber(derivatives.openInterest)+' '+escapeHtml(data.asset)+'</strong></article><article><span>OI notional</span><strong>'+compactMoney(derivatives.openInterestNotionalUsd)+'</strong></article><article><span>24h perp volume</span><strong>'+compactMoney(derivatives.dayNotionalVolumeUsd)+'</strong></article><article><span>Mark / oracle basis</span><strong>'+basis+'</strong></article></div><p>'+escapeHtml(derivatives.message)+'</p><p class="q-dpg-derivatives__limit">Liquidations: unavailable, not inferred.</p></section>';
};

const marketStructureContext=(data,escapeHtml)=>{
  const structure=data?.quant?.structure;
  if(!structure||structure.state==='UNAVAILABLE')return '<section class="q-dpg-structure"><header><div><small>MARKET STRUCTURE</small><h2>Structure unavailable</h2></div><span>Not inferred</span></header><p>There are not enough verified candles to classify swing structure.</p></section>';
  const price=(value)=>Number.isFinite(Number(value))?money(Number(value)):'Unavailable';
  const swingCount=(side)=>Array.isArray(structure?.swings?.[side])?structure.swings[side].length:0;
  return '<section class="q-dpg-structure"><header><div><small>MARKET STRUCTURE · OBSERVED</small><h2>'+escapeHtml(String(structure.state).replaceAll('_',' '))+'</h2></div><span>'+escapeHtml(String(structure.phase||'UNAVAILABLE').replaceAll('_',' '))+'</span></header>'+
    '<div class="q-dpg-structure__grid"><article><span>Support</span><strong>'+price(structure.support)+'</strong><small>Range low '+price(structure.rangeLow)+'</small></article><article><span>Resistance</span><strong>'+price(structure.resistance)+'</strong><small>Range high '+price(structure.rangeHigh)+'</small></article><article><span>Break of structure</span><strong>'+escapeHtml(String(structure.breakOfStructure||'NONE'))+'</strong><small>Confirmed swing break</small></article><article><span>Change of character</span><strong>'+escapeHtml(String(structure.changeOfCharacter||'NONE'))+'</strong><small>Against prior structural state</small></article><article><span>Failed breakout</span><strong>'+escapeHtml(String(structure.failedBreakout||'NONE').replaceAll('_',' '))+'</strong><small>Close returned inside prior range</small></article><article><span>Compression</span><strong>'+escapeHtml(String(structure.compressionState||'UNAVAILABLE'))+'</strong><small>Ratio '+escapeHtml(String(structure.compressionRatio??'—'))+'</small></article></div>'+
    '<p>'+escapeHtml(String(swingCount('highs')))+' recent confirmed swing highs · '+escapeHtml(String(swingCount('lows')))+' recent confirmed swing lows · structure informs entry, invalidation and target feasibility.</p></section>';
};

const liquidityContext=(data,escapeHtml)=>{
  const liquidity=data?.evidence?.liquidity||data?.liquidity;
  if(!liquidity||liquidity.state!=='live')return '<section class="q-dpg-liquidity"><header><div><small>LIQUIDITY / L2 · CURRENT</small><h2>Order-book context unavailable</h2></div><span>Not inferred</span></header><p>'+escapeHtml(liquidity?.reason||'A verified two-sided L2 snapshot is unavailable, so spread and book imbalance are not inferred.')+'</p><p class="q-dpg-liquidity__limit">Trade imbalance, aggressive flow, volume delta, CVD and historical book depth remain unavailable unless separately sourced.</p></section>';
  const price=(value)=>Number.isFinite(Number(value))?money(Number(value)):'Unavailable';
  const bps=Number.isFinite(Number(liquidity.spreadBps))?Number(liquidity.spreadBps).toFixed(2)+' bps':'Unavailable';
  const imbalance=Number.isFinite(Number(liquidity.top5Imbalance))?(Number(liquidity.top5Imbalance)*100).toFixed(1)+'%':'Unavailable';
  return '<section class="q-dpg-liquidity"><header><div><small>LIQUIDITY / L2 · CURRENT</small><h2>'+escapeHtml(String(liquidity.spreadState||'UNAVAILABLE'))+' spread · '+escapeHtml(String(liquidity.imbalanceState||'UNAVAILABLE').replaceAll('_',' '))+'</h2></div><span>'+escapeHtml(liquidity.provider||'Provider')+(liquidity.observedAt?' · '+escapeHtml(displayTime(liquidity.observedAt)):'')+'</span></header>'+
    '<div class="q-dpg-liquidity__grid"><article><span>Best bid</span><strong>'+price(liquidity.bestBid)+'</strong></article><article><span>Best ask</span><strong>'+price(liquidity.bestAsk)+'</strong></article><article><span>Spread</span><strong>'+escapeHtml(bps)+'</strong></article><article><span>Top-5 bid depth</span><strong>'+compactMoney(liquidity.top5BidDepthUsd)+'</strong></article><article><span>Top-5 ask depth</span><strong>'+compactMoney(liquidity.top5AskDepthUsd)+'</strong></article><article><span>Book imbalance</span><strong>'+escapeHtml(imbalance)+'</strong><small>'+escapeHtml(String(liquidity.imbalanceState||'UNAVAILABLE').replaceAll('_',' '))+'</small></article></div>'+
    '<p>'+escapeHtml(liquidity.method||'Current verified order-book snapshot.')+'</p><p class="q-dpg-liquidity__limit">Point-in-time risk context only. CVD, aggressive trade flow, historical depth and liquidation flow are not inferred.</p></section>';
};

const eventRiskContext=(data,escapeHtml)=>{
  const eventRisk=data?.evidence?.eventRisk||data?.eventRisk;
  const state=String(eventRisk?.state||'unavailable').toUpperCase();
  const level=String(eventRisk?.level||'UNAVAILABLE').toUpperCase();
  return '<section class="q-dpg-event-risk"><header><div><small>EVENT RISK</small><h2>'+escapeHtml(level)+'</h2></div><span>'+escapeHtml(state.replaceAll('_',' '))+'</span></header><p>'+escapeHtml(eventRisk?.reason||'A verified scheduled-event feed is not connected, so QELLY does not manufacture an event-risk score.')+'</p><p class="q-dpg-event-risk__limit">Recent news remains evidence context; it is not automatically treated as a scheduled macro or regulatory event.</p></section>';
};

const actionTone=(action)=>action==='BUY'?'positive':action==='SELL'?'negative':action==='NO TRADE'?'muted':'neutral';
const levels=(view)=>{if(!view.levels)return '<p class="q-dpg-no-levels">No entry, target or invalidation levels are shown because the evidence threshold is not met.</p>';return '<div class="q-dpg-levels"><span>Entry zone<strong>'+money(view.levels.entryZone[0])+' – '+money(view.levels.entryZone[1])+'</strong></span><span>Invalidation<strong>'+money(view.levels.invalidation)+'</strong></span><span>Targets<strong>'+view.levels.targets.map(money).join(' · ')+'</strong></span><span>R:R<strong>'+view.levels.riskReward.map(value=>'1:'+value).join(' · ')+'</strong></span></div>';};

const tradeResearchMarkup=(data,escapeHtml)=>{
  const trade=data.tradeResearch;
  if(!trade)return '';
  const selected=trade.selected;
  const matrix=Array.isArray(trade.matrix)?trade.matrix:[];
  const structuralTargets=Array.isArray(trade.structuralTargets)?trade.structuralTargets:[];
  const targets=Array.isArray(trade.targets)?trade.targets:[];
  const lifecycle=trade.lifecycle||{state:trade.status==='VALID'?'VALID':'NO_TRADE'};
  const lifecycleState=String(lifecycle.state||'NO_TRADE');
  const entryReady=lifecycleState==='VALID';
  const status=trade.status==='VALID'&&entryReady?'live':trade.status==='VALID'?'delayed':'warning';
  const title=trade.status!=='VALID'?'No valid setup':entryReady?'Evidence-qualified setup':'Setup forming — entry not ready';
  const netRr=(item)=>Number.isFinite(Number(item?.netRiskReward))?'Net 1:'+Number(item.netRiskReward).toFixed(2):'Net R:R unavailable';
  const matrixMarkup=matrix.length?matrix.map(item=>
    '<article class="q-dpg-rr-card q-dpg-rr-card--'+escapeHtml(String(item.feasibility||'unavailable').toLowerCase().replace(/\s+/g,'-'))+'">'+
      '<span>'+escapeHtml(item.label)+'</span><strong>'+money(item.target)+'</strong><small>'+escapeHtml(item.feasibility)+'</small>'+
      '<p>'+escapeHtml(item.feasibilityReason)+'</p>'+
      (Number.isFinite(Number(item.structuralBarrier))?'<em>Barrier '+money(item.structuralBarrier)+(Number.isFinite(Number(item.structuralBarrierRr))?' · 1:'+escapeHtml(String(item.structuralBarrierRr)):'')+'</em>':'')+
      '<em>'+escapeHtml(netRr(item))+' · '+escapeHtml(String(item.costState||'UNAVAILABLE'))+'</em>'+
      '<em>Target-touch probability: uncalibrated</em>'+
    '</article>'
  ).join(''):'<p class="q-dpg-no-levels">No R:R matrix is available because the current evidence gate does not support a directional setup.</p>';
  const structuralMarkup=structuralTargets.length?'<div class="q-dpg-structural-targets"><strong>Structural alternative</strong>'+structuralTargets.map(item=>'<span><em>'+escapeHtml(item.label)+'</em><b>'+money(item.target)+'</b><small>'+escapeHtml(item.feasibility)+' · '+escapeHtml(item.feasibilityReason)+'</small></span>').join('')+'</div>':'';
  const invalidation=trade.invalidation||{};
  const invalidationOrder=[['Price',invalidation.price],['Structure',invalidation.structural],['Evidence',invalidation.evidence],['Time',invalidation.time],['Event',invalidation.event],['Regime',invalidation.regime]];
  const invalidationMarkup=trade.entry?'<section class="q-dpg-invalidation"><header><div><small>INVALIDATION LAYERS</small><h3>What cancels or weakens this setup</h3></div><span>Price stop ≠ full thesis invalidation</span></header><div>'+invalidationOrder.map(([label,item])=>'<article><span>'+label+'</span><strong>'+escapeHtml(String(item?.state||'UNAVAILABLE').replaceAll('_',' '))+'</strong>'+(Number.isFinite(Number(item?.price))?'<b>'+money(item.price)+'</b>':'')+(item?.at?'<b>'+escapeHtml(displayTime(item.at))+'</b>':'')+'<p>'+escapeHtml(item?.condition||'No verified condition is available.')+'</p></article>').join('')+'</div></section>':'';
  const targetMarkup=targets.length?'<div class="q-dpg-target-ladder"><strong>Feasible target ladder</strong><div>'+targets.map(item=>'<span><em>T'+escapeHtml(String(item.rank))+' · '+escapeHtml(item.label)+'</em><b>'+money(item.price)+'</b><small>'+escapeHtml(item.source||'MODEL')+' · '+escapeHtml(item.feasibility)+'</small></span>').join('')+'</div></div>':'';
  return '<section class="q-dpg-trade-research"><header><div><small>FIND TRADE NOW · RESEARCH ONLY</small><h2>'+title+'</h2><p>'+escapeHtml(trade.reason)+'</p></div><span class="q-status q-status--'+status+'">'+escapeHtml(lifecycleState)+'</span></header>'+
    (trade.entry?'<div class="q-dpg-trade-summary"><article><span>Entry state</span><strong>'+escapeHtml(trade.entry.method)+'</strong><small>'+money(trade.entry.preferred)+' · '+money(trade.entry.zone[0])+' – '+money(trade.entry.zone[1])+'</small></article><article><span>Price stop</span><strong>'+money(trade.stop.price)+'</strong><small>'+escapeHtml(String(trade.stop.distancePct??'—'))+'% from price · '+escapeHtml(trade.stop.reason||'Risk boundary')+'</small></article><article><span>Selected R:R</span><strong>'+(selected?escapeHtml(selected.label):'None')+'</strong><small>'+(selected?escapeHtml(selected.feasibility)+' · '+escapeHtml(netRr(selected)):'Not supported')+'</small></article><article><span>Setup expiry</span><strong>'+(trade.expiryAt?escapeHtml(displayTime(trade.expiryAt)):'Unavailable')+'</strong><small>'+(Number.isFinite(Number(trade.expiryBars))?escapeHtml(String(trade.expiryBars))+' bars · ':'')+'reassess after expiry or evidence change</small></article></div>':'')+
    (trade.entry?'<div class="q-dpg-entry-logic"><strong>Entry logic · '+escapeHtml(trade.entry.method)+'</strong><p>'+escapeHtml(trade.entry.trigger||'')+'</p><span><b>Confirmation</b>'+escapeHtml(trade.entry.confirmationCondition||'')+'</span><span><b>Invalid entry</b>'+escapeHtml(trade.entry.invalidEntryCondition||'')+'</span></div>':'')+
    '<div class="q-dpg-lifecycle"><strong>Lifecycle</strong><span>'+escapeHtml(lifecycleState)+'</span><p>'+escapeHtml(lifecycle.reason||'')+'</p><small>'+(lifecycle.historyAvailable?'Observed transition history available.':'No triggered/active history is backfilled without persisted prior state.')+'</small></div>'+
    '<div class="q-dpg-rr-grid">'+matrixMarkup+'</div>'+structuralMarkup+targetMarkup+invalidationMarkup+
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

const scannerMarkup=(scan,{scanning=false,error=null,escapeHtml})=>{
  if(scanning)return '<section class="q-dpg-scanner q-dpg-scanner--loading" role="status"><span class="q-spinner"></span><div><small>FIND TRADE NOW · UNIVERSE SCAN</small><h2>Scanning six governed assets</h2><p>Reusing the same Decision evidence, calibration and R:R gates with bounded concurrency.</p></div></section>';
  if(error)return '<section class="q-dpg-scanner q-dpg-scanner--error" role="alert"><header><div><small>FIND TRADE NOW · UNIVERSE SCAN</small><h2>Scan unavailable</h2></div><button class="q-button q-button--secondary" data-dpg-scan>Retry scan</button></header><p>'+escapeHtml(error)+'</p></section>';
  if(!scan)return '';
  const candidates=Array.isArray(scan.candidates)?scan.candidates:[];
  const eligible=Number(scan.eligibleCount)||0;
  const stateLabel=eligible?'Eligible setups found':'No eligible setup';
  const rows=candidates.map((item,index)=>{
    const trade=item.trade||{},evidence=item.evidence||{},market=item.market||{};
    const tone=item.eligible?'positive':item.action==='SELL'?'negative':'muted';
    const score=Number.isFinite(Number(item.researchPriority))?Number(item.researchPriority).toFixed(1):'—';
    const rr=trade.rr||'—';
    const calibration=evidence.calibrationState||'UNCALIBRATED';
    return '<button class="q-dpg-scan-row q-dpg-scan-row--'+tone+'" data-dpg-scan-asset="'+escapeHtml(item.asset)+'" type="button">'+
      '<span class="q-dpg-scan-rank">'+(index+1)+'</span>'+
      '<span class="q-dpg-scan-asset"><strong>'+escapeHtml(item.asset)+'</strong><small>'+escapeHtml(String(market.regime||'UNAVAILABLE'))+' · '+escapeHtml(String(market.volatilityRegime||'UNKNOWN'))+'</small></span>'+
      '<span><em>View</em><strong>'+escapeHtml(item.action)+'</strong></span>'+
      '<span><em>R:R</em><strong>'+escapeHtml(rr)+'</strong><small>'+escapeHtml(String(trade.feasibility||trade.status||'NO_TRADE'))+'</small></span>'+
      '<span><em>Evidence triage</em><strong>'+escapeHtml(score)+'</strong><small>not a win probability</small></span>'+
      '<span><em>Calibration</em><strong>'+escapeHtml(calibration)+'</strong></span>'+
      '<span class="q-dpg-scan-open">'+(item.eligible?'Open setup':'Inspect')+' →</span>'+
    '</button>';
  }).join('');
  return '<section class="q-dpg-scanner"><header><div><small>FIND TRADE NOW · SIX-ASSET SCAN</small><h2>'+stateLabel+'</h2><p>'+escapeHtml(String(scan.availableCount||0))+' verified · '+escapeHtml(String(scan.unavailableCount||0))+' unavailable · '+escapeHtml(String(scan.interval||''))+' / '+escapeHtml(String(scan.horizon||''))+'</p></div><button class="q-button q-button--secondary" data-dpg-scan>Rescan</button></header>'+
    '<div class="q-dpg-scan-boundary"><strong>Research boundary</strong><span>'+escapeHtml(scan.eventRisk?.reason||'Event risk is unavailable unless verified by a connected source.')+'</span></div>'+
    '<div class="q-dpg-scan-list">'+(rows||'<p class="q-dpg-no-levels">No verified candidates were returned.</p>')+'</div>'+
    '<p class="q-dpg-scan-note">Evidence triage ranks current research quality only. It is not a success probability, expected return, trade recommendation or execution priority.</p>'+
  '</section>';
};

const probabilityCalibrationMarkup=(data,escapeHtml)=>{
  const calibration=data?.confidence?.probabilityCalibration||data?.quant?.calibration;
  if(!calibration)return '';
  const pctValue=(value)=>Number.isFinite(Number(value))?(Number(value)*100).toFixed(1)+'%':'Unavailable';
  const brier=Number.isFinite(Number(calibration.brierScore))?Number(calibration.brierScore).toFixed(4):'Unavailable';
  const skill=Number.isFinite(Number(calibration.skillScore))?pctValue(calibration.skillScore):'Unavailable';
  const gap=Number.isFinite(Number(calibration.reliabilityGap))?pctValue(calibration.reliabilityGap):'Unavailable';
  const bins=Array.isArray(calibration.reliabilityBins)?calibration.reliabilityBins:[];
  return '<section class="q-dpg-model-calibration"><header><div><small>MODEL CALIBRATION · WALK-FORWARD</small><h2>'+escapeHtml(String(calibration.state||'UNCALIBRATED').replaceAll('_',' '))+'</h2><p>'+escapeHtml(calibration.reason||'Calibration evidence is unavailable.')+'</p></div><span>'+(calibration.eligible?'ELIGIBLE':'NOT ELIGIBLE')+'</span></header>'+
    '<div class="q-dpg-model-calibration__metrics"><article><span>Resolved samples</span><strong>'+escapeHtml(String(calibration.sampleSize??0))+'</strong></article><article><span>Brier score</span><strong>'+escapeHtml(brier)+'</strong><small>lower is better</small></article><article><span>Skill vs uniform</span><strong>'+escapeHtml(skill)+'</strong></article><article><span>Reliability gap</span><strong>'+escapeHtml(gap)+'</strong><small>lower is better</small></article></div>'+
    (bins.length?'<details><summary>Reliability bins</summary><div class="q-dpg-reliability-bins">'+bins.map(bin=>'<span><em>'+Math.round(Number(bin.low)*100)+'–'+Math.round(Number(bin.high)*100)+'%</em><strong>'+Math.round(Number(bin.meanConfidence)*100)+'% conf / '+Math.round(Number(bin.hitRate)*100)+'% hit</strong><small>n='+escapeHtml(String(bin.sampleSize))+'</small></span>').join('')+'</div></details>':'')+
    '<p class="q-dpg-calibration-method">'+escapeHtml(calibration.method||'')+(calibration.leakageGuard?' · '+escapeHtml(calibration.leakageGuard):'')+'</p>'+
  '</section>';
};

const historicalAnalogsMarkup=(data,escapeHtml)=>{
  const context=data?.historicalAnalogs;
  if(!context)return '';
  const analogs=Array.isArray(context.analogs)?context.analogs:[];
  if(!analogs.length)return '<section class="q-dpg-analogs"><header><div><small>HISTORICAL ANALOGS</small><h2>Comparable history unavailable</h2></div><span>Context only</span></header><p>'+escapeHtml(context.reason||'Not enough resolved prior windows for a bounded comparison.')+'</p></section>';
  const summary=context.summary||{};
  const cards=analogs.map(item=>'<article><header><span>#'+escapeHtml(String(item.rank))+'</span><strong>'+escapeHtml(displayTime(item.observedAt))+'</strong><em>'+Math.round(Number(item.similarity)*100)+'% similar</em></header><div><span><small>Regime</small><strong>'+escapeHtml(String(item.regime||'UNAVAILABLE'))+'</strong></span><span><small>Volatility</small><strong>'+escapeHtml(String(item.volatilityRegime||'UNKNOWN'))+'</strong></span><span><small>Forward return</small><strong>'+escapeHtml(String(item.forwardReturnPct))+'%</strong></span><span><small>Favorable / adverse</small><strong>'+escapeHtml(String(item.maxFavorablePct))+'% / '+escapeHtml(String(item.maxAdversePct))+'%</strong></span></div></article>').join('');
  return '<section class="q-dpg-analogs"><header><div><small>HISTORICAL ANALOGS · DESCRIPTIVE ONLY</small><h2>Nearest prior market states</h2><p>'+escapeHtml(context.method||'')+'</p></div><span>NO ELIGIBILITY IMPACT</span></header>'+
    '<div class="q-dpg-analog-summary"><span><em>Matches</em><strong>'+escapeHtml(String(summary.count??analogs.length))+'</strong></span><span><em>Median forward return</em><strong>'+escapeHtml(String(summary.medianForwardReturnPct??'—'))+'%</strong></span><span><em>Positive / negative</em><strong>'+Math.round(Number(summary.positiveShare||0)*100)+'% / '+Math.round(Number(summary.negativeShare||0)*100)+'%</strong></span><span><em>Median similarity</em><strong>'+Math.round(Number(summary.medianSimilarity||0)*100)+'%</strong></span></div>'+
    '<div class="q-dpg-analog-list">'+cards+'</div>'+
    '<div class="q-dpg-analog-boundary"><strong>Leakage guard</strong><p>'+escapeHtml(context.leakageGuard||'')+'</p><p>'+escapeHtml(context.outcomeBoundary||'')+'</p></div>'+
  '</section>';
};



export async function renderDecisionProvenGraph(main,deps){
  installStyles();const {api,stateBanner,escapeHtml,toast}=deps;
  const chatContext=readChatDecisionContext();
  let state={asset:chatContext.asset,interval:chatContext.interval,horizon:normalizeHorizon(chatContext.interval,'4h'),rr:'auto',customRr:'2.5',loading:true,data:null,error:null,draft:null,selection:null,scanning:false,scan:null,scanError:null};
  const select=(name,values)=>'<label><span>'+name[0].toUpperCase()+name.slice(1)+'</span><select data-dpg-'+name+'>'+values.map(value=>'<option value="'+value+'" '+(state[name]===value?'selected':'')+'>'+value+'</option>').join('')+'</select></label>';
  const hero=(data)=>{
    const view=data?.qellyView||{},gate=view.evidenceGate||{},scenario=view.scenario||{};
    const candles=data?.market?.candles||[],last=candles.at?.(-1),previous=candles.at?.(-2);
    const price=data?money(data.market.lastPrice):'Connecting…';
    const change=last&&previous&&previous.close?((last.close/previous.close-1)*100):null;
    const freshness=data?.truthState||'CONNECTING';
    const marketState=data?.market?.currentState?.label||'Loading market state';
    const quality=Number.isFinite(Number(gate.qualityScore))?Math.round(Number(gate.qualityScore)*100)+'%':'Unavailable';
    const confidence=Number.isFinite(Number(view.confidence))?Math.round(Number(view.confidence)*100)+'%':'Unavailable';
    const agreement=Number.isFinite(Number(gate.timeframeAgreement))?Math.round(Number(gate.timeframeAgreement)*100)+'%':'Unavailable';
    const probabilities=[['Bull',scenario.bull],['Base',scenario.base],['Bear',scenario.bear]].filter(([,value])=>Number.isFinite(Number(value))).sort((a,b)=>Number(b[1])-Number(a[1]));
    const scenarioLead=probabilities.length?probabilities[0][0]+' '+Math.round(Number(probabilities[0][1])*100)+'%':'Unavailable';
    const regime=data?.market?.currentState?.trend||'Unavailable';
    const volatility=view.riskState?.label||'Unavailable';
    const provider=data?.provenance?.provider||'Hyperliquid';
    const action=view.action||'WAIT';
    const label=view.label||'Loading fresh evidence before a research view is shown.';
    return '<section class="q-dpg-hero q-dpg-hero--'+actionTone(action)+'" aria-label="QELLY Decision Intelligence">'+
      '<div class="q-dpg-hero__identity"><div><small>FLAGSHIP RESEARCH WORKSPACE</small><h1>QELLY Decision Intelligence</h1></div>'+
        '<div class="q-dpg-hero__selects">'+select('asset',['BTC','ETH','SOL','HYPE','XRP','DOGE'])+select('interval',['1m','5m','15m','30m','1h','4h','1d'])+'</div>'+
        '<div class="q-dpg-hero__market"><strong>'+price+'</strong><span>'+(change===null?'Change unavailable':(change>=0?'+':'')+change.toFixed(2)+'%')+'</span><small>Crypto · '+escapeHtml(provider)+'</small><small>'+escapeHtml(freshness)+' · '+escapeHtml(marketState)+'</small></div></div>'+
      '<div class="q-dpg-hero__view"><small>QELLY VIEW</small><h2>'+escapeHtml(action)+'</h2><p>'+escapeHtml(label)+'</p><div class="q-dpg-hero__metrics">'+
        '<span><em>Evidence quality</em><strong>'+escapeHtml(quality)+'</strong></span>'+
        '<span><em>Model confidence</em><strong>'+escapeHtml(confidence)+'</strong></span>'+
        '<span><em>Scenario</em><strong>'+escapeHtml(scenarioLead)+'</strong></span>'+
        '<span><em>MTF agreement</em><strong>'+escapeHtml(agreement)+'</strong></span>'+
        '<span><em>Regime</em><strong>'+escapeHtml(String(regime))+'</strong></span>'+
        '<span><em>Volatility</em><strong>'+escapeHtml(volatility)+'</strong></span>'+
      '</div></div>'+
      '<div class="q-dpg-hero__actions"><button class="q-button q-button--primary" data-dpg-scan '+(state.scanning?'disabled':'')+'>'+(state.scanning?'Scanning…':'Find Trade Now')+'</button><button class="q-button q-button--secondary" data-dpg-explain-header '+(state.draft?'':'disabled')+'>Explain This Move</button><button class="q-button q-button--secondary" data-dpg-mtf-jump>Compare Timeframes</button><a class="q-button q-button--secondary" href="#/qelly-chat">Open QELLY Chat</a><button class="q-button q-button--secondary" data-dpg-methodology-jump>Methodology / Sources</button></div>'+
    '</section>';
  };
  const evidence=(data)=>{
    const move=data.selection,quant=move?.evidence||[],articles=data.evidence?.news?.articles||[];
    const items=[...quant.map(item=>({kind:item.type,title:item.title,detail:item.detail,meta:item.direction,score:item.strength})),...articles.slice(0,5).map(article=>({kind:'news',title:article.title,detail:article.source||'News report',meta:article.publishedAt,url:article.url,score:.45}))].sort((a,b)=>b.score-a.score);
    if(!items.length)return '<div class="q-dpg-empty">Select a candle range and choose <strong>Explain this move</strong> to rank the available price, volume, volatility and news evidence.</div>';
    return '<ol class="q-dpg-ranked">'+items.map((item,index)=>'<li><span>'+(index+1)+'</span><div><small>'+escapeHtml(item.kind)+'</small><strong>'+(item.url?'<a href="'+escapeHtml(item.url)+'" target="_blank" rel="noopener">'+escapeHtml(item.title)+'</a>':escapeHtml(item.title))+'</strong><p>'+escapeHtml(item.detail)+'</p><em>'+escapeHtml(item.meta||'context')+'</em></div></li>').join('')+'</ol>';
  };
  const content=(data)=>{
    const view=data.qellyView,move=data.selection;
    return '<section class="q-dpg-truth"><span class="q-status q-status--'+(data.truthState==='LIVE'?'live':data.truthState.toLowerCase())+'">'+escapeHtml(data.truthState)+'</span><strong>'+escapeHtml(data.asset)+' / '+escapeHtml(data.interval)+'</strong><span>'+escapeHtml(data.market.currentState.label)+' · updated '+new Date(data.observedAt).toLocaleString()+'</span></section>'+
      tradeResearchMarkup(data,escapeHtml)+
      probabilityCalibrationMarkup(data,escapeHtml)+
      historicalAnalogsMarkup(data,escapeHtml)+
      '<section class="q-dpg-view q-dpg-view--'+actionTone(view.action)+'"><div><small>QELLY VIEW</small><h2>'+escapeHtml(view.action)+'</h2><p>'+escapeHtml(view.label)+'</p></div><div class="q-dpg-confidence"><span>Evidence confidence</span><strong>'+Math.round(view.confidence*100)+'%</strong></div>'+calibration(view,escapeHtml)+levels(view)+'<details><summary>Why this view?</summary><ul>'+view.why.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul><p><strong>What changes it:</strong> '+escapeHtml(view.changesIf)+'</p></details></section>'+
      '<section class="q-dpg-stage"><div class="q-dpg-chart-wrap"><div class="q-dpg-chart-help">Click one candle or drag across observed candles to select a move.</div>'+chart(data,escapeHtml)+'<div class="q-dpg-selection-actions"><span data-dpg-selection-label>'+(state.draft?(state.draft.end-state.draft.start<(INTERVAL_MS[state.interval]||0)?'Single candle selected':'Range selected'):'No range selected')+'</span><button class="q-button q-button--primary" data-dpg-explain '+(state.draft?'':'disabled')+'>'+(state.draft&&state.draft.end-state.draft.start<(INTERVAL_MS[state.interval]||0)?'Explain this candle':'Explain this move')+'</button><button class="q-button q-button--secondary" data-dpg-clear '+(state.draft||state.selection?'':'disabled')+'>Clear</button></div></div><aside class="q-dpg-scenarios">'+[['Bull',data.forecast.probabilities.bull],['Base',data.forecast.probabilities.base],['Bear',data.forecast.probabilities.bear]].map(([label,value])=>'<article><span>'+label+'</span><strong>'+Math.round(value*100)+'%</strong><meter min="0" max="1" value="'+value+'"></meter></article>').join('')+'<p>Modelled terminal range<br><strong>'+money(data.forecast.terminal.p05)+' – '+money(data.forecast.terminal.p95)+'</strong></p></aside></section>'+
      (move?'<section class="q-dpg-move"><header><div><small>SELECTED MOVE</small><h2>'+pct(move.changePct)+' across '+move.candles+' candles</h2></div><span>'+new Date(move.start).toLocaleString()+' → '+new Date(move.end).toLocaleString()+'</span></header><div><article><span>Range</span><strong>'+pct(move.rangePct)+'</strong></article><article><span>Volume vs prior</span><strong>'+(move.volumeRatio?move.volumeRatio+'×':'N/A')+'</strong></article><article><span>Volatility</span><strong>'+pct(move.volatilityPct)+'</strong></article><article><span>Prior volatility</span><strong>'+(move.priorVolatilityPct===null?'N/A':pct(move.priorVolatilityPct))+'</strong></article></div></section>':'')+
      '<section class="q-dpg-timeframe"><article><small>PAST</small><h3>What moved</h3><p>'+(move?escapeHtml(move.evidence[0]?.title||'Selected range analyzed.'):'Select the precise candles you want to investigate.')+'</p></article><article><small>PRESENT</small><h3>'+escapeHtml(data.market.currentState.label)+'</h3><p>RSI '+data.metrics.rsi14+' · ATR '+pct(data.metrics.atrPct)+' · return z-score '+data.metrics.returnZScore+'.</p></article><article><small>FUTURE</small><h3>Probability, not prediction</h3><p>'+Math.round(data.forecast.probabilities.bull*100)+'% bull · '+Math.round(data.forecast.probabilities.base*100)+'% base · '+Math.round(data.forecast.probabilities.bear*100)+'% bear over '+escapeHtml(data.horizon)+'.</p></article></section>'+
      marketStructureContext(data,escapeHtml)+multiTimeframe(data,escapeHtml)+liquidityContext(data,escapeHtml)+derivativesContext(data,escapeHtml)+eventRiskContext(data,escapeHtml)+adSlot('decision-intelligence-inline')+'<section class="q-dpg-evidence"><header><div><small>EVIDENCE RANKING</small><h2>What best explains the move</h2></div><span>News: '+escapeHtml(data.evidence?.news?.state||'unavailable')+' · L2: '+escapeHtml(data.evidence?.liquidity?.state||'unavailable')+' · Funding/OI: '+escapeHtml(data.evidence?.derivatives?.state||'unavailable')+' · Event calendar: '+escapeHtml(data.evidence?.eventRisk?.state||'unavailable')+' · Liquidations: unavailable, not inferred</span></header>'+evidence(data)+'</section>'+
      '<details id="qelly-decision-methodology" class="q-dpg-audit"><summary>Methodology and sources</summary><div><section><h3>Market data</h3><p>'+escapeHtml(data.provenance.provider)+' public candles. <a href="'+escapeHtml(data.provenance.documentation)+'" target="_blank" rel="noopener">Source documentation ↗</a></p></section><section><h3>Method</h3><p>'+data.provenance.model.features.map(escapeHtml).join(' · ')+'</p><p>'+escapeHtml(data.confidence.calibration)+'</p></section><section><h3>Limits</h3><ul>'+data.provenance.model.limitations.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul></section></div></details>';
  };
  const draw=()=>{
    const data=state.data;
    main.innerHTML='<section class="q-page q-dpg-page">'+stateBanner()+hero(data)+'<section class="q-dpg-controls q-dpg-controls--decision" aria-label="Decision controls">'+select('horizon',validHorizons(state.interval))+'<label><span>Risk / reward</span><select data-dpg-rr><option value="auto" '+(state.rr==='auto'?'selected':'')+'>Auto</option><option value="1" '+(state.rr==='1'?'selected':'')+'>1:1</option><option value="2" '+(state.rr==='2'?'selected':'')+'>1:2</option><option value="3" '+(state.rr==='3'?'selected':'')+'>1:3</option><option value="4" '+(state.rr==='4'?'selected':'')+'>1:4</option><option value="custom" '+(state.rr==='custom'?'selected':'')+'>Custom</option></select></label>'+(state.rr==='custom'?'<label><span>Custom R:R</span><input data-dpg-custom-rr type="number" min="0.5" max="10" step="0.1" value="'+escapeHtml(state.customRr)+'"></label>':'')+'<p>Public research · no sign-in required · no trade execution</p></section>'+scannerMarkup(state.scan,{scanning:state.scanning,error:state.scanError,escapeHtml})+(state.loading?'<section class="q-dpg-state" role="status"><span class="q-spinner"></span><h2>Weighing fresh evidence</h2><p>Loading market observations and scenario ranges.</p></section>':'')+(state.error?'<section class="q-dpg-state q-dpg-state--error" role="alert"><h2>Live research unavailable</h2><p>'+escapeHtml(state.error)+'</p><button class="q-button q-button--secondary" data-dpg-refresh>Try again</button></section>':'')+(data?content(data):'')+'</section>';
    wire();mountAdSlots(main);
  };
  const wire=()=>{
    main.querySelectorAll('[data-dpg-asset],[data-dpg-interval],[data-dpg-horizon]').forEach(element=>element.addEventListener('change',()=>{
      const key=element.hasAttribute('data-dpg-asset')?'asset':element.hasAttribute('data-dpg-interval')?'interval':'horizon';
      state[key]=element.value;
      if(key==='interval')state.horizon=normalizeHorizon(state.interval,state.horizon);
      if(key!=='asset'){state.scan=null;state.scanError=null;}
      state.draft=null;state.selection=null;load();
    }));
    main.querySelector('[data-dpg-rr]')?.addEventListener('change',(event)=>{state.rr=event.currentTarget.value;state.scan=null;state.scanError=null;load();});
    main.querySelector('[data-dpg-custom-rr]')?.addEventListener('change',(event)=>{state.customRr=event.currentTarget.value;state.scan=null;state.scanError=null;load();});
    main.querySelectorAll('[data-dpg-scan]').forEach(button=>button.addEventListener('click',scan));
    main.querySelectorAll('[data-dpg-scan-asset]').forEach(button=>button.addEventListener('click',()=>{state.asset=button.dataset.dpgScanAsset;state.draft=null;state.selection=null;load();}));
    main.querySelector('[data-dpg-explain-header]')?.addEventListener('click',()=>{if(state.draft){state.selection=state.draft;load();}});
    main.querySelector('[data-dpg-mtf-jump]')?.addEventListener('click',()=>main.querySelector('#qelly-decision-mtf')?.scrollIntoView({behavior:'smooth',block:'start'}));
    main.querySelector('[data-dpg-methodology-jump]')?.addEventListener('click',()=>main.querySelector('#qelly-decision-methodology')?.scrollIntoView({behavior:'smooth',block:'start'}));
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
  async function scan(){
    if(state.scanning)return;
    state.scanning=true;state.scanError=null;draw();
    try{
      const rr='&rr='+encodeURIComponent(state.rr)+(state.rr==='custom'?'&customRr='+encodeURIComponent(state.customRr):'');
      state.scan=await api('/api/v1/decision-scan?interval='+encodeURIComponent(state.interval)+'&horizon='+encodeURIComponent(state.horizon)+rr);
      const firstEligible=state.scan?.candidates?.find?.(item=>item?.eligible);
      if(firstEligible&&firstEligible.asset&&firstEligible.asset!==state.asset){
        state.asset=firstEligible.asset;state.draft=null;state.selection=null;
      }
    }catch(error){
      state.scan=null;state.scanError=error?.message||'The governed asset scan could not be completed. No substitute candidates were generated.';
    }finally{
      state.scanning=false;
      if(state.scan?.candidates?.some?.(item=>item?.eligible))await load();
      else draw();
    }
  }
  async function load(){state.loading=true;state.error=null;draw();try{const range=state.selection?'&selectionStart='+encodeURIComponent(state.selection.start)+'&selectionEnd='+encodeURIComponent(state.selection.end):'';const rr='&rr='+encodeURIComponent(state.rr)+(state.rr==='custom'?'&customRr='+encodeURIComponent(state.customRr):'');state.data=await api('/api/v1/decision-proven-graph?asset='+encodeURIComponent(state.asset)+'&interval='+encodeURIComponent(state.interval)+'&horizon='+encodeURIComponent(state.horizon)+rr+range);}catch(error){state.data=null;state.error=error?.message||'Fresh market evidence could not be reached. No substitute data was generated.';}finally{state.loading=false;draw();}}
  await load();
}

export const __decisionProvenGraphRouteTest=Object.freeze({CHAT_DECISION_CONTEXT_KEY,DECISION_ASSETS,readChatDecisionContext,normalizeHorizon,validHorizons});
