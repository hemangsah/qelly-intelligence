import {adSlot,mountAdSlots} from '../qelly-ad-slot.mjs';
import {DECISION_CONTEXT_KEY as CHAT_DECISION_CONTEXT_KEY,DECISION_ASSETS,consumeDecisionContext as readChatDecisionContext} from '../decision-context-bridge.mjs';
const STYLESHEET=new URL('../qelly-decision-proven-graph.css',import.meta.url).href;
const installStyles=()=>{if(!document.querySelector('link[data-decision-proven-graph]')){const link=document.createElement('link');link.rel='stylesheet';link.href=STYLESHEET;link.dataset.decisionProvenGraph='v2';document.head.append(link);}};
const money=(value)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:Number(value)>=100?0:2}).format(value);
const pct=(value)=>Number(value).toFixed(2)+'%';
const compactMoney=(value)=>value!=null&&value!==''&&Number.isFinite(Number(value))?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(Number(value)):'Unavailable';
const compactNumber=(value)=>value!=null&&value!==''&&Number.isFinite(Number(value))?new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:3}).format(Number(value)):'Unavailable';
const download=(value)=>{const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='qelly-decision-intelligence-'+value.asset.toLowerCase()+'-'+value.interval+'.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),500);};
const INTERVAL_MS=Object.freeze({'1m':60_000,'5m':300_000,'15m':900_000,'30m':1_800_000,'1h':3_600_000,'4h':14_400_000,'1d':86_400_000});
const HORIZON_MS=Object.freeze({'1h':3_600_000,'4h':14_400_000,'12h':43_200_000,'1d':86_400_000,'3d':259_200_000,'7d':604_800_000});
const validHorizons=(interval)=>Object.keys(HORIZON_MS).filter(horizon=>{const bars=Math.ceil(HORIZON_MS[horizon]/INTERVAL_MS[interval]);return bars>=2&&bars<=168;});
const normalizeHorizon=(interval,horizon)=>validHorizons(interval).includes(horizon)?horizon:validHorizons(interval)[0];
const telemetryToken=(value,fallback='unknown')=>String(value??fallback).trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,64)||fallback;
const rrTelemetryState=(value)=>value==='auto'?'auto':value==='custom'?'custom':({'1':'rr_1_1','2':'rr_1_2','3':'rr_1_3','4':'rr_1_4'}[String(value)]||'unknown');
const canonicalDecisionAsset=(value)=>{const symbol=String(value||'').trim().toUpperCase();return DECISION_ASSETS.has(symbol)?'QI-CRYPTO-'+symbol:null;};
const emitProductEvent=(name,properties)=>document.dispatchEvent(new CustomEvent('qelly:product-event',{detail:{name,properties}}));
const emitRuntimeSignal=(detail)=>document.dispatchEvent(new CustomEvent('qelly:runtime-signal',{detail}));
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
    return '<section class="q-dpg-derivatives"><header><div><small>DERIVATIVES CONTEXT</small><h2>Funding and open interest unavailable</h2></div><span>Not inferred</span></header><p>'+escapeHtml(derivatives?.message||'Current perpetual-market context could not be verified, so Qelly does not create substitute values.')+'</p><p class="q-dpg-derivatives__limit">Funding history, OI change, basis change, price/OI quadrant and liquidations remain unavailable unless separately verified.</p></section>';
  }
  const pct=(value,digits=4)=>value!=null&&value!==''&&Number.isFinite(Number(value))?Number(value).toFixed(digits)+'%':'Unavailable';
  const bps=(value,digits=3)=>value!=null&&value!==''&&Number.isFinite(Number(value))?(Number(value)>=0?'+':'')+Number(value).toFixed(digits)+' bps':'Unavailable';
  const percentile=(value)=>value!=null&&value!==''&&Number.isFinite(Number(value))?Math.round(Number(value)*100)+'%':'Unavailable';
  const ratio=(value)=>value!=null&&value!==''&&Number.isFinite(Number(value))?Number(value).toFixed(2)+'x':'Unavailable';
  const price=(value)=>value!=null&&value!==''&&Number.isFinite(Number(value))?money(Number(value)):'Unavailable';
  const history=derivatives.fundingHistory||{};
  return '<section class="q-dpg-derivatives"><header><div><small>DERIVATIVES CONTEXT · CURRENT + SETTLED HISTORY</small><h2>Funding, premium, basis and open interest</h2></div><span>'+escapeHtml(derivatives.provider)+' · '+new Date(derivatives.observedAt).toLocaleString()+'</span></header>'+
    '<div class="q-dpg-derivatives__grid">'+
      '<article><span>Current funding</span><strong>'+pct(derivatives.fundingPct)+'</strong><small>'+escapeHtml(String(derivatives.fundingState||'UNAVAILABLE').replaceAll('_',' '))+'</small></article>'+
      '<article><span>Funding change</span><strong>'+escapeHtml(bps(derivatives.fundingChangeBps))+'</strong><small>'+escapeHtml(String(derivatives.fundingShiftState||'UNAVAILABLE'))+' vs latest settled</small></article>'+
      '<article><span>Funding percentile</span><strong>'+escapeHtml(percentile(derivatives.fundingPercentile))+'</strong><small>n='+escapeHtml(String(history.sampleSize??0))+' settled samples</small></article>'+
      '<article><span>Current premium</span><strong>'+pct(derivatives.premiumPct)+'</strong><small>'+escapeHtml(String(derivatives.premiumState||'UNAVAILABLE').replaceAll('_',' '))+'</small></article>'+
      '<article><span>Premium change</span><strong>'+escapeHtml(bps(derivatives.premiumChangeBps))+'</strong><small>'+escapeHtml(String(derivatives.premiumShiftState||'UNAVAILABLE'))+' vs latest settled</small></article>'+
      '<article><span>Premium percentile</span><strong>'+escapeHtml(percentile(derivatives.premiumPercentile))+'</strong><small>n='+escapeHtml(String(history.premiumSampleSize??0))+' settled samples</small></article>'+
      '<article><span>Open interest</span><strong>'+compactNumber(derivatives.openInterest)+' '+escapeHtml(data.asset)+'</strong></article>'+
      '<article><span>OI notional</span><strong>'+compactMoney(derivatives.openInterestNotionalUsd)+'</strong></article>'+
      '<article><span>OI change</span><strong>'+escapeHtml(String(derivatives.openInterestChangeState||'UNAVAILABLE'))+'</strong><small>Historical OI not connected</small></article>'+
      '<article><span>24h perp volume</span><strong>'+compactMoney(derivatives.dayNotionalVolumeUsd)+'</strong></article>'+
      '<article><span>OI turnover</span><strong>'+escapeHtml(ratio(derivatives.openInterestTurnover24h))+'</strong><small>24h notional volume / OI notional</small></article>'+
      '<article><span>Mark price</span><strong>'+price(derivatives.markPrice)+'</strong></article>'+
      '<article><span>Oracle price</span><strong>'+price(derivatives.oraclePrice)+'</strong></article>'+
      '<article><span>Mark / oracle basis</span><strong>'+pct(derivatives.markOracleBasisPct)+'</strong><small>'+escapeHtml(String(derivatives.markOracleBasisState||'UNAVAILABLE').replaceAll('_',' '))+'</small></article>'+
      '<article><span>Basis change</span><strong>'+escapeHtml(String(derivatives.markOracleBasisChangeState||'UNAVAILABLE'))+'</strong><small>Historical mark/oracle series not connected</small></article>'+
      '<article><span>Price / OI quadrant</span><strong>'+escapeHtml(String(derivatives.priceOpenInterestQuadrant||'UNAVAILABLE').replaceAll('_',' '))+'</strong><small>Requires verified OI change history</small></article>'+
      '<article><span>Liquidations</span><strong>'+escapeHtml(String(derivatives.liquidationsState||'UNAVAILABLE'))+'</strong><small>Verified liquidation flow not connected</small></article>'+
    '</div>'+
    '<p>'+escapeHtml(derivatives.message)+'</p>'+
    '<p class="q-dpg-derivatives__limit">'+escapeHtml(history.method||'Funding history unavailable.')+' Historical OI change, mark/oracle basis change and liquidation flow are not inferred. Premium history is not substituted for mark/oracle basis history.</p></section>';
};

const crossAssetContext=(data,escapeHtml)=>{
  const context=data?.evidence?.crossAsset||data?.crossAsset;
  if(!context||context.state!=='available')return '<section class="q-dpg-cross-asset"><header><div><small>CROSS-ASSET</small><h2>Dependence unavailable</h2></div><span>Not inferred</span></header><p>'+escapeHtml(context?.reason||'A same-venue benchmark series is unavailable, so correlation and beta are not inferred.')+'</p></section>';
  const percent=(value)=>value!=null&&value!==''&&Number.isFinite(Number(value))?(Number(value)>=0?'+':'')+Number(value).toFixed(2)+'%':'Unavailable';
  const number=(value,digits=3)=>value!=null&&value!==''&&Number.isFinite(Number(value))?Number(value).toFixed(digits):'Unavailable';
  const lead=context.leadLag||{},spread=context.spread||{},cointegration=context.cointegration||{};
  const lagLabel=lead.relation==='CONTEMPORANEOUS'?'Same bar':lead.relation==='BENCHMARK_LEADS'?context.benchmark+' leads '+Math.abs(Number(lead.bestLagBars||0))+' bars':lead.relation==='ASSET_LEADS'?context.asset+' leads '+Math.abs(Number(lead.bestLagBars||0))+' bars':'Unavailable';
  return '<section class="q-dpg-cross-asset"><header><div><small>CROSS-ASSET · DESCRIPTIVE ONLY</small><h2>'+escapeHtml(context.asset)+' vs '+escapeHtml(context.benchmark)+'</h2></div><span>NO ELIGIBILITY IMPACT</span></header><div class="q-dpg-cross-asset__grid">'+
    '<article><span>Correlation</span><strong>'+number(context.correlation)+'</strong><small>'+escapeHtml(String(context.correlationState||'UNAVAILABLE').replaceAll('_',' '))+'</small></article>'+
    '<article><span>Rolling corr · 30</span><strong>'+number(context.rollingCorrelation30)+'</strong><small>aligned return observations</small></article>'+
    '<article><span>Rolling corr · 90</span><strong>'+number(context.rollingCorrelation90)+'</strong><small>aligned return observations</small></article>'+
    '<article><span>Beta</span><strong>'+number(context.beta)+'</strong><small>30 '+number(context.rollingBeta30)+' · 90 '+number(context.rollingBeta90)+'</small></article>'+
    '<article><span>'+escapeHtml(context.asset)+' window return</span><strong>'+escapeHtml(percent(context.assetReturnPct))+'</strong></article>'+
    '<article><span>'+escapeHtml(context.benchmark)+' window return</span><strong>'+escapeHtml(percent(context.benchmarkReturnPct))+'</strong></article>'+
    '<article><span>Relative strength</span><strong>'+escapeHtml(percent(context.relativeStrengthPct))+'</strong><small>'+escapeHtml(String(context.relativeState||'UNAVAILABLE'))+' · '+escapeHtml(String(context.divergenceState||'UNAVAILABLE').replaceAll('_',' '))+'</small></article>'+
    '<article><span>Spread z-score</span><strong>'+number(spread.zScore)+'</strong><small>'+escapeHtml(String(spread.state||'UNAVAILABLE'))+' · beta-adjusted log spread</small></article>'+
    '<article><span>Lead / lag exploration</span><strong>'+escapeHtml(lagLabel)+'</strong><small>corr '+number(lead.correlation)+' · exploratory only</small></article>'+
    '<article><span>Cointegration</span><strong>'+escapeHtml(String(cointegration.state||'NOT_TESTED').replaceAll('_',' '))+'</strong><small>not claimed without dedicated validation</small></article>'+
    '<article><span>Aligned samples</span><strong>'+escapeHtml(String(context.sampleSize??0))+'</strong></article>'+
    '<article><span>Provider</span><strong>'+escapeHtml(context.provider||'Hyperliquid candles')+'</strong><small>same venue · same interval</small></article>'+
  '</div><p>'+escapeHtml(context.method||'')+'</p><p class="q-dpg-cross-asset__limit">Correlation, beta, relative strength, spread z-score and exploratory lag are window-dependent descriptive context. Correlation is not causation; cointegration is not claimed. This panel does not independently create BUY, SELL or NO TRADE eligibility.</p></section>';
};

const macroContext=(data,escapeHtml)=>{
  const macro=data?.evidence?.macro||data?.macro;
  const state=String(macro?.state||'unavailable').toUpperCase();
  if(!macro||macro.state!=='available')return '<section class="q-dpg-macro"><header><div><small>MACRO CONTEXT</small><h2>'+escapeHtml(String(macro?.level||'UNAVAILABLE'))+'</h2></div><span>'+escapeHtml(state.replaceAll('_',' '))+'</span></header><p>'+escapeHtml(macro?.reason||'A governed macro reference is unavailable, so QELLY does not infer DXY, yields or policy-rate effects.')+'</p><p class="q-dpg-macro__limit">'+escapeHtml(macro?.cadenceBoundary||'Slow reference data is not substituted for current market evidence.')+'</p></section>';
  const fx=(value)=>value!=null&&value!==''&&Number.isFinite(Number(value))?Number(value).toFixed(4):'Unavailable';
  const unavailable=Array.isArray(macro.unavailableSeries)?macro.unavailableSeries.map(value=>String(value).replaceAll('_',' ')).join(' · '):'DXY · yields · indexes · commodities · policy/economic releases';
  return '<section class="q-dpg-macro"><header><div><small>MACRO CONTEXT · GOVERNED REFERENCE</small><h2>ECB daily FX reference</h2></div><span>NO INTRADAY ELIGIBILITY IMPACT</span></header>'+
    '<div class="q-dpg-macro__grid">'+
      '<article><span>EUR / USD</span><strong>'+fx(macro.fxReference?.eurUsd)+'</strong><small>ECB quote per EUR</small></article>'+
      '<article><span>USD / INR</span><strong>'+fx(macro.fxReference?.usdInr)+'</strong><small>derived from same-day ECB EUR crosses</small></article>'+
      '<article><span>EUR / INR</span><strong>'+fx(macro.fxReference?.eurInr)+'</strong><small>ECB quote per EUR</small></article>'+
      '<article><span>Observed</span><strong>'+escapeHtml(displayTime(macro.observedAt))+'</strong><small>'+escapeHtml(String(macro.freshness||'daily reference').replaceAll('_',' '))+'</small></article>'+
      '<article><span>Provider</span><strong>European Central Bank</strong><small>'+escapeHtml(String(macro.quality||'official reference').replaceAll('_',' '))+'</small></article>'+
      '<article><span>Intraday feed</span><strong>NOT CONNECTED</strong><small>reference-only context</small></article>'+
    '</div>'+
    '<p>'+escapeHtml(macro.reason||'')+' '+escapeHtml(macro.methodology||'')+'</p>'+
    '<p class="q-dpg-macro__limit">Unavailable, not inferred: '+escapeHtml(unavailable)+'. '+escapeHtml(macro.cadenceBoundary||'Daily reference data is not substituted for intraday evidence.')+'</p></section>';
};

const marketStructureContext=(data,escapeHtml)=>{
  const structure=data?.quant?.structure;
  if(!structure||structure.state==='UNAVAILABLE')return '<section class="q-dpg-structure"><header><div><small>MARKET STRUCTURE</small><h2>Structure unavailable</h2></div><span>Not inferred</span></header><p>There are not enough verified candles to classify swing structure.</p></section>';
  const price=(value)=>value!=null&&value!==''&&Number.isFinite(Number(value))?money(Number(value)):'Unavailable';
  const pctValue=(value)=>value!=null&&value!==''&&Number.isFinite(Number(value))?Number(value).toFixed(2)+'%':'Unavailable';
  const swingCount=(side)=>Array.isArray(structure?.swings?.[side])?structure.swings[side].length:0;
  return '<section class="q-dpg-structure"><header><div><small>MARKET STRUCTURE · OBSERVED · 2.0</small><h2>'+escapeHtml(String(structure.state).replaceAll('_',' '))+'</h2></div><span>'+escapeHtml(String(structure.bias||'MIXED').replaceAll('_',' '))+' · '+escapeHtml(String(structure.strengthState||'UNAVAILABLE'))+'</span></header>'+
    '<div class="q-dpg-structure__grid">'+
      '<article><span>Support</span><strong>'+price(structure.support)+'</strong><small>'+pctValue(structure.distanceToSupportPct)+' below · '+escapeHtml(String(structure.supportTouches??0))+' touches</small></article>'+
      '<article><span>Resistance</span><strong>'+price(structure.resistance)+'</strong><small>'+pctValue(structure.distanceToResistancePct)+' above · '+escapeHtml(String(structure.resistanceTouches??0))+' touches</small></article>'+
      '<article><span>Break of structure</span><strong>'+escapeHtml(String(structure.breakOfStructure||'NONE'))+'</strong><small>Confirmed close beyond swing structure</small></article>'+
      '<article><span>Change of character</span><strong>'+escapeHtml(String(structure.changeOfCharacter||'NONE'))+'</strong><small>Break against the prior swing sequence</small></article>'+
      '<article><span>Retest</span><strong>'+escapeHtml(String(structure.retestState||'NONE').replaceAll('_',' '))+'</strong><small>Prior-range hold or failure</small></article>'+
      '<article><span>Continuation</span><strong>'+escapeHtml(String(structure.continuationState||'NONE').replaceAll('_',' '))+'</strong><small>Sequence / break / retest context</small></article>'+
      '<article><span>Rejection</span><strong>'+escapeHtml(String(structure.rejectionState||'NONE').replaceAll('_',' '))+'</strong><small>Observed wick rejection near structure</small></article>'+
      '<article><span>Potential exhaustion</span><strong>'+escapeHtml(String(structure.exhaustionState||'NONE').replaceAll('_',' '))+'</strong><small>Descriptive heuristic, not a reversal forecast</small></article>'+
      '<article><span>Compression</span><strong>'+escapeHtml(String(structure.compressionState||'UNAVAILABLE'))+'</strong><small>Range ratio '+escapeHtml(String(structure.compressionRatio??'—'))+'</small></article>'+
      '<article><span>Range position</span><strong>'+(Number.isFinite(Number(structure.rangePosition))?(Number(structure.rangePosition)*100).toFixed(0)+'%':'Unavailable')+'</strong><small>'+price(structure.rangeLow)+' → '+price(structure.rangeHigh)+'</small></article>'+
      '<article><span>Structural strength</span><strong>'+escapeHtml(String(structure.strengthState||'UNAVAILABLE'))+'</strong><small>Score '+escapeHtml(String(structure.strengthScore??'—'))+' / 9</small></article>'+
      '<article><span>Failed breakout</span><strong>'+escapeHtml(String(structure.failedBreakout||'NONE').replaceAll('_',' '))+'</strong><small>Close returned through prior range boundary</small></article>'+
    '</div>'+
    '<p>'+escapeHtml(String(swingCount('highs')))+' recent confirmed swing highs · '+escapeHtml(String(swingCount('lows')))+' recent confirmed swing lows. '+escapeHtml(structure.methodology||'Structure informs eligibility, entry, invalidation and target feasibility.')+'</p></section>';
};

const liquidityContext=(data,escapeHtml)=>{
  const liquidity=data?.evidence?.liquidity||data?.liquidity;
  if(!liquidity||liquidity.state!=='live')return '<section class="q-dpg-liquidity"><header><div><small>LIQUIDITY / MICROSTRUCTURE</small><h2>Order-book context unavailable</h2></div><span>Not inferred</span></header><p>'+escapeHtml(liquidity?.reason||'A verified two-sided L2 snapshot is unavailable, so spread and book imbalance are not inferred.')+'</p><p class="q-dpg-liquidity__limit">Trade imbalance, aggressive flow, volume delta, CVD, liquidation flow and historical book depth remain unavailable unless separately sourced.</p></section>';
  const price=(value)=>value!=null&&value!==''&&Number.isFinite(Number(value))?money(Number(value)):'Unavailable';
  const bps=(value)=>value!=null&&value!==''&&Number.isFinite(Number(value))?Number(value).toFixed(2)+' bps':'Unavailable';
  const imbalance=(value)=>value!=null&&value!==''&&Number.isFinite(Number(value))?(Number(value)*100).toFixed(1)+'%':'Unavailable';
  const depth=(bid,ask)=>compactMoney(bid)+' / '+compactMoney(ask);
  return '<section class="q-dpg-liquidity"><header><div><small>LIQUIDITY / L2 · CURRENT · MICROSTRUCTURE 2.0</small><h2>'+escapeHtml(String(liquidity.spreadState||'UNAVAILABLE'))+' spread · '+escapeHtml(String(liquidity.depthConsensus||'UNAVAILABLE').replaceAll('_',' '))+'</h2></div><span>'+escapeHtml(liquidity.provider||'Provider')+(liquidity.observedAt?' · '+escapeHtml(displayTime(liquidity.observedAt)):'')+'</span></header>'+
    '<div class="q-dpg-liquidity__grid">'+
      '<article><span>Best bid</span><strong>'+price(liquidity.bestBid)+'</strong></article>'+
      '<article><span>Best ask</span><strong>'+price(liquidity.bestAsk)+'</strong></article>'+
      '<article><span>Spread</span><strong>'+escapeHtml(bps(liquidity.spreadBps))+'</strong><small>'+escapeHtml(String(liquidity.spreadState||'UNAVAILABLE'))+'</small></article>'+
      '<article><span>Microprice</span><strong>'+price(liquidity.microprice)+'</strong><small>Bias '+escapeHtml(bps(liquidity.micropriceBiasBps))+'</small></article>'+
      '<article><span>Top-1 depth B / A</span><strong>'+escapeHtml(depth(liquidity.top1BidDepthUsd,liquidity.top1AskDepthUsd))+'</strong><small>Imbalance '+escapeHtml(imbalance(liquidity.top1Imbalance))+'</small></article>'+
      '<article><span>Top-5 bid depth</span><strong>'+compactMoney(liquidity.top5BidDepthUsd)+'</strong><small>Verified displayed notional</small></article><article><span>Top-5 ask depth</span><strong>'+compactMoney(liquidity.top5AskDepthUsd)+'</strong><small>Verified displayed notional</small></article>'+
      '<article><span>Top-10 depth B / A</span><strong>'+escapeHtml(depth(liquidity.top10BidDepthUsd,liquidity.top10AskDepthUsd))+'</strong><small>Imbalance '+escapeHtml(imbalance(liquidity.top10Imbalance))+'</small></article>'+
      '<article><span>Book imbalance</span><strong>'+escapeHtml(imbalance(liquidity.top5Imbalance))+'</strong><small>Top-5 · '+escapeHtml(String(liquidity.imbalanceState||'UNAVAILABLE').replaceAll('_',' '))+'</small></article>'+
      '<article><span>Top-10 imbalance</span><strong>'+escapeHtml(imbalance(liquidity.top10Imbalance))+'</strong><small>'+escapeHtml(String(liquidity.top10ImbalanceState||'UNAVAILABLE').replaceAll('_',' '))+'</small></article>'+
      '<article><span>Depth consensus</span><strong>'+escapeHtml(String(liquidity.depthConsensus||'UNAVAILABLE').replaceAll('_',' '))+'</strong><small>Top-1 / top-5 / top-10 agreement</small></article>'+
      '<article><span>Top-1 concentration</span><strong>'+(Number.isFinite(Number(liquidity.depthConcentrationTop1))?(Number(liquidity.depthConcentrationTop1)*100).toFixed(1)+'%':'Unavailable')+'</strong><small>Displayed top level / top-10 depth</small></article>'+
      '<article><span>Unavailable flow</span><strong>NOT INFERRED</strong><small>CVD · aggressor flow · liquidations</small></article>'+
    '</div>'+
    '<p>'+escapeHtml(liquidity.method||'Current verified order-book snapshot.')+'</p><p class="q-dpg-liquidity__limit">Point-in-time marketability context only. Displayed depth can change rapidly and is not evidence of whales, institutions or smart money. CVD, aggressive trade flow, historical depth and liquidation flow are not inferred.</p></section>';
};

const eventRiskContext=(data,escapeHtml)=>{
  const eventRisk=data?.evidence?.eventRisk||data?.eventRisk;
  const state=String(eventRisk?.state||'unavailable').toUpperCase();
  const level=String(eventRisk?.level||'UNAVAILABLE').toUpperCase();
  const count=Math.max(0,Number(eventRisk?.eventCount)||0);
  return '<section class="q-dpg-event-risk"><header><div><small>EVENT RISK</small><h2>'+escapeHtml(level)+'</h2></div><span>'+escapeHtml(state.replaceAll('_',' '))+'</span></header>'+
    '<div class="q-dpg-event-risk__meta"><span><em>Verified scheduled events</em><strong>'+escapeHtml(String(count))+'</strong></span><span><em>Next event</em><strong>'+(eventRisk?.nextEventAt?escapeHtml(displayTime(eventRisk.nextEventAt)):'UNAVAILABLE')+'</strong></span><span><em>Scheduled feed</em><strong>'+(eventRisk?.scheduledFeedConnected?'CONNECTED':'NOT CONNECTED')+'</strong></span></div>'+
    '<p>'+escapeHtml(eventRisk?.reason||'A verified scheduled-event feed is not connected, so QELLY does not manufacture an event-risk score.')+'</p>'+
    '<p class="q-dpg-event-risk__limit">'+escapeHtml(eventRisk?.calendarBoundary||'The TradingView Economic Calendar is an isolated display embed and is not read into Decision Intelligence.')+' '+escapeHtml(eventRisk?.newsBoundary||'Recent news remains evidence context and is not converted into scheduled event risk.')+' '+escapeHtml(eventRisk?.gatingBoundary||'High-impact event gating remains unavailable until a verified feed is connected.')+'</p></section>';
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
  const entryReady=['VALID','TRIGGERED','ACTIVE'].includes(lifecycleState);
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
  const invalidationOrder=[['Price',invalidation.price],['Structure',invalidation.structural],['Evidence',invalidation.evidence],['Time',invalidation.time],['Event',invalidation.event],['Regime',invalidation.regime],['Liquidity',invalidation.liquidity]];
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

const scannerFiltersMarkup=(state,escapeHtml)=>{
  const filters=state.scanFilters||{};
  const selected=(key,value)=>String(filters[key]??'')===String(value)?' selected':'';
  const options=(key,items)=>items.map(([value,label])=>'<option value="'+escapeHtml(value)+'"'+selected(key,value)+'>'+escapeHtml(label)+'</option>').join('');
  return '<details class="q-dpg-scan-filters"><summary>Find Trade Now filters <span>evidence-gated</span></summary><div>'+
    '<label><span>Universe</span><select data-dpg-scan-filter="universe">'+options('universe',[['all','All supported assets'],['current','Current asset']])+'</select></label>'+
    '<label><span>Direction</span><select data-dpg-scan-filter="direction">'+options('direction',[['any','Any'],['long','Long'],['short','Short']])+'</select></label>'+
    '<label><span>Min evidence</span><select data-dpg-scan-filter="minEvidenceQuality">'+options('minEvidenceQuality',[['0','Any'],['0.5','50%'],['0.65','65%'],['0.75','75%'],['0.85','85%']])+'</select></label>'+
    '<label><span>Min calibrated confidence</span><select data-dpg-scan-filter="minCalibratedConfidence">'+options('minCalibratedConfidence',[['0','Any'],['0.5','50%'],['0.65','65%'],['0.75','75%']])+'</select></label>'+
    '<label><span>Min MTF agreement</span><select data-dpg-scan-filter="minMtfAgreement">'+options('minMtfAgreement',[['0','Any'],['0.5','50%'],['0.75','75%'],['1','100%']])+'</select></label>'+
    '<label><span>Liquidity</span><select data-dpg-scan-filter="liquidity">'+options('liquidity',[['any','Any'],['live','Live L2 required'],['tight','Tight spread required']])+'</select></label>'+
    '<label><span>Volatility</span><select data-dpg-scan-filter="volatility">'+options('volatility',[['any','Any'],['low','Low'],['normal','Normal'],['elevated','Elevated'],['high','High']])+'</select></label>'+
    '<label><span>Regime</span><select data-dpg-scan-filter="regime">'+options('regime',[['any','Any'],['trending','Trending'],['ranging','Ranging'],['transition','Transition'],['high_volatility','High volatility']])+'</select></label>'+
    '<label><span>Event-risk tolerance</span><select data-dpg-scan-filter="eventRiskTolerance">'+options('eventRiskTolerance',[['any','Any / unavailable allowed'],['low','Low only'],['medium','Up to medium'],['high','Up to high']])+'</select></label>'+
    '<label><span>Data freshness</span><select data-dpg-scan-filter="freshness">'+options('freshness',[['live_or_delayed','Live or delayed'],['live','Live only'],['any','Any verified state']])+'</select></label>'+
  '</div><p>Strict filters fail closed when required evidence is unavailable. They never force a trade.</p></details>';
};

const scannerMarkup=(scan,{scanning=false,error=null,escapeHtml})=>{
  if(scanning)return '<section class="q-dpg-scanner q-dpg-scanner--loading" role="status"><span class="q-spinner"></span><div><small>FIND TRADE NOW 2.0 · GOVERNED SCAN</small><h2>Scanning verified market evidence</h2><p>Applying the same Decision, calibration, structure, liquidity and R:R gates with bounded concurrency.</p></div></section>';
  if(error)return '<section class="q-dpg-scanner q-dpg-scanner--error" role="alert"><header><div><small>FIND TRADE NOW 2.0 · GOVERNED SCAN</small><h2>Scan unavailable</h2></div><button class="q-button q-button--secondary" data-dpg-scan>Retry scan</button></header><p>'+escapeHtml(error)+'</p></section>';
  if(!scan)return '';
  const candidates=Array.isArray(scan.candidates)?scan.candidates:[];
  const eligible=Number(scan.eligibleCount)||0;
  const conditional=Number(scan.conditionalCount)||0;
  const stateLabel=String(scan.state||'NO_ELIGIBLE_SETUP').replaceAll('_',' ');
  const rows=candidates.map((item,index)=>{
    const trade=item.trade||{},evidence=item.evidence||{},market=item.market||{};
    const tone=item.eligible?'positive':item.action==='SELL'?'negative':item.conditional?'warning':'muted';
    const score=Number.isFinite(Number(item.researchPriority))?Number(item.researchPriority).toFixed(1):'—';
    const rr=trade.rr||'—';
    const calibration=evidence.calibrationState||'UNCALIBRATED';
    const failures=Array.isArray(item.filterFailures)?item.filterFailures:[];
    return '<button class="q-dpg-scan-row q-dpg-scan-row--'+tone+'" data-dpg-scan-asset="'+escapeHtml(item.asset)+'" type="button">'+
      '<span class="q-dpg-scan-rank">'+(index+1)+'</span>'+
      '<span class="q-dpg-scan-asset"><strong>'+escapeHtml(item.asset)+'</strong><small>'+escapeHtml(String(market.regime||'UNAVAILABLE'))+' · '+escapeHtml(String(market.volatilityRegime||'UNKNOWN'))+'</small><em>'+escapeHtml(String(item.state||'WAIT').replaceAll('_',' '))+'</em></span>'+
      '<span><em>View</em><strong>'+escapeHtml(item.action)+'</strong></span>'+
      '<span><em>R:R</em><strong>'+escapeHtml(rr)+'</strong><small>'+escapeHtml(String(trade.feasibility||trade.status||'NO_TRADE'))+'</small></span>'+
      '<span><em>Evidence triage</em><strong>'+escapeHtml(score)+'</strong><small>not a win probability</small></span>'+
      '<span><em>Calibration</em><strong>'+escapeHtml(calibration)+'</strong><small>'+escapeHtml(String(Math.round(Number(evidence.calibratedConfidence||0)*100)))+'% calibrated conf</small></span>'+
      '<span class="q-dpg-scan-open">'+(item.eligible?'Open setup':item.conditional?'Inspect condition':'Inspect')+' →</span>'+
      (failures.length?'<small class="q-dpg-scan-failures">'+escapeHtml(failures.slice(0,3).join(' · ').replaceAll('_',' '))+'</small>':'')+
    '</button>';
  }).join('');
  return '<section class="q-dpg-scanner"><header><div><small>FIND TRADE NOW 2.0 · GOVERNED SCAN</small><h2>'+escapeHtml(stateLabel)+'</h2><p>'+escapeHtml(String(scan.availableCount||0))+' verified · '+escapeHtml(String(scan.unavailableCount||0))+' unavailable · '+escapeHtml(String(eligible))+' valid · '+escapeHtml(String(conditional))+' conditional · '+escapeHtml(String(scan.interval||''))+' / '+escapeHtml(String(scan.horizon||''))+'</p></div><button class="q-button q-button--secondary" data-dpg-scan>Rescan</button></header>'+
    '<div class="q-dpg-scan-boundary"><strong>Research boundary</strong><span>'+escapeHtml(scan.eventRisk?.reason||'Event risk is unavailable unless verified by a connected source.')+'</span></div>'+
    '<div class="q-dpg-scan-list">'+(rows||'<p class="q-dpg-no-levels">No verified candidates were returned.</p>')+'</div>'+
    '<p class="q-dpg-scan-note">Evidence triage ranks current research quality, structural feasibility, liquidity, contradiction, freshness and calibration only. It is not a success probability, expected return, trade recommendation or execution priority.</p>'+
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



const pastPresentFutureMarkup=(data,escapeHtml)=>{
  const context=data?.pastPresentFuture;
  if(!context)return '';
  const past=context.past||{},present=context.present||{},future=context.future||{};
  const move=past.selectedRange;
  const analogSummary=past.historicalAnalogs?.summary;
  const scenario=future.scenarios||{};
  const targets=Array.isArray(future.targetFeasibility)?future.targetFeasibility:[];
  const probability=(value)=>Number.isFinite(Number(value))?(Number(value)*100).toFixed(1)+'%':'Unavailable';
  const pastBody=move
    ?'<strong>'+(Number(move.changePct)>=0?'+':'')+escapeHtml(String(move.changePct))+'%</strong><p>'+escapeHtml(String(move.candles))+' candles · range '+escapeHtml(String(move.rangePct))+'% · volume '+escapeHtml(String(move.volumeRatio??'N/A'))+'× prior window.</p>'
    :'<strong>No selected range</strong><p>Select a candle or drag a range to attach move-specific Past evidence.</p>';
  const analogBody=analogSummary
    ?'<small>Analogs</small><span>'+escapeHtml(String(analogSummary.count??0))+' matches · median '+escapeHtml(String(analogSummary.medianForwardReturnPct??'—'))+'% · descriptive only</span>'
    :'<small>Analogs</small><span>'+escapeHtml(String(past.historicalAnalogs?.state||'UNAVAILABLE').replaceAll('_',' '))+'</span>';
  const targetRows=targets.length
    ?targets.map(item=>'<li><span>'+escapeHtml(item.label||'Target')+'</span><strong>'+escapeHtml(String(item.feasibility||'UNAVAILABLE').replaceAll('_',' '))+'</strong><small>'+(Number.isFinite(Number(item.target))?money(item.target):'Target unavailable')+(item.structuralBarrier!==null&&item.structuralBarrier!==undefined?' · barrier '+money(item.structuralBarrier):'')+'</small></li>').join('')
    :'<li><span>Targets</span><strong>Unavailable</strong><small>No evidence-qualified target ladder.</small></li>';
  return '<section class="q-dpg-ppf" aria-label="Past Present Future">'+
    '<article><header><small>PAST</small><h2>Observed context</h2></header>'+pastBody+'<div class="q-dpg-ppf__meta">'+analogBody+'</div></article>'+
    '<article><header><small>PRESENT</small><h2>'+escapeHtml(String(present.qellyView?.action||'NO TRADE').replaceAll('_',' '))+'</h2></header><strong>'+escapeHtml(String(present.marketState?.label||'Market state unavailable'))+'</strong><p>Structure '+escapeHtml(String(present.structure?.state||'UNAVAILABLE').replaceAll('_',' '))+' · trend '+escapeHtml(String(present.trend?.regime||'UNKNOWN').replaceAll('_',' '))+' · volatility '+escapeHtml(String(present.volatility?.regime||'UNKNOWN').replaceAll('_',' '))+'.</p><div class="q-dpg-ppf__meta"><small>MTF</small><span>'+escapeHtml(String(present.multiTimeframe?.agreement?.direction||'UNAVAILABLE'))+'</span><small>Calibration</small><span>'+escapeHtml(String(present.calibration?.state||'UNCALIBRATED').replaceAll('_',' '))+'</span><small>Liquidity</small><span>'+escapeHtml(String(present.liquidity?.state||'unavailable'))+'</span></div></article>'+
    '<article><header><small>FUTURE</small><h2>Scenario map</h2></header><strong>'+probability(scenario.bull)+' bull · '+probability(scenario.base)+' base · '+probability(scenario.bear)+' bear</strong><p>Horizon '+escapeHtml(String(future.horizon||'Unavailable'))+' · modelled range '+(Number.isFinite(Number(future.expectedRange?.p05))?money(future.expectedRange.p05):'—')+' to '+(Number.isFinite(Number(future.expectedRange?.p95))?money(future.expectedRange.p95):'—')+'.</p><ul class="q-dpg-ppf__targets">'+targetRows+'</ul><p><strong>What changes the view:</strong> '+escapeHtml(future.whatChangesView||'Reassess when fresh evidence changes.')+'</p></article>'+
  '</section>';
};

const contradictionMarkup=(data,escapeHtml)=>{
  const context=data?.contradictionAnalysis;
  if(!context)return '';
  const support=Array.isArray(context.support)?context.support:[];
  const contradictions=Array.isArray(context.contradictions)?context.contradictions:[];
  const neutral=Array.isArray(context.neutral)?context.neutral:[];
  const list=(items,empty)=>items.length?'<ul>'+items.slice(0,6).map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul>':'<p>'+escapeHtml(empty)+'</p>';
  return '<section class="q-dpg-contradiction-map"><header><div><small>CONTRADICTION ENGINE</small><h2>'+escapeHtml(String(context.state||'MIXED').replaceAll('_',' '))+'</h2></div><span>Score '+(Number.isFinite(Number(context.score))?Math.round(Number(context.score)*100)+'%':'Unavailable')+'</span></header><div><article><h3>Supporting context</h3>'+list(support,'No supporting evidence summary is available.')+'</article><article><h3>Contradictions</h3>'+list(contradictions,'No unresolved contradiction is currently recorded.')+'</article><article><h3>Neutral / unavailable</h3>'+list(neutral,'No neutral evidence boundary is recorded.')+'</article></div><p>'+escapeHtml(context.note||'')+'</p></section>';
};

const decisionTraceMarkup=(data,escapeHtml)=>{
  const trace=data?.decisionTrace;
  if(!trace)return '';
  const nodes=Array.isArray(trace.nodes)?trace.nodes:[];
  const edges=Array.isArray(trace.textAlternative)?trace.textAlternative:[];
  return '<section class="q-dpg-trace"><header><div><small>DECISION TRACE · EVIDENCE GRAPH</small><h2>Observed evidence → QELLY view → research setup</h2><p>'+escapeHtml(trace.boundary||'')+'</p></div><span>NO SECOND DECISION ENGINE</span></header><div class="q-dpg-trace__nodes">'+nodes.map(node=>'<article><div><small>'+escapeHtml(String(node.kind||'evidence').replaceAll('-',' '))+'</small><strong>'+escapeHtml(node.label||node.id)+'</strong></div><span>'+escapeHtml(String(node.freshness||'UNAVAILABLE'))+' · '+escapeHtml(String(node.role||'context').replaceAll('_',' '))+'</span><p>'+escapeHtml(node.source||'QELLY derived research')+'</p><details><summary>Method and limits</summary><p>'+escapeHtml(node.methodology||'')+'</p><ul>'+(Array.isArray(node.limitations)?node.limitations.map(item=>'<li>'+escapeHtml(item)+'</li>').join(''):'')+'</ul></details></article>').join('')+'</div><details class="q-dpg-trace__edges"><summary>Trace relationships</summary><ol>'+edges.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ol></details></section>';
};



const whatChangedMarkup=(previous,current,escapeHtml)=>{
  if(!current)return '';
  const comparable=previous&&previous.asset===current.asset&&previous.interval===current.interval;
  if(!comparable)return '<section id="qelly-decision-what-changed" class="q-dpg-what-changed"><header><div><small>WHAT CHANGED?</small><h2>Baseline created</h2></div><span>Same-session comparison</span></header><p>This is the first comparable '+escapeHtml(String(current.asset||''))+' / '+escapeHtml(String(current.interval||''))+' Decision snapshot in this session. Refresh or recompute to see deltas.</p></section>';
  const fields=[
    ['QELLY view','action'],
    ['Confidence','confidence'],
    ['Evidence quality','evidenceQuality'],
    ['Regime','regime'],
    ['Volatility regime','volatilityRegime'],
    ['MTF direction','timeframeDirection'],
    ['MTF agreement','timeframeAgreement'],
    ['Trade status','tradeStatus'],
    ['Lifecycle','lifecycle'],
    ['Selected R:R','selectedRr'],
    ['R:R feasibility','selectedRrFeasibility'],
    ['Invalidation','invalidationPrice'],
    ['Expiry','expiryAt']
  ];
  const renderValue=(key,value)=>{
    if(value===null||value===undefined||value==='')return 'Unavailable';
    if(key==='confidence'||key==='evidenceQuality'||key==='timeframeAgreement')return (Number(value)*100).toFixed(1)+'%';
    if(key==='invalidationPrice'&&Number.isFinite(Number(value)))return money(value);
    return String(value).replaceAll('_',' ');
  };
  const changed=fields.map(([label,key])=>({label,key,before:previous[key],after:current[key]})).filter(item=>String(item.before??'')!==String(item.after??''));
  return '<section id="qelly-decision-what-changed" class="q-dpg-what-changed"><header><div><small>WHAT CHANGED?</small><h2>'+(changed.length?escapeHtml(String(changed.length))+' tracked changes':'No tracked field changed')+'</h2></div><span>'+escapeHtml(String(previous.observedAt||''))+' → '+escapeHtml(String(current.observedAt||''))+'</span></header>'+(changed.length?'<div>'+changed.map(item=>'<article><small>'+escapeHtml(item.label)+'</small><span>'+escapeHtml(renderValue(item.key,item.before))+' → <strong>'+escapeHtml(renderValue(item.key,item.after))+'</strong></span></article>').join('')+'</div>':'<p>The tracked Decision fields are unchanged from the previous same-asset, same-timeframe snapshot.</p>')+'</section>';
};



export async function renderDecisionProvenGraph(main,deps){
  installStyles();const {api,stateBanner,escapeHtml,toast,navigate}=deps;
  const chatContext=readChatDecisionContext();
  let state={asset:chatContext.asset,interval:chatContext.interval,horizon:normalizeHorizon(chatContext.interval,'4h'),rr:'auto',customRr:'2.5',loading:true,data:null,previousSnapshot:null,error:null,draft:null,selection:null,scanning:false,scan:null,scanError:null,ledger:null,ledgerLoading:false,ledgerError:null,ledgerMutating:false,scanFilters:{universe:'all',direction:'any',minEvidenceQuality:'0',minCalibratedConfidence:'0',minMtfAgreement:'0',liquidity:'any',volatility:'any',regime:'any',eventRiskTolerance:'any',freshness:'live_or_delayed'}};
  const ledgerAuthenticated=()=>Boolean(window.__QELLY_SESSION_STATE__?.authenticated);
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
        '<div class="q-dpg-hero__market"><strong>'+price+'</strong><span>'+(change===null?'Change unavailable':(change>=0?'+':'')+change.toFixed(2)+'%')+'</span><small>Crypto · '+escapeHtml(provider)+'</small><small>'+escapeHtml(freshness)+' · '+escapeHtml(marketState)+'</small><small>Observed '+escapeHtml(displayTime(data?.observedAt))+'</small></div></div>'+
      '<div class="q-dpg-hero__view"><small>QELLY VIEW</small><h2>'+escapeHtml(action)+'</h2><p>'+escapeHtml(label)+'</p><div class="q-dpg-hero__metrics">'+
        '<span><em>Evidence quality</em><strong>'+escapeHtml(quality)+'</strong></span>'+
        '<span><em>Calibrated confidence</em><strong>'+escapeHtml(confidence)+'</strong></span>'+
        '<span><em>Scenario</em><strong>'+escapeHtml(scenarioLead)+'</strong></span>'+
        '<span><em>MTF agreement</em><strong>'+escapeHtml(agreement)+'</strong></span>'+
        '<span><em>Regime</em><strong>'+escapeHtml(String(regime))+'</strong></span>'+
        '<span><em>Volatility</em><strong>'+escapeHtml(volatility)+'</strong></span>'+
        '<span><em>Timeframe</em><strong>'+escapeHtml(state.interval)+'</strong></span>'+
      '</div></div>'+
      '<div class="q-dpg-hero__actions"><button class="q-button q-button--primary" data-dpg-scan '+(state.scanning?'disabled':'')+'>'+(state.scanning?'Scanning…':'Find Trade Now')+'</button><button class="q-button q-button--secondary" data-dpg-explain-header '+(state.draft?'':'disabled')+'>Explain This Move</button><button class="q-button q-button--secondary" data-dpg-explain-candle '+(data?.market?.candles?.length?'':'disabled')+'>Explain Candle</button><button class="q-button q-button--secondary" data-dpg-mtf-jump>Compare Timeframes</button><button class="q-button q-button--secondary" data-dpg-compare-asset>Compare Asset</button><button class="q-button q-button--secondary" type="button" data-dpg-open-chat>Ask QELLY</button><button class="q-button q-button--secondary" data-dpg-methodology-jump>Sources / Methodology</button></div>'+
    '</section>';
  };
  const outcomeLedgerMarkup=(data)=>{
    const trade=data?.tradeResearch||{},sourceSetupId=trade?.setupId||null;
    if(!ledgerAuthenticated())return '<section class="q-dpg-ledger"><header><div><small>OBSERVED SETUP LEDGER</small><h2>Track real setup outcomes after sign-in</h2></div><span>NO BACKFILL</span></header><p>QELLY does not fabricate historical setups. Sign in to persist a live evidence-qualified setup, then re-observe it from the server-side market evidence stack.</p><p class="q-dpg-ledger__boundary">Target-touch calibration remains UNCALIBRATED until a sufficient sample of real resolved setup outcomes exists.</p></section>';
    const ledger=state.ledger||{items:[],observedSetups:0,calibrationEligible:0,minimumSampleGate:50,calibrationState:'UNCALIBRATED',calibration:null};
    const items=Array.isArray(ledger.items)?ledger.items:[];
    const current=sourceSetupId?items.find(item=>item.sourceSetupId===sourceSetupId):null;
    const trackable=data?.truthState==='LIVE'&&trade?.status==='VALID'&&['FORMING','TRIGGERED','VALID'].includes(String(trade?.lifecycle?.state||''));
    const terminal=Boolean(current?.resolvedAt);
    const metric=(value)=>value!=null&&value!==''&&Number.isFinite(Number(value))?Number(value).toFixed(2)+'R':'—';
    const pct=(value)=>value!=null&&value!==''&&Number.isFinite(Number(value))?(Number(value)*100).toFixed(1)+'%':'Unavailable';
    const rows=items.slice(0,6).map(item=>'<article><div><strong>'+escapeHtml(item.asset)+' · '+escapeHtml(item.timeframe)+'</strong><small>'+escapeHtml(displayTime(item.createdAt))+' · '+escapeHtml(String(item.requestedRr||'auto'))+'</small></div><span class="q-status q-status--'+(['INVALIDATED','EXPIRED'].includes(item.latestStatus)?'warning':item.resolvedAt?'live':'cached')+'">'+escapeHtml(String(item.latestStatus||'FORMING').replaceAll('_',' '))+'</span><dl><div><dt>MFE</dt><dd>'+escapeHtml(metric(item.metrics?.mfeR))+'</dd></div><div><dt>MAE</dt><dd>'+escapeHtml(metric(item.metrics?.maeR))+'</dd></div><div><dt>Highest target</dt><dd>'+escapeHtml(item.metrics?.highestTarget||'—')+'</dd></div><div><dt>Outcome</dt><dd>'+escapeHtml(item.resolvedOutcome?.state||'OPEN')+'</dd></div></dl>'+(item.resolvedAt?'':'<button class="q-button q-button--secondary" data-dpg-ledger-observe="'+escapeHtml(item.id)+'" '+(state.ledgerMutating?'disabled':'')+'>Observe outcome now</button>')+'</article>').join('');
    const currentAction=current
      ?'<div class="q-dpg-ledger__current"><span>Current setup</span><strong>'+escapeHtml(current.latestStatus||'FORMING')+'</strong>'+(terminal?'<small>'+escapeHtml(current.resolvedOutcome?.state||'Resolved')+'</small>':'<button class="q-button q-button--secondary" data-dpg-ledger-observe="'+escapeHtml(current.id)+'" '+(state.ledgerMutating?'disabled':'')+'>Observe current setup</button>')+'</div>'
      :trackable?'<button class="q-button q-button--primary" data-dpg-ledger-track '+(state.ledgerMutating?'disabled':'')+'>'+(state.ledgerMutating?'Recording…':'Track this live setup')+'</button>'
      :'<div class="q-dpg-ledger__current"><span>Current setup</span><strong>NOT TRACKABLE</strong><small>Only a LIVE, evidence-qualified VALID setup can enter the ledger.</small></div>';
    const calibration=ledger.calibration||{};
    const calibrationMetrics=calibration.metrics||{};
    const calibrationRows=['T1','T2','T3','T4','INVALIDATION_FIRST'].map(key=>{
      const item=calibrationMetrics[key]||{},ci=item.confidenceInterval95||{};
      return '<span><em>'+escapeHtml(item.label||key.replaceAll('_',' '))+'</em><strong>'+escapeHtml(item.eligible?pct(item.probability):'UNAVAILABLE')+'</strong><small>'+escapeHtml(String(item.state||'UNCALIBRATED').replaceAll('_',' '))+' · n='+escapeHtml(String(item.sampleSize??0))+(item.eligible?' · 95% CI '+escapeHtml(pct(ci.low))+'–'+escapeHtml(pct(ci.high)):'')+'</small></span>';
    }).join('');
    const calibrationPanel='<details class="q-dpg-target-calibration" '+(calibration.eligible?'open':'')+'><summary>Target-touch calibration · '+escapeHtml(String(calibration.state||'UNCALIBRATED').replaceAll('_',' '))+'</summary><div class="q-dpg-target-calibration__grid">'+calibrationRows+'</div><p>'+escapeHtml(calibration.method||'Chronological real setup calibration has not yet reached its sample gate.')+'</p><p>'+escapeHtml(calibration.leakageGuard||'No future outcomes are used to score earlier setup probabilities.')+' '+escapeHtml(calibration.analogBoundary||'Historical analog positive-rate is not used as probability.')+'</p></details>';
    return '<section class="q-dpg-ledger"><header><div><small>OBSERVED SETUP LEDGER · WORKSPACE RLS</small><h2>Real lifecycle and outcome evidence</h2></div><span>'+escapeHtml(String(ledger.calibrationState||'UNCALIBRATED'))+'</span></header><div class="q-dpg-ledger__summary"><span>Observed setups<strong>'+escapeHtml(String(ledger.observedSetups??items.length))+'</strong></span><span>Calibration-eligible resolutions<strong>'+escapeHtml(String(ledger.calibrationEligible??0))+' / '+escapeHtml(String(ledger.minimumSampleGate??50))+'</strong></span><span>Current source setup<strong>'+escapeHtml(sourceSetupId?'AVAILABLE':'NO TRADE')+'</strong></span></div>'+currentAction+(state.ledgerLoading?'<p>Loading workspace ledger…</p>':'')+(state.ledgerError?'<p class="q-dpg-ledger__error">'+escapeHtml(state.ledgerError)+'</p>':'')+calibrationPanel+'<div class="q-dpg-ledger__rows">'+(rows||'<p>No observed setups yet. Nothing before the first explicit tracking event is backfilled.</p>')+'</div><p class="q-dpg-ledger__boundary">'+escapeHtml(ledger.boundary||'Only setups created after tracking begins are included. No historical setups are fabricated or backfilled.')+' Target-touch calibration remains gated until the independent sample requirement is met.</p></section>';
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
      outcomeLedgerMarkup(data)+
      probabilityCalibrationMarkup(data,escapeHtml)+
      historicalAnalogsMarkup(data,escapeHtml)+
      '<section class="q-dpg-view q-dpg-view--'+actionTone(view.action)+'"><div><small>QELLY VIEW</small><h2>'+escapeHtml(view.action)+'</h2><p>'+escapeHtml(view.label)+'</p></div><div class="q-dpg-confidence"><span>Evidence confidence</span><strong>'+Math.round(view.confidence*100)+'%</strong></div>'+calibration(view,escapeHtml)+levels(view)+'<details><summary>Why this view?</summary><ul>'+view.why.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul><p><strong>What changes it:</strong> '+escapeHtml(view.changesIf)+'</p></details></section>'+
      '<section class="q-dpg-stage"><div class="q-dpg-chart-wrap"><div class="q-dpg-chart-help">Click one candle or drag across observed candles to select a move.</div>'+chart(data,escapeHtml)+'<div class="q-dpg-selection-actions"><span data-dpg-selection-label>'+(state.draft?(state.draft.end-state.draft.start<(INTERVAL_MS[state.interval]||0)?'Single candle selected':'Range selected'):'No range selected')+'</span><button class="q-button q-button--primary" data-dpg-explain '+(state.draft?'':'disabled')+'>'+(state.draft&&state.draft.end-state.draft.start<(INTERVAL_MS[state.interval]||0)?'Explain this candle':'Explain this move')+'</button><button class="q-button q-button--secondary" data-dpg-clear '+(state.draft||state.selection?'':'disabled')+'>Clear</button></div></div><aside class="q-dpg-scenarios">'+[['Bull',data.forecast.probabilities.bull],['Base',data.forecast.probabilities.base],['Bear',data.forecast.probabilities.bear]].map(([label,value])=>'<article><span>'+label+'</span><strong>'+Math.round(value*100)+'%</strong><meter min="0" max="1" value="'+value+'"></meter></article>').join('')+'<p>Modelled terminal range<br><strong>'+money(data.forecast.terminal.p05)+' – '+money(data.forecast.terminal.p95)+'</strong></p></aside></section>'+
      (move?'<section class="q-dpg-move"><header><div><small>SELECTED MOVE</small><h2>'+pct(move.changePct)+' across '+move.candles+' candles</h2></div><span>'+new Date(move.start).toLocaleString()+' → '+new Date(move.end).toLocaleString()+'</span></header><div><article><span>Range</span><strong>'+pct(move.rangePct)+'</strong></article><article><span>Volume vs prior</span><strong>'+(move.volumeRatio?move.volumeRatio+'×':'N/A')+'</strong></article><article><span>Volatility</span><strong>'+pct(move.volatilityPct)+'</strong></article><article><span>Prior volatility</span><strong>'+(move.priorVolatilityPct===null?'N/A':pct(move.priorVolatilityPct))+'</strong></article></div></section>':'')+
      pastPresentFutureMarkup(data,escapeHtml)+contradictionMarkup(data,escapeHtml)+whatChangedMarkup(state.previousSnapshot,data.decisionSnapshot,escapeHtml)+decisionTraceMarkup(data,escapeHtml)+
      marketStructureContext(data,escapeHtml)+multiTimeframe(data,escapeHtml)+liquidityContext(data,escapeHtml)+derivativesContext(data,escapeHtml)+crossAssetContext(data,escapeHtml)+macroContext(data,escapeHtml)+eventRiskContext(data,escapeHtml)+adSlot('decision-intelligence-inline')+'<section class="q-dpg-evidence"><header><div><small>EVIDENCE RANKING</small><h2>What best explains the move</h2></div><span>News: '+escapeHtml(data.evidence?.news?.state||'unavailable')+' · L2: '+escapeHtml(data.evidence?.liquidity?.state||'unavailable')+' · Funding/OI: '+escapeHtml(data.evidence?.derivatives?.state||'unavailable')+' · Cross-asset: '+escapeHtml(data.evidence?.crossAsset?.state||'unavailable')+' · Macro: '+escapeHtml(data.evidence?.macro?.state||'unavailable')+' · Event calendar: '+escapeHtml(data.evidence?.eventRisk?.state||'unavailable')+' · Liquidations: unavailable, not inferred</span></header>'+evidence(data)+'</section>'+
      '<details id="qelly-decision-methodology" class="q-dpg-audit"><summary>Methodology and sources</summary><div><section><h3>Market data</h3><p>'+escapeHtml(data.provenance.provider)+' public candles. <a href="'+escapeHtml(data.provenance.documentation)+'" target="_blank" rel="noopener">Source documentation ↗</a></p></section><section><h3>Method</h3><p>'+data.provenance.model.features.map(escapeHtml).join(' · ')+'</p><p>'+escapeHtml(data.confidence.calibration)+'</p></section><section><h3>Limits</h3><ul>'+data.provenance.model.limitations.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul></section></div></details>';
  };
  const draw=()=>{
    const data=state.data;
    main.innerHTML='<section class="q-page q-dpg-page">'+stateBanner()+hero(data)+'<section class="q-dpg-controls q-dpg-controls--decision" aria-label="Decision controls">'+select('horizon',validHorizons(state.interval))+'<label><span>Risk / reward</span><select data-dpg-rr><option value="auto" '+(state.rr==='auto'?'selected':'')+'>Auto</option><option value="1" '+(state.rr==='1'?'selected':'')+'>1:1</option><option value="2" '+(state.rr==='2'?'selected':'')+'>1:2</option><option value="3" '+(state.rr==='3'?'selected':'')+'>1:3</option><option value="4" '+(state.rr==='4'?'selected':'')+'>1:4</option><option value="custom" '+(state.rr==='custom'?'selected':'')+'>Custom</option></select></label>'+(state.rr==='custom'?'<label><span>Custom R:R</span><input data-dpg-custom-rr type="number" min="0.5" max="10" step="0.1" value="'+escapeHtml(state.customRr)+'"></label>':'')+'<p>Public research · no sign-in required · no trade execution</p></section>'+scannerFiltersMarkup(state,escapeHtml)+scannerMarkup(state.scan,{scanning:state.scanning,error:state.scanError,escapeHtml})+(state.loading?'<section class="q-dpg-state" role="status"><span class="q-spinner"></span><h2>Weighing fresh evidence</h2><p>Loading market observations and scenario ranges.</p></section>':'')+(state.error?'<section class="q-dpg-state q-dpg-state--error" role="alert"><h2>Live research unavailable</h2><p>'+escapeHtml(state.error)+'</p><button class="q-button q-button--secondary" data-dpg-refresh>Try again</button></section>':'')+(data?content(data):'')+'</section>';
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
    main.querySelector('[data-dpg-rr]')?.addEventListener('change',(event)=>{
      state.rr=event.currentTarget.value;state.scan=null;state.scanError=null;
      emitProductEvent('qelly_view_interaction',{route:'decision-provenance',feature:'risk_reward',action:'select',state:rrTelemetryState(state.rr)});
      load();
    });
    main.querySelector('[data-dpg-custom-rr]')?.addEventListener('change',(event)=>{state.customRr=event.currentTarget.value;state.scan=null;state.scanError=null;load();});
    main.querySelectorAll('[data-dpg-scan]').forEach(button=>button.addEventListener('click',scan));
    main.querySelector('[data-dpg-ledger-track]')?.addEventListener('click',trackCurrentSetup);
    main.querySelectorAll('[data-dpg-ledger-observe]').forEach(button=>button.addEventListener('click',()=>observeTrackedSetup(button.dataset.dpgLedgerObserve)));
    main.querySelectorAll('[data-dpg-scan-filter]').forEach(element=>element.addEventListener('change',()=>{const key=element.dataset.dpgScanFilter;if(key){state.scanFilters[key]=element.value;state.scan=null;state.scanError=null;draw();}}));
    main.querySelectorAll('[data-dpg-scan-asset]').forEach(button=>button.addEventListener('click',()=>{state.asset=button.dataset.dpgScanAsset;state.draft=null;state.selection=null;load();}));
    main.querySelector('[data-dpg-explain-header]')?.addEventListener('click',()=>{if(state.draft){state.selection=state.draft;load();}});
    main.querySelector('[data-dpg-explain-candle]')?.addEventListener('click',()=>{const candles=state.data?.market?.candles||[],intervalMs=INTERVAL_MS[state.interval],selected=state.draft&&state.draft.end-state.draft.start<intervalMs?state.draft:null,last=candles.at?.(-1);if(selected){state.selection=selected;load();return;}if(last&&intervalMs){state.draft={start:last.time,end:last.time+intervalMs-1};state.selection=state.draft;load();}});
    main.querySelector('[data-dpg-mtf-jump]')?.addEventListener('click',()=>main.querySelector('#qelly-decision-mtf')?.scrollIntoView({behavior:'smooth',block:'start'}));
    main.querySelector('[data-dpg-compare-asset]')?.addEventListener('click',()=>{const assetId=canonicalDecisionAsset(state.asset);if(!assetId||typeof navigate!=='function'){toast?.('Asset comparison is unavailable for this Decision context.',{tone:'danger'});return;}navigate('comparison-lab',assetId);});
    main.querySelector('[data-dpg-open-chat]')?.addEventListener('click',()=>{
      const action=state.data?.qellyView?.action||'NO TRADE';
      document.dispatchEvent(new CustomEvent('qelly:open-ai',{detail:{
        mode:'decision',
        asset:state.asset,
        timeframe:state.interval,
        expand:true,
        prompt:'Explain the current '+state.asset+' Decision Intelligence view ('+action+'), including the evidence gate, strongest contradiction, entry/invalidation/targets if any, R:R feasibility, calibration state, historical analog boundary and what would change the view.'
      }}));
    });
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
  async function loadLedger({redraw=true}={}){
    if(!ledgerAuthenticated()){state.ledger=null;state.ledgerError=null;return;}
    if(state.ledgerLoading)return;
    state.ledgerLoading=true;state.ledgerError=null;if(redraw)draw();
    try{state.ledger=await api('/api/v1/decision-ledger?limit=50');}
    catch(error){state.ledger=null;state.ledgerError=error?.message||'Observed setup ledger is unavailable.';}
    finally{state.ledgerLoading=false;if(redraw)draw();}
  }
  async function trackCurrentSetup(){
    if(state.ledgerMutating||!state.data)return;
    state.ledgerMutating=true;state.ledgerError=null;draw();
    try{
      const body={asset:state.asset,interval:state.interval,horizon:state.horizon,rr:state.rr};
      if(state.rr==='custom')body.customRr=state.customRr;
      await api('/api/v1/decision-ledger',{method:'POST',body:JSON.stringify(body)});
      await loadLedger({redraw:false});
      toast?.('Live setup added to the observed outcome ledger.',{tone:'success'});
    }catch(error){state.ledgerError=error?.message||'This setup could not be tracked.';}
    finally{state.ledgerMutating=false;draw();}
  }
  async function observeTrackedSetup(id){
    if(state.ledgerMutating||!id)return;
    state.ledgerMutating=true;state.ledgerError=null;draw();
    try{
      await api('/api/v1/decision-ledger/'+encodeURIComponent(id)+'/observe',{method:'POST',body:'{}'});
      await loadLedger({redraw:false});
      toast?.('Setup outcome re-observed from server-side market evidence.',{tone:'success'});
    }catch(error){state.ledgerError=error?.message||'The setup could not be re-observed.';}
    finally{state.ledgerMutating=false;draw();}
  }
  async function scan(){
    if(state.scanning)return;
    state.scanning=true;state.scanError=null;draw();
    try{
      const params=new URLSearchParams({interval:state.interval,horizon:state.horizon,rr:state.rr});
      if(state.rr==='custom')params.set('customRr',state.customRr);
      if(state.scanFilters.universe==='current')params.set('assets',state.asset);
      for(const key of ['direction','minEvidenceQuality','minCalibratedConfidence','minMtfAgreement','liquidity','volatility','regime','eventRiskTolerance','freshness'])params.set(key,String(state.scanFilters[key]??''));
      params.set('setupFreshness','current');
      state.scan=await api('/api/v1/decision-scan?'+params.toString());
      const eligibleCount=Math.max(0,Number(state.scan?.eligibleCount)||0);
      emitProductEvent('qelly_view_interaction',{route:'decision-provenance',feature:'decision_scan',action:'complete',state:telemetryToken(state.scan?.state||'unavailable')});
      emitProductEvent('qelly_view_interaction',{route:'decision-provenance',feature:'eligible_setup',action:'count',state:eligibleCount>0?'nonzero':'zero',...(eligibleCount>0?{count:Math.min(100,eligibleCount)}:{})});
      const firstEligible=state.scan?.candidates?.find?.(item=>item?.eligible);
      if(firstEligible&&firstEligible.asset&&firstEligible.asset!==state.asset){
        state.asset=firstEligible.asset;state.draft=null;state.selection=null;
      }
    }catch(error){
      state.scan=null;state.scanError=error?.message||'The governed asset scan could not be completed. No substitute candidates were generated.';
      emitRuntimeSignal({feature:'decision_scan',action:'failure',state:'unavailable',surface:'api'});
    }finally{
      state.scanning=false;
      if(state.scan?.candidates?.some?.(item=>item?.eligible))await load();
      else draw();
    }
  }
  async function load(){
    state.loading=true;state.error=null;draw();
    try{
      const range=state.selection?'&selectionStart='+encodeURIComponent(state.selection.start)+'&selectionEnd='+encodeURIComponent(state.selection.end):'';
      const rr='&rr='+encodeURIComponent(state.rr)+(state.rr==='custom'?'&customRr='+encodeURIComponent(state.customRr):'');
      const previous=state.data?.decisionSnapshot||null;
      const next=await api('/api/v1/decision-proven-graph?asset='+encodeURIComponent(state.asset)+'&interval='+encodeURIComponent(state.interval)+'&horizon='+encodeURIComponent(state.horizon)+rr+range);
      state.previousSnapshot=previous&&next?.decisionSnapshot&&previous.asset===next.decisionSnapshot.asset&&previous.interval===next.decisionSnapshot.interval?previous:null;
      state.data=next;
      emitProductEvent('qelly_view_interaction',{route:'decision-provenance',feature:'decision_view',action:'result',state:telemetryToken(next?.qellyView?.action||'unavailable')});
      emitProductEvent('qelly_view_interaction',{route:'decision-provenance',feature:'calibration',action:'state',state:telemetryToken(next?.quant?.calibration?.state||'uncalibrated')});
    }catch(error){
      state.data=null;state.previousSnapshot=null;state.error=error?.message||'Fresh market evidence could not be reached. No substitute data was generated.';
      emitRuntimeSignal({feature:'decision',action:'failure',state:'unavailable',surface:'api'});
    }finally{state.loading=false;draw();if(ledgerAuthenticated()&&!state.ledger&&!state.ledgerLoading)void loadLedger();}
  }
  await load();
}

export const __decisionProvenGraphRouteTest=Object.freeze({CHAT_DECISION_CONTEXT_KEY,DECISION_ASSETS,readChatDecisionContext,normalizeHorizon,validHorizons,telemetryToken,rrTelemetryState,canonicalDecisionAsset});
