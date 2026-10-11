import {isFiniteDecisionEvidence,formatDecisionProbability} from '../decision-numeric-evidence.mjs';
import {adSlot,mountAdSlots} from '../qelly-ad-slot.mjs';
import {DECISION_CONTEXT_KEY as CHAT_DECISION_CONTEXT_KEY,DECISION_ASSETS,consumeDecisionContext as readChatDecisionContext,storeResearchContext} from '../decision-context-bridge.mjs';
import {startDecisionObservation,recordDecisionObservation,recordScannerObservation,recordTargetTouchSample} from '../decision-observability.mjs';
import {evaluateDecisionSlos} from '../decision-slos.mjs';
import {buildDecisionResearchNote,downloadDecisionResearchNote} from '../decision-research-note.mjs';
import {readDecisionAssetPreferences,saveDecisionAssetPreferences,toggleDecisionAssetFavorite,recordDecisionAssetRecent,decisionAssetSearchText} from '../decision-asset-picker.mjs';
import {buildDecisionScenarioUx} from '../decision-scenario-ux.mjs';
import {ensureRouteStylesheet} from '../route-stylesheet-readiness.mjs';
const STYLESHEET=new URL('../qelly-decision-proven-graph.css',import.meta.url).href;
const installStyles=(signal)=>ensureRouteStylesheet(STYLESHEET,{attribute:'data-decision-proven-graph',value:'v2',signal});
const money=(value)=>isFiniteDecisionEvidence(value)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:Number(value)>=100?0:2}).format(value):'Unavailable';
const pct=(value)=>isFiniteDecisionEvidence(value)?Number(value).toFixed(2)+'%':'Unavailable';
const compactMoney=(value)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(Number(value)):'Unavailable';
const compactNumber=(value)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:3}).format(Number(value)):'Unavailable';
const download=(value)=>{const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='qelly-decision-intelligence-'+value.asset.toLowerCase()+'-'+value.interval+'.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),500);};
const INTERVAL_MS=Object.freeze({'1m':60_000,'3m':180_000,'5m':300_000,'15m':900_000,'30m':1_800_000,'1h':3_600_000,'2h':7_200_000,'4h':14_400_000,'1d':86_400_000});
const HORIZON_MS=Object.freeze({'1h':3_600_000,'4h':14_400_000,'12h':43_200_000,'1d':86_400_000,'3d':259_200_000,'7d':604_800_000});
const validHorizons=(interval)=>Object.keys(HORIZON_MS).filter(horizon=>{const bars=Math.ceil(HORIZON_MS[horizon]/INTERVAL_MS[interval]);return bars>=2&&bars<=168;});
const normalizeHorizon=(interval,horizon)=>validHorizons(interval).includes(horizon)?horizon:validHorizons(interval)[0];
const telemetryToken=(value,fallback='unknown')=>String(value??fallback).trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,64)||fallback;
const rrTelemetryState=(value)=>value==='auto'?'auto':value==='custom'?'custom':({'1':'rr_1_1','2':'rr_1_2','3':'rr_1_3','4':'rr_1_4'}[String(value)]||'unknown');
const canonicalDecisionAsset=(value)=>{const symbol=String(value||'').trim().toUpperCase();return DECISION_ASSETS.has(symbol)?'QI-CRYPTO-'+symbol:null;};
const emitProductEvent=(name,properties)=>document.dispatchEvent(new CustomEvent('qelly:product-event',{detail:{name,properties}}));
const emitRuntimeSignal=(detail)=>document.dispatchEvent(new CustomEvent('qelly:runtime-signal',{detail}));
const prefersReducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
const motionBehavior=()=>prefersReducedMotion()?'auto':'smooth';
const displayTime=(value)=>{
  if(value===null||value===undefined||value==='')return 'Time unavailable';
  const numeric=Number(value);
  if(Number.isFinite(numeric)){
    const epochMilliseconds=Math.abs(numeric)<100_000_000_000?numeric*1000:numeric;
    const parsedNumeric=new Date(epochMilliseconds);
    return Number.isNaN(parsedNumeric.getTime())?'Time unavailable':parsedNumeric.toLocaleString();
  }
  const raw=String(value).trim();
  const compact=raw.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/);
  const normalized=compact?`${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}Z`:raw;
  const parsed=new Date(normalized);
  return Number.isNaN(parsed.getTime())?'Time unavailable':parsed.toLocaleString();
};

const CHART_GEOMETRY=Object.freeze({width:1000,height:430,pad:38,split:690});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const candleTime=(candle)=>Number(candle?.time??candle?.t);
const candleValue=(candle,key)=>Number(candle?.[key]??candle?.[key[0]]);
const formatRangeDuration=(milliseconds)=>{
  const totalMinutes=Math.max(0,Math.round(Number(milliseconds||0)/60_000));
  if(totalMinutes<60)return totalMinutes+'m';
  const hours=Math.floor(totalMinutes/60),minutes=totalMinutes%60;
  if(hours<24)return hours+'h'+(minutes?' '+minutes+'m':'');
  const days=Math.floor(hours/24),remainingHours=hours%24;
  return days+'d'+(remainingHours?' '+remainingHours+'h':'');
};
const selectionIndexBounds=(candles,selection,intervalMs)=>{
  if(!selection||!Array.isArray(candles)||!candles.length||!isFiniteDecisionEvidence(intervalMs))return null;
  const start=Number(selection.start),end=Number(selection.end);
  if(!Number.isFinite(start)||!Number.isFinite(end))return null;
  const low=Math.min(start,end),high=Math.max(start,end);
  let first=-1,last=-1;
  for(let index=0;index<candles.length;index++){
    const time=candleTime(candles[index]);
    if(!Number.isFinite(time))continue;
    const candleEnd=time+Number(intervalMs)-1;
    if(candleEnd>=low&&time<=high){
      if(first<0)first=index;
      last=index;
    }
  }
  return first>=0&&last>=first?{startIndex:first,endIndex:last}:null;
};
const buildRangeSelection=(candles,startIndex,endIndex,intervalMs)=>{
  if(!Array.isArray(candles)||!candles.length||!isFiniteDecisionEvidence(intervalMs))return null;
  const a=clamp(Math.min(Number(startIndex),Number(endIndex)),0,candles.length-1);
  const b=clamp(Math.max(Number(startIndex),Number(endIndex)),0,candles.length-1);
  const start=candleTime(candles[a]),last=candleTime(candles[b]);
  if(!Number.isFinite(start)||!Number.isFinite(last))return null;
  const singleEnd=b===a&&isFiniteDecisionEvidence(candles[a]?.time)?candles[a].time+intervalMs-1:null;
  return {start,end:singleEnd??last+Number(intervalMs)-1,startIndex:a,endIndex:b};
};
const rangeSelectionMetrics=(candles,selection,interval)=>{
  const intervalMs=INTERVAL_MS[interval];
  const bounds=selectionIndexBounds(candles,selection,intervalMs);
  if(!bounds)return null;
  const selected=candles.slice(bounds.startIndex,bounds.endIndex+1);
  const first=selected[0],last=selected.at(-1);
  const startPrice=candleValue(first,'open'),endPrice=candleValue(last,'close');
  const highs=selected.map(candle=>candleValue(candle,'high')).filter(Number.isFinite);
  const lows=selected.map(candle=>candleValue(candle,'low')).filter(Number.isFinite);
  const absoluteMove=Number.isFinite(startPrice)&&Number.isFinite(endPrice)?endPrice-startPrice:null;
  const movePct=Number.isFinite(startPrice)&&Number.isFinite(endPrice)&&startPrice!==0?(endPrice/startPrice-1)*100:null;
  const start=candleTime(first),end=candleTime(last)+intervalMs-1;
  return {...bounds,start,end,candles:selected.length,durationMs:end-start+1,timeframe:interval,startPrice,endPrice,absoluteMove,movePct,direction:Number.isFinite(absoluteMove)?absoluteMove>0?'UP':absoluteMove<0?'DOWN':'FLAT':'UNAVAILABLE',high:highs.length?Math.max(...highs):null,low:lows.length?Math.min(...lows):null};
};
const rangeSelectionSummary=(state,data,escapeHtml)=>{
  const selection=state.draft||state.selection;
  const candles=data?.market?.candles||[];
  const intervalMs=INTERVAL_MS[state.interval];
  const metrics=rangeSelectionMetrics(candles,selection,state.interval);
  const total=Math.max(0,candles.length-1);
  const startIndex=metrics?.startIndex??Math.max(0,total-19),endIndex=metrics?.endIndex??total;
  const metric=(label,value)=>'<span><em>'+escapeHtml(label)+'</em><strong>'+escapeHtml(value)+'</strong></span>';
  const number=(value,digits=2)=>isFiniteDecisionEvidence(value)?Number(value).toLocaleString(undefined,{maximumFractionDigits:digits}):'Unavailable';
  const signed=(value,suffix='')=>isFiniteDecisionEvidence(value)?(Number(value)>=0?'+':'')+number(value,2)+suffix:'Unavailable';
  const sliderTime=(index,end=false)=>{
    const time=candleTime(candles[clamp(Number(index),0,total)]);
    return Number.isFinite(time)?displayTime(time+(end&&intervalMs?intervalMs-1:0)):'Time unavailable';
  };
  const spokenSummary=metrics
    ?'Selected range from '+displayTime(metrics.start)+' to '+displayTime(metrics.end)+', '+formatRangeDuration(metrics.durationMs)+', '+metrics.candles+' candles on '+metrics.timeframe+', move '+signed(metrics.movePct,'%')+' '+metrics.direction+', high '+number(metrics.high,6)+', low '+number(metrics.low,6)+'.'
    :'No range selected. Choose Select Range and drag observed candles, or use the Start and End candle keyboard sliders.';
  const modes=[['navigate','Navigate'],['select-range','Select Range'],['select-candle','Select Candle'],['measure-move','Measure Move']];
  return '<section class="q-dpg-range-workbench" aria-label="Chart range selection" aria-describedby="q-dpg-range-instructions"><p id="q-dpg-range-instructions" class="q-dpg-sr-only">Choose an interaction mode. Keyboard users can select the same historical range with the Start candle and End candle sliders.</p><span class="q-dpg-range-live" data-dpg-selection-label aria-hidden="true">'+(metrics?'Range selected':'No range selected')+'</span><span class="q-dpg-sr-only" data-dpg-range-announcement role="status" aria-live="polite" aria-atomic="true">'+escapeHtml(spokenSummary)+'</span>'+
    '<div class="q-dpg-chart-modes" role="toolbar" aria-label="Chart interaction mode">'+modes.map(([id,label])=>'<button type="button" class="q-dpg-mode'+(state.chartMode===id?' is-active':'')+'" data-dpg-chart-mode="'+id+'" aria-pressed="'+(state.chartMode===id?'true':'false')+'">'+label+'</button>').join('')+'</div>'+
    (metrics?'<div class="q-dpg-range-summary" role="group" aria-label="'+escapeHtml(spokenSummary)+'">'+metric('Start',displayTime(metrics.start))+metric('End',displayTime(metrics.end))+metric('Duration',formatRangeDuration(metrics.durationMs))+metric('Candles',String(metrics.candles)+' · '+metrics.timeframe)+metric('Move',signed(metrics.movePct,'%')+' · '+metrics.direction)+metric('Absolute',signed(metrics.absoluteMove))+metric('High',number(metrics.high,6))+metric('Low',number(metrics.low,6))+'</div>':'<div class="q-dpg-range-empty" role="status">Select Range is ready. Drag across observed candles, choose Select Candle, or use the keyboard range controls.</div>')+
    '<div class="q-dpg-range-keyboard" role="group" aria-label="Keyboard range controls"><label><span>Start candle</span><input type="range" min="0" max="'+total+'" value="'+startIndex+'" data-dpg-range-start aria-label="Selected range start candle" aria-valuetext="'+escapeHtml(sliderTime(startIndex,false))+'"></label><label><span>End candle</span><input type="range" min="0" max="'+total+'" value="'+endIndex+'" data-dpg-range-end aria-label="Selected range end candle" aria-valuetext="'+escapeHtml(sliderTime(endIndex,true))+'"></label></div>'+
    '<div class="q-dpg-range-toolbar" role="toolbar" aria-label="Selected range actions"><button class="q-button q-button--primary" type="button" data-dpg-explain '+(metrics?'':'disabled')+'>'+((metrics?.candles||0)===1?'Explain This Candle':'Explain This Move')+'</button><button class="q-button q-button--secondary" type="button" data-dpg-range-action="news" '+(metrics?'':'disabled')+'>News & Events</button><button class="q-button q-button--secondary" type="button" data-dpg-range-action="flow" '+(metrics?'':'disabled')+'>Flow / Participation Evidence</button><button class="q-button q-button--secondary" type="button" data-dpg-range-action="compare" '+(metrics?'':'disabled')+'>Compare Before vs After</button><button class="q-button q-button--secondary" type="button" data-dpg-range-action="replay" '+(metrics?'':'disabled')+'>Replay Move</button><button class="q-button q-button--secondary" type="button" data-dpg-range-action="similar" '+(metrics?'':'disabled')+'>Find Similar History</button><button class="q-button q-button--secondary" type="button" data-dpg-range-action="similar-setup" '+(metrics?'':'disabled')+'>Find current setup under similar conditions</button><button class="q-button q-button--secondary" type="button" data-dpg-range-action="note" '+(metrics?'':'disabled')+'>Create Research Note</button><button class="q-button q-button--secondary" type="button" data-dpg-clear '+(metrics||state.selection?'':'disabled')+'>Clear</button></div></section>';
}

function chart(data,escapeHtml,selection=null,interval=data.interval,chartMode='select-range'){
  const history=data.market.candles,future=data.forecast.fan,projection=data?.nextMoveResearch?.nextCandle?.projection||null;
  const projectedValues=projection?[projection.low,projection.innerLow,projection.median,projection.innerHigh,projection.high].filter(Number.isFinite):[];
  const all=[...history.flatMap(item=>[item.low,item.high]),...future.flatMap(item=>[item.p05,item.p95]),...projectedValues],min=Math.min(...all),max=Math.max(...all),width=CHART_GEOMETRY.width,height=CHART_GEOMETRY.height,pad=CHART_GEOMETRY.pad,split=CHART_GEOMETRY.split;
  const y=(value)=>pad+(max-value)/(max-min||1)*(height-pad*2),hx=(index)=>pad+index/Math.max(1,history.length-1)*(split-pad),fx=(index)=>split+index/Math.max(1,future.length)*(width-split-pad);
  const line=(items,x,get)=>items.map((item,index)=>(index?'L':'M')+x(index).toFixed(1)+','+y(get(item)).toFixed(1)).join(' ');
  const band=(upper,lower)=>line(future,fx,item=>item[upper])+' '+[...future].reverse().map((item,index)=>'L'+fx(future.length-1-index).toFixed(1)+','+y(item[lower]).toFixed(1)).join(' ')+' Z';
  const candleWidth=Math.max(1.2,(split-pad)/history.length*.62),metrics=rangeSelectionMetrics(history,selection,interval);
  const candles=history.map((item,index)=>{const x=hx(index),up=item.close>=item.open,top=y(Math.max(item.open,item.close)),body=Math.max(1.5,Math.abs(y(item.open)-y(item.close))),selected=metrics&&index>=metrics.startIndex&&index<=metrics.endIndex;return '<g data-candle-index="'+index+'" class="q-dpg-candle '+(up?'is-up':'is-down')+(selected?' is-selected':'')+'"><path d="M'+x+','+y(item.high)+'V'+y(item.low)+'"/><rect x="'+(x-candleWidth/2)+'" y="'+top+'" width="'+candleWidth+'" height="'+body+'"/></g>';}).join('');
  const selectedStart=metrics?hx(metrics.startIndex):0,selectedEnd=metrics?hx(metrics.endIndex):0,left=metrics?Math.max(pad,Math.min(selectedStart,selectedEnd)-candleWidth*.8):0,right=metrics?Math.min(split,Math.max(selectedStart,selectedEnd)+candleWidth*.8):0;
  const selectionMarkup='<g data-dpg-selection class="q-dpg-selection" '+(metrics?'':'hidden')+'><rect data-dpg-selection-rect x="'+left+'" y="'+pad+'" width="'+Math.max(0,right-left)+'" height="'+(height-pad*2)+'"/><line data-dpg-selection-start class="q-dpg-selection__boundary" x1="'+selectedStart+'" x2="'+selectedStart+'" y1="'+pad+'" y2="'+(height-pad)+'"/><line data-dpg-selection-end class="q-dpg-selection__boundary" x1="'+selectedEnd+'" x2="'+selectedEnd+'" y1="'+pad+'" y2="'+(height-pad)+'"/><circle data-dpg-selection-start-handle class="q-dpg-selection__handle" cx="'+selectedStart+'" cy="'+(pad+12)+'" r="6"/><circle data-dpg-selection-end-handle class="q-dpg-selection__handle" cx="'+selectedEnd+'" cy="'+(pad+12)+'" r="6"/></g>';
  const projectX=split+34,projectWidth=18;
  const projectedMarkup=projection&&projectedValues.length===5
    ?'<g data-dpg-projected-range class="q-dpg-projected-range" data-projection-state="PROJECTED" aria-label="Projected next-candle range; not observed"><line class="q-dpg-projected-range__outer" x1="'+projectX+'" x2="'+projectX+'" y1="'+y(projection.high)+'" y2="'+y(projection.low)+'"/><rect class="q-dpg-projected-range__inner" x="'+(projectX-projectWidth/2)+'" y="'+y(projection.innerHigh)+'" width="'+projectWidth+'" height="'+Math.max(2,y(projection.innerLow)-y(projection.innerHigh))+'"/><line class="q-dpg-projected-range__median" x1="'+(projectX-projectWidth/2-3)+'" x2="'+(projectX+projectWidth/2+3)+'" y1="'+y(projection.median)+'" y2="'+y(projection.median)+'"/><text class="q-dpg-projected-range__label" x="'+(projectX+13)+'" y="'+Math.max(52,y(projection.high)-7)+'">PROJECTED</text></g>'
    :'';
  return '<svg class="q-dpg-chart" viewBox="0 0 '+width+' '+height+'" role="img" tabindex="0" data-dpg-chart data-count="'+history.length+'" data-mode="'+escapeHtml(chartMode)+'" aria-label="Interactive '+escapeHtml(data.asset)+' chart. Historical candles are observed; future bands and the dashed PROJECTED next-candle range are modelled research, not observed candles."><defs><linearGradient id="dpg95"><stop stop-color="#7d2944" stop-opacity=".38"/><stop offset="1" stop-color="#b34566" stop-opacity=".08"/></linearGradient><linearGradient id="dpg50"><stop stop-color="#d36483" stop-opacity=".5"/><stop offset="1" stop-color="#e69aae" stop-opacity=".16"/></linearGradient></defs><g class="q-dpg-grid"><path d="M38 108H962M38 215H962M38 322H962"/><path d="M'+split+' 38V392"/></g><path class="q-dpg-band q-dpg-band--outer" d="'+band('p95','p05')+'"/><path class="q-dpg-band q-dpg-band--inner" d="'+band('p75','p25')+'"/>'+candles+selectionMarkup+projectedMarkup+'<path class="q-dpg-median" d="M'+split+','+y(data.market.lastPrice)+' '+line(future,fx,item=>item.p50).replace(/^M/,'L')+'"/><circle cx="'+split+'" cy="'+y(data.market.lastPrice)+'" r="6"/><text x="40" y="28">PAST · OBSERVED</text><text x="'+(split+16)+'" y="28">FUTURE · PROJECTED SCENARIOS</text><text x="'+(split-10)+'" y="'+Math.max(55,y(data.market.lastPrice)-12)+'" text-anchor="end">NOW '+money(data.market.lastPrice)+'</text></svg>';
}

const multiTimeframe=(data,escapeHtml)=>{const mtf=data.multiTimeframe,views=mtf?.views||[];if(!views.length)return '<section id="qelly-decision-mtf" class="q-dpg-mtf"><header><div><small>MULTI-TIMEFRAME</small><h2>Cross-horizon confirmation unavailable</h2></div><span>Not inferred</span></header><p>Independent timeframe observations could not be verified, so no agreement claim is shown.</p></section>';return '<section id="qelly-decision-mtf" class="q-dpg-mtf"><header><div><small>MULTI-TIMEFRAME</small><h2>'+escapeHtml(mtf.agreement.direction)+' · '+mtf.agreement.aligned+'/'+mtf.agreement.total+' aligned</h2></div><span>'+escapeHtml(mtf.state)+'</span></header><div>'+views.map(view=>'<article><span>'+escapeHtml(view.interval)+'</span><strong class="q-dpg-mtf__'+view.qellyView.action.toLowerCase().replace(/\s+/g,'-')+'">'+escapeHtml(view.qellyView.action)+'</strong><small>'+escapeHtml(view.marketState.label)+'</small><p>RSI '+view.metrics.rsi14+' · '+Math.round(view.probabilities.bull*100)+'% bull / '+Math.round(view.probabilities.bear*100)+'% bear</p></article>').join('')+'</div><p>Agreement compares independently observed timeframes. Mixed evidence is shown as mixed; it is never forced into a trade call.</p></section>';};

const derivativesContext=(data,escapeHtml)=>{
  const derivatives=data.evidence?.derivatives;
  if(!derivatives||derivatives.state!=='live'){
    return '<section class="q-dpg-derivatives"><header><div><small>DERIVATIVES CONTEXT</small><h2>Funding and open interest unavailable</h2></div><span>Not inferred</span></header><p>'+escapeHtml(derivatives?.message||'Current perpetual-market context could not be verified, so Qelly does not create substitute values.')+'</p><p class="q-dpg-derivatives__limit">Funding history, OI change, basis change, price/OI quadrant and liquidations remain unavailable unless separately verified.</p></section>';
  }
  const pct=(value,digits=4)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?Number(value).toFixed(digits)+'%':'Unavailable';
  const bps=(value,digits=3)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?(Number(value)>=0?'+':'')+Number(value).toFixed(digits)+' bps':'Unavailable';
  const percentile=(value)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?Math.round(Number(value)*100)+'%':'Unavailable';
  const ratio=(value)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?Number(value).toFixed(2)+'x':'Unavailable';
  const price=(value)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?money(Number(value)):'Unavailable';
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
      '<article><span>24h price change</span><strong>'+pct(derivatives.priceChange24hPct,3)+'</strong><small>Current mark vs provider prevDayPx</small></article>'+
      '<article><span>OI change</span><strong>'+escapeHtml(String(derivatives.openInterestChangeState||'UNAVAILABLE'))+'</strong><small>Historical OI not connected</small></article>'+
      '<article><span>Positioning state</span><strong>'+escapeHtml(String(derivatives.positioningState||'UNAVAILABLE').replaceAll('_',' '))+'</strong><small>'+escapeHtml(derivatives.positioning?.reason||'Requires verified price and OI changes')+'</small></article>'+
      '<article><span>24h perp volume</span><strong>'+compactMoney(derivatives.dayNotionalVolumeUsd)+'</strong></article>'+
      '<article><span>OI turnover</span><strong>'+escapeHtml(ratio(derivatives.openInterestTurnover24h))+'</strong><small>24h notional volume / OI notional</small></article>'+
      '<article><span>Mark price</span><strong>'+price(derivatives.markPrice)+'</strong></article>'+
      '<article><span>Oracle price</span><strong>'+price(derivatives.oraclePrice)+'</strong></article>'+
      '<article><span>Mark / oracle basis</span><strong>'+pct(derivatives.markOracleBasisPct)+'</strong><small>'+escapeHtml(String(derivatives.markOracleBasisState||'UNAVAILABLE').replaceAll('_',' '))+'</small></article>'+
      '<article><span>Basis change</span><strong>'+escapeHtml(String(derivatives.markOracleBasisChangeState||'UNAVAILABLE'))+'</strong><small>Historical mark/oracle series not connected</small></article>'+
      '<article><span>Price / OI quadrant</span><strong>'+escapeHtml(String(derivatives.priceOpenInterestQuadrant||'UNAVAILABLE').replaceAll('_',' '))+'</strong><small>Descriptive only · requires verified OI change history</small></article>'+
      '<article><span>Liquidations</span><strong>'+escapeHtml(String(derivatives.liquidationsState||'UNAVAILABLE'))+'</strong><small>Verified liquidation flow not connected</small></article>'+
    '</div>'+
    '<p>'+escapeHtml(derivatives.message)+'</p>'+
    '<p class="q-dpg-derivatives__limit">'+escapeHtml(history.method||'Funding history unavailable.')+' Historical OI change, mark/oracle basis change and liquidation flow are not inferred. LONG BUILD-UP / SHORT BUILD-UP / SHORT COVERING / LONG UNWINDING are shown only when verified price and OI changes both exist; funding or premium never substitutes for OI change. Premium history is not substituted for mark/oracle basis history.</p></section>';
};

const crossAssetContext=(data,escapeHtml)=>{
  const context=data?.evidence?.crossAsset||data?.crossAsset;
  if(!context||context.state!=='available')return '<section class="q-dpg-cross-asset"><header><div><small>CROSS-ASSET</small><h2>Dependence unavailable</h2></div><span>Not inferred</span></header><p>'+escapeHtml(context?.reason||'A same-venue benchmark series is unavailable, so correlation and beta are not inferred.')+'</p></section>';
  const percent=(value)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?(Number(value)>=0?'+':'')+Number(value).toFixed(2)+'%':'Unavailable';
  const number=(value,digits=3)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?Number(value).toFixed(digits):'Unavailable';
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

const calendarReferenceDate=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const date=new Date(value+'T00:00:00.000Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?value:null;
};
const macroContext=(data,escapeHtml)=>{
  const macro=data?.evidence?.macro||data?.macro;
  const state=String(macro?.state||'unavailable').toUpperCase();
  if(!macro||macro.state!=='available')return '<section class="q-dpg-macro"><header><div><small>MACRO CONTEXT</small><h2>'+escapeHtml(String(macro?.level||'UNAVAILABLE'))+'</h2></div><span>'+escapeHtml(state.replaceAll('_',' '))+'</span></header><p>'+escapeHtml(macro?.reason||'A governed macro reference is unavailable, so QELLY does not infer DXY, yields or policy-rate effects.')+'</p><p class="q-dpg-macro__limit">'+escapeHtml(macro?.cadenceBoundary||'Slow reference data is not substituted for current market evidence.')+'</p></section>';
  const fx=(value)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?Number(value).toFixed(4):'Unavailable';
  const unavailable=Array.isArray(macro.unavailableSeries)?macro.unavailableSeries.map(value=>String(value).replaceAll('_',' ')).join(' · '):'DXY · yields · indexes · commodities · policy/economic releases';
  return '<section class="q-dpg-macro"><header><div><small>MACRO CONTEXT · GOVERNED REFERENCE</small><h2>ECB daily FX reference</h2></div><span>NO INTRADAY ELIGIBILITY IMPACT</span></header>'+
    '<div class="q-dpg-macro__grid">'+
      '<article><span>EUR / USD</span><strong>'+fx(macro.fxReference?.eurUsd)+'</strong><small>ECB quote per EUR</small></article>'+
      '<article><span>USD / INR</span><strong>'+fx(macro.fxReference?.usdInr)+'</strong><small>derived from same-day ECB EUR crosses</small></article>'+
      '<article><span>EUR / INR</span><strong>'+fx(macro.fxReference?.eurInr)+'</strong><small>ECB quote per EUR</small></article>'+
      '<article><span>Reference date</span><strong>'+escapeHtml(calendarReferenceDate(macro.referenceDate)||'Date unavailable')+'</strong><small>'+escapeHtml(String(macro.freshness||'daily reference').replaceAll('_',' '))+' · exact publication time unavailable</small></article>'+
      '<article><span>Provider</span><strong>European Central Bank</strong><small>'+escapeHtml(String(macro.quality||'official reference').replaceAll('_',' '))+'</small></article>'+
      '<article><span>Intraday feed</span><strong>NOT CONNECTED</strong><small>reference-only context</small></article>'+
    '</div>'+
    '<p>'+escapeHtml(macro.reason||'')+' '+escapeHtml(macro.methodology||'')+'</p>'+
    '<p class="q-dpg-macro__limit">Unavailable, not inferred: '+escapeHtml(unavailable)+'. '+escapeHtml(macro.cadenceBoundary||'Daily reference data is not substituted for intraday evidence.')+'</p></section>';
};

const marketStructureContext=(data,escapeHtml)=>{
  const structure=data?.quant?.structure;
  if(!structure||structure.state==='UNAVAILABLE')return '<section class="q-dpg-structure"><header><div><small>MARKET STRUCTURE</small><h2>Structure unavailable</h2></div><span>Not inferred</span></header><p>There are not enough verified candles to classify swing structure.</p></section>';
  const price=(value)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?money(Number(value)):'Unavailable';
  const pctValue=(value)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?Number(value).toFixed(2)+'%':'Unavailable';
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
      '<article><span>Range position</span><strong>'+(isFiniteDecisionEvidence(structure.rangePosition)?(Number(structure.rangePosition)*100).toFixed(0)+'%':'Unavailable')+'</strong><small>'+price(structure.rangeLow)+' → '+price(structure.rangeHigh)+'</small></article>'+
      '<article><span>Structural strength</span><strong>'+escapeHtml(String(structure.strengthState||'UNAVAILABLE'))+'</strong><small>Score '+escapeHtml(String(structure.strengthScore??'—'))+' / 9</small></article>'+
      '<article><span>Failed breakout</span><strong>'+escapeHtml(String(structure.failedBreakout||'NONE').replaceAll('_',' '))+'</strong><small>Close returned through prior range boundary</small></article>'+
    '</div>'+
    '<p>'+escapeHtml(String(swingCount('highs')))+' recent confirmed swing highs · '+escapeHtml(String(swingCount('lows')))+' recent confirmed swing lows. '+escapeHtml(structure.methodology||'Structure informs eligibility, entry, invalidation and target feasibility.')+'</p></section>';
};

const liquidityContext=(data,escapeHtml)=>{
  const liquidity=data?.evidence?.liquidity||data?.liquidity;
  if(!liquidity||liquidity.state!=='live')return '<section class="q-dpg-liquidity"><header><div><small>LIQUIDITY / MICROSTRUCTURE</small><h2>Order-book context unavailable</h2></div><span>Not inferred</span></header><p>'+escapeHtml(liquidity?.reason||'A verified two-sided L2 snapshot is unavailable, so spread and book imbalance are not inferred.')+'</p><p class="q-dpg-liquidity__limit">Trade imbalance, aggressive flow, volume delta, CVD, liquidation flow and historical book depth remain unavailable unless separately sourced.</p></section>';
  const price=(value)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?money(Number(value)):'Unavailable';
  const bps=(value)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?Number(value).toFixed(2)+' bps':'Unavailable';
  const imbalance=(value)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?(Number(value)*100).toFixed(1)+'%':'Unavailable';
  const depth=(bid,ask)=>compactMoney(bid)+' / '+compactMoney(ask);
  const band=(value)=>isFiniteDecisionEvidence(value?.bps)?escapeHtml(String(value.bps))+' bps · '+escapeHtml(compactMoney(value.bidUsd))+' / '+escapeHtml(compactMoney(value.askUsd))+' · '+escapeHtml(String(value.coverage||'UNAVAILABLE').replaceAll('_',' ')):'Unavailable';
  const bands=Array.isArray(liquidity.visibleDepthBands)?liquidity.visibleDepthBands:[];
  const band10=bands.find(item=>Number(item?.bps)===10);
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
      '<article><span>Top-1 concentration</span><strong>'+(isFiniteDecisionEvidence(liquidity.depthConcentrationTop1)?(Number(liquidity.depthConcentrationTop1)*100).toFixed(1)+'%':'Unavailable')+'</strong><small>Displayed top level / top-10 depth</small></article>'+
      '<article><span>Top-5 concentration</span><strong>'+(isFiniteDecisionEvidence(liquidity.depthConcentrationTop5)?(Number(liquidity.depthConcentrationTop5)*100).toFixed(1)+'%':'Unavailable')+'</strong><small>First 5 displayed levels / top-10 depth</small></article>'+
      '<article><span>Visible book coverage</span><strong>'+escapeHtml(bps(liquidity.visibleBidCoverageBps))+' / '+escapeHtml(bps(liquidity.visibleAskCoverageBps))+'</strong><small>Bid / ask distance from mid across returned levels</small></article>'+
      '<article><span>Largest visible level gap</span><strong>'+escapeHtml(bps(liquidity.maxBidLevelGapBps))+' / '+escapeHtml(bps(liquidity.maxAskLevelGapBps))+'</strong><small>Bid / ask adjacent-level gap; snapshot only</small></article>'+
      '<article><span>Visible 10 bps depth B / A</span><strong>'+band(band10)+'</strong><small>Lower bound if returned book does not span the full band</small></article>'+
      '<article><span>Liquidity vacuum</span><strong>'+escapeHtml(String(liquidity.liquidityVacuumState||'UNAVAILABLE_FROM_SINGLE_SNAPSHOT').replaceAll('_',' '))+'</strong><small>Persistent vacuum is not inferred from one book snapshot</small></article>'+
      '<article><span>Unavailable flow/history</span><strong>NOT INFERRED</strong><small>CVD · aggressor flow · spread percentile · book stability · liquidations</small></article>'+
    '</div>'+
    '<p>'+escapeHtml(liquidity.method||'Current verified order-book snapshot.')+'</p><p class="q-dpg-liquidity__limit">Point-in-time marketability context only. Displayed depth can change rapidly and is not evidence of whales, institutions or smart money. Visible bps-band depth can be a lower bound when the returned book does not cover the full band. Persistent liquidity vacuum, spread percentile, top-of-book stability, order-book volatility, CVD, aggressive trade flow, historical depth and liquidation flow are not inferred.</p></section>';
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

const newsResearchContext=(data,escapeHtml)=>{
  const news=data?.evidence?.news;
  if(!news)return '';
  const state=String(news.state||'unavailable').toUpperCase();
  const clustering=news.clustering||{};
  const clusters=Array.isArray(news.clusters)?news.clusters:[];
  if(state==='PENDING'&&!clusters.length)return '<section class="q-dpg-news"><header><div><small>NEWS CONTEXT · POST-DECISION</small><h2>Context enrichment pending</h2></div><span>NO ELIGIBILITY IMPACT</span></header><p>'+escapeHtml(news.boundary||'Full contextual news is deferred and cannot change the current Decision snapshot.')+'</p></section>';
  if(!clusters.length)return '<section class="q-dpg-news"><header><div><small>NEWS CONTEXT · POST-DECISION</small><h2>'+escapeHtml(state.replaceAll('_',' '))+'</h2></div><span>CONTEXT ONLY</span></header><p>'+escapeHtml(news.boundary||'No clustered headline context is available. No news impact is inferred.')+'</p></section>';
  const threshold=isFiniteDecisionEvidence(clustering.similarityThreshold)?Math.round(Number(clustering.similarityThreshold)*100)+'%':'Unavailable';
  const cards=clusters.slice(0,5).map(cluster=>{
    const rep=cluster.representative||{};
    const topics=Array.isArray(cluster.topicHints)&&cluster.topicHints.length?cluster.topicHints.slice(0,4).map(value=>String(value).replaceAll('_',' ')).join(' · '):'No keyword topic hint';
    const similarity=isFiniteDecisionEvidence(cluster.meanTitleSimilarity)?Math.round(Number(cluster.meanTitleSimilarity)*100)+'%':'Unavailable';
    return '<article><header><span>'+escapeHtml(String(cluster.relevanceState||'QUERY_CONTEXT_ONLY').replaceAll('_',' '))+'</span><strong>'+escapeHtml(String(cluster.articleCount??1))+' report'+(Number(cluster.articleCount)===1?'':'s')+'</strong></header><h3>'+(rep.url?'<a href="'+escapeHtml(rep.url)+'" target="_blank" rel="noopener">'+escapeHtml(rep.title||'Headline')+'</a>':escapeHtml(rep.title||'Headline'))+'</h3><p>'+escapeHtml(rep.source||'Source unavailable')+(rep.publishedAt?' · '+escapeHtml(displayTime(rep.publishedAt)):'')+'</p><small>'+escapeHtml(topics)+' · '+escapeHtml(String(cluster.sourceCount??0))+' source'+(Number(cluster.sourceCount)===1?'':'s')+' · mean lexical similarity '+escapeHtml(similarity)+'</small></article>';
  }).join('');
  return '<section class="q-dpg-news"><header><div><small>NEWS CONTEXT · DEDUPLICATED VIEW</small><h2>'+escapeHtml(String(clustering.clusterCount??clusters.length))+' clusters from '+escapeHtml(String(clustering.articleCount??0))+' reports</h2></div><span>NO ELIGIBILITY IMPACT</span></header><div class="q-dpg-news__meta"><span><em>Duplicate reports</em><strong>'+escapeHtml(String(clustering.duplicateCount??0))+'</strong></span><span><em>Lexical threshold</em><strong>'+escapeHtml(threshold)+'</strong></span><span><em>Provider state</em><strong>'+escapeHtml(state.replaceAll('_',' '))+'</strong></span></div><div class="q-dpg-news__grid">'+cards+'</div><p>'+escapeHtml(clustering.method||'Deterministic headline clustering.')+'</p><p class="q-dpg-news__limit">'+escapeHtml(clustering.boundary||'Headline clusters are contextual audit metadata only and have no eligibility impact.')+'</p></section>';
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
  const netRr=(item)=>isFiniteDecisionEvidence(item?.netRiskReward)?'Net 1:'+Number(item.netRiskReward).toFixed(2):'Net R:R unavailable';
  const matrixMarkup=matrix.length?matrix.map(item=>
    '<article class="q-dpg-rr-card q-dpg-rr-card--'+escapeHtml(String(item.feasibility||'unavailable').toLowerCase().replace(/\s+/g,'-'))+'">'+
      '<span>'+escapeHtml(item.label)+'</span><strong>'+money(item.target)+'</strong><small>'+escapeHtml(item.feasibility)+'</small>'+
      '<p>'+escapeHtml(item.feasibilityReason)+'</p>'+
      (isFiniteDecisionEvidence(item.structuralBarrier)?'<em>Barrier '+money(item.structuralBarrier)+(isFiniteDecisionEvidence(item.structuralBarrierRr)?' · 1:'+escapeHtml(String(item.structuralBarrierRr)):'')+'</em>':'')+
      '<em>'+escapeHtml(netRr(item))+' · '+escapeHtml(String(item.costState||'UNAVAILABLE'))+'</em>'+
      '<em>Target-touch probability: uncalibrated</em>'+
    '</article>'
  ).join(''):'<p class="q-dpg-no-levels">No R:R matrix is available because the current evidence gate does not support a directional setup.</p>';
  const structuralMarkup=structuralTargets.length?'<div class="q-dpg-structural-targets"><strong>Structural alternative</strong>'+structuralTargets.map(item=>'<span><em>'+escapeHtml(item.label)+'</em><b>'+money(item.target)+'</b><small>'+escapeHtml(item.feasibility)+' · '+escapeHtml(item.feasibilityReason)+'</small></span>').join('')+'</div>':'';
  const invalidation=trade.invalidation||{};
  const invalidationOrder=[['Price',invalidation.price],['Structure',invalidation.structural],['Evidence',invalidation.evidence],['Time',invalidation.time],['Event',invalidation.event],['Regime',invalidation.regime],['Liquidity',invalidation.liquidity]];
  const invalidationMarkup=trade.entry?'<section class="q-dpg-invalidation"><header><div><small>INVALIDATION LAYERS</small><h3>What cancels or weakens this setup</h3></div><span>Price stop ≠ full thesis invalidation</span></header><div>'+invalidationOrder.map(([label,item])=>'<article><span>'+label+'</span><strong>'+escapeHtml(String(item?.state||'UNAVAILABLE').replaceAll('_',' '))+'</strong>'+(isFiniteDecisionEvidence(item?.price)?'<b>'+money(item.price)+'</b>':'')+(item?.at?'<b>'+escapeHtml(displayTime(item.at))+'</b>':'')+'<p>'+escapeHtml(item?.condition||'No verified condition is available.')+'</p></article>').join('')+'</div></section>':'';
  const targetMarkup=targets.length?'<div class="q-dpg-target-ladder"><strong>Feasible target ladder</strong><div>'+targets.map(item=>'<span><em>T'+escapeHtml(String(item.rank))+' · '+escapeHtml(item.label)+'</em><b>'+money(item.price)+'</b><small>'+escapeHtml(item.source||'MODEL')+' · '+escapeHtml(item.feasibility)+'</small></span>').join('')+'</div></div>':'';
  return '<section class="q-dpg-trade-research"><header><div><small>CURRENT SETUP · RESEARCH ONLY</small><h2>'+title+'</h2><p>'+escapeHtml(trade.reason)+'</p></div><span class="q-status q-status--'+status+'">'+escapeHtml(lifecycleState)+'</span></header>'+
    (trade.entry?'<div class="q-dpg-trade-summary"><article><span>Entry state</span><strong>'+escapeHtml(trade.entry.method)+'</strong><small>'+money(trade.entry.preferred)+' · '+money(trade.entry.zone[0])+' – '+money(trade.entry.zone[1])+'</small></article><article><span>Price stop</span><strong>'+money(trade.stop.price)+'</strong><small>'+escapeHtml(String(trade.stop.distancePct??'—'))+'% from price · '+escapeHtml(trade.stop.reason||'Risk boundary')+'</small></article><article><span>Selected R:R</span><strong>'+(selected?escapeHtml(selected.label):'None')+'</strong><small>'+(selected?escapeHtml(selected.feasibility)+' · '+escapeHtml(netRr(selected)):'Not supported')+'</small></article><article><span>Setup expiry</span><strong>'+(trade.expiryAt?escapeHtml(displayTime(trade.expiryAt)):'Unavailable')+'</strong><small>'+(isFiniteDecisionEvidence(trade.expiryBars)?escapeHtml(String(trade.expiryBars))+' bars · ':'')+'reassess after expiry or evidence change</small></article></div>':'')+
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
  const agreement=isFiniteDecisionEvidence(gate.timeframeAgreement)?Math.round(Number(gate.timeframeAgreement)*100)+'%':'Unavailable';
  const edge=isFiniteDecisionEvidence(scenario.gap)?Math.round(Number(scenario.gap)*100)+' pts':'Unavailable';
  const risk=view.riskState?.label||'Unknown';
  const contradictions=Array.isArray(view.contradictions)?view.contradictions:[];
  const weights=gate.confidenceWeights||{};
  const component=(label,key,score,detail='')=>'<article><span>'+escapeHtml(label)+'</span><strong>'+(isFiniteDecisionEvidence(score)?Math.round(Number(score)*100)+'%':'Unavailable')+'</strong><small>'+(isFiniteDecisionEvidence(weights[key])?Math.round(Number(weights[key])*100)+'% weight':'weight unavailable')+(detail?' · '+escapeHtml(detail):'')+'</small></article>';
  const confidenceAudit=
    component('Freshness','freshness',gate.freshness)+
    component('History depth','sampleDepth',gate.sampleDepth)+
    component('Scenario separation','scenarioSeparation',gate.scenarioSeparation)+
    component('MTF evidence','timeframeEvidence',gate.timeframeEvidence,(isFiniteDecisionEvidence(gate.timeframeAgreement)&&isFiniteDecisionEvidence(gate.timeframeCoverage))?'agreement '+Math.round(Number(gate.timeframeAgreement)*100)+'% × coverage '+Math.round(Number(gate.timeframeCoverage)*100)+'%':'');
  const preliminary=isFiniteDecisionEvidence(gate.preliminaryModelConfidence)?Math.round(Number(gate.preliminaryModelConfidence)*100)+'%':'Unavailable';
  return '<details class="q-dpg-confidence-audit"><summary>Evidence confidence diagnostics</summary><div class="q-dpg-calibration"><article><span>Scenario edge</span><strong>'+escapeHtml(edge)+'</strong><small>'+escapeHtml(String(scenario.leading||'BALANCED'))+'</small></article><article><span>Timeframe agreement</span><strong>'+escapeHtml(agreement)+'</strong><small>'+escapeHtml(String(gate.timeframeAligned??0)+'/'+String(gate.timeframeTotal??0)+' observed')+'</small></article><article><span>Risk state</span><strong>'+escapeHtml(risk)+'</strong><small>ATR '+escapeHtml(String(view.riskState?.atrPct??'—'))+'%</small></article><article><span>Signal gate</span><strong>'+(gate.directionalEligible?'CLEARED':'NOT CLEARED')+'</strong><small>Base view '+escapeHtml(String(gate.baseAction||view.action))+'</small></article>'+confidenceAudit+'<article><span>Preliminary model confidence</span><strong>'+escapeHtml(preliminary)+'</strong><small>'+((gate.preliminaryModelConfidenceReused===false)?'AUDIT ONLY · NOT REUSED':'reuse state unavailable')+'</small></article></div>'+(contradictions.length?'<div class="q-dpg-contradictions"><strong>Conflicting evidence</strong><ul>'+contradictions.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul></div>':'')+'<p class="q-dpg-confidence-note">Evidence confidence is one weighted decomposition. Freshness, history depth, scenario separation and coverage-adjusted MTF agreement each enter once. Preliminary model confidence is audit-only and not reused. This is not a success probability.</p></details>';
};

const setupDiscoveryControlsMarkup=(state,escapeHtml)=>{
  const filters=state.scanFilters||{};
  const active=(key,value)=>String(filters[key]??'')===String(value)?' is-active':'';
  const pressed=(key,value)=>String(String(filters[key]??'')===String(value));
  const ranking=String(filters.ranking||'highest_quality');
  const rankingLabel=ranking==='lowest_event_risk'?'Lowest Event Risk':ranking==='closest_candidate'?'Closest Candidate':ranking==='fastest_setup'?'Fastest Setup':ranking==='lowest_risk'?'Lowest Risk':'Highest Quality';
  const modeLabel=String(filters.mode||'validated')==='aggressive'?'Aggressive Discovery':'Validated Setup';
  const scopeLabel=String(filters.universe||'all')==='current'?'Current Asset':'All Markets';
  const directionLabel=String(filters.direction||'any')==='long'?'Long':String(filters.direction||'any')==='short'?'Short':'Long + Short';
  const rrLabel=state.rr==='auto'?'Auto':state.rr==='custom'?'Custom '+state.customRr+':1':'1:'+state.rr;
  return '<section class="q-dpg-setup-finder" data-dpg-setup-finder aria-label="Find Setup Now controls">'+
    '<header><div><small>FIND SETUP NOW</small><h2>'+escapeHtml(modeLabel)+'</h2><p>Search only the provider-backed Decision universe. Aggressive Discovery broadens the search; it never weakens hard truthfulness gates.</p></div><button type="button" class="q-button q-button--primary" data-dpg-scan '+(state.scanning?'disabled':'')+'>'+(state.scanning?'Searching…':'Find Setup Now')+'</button></header>'+
    '<div class="q-dpg-setup-finder__grid">'+
      '<fieldset><legend>Discovery mode</legend><div class="q-dpg-segmented"><button type="button" data-dpg-scan-mode="validated" class="'+active('mode','validated').trim()+'" aria-pressed="'+pressed('mode','validated')+'">Validated Setup</button><button type="button" data-dpg-scan-mode="aggressive" class="'+active('mode','aggressive').trim()+'" aria-pressed="'+pressed('mode','aggressive')+'">Aggressive Discovery</button></div></fieldset>'+
      '<fieldset><legend>Market scope</legend><div class="q-dpg-segmented"><button type="button" data-dpg-scan-universe="all" class="'+active('universe','all').trim()+'" aria-pressed="'+pressed('universe','all')+'">All Markets</button><button type="button" data-dpg-scan-universe="current" class="'+active('universe','current').trim()+'" aria-pressed="'+pressed('universe','current')+'">Current Asset</button></div></fieldset>'+
      '<fieldset><legend>Direction</legend><div class="q-dpg-segmented"><button type="button" data-dpg-scan-direction="any" class="'+active('direction','any').trim()+'" aria-pressed="'+pressed('direction','any')+'">Long + Short</button><button type="button" data-dpg-scan-direction="long" class="'+active('direction','long').trim()+'" aria-pressed="'+pressed('direction','long')+'">Long</button><button type="button" data-dpg-scan-direction="short" class="'+active('direction','short').trim()+'" aria-pressed="'+pressed('direction','short')+'">Short</button></div></fieldset>'+
      '<label><span>Ranking preference</span><select data-dpg-scan-ranking><option value="highest_quality" '+(ranking==='highest_quality'?'selected':'')+'>Highest Quality</option><option value="lowest_event_risk" '+(ranking==='lowest_event_risk'?'selected':'')+'>Lowest Event Risk</option><option value="fastest_setup" '+(ranking==='fastest_setup'?'selected':'')+'>Fastest Setup</option><option value="lowest_risk" '+(ranking==='lowest_risk'?'selected':'')+'>Lowest Risk</option><option value="closest_candidate" '+(ranking==='closest_candidate'?'selected':'')+'>Closest Candidate</option><option value="highest_calibrated_probability" disabled>Highest Calibrated Probability — unavailable</option></select><small>'+escapeHtml(rankingLabel)+' · '+escapeHtml(scopeLabel)+' · '+escapeHtml(directionLabel)+' · R:R '+escapeHtml(rrLabel)+'</small></label>'+
    '</div>'+
    '<p class="q-dpg-setup-finder__probability-boundary"><strong>Highest Calibrated Probability:</strong> unavailable until QELLY has a genuine calibrated target-touch probability for scanner candidates. Evidence confidence is never substituted.</p>'+ 
    '<p class="q-dpg-setup-finder__boundary"><strong>Hard gates remain hard:</strong> provider failure, stale/degraded core data, calibration failure, missing entry/stop structure, invalid R:R structure, expired entry, and verified extreme event risk cannot be bypassed. If none validate, QELLY returns Closest Candidate — Not Yet Validated.</p>'+
  '</section>';
};

const scannerFiltersMarkup=(state,escapeHtml)=>{
  const filters=state.scanFilters||{};
  const selected=(key,value)=>String(filters[key]??'')===String(value)?' selected':'';
  const options=(key,items)=>items.map(([value,label])=>'<option value="'+escapeHtml(value)+'"'+selected(key,value)+'>'+escapeHtml(label)+'</option>').join('');
  return '<details class="q-dpg-scan-filters"><summary>Advanced setup filters <span>evidence-gated</span></summary><div>'+
    '<label><span>Universe</span><select data-dpg-scan-filter="universe">'+options('universe',[['all','All Markets'],['current','Current Asset']])+'</select></label>'+
    '<label><span>Direction</span><select data-dpg-scan-filter="direction">'+options('direction',[['any','Any'],['long','Long'],['short','Short']])+'</select></label>'+
    '<label><span>Min evidence</span><select data-dpg-scan-filter="minEvidenceQuality">'+options('minEvidenceQuality',[['0','Any'],['0.5','50%'],['0.65','65%'],['0.75','75%'],['0.85','85%']])+'</select></label>'+
    '<label><span>Min calibrated confidence</span><small>Min calibration-gated evidence; evidence quality only, not success probability.</small><select data-dpg-scan-filter="minCalibratedConfidence">'+options('minCalibratedConfidence',[['0','Any'],['0.5','50%'],['0.65','65%'],['0.75','75%']])+'</select></label>'+
    '<label><span>Min MTF agreement</span><select data-dpg-scan-filter="minMtfAgreement">'+options('minMtfAgreement',[['0','Any'],['0.5','50%'],['0.75','75%'],['1','100%']])+'</select></label>'+
    '<label><span>Liquidity</span><select data-dpg-scan-filter="liquidity">'+options('liquidity',[['any','Any'],['live','Live L2 required'],['tight','Tight spread required']])+'</select></label>'+
    '<label><span>Volatility</span><select data-dpg-scan-filter="volatility">'+options('volatility',[['any','Any'],['low','Low'],['normal','Normal'],['elevated','Elevated'],['high','High']])+'</select></label>'+
    '<label><span>Regime</span><select data-dpg-scan-filter="regime">'+options('regime',[['any','Any'],['trending','Trending'],['ranging','Ranging'],['transition','Transition'],['high_volatility','High volatility']])+'</select></label>'+
    '<label><span>Event-risk tolerance</span><select data-dpg-scan-filter="eventRiskTolerance">'+options('eventRiskTolerance',[['any','Any / unavailable allowed'],['low','Low only'],['medium','Up to medium'],['high','Up to high']])+'</select></label>'+
    '<label><span>Data freshness</span><select data-dpg-scan-filter="freshness">'+options('freshness',[['live_or_delayed','Live or delayed'],['live','Live only'],['any','Any verified state']])+'</select></label>'+
  '</div><p>Strict filters fail closed when required evidence is unavailable. They never force a trade.</p></details>';
};

const scannerMarkup=(scan,{scanning=false,error=null,escapeHtml,mode='validated',ranking='highest_quality'})=>{
  if(scanning)return '<section class="q-dpg-scanner q-dpg-scanner--loading" role="status"><span class="q-spinner"></span><div><small>FIND SETUP NOW · '+escapeHtml(String(mode).toUpperCase().replaceAll('_',' '))+'</small><h2>Searching verified market evidence</h2><p>Applying the same Decision, calibration, structure, liquidity, event-risk and R:R gates with bounded concurrency.</p></div></section>';
  if(error)return '<section class="q-dpg-scanner q-dpg-scanner--error" role="alert"><header><div><small>FIND SETUP NOW · '+escapeHtml(String(mode).toUpperCase().replaceAll('_',' '))+'</small><h2>Setup search unavailable</h2></div><button class="q-button q-button--secondary" data-dpg-scan>Retry search</button></header><p>'+escapeHtml(error)+'</p></section>';
  if(!scan)return '';
  const candidates=Array.isArray(scan.candidates)?scan.candidates:[];
  const eligible=Number(scan.eligibleCount)||0;
  const conditional=Number(scan.conditionalCount)||0;
  const stateLabel=String(scan.state||'NO_ELIGIBLE_SETUP').replaceAll('_',' ');
  const searchPlan=scan.searchPlan||{};
  const closest=scan.closestCandidate||null;
  const closestMarkup=closest?'<article class="q-dpg-closest-candidate" data-dpg-closest-candidate><header><div><small>BEST AVAILABLE CANDIDATE · CLOSEST CANDIDATE · NOT YET VALIDATED</small><h3>'+escapeHtml(String(closest.asset||'—'))+' · '+escapeHtml(String(closest.interval||scan.interval||'—'))+' · '+escapeHtml(String(closest.direction||'NO TRADE'))+'</h3></div><span>RESEARCH ONLY</span></header><div><span><em>Possible trigger</em><strong>'+escapeHtml(String(closest.possibleTrigger||'Unavailable'))+'</strong></span><span><em>Probability state</em><strong>'+escapeHtml(String(closest.probabilityState||'UNCALIBRATED').replaceAll('_',' '))+'</strong></span><span><em>Event risk</em><strong>'+escapeHtml(String(closest.eventRisk?.level||'UNAVAILABLE'))+'</strong></span><span><em>Research priority</em><strong>'+escapeHtml(closest.researchPriority==null?'—':String(closest.researchPriority))+'</strong><small>not a win probability</small></span></div><p><strong>Missing conditions:</strong> '+escapeHtml((closest.missingConditions||[]).map(item=>String(item).replaceAll('_',' ')).join(' · ')||'No missing-condition detail supplied.')+'</p>'+(Array.isArray(closest.whatMustHappen)&&closest.whatMustHappen.length?'<ul>'+closest.whatMustHappen.slice(0,6).map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul>':'')+(closest.contradiction?'<p><strong>Contradiction:</strong> '+escapeHtml(String(closest.contradiction))+'</p>':'')+'<footer><span>'+escapeHtml(closest.boundary||'This candidate is not validated.')+'</span><button type="button" class="q-button q-button--secondary" data-dpg-scan-asset="'+escapeHtml(String(closest.asset||''))+'" data-dpg-scan-interval="'+escapeHtml(String(closest.interval||scan.interval||''))+'">Inspect candidate</button></footer></article>':'';
  const comparisonRows=candidates.slice(0,3).map((item,index)=>{
    const calibratedProbability=isFiniteDecisionEvidence(item?.trade?.targetTouchProbability)?Math.round(Number(item.trade.targetTouchProbability)*100)+'%':'UNCALIBRATED';
    const dataQuality=isFiniteDecisionEvidence(item?.evidence?.dataQualityScore)?Math.round(Number(item.evidence.dataQualityScore)*100)+'%':String(item?.evidence?.dataQualityState||'UNAVAILABLE').replaceAll('_',' ');
    return '<tr><td>#'+(index+1)+' · '+escapeHtml(String(item.asset||'—'))+'</td><td>'+escapeHtml(String(item.action||'NO TRADE'))+'</td><td>'+escapeHtml(String(item.trade?.rr||'—'))+'</td><td>'+escapeHtml(calibratedProbability)+'</td><td>'+escapeHtml(dataQuality)+'</td><td>'+escapeHtml(String(item.eventRisk?.level||'UNAVAILABLE'))+'</td><td>'+escapeHtml(String(item.interval||scan.interval||'—'))+'</td><td>'+escapeHtml(String(item.state||'UNAVAILABLE').replaceAll('_',' '))+'</td></tr>';
  }).join('');
  const comparisonMarkup=comparisonRows?'<details class="q-dpg-setup-comparison"><summary>Compare top 3 setup candidates</summary><div class="q-dpg-table-scroll"><table><thead><tr><th>Asset</th><th>Direction</th><th>R:R</th><th>Calibrated probability</th><th>Data quality</th><th>Event risk</th><th>Timeframe</th><th>Status</th></tr></thead><tbody>'+comparisonRows+'</tbody></table></div><p>Unavailable probability remains UNCALIBRATED. Evidence-triage confidence is not substituted as a win rate or target-touch probability.</p></details>':'';
  const rows=candidates.map((item,index)=>{
    const trade=item.trade||{},evidence=item.evidence||{},market=item.market||{};
    const tone=item.eligible?'positive':item.action==='SELL'?'negative':item.conditional?'warning':'muted';
    const score=isFiniteDecisionEvidence(item.researchPriority)?Number(item.researchPriority).toFixed(1):'—';
    const rr=trade.rr||'—';
    const calibration=evidence.calibrationState||'UNCALIBRATED';
    const failures=Array.isArray(item.filterFailures)?item.filterFailures:[];
    return '<button class="q-dpg-scan-row q-dpg-scan-row--'+tone+'" data-dpg-scan-asset="'+escapeHtml(item.asset)+'" type="button">'+
      '<span class="q-dpg-scan-rank">'+(index+1)+'</span>'+
      '<span class="q-dpg-scan-asset"><strong>'+escapeHtml(item.asset)+'</strong><small>'+escapeHtml(String(item.interval||scan.interval||'—'))+' · '+escapeHtml(String(market.regime||'UNAVAILABLE'))+' · '+escapeHtml(String(market.volatilityRegime||'UNKNOWN'))+'</small><em>'+escapeHtml(String(item.state||'WAIT').replaceAll('_',' '))+'</em></span>'+
      '<span><em>View</em><strong>'+escapeHtml(item.action)+'</strong></span>'+
      '<span><em>R:R</em><strong>'+escapeHtml(rr)+'</strong><small>'+escapeHtml(String(trade.feasibility||trade.status||'NO_TRADE'))+'</small></span>'+
      '<span><em>Evidence triage</em><strong>'+escapeHtml(score)+'</strong><small>not a win probability</small></span>'+
      '<span><em>Calibration</em><strong>'+escapeHtml(calibration)+'</strong><small>'+(evidence.calibrationGatedEvidenceConfidence==null?'gated evidence unavailable':escapeHtml(String(Math.round(Number(evidence.calibrationGatedEvidenceConfidence)*100)))+'% gated evidence conf')+'</small></span>'+
      '<span class="q-dpg-scan-open">'+(item.eligible?'Open validated setup':item.conditional?'Inspect condition':'Inspect')+' →</span>'+
      (failures.length?'<small class="q-dpg-scan-failures">'+escapeHtml(failures.slice(0,3).join(' · ').replaceAll('_',' '))+'</small>':'')+
    '</button>';
  }).join('');
  return '<section class="q-dpg-scanner"><header><div><small>FIND SETUP NOW · '+escapeHtml(String(scan.mode||mode).toUpperCase().replaceAll('_',' '))+'</small><h2>'+escapeHtml(stateLabel)+'</h2><p>'+escapeHtml(String(scan.availableCount||0))+' verified · '+escapeHtml(String(scan.unavailableCount||0))+' unavailable · '+escapeHtml(String(eligible))+' valid · '+escapeHtml(String(conditional))+' conditional · '+escapeHtml(String(scan.interval||''))+' / '+escapeHtml(String(scan.horizon||''))+'</p></div><button class="q-button q-button--secondary" data-dpg-scan>Search again</button></header>'+
    '<div class="q-dpg-scan-plan"><span><em>Scope</em><strong>'+escapeHtml(String(searchPlan.scope||'ALL_SUPPORTED_MARKETS').replaceAll('_',' '))+'</strong></span><span><em>Mode</em><strong>'+escapeHtml(String(scan.mode||mode).replaceAll('_',' '))+'</strong></span><span><em>Ranking</em><strong>'+escapeHtml(String(scan.ranking||ranking).replaceAll('_',' '))+'</strong></span><span><em>Timeframes searched</em><strong>'+escapeHtml((searchPlan.intervals||[scan.interval]).join(' · '))+'</strong></span><span><em>R:R searched</em><strong>'+escapeHtml((searchPlan.riskRewards||[]).join(' · ')||String(scan.riskReward?.mode||'auto'))+'</strong></span></div>'+
    '<div class="q-dpg-scan-boundary"><strong>Research boundary</strong><span>'+escapeHtml(searchPlan.boundary||scan.eventRisk?.reason||'Aggressive Discovery never fabricates a valid setup.')+'</span></div>'+
    closestMarkup+comparisonMarkup+
    '<div class="q-dpg-scan-list">'+(rows||'<p class="q-dpg-no-levels">No verified candidates were returned.</p>')+'</div>'+
    '<p class="q-dpg-scan-note">Validated Setup requires every configured gate. Aggressive Discovery may relax only noncritical preferences and broaden supported assets, adjacent timeframes and already-computed R:R/setup possibilities. NO TRADE remains valid. Evidence triage is not a success probability, expected return, recommendation or execution priority.</p>'+
  '</section>';
};

const probabilityCalibrationMarkup=(data,escapeHtml)=>{
  const calibration=data?.confidence?.probabilityCalibration||data?.quant?.calibration;
  if(!calibration)return '';
  const pctValue=(value)=>isFiniteDecisionEvidence(value)?(Number(value)*100).toFixed(1)+'%':'Unavailable';
  const brier=isFiniteDecisionEvidence(calibration.brierScore)?Number(calibration.brierScore).toFixed(4):'Unavailable';
  const skill=isFiniteDecisionEvidence(calibration.skillScore)?pctValue(calibration.skillScore):'Unavailable';
  const gap=isFiniteDecisionEvidence(calibration.reliabilityGap)?pctValue(calibration.reliabilityGap):'Unavailable';
  const bins=Array.isArray(calibration.reliabilityBins)?calibration.reliabilityBins:[];
  const separation=isFiniteDecisionEvidence(calibration.minimumOutcomeSeparationBars)?String(calibration.minimumOutcomeSeparationBars)+' bars':'Unavailable';
  const sampleGate=isFiniteDecisionEvidence(calibration.minimumSampleGate)?String(calibration.minimumSampleGate):'Unavailable';
  const diagnosticOnly=calibration.diagnosticMetricsOnly===true;
  const overlap=calibration.outcomeWindowOverlap===true?'YES':calibration.outcomeWindowOverlap===false?'NO':'UNAVAILABLE';
  const resolvedSamples=Math.max(0,Number(calibration.sampleSize)||0);
  const contradictions=Array.isArray(data?.qellyView?.contradictions)?data.qellyView.contradictions:[];
  const eventLevel=String(data?.evidence?.eventRisk?.level||data?.eventRisk?.level||'UNAVAILABLE').toUpperCase();
  const driftState=String(data?.modelHealth?.driftReadiness?.state||'UNMEASURED').toUpperCase();
  const whyNot90=[];
  if(resolvedSamples<200)whyNot90.push('Insufficient independent resolved sample for the strict 90% gate: n='+resolvedSamples+' / 200 required for the relevant reliability bucket unless a statistically justified pooled model is implemented.');
  if(calibration.eligible!==true)whyNot90.push('Calibration is '+String(calibration.state||'UNCALIBRATED').replaceAll('_',' ').toLowerCase()+': '+String(calibration.reason||'independent calibration evidence has not cleared the publication gate.'));
  if(contradictions.length)whyNot90.push('Conflicting evidence remains: '+contradictions.slice(0,2).join(' · ')+'.');
  if(['HIGH','EXTREME'].includes(eventLevel))whyNot90.push('Event risk is '+eventLevel.toLowerCase()+', so a high-certainty presentation would be misleading.');
  if(driftState.includes('DRIFT')||driftState.includes('DEGRADED'))whyNot90.push('Model-health drift state is '+driftState.replaceAll('_',' ').toLowerCase()+'.');
  if(!whyNot90.length)whyNot90.push('A displayed 90%+ probability still requires the dedicated relevant-bucket >=200 independent-outcome gate, reliability evidence, confidence interval, acceptable Brier calibration and no critical contradiction. Evidence confidence alone cannot create 90%.');
  const whyNot90Markup='<details class="q-dpg-why-not-90"><summary>Why not 90%?</summary><ul>'+whyNot90.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul><p>90%+ is never created because indicators agree, Aggressive Discovery is active, or the UI should look confident.</p></details>';
  return '<section class="q-dpg-model-calibration"><header><div><small>MODEL CALIBRATION · WALK-FORWARD</small><h2>'+escapeHtml(String(calibration.state||'UNCALIBRATED').replaceAll('_',' '))+'</h2><p>'+escapeHtml(calibration.reason||'Calibration evidence is unavailable.')+'</p></div><span>'+(calibration.eligible?'ELIGIBLE':diagnosticOnly?'DIAGNOSTIC ONLY':'NOT ELIGIBLE')+'</span></header>'+
    '<div class="q-dpg-model-calibration__metrics"><article><span>Resolved samples</span><strong>'+escapeHtml(String(calibration.sampleSize??0))+'</strong><small>independent sample gate '+escapeHtml(sampleGate)+'</small></article><article><span>Outcome separation</span><strong>'+escapeHtml(separation)+'</strong><small>overlap '+escapeHtml(overlap)+'</small></article><article><span>Brier score</span><strong>'+escapeHtml(brier)+'</strong><small>'+(diagnosticOnly?'diagnostic only':'lower is better')+'</small></article><article><span>Skill vs uniform</span><strong>'+escapeHtml(skill)+'</strong><small>'+(diagnosticOnly?'diagnostic only':'calibration diagnostic')+'</small></article><article><span>Reliability gap</span><strong>'+escapeHtml(gap)+'</strong><small>'+(diagnosticOnly?'diagnostic only':'lower is better')+'</small></article></div>'+
    (bins.length?'<details><summary>Reliability bins</summary><div class="q-dpg-reliability-bins">'+bins.map(bin=>'<span><em>'+Math.round(Number(bin.low)*100)+'–'+Math.round(Number(bin.high)*100)+'%</em><strong>'+Math.round(Number(bin.meanConfidence)*100)+'% conf / '+Math.round(Number(bin.hitRate)*100)+'% hit</strong><small>n='+escapeHtml(String(bin.sampleSize))+'</small></span>').join('')+'</div></details>':'')+
    '<p class="q-dpg-calibration-method">'+escapeHtml(calibration.method||'')+(calibration.independenceGuard?' · '+escapeHtml(calibration.independenceGuard):'')+(calibration.leakageGuard?' · '+escapeHtml(calibration.leakageGuard):'')+'</p>'+whyNot90Markup+
  '</section>';
};

const healthQualityMarkup=(data,escapeHtml)=>{
  const quality=data?.dataQuality;
  const health=data?.modelHealth;
  if(!quality&&!health)return '';
  const score=isFiniteDecisionEvidence(quality?.score)?Math.round(Number(quality.score)*100)+'%':'Unavailable';
  const missing=quality?.missingness||{};
  const components=quality?.components||{};
  const componentCards=[
    ['Critical coverage',components?.criticalCoverage?.score],
    ['Freshness',components?.freshness?.score],
    ['Provider health',components?.providerHealth?.score],
    ['Consistency',components?.consistency?.score]
  ].map(([label,value])=>'<span><em>'+escapeHtml(label)+'</em><strong>'+(isFiniteDecisionEvidence(value)?Math.round(Number(value)*100)+'%':'Unavailable')+'</strong></span>').join('');
  const drift=health?.drift||{};
  const driftRows=Object.values(drift).slice(0,8).map(item=>'<li><strong>'+escapeHtml(String(item?.dimension||'drift').replaceAll('_',' '))+'</strong><span>'+escapeHtml(String(item?.state||'UNMEASURED'))+'</span><small>'+escapeHtml(item?.reason||'No longitudinal baseline is available.')+'</small></li>').join('');
  const gate=data?.qellyView?.evidenceGate||{};
  const calibration=data?.confidence?.probabilityCalibration||data?.quant?.calibration||{};
  const contradiction=data?.contradictionAnalysis||{};
  const qualityValue=(value)=>isFiniteDecisionEvidence(value)?Math.round(Number(value)*100)+'%':'Unavailable';
  const qualityMatrix='<div class="q-dpg-quality-matrix" aria-label="Decision quality dimensions">'+[
    ['Data Quality',quality?.state||'UNAVAILABLE',score],
    ['Evidence Quality',gate.qualityState||gate.state||'EVIDENCE',qualityValue(gate.qualityScore)],
    ['Calibration Quality',calibration.state||'UNCALIBRATED','n='+String(calibration.sampleSize??0)],
    ['MTF Agreement',gate.timeframeDirection||'UNAVAILABLE',qualityValue(gate.timeframeAgreement)],
    ['Contradiction',contradiction.state||((data?.qellyView?.contradictions||[]).length?'PRESENT':'NONE'),qualityValue(contradiction.score)]
  ].map(([label,stateValue,detail])=>'<span><em>'+escapeHtml(label)+'</em><strong>'+escapeHtml(String(stateValue).replaceAll('_',' '))+'</strong><small>'+escapeHtml(String(detail))+'</small></span>').join('')+'</div>';
  return '<details class="q-dpg-health-quality"><summary>Model / data health · '+escapeHtml(String(quality?.state||'UNAVAILABLE').replaceAll('_',' '))+' · '+escapeHtml(String(health?.driftReadiness?.state||'BASELINE_UNAVAILABLE').replaceAll('_',' '))+'</summary>'+qualityMatrix+
    '<div class="q-dpg-health-quality__grid"><section><small>DATA QUALITY · NOT DIRECTION</small><h3>'+escapeHtml(String(quality?.state||'UNAVAILABLE').replaceAll('_',' '))+' · '+escapeHtml(score)+'</h3><p>Critical readiness: <strong>'+(quality?.eligibility?.criticalReady?'PASSED':'FAIL CLOSED')+'</strong></p><div class="q-dpg-health-quality__components">'+componentCards+'</div><p>Missing contextual capabilities: '+escapeHtml(String(missing.unavailableCount??0))+' / '+escapeHtml(String(missing.totalCapabilities??0))+'. '+escapeHtml(missing.scoringBoundary||'')+'</p><p>'+escapeHtml(quality?.boundary||'')+'</p></section>'+
    '<section><small>MODEL HEALTH · DRIFT READINESS</small><h3>'+escapeHtml(String(health?.state||'UNAVAILABLE').replaceAll('_',' '))+'</h3><p>Longitudinal drift: <strong>'+escapeHtml(String(health?.driftReadiness?.state||'UNMEASURED').replaceAll('_',' '))+'</strong></p><ul>'+driftRows+'</ul><p>'+escapeHtml(health?.driftReadiness?.boundary||'')+'</p><p>'+escapeHtml(health?.boundary||'')+'</p></section></div>'+
  '</details>';
};

const primaryResearchSummary=(data,escapeHtml)=>{
  const view=data?.qellyView||{};
  const contradiction=data?.contradictionAnalysis||{};
  const trade=data?.tradeResearch||{};
  const selected=trade?.selected||null;
  const event=data?.evidence?.eventRisk||data?.eventRisk||{};
  const support=contradiction.strongestSupport||((Array.isArray(view.why)&&view.why.length)?view.why[0]:'No single supporting factor is dominant.');
  const conflict=contradiction.strongestContradiction||((Array.isArray(view.contradictions)&&view.contradictions.length)?view.contradictions[0]:'No explicit contradiction is dominant.');
  const entry=trade?.entry?money(trade.entry.preferred)+' · '+String(trade.entry.method||'entry'):'No evidence-qualified entry';
  const invalidation=isFiniteDecisionEvidence(trade?.stop?.price)?money(trade.stop.price):(trade?.invalidation?.price?.condition||'No active price invalidation');
  const target=selected&&isFiniteDecisionEvidence(selected.target)?money(selected.target):'No selected target';
  const rr=selected?.label||'No selected R:R';
  const eventLabel=String(event.level||'UNAVAILABLE').replaceAll('_',' ');
  const eventState=String(event.state||'unavailable').replaceAll('_',' ');
  const changes=trade.whatChangesView||view.changesIf||'Recompute when verified evidence changes.';
  const card=(label,value,detail='')=>'<span><em>'+escapeHtml(label)+'</em><strong>'+escapeHtml(String(value))+'</strong>'+(detail?'<small>'+escapeHtml(String(detail))+'</small>':'')+'</span>';
  return '<div class="q-dpg-primary-summary" aria-label="Primary Decision research summary">'+
    card('Strongest evidence',support)+
    card('Strongest contradiction',conflict)+
    card('Entry',entry)+
    card('Invalidation',invalidation)+
    card('Selected target / R:R',target,rr)+
    card('Event risk',eventLabel,eventState)+
    '<p><strong>What changes the view:</strong> '+escapeHtml(changes)+'</p>'+
  '</div>';
};

const secondaryResearchDiagnosticsMarkup=(data,escapeHtml)=>{
  return '<details class="q-dpg-secondary-research"><summary>Calibration, analogs & model health</summary><div>'+
    probabilityCalibrationMarkup(data,escapeHtml)+
    historicalAnalogsMarkup(data,escapeHtml)+
    healthQualityMarkup(data,escapeHtml)+
  '</div></details>';
};

const historicalAnalogsMarkup=(data,escapeHtml)=>{
  const context=data?.historicalAnalogs;
  if(!context)return '';
  const analogs=Array.isArray(context.analogs)?context.analogs:[];
  const gatePct=isFiniteDecisionEvidence(context.minimumSimilarity)?Math.round(Number(context.minimumSimilarity)*100)+'%':'Unavailable';
  if(!analogs.length)return '<section class="q-dpg-analogs"><header><div><small>HISTORICAL ANALOGS · DESCRIPTIVE ONLY</small><h2>Comparable history unavailable</h2></div><span>NO ELIGIBILITY IMPACT</span></header><div class="q-dpg-analog-summary"><span><em>Similarity floor</em><strong>'+escapeHtml(gatePct)+'</strong></span><span><em>Sampled windows</em><strong>'+escapeHtml(String(context.sampledWindows??0))+'</strong></span><span><em>Similarity-qualified</em><strong>'+escapeHtml(String(context.similarityEligibleWindows??0))+'</strong></span><span><em>Rejected by similarity</em><strong>'+escapeHtml(String(context.similarityRejectedWindows??0))+'</strong></span></div><p>'+escapeHtml(context.reason||'No prior window cleared the bounded analog policy.')+'</p><div class="q-dpg-analog-boundary"><strong>Selection boundary</strong><p>'+escapeHtml(context.selectionPolicy?.thresholdSelection||'Similarity policy unavailable.')+'</p><p>'+escapeHtml(context.leakageGuard||'')+'</p></div></section>';
  const summary=context.summary||{};
  const interval=summary.positiveShareInterval95||{};
  const duration=(value)=>isFiniteDecisionEvidence(value)?(Number(value)>=86400000?(Number(value)/86400000).toFixed(1)+'d':(Number(value)/3600000).toFixed(1)+'h'):'Unavailable';
  const pctValue=(value)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?Number(value).toFixed(2)+'%':'Unavailable';
  const share=(value)=>isFiniteDecisionEvidence(value)?Math.round(Number(value)*100)+'%':'Unavailable';
  const cards=analogs.map(item=>'<article><header><span>#'+escapeHtml(String(item.rank))+'</span><strong>'+escapeHtml(displayTime(item.observedAt))+'</strong><em>'+Math.round(Number(item.similarity)*100)+'% similar</em></header><div><span><small>Regime</small><strong>'+escapeHtml(String(item.regime||'UNAVAILABLE'))+'</strong></span><span><small>Volatility</small><strong>'+escapeHtml(String(item.volatilityRegime||'UNKNOWN'))+'</strong></span><span><small>Forward return</small><strong>'+escapeHtml(pctValue(item.forwardReturnPct))+'</strong></span><span><small>Favorable / adverse</small><strong>'+escapeHtml(pctValue(item.maxFavorablePct))+' / '+escapeHtml(pctValue(item.maxAdversePct))+'</strong></span><span><small>Resolved</small><strong>'+escapeHtml(duration(item.timeToResolutionMs))+'</strong></span></div></article>').join('');
  return '<section class="q-dpg-analogs"><header><div><small>HISTORICAL ANALOGS · DESCRIPTIVE ONLY</small><h2>Nearest prior market states</h2><p>'+escapeHtml(context.method||'')+'</p></div><span>NO ELIGIBILITY IMPACT</span></header>'+
    '<div class="q-dpg-analog-summary">'+
      '<span><em>Matches</em><strong>'+escapeHtml(String(summary.count??analogs.length))+'</strong></span>'+
      '<span><em>Similarity floor</em><strong>'+escapeHtml(gatePct)+'</strong></span>'+
      '<span><em>Qualified / sampled</em><strong>'+escapeHtml(String(context.similarityEligibleWindows??0))+' / '+escapeHtml(String(context.sampledWindows??0))+'</strong></span>'+
      '<span><em>Rejected by similarity</em><strong>'+escapeHtml(String(context.similarityRejectedWindows??0))+'</strong></span>'+
      '<span><em>Median forward return</em><strong>'+escapeHtml(pctValue(summary.medianForwardReturnPct))+'</strong></span>'+
      '<span><em>Return IQR</em><strong>'+escapeHtml(pctValue(summary.q25ForwardReturnPct))+' → '+escapeHtml(pctValue(summary.q75ForwardReturnPct))+'</strong></span>'+
      '<span><em>Positive / negative</em><strong>'+share(summary.positiveShare)+' / '+share(summary.negativeShare)+'</strong></span>'+
      '<span><em>Positive share · 95% descriptive interval</em><strong>'+share(interval.low)+' – '+share(interval.high)+'</strong></span>'+
      '<span><em>Median similarity</em><strong>'+Math.round(Number(summary.medianSimilarity||0)*100)+'%</strong></span>'+
      '<span><em>Median MFE / MAE</em><strong>'+escapeHtml(pctValue(summary.medianMfePct))+' / '+escapeHtml(pctValue(summary.medianMaePct))+'</strong></span>'+
      '<span><em>Median resolution</em><strong>'+escapeHtml(duration(summary.medianTimeToResolutionMs))+'</strong></span>'+
      '<span><em>Anchor separation</em><strong>≥ '+escapeHtml(String(context.minimumAnchorSeparationBars??'—'))+' bars</strong></span>'+
    '</div>'+
    '<div class="q-dpg-analog-list">'+cards+'</div>'+
    '<div class="q-dpg-analog-boundary"><strong>Leakage guard · Selection, leakage and uncertainty boundaries</strong><p>'+escapeHtml(context.selectionPolicy?.thresholdSelection||'')+' '+escapeHtml(context.selectionPolicy?.temporalSeparation||'')+'</p><p>'+escapeHtml(context.leakageGuard||'')+'</p><p>'+escapeHtml(context.outcomeBoundary||'')+'</p><p>'+escapeHtml(interval.boundary||context.uncertaintyBoundary||'')+'</p></div>'+
  '</section>';
};

const pastPresentFutureMarkup=(data,escapeHtml)=>{
  const context=data?.pastPresentFuture;
  if(!context)return '';
  const past=context.past||{},present=context.present||{},future=context.future||{};
  const move=past.selectedRange;
  const analogSummary=past.historicalAnalogs?.summary;
  const scenario=future.scenarios||{},details=future.scenarioDetails||{};
  const targets=Array.isArray(future.targetFeasibility)?future.targetFeasibility:[];
  const probability=(value)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?(Number(value)*100).toFixed(1)+'%':'Unavailable';
  const pctValue=(value)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?(Number(value)>=0?'+':'')+Number(value).toFixed(2)+'%':'Unavailable';
  const price=(value)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?money(value):'Unavailable';
  const stateText=(value)=>String(value||'UNAVAILABLE').replaceAll('_',' ');
  const evidenceList=(items,empty)=>Array.isArray(items)&&items.length?'<ul>'+items.slice(0,4).map(item=>'<li><strong>'+escapeHtml(item.title||item.type||'Evidence')+'</strong><span>'+escapeHtml(item.detail||item.direction||'')+'</span></li>').join('')+'</ul>':'<p>'+escapeHtml(empty)+'</p>';
  const newsItems=Array.isArray(past.newsTimeline?.items)?past.newsTimeline.items:[];
  const scenarioCard=(label,item)=>'<article><header><span>'+escapeHtml(label)+'</span><strong>'+probability(item?.probability)+'</strong></header><p><b>Range</b> '+(item?.targetRange?price(item.targetRange.low)+' → '+price(item.targetRange.high):'Unavailable')+'</p><p><b>Trigger</b> '+escapeHtml(item?.trigger||'Unavailable')+'</p><p><b>Invalidation</b> '+escapeHtml(item?.invalidation||'Unavailable')+'</p><small>'+escapeHtml(item?.whatChanges||'')+'</small></article>';
  const pastBody=move
    ?'<strong>'+escapeHtml(pctValue(move.returnPct??move.changePct))+'</strong><p>'+escapeHtml(String(move.candles))+' candles · range '+escapeHtml(String(move.rangePct??'—'))+'% · volume '+escapeHtml(String(move.volumeRatio??'N/A'))+'× prior window.</p>'+
      '<div class="q-dpg-ppf__facts"><span><em>Structure</em><b>'+escapeHtml(stateText(move.structure?.state))+'</b></span><span><em>Regime</em><b>'+escapeHtml(stateText(move.regime))+'</b></span><span><em>Support</em><b>'+price(move.support)+'</b></span><span><em>Resistance</em><b>'+price(move.resistance)+'</b></span><span><em>Volatility</em><b>'+escapeHtml(pctValue(move.volatilityPct))+'</b></span><span><em>Cross-asset</em><b>'+escapeHtml(stateText(past.crossAsset?.state))+'</b></span></div>'+
      '<details class="q-dpg-ppf__details"><summary>Move evidence and timeline</summary><div class="q-dpg-ppf__evidence"><section><h3>Supporting</h3>'+evidenceList(past.supportingEvidence,'No explicit supporting move evidence was classified.')+'</section><section><h3>Contradictory</h3>'+evidenceList(past.contradictoryEvidence,'No explicit move contradiction was classified.')+'</section><section><h3>News timeline</h3>'+(newsItems.length?'<ul>'+newsItems.slice(0,4).map(item=>'<li><strong>'+escapeHtml(item.title)+'</strong><span>'+escapeHtml(item.source||'External reporting')+(item.publishedAt?' · '+escapeHtml(displayTime(item.publishedAt)):'')+'</span></li>').join('')+'</ul>':'<p>'+escapeHtml(past.newsTimeline?.boundary||'No move-specific news matches.')+'</p>')+'</section><section><h3>Historical derivatives</h3><p>'+escapeHtml(stateText(past.historicalDerivatives?.state))+' · '+escapeHtml(past.historicalDerivatives?.boundary||'No historical derivatives context.')+'</p></section></div></details>'
    :'<strong>No selected range</strong><p>Select a candle or drag a range to attach move-specific price, structure, volume, news, cross-asset and historical-derivatives context.</p>';
  const analogBody=analogSummary
    ?'<small>Analogs</small><span>'+escapeHtml(String(analogSummary.count??0))+' matches · median '+escapeHtml(String(analogSummary.medianForwardReturnPct??'—'))+'% · MFE '+escapeHtml(String(analogSummary.medianMfePct??'—'))+'% · MAE '+escapeHtml(String(analogSummary.medianMaePct??'—'))+'% · descriptive only</span>'
    :'<small>Analogs</small><span>'+escapeHtml(stateText(past.historicalAnalogs?.state))+'</span>';
  const currentSetup=present.currentSetup||{};
  const presentFacts=[
    ['Freshness',present.freshness],
    ['Regime',present.regime],
    ['Structure',present.structure?.state],
    ['Momentum RSI',present.momentum?.rsi14],
    ['Volatility',present.volatility?.regime],
    ['Liquidity',present.liquidity?.state],
    ['Derivatives',present.derivatives?.state],
    ['Macro',present.macro?.level||present.macro?.state],
    ['Event risk',present.eventRisk?.level||present.eventRisk?.state],
    ['MTF',present.multiTimeframe?.agreement?.direction],
    ['Calibration',present.calibration?.state],
    ['Setup',currentSetup.status]
  ].map(([label,value])=>'<span><em>'+escapeHtml(String(label))+'</em><b>'+escapeHtml(stateText(value))+'</b></span>').join('');
  const targetRows=targets.length
    ?targets.map(item=>'<li><span>'+escapeHtml(item.label||'Target')+'</span><strong>'+escapeHtml(stateText(item.feasibility))+'</strong><small>'+(isFiniteDecisionEvidence(item.target)?money(item.target):'Target unavailable')+(item.structuralBarrier!==null&&item.structuralBarrier!==undefined?' · barrier '+money(item.structuralBarrier):'')+'</small></li>').join('')
    :'<li><span>Targets</span><strong>Unavailable</strong><small>No evidence-qualified target ladder.</small></li>';
  const tail=future.tail;
  return '<section class="q-dpg-ppf q-dpg-ppf--v2" aria-label="Past Present Future">'+
    '<article><header><small>PAST · WHY DID IT HAPPEN?</small><h2>Observed context</h2></header>'+pastBody+'<div class="q-dpg-ppf__meta">'+analogBody+'</div><p class="q-dpg-ppf__boundary">'+escapeHtml(past.context||'Historical context is descriptive only.')+'</p></article>'+
    '<article><header><small>PRESENT · WHAT IS HAPPENING NOW?</small><h2>'+escapeHtml(stateText(present.qellyView?.action||'NO TRADE'))+'</h2></header><strong>'+escapeHtml(String(present.marketState?.label||'Market state unavailable'))+'</strong><p>'+escapeHtml(present.qellyView?.label||'')+'</p><div class="q-dpg-ppf__facts">'+presentFacts+'</div><div class="q-dpg-ppf__meta"><small>Evidence quality</small><span>'+probability(present.qellyView?.evidenceQuality)+'</span><small>Confidence</small><span>'+probability(present.qellyView?.confidence)+'</span><small>Contradiction</small><span>'+escapeHtml(stateText(present.contradiction?.state))+'</span><small>Entry</small><span>'+escapeHtml(stateText(currentSetup.entry?.method))+(isFiniteDecisionEvidence(currentSetup.entry?.preferred)?' · '+price(currentSetup.entry.preferred):'')+'</span><small>Stop</small><span>'+price(currentSetup.stop?.price)+'</span><small>Expiry</small><span>'+(currentSetup.expiryAt?escapeHtml(displayTime(currentSetup.expiryAt)):'Unavailable')+'</span></div></article>'+
    '<article><header><small>FUTURE · PROBABLE SCENARIOS</small><h2>Scenario map</h2></header><strong>'+probability(scenario.bull)+' bull · '+probability(scenario.base)+' base · '+probability(scenario.bear)+' bear</strong><p>Horizon '+escapeHtml(String(future.horizon||'Unavailable'))+' · modelled range '+price(future.expectedRange?.p05)+' to '+price(future.expectedRange?.p95)+'.</p><div class="q-dpg-ppf__scenarios">'+scenarioCard('Bull',details.bull)+scenarioCard('Base',details.base)+scenarioCard('Bear',details.bear)+'</div>'+
      (tail?'<details class="q-dpg-ppf__tail"><summary>Tail bounds</summary><p>'+price(tail.lower)+' → '+price(tail.upper)+' · nominal combined tail mass '+Math.round(Number(tail.combinedNominalTailMass||0)*100)+'%.</p><p>'+escapeHtml(tail.boundary||'')+'</p></details>':'')+
      '<div class="q-dpg-ppf__probability-boundary"><strong>'+escapeHtml(stateText(future.probabilityCalibration?.state))+'</strong><p>'+escapeHtml(future.probabilityCalibration?.boundary||future.boundary||'')+'</p></div><ul class="q-dpg-ppf__targets">'+targetRows+'</ul><p><strong>What changes the view:</strong> '+escapeHtml(future.whatChangesView||'Reassess when fresh evidence changes.')+'</p></article>'+
  '</section>';
};


const contradictionMarkup=(data,escapeHtml)=>{
  const context=data?.contradictionAnalysis;
  if(!context)return '';
  const support=Array.isArray(context.support)?context.support:[];
  const contradictions=Array.isArray(context.contradictions)?context.contradictions:[];
  const neutral=Array.isArray(context.neutral)?context.neutral:[];
  const list=(items,empty)=>items.length?'<ul>'+items.slice(0,6).map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul>':'<p>'+escapeHtml(empty)+'</p>';
  return '<section class="q-dpg-contradiction-map"><header><div><small>CONTRADICTION ENGINE</small><h2>'+escapeHtml(String(context.state||'MIXED').replaceAll('_',' '))+'</h2></div><span>Score '+(isFiniteDecisionEvidence(context.score)?Math.round(Number(context.score)*100)+'%':'Unavailable')+'</span></header><div><article><h3>Supporting context</h3>'+list(support,'No supporting evidence summary is available.')+'</article><article><h3>Contradictions</h3>'+list(contradictions,'No unresolved contradiction is currently recorded.')+'</article><article><h3>Neutral / unavailable</h3>'+list(neutral,'No neutral evidence boundary is recorded.')+'</article></div><p>'+escapeHtml(context.note||'')+'</p></section>';
};

const decisionTraceMarkup=(data,escapeHtml)=>{
  const trace=data?.evidenceGraph||data?.decisionTrace;
  if(!trace)return '';
  const nodes=Array.isArray(trace.nodes)?trace.nodes:[];
  const pipeline=Array.isArray(trace.pipeline)?trace.pipeline:[];
  const edges=Array.isArray(trace.textAlternative)?trace.textAlternative:[];
  const confidence=(value)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?Math.round(Number(value)*100)+'%':'Not quantified';
  const nodeMarkup=nodes.map(node=>'<article><div><small>'+escapeHtml(String(node.kind||'evidence').replaceAll('-',' '))+'</small><strong>'+escapeHtml(node.label||node.id)+'</strong></div><span>'+escapeHtml(String(node.freshness||'UNAVAILABLE'))+' · '+escapeHtml(String(node.importance||'MEDIUM'))+' · '+escapeHtml(String(node.supportState||node.role||'NEUTRAL').replaceAll('_',' '))+'</span><p>'+escapeHtml(node.source||'QELLY derived research')+'</p><small>Confidence: '+escapeHtml(confidence(node.confidence))+'</small><details><summary>Method and limits</summary><p>'+escapeHtml(node.method||node.methodology||'')+'</p><ul>'+(Array.isArray(node.limitations)?node.limitations.map(item=>'<li>'+escapeHtml(item)+'</li>').join(''):'')+'</ul></details></article>').join('');
  const pipelineMarkup=pipeline.length?'<ol class="q-dpg-trace__pipeline">'+pipeline.map(item=>'<li><span>'+escapeHtml(String(item.order))+'</span><div><small>'+escapeHtml(String(item.stage||'STAGE').replaceAll('_',' '))+'</small><strong>'+escapeHtml(item.label||item.id)+'</strong><em>'+escapeHtml(String(item.freshness||'UNAVAILABLE'))+' · '+escapeHtml(String(item.supportState||'NEUTRAL').replaceAll('_',' '))+'</em></div></li>').join('')+'</ol>':'';
  return '<section class="q-dpg-trace q-dpg-trace--v2"><header><div><small>DECISION TRACE · EVIDENCE GRAPH 2.0</small><h2>Raw observation → normalized data → evidence → setup → outcome</h2><p>'+escapeHtml(trace.boundary||'')+'</p></div><span>NO SECOND DECISION ENGINE</span></header>'+pipelineMarkup+
    '<details class="q-dpg-trace__inventory" open><summary>Evidence node inventory · '+escapeHtml(String(nodes.length))+' nodes</summary><div class="q-dpg-trace__nodes">'+nodeMarkup+'</div></details>'+
    '<details class="q-dpg-trace__edges"><summary>Trace relationships</summary><ol>'+edges.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ol></details></section>';
};


const CHANGE_ATTRIBUTION_GROUPS=Object.freeze([
  {id:'calibration',label:'Calibration',role:'eligibility gate',keys:['calibrationState','calibrationEligible','calibrationBrierScore','calibrationReliabilityGap']},
  {id:'mtf',label:'Multi-timeframe agreement',role:'eligibility gate',keys:['timeframeDirection','timeframeAgreement']},
  {id:'structure',label:'Market structure',role:'eligibility gate',keys:['structureState','structureBias']},
  {id:'liquidity',label:'Liquidity',role:'eligibility gate',keys:['liquidityState','liquiditySpreadBps','liquidityDepthConsensus']},
  {id:'targetFeasibility',label:'Target / R:R feasibility',role:'setup geometry',keys:['selectedRr','selectedRrFeasibility','selectedTarget','stopPrice','expiryAt']},
  {id:'freshness',label:'Freshness',role:'quality input',keys:['truthState','freshnessState']},
  {id:'trend',label:'Trend / regime',role:'model state',keys:['trendState','regime']},
  {id:'volatility',label:'Volatility',role:'model state',keys:['volatilityRegime']},
  {id:'price',label:'Price',role:'market observation',keys:['price']},
  {id:'derivatives',label:'Derivatives',role:'risk context',keys:['derivativesState','fundingPct','fundingChangeBps','openInterestNotionalUsd','openInterestChangeState']},
  {id:'news',label:'News context',role:'context only',keys:['newsState']}
]);
const CHANGE_ATTRIBUTION_BOUNDARY='Ranked by deterministic Decision-gate relevance and fixed methodology order. This is change attribution, not market causality, learned feature importance, or a success-probability explanation.';

const whatChangedMarkup=(previous,current,escapeHtml)=>{
  if(!current)return '';
  const comparable=previous&&previous.asset===current.asset&&previous.interval===current.interval;
  if(!comparable)return '<section id="qelly-decision-what-changed" class="q-dpg-what-changed"><header><div><small>WHAT CHANGED?</small><h2>Baseline created</h2></div><span>Same-session comparison</span></header><p>This is the first comparable '+escapeHtml(String(current.asset||''))+' / '+escapeHtml(String(current.interval||''))+' Decision snapshot in this session. Refresh or recompute to see deltas.</p></section>';
  const fields=[
    ['Price','price'],
    ['Truth state','truthState'],
    ['Freshness','freshnessState'],
    ['Trend','trendState'],
    ['QELLY view','action'],
    ['Confidence','confidence'],
    ['Evidence quality','evidenceQuality'],
    ['Calibration','calibrationState'],
    ['Calibration Brier','calibrationBrierScore'],
    ['Structure','structureState'],
    ['Structure bias','structureBias'],
    ['Regime','regime'],
    ['Volatility regime','volatilityRegime'],
    ['MTF direction','timeframeDirection'],
    ['MTF agreement','timeframeAgreement'],
    ['Liquidity state','liquidityState'],
    ['Liquidity spread','liquiditySpreadBps'],
    ['Liquidity depth','liquidityDepthConsensus'],
    ['Derivatives state','derivativesState'],
    ['Funding','fundingPct'],
    ['Funding change','fundingChangeBps'],
    ['Open interest','openInterestNotionalUsd'],
    ['OI change','openInterestChangeState'],
    ['Macro','macroLevel'],
    ['USD / INR ref','macroUsdInr'],
    ['Event risk','eventRiskLevel'],
    ['News context','newsState'],
    ['Contradiction','contradictionState'],
    ['Contradiction score','contradictionScore'],
    ['Trade status','tradeStatus'],
    ['Lifecycle','lifecycle'],
    ['Entry','entryMethod'],
    ['Entry price','entryPreferred'],
    ['Selected R:R','selectedRr'],
    ['R:R feasibility','selectedRrFeasibility'],
    ['Selected target','selectedTarget'],
    ['Stop / invalidation','stopPrice'],
    ['Expiry','expiryAt']
  ];
  const renderValue=(key,value)=>{
    if(value===null||value===undefined||value==='')return 'Unavailable';
    if(['confidence','evidenceQuality','timeframeAgreement','contradictionScore'].includes(key))return (Number(value)*100).toFixed(1)+'%';
    if(['price','entryPreferred','selectedTarget','stopPrice','invalidationPrice'].includes(key)&&isFiniteDecisionEvidence(value))return money(value);
    if(key==='openInterestNotionalUsd'&&isFiniteDecisionEvidence(value))return compactMoney(value);
    if(key==='fundingPct'&&isFiniteDecisionEvidence(value))return Number(value).toFixed(5)+'%';
    if(['fundingChangeBps','liquiditySpreadBps'].includes(key)&&isFiniteDecisionEvidence(value))return Number(value).toFixed(3)+' bps';
    if(key==='macroUsdInr'&&isFiniteDecisionEvidence(value))return Number(value).toFixed(4);
    if(key==='calibrationBrierScore'&&isFiniteDecisionEvidence(value))return Number(value).toFixed(4);
    return String(value).replaceAll('_',' ');
  };
  const reasonFor=(key)=>String(current?.changeReasons?.[key]||'');
  const changed=fields.map(([label,key])=>({label,key,before:previous[key],after:current[key]})).filter(item=>String(item.before??'')!==String(item.after??''));
  const changedByKey=new Map(changed.map(item=>[item.key,item]));
  const contributors=CHANGE_ATTRIBUTION_GROUPS.map(group=>{
    const matched=group.keys.map(key=>changedByKey.get(key)).filter(Boolean);
    if(!matched.length)return null;
    return {id:group.id,label:group.label,role:group.role,changedFields:matched.map(item=>item.label),reason:matched.map(item=>reasonFor(item.key)).find(Boolean)||''};
  }).filter(Boolean).map((item,index)=>({...item,rank:index+1}));
  const contributorMarkup=contributors.length
    ?'<section class="q-dpg-what-changed__contributors"><h3>Ranked attribution contributors</h3><ol>'+contributors.map(item=>'<li><strong>#'+escapeHtml(String(item.rank))+' · '+escapeHtml(item.label)+'</strong><span>'+escapeHtml(item.role)+' · '+escapeHtml(item.changedFields.join(', '))+'</span>'+(item.reason?'<p>'+escapeHtml(item.reason)+'</p>':'')+'</li>').join('')+'</ol><p>'+escapeHtml(CHANGE_ATTRIBUTION_BOUNDARY)+'</p></section>'
    :'';
  return '<section id="qelly-decision-what-changed" class="q-dpg-what-changed"><header><div><small>WHAT CHANGED?</small><h2>'+(changed.length?escapeHtml(String(changed.length))+' tracked changes':'No tracked field changed')+'</h2></div><span>'+escapeHtml(String(previous.observedAt||''))+' → '+escapeHtml(String(current.observedAt||''))+'</span></header>'+contributorMarkup+(changed.length?'<div>'+changed.map(item=>'<article><small>'+escapeHtml(item.label)+'</small><span>'+escapeHtml(renderValue(item.key,item.before))+' → <strong>'+escapeHtml(renderValue(item.key,item.after))+'</strong></span>'+(reasonFor(item.key)?'<p class="q-dpg-what-changed__reason">'+escapeHtml(reasonFor(item.key))+'</p>':'')+'</article>').join('')+'</div>':'<p>The tracked Decision fields are unchanged from the previous same-asset, same-timeframe snapshot.</p>')+'</section>';
}


const sloDiagnosticsMarkup=(slo,escapeHtml)=>{
  if(!slo)return '';
  const all=[...Object.values(slo.objectives||{}),...Object.entries(slo.providers||{}).map(([provider,value])=>({...value,name:'provider:'+provider}))];
  const rows=all.map(item=>'<span><em>'+escapeHtml(String(item.name||'metric').replaceAll('_',' '))+'</em><strong>'+escapeHtml(String(item.state||'UNAVAILABLE').replaceAll('_',' '))+'</strong><small>'+escapeHtml(item.value==null?'value unavailable':String(item.value))+' / target '+escapeHtml(item.target==null?'—':String(item.target))+' · n='+escapeHtml(String(item.sampleSize??0))+'/'+escapeHtml(String(item.minSamples??0))+'</small></span>').join('');
  return '<details class="q-dpg-audit q-dpg-slo"><summary>Operational SLOs · '+escapeHtml(String(slo.state||'OBSERVING'))+'</summary><div><section><h3>Measured objectives</h3><p>'+escapeHtml(slo.measurementBoundary||'')+'</p><div class="q-dpg-reliability-bins">'+rows+'</div></section><section><h3>Boundaries</h3><p>'+escapeHtml(slo.latencyBoundary||'')+'</p><p>'+escapeHtml(slo.providerBoundary||'')+'</p><p>'+escapeHtml(slo.scientificBoundary||'')+'</p></section></div></details>';
};


let activeDecisionDockClearanceCleanup=()=>{};

export async function renderDecisionProvenGraph(main,deps){
  await installStyles(deps.signal);const {api,stateBanner,escapeHtml,toast,navigate}=deps;
  const chatContext=readChatDecisionContext();
  const assetPreferences=readDecisionAssetPreferences();
  let state={asset:chatContext.asset,interval:chatContext.interval,horizon:normalizeHorizon(chatContext.interval,'4h'),rr:'auto',customRr:'2.5',nextMoveBars:'1',nextMoveCustomBars:'8',chartMode:'select-range',uiMode:'simple',assetCatalog:null,assetCatalogError:null,assetPickerOpen:false,assetFilter:'all',assetQuery:'',assetFavorites:assetPreferences.favorites,assetRecent:assetPreferences.recent,loading:true,data:null,previousSnapshot:null,error:null,draft:null,selection:null,rangeEvidenceLoading:false,rangeEvidenceError:null,rangeEvidenceRequest:0,rangeReplayIndex:0,scanning:false,scan:null,scanError:null,ledger:null,ledgerLoading:false,ledgerError:null,ledgerMutating:false,slo:null,scanFilters:{mode:'validated',ranking:'highest_quality',universe:'all',direction:'any',minEvidenceQuality:'0',minCalibratedConfidence:'0',minMtfAgreement:'0',liquidity:'any',volatility:'any',regime:'any',eventRiskTolerance:'any',freshness:'live_or_delayed'}};
  let chartGestureActive=false,chartGestureDeferredDraw=false,pendingFocusSelector=null;
  const queueFocusAfterDraw=(selector)=>{pendingFocusSelector=selector;};
  const applyPendingFocus=()=>{
    const selector=pendingFocusSelector;
    pendingFocusSelector=null;
    if(!selector)return;
    main.querySelector(selector)?.focus({preventScroll:true});
    requestAnimationFrame(()=>main.querySelector(selector)?.focus({preventScroll:true}));
  };
  const ledgerAuthenticated=()=>Boolean(window.__QELLY_SESSION_STATE__?.authenticated);
  const updateSlo=(snapshot)=>{
    const next=evaluateDecisionSlos(snapshot);
    if(next.state==='VIOLATION'&&state.slo?.state!=='VIOLATION')emitRuntimeSignal({feature:'decision_slo',action:'violation',state:'violation',surface:'decision'});
    state.slo=next;
    return next;
  };

  const select=(name,values)=>'<label><span>'+name[0].toUpperCase()+name.slice(1)+'</span><select data-dpg-'+name+'>'+values.map(value=>'<option value="'+value+'" '+(state[name]===value?'selected':'')+'>'+value+'</option>').join('')+'</select></label>';
  const timeframeSelect=()=>{
    const groups=[['SCALP',['1m','3m','5m']],['INTRADAY',['15m','30m','1h']],['SWING',['2h','4h','1d']]];
    return '<label><span>Timeframe</span><select data-dpg-interval aria-label="Decision timeframe">'+groups.map(([label,values])=>'<optgroup label="'+label+'">'+values.filter(value=>INTERVAL_MS[value]).map(value=>'<option value="'+value+'" '+(state.interval===value?'selected':'')+'>'+value+'</option>').join('')+'</optgroup>').join('')+'</select></label>';
  };
  const fallbackAssetCatalog=()=>({truthState:'FALLBACK',authority:'bundled-existing-decision-universe',supportedAssetCount:DECISION_ASSETS.size,selectableSymbols:[...DECISION_ASSETS],groups:[{id:'crypto',label:'Crypto',assetClass:'crypto',state:'SUPPORTED',selectable:true,provider:{id:'hyperliquid-public',name:'Hyperliquid',state:'CURRENT_DECISION_SOURCE'},assets:[...DECISION_ASSETS].map(symbol=>({canonicalId:'QI-CRYPTO-'+symbol,symbol,providerSymbol:symbol,name:symbol,assetClass:'crypto',exchange:'Hyperliquid',currency:'USD',category:'Current Decision asset',venue:'Hyperliquid',marketStatus:'continuous',providerStatus:'SUPPORTED',supportedTimeframes:Object.keys(INTERVAL_MS),capabilities:['candles'],selectable:true})),reason:'Capability endpoint unavailable; selection is limited to the existing Decision asset universe.'}],guardrails:{unsupportedAssetsSelectable:false,referenceDataDoesNotImplyDecisionSupport:true}});
  const assetPickerMarkup=()=>{
    const groups=Array.isArray(state.assetCatalog?.groups)?state.assetCatalog.groups:[];
    const allAssets=groups.flatMap((group)=>Array.isArray(group.assets)?group.assets.map((asset)=>({...asset,groupId:group.id,groupLabel:group.label,groupState:group.state})):[]);
    const selected=allAssets.find((asset)=>asset.symbol===state.asset)||null;
    const favorites=new Set(state.assetFavorites),recent=new Set(state.assetRecent);
    const mode=state.assetFilter;
    const visibleGroups=groups.map((group)=>({
      ...group,
      assets:(group.assets||[]).filter((asset)=>mode==='favorites'?favorites.has(asset.symbol):mode==='recent'?recent.has(asset.symbol):true)
    })).filter((group)=>mode==='all'||group.assets.length);
    const row=(group,asset)=>{
      const favorite=favorites.has(asset.symbol),search=decisionAssetSearchText(group,asset);
      return '<div class="q-dpg-asset-row" data-dpg-asset-row data-search="'+escapeHtml(search)+'"><button type="button" data-dpg-asset-select="'+escapeHtml(asset.symbol)+'"><span><strong>'+escapeHtml(asset.symbol)+'</strong><small>'+escapeHtml(asset.name)+'</small></span><span><em>'+escapeHtml(asset.category||asset.assetClass||'Asset')+'</em><small>'+escapeHtml(asset.exchange||asset.venue||'Provider')+' · '+escapeHtml(String(asset.marketStatus||'status unavailable'))+' · '+escapeHtml(String(asset.providerStatus||'UNAVAILABLE'))+'</small><small>'+escapeHtml((asset.supportedTimeframes||[]).join(' · ')||'No supported timeframes')+'</small></span><b>SUPPORTED DATA</b></button><button type="button" class="q-dpg-asset-favorite" data-dpg-asset-favorite="'+escapeHtml(asset.symbol)+'" aria-pressed="'+String(favorite)+'" aria-label="'+(favorite?'Remove '+escapeHtml(asset.symbol)+' from favorites':'Add '+escapeHtml(asset.symbol)+' to favorites')+'">'+(favorite?'★':'☆')+'</button></div>';
    };
    const groupMarkup=(group)=>{
      const search=decisionAssetSearchText(group),supported=group.selectable&&group.assets?.length;
      return '<section class="q-dpg-asset-group '+(supported?'is-supported':'is-unavailable')+'" data-dpg-asset-group data-search="'+escapeHtml(search)+'"><header><div><strong>'+escapeHtml(group.label)+'</strong><small>'+escapeHtml(group.assetClass||group.id)+'</small></div><span>'+escapeHtml(group.state||'UNAVAILABLE')+'</span></header>'+(supported?'<div>'+group.assets.map((asset)=>row(group,asset)).join('')+'</div>':'<p>'+escapeHtml(group.reason||'Decision-grade provider coverage is unavailable.')+'</p>')+'</section>';
    };
    const panel=state.assetPickerOpen?'<section id="qelly-decision-asset-picker" class="q-dpg-asset-picker__panel" role="dialog" aria-label="Decision asset universe" data-dpg-asset-picker-panel><header><div><small>PROVIDER-CAPABILITY UNIVERSE</small><strong>Select only evidence-backed Decision assets</strong></div><button type="button" data-dpg-asset-picker-close aria-label="Close asset picker">×</button></header><label class="q-dpg-asset-search"><span class="q-visually-hidden">Search assets or categories</span><input type="search" value="'+escapeHtml(state.assetQuery)+'" placeholder="Search symbol, asset, category or provider…" data-dpg-asset-search autocomplete="off"></label><div class="q-dpg-asset-filters" role="tablist" aria-label="Asset universe filter">'+[['all','All categories'],['recent','Recent'],['favorites','Favorites']].map(([id,label])=>'<button type="button" role="tab" data-dpg-asset-filter="'+id+'" aria-selected="'+String(mode===id)+'">'+label+'</button>').join('')+'</div>'+(state.assetCatalogError?'<p class="q-dpg-asset-catalog-error">'+escapeHtml(state.assetCatalogError)+'</p>':'')+'<div class="q-dpg-asset-groups">'+(visibleGroups.length?visibleGroups.map(groupMarkup).join(''):'<p class="q-dpg-asset-empty">No assets match this view.</p>')+'</div><footer><span>'+escapeHtml(String(state.assetCatalog?.supportedAssetCount||0))+' selectable</span><small>Reference-only and unavailable categories cannot trigger Decision requests.</small></footer></section>':'';
    return '<div class="q-dpg-asset-picker"><span>Asset</span><button type="button" class="q-dpg-asset-picker__trigger" data-dpg-asset-picker-toggle aria-expanded="'+String(state.assetPickerOpen)+'" aria-controls="qelly-decision-asset-picker"><span><strong>'+escapeHtml(state.asset)+'</strong><small>'+escapeHtml(selected?.name||'Capability catalog '+(state.assetCatalog?'loaded':'loading'))+'</small></span><b>▾</b></button>'+panel+'</div>';
  };
  const hero=(data)=>{
    const view=data?.qellyView||{},gate=view.evidenceGate||{},scenario=view.scenario||{};
    const candles=data?.market?.candles||[],last=candles.at?.(-1),previous=candles.at?.(-2);
    const price=data?money(data.market.lastPrice):'Connecting…';
    const change=last&&previous&&previous.close?((last.close/previous.close-1)*100):null;
    const freshness=data?.truthState||'CONNECTING';
    const marketState=data?.market?.currentState?.label||'Loading market state';
    const quality=isFiniteDecisionEvidence(gate.qualityScore)?Math.round(Number(gate.qualityScore)*100)+'%':'Unavailable';
    const confidence=isFiniteDecisionEvidence(view.confidence)?Math.round(Number(view.confidence)*100)+'%':'Unavailable';
    const agreement=isFiniteDecisionEvidence(gate.timeframeAgreement)?Math.round(Number(gate.timeframeAgreement)*100)+'%':'Unavailable';
    const probabilities=[['Bull',scenario.bull],['Base',scenario.base],['Bear',scenario.bear]].filter(([,value])=>isFiniteDecisionEvidence(value)).sort((a,b)=>Number(b[1])-Number(a[1]));
    const scenarioLead=probabilities.length?probabilities[0][0]+' · '+Math.round(Number(probabilities[0][1])*100)+'% share':'Unavailable';
    const regime=data?.market?.currentState?.trend||'Unavailable';
    const volatility=view.riskState?.label||'Unavailable';
    const provider=data?.provenance?.provider||'Hyperliquid';
    const action=view.action||'WAIT';
    const label=view.label||'Loading fresh evidence before a research view is shown.';
    return '<section class="q-dpg-hero q-dpg-hero--'+actionTone(action)+'" aria-label="QELLY Decision Intelligence">'+
      '<div class="q-dpg-hero__identity"><div><small>FLAGSHIP RESEARCH WORKSPACE</small><h1>QELLY Decision Intelligence</h1></div>'+
        '<div class="q-dpg-hero__selects">'+assetPickerMarkup()+timeframeSelect()+'</div>'+
        '<div class="q-dpg-hero__market"><strong>'+price+'</strong><span>'+(change===null?'Change unavailable':(change>=0?'+':'')+change.toFixed(2)+'%')+'</span><small>Crypto · '+escapeHtml(provider)+'</small><small>'+escapeHtml(freshness)+' · '+escapeHtml(marketState)+'</small><small>Observed '+escapeHtml(displayTime(data?.observedAt))+'</small></div></div>'+
      '<div class="q-dpg-hero__view"><small>QELLY VIEW</small><h2>'+escapeHtml(action)+'</h2><p>'+escapeHtml(label)+'</p><div class="q-dpg-hero__metrics">'+
        '<span><em>Evidence quality</em><strong>'+escapeHtml(quality)+'</strong></span>'+
        '<span><em>Evidence confidence</em><strong>'+escapeHtml(confidence)+'</strong><small>Calibrated confidence is separate and remains calibration-gated.</small></span>'+
        '<span data-dpg-leading-scenario><em>Leading model scenario</em><strong>'+escapeHtml(scenarioLead)+'</strong><small>Research model share, not a calibrated probability.</small></span>'+
        '<span><em>MTF agreement</em><strong>'+escapeHtml(agreement)+'</strong></span>'+
        '<span><em>Regime</em><strong>'+escapeHtml(String(regime))+'</strong></span>'+
        '<span><em>Volatility</em><strong>'+escapeHtml(volatility)+'</strong></span>'+
        '<span><em>Timeframe</em><strong>'+escapeHtml(state.interval)+'</strong></span>'+
      '</div></div>'+
      '<div class="q-dpg-hero__actions"><button class="q-button q-button--primary" data-dpg-scan '+(state.scanning?'disabled':'')+'>'+(state.scanning?'Searching…':'Find Setup Now')+'</button><button class="q-button q-button--secondary" data-dpg-explain-header '+(state.draft?'':'disabled')+'>Explain This Move</button><button class="q-button q-button--secondary" data-dpg-explain-candle '+(data?.market?.candles?.length?'':'disabled')+'>Explain Candle</button><button class="q-button q-button--secondary" data-dpg-mtf-jump>Compare Timeframes</button><button class="q-button q-button--secondary" data-dpg-compare-asset>Compare Asset</button><button class="q-button q-button--secondary" type="button" data-dpg-formula-evidence>Formula Evidence</button><button class="q-button q-button--secondary" type="button" data-dpg-research-note '+(data?'':'disabled')+'>Research Note</button><button class="q-button q-button--secondary" data-dpg-methodology-jump>Sources / Methodology</button></div>'+
    '</section>';
  };
  const outcomeLedgerMarkup=(data)=>{
    const trade=data?.tradeResearch||{},sourceSetupId=trade?.setupId||null;
    if(!ledgerAuthenticated())return '<section class="q-dpg-ledger"><header><div><small>OBSERVED SETUP LEDGER</small><h2>Track real setup outcomes after sign-in</h2></div><span>NO BACKFILL</span></header><p>QELLY does not fabricate historical setups. Sign in to persist a live evidence-qualified setup, then re-observe it from the server-side market evidence stack.</p><p class="q-dpg-ledger__boundary">Target-touch calibration remains UNCALIBRATED until a sufficient sample of real resolved setup outcomes exists.</p></section>';
    const ledger=state.ledger||{items:[],observedSetups:null,totalCountVerified:false,calibrationHistoryComplete:false,calibrationEligible:0,minimumSampleGate:50,calibrationState:'UNCALIBRATED',calibration:null};
    const items=Array.isArray(ledger.items)?ledger.items:[];
    const observedSetupsLabel=ledger.totalCountVerified===true&&Number.isSafeInteger(ledger.observedSetups)?String(ledger.observedSetups):'UNVERIFIED · displaying '+String(items.length);
    const calibrationCountLabel=ledger.calibrationHistoryComplete===true?String(ledger.calibrationEligible??0):'UNVERIFIED';
    const current=sourceSetupId?items.find(item=>item.sourceSetupId===sourceSetupId):null;
    const trackable=data?.truthState==='LIVE'&&trade?.status==='VALID'&&['FORMING','TRIGGERED','VALID'].includes(String(trade?.lifecycle?.state||''));
    const terminal=Boolean(current?.resolvedAt);
    const metric=(value)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?Number(value).toFixed(2)+'R':'—';
    const pct=(value)=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?(Number(value)*100).toFixed(1)+'%':'Unavailable';
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
    return '<section class="q-dpg-ledger"><header><div><small>OBSERVED SETUP LEDGER · WORKSPACE RLS</small><h2>Real lifecycle and outcome evidence</h2></div><span>'+escapeHtml(String(ledger.calibrationState||'UNCALIBRATED'))+'</span></header><div class="q-dpg-ledger__summary"><span>Observed setups<strong>'+escapeHtml(observedSetupsLabel)+'</strong>'+(ledger.hasMore===true?'<small>Showing latest '+escapeHtml(String(items.length))+' setups</small>':'')+'</span><span>Calibration-eligible resolutions<strong>'+escapeHtml(calibrationCountLabel)+' / '+escapeHtml(String(ledger.minimumSampleGate??50))+'</strong></span><span>Current source setup<strong>'+escapeHtml(sourceSetupId?'AVAILABLE':'NO TRADE')+'</strong></span></div>'+currentAction+(state.ledgerLoading?'<p>Loading workspace ledger…</p>':'')+(state.ledgerError?'<p class="q-dpg-ledger__error">'+escapeHtml(state.ledgerError)+'</p>':'')+calibrationPanel+'<div class="q-dpg-ledger__rows">'+(rows||'<p>No observed setups yet. Nothing before the first explicit tracking event is backfilled.</p>')+'</div><p class="q-dpg-ledger__boundary">'+escapeHtml(ledger.boundary||'Only setups created after tracking begins are included. No historical setups are fabricated or backfilled.')+' Target-touch calibration remains gated until the independent sample requirement is met.</p></section>';
  };
  const evidence=(data)=>{
    const move=data.selection,quant=move?.evidence||[],articles=data.evidence?.news?.articles||[];
    const items=[...quant.map(item=>({kind:item.type,title:item.title,detail:item.detail,meta:item.direction,score:item.strength})),...articles.slice(0,5).map(article=>({kind:'news',title:article.title,detail:article.source||'News report',meta:article.publishedAt,url:article.url,score:.45}))].sort((a,b)=>b.score-a.score);
    if(!items.length)return '<div class="q-dpg-empty">Select a candle range and choose <strong>Explain this move</strong> to rank the available price, volume, volatility and news evidence.</div>';
    return '<ol class="q-dpg-ranked">'+items.map((item,index)=>'<li><span>'+(index+1)+'</span><div><small>'+escapeHtml(item.kind)+'</small><strong>'+(item.url?'<a href="'+escapeHtml(item.url)+'" target="_blank" rel="noopener">'+escapeHtml(item.title)+'</a>':escapeHtml(item.title))+'</strong><p>'+escapeHtml(item.detail)+'</p><em>'+escapeHtml(item.meta||'context')+'</em></div></li>').join('')+'</ol>';
  };
  const historicalTimelineMarkup=(timeline)=>{
    if(!timeline)return state.rangeEvidenceLoading?'<section class="q-dpg-range-timeline q-dpg-range-timeline--loading" data-dpg-range-timeline><header><div><small>WHAT CAUSED THIS MOVE? · HISTORICAL TIMELINE</small><h3>Loading exact BEFORE / DURING / AFTER evidence…</h3></div><span>ASSOCIATION ONLY</span></header></section>':'';
    const bucket=(name)=>{
      const items=Array.isArray(timeline?.buckets?.[name])?timeline.buckets[name]:[];
      const coverage=(timeline.coverage||[]).find(item=>item.bucket===name)||{};
      const cards=items.map(item=>{
        const link=item.url?'<a href="'+escapeHtml(item.url)+'" target="_blank" rel="noopener">'+escapeHtml(item.event)+'</a>':'<strong>'+escapeHtml(item.event)+'</strong>';
        return '<article class="q-dpg-range-event" data-timeline-bucket="'+escapeHtml(name)+'"><time>'+escapeHtml(displayTime(item.timestamp))+'</time>'+link+'<p>'+escapeHtml(item.source||'External reporting')+'</p><div><span>'+escapeHtml(item.directness||'INDIRECT')+'</span><span>'+escapeHtml(item.evidenceStrength||'CONTEXT ONLY')+'</span><span>'+escapeHtml(item.directionalRelevance||'UNASSESSED')+'</span><span>Association '+escapeHtml(item.associationConfidence?.label||'UNAVAILABLE')+'</span></div><small>'+escapeHtml(item.associationStatement||'')+'</small></article>';
      }).join('');
      return '<section><header><h4>'+escapeHtml(name)+'</h4><span>'+escapeHtml(String(items.length))+' items · '+escapeHtml(String(coverage.state||'UNAVAILABLE').replaceAll('_',' '))+'</span></header>'+(cards||'<p>No source-backed items were accepted inside this exact '+escapeHtml(name.toLowerCase())+' window.</p>')+'</section>';
    };
    return '<section id="qelly-decision-range-timeline" class="q-dpg-range-timeline" data-dpg-range-timeline><header><div><small>WHAT CAUSED THIS MOVE? · HISTORICAL NEWS / EVENT TIMELINE</small><h3>Chronology first, causality unclaimed</h3></div><span>'+escapeHtml(String(timeline.causalityState||'ASSOCIATION_ONLY').replaceAll('_',' '))+'</span></header><p>'+escapeHtml(timeline.boundary||'Timing does not prove causation.')+'</p><div class="q-dpg-range-timeline__buckets">'+bucket('BEFORE')+bucket('DURING')+bucket('AFTER')+'</div></section>';
  };
  const rangeFlowMarkup=(flow)=>{
    if(!flow)return state.rangeEvidenceLoading?'<section id="qelly-decision-range-flow" class="q-dpg-range-flow q-dpg-range-flow--loading" data-dpg-range-flow><header><div><small>FLOW / PARTICIPATION EVIDENCE</small><h3>Loading source-bounded participation evidence…</h3></div><span>ACTOR IDENTITY UNAVAILABLE</span></header></section>':'';
    const sections=flow.sections||{},observed=sections.observedOrderFlow||{},unknown=sections.unknownActorActivity||{},funding=unknown.settledFunding||{},proxy=observed.participationProxy||{};
    const status=(value)=>String(value||'UNAVAILABLE').replaceAll('_',' ');
    const metric=(value,suffix='')=>value!=null&&value!==''&&isFiniteDecisionEvidence(value)?Number(value).toLocaleString(undefined,{maximumFractionDigits:4})+suffix:'Unavailable';
    const block=(title,item,body)=>'<article><header><span>'+escapeHtml(title)+'</span><strong>'+escapeHtml(status(item?.state))+'</strong></header>'+body+'</article>';
    const named=sections.knownNamedFlows||{},institutional=sections.publicInstitutionalData||{};
    return '<section id="qelly-decision-range-flow" class="q-dpg-range-flow" data-dpg-range-flow><header><div><small>FLOW / PARTICIPATION EVIDENCE · EXACT RANGE</small><h3>What the data can — and cannot — say about buying / selling</h3></div><span>'+escapeHtml(status(flow.actorIdentity==='UNAVAILABLE'?'ACTOR_IDENTITY_UNAVAILABLE':flow.actorIdentity))+'</span></header>'+
      '<p>'+escapeHtml(flow.boundary||'Named buyer/seller attribution requires a direct authorized source.')+'</p>'+
      '<div class="q-dpg-range-flow__grid">'+
        block('Known named flows',named,'<p>'+escapeHtml(named.reason||'No named flow source connected.')+'</p><b>'+escapeHtml(named.disclosure||'Actor identity unavailable.')+'</b>')+
        block('Observed order flow',observed,'<p>'+escapeHtml(observed.description||'Historical order-flow data unavailable.')+'</p><dl><div><dt>True order flow</dt><dd>'+escapeHtml(status(observed.trueOrderFlowState))+'</dd></div><div><dt>Volume vs prior</dt><dd>'+escapeHtml(metric(observed.volumeRatioVsPrior,'×'))+'</dd></div><div><dt>Bar-volume proxy</dt><dd>'+escapeHtml(status(proxy.state))+'</dd></div><div><dt>Proxy imbalance</dt><dd>'+escapeHtml(metric(proxy.imbalanceProxyPct,'%'))+'</dd></div></dl><small>'+escapeHtml(observed.boundary||'')+'</small>')+
        block('Public institutional data',institutional,'<p>'+escapeHtml(institutional.reason||'No institutional dataset connected.')+'</p><dl><div><dt>ETF/fund flow</dt><dd>'+escapeHtml(status(institutional.etfFlowState))+'</dd></div><div><dt>Filings</dt><dd>'+escapeHtml(status(institutional.filingState))+'</dd></div><div><dt>Block trades</dt><dd>'+escapeHtml(status(institutional.blockTradeState))+'</dd></div><div><dt>Exchange flow</dt><dd>'+escapeHtml(status(institutional.exchangeFlowState))+'</dd></div></dl>')+
        block('Unknown actor activity',unknown,'<p>'+escapeHtml(unknown.interpretation||'Actor activity cannot be attributed.')+'</p><dl><div><dt>Actor identity</dt><dd>'+escapeHtml(status(unknown.actorIdentity))+'</dd></div><div><dt>Move</dt><dd>'+escapeHtml(metric(unknown.moveReturnPct,'%'))+'</dd></div><div><dt>Settled funding samples</dt><dd>'+escapeHtml(String(funding.sampleSize??0))+'</dd></div><div><dt>Historical OI</dt><dd>'+escapeHtml(status(unknown.historicalOpenInterestState))+'</dd></div></dl><small>'+escapeHtml(unknown.disclosure||'Actor identity unavailable.')+'</small>')+
      '</div>'+
      '<details><summary>Participation proxy methodology</summary><p>'+escapeHtml(proxy.method||'Unavailable')+'</p><p>'+escapeHtml(proxy.boundary||'')+'</p><p><strong>Evidence strength:</strong> '+escapeHtml(status(flow.summary?.evidenceStrength))+' · <strong>Directional context:</strong> '+escapeHtml(status(flow.summary?.directionalContext))+'</p></details>'+
      (flow.sourceUrl?'<a class="q-dpg-range-flow__source" href="'+escapeHtml(flow.sourceUrl)+'" target="_blank" rel="noopener">Open provider methodology / source documentation ↗</a>':'')+
    '</section>';
  };

  const rangeReplayMarkup=(data)=>{
    const replay=data?.rangeReplay;
    if(!replay||replay.state!=='AVAILABLE'||!Array.isArray(replay.frames)||!replay.frames.length)return '';
    const max=replay.frames.length-1,index=clamp(Number(state.rangeReplayIndex)||0,0,max),frame=replay.frames[index],known=frame.knownRange||{},available=frame.evidenceAvailableAsOf||{},news=available.news||{},funding=available.settledFunding||{},benchmark=available.benchmark||{};
    const value=(input,suffix='')=>input!=null&&input!==''&&isFiniteDecisionEvidence(input)?Number(input).toLocaleString(undefined,{maximumFractionDigits:4})+suffix:'Unavailable';
    const latestNews=Array.isArray(news.latest)?news.latest:[];
    return '<section class="q-dpg-range-replay" data-dpg-range-replay><header><div><small>RANGE REPLAY · NO HINDSIGHT</small><h3>Candle '+escapeHtml(String(frame.candleNumber))+' / '+escapeHtml(String(frame.totalCandles))+'</h3></div><span>AVAILABLE AS OF '+escapeHtml(displayTime(frame.observedAt))+'</span></header>'+
      '<p>'+escapeHtml(frame.boundary||replay.hindsightGuard||'Future evidence is hidden until its timestamp arrives.')+'</p>'+
      '<div class="q-dpg-range-replay__controls"><button class="q-button q-button--secondary" type="button" data-dpg-replay-prev '+(index<=0?'disabled':'')+'>Previous</button><label><span>Replay position</span><input type="range" min="0" max="'+escapeHtml(String(max))+'" value="'+escapeHtml(String(index))+'" data-dpg-replay-slider aria-label="Range replay candle"></label><button class="q-button q-button--secondary" type="button" data-dpg-replay-next '+(index>=max?'disabled':'')+'>Next</button></div>'+
      '<div class="q-dpg-range-replay__facts"><span><em>Move so far</em><strong>'+escapeHtml(value(known.returnPct,'%'))+'</strong></span><span><em>High so far</em><strong>'+escapeHtml(value(known.high))+'</strong></span><span><em>Low so far</em><strong>'+escapeHtml(value(known.low))+'</strong></span><span><em>Volatility so far</em><strong>'+escapeHtml(value(known.realizedVolatilityPct,'%'))+'</strong></span><span><em>Known news</em><strong>'+escapeHtml(String(news.count??0))+'</strong></span><span><em>Settled funding</em><strong>'+escapeHtml(String(funding.count??0))+'</strong></span><span><em>'+escapeHtml(String(benchmark.symbol||'Benchmark'))+' return</em><strong>'+escapeHtml(value(benchmark.returnPct,'%'))+'</strong></span><span><em>Future evidence</em><strong>'+(frame.futureEvidenceHidden?'HIDDEN':'RANGE COMPLETE')+'</strong></span></div>'+
      (latestNews.length?'<div class="q-dpg-range-replay__news"><strong>Known by this candle</strong>'+latestNews.map(item=>'<span><time>'+escapeHtml(displayTime(item.timestamp))+'</time><b>'+escapeHtml(item.title)+'</b><small>'+escapeHtml(item.source||'External reporting')+'</small></span>').join('')+'</div>':'<p class="q-dpg-range-replay__empty">No selected-range headline had arrived by this candle.</p>')+
      '<details><summary>Replay boundaries</summary><p>'+escapeHtml(replay.hindsightGuard||'')+'</p><p>'+escapeHtml(replay.currentContextBoundary||'')+'</p></details></section>';
  };

  const selectedRangeSimilarMovesMarkup=(data)=>{
    const context=data?.selectedRangeSimilarMoves;
    if(!context||context.state==='NOT_SELECTED')return '';
    const analogs=Array.isArray(context.analogs)?context.analogs:[],summary=context.summary||{};
    const value=(input,suffix='')=>input!=null&&input!==''&&isFiniteDecisionEvidence(input)?Number(input).toLocaleString(undefined,{maximumFractionDigits:3})+suffix:'Unavailable';
    const duration=(input)=>isFiniteDecisionEvidence(input)?(Number(input)>=86_400_000?(Number(input)/86_400_000).toFixed(1)+'d':(Number(input)/3_600_000).toFixed(1)+'h'):'Unavailable';
    const cards=analogs.map(item=>'<article><header><span>#'+escapeHtml(String(item.rank))+'</span><strong>'+escapeHtml(displayTime(item.rangeStart))+' → '+escapeHtml(displayTime(item.rangeEnd))+'</strong><em>'+escapeHtml(String(Math.round(Number(item.similarity||0)*100)))+'% similar</em></header><div><span><small>Matched move</small><strong>'+escapeHtml(value(item.observedFeatures?.returnPct,'%'))+'</strong></span><span><small>Post-range return</small><strong>'+escapeHtml(value(item.outcome?.forwardReturnPct,'%'))+'</strong></span><span><small>MFE / MAE</small><strong>'+escapeHtml(value(item.outcome?.maxFavorablePct,'%'))+' / '+escapeHtml(value(item.outcome?.maxAdversePct,'%'))+'</strong></span><span><small>Resolution</small><strong>'+escapeHtml(duration(item.outcome?.timeToResolutionMs))+'</strong></span></div></article>').join('');
    return '<section class="q-dpg-similar-moves" data-dpg-similar-moves><header><div><small>FIND SIMILAR MOVES · SELECTED RANGE</small><h3>'+escapeHtml(analogs.length?String(summary.count??analogs.length)+' leakage-safe matches':'No safe prior match in returned history')+'</h3></div><span>DESCRIPTIVE ONLY · NOT CALIBRATION</span></header>'+
      '<p>'+escapeHtml(context.method||context.reason||'Prior equal-length selected ranges are matched using observed features only.')+'</p>'+
      '<div class="q-dpg-similar-moves__summary"><span><em>Similarity floor</em><strong>'+escapeHtml(value((context.minimumSimilarity??0)*100,'%'))+'</strong></span><span><em>Sampled / qualified</em><strong>'+escapeHtml(String(context.sampledWindows??0))+' / '+escapeHtml(String(context.similarityEligibleWindows??0))+'</strong></span><span><em>Median post return</em><strong>'+escapeHtml(value(summary.medianForwardReturnPct,'%'))+'</strong></span><span><em>Median MFE / MAE</em><strong>'+escapeHtml(value(summary.medianMfePct,'%'))+' / '+escapeHtml(value(summary.medianMaePct,'%'))+'</strong></span><span><em>Median resolution</em><strong>'+escapeHtml(duration(summary.medianTimeToResolutionMs))+'</strong></span></div>'+
      (cards?'<div class="q-dpg-similar-moves__list">'+cards+'</div>':'<p class="q-dpg-similar-moves__empty">'+escapeHtml(context.reason||'No fully resolved prior range cleared the similarity policy.')+'</p>')+
      '<details><summary>Leakage and probability boundary</summary><p>'+escapeHtml(context.leakageGuard||'')+'</p><p>'+escapeHtml(context.outcomeBoundary||'')+'</p></details></section>';
  };

  const selectedRangeCrossAssetMarkup=(range)=>{
    const family=(range?.evidenceFamilies||[]).find(item=>item.id==='cross-asset'),context=family?.data||{};
    if(!family)return '';
    const value=(input,suffix='')=>input!=null&&input!==''&&isFiniteDecisionEvidence(input)?(Number(input)>=0&&suffix==='%'?'+':'')+Number(input).toLocaleString(undefined,{maximumFractionDigits:4})+suffix:'Unavailable';
    const label=(input)=>String(input||'UNAVAILABLE').replaceAll('_',' ');
    if(family.state!=='AVAILABLE'||context.state!=='AVAILABLE')return '<section class="q-dpg-range-cross-asset q-dpg-range-cross-asset--unavailable" data-dpg-range-cross-asset><header><div><small>CROSS-ASSET · SELECTED RANGE</small><h3>Pairwise comparison unavailable</h3></div><span>PAIRWISE · DESCRIPTIVE ONLY</span></header><p>'+escapeHtml(context.dataStory||family.limitations?.[0]||'Not enough aligned benchmark observations exist inside this exact range.')+'</p></section>';
    const windows=context.windows||{},during=windows.during||context.selectedRange||{},classification=context.classification||{};
    const windowCard=(name,item)=>'<article><header><strong>'+escapeHtml(name)+'</strong><span>'+escapeHtml(label(item?.dependenceState||item?.state))+'</span></header><div><span><em>'+escapeHtml(context.asset||'Asset')+' return</em><b>'+escapeHtml(value(item?.assetReturnPct,'%'))+'</b></span><span><em>'+escapeHtml(context.benchmark||'Benchmark')+' return</em><b>'+escapeHtml(value(item?.benchmarkReturnPct,'%'))+'</b></span><span><em>Relative strength</em><b>'+escapeHtml(value(item?.relativeStrengthPct,'%'))+'</b></span><span><em>Correlation</em><b>'+escapeHtml(value(item?.correlation))+'</b></span><span><em>Beta</em><b>'+escapeHtml(value(item?.beta))+'</b></span><span><em>Aligned points</em><b>'+escapeHtml(String(item?.alignedPriceSamples??0))+'</b></span></div></article>';
    return '<section class="q-dpg-range-cross-asset" data-dpg-range-cross-asset data-classification="'+escapeHtml(classification.id||'UNAVAILABLE')+'"><header><div><small>CROSS-ASSET · SELECTED RANGE</small><h3>'+escapeHtml(context.asset)+' vs '+escapeHtml(context.benchmark)+' · '+escapeHtml(classification.label||'Pairwise context')+'</h3></div><span>PAIRWISE · DESCRIPTIVE ONLY</span></header><p>'+escapeHtml(context.dataStory||'')+'</p><div class="q-dpg-range-cross-asset__facts"><span><em>Selected asset return</em><strong>'+escapeHtml(value(during.assetReturnPct,'%'))+'</strong></span><span><em>Benchmark return</em><strong>'+escapeHtml(value(during.benchmarkReturnPct,'%'))+'</strong></span><span><em>Relative strength</em><strong>'+escapeHtml(value(during.relativeStrengthPct,'%'))+'</strong></span><span><em>Correlation</em><strong>'+escapeHtml(value(during.correlation))+'</strong></span><span><em>Beta</em><strong>'+escapeHtml(value(during.beta))+'</strong></span><span><em>Evidence strength</em><strong>'+escapeHtml(label(context.evidenceStrength))+'</strong></span></div><div class="q-dpg-range-cross-asset__windows">'+windowCard('BEFORE',windows.before)+windowCard('DURING',windows.during)+windowCard('AFTER',windows.after)+'</div><details><summary>Classification, method and limitations</summary><p><strong>'+escapeHtml(classification.label||'Context')+':</strong> '+escapeHtml(classification.rationale||'')+'</p><p>'+escapeHtml(context.method||'')+'</p><p>'+escapeHtml(context.boundary||'')+'</p><ul>'+(context.limitations||[]).map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul><small>Provider: '+escapeHtml(context.provider||family.source||'Unavailable')+' · eligibility impact: none</small></details></section>';
  };

  const rangeEvidenceMarkup=(data)=>{
    const range=data?.rangeEvidence;if(!range||range.state!=='AVAILABLE'||!range.summary)return '';
    const summary=range.summary,coverage=Array.isArray(range.coverage)?range.coverage:[],comparison=range.comparison||{};
    const value=(input,suffix='')=>input!=null&&input!==''&&isFiniteDecisionEvidence(input)?Number(input).toLocaleString(undefined,{maximumFractionDigits:4})+suffix:'Unavailable';
    const scope=(item)=>String(item?.temporalScope||'UNAVAILABLE').replaceAll('_',' ');
    const card=(label,item)=>'<article><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(item?.state||'UNAVAILABLE')+'</strong><small>'+escapeHtml(scope(item))+'</small></article>';
    const windowCard=(label,item)=>'<article><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value(item?.returnPct,'%'))+'</strong><small>'+escapeHtml(String(item?.samples??0))+' candles · range '+escapeHtml(value(item?.rangePct,'%'))+' · vol '+escapeHtml(value(item?.realizedVolatilityPct,'%'))+'</small></article>';
    const historical=range.evidenceFamilies?.filter(item=>!String(item.id||'').endsWith('-current'))||[];
    const current=range.evidenceFamilies?.filter(item=>String(item.temporalScope)==='CURRENT_CONTEXT')||[];
    const rangeState=state.rangeEvidenceLoading?'<p class="q-dpg-range-fetch-state">Loading exact historical range evidence…</p>':state.rangeEvidenceError?'<p class="q-dpg-range-fetch-state q-dpg-range-fetch-state--error">'+escapeHtml(state.rangeEvidenceError)+'</p>':'';
    return '<section class="q-dpg-range-intelligence" data-dpg-range-intelligence><header><div><small>SELECTED MOVE INTELLIGENCE · EXACT RANGE</small><h2>'+escapeHtml(value(summary.returnPct,'%'))+' · '+escapeHtml(summary.direction)+' · '+escapeHtml(String(summary.candles))+' candles</h2></div><span>Association, not proof of causation</span></header>'+rangeState+'<p class="q-dpg-range-story">'+escapeHtml(range.dataStory||'')+'</p><div class="q-dpg-range-intelligence__facts"><span><em>High</em><strong>'+escapeHtml(value(summary.high))+'</strong></span><span><em>Low</em><strong>'+escapeHtml(value(summary.low))+'</strong></span><span><em>Volatility</em><strong>'+escapeHtml(value(summary.volatilityPct,'%'))+'</strong></span><span><em>Selection ID</em><strong>'+escapeHtml(range.request?.selectionId||'Unavailable')+'</strong></span></div><h3>Before / during / after</h3><div class="q-dpg-range-comparison">'+windowCard('Before',comparison.before)+windowCard('During',comparison.during)+windowCard('After',comparison.after)+'</div>'+selectedRangeCrossAssetMarkup(range)+historicalTimelineMarkup(range.timeline)+rangeFlowMarkup(range.flowParticipation)+'<h3>Evidence coverage</h3><div class="q-dpg-range-coverage">'+historical.map(item=>card(item.label,item)).join('')+'</div><details><summary>CURRENT CONTEXT — not historical evidence</summary><div class="q-dpg-range-coverage">'+current.map(item=>card(item.label,item)).join('')+'</div><p>'+escapeHtml(range.currentContextBoundary||'')+'</p></details><details><summary>Uncertainty and attribution boundary</summary><ul>'+(range.uncertainty||[]).map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul><p>'+escapeHtml(range.causalityBoundary||'')+'</p></details></section>';
  };

  const decisionModeSwitcher=()=>{
    const modes=[
      ['simple','Simple','Answer · setup · chart'],
      ['advanced','Advanced','Evidence · structure · scenarios'],
      ['research','Research Lab','Models · calibration · provenance']
    ];
    return '<nav class="q-dpg-mode-switcher" aria-label="Decision Intelligence depth" data-dpg-mode-switcher><div><small>RESEARCH DEPTH</small><strong>'+escapeHtml(modes.find(([id])=>id===state.uiMode)?.[1]||'Simple')+' Mode</strong></div><div role="tablist" aria-label="Decision Intelligence mode">'+modes.map(([id,label,description])=>'<button type="button" role="tab" id="qelly-decision-tab-'+id+'" class="q-dpg-ui-mode'+(state.uiMode===id?' is-active':'')+'" data-dpg-ui-mode="'+id+'" aria-selected="'+(state.uiMode===id?'true':'false')+'" aria-controls="qelly-decision-panel-'+id+'" tabindex="'+(state.uiMode===id?'0':'-1')+'"><span>'+escapeHtml(label)+'</span><small>'+escapeHtml(description)+'</small></button>').join('')+'</div><p>'+escapeHtml(state.uiMode==='simple'?'Primary decision first. Advanced evidence remains available without crowding the main answer.':state.uiMode==='advanced'?'Practitioner evidence is expanded while model internals remain in Research Lab.':'Full research diagnostics, calibration, provenance and operational boundaries. Research-only; no execution.')+'</p></nav>';
  };

  const assetEvidenceProfileMarkup=(data)=>{
    const profile=data?.evidenceProfile||data?.evidence?.profile;
    if(!profile)return '';
    const coverage=profile.coverage||{},modules=Array.isArray(profile.modules)?profile.modules:[];
    const stateLabel=(value)=>String(value||'UNAVAILABLE').replaceAll('_',' ');
    const cards=modules.map(item=>'<article data-evidence-module="'+escapeHtml(item.id)+'" data-evidence-applicability="'+escapeHtml(item.applicability)+'" data-evidence-state="'+escapeHtml(item.state)+'"><header><strong>'+escapeHtml(item.label)+'</strong><span>'+escapeHtml(item.applicability)+'</span></header><b>'+escapeHtml(stateLabel(item.state))+'</b><small>'+escapeHtml(item.sourceRequirement||'Source requirement unavailable')+'</small></article>').join('');
    return '<section class="q-dpg-asset-evidence-profile" data-dpg-evidence-profile="'+escapeHtml(profile.profileId||'unknown')+'"><header><div><small>ASSET-CLASS EVIDENCE PROFILE</small><h2>'+escapeHtml(profile.label||'Evidence profile')+'</h2><p>'+escapeHtml(profile.description||'')+'</p></div><span>'+escapeHtml(stateLabel(profile.state))+'</span></header><div class="q-dpg-asset-evidence-profile__coverage"><span><em>Applicable</em><strong>'+escapeHtml(String(coverage.applicable??0))+'</strong></span><span><em>Available</em><strong>'+escapeHtml(String(coverage.available??0))+'</strong></span><span><em>Partial</em><strong>'+escapeHtml(String(coverage.partial??0))+'</strong></span><span><em>Unavailable</em><strong>'+escapeHtml(String(coverage.unavailable??0))+'</strong></span></div><details><summary>Evidence applicability and source requirements</summary><div class="q-dpg-asset-evidence-profile__modules">'+cards+'</div><p>'+escapeHtml(profile.boundary||'')+'</p><p>'+escapeHtml(profile.weightingBoundary||'')+'</p></details></section>';
  };

  const assetClassEvidenceWeightingMarkup=(data)=>{
    const policy=data?.assetClassEvidence||data?.evidence?.assetClassWeighting;
    if(!policy)return '';
    const modules=Array.isArray(policy.modules)?[...policy.modules]:[];
    const top=modules.sort((a,b)=>(Number(b.baseRelevanceWeight)||0)-(Number(a.baseRelevanceWeight)||0)||String(a.label||'').localeCompare(String(b.label||'')));
    const label=(value)=>String(value||'UNAVAILABLE').replaceAll('_',' ');
    const pct=(value)=>isFiniteDecisionEvidence(value)?Math.round(Number(value)*100)+'%':'—';
    const cards=top.map(item=>'<article data-asset-class-evidence="'+escapeHtml(item.id)+'" data-state="'+escapeHtml(item.state)+'"><header><strong>'+escapeHtml(item.label)+'</strong><span>'+escapeHtml(label(item.state))+'</span></header><div><b>'+escapeHtml(pct(item.baseRelevanceWeight))+'</b><small>base relevance</small><b>'+escapeHtml(pct(item.effectiveRelevanceWeight))+'</b><small>effective</small></div><p>'+escapeHtml(item.decisionRole||'CONTEXT ONLY')+' · directional weight '+escapeHtml(String(item.directionalWeight??0))+'</p><small>'+escapeHtml(item.sourceRequirement||item.purpose||'')+'</small></article>').join('');
    const missing=(policy.missingHighRelevance||[]).map(item=>'<li><strong>'+escapeHtml(item.label||item.id)+'</strong><span>'+escapeHtml(pct(item.baseRelevanceWeight))+' relevance · unavailable</span><small>'+escapeHtml(item.sourceRequirement||'Governed source required')+'</small></li>').join('');
    return '<section class="q-dpg-asset-class-weighting" data-dpg-asset-class-weighting><header><div><small>ASSET-CLASS FUNDAMENTAL / MACRO WEIGHTING</small><h2>'+escapeHtml(policy.label||policy.profileId||'Evidence policy')+' · '+escapeHtml(label(policy.band))+'</h2><p>Relevance changes with timeframe and research horizon. Missing data never receives effective weight.</p></div><span>'+escapeHtml(String(policy.coverage?.available??0))+' available · '+escapeHtml(String(policy.coverage?.highRelevanceMissing??0))+' high-relevance missing</span></header><div class="q-dpg-asset-class-weighting__summary"><span><em>Interval</em><strong>'+escapeHtml(policy.interval||'—')+'</strong></span><span><em>Horizon</em><strong>'+escapeHtml(policy.horizon||'—')+'</strong></span><span><em>Effective relevance</em><strong>'+escapeHtml(String(policy.coverage?.effectiveRelevanceTotal??0))+'</strong></span><span><em>Directional re-vote</em><strong>0 · prohibited</strong></span></div><details><summary>Evidence relevance receipts</summary><div class="q-dpg-asset-class-weighting__modules">'+cards+'</div>'+(missing?'<h3>High-relevance evidence still missing</h3><ul>'+missing+'</ul>':'')+'<p>'+escapeHtml(policy.boundary||'')+'</p><p>'+escapeHtml(policy.providerBoundary||'')+'</p></details></section>';
  };

  const smcPriceActionMarkup=(data,escapeHtml)=>{
    const smc=data?.quant?.smc,pa=data?.quant?.priceAction;
    if(!smc&&!pa)return '';
    const label=(value)=>String(value||'UNAVAILABLE').replaceAll('_',' ');
    const fvg=smc?.fairValueGaps||{},ob=smc?.orderBlock||{},pd=smc?.premiumDiscount||{},rl=smc?.rangeLiquidity||{};
    const metric=(name,value)=>'<span><em>'+escapeHtml(name)+'</em><strong>'+escapeHtml(label(value))+'</strong></span>';
    return '<section class="q-dpg-smc-pa" data-dpg-smc-price-action><header><div><small>DETERMINISTIC SMC / PRICE ACTION</small><h2>Structure rules, not discretionary labels</h2><p>Every state below is derived from explicit OHLCV rules and remains research evidence only.</p></div><span>'+escapeHtml(label(smc?.direction||'NEUTRAL'))+' SMC · '+escapeHtml(label(pa?.direction||'NEUTRAL'))+' PA</span></header>'+
      '<div class="q-dpg-smc-pa__grid"><article><h3>SMC / structure</h3><div>'+metric('Swing sequence',smc?.swingSequence)+metric('BOS',smc?.breakOfStructure)+metric('CHOCH',smc?.changeOfCharacter)+metric('Displacement',smc?.displacement?.direction)+metric('Liquidity sweep',smc?.liquiditySweep)+metric('Premium / discount',pd.state)+'</div><p>FVGs '+escapeHtml(String(fvg.count??0))+' · active '+escapeHtml(String(fvg.activeCount??0))+' · equal-high pools '+escapeHtml(String(rl.equalHighPools??0))+' · equal-low pools '+escapeHtml(String(rl.equalLowPools??0))+'.</p><p>Order block: '+escapeHtml(label(ob.direction||ob.state||'NONE'))+(ob.low!=null?' · '+escapeHtml(String(ob.low))+'–'+escapeHtml(String(ob.high)):'')+(ob.mitigated?' · mitigated':'')+'.</p></article>'+
      '<article><h3>Price action</h3><div>'+metric('Breakout',pa?.breakout)+metric('Retest',pa?.retest)+metric('Rejection',pa?.rejection)+metric('Engulfing',pa?.engulfing)+metric('Pin bar',pa?.pinBar)+metric('Inside / outside',pa?.insideBar?'INSIDE':pa?.outsideBar?'OUTSIDE':'NONE')+metric('Compression / expansion',pa?.compressionExpansion)+metric('Failed breakout',pa?.failedBreakout)+'</div><p>Gap '+escapeHtml(label(pa?.gap))+' · continuation '+escapeHtml(label(pa?.trendContinuation))+' · exhaustion '+escapeHtml(label(pa?.exhaustion))+'.</p></article></div>'+
      '<details><summary>Deterministic method boundary</summary><p>'+escapeHtml(smc?.methodology||'')+'</p><p>'+escapeHtml(pa?.methodology||'')+'</p><p>These rules do not identify institutional intent, smart-money actors, or causal flow. Overlapping structure features are handled by formula-governance redundancy control.</p></details></section>';
  };

  const quantResearchMarkup=(data,escapeHtml)=>{
    const q=data?.quant?.researchLibrary;
    if(!q||q.state!=='DERIVED')return '';
    const num=(value,suffix='')=>isFiniteDecisionEvidence(value)?Number(value).toLocaleString(undefined,{maximumFractionDigits:4})+suffix:'Unavailable';
    const state=(value)=>String(value||'UNAVAILABLE').replaceAll('_',' ');
    const item=(label,value,suffix='')=>'<span><em>'+escapeHtml(label)+'</em><strong>'+escapeHtml(num(value,suffix))+'</strong></span>';
    const formulas=Array.isArray(q.formulaCatalog)?q.formulaCatalog:[];
    const families=new Map();
    for(const formula of formulas){
      if(!families.has(formula.family))families.set(formula.family,[]);
      families.get(formula.family).push(formula);
    }
    const inventory=[...families.entries()].map(([family,rows])=>'<section><h3>'+escapeHtml(String(family).replaceAll('_',' '))+'</h3><ul>'+rows.map(formula=>'<li><strong>'+escapeHtml(formula.id)+'</strong><span>'+escapeHtml(String(formula.role).replaceAll('_',' '))+'</span><small>'+escapeHtml(formula.definition)+'</small></li>').join('')+'</ul></section>').join('');
    return '<section class="q-dpg-quant-research" data-dpg-quant-research><header><div><small>ADVANCED QUANT RESEARCH LIBRARY</small><h2>'+escapeHtml(state(q.state))+' · '+escapeHtml(String(q.sampleSize))+' candles</h2><p>Formula breadth for research diagnostics. These metrics are descriptive/contextual by default and are not independent votes.</p></div><span>'+escapeHtml(String(formulas.length))+' governed formulas</span></header>'+
      '<div class="q-dpg-quant-research__grid">'+
        '<article><h3>Returns / volatility</h3><div>'+item('Cumulative',q.returns?.cumulativePct,'%')+item('Rolling 20',q.returns?.rolling20Pct,'%')+item('Realized vol',q.volatility?.realizedPct,'%')+item('EWMA vol',q.volatility?.ewmaPct,'%')+item('Parkinson',q.volatility?.parkinsonPct,'%')+item('Garman-Klass',q.volatility?.garmanKlassPct,'%')+item('Rogers-Satchell',q.volatility?.rogersSatchellPct,'%')+item('ATR %',q.volatility?.normalizedAtr14Pct,'%')+'</div><p>Volatility regime '+escapeHtml(state(q.volatility?.regime))+' · percentile '+escapeHtml(num(q.volatility?.percentile))+'</p></article>'+
        '<article><h3>Distribution / risk</h3><div>'+item('Z-score',q.distribution?.zScore)+item('Robust Z',q.distribution?.robustZScore)+item('VaR 95',q.risk?.historicalVaR95Pct,'%')+item('ES 95',q.risk?.expectedShortfall95Pct,'%')+item('Max drawdown',q.risk?.maxDrawdownPct,'%')+item('Tail ratio',q.risk?.tailRatio)+'</div><p>Empirical tail and drawdown context; not a future-loss guarantee.</p></article>'+
        '<article><h3>Trend / momentum</h3><div>'+item('OLS slope',q.trend?.olsSlopePctPerBar,'%/bar')+item('Robust slope',q.trend?.robustSlopePctPerBar,'%/bar')+item('Efficiency',q.trend?.efficiencyRatio)+item('ADX',q.trend?.adx14)+item('RSI',q.momentum?.rsi14)+item('ROC 14',q.momentum?.roc14Pct,'%')+item('MACD hist',q.momentum?.macd?.histogramPct,'%')+item('Stochastic',q.momentum?.stochasticK14)+'</div><p>SMA '+escapeHtml(state(q.trend?.sma?.state))+' · EMA '+escapeHtml(state(q.trend?.ema?.state))+' · trend age '+escapeHtml(num(q.trend?.trendAgeBars))+' bars.</p></article>'+
        '<article><h3>Mean reversion / dependence</h3><div>'+item('Bollinger Z',q.meanReversion?.bollingerZ)+item('VWAP deviation',q.meanReversion?.vwapDeviationPct,'%')+item('Range position',q.meanReversion?.rangePosition)+item('Half-life',q.meanReversion?.halfLife?.halfLifeBars,' bars')+item('Benchmark corr',q.dependence?.correlation)+item('Beta',q.dependence?.beta)+item('Spread Z',q.dependence?.spreadZScore)+'</div><p>Half-life '+escapeHtml(state(q.meanReversion?.halfLife?.state))+' · benchmark dependence '+escapeHtml(state(q.dependence?.state))+' · cointegration '+escapeHtml(state(q.dependence?.cointegration?.state))+'.</p></article>'+
        '<article><h3>Technical indicator audit</h3><div>'+item('Donchian upper',q.technical?.donchian?.upper)+item('Donchian lower',q.technical?.donchian?.lower)+item('MFI 14',q.technical?.mfi?.value)+item('CMF 20',q.technical?.cmf?.value)+item('OBV Δ20',q.technical?.obv?.change20)+item('Pivot',q.technical?.pivots?.pivot)+'</div><p>Ichimoku '+escapeHtml(state(q.technical?.ichimoku?.cloudPosition))+' · Supertrend '+escapeHtml(state(q.technical?.supertrend?.state))+'. Redundant indicators remain excluded from voting.</p></article>'+
      '</div>'+
      '<details><summary>Formula definitions, roles and unavailable methods</summary><div class="q-dpg-quant-research__inventory">'+inventory+'</div><p>'+escapeHtml(q.boundary||'')+'</p><p>Block bootstrap: '+escapeHtml(state(q.forecasting?.blockBootstrap?.state))+' · Monte Carlo: '+escapeHtml(state(q.forecasting?.monteCarlo?.state))+' · state-space/Kalman: '+escapeHtml(state(q.forecasting?.stateSpace?.state))+'.</p></details>'+
    '</section>';
  };

  const formulaGovernanceMarkup=(data,escapeHtml)=>{
    const governance=data?.formulaGovernance||data?.qellyView?.formulaGovernance;
    if(!governance)return '';
    const contributors=Array.isArray(governance.topContributors)?governance.topContributors:[];
    const features=Array.isArray(governance.features)?governance.features:[];
    const groups=Array.isArray(governance.redundancyGroups)?governance.redundancyGroups:[];
    const score=(value)=>isFiniteDecisionEvidence(value)?(Number(value)>=0?'+':'')+Number(value).toFixed(3):'—';
    const cards=contributors.slice(0,8).map((item,index)=>'<article><span>#'+(index+1)+' · '+escapeHtml(String(item.family||'formula').replaceAll('_',' '))+'</span><strong>'+escapeHtml(item.label||item.id)+'</strong><b>'+escapeHtml(String(item.direction||'NEUTRAL').replaceAll('_',' '))+' · '+escapeHtml(score(item.contribution))+'</b><small>'+escapeHtml(String(item.role||'context').replaceAll('_',' '))+(item.suppressedBy?' · suppressed by '+escapeHtml(item.suppressedBy):'')+'</small></article>').join('');
    const inventory=features.map(item=>'<li><strong>'+escapeHtml(item.label||item.id)+'</strong><span>'+escapeHtml(String(item.family||''))+' · '+escapeHtml(String(item.role||''))+' · '+escapeHtml(String(item.state||'UNAVAILABLE'))+'</span><small>strength '+escapeHtml(String(item.strength??'—'))+' · reliability '+escapeHtml(String(item.reliability??'—'))+' · relevance '+escapeHtml(String(item.relevance??'—'))+(item.suppressedBy?' · REDUNDANCY-SUPPRESSED BY '+escapeHtml(item.suppressedBy):'')+'</small></li>').join('');
    const redundancy=groups.map(group=>'<li><strong>'+escapeHtml(group.group)+'</strong><span>Primary '+escapeHtml(group.primary||'none')+'</span><small>'+(group.suppressed?.length?'Suppressed '+escapeHtml(group.suppressed.join(', ')):'No redundant feature suppressed')+'</small></li>').join('');
    return '<section id="qelly-decision-formula-governance" class="q-dpg-formula-governance" data-dpg-formula-governance><header><div><small>FORMULA GOVERNANCE · ENSEMBLE ATTRIBUTION</small><h2>'+escapeHtml(String(governance.state||'UNAVAILABLE').replaceAll('_',' '))+'</h2><p>Family-level evidence attribution with deterministic redundancy control.</p></div><span>'+escapeHtml(String(governance.activeDirectionalFamilies??0))+' active families · '+escapeHtml(String(governance.suppressedFeatureCount??0))+' redundant suppressed</span></header><div class="q-dpg-formula-governance__summary"><span><em>Net directional score</em><strong>'+escapeHtml(score(governance.netDirectionalScore))+'</strong></span><span><em>Base-action support</em><strong>'+escapeHtml(score(governance.baseActionSupport))+'</strong></span><span><em>Net direction</em><strong>'+escapeHtml(String(governance.netDirection||'NEUTRAL'))+'</strong></span><span><em>Severe contradiction</em><strong>'+escapeHtml(governance.severeContradiction?'YES · VETO':'NO')+'</strong></span></div><div class="q-dpg-formula-governance__contributors">'+cards+'</div><details><summary>Formula inventory and redundancy receipts</summary><div class="q-dpg-formula-governance__details"><section><h3>Feature receipts</h3><ul>'+inventory+'</ul></section><section><h3>Redundancy groups</h3><ul>'+redundancy+'</ul></section></div><p>'+escapeHtml(governance.methodology||'')+'</p><p>'+escapeHtml(governance.boundary||'')+'</p></details></section>';
  };

  const advancedDecisionContent=(data)=>{
    return '<section id="qelly-decision-panel-advanced" class="q-dpg-mode-panel q-dpg-mode-panel--advanced" data-dpg-mode-panel="advanced" role="tabpanel" aria-labelledby="qelly-decision-tab-advanced" tabindex="0"><header class="q-dpg-mode-panel__header"><div><small>ADVANCED MODE</small><h2>Practitioner evidence and scenario research</h2></div><span>Exact metrics · contradictions preserved</span></header>'+
      tradeResearchMarkup(data,escapeHtml)+
      smcPriceActionMarkup(data,escapeHtml)+
      formulaGovernanceMarkup(data,escapeHtml)+
      assetEvidenceProfileMarkup(data)+
      assetClassEvidenceWeightingMarkup(data)+
      pastPresentFutureMarkup(data,escapeHtml)+contradictionMarkup(data,escapeHtml)+
      marketStructureContext(data,escapeHtml)+multiTimeframe(data,escapeHtml)+liquidityContext(data,escapeHtml)+derivativesContext(data,escapeHtml)+crossAssetContext(data,escapeHtml)+macroContext(data,escapeHtml)+eventRiskContext(data,escapeHtml)+newsResearchContext(data,escapeHtml)+adSlot('decision-intelligence-inline')+
      '<section class="q-dpg-evidence"><header><div><small>EVIDENCE RANKING</small><h2>What best explains the move</h2></div><span>News: '+escapeHtml(data.evidence?.news?.state||'unavailable')+' · L2: '+escapeHtml(data.evidence?.liquidity?.state||'unavailable')+' · Funding/OI: '+escapeHtml(data.evidence?.derivatives?.state||'unavailable')+' · Cross-asset: '+escapeHtml(data.evidence?.crossAsset?.state||'unavailable')+' · Macro: '+escapeHtml(data.evidence?.macro?.state||'unavailable')+' · Event calendar: '+escapeHtml(data.evidence?.eventRisk?.state||'unavailable')+' · Liquidations: unavailable, not inferred</span></header>'+evidence(data)+'</section>'+
      '<section class="q-dpg-simple-next"><div><small>MODEL-LEVEL DETAIL</small><h2>Research Lab keeps the raw diagnostics separate</h2><p>Open Research Lab for the observed setup ledger, model trace, calibration, analog diagnostics, health/SLO evidence and full methodology.</p></div><button class="q-button q-button--secondary" type="button" data-dpg-ui-mode-jump="research">Open Research Lab</button></section>'+
    '</section>';
  };

  const decisionChatPrompt=(kind,data,custom='')=>{
    const selection=state.selection||state.draft||null,action=data?.qellyView?.action||'NO TRADE';
    if(String(custom||'').trim())return String(custom).trim();
    if(kind==='selected'&&selection)return 'Explain only this selected historical '+state.asset+' range from '+displayTime(selection.start)+' to '+displayTime(selection.end)+'. Use the exact selected-range evidence, timeline and flow/participation evidence where available. Separate observed evidence from inference, disclose unavailable historical data, and do not substitute CURRENT CONTEXT for historical evidence.';
    if(kind==='setup')return 'Explain this current '+state.asset+' setup from Decision Intelligence. Cover setup status, entry, stop/invalidation, targets, selected R:R, calibration, strongest support, strongest contradiction, expiry and event risk. If the setup is not currently valid, say so explicitly. Research only; no execution.';
    if(kind==='no-trade')return 'Explain why the current '+state.asset+' Decision Intelligence view is NO TRADE. Identify the evidence gate, strongest contradiction, calibration state, missing conditions, event/data risk and what would have to change before a setup could become valid.';
    if(kind==='changed')return 'Explain what changed in the current '+state.asset+' Decision Intelligence view versus the previous comparable snapshot. Use only evidence-backed changes and distinguish unchanged evidence from new evidence.';
    return 'Explain the current '+state.asset+' Decision Intelligence view ('+action+'). Cover the primary answer, setup or no-trade state, evidence gate, strongest support and contradiction, selected R:R, calibration, event risk, selected range if any, and what to watch next.';
  };
  const decisionChatContext=(data)=>{
    const selection=state.selection||state.draft||null,trade=data?.tradeResearch||{},action=data?.qellyView?.action||'NO TRADE';
    const lifecycle=String(trade.lifecycle?.state||trade.status||'NO_TRADE');
    const hasSetup=trade.status==='VALID'||['VALID','TRIGGERED','ACTIVE'].includes(lifecycle);
    const hasChange=Boolean(state.previousSnapshot&&data?.decisionSnapshot);
    const primary=selection?{kind:'selected',label:'Explain selected move',state:'SELECTED RANGE'}:hasSetup?{kind:'setup',label:'Explain this setup',state:'SETUP CONTEXT'}:action==='NO TRADE'?{kind:'no-trade',label:'Why NO TRADE?',state:'NO TRADE CONTEXT'}:hasChange?{kind:'changed',label:'What changed?',state:'DECISION CHANGE'}:{kind:'view',label:'Analyze this asset',state:'QELLY VIEW'};
    return {
      route:'decision-provenance',contextType:'decision',stateLabel:primary.state,actionLabel:primary.label,
      meta:state.asset+' · '+state.interval+' · '+action,mode:'decision',asset:state.asset,timeframe:state.interval,
      decisionContext:{horizon:state.horizon,rr:state.rr,customRr:state.rr==='custom'?state.customRr:null,selection,previousSnapshot:state.previousSnapshot||null},
      prompt:decisionChatPrompt(primary.kind,data)
    };
  };
  const publishDecisionChatContext=(data)=>{
    const detail=decisionChatContext(data);
    globalThis.__QELLY_CHAT_CONTEXT__=detail;
    document.dispatchEvent(new CustomEvent('qelly:chat-context',{detail}));
  };

  const nextMoveResearchMarkup=(data)=>{
    const research=data?.nextMoveResearch;if(!research)return '';
    const requested=state.nextMoveBars==='custom'?Math.max(1,Math.min(12,Number(state.nextMoveCustomBars)||8)):Number(state.nextMoveBars)||1;
    const item=(research.horizons||[]).find(entry=>Number(entry.horizonBars)===requested)||research.nextCandle;
    if(!item)return '';
    const probabilities=item.publishedProbabilities;
    const probability=(key)=>probabilities&&isFiniteDecisionEvidence(probabilities[key])?(Number(probabilities[key])*100).toFixed(1)+'%':'UNCALIBRATED';
    const moneyOrUnavailable=(value)=>isFiniteDecisionEvidence(value)?money(Number(value)):'Unavailable';
    const pctOrUnavailable=(value)=>isFiniteDecisionEvidence(value)?Number(value).toFixed(2)+'%':'Unavailable';
    const ci=item.calibration?.calibratedLeadingProbabilityConfidenceInterval95;
    const top=String(item.topScenario?.id||'unavailable').toUpperCase(),alternate=String(item.alternateScenario?.id||'unavailable').toUpperCase();
    const controls=[['1','Next candle'],['3','3 candles'],['5','5 candles'],['custom','Custom']].map(([value,label])=>'<button type="button" data-dpg-next-bars="'+value+'" class="'+(state.nextMoveBars===value?'is-active':'')+'" aria-pressed="'+(state.nextMoveBars===value?'true':'false')+'">'+label+'</button>').join('');
    return '<section class="q-dpg-next-move" data-dpg-next-move data-active-bars="'+escapeHtml(String(item.horizonBars))+'"><header><div><small>NEXT MOVE RESEARCH · PROJECTED</small><h2>'+escapeHtml(item.horizonLabel||'NEXT MOVE')+'</h2><p>Probabilistic scenario research — future candles are not observed.</p></div><span class="q-dpg-next-move__state">'+escapeHtml(String(item.probabilityState||'UNCALIBRATED').replaceAll('_',' '))+'</span></header>'+
      '<div class="q-dpg-next-move__controls" role="toolbar" aria-label="Next move horizon">'+controls+(state.nextMoveBars==='custom'?'<label><span>Custom candles</span><input type="number" min="1" max="12" step="1" value="'+escapeHtml(String(state.nextMoveCustomBars))+'" data-dpg-next-custom></label>':'')+'</div>'+
      '<div class="q-dpg-next-move__edge"><strong>'+escapeHtml(String(item.edgeState||'UNCERTAIN').replaceAll('_',' '))+'</strong><span>Scenario separation '+escapeHtml(item.modelScenarioSeparation==null?'Unavailable':(Number(item.modelScenarioSeparation)*100).toFixed(1)+' pts')+'</span><small>'+escapeHtml(item.edgeBoundary||'NO EDGE / UNCERTAIN remains a valid research outcome.')+'</small></div>'+ 
      '<div class="q-dpg-next-move__probabilities" aria-label="Next move probabilities"><article><span>Bullish</span><strong>'+escapeHtml(probability('bullish'))+'</strong></article><article><span>Neutral / small range</span><strong>'+escapeHtml(probability('neutral'))+'</strong></article><article><span>Bearish</span><strong>'+escapeHtml(probability('bearish'))+'</strong></article></div>'+
      (!probabilities?'<p class="q-dpg-next-move__withheld"><strong>Numeric probabilities withheld.</strong> The dedicated next-move calibration gate does not support publishing this distribution as calibrated probability.</p>':'')+
      '<div class="q-dpg-next-move__facts"><article><span>Expected range · inner 50%</span><strong>'+escapeHtml(moneyOrUnavailable(item.expectedRange?.p25))+' – '+escapeHtml(moneyOrUnavailable(item.expectedRange?.p75))+'</strong><small>Width '+escapeHtml(pctOrUnavailable(item.expectedRange?.widthPct))+'</small></article><article><span>Likely high / low band</span><strong>'+escapeHtml(moneyOrUnavailable(item.likelyBand?.low))+' – '+escapeHtml(moneyOrUnavailable(item.likelyBand?.high))+'</strong><small>Model p05–p95 band</small></article><article><span>Expected volatility</span><strong>'+escapeHtml(pctOrUnavailable(item.expectedVolatilityPct))+'</strong><small>'+escapeHtml(String(item.horizonBars))+' candle horizon</small></article><article><span>Top / alternate scenario</span><strong>'+escapeHtml(top)+' / '+escapeHtml(alternate)+'</strong><small>Scenario identity remains available even when probability is withheld</small></article></div>'+
      '<div class="q-dpg-next-move__calibration"><span><em>Calibration</em><strong>'+escapeHtml(String(item.calibration?.state||'UNCALIBRATED'))+'</strong></span><span><em>Resolved sample</em><strong>'+escapeHtml(String(item.calibration?.sampleSize??0))+' / '+escapeHtml(String(item.calibration?.minimumSampleGate??36))+'</strong></span><span><em>Brier score</em><strong>'+escapeHtml(item.calibration?.brierScore==null?'Unavailable':String(item.calibration.brierScore))+'</strong></span><span><em>Leading empirical bin</em><strong>'+escapeHtml(item.calibration?.calibratedLeadingProbability==null?'Unavailable':(Number(item.calibration.calibratedLeadingProbability)*100).toFixed(1)+'%')+'</strong><small>'+(ci?'95% CI '+escapeHtml((Number(ci.low)*100).toFixed(1))+'–'+escapeHtml((Number(ci.high)*100).toFixed(1))+'%':'No publishable confidence interval')+'</small></span></div>'+
      '<div class="q-dpg-next-move__scenario"><span><strong>Projection invalidation</strong>'+escapeHtml(item.invalidation||'Recompute when new observed evidence arrives.')+'</span><span><strong>Observed vs projected boundary</strong>'+escapeHtml(research.observedVsProjectedBoundary||'Future values are projected research only.')+'</span></div>'+
      '<details><summary>Probability governance</summary><p>'+escapeHtml(item.calibration?.highProbabilityRule||research.probabilityBoundary||'')+'</p><p>'+escapeHtml(item.boundary||'')+'</p><p>'+escapeHtml(item.methodology||'')+'</p></details>'+
    '</section>';
  };

  const cfScenarioUx=(data)=>buildDecisionScenarioUx(data,{requestedRr:state.rr,customRr:state.customRr});
  const cfProbability=(item)=>{
    if(isFiniteDecisionEvidence(item?.publishedProbability))return (Number(item.publishedProbability)*100).toFixed(1)+'%';
    return 'UNCALIBRATED';
  };
  const cfScenarioMarkup=(data)=>{
    const ux=cfScenarioUx(data),cards=ux.scenarios||[];
    const card=(item)=>{
      const target=item.targetRange&&isFiniteDecisionEvidence(item.targetRange.low)&&isFiniteDecisionEvidence(item.targetRange.high)?money(item.targetRange.low)+' → '+money(item.targetRange.high):'Unavailable';
      const modelShare=isFiniteDecisionEvidence(item.modelScenarioShare)?(Number(item.modelScenarioShare)*100).toFixed(1)+'% model share':'No publishable model share';
      const sample=Number(item.calibrationSampleSize)||0,gate=Number(item.calibrationMinimumSampleGate)||0;
      return '<article class="q-dpg-cf-scenario q-dpg-cf-scenario--'+escapeHtml(item.id)+'" data-dpg-cf-scenario="'+escapeHtml(item.id)+'"><header><div><small>'+escapeHtml(item.label)+'</small><h3>'+escapeHtml(cfProbability(item))+'</h3></div><span>'+escapeHtml(String(item.probabilityState||'UNCALIBRATED').replaceAll('_',' '))+'</span></header><dl><div><dt>Target zone</dt><dd>'+escapeHtml(target)+'</dd></div><div><dt>What must happen</dt><dd>'+escapeHtml(item.whatMustHappen||'Unavailable')+'</dd></div><div><dt>Invalidation</dt><dd>'+escapeHtml(item.invalidation||'Unavailable')+'</dd></div><div><dt>Calibration</dt><dd>n='+escapeHtml(String(sample))+(gate?' / gate '+escapeHtml(String(gate)):'')+'</dd></div></dl>'+(item.publishedProbability==null&&item.modelScenarioShare!=null?'<p><strong>'+escapeHtml(modelShare)+'</strong> · research model output, not published as calibrated probability.</p>':'')+(item.tailBoundary?'<p>'+escapeHtml(item.whatChanges||'Tail bounds are modelled distribution limits only.')+'</p>':'')+'</article>';
    };
    return '<section class="q-dpg-cf-scenarios" data-dpg-cf-scenarios><header><div><small>SCENARIO MAP · WHAT MUST HAPPEN</small><h2>Bull / Base / Bear with explicit invalidation</h2><p>Scenario model output is separated from calibrated probability. High probabilities stay withheld unless the strict empirical gate exists.</p></div><span>RESEARCH ONLY</span></header><div class="q-dpg-cf-scenarios__grid">'+cards.map(card).join('')+'</div></section>';
  };
  const cfWatchNextMarkup=(data)=>{
    const ux=cfScenarioUx(data),items=ux.watchNext||[];
    const icons=['①','②','③','④','⑤'];
    return '<aside class="q-dpg-cf-watch" data-dpg-cf-watch aria-label="What should I watch next?"><header><small>WHAT SHOULD I WATCH?</small><h3>Evidence triggers</h3></header><ol>'+items.map((item,index)=>'<li><span aria-hidden="true">'+icons[index]+'</span><div><strong>'+escapeHtml(item.label)+'</strong><p>'+escapeHtml(item.detail)+'</p><small>'+escapeHtml(String(item.state||item.kind||'WATCH').replaceAll('_',' '))+'</small></div></li>').join('')+'</ol><p>These are reassessment triggers, not guaranteed trade outcomes.</p></aside>';
  };
  const cfSetupSummaryMarkup=(data)=>{
    const ux=cfScenarioUx(data),setup=ux.setup||{},current=ux.lifecycle?.find(item=>item.current)||{icon:'•',label:setup.status||'NO TRADE'},entry=setup.entry;
    const entryText=entry&&isFiniteDecisionEvidence(entry.preferred)?money(entry.preferred)+' · '+escapeHtml(entry.method):'No evidence-qualified entry';
    const zone=entry?.zone?.length===2&&entry.zone.every(value=>isFiniteDecisionEvidence(value))?money(entry.zone[0])+' – '+money(entry.zone[1]):'Unavailable';
    const invalidation=setup.invalidation?.price;
    const invalidationText=isFiniteDecisionEvidence(invalidation?.price)?money(invalidation.price):escapeHtml(invalidation?.condition||'No active price invalidation');
    const probability=formatDecisionProbability(setup.probability);
    const targets=(setup.targets||[]).map(item=>'<span><em>'+escapeHtml(item.id)+' · 1:'+escapeHtml(String(item.ratio))+'</em><strong>'+(isFiniteDecisionEvidence(item.target)?money(item.target):'Unavailable')+'</strong><small>'+escapeHtml(String(item.feasibility||'UNAVAILABLE'))+(isFiniteDecisionEvidence(item.structuralObstruction)?' · obstruction '+money(item.structuralObstruction):'')+'</small></span>').join('');
    const stages=(ux.lifecycle||[]).map(item=>'<span class="'+(item.current?'is-current':'')+'" data-state="'+escapeHtml(item.state)+'"><b aria-hidden="true">'+escapeHtml(item.icon)+'</b><em>'+escapeHtml(item.label)+'</em><small>'+escapeHtml(item.current?'CURRENT':item.state.replaceAll('_',' '))+'</small></span>').join('');
    const rrCards=(ux.rrLadder||[]).map(item=>{
      const target=isFiniteDecisionEvidence(item.target)?money(item.target):'Unavailable';
      const obstruction=isFiniteDecisionEvidence(item.structuralObstruction)?'Obstruction '+money(item.structuralObstruction):'No verified obstruction before target';
      return '<article class="q-dpg-cf-rr-card '+(item.active?'is-active':'')+'" data-dpg-cf-rr-card="'+escapeHtml(item.id)+'"><button type="button" data-dpg-cf-rr="'+escapeHtml(item.id)+'" aria-pressed="'+String(item.active)+'"><span>'+escapeHtml(item.label)+'</span><strong>'+escapeHtml(target)+'</strong><small>'+escapeHtml(String(item.feasibility||'UNAVAILABLE'))+'</small></button><p>'+escapeHtml(String(item.probabilityState||'UNCALIBRATED'))+' · '+escapeHtml(obstruction)+'</p>'+(item.id==='custom'&&item.active?'<label><span>Custom R:R</span><input type="number" min="0.5" max="10" step="0.1" value="'+escapeHtml(String(state.customRr))+'" data-dpg-cf-custom-rr></label>':'')+'</article>';
    }).join('');
    return '<section class="q-dpg-cf-setup" data-dpg-cf-setup><header><div><small>CURRENT SETUP · ONE CLEAN SUMMARY</small><h2>'+escapeHtml(setup.direction||'NO TRADE')+' · '+escapeHtml(String(setup.status||'NO_TRADE').replaceAll('_',' '))+'</h2><p>'+escapeHtml(setup.reason||'No setup explanation is available.')+'</p></div><span class="q-dpg-cf-status"><b aria-hidden="true">'+escapeHtml(current.icon)+'</b>'+escapeHtml(current.label)+'</span></header><div class="q-dpg-cf-setup__facts"><span><em>Direction</em><strong>'+escapeHtml(setup.direction||'NO TRADE')+'</strong></span><span><em>Entry</em><strong>'+entryText+'</strong><small>'+escapeHtml(zone)+'</small></span><span><em>Stop</em><strong>'+(isFiniteDecisionEvidence(setup.stop)?money(setup.stop):'Unavailable')+'</strong></span><span><em>Invalidation</em><strong>'+invalidationText+'</strong></span><span><em>Selected R:R</em><strong>'+escapeHtml(setup.selectedRr||'None')+'</strong><small>'+escapeHtml(setup.selectedFeasibility||'UNAVAILABLE')+'</small></span><span><em>Setup probability</em><strong>'+escapeHtml(probability)+'</strong><small>'+escapeHtml(setup.probabilityState||'UNCALIBRATED')+'</small></span><span><em>Calibration</em><strong>'+escapeHtml(String(setup.modelCalibrationState||'UNCALIBRATED').replaceAll('_',' '))+'</strong><small>setup target-touch probability remains separate</small></span><span><em>Expiry</em><strong>'+(setup.expiryAt?escapeHtml(displayTime(setup.expiryAt)):'Unavailable')+'</strong></span><span><em>Event risk</em><strong>'+escapeHtml(String(setup.eventRisk?.level||'UNAVAILABLE'))+'</strong><small>'+escapeHtml(String(setup.eventRisk?.state||'UNAVAILABLE'))+'</small></span></div><div class="q-dpg-cf-targets"><strong>T1 / T2 / T3 / T4</strong><div>'+targets+'</div></div><div class="q-dpg-cf-lifecycle" aria-label="Setup lifecycle status"><strong>Lifecycle · text + icon</strong><div>'+stages+'</div><p>Target milestones are never marked reached without persisted observed setup history.</p></div><section class="q-dpg-cf-rr" data-dpg-cf-rr-ladder><header><div><small>R:R VISUAL LADDER</small><h3>1:1 · 1:2 · 1:3 · 1:4 · Auto · Custom</h3></div><span>target · feasibility · probability state · obstruction</span></header><div>'+rrCards+'</div></section><p class="q-dpg-cf-setup__boundary">'+escapeHtml(setup.probabilityBoundary||'Target-touch probability is not fabricated.')+'</p></section>';
  };

  const content=(data)=>{
    const view=data.qellyView,move=data.selection;
    const simple='<section id="qelly-decision-panel-simple" class="q-dpg-mode-panel q-dpg-mode-panel--simple" data-dpg-mode-panel="simple" role="tabpanel" aria-labelledby="qelly-decision-tab-simple" tabindex="0">'+
      '<section class="q-dpg-truth"><span class="q-status q-status--'+(data.truthState==='LIVE'?'live':data.truthState.toLowerCase())+'">'+escapeHtml(data.truthState)+'</span><strong>'+escapeHtml(data.asset)+' / '+escapeHtml(data.interval)+'</strong><span>'+escapeHtml(data.market.currentState.label)+' · updated '+new Date(data.observedAt).toLocaleString()+'</span></section>'+
      '<section class="q-dpg-view q-dpg-view--'+actionTone(view.action)+'"><div><small>QELLY VIEW</small><h2>'+escapeHtml(view.action)+'</h2><p>'+escapeHtml(view.label)+'</p></div><div class="q-dpg-confidence"><span>Evidence confidence</span><strong>'+Math.round(view.confidence*100)+'%</strong></div>'+levels(view)+primaryResearchSummary(data,escapeHtml)+calibration(view,escapeHtml)+'<details><summary>Why this view?</summary><ul>'+view.why.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul><p><strong>What changes it:</strong> '+escapeHtml(view.changesIf)+'</p></details></section>'+
      '<section class="q-dpg-stage"><div class="q-dpg-chart-wrap"><div class="q-dpg-chart-help">'+(state.chartMode==='navigate'?'Navigate mode · range selection is inactive':state.chartMode==='select-candle'?'Select Candle · choose one observed candle · Explain this candle':state.chartMode==='measure-move'?'Measure Move · drag to measure a historical move':'Select Range · Click one candle or drag across observed candles; selection persists until Clear')+'</div>'+chart(data,escapeHtml,state.draft||state.selection,state.interval,state.chartMode)+rangeSelectionSummary(state,data,escapeHtml)+'</div>'+cfWatchNextMarkup(data)+'</section>'+(state.uiMode==='simple'?setupDiscoveryControlsMarkup(state,escapeHtml)+scannerMarkup(state.scan,{scanning:state.scanning,error:state.scanError,escapeHtml,mode:state.scanFilters.mode,ranking:state.scanFilters.ranking}):'')+cfSetupSummaryMarkup(data)+cfScenarioMarkup(data)+nextMoveResearchMarkup(data)+
      (move?'<section class="q-dpg-move"><header><div><small>SELECTED MOVE</small><h2>'+pct(move.changePct)+' across '+move.candles+' candles</h2></div><span>'+new Date(move.start).toLocaleString()+' → '+new Date(move.end).toLocaleString()+'</span></header><div><article><span>Range</span><strong>'+pct(move.rangePct)+'</strong></article><article><span>Volume vs prior</span><strong>'+(move.volumeRatio?move.volumeRatio+'×':'N/A')+'</strong></article><article><span>Volatility</span><strong>'+pct(move.volatilityPct)+'</strong></article><article><span>Prior volatility</span><strong>'+(move.priorVolatilityPct===null?'N/A':pct(move.priorVolatilityPct))+'</strong></article></div></section>':'')+
      rangeEvidenceMarkup(data)+rangeReplayMarkup(data)+selectedRangeSimilarMovesMarkup(data)+
      '<section class="q-dpg-simple-next"><div><small>NEED MORE DETAIL?</small><h2>Evidence is one layer deeper</h2><p>Open Advanced for structure, liquidity, derivatives, macro, news, scenarios and contradictions. Research Lab contains calibration, model health, provenance and operational diagnostics.</p></div><button class="q-button q-button--secondary" type="button" data-dpg-ui-mode-jump="advanced">Show Advanced Research</button></section>'+
    '</section>';
    if(state.uiMode==='simple')return simple;
    const advanced=simple+advancedDecisionContent(data);
    if(state.uiMode==='advanced')return advanced;
    const research='<section id="qelly-decision-panel-research" class="q-dpg-mode-panel q-dpg-mode-panel--research" data-dpg-mode-panel="research" role="tabpanel" aria-labelledby="qelly-decision-tab-research" tabindex="0"><header class="q-dpg-mode-panel__header"><div><small>RESEARCH LAB</small><h2>Calibration, model trace, raw diagnostics and provenance</h2></div><span>Expert surface · research-only</span></header>'+
      quantResearchMarkup(data,escapeHtml)+outcomeLedgerMarkup(data)+whatChangedMarkup(state.previousSnapshot,data.decisionSnapshot,escapeHtml)+decisionTraceMarkup(data,escapeHtml)+secondaryResearchDiagnosticsMarkup(data,escapeHtml)+sloDiagnosticsMarkup(state.slo,escapeHtml)+
      '<details id="qelly-decision-methodology" class="q-dpg-audit" open><summary>Methodology and sources</summary><div><section><h3>Market data</h3><p>'+escapeHtml(data.provenance.provider)+' public candles. <a href="'+escapeHtml(data.provenance.documentation)+'" target="_blank" rel="noopener">Source documentation ↗</a></p></section><section><h3>Method</h3><p>'+data.provenance.model.features.map(escapeHtml).join(' · ')+'</p><p>'+escapeHtml(data.confidence.calibration)+'</p></section><section><h3>Limits</h3><ul>'+data.provenance.model.limitations.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul></section></div></details>'+
    '</section>';
    return advanced+research;
  };

  const decisionEducationMarkup=()=>{
    const help=[
      ['R:R','Risk-to-reward compares the planned loss at invalidation with the planned target distance.'],
      ['Invalidation','The market condition or price level that makes the current setup thesis no longer valid.'],
      ['Funding','Perpetual-futures funding is a periodic transfer between long and short positions; it is context, not proof of direction.'],
      ['OI','Open interest is the amount of outstanding derivatives exposure. QELLY uses it only where genuine provider data exists.'],
      ['Calibration','Calibration tests whether stated probabilities match resolved outcomes. Uncalibrated model scores are not presented as calibrated probabilities.'],
      ['NO TRADE','NO TRADE means the governed evidence or setup gates do not justify a valid setup. Aggressive Discovery does not remove this state.'],
      ['Selected-range evidence','Evidence is bounded to the chosen historical candles. Current context is labeled separately and must not be backfilled into history.']
    ];
    return '<details class="q-dpg-education"><summary>Decision terms & help</summary><div class="q-dpg-education__grid">'+help.map(([term,description],index)=>'<span class="q-dpg-help" tabindex="0" aria-describedby="q-dpg-help-'+index+'"><strong>'+escapeHtml(term)+'</strong><i id="q-dpg-help-'+index+'" role="tooltip">'+escapeHtml(description)+'</i></span>').join('')+'</div></details>';
  };

  const bindDockViewportClearance=()=>{
    activeDecisionDockClearanceCleanup();
    const controller=new AbortController();
    activeDecisionDockClearanceCleanup=()=>controller.abort();
    const sync=()=>{
      const workbench=main.querySelector('.q-dpg-range-workbench');
      if(!workbench)return;
      const rect=workbench.getBoundingClientRect(),reserved=112;
      const assistantOpen=document.querySelector('[data-q-ai-assistant]')?.hidden===false;
      const overlapsBottomZone=!assistantOpen&&rect.bottom>window.innerHeight-reserved&&rect.top<window.innerHeight;
      document.dispatchEvent(new CustomEvent('qelly:chat-clearance',{detail:{route:'decision-provenance',state:overlapsBottomZone?'chart':'clear'}}));
    };
    window.addEventListener('scroll',sync,{passive:true,signal:controller.signal});
    window.addEventListener('resize',sync,{passive:true,signal:controller.signal});
    document.addEventListener('qelly:chat-open-state',sync,{signal:controller.signal});
    requestAnimationFrame(sync);
  };
  const draw=()=>{
    if(chartGestureActive){chartGestureDeferredDraw=true;return;}
    chartGestureDeferredDraw=false;
    const focusedFailure=Boolean(main.querySelector('.q-dpg-state--error:focus'));
    const focusedMode=main.querySelector('[data-dpg-ui-mode]:focus')?.dataset.dpgUiMode||null;
    const focusedStableControl=main.querySelector('[data-dpg-asset-picker-toggle]:focus')?'asset-picker':null;
    const educationWasOpen=Boolean(main.querySelector('.q-dpg-education[open]'));
    const focusedEducationHelp=main.querySelector('.q-dpg-education .q-dpg-help:focus')?.getAttribute('aria-describedby')||null;
    const data=state.data;
    main.innerHTML='<section class="q-page q-dpg-page" data-dpg-depth="'+escapeHtml(state.uiMode)+'">'+stateBanner()+(state.error?'<section class="q-dpg-state q-dpg-state--error" role="alert" tabindex="-1"><h2>Live research unavailable</h2><p>'+escapeHtml(state.error)+'</p><button class="q-button q-button--secondary" data-dpg-refresh>Try again</button></section>':'')+hero(data)+decisionModeSwitcher()+'<section class="q-dpg-controls q-dpg-controls--decision" aria-label="Decision controls">'+select('horizon',validHorizons(state.interval))+'<label><span>Risk / reward</span><select data-dpg-rr><option value="auto" '+(state.rr==='auto'?'selected':'')+'>Auto</option><option value="1" '+(state.rr==='1'?'selected':'')+'>1:1</option><option value="2" '+(state.rr==='2'?'selected':'')+'>1:2</option><option value="3" '+(state.rr==='3'?'selected':'')+'>1:3</option><option value="4" '+(state.rr==='4'?'selected':'')+'>1:4</option><option value="custom" '+(state.rr==='custom'?'selected':'')+'>Custom</option></select></label>'+(state.rr==='custom'?'<label><span>Custom R:R</span><input data-dpg-custom-rr type="number" min="0.5" max="10" step="0.1" value="'+escapeHtml(state.customRr)+'"></label>':'')+'<p>Public research · no sign-in required · no trade execution</p></section>'+decisionEducationMarkup()+(state.uiMode==='simple'&&data?'':setupDiscoveryControlsMarkup(state,escapeHtml))+(state.uiMode==='simple'?'':scannerFiltersMarkup(state,escapeHtml))+(state.uiMode==='simple'&&data?'':scannerMarkup(state.scan,{scanning:state.scanning,error:state.scanError,escapeHtml,mode:state.scanFilters.mode,ranking:state.scanFilters.ranking}))+(state.loading?'<section class="q-dpg-state" role="status" data-qelly-startup-feedback="true"><span class="q-spinner"></span><h2>Weighing fresh evidence</h2><p>Loading market observations and scenario ranges.</p></section>':'')+(data?content(data):'')+'</section>';
    publishDecisionChatContext(data);wire();bindDockViewportClearance();mountAdSlots(main);
    const education=main.querySelector('.q-dpg-education');
    if(educationWasOpen&&education)education.open=true;
    const educationHelp=focusedEducationHelp&&education
      ?[...education.querySelectorAll('.q-dpg-help')].find(node=>node.getAttribute('aria-describedby')===focusedEducationHelp)
      :null;
    if(educationHelp)educationHelp.focus({preventScroll:true});
    else if(focusedMode)main.querySelector('[data-dpg-ui-mode="'+focusedMode+'"]')?.focus();
    else if(focusedStableControl==='asset-picker')main.querySelector('[data-dpg-asset-picker-toggle]')?.focus({preventScroll:true});
    if(focusedFailure&&state.error)main.querySelector('.q-dpg-state--error')?.focus({preventScroll:true});
    applyPendingFocus();
  };
  let scheduledLoadTimer=0,rangeEvidenceController=null,decisionLoadController=null,decisionLoadRequest=0;
  const scheduleLoad=()=>{
    if(scheduledLoadTimer)clearTimeout(scheduledLoadTimer);
    scheduledLoadTimer=setTimeout(()=>{scheduledLoadTimer=0;void load();},16);
  };
  const cancelRangeEvidenceRequest=()=>{
    state.rangeEvidenceRequest+=1;
    const hadActiveRequest=Boolean(rangeEvidenceController);
    rangeEvidenceController?.abort();
    rangeEvidenceController=null;
    state.rangeEvidenceLoading=false;
    state.rangeEvidenceError=null;
    if(hadActiveRequest)emitRuntimeSignal({feature:'range_evidence',action:'abort',state:'superseded',surface:'decision'});
  };
  const selectionKey=(selection)=>selection?String(selection.start)+'|'+String(selection.end):'';
  async function loadExactRangeEvidence(selection){
    if(!selection||!state.data)return false;
    rangeEvidenceController?.abort();
    const controller=new AbortController();rangeEvidenceController=controller;
    const key=selectionKey(selection),requestId=++state.rangeEvidenceRequest,startedAt=performance.now();
    state.rangeEvidenceLoading=true;state.rangeEvidenceError=null;draw();
    try{
      const params=new URLSearchParams({asset:state.asset,interval:state.interval,horizon:state.horizon,rangeStart:String(selection.start),rangeEnd:String(selection.end),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'});
      const result=await api('/api/v1/decision-range-evidence?'+params.toString(),{signal:controller.signal});
      if(requestId!==state.rangeEvidenceRequest||selectionKey(state.selection)!==key||!state.data)return false;
      state.data={
        ...state.data,
        selection:result?.selectedMove||state.data.selection,
        rangeEvidence:result?.rangeEvidence||state.data.rangeEvidence,
        rangeReplay:result?.rangeReplay||state.data.rangeReplay,
        selectedRangeSimilarMoves:result?.selectedRangeSimilarMoves||state.data.selectedRangeSimilarMoves
      };
      emitRuntimeSignal({feature:'range_evidence',action:'latency',state:performance.now()-startedAt>=2000?'gte_2000ms':performance.now()-startedAt>=1000?'gte_1000ms':performance.now()-startedAt>=500?'500_999ms':'lt_500ms',surface:'decision'});
      return Boolean(result?.rangeEvidence);
    }catch(error){
      if(error?.name==='AbortError'){emitRuntimeSignal({feature:'range_evidence',action:'abort',state:'network_cancelled',surface:'decision'});return false;}
      if(requestId===state.rangeEvidenceRequest)state.rangeEvidenceError=error?.message||'Exact historical range evidence is unavailable.';
      return false;
    }finally{
      if(rangeEvidenceController===controller)rangeEvidenceController=null;
      if(requestId===state.rangeEvidenceRequest){state.rangeEvidenceLoading=false;draw();}
    }
  }

  const wire=()=>{
    const commitRangeSelection=async(targetSelector=null)=>{
      if(!state.draft)return false;
      state.selection=state.draft;state.rangeReplayIndex=0;
      if(!await load()||!state.data)return false;
      await loadExactRangeEvidence(state.selection);
      if(targetSelector)main.querySelector(targetSelector)?.scrollIntoView({behavior:motionBehavior(),block:'start'});
      return true;
    };
    main.querySelectorAll('[data-dpg-ui-mode],[data-dpg-ui-mode-jump]').forEach(button=>button.addEventListener('click',()=>{
      const next=button.dataset.dpgUiMode||button.dataset.dpgUiModeJump;
      if(!['simple','advanced','research'].includes(next)||next===state.uiMode)return;
      state.uiMode=next;
      emitProductEvent('qelly_view_interaction',{route:'decision-provenance',feature:'research_depth',action:'select',state:next});
      draw();
      main.querySelector('[data-dpg-mode-switcher]')?.scrollIntoView({behavior:motionBehavior(),block:'nearest'});
    }));
    main.querySelectorAll('[data-dpg-ui-mode]').forEach((button)=>button.addEventListener('keydown',(event)=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const tabs=[...main.querySelectorAll('[data-dpg-ui-mode]')],index=tabs.indexOf(button);
      if(index<0||!tabs.length)return;
      const nextIndex=event.key==='Home'?0:event.key==='End'?tabs.length-1:event.key==='ArrowRight'?(index+1)%tabs.length:(index-1+tabs.length)%tabs.length;
      const nextMode=tabs[nextIndex]?.dataset.dpgUiMode;
      if(!['simple','advanced','research'].includes(nextMode))return;
      if(nextMode!==state.uiMode){
        state.uiMode=nextMode;
        emitProductEvent('qelly_view_interaction',{route:'decision-provenance',feature:'research_depth',action:'keyboard_select',state:nextMode});
        draw();
        main.querySelector('[data-dpg-mode-switcher]')?.scrollIntoView({behavior:motionBehavior(),block:'nearest'});
      }
      main.querySelector('[data-dpg-ui-mode="'+nextMode+'"]')?.focus();
    }));
    main.querySelector('[data-dpg-asset-picker-toggle]')?.addEventListener('click',()=>{state.assetPickerOpen=!state.assetPickerOpen;draw();if(state.assetPickerOpen)requestAnimationFrame(()=>main.querySelector('[data-dpg-asset-search]')?.focus());});
    main.querySelector('[data-dpg-asset-picker-close]')?.addEventListener('click',()=>{state.assetPickerOpen=false;state.assetQuery='';queueFocusAfterDraw('[data-dpg-asset-picker-toggle]');draw();});
    main.querySelector('[data-dpg-asset-picker-panel]')?.addEventListener('keydown',(event)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();state.assetPickerOpen=false;state.assetQuery='';queueFocusAfterDraw('[data-dpg-asset-picker-toggle]');draw();}});
    main.querySelector('[data-dpg-asset-search]')?.addEventListener('input',(event)=>{
      state.assetQuery=event.currentTarget.value;
      const query=state.assetQuery.trim().toLowerCase();
      main.querySelectorAll('[data-dpg-asset-group]').forEach((group)=>{
        const rows=[...group.querySelectorAll('[data-dpg-asset-row]')];
        rows.forEach((row)=>{row.hidden=Boolean(query)&&!String(row.dataset.search||'').includes(query);});
        const groupMatch=!query||String(group.dataset.search||'').includes(query);
        group.hidden=!groupMatch&&rows.length>0&&!rows.some((row)=>!row.hidden);
      });
    });
    main.querySelector('[data-dpg-asset-search]')?.addEventListener('keydown',(event)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();state.assetPickerOpen=false;state.assetQuery='';queueFocusAfterDraw('[data-dpg-asset-picker-toggle]');draw();}});
    main.querySelectorAll('[data-dpg-asset-filter]').forEach((button)=>button.addEventListener('click',()=>{state.assetFilter=button.dataset.dpgAssetFilter||'all';state.assetQuery='';draw();requestAnimationFrame(()=>main.querySelector('[data-dpg-asset-search]')?.focus());}));
    main.querySelectorAll('[data-dpg-asset-favorite]').forEach((button)=>button.addEventListener('click',()=>{
      state.assetFavorites=toggleDecisionAssetFavorite(state.assetFavorites,button.dataset.dpgAssetFavorite);
      const saved=saveDecisionAssetPreferences({favorites:state.assetFavorites,recent:state.assetRecent});
      state.assetFavorites=saved.favorites;state.assetRecent=saved.recent;draw();
    }));
    main.querySelectorAll('[data-dpg-asset-select]').forEach((button)=>button.addEventListener('click',()=>{
      const symbol=String(button.dataset.dpgAssetSelect||'').toUpperCase();
      if(!Array.isArray(state.assetCatalog?.selectableSymbols)||!state.assetCatalog.selectableSymbols.includes(symbol)){toast?.('This asset is not supported by the current Decision evidence stack.',{tone:'danger'});return;}
      state.asset=symbol;state.assetPickerOpen=false;state.assetQuery='';state.scan=null;state.scanError=null;state.rangeReplayIndex=0;
      state.assetRecent=recordDecisionAssetRecent(state.assetRecent,symbol);
      saveDecisionAssetPreferences({favorites:state.assetFavorites,recent:state.assetRecent});
      cancelRangeEvidenceRequest();state.draft=null;state.selection=null;scheduleLoad();
    }));
    main.querySelectorAll('[data-dpg-next-bars]').forEach(button=>button.addEventListener('click',()=>{
      const value=button.dataset.dpgNextBars;
      if(!['1','3','5','custom'].includes(value)||value===state.nextMoveBars)return;
      state.nextMoveBars=value;
      if(value==='custom'){
        const available=(state.data?.nextMoveResearch?.horizons||[]).some(item=>Number(item.horizonBars)===Number(state.nextMoveCustomBars));
        if(!available){scheduleLoad();return;}
      }
      draw();
    }));
    main.querySelector('[data-dpg-next-custom]')?.addEventListener('change',(event)=>{
      const value=Math.max(1,Math.min(12,Math.round(Number(event.currentTarget.value)||8)));
      state.nextMoveCustomBars=String(value);scheduleLoad();
    });
    main.querySelectorAll('[data-dpg-interval],[data-dpg-horizon]').forEach(element=>element.addEventListener('change',()=>{
      const key=element.hasAttribute('data-dpg-interval')?'interval':'horizon';
      state[key]=element.value;
      if(key==='interval')state.horizon=normalizeHorizon(state.interval,state.horizon);
      state.scan=null;state.scanError=null;cancelRangeEvidenceRequest();state.draft=null;state.selection=null;scheduleLoad();
    }));
    main.querySelector('[data-dpg-rr]')?.addEventListener('change',(event)=>{
      state.rr=event.currentTarget.value;state.scan=null;state.scanError=null;
      emitProductEvent('qelly_view_interaction',{route:'decision-provenance',feature:'risk_reward',action:'select',state:rrTelemetryState(state.rr)});
      scheduleLoad();
    });
    main.querySelector('[data-dpg-custom-rr]')?.addEventListener('change',(event)=>{state.customRr=event.currentTarget.value;state.scan=null;state.scanError=null;scheduleLoad();});
    main.querySelectorAll('[data-dpg-cf-rr]').forEach(button=>button.addEventListener('click',()=>{
      const value=String(button.dataset.dpgCfRr||'auto');
      if(!['auto','1','2','3','4','custom'].includes(value)||value===state.rr)return;
      state.rr=value;state.scan=null;state.scanError=null;scheduleLoad();
    }));
    main.querySelector('[data-dpg-cf-custom-rr]')?.addEventListener('change',(event)=>{
      const value=Math.max(.5,Math.min(10,Number(event.currentTarget.value)||2.5));
      state.customRr=String(Math.round(value*10)/10);state.rr='custom';state.scan=null;state.scanError=null;scheduleLoad();
    });
    main.querySelectorAll('[data-dpg-scan]').forEach(button=>button.addEventListener('click',scan));
    main.querySelectorAll('[data-dpg-scan-mode]').forEach(button=>button.addEventListener('click',()=>{state.scanFilters.mode=button.dataset.dpgScanMode||'validated';state.scan=null;state.scanError=null;draw();}));
    main.querySelectorAll('[data-dpg-scan-universe]').forEach(button=>button.addEventListener('click',()=>{state.scanFilters.universe=button.dataset.dpgScanUniverse||'all';state.scan=null;state.scanError=null;draw();}));
    main.querySelectorAll('[data-dpg-scan-direction]').forEach(button=>button.addEventListener('click',()=>{state.scanFilters.direction=button.dataset.dpgScanDirection||'any';state.scan=null;state.scanError=null;draw();}));
    main.querySelector('[data-dpg-scan-ranking]')?.addEventListener('change',(event)=>{state.scanFilters.ranking=event.currentTarget.value||'highest_quality';state.scan=null;state.scanError=null;draw();});
    main.querySelector('[data-dpg-ledger-track]')?.addEventListener('click',trackCurrentSetup);
    main.querySelectorAll('[data-dpg-ledger-observe]').forEach(button=>button.addEventListener('click',()=>observeTrackedSetup(button.dataset.dpgLedgerObserve)));
    main.querySelectorAll('[data-dpg-scan-filter]').forEach(element=>element.addEventListener('change',()=>{const key=element.dataset.dpgScanFilter;if(key){state.scanFilters[key]=element.value;state.scan=null;state.scanError=null;draw();}}));
    main.querySelectorAll('[data-dpg-scan-asset]').forEach(button=>button.addEventListener('click',()=>{const symbol=String(button.dataset.dpgScanAsset||'').toUpperCase(),candidateInterval=String(button.dataset.dpgScanInterval||state.interval);if(!Array.isArray(state.assetCatalog?.selectableSymbols)||!state.assetCatalog.selectableSymbols.includes(symbol)||!INTERVAL_MS[candidateInterval])return;cancelRangeEvidenceRequest();state.asset=symbol;state.interval=candidateInterval;state.horizon=normalizeHorizon(state.interval,state.horizon);state.assetRecent=recordDecisionAssetRecent(state.assetRecent,symbol);saveDecisionAssetPreferences({favorites:state.assetFavorites,recent:state.assetRecent});state.draft=null;state.selection=null;void load();}));
    main.querySelector('[data-dpg-explain-header]')?.addEventListener('click',()=>{if(state.draft)void commitRangeSelection('.q-dpg-move');});
    main.querySelector('[data-dpg-explain-candle]')?.addEventListener('click',()=>{const candles=state.data?.market?.candles||[],intervalMs=INTERVAL_MS[state.interval],selected=state.draft&&state.draft.end-state.draft.start<intervalMs?state.draft:null,last=candles.at?.(-1);if(selected){void commitRangeSelection('.q-dpg-move');return;}if(last&&intervalMs){state.draft={start:last.time,end:last.time+intervalMs-1};void commitRangeSelection('.q-dpg-move');}});
    main.querySelector('[data-dpg-mtf-jump]')?.addEventListener('click',()=>main.querySelector('#qelly-decision-mtf')?.scrollIntoView({behavior:motionBehavior(),block:'start'}));
    main.querySelector('[data-dpg-compare-asset]')?.addEventListener('click',()=>{const assetId=canonicalDecisionAsset(state.asset);if(!assetId||typeof navigate!=='function'){toast?.('Asset comparison is unavailable for this Decision context.',{tone:'danger'});return;}navigate('comparison-lab',assetId);});
    main.querySelector('[data-dpg-formula-evidence]')?.addEventListener('click',()=>{
      if(!storeResearchContext({asset:state.asset,timeframe:state.interval,source:'decision-intelligence'})){toast?.('Formula handoff is unavailable for this Decision context.',{tone:'danger'});return;}
      navigate?.('formula-screener');
    });
    main.querySelector('[data-dpg-research-note]')?.addEventListener('click',()=>{
      if(!state.data){toast?.('Research note is unavailable until Decision evidence loads.',{tone:'danger'});return;}
      const note=buildDecisionResearchNote(state.data,{
        requestedRr:state.rr,
        customRr:state.rr==='custom'?state.customRr:null,
        targetTouchCalibration:state.ledger?.calibration||null
      });
      downloadDecisionResearchNote(note);
      emitProductEvent('qelly_view_interaction',{route:'decision-provenance',feature:'research_note',action:'export',state:telemetryToken(state.data?.qellyView?.action||'no_trade')});
      toast?.('Decision research note exported',{tone:'success'});
    });
    main.querySelector('[data-dpg-methodology-jump]')?.addEventListener('click',()=>main.querySelector('#qelly-decision-methodology')?.scrollIntoView({behavior:motionBehavior(),block:'start'}));
    main.querySelectorAll('[data-dpg-refresh]').forEach(button=>button.addEventListener('click',load));main.querySelector('[data-dpg-export]')?.addEventListener('click',()=>{download(state.data);toast('Research package exported',{tone:'success'});});
    main.querySelector('[data-dpg-explain]')?.addEventListener('click',()=>{void commitRangeSelection('.q-dpg-move');});
    main.querySelector('[data-dpg-clear]')?.addEventListener('click',()=>{cancelRangeEvidenceRequest();state.rangeReplayIndex=0;state.draft=null;state.selection=null;void load();});
    main.querySelectorAll('[data-dpg-chart-mode]').forEach(button=>button.addEventListener('click',()=>{state.chartMode=button.dataset.dpgChartMode||'select-range';draw();}));
    const keyboardSelection=()=>{
      const candles=state.data?.market?.candles||[],intervalMs=INTERVAL_MS[state.interval],startInput=main.querySelector('[data-dpg-range-start]'),endInput=main.querySelector('[data-dpg-range-end]');
      if(!candles.length||!intervalMs||!startInput||!endInput)return;
      state.draft=buildRangeSelection(candles,Number(startInput.value),Number(endInput.value),intervalMs);
      draw();
    };
    main.querySelector('[data-dpg-range-start]')?.addEventListener('change',keyboardSelection);
    main.querySelector('[data-dpg-range-end]')?.addEventListener('change',keyboardSelection);
    main.querySelector('[data-dpg-replay-prev]')?.addEventListener('click',()=>{state.rangeReplayIndex=Math.max(0,state.rangeReplayIndex-1);draw();});
    main.querySelector('[data-dpg-replay-next]')?.addEventListener('click',()=>{const max=Math.max(0,(state.data?.rangeReplay?.frames?.length||1)-1);state.rangeReplayIndex=Math.min(max,state.rangeReplayIndex+1);draw();});
    main.querySelector('[data-dpg-replay-slider]')?.addEventListener('input',(event)=>{state.rangeReplayIndex=Math.max(0,Number(event.currentTarget.value)||0);draw();});
    main.querySelectorAll('[data-dpg-range-action]').forEach(button=>button.addEventListener('click',async()=>{
      const action=button.dataset.dpgRangeAction;
      if(!state.draft)return;
      if(action==='similar-setup'){
        if(!(await commitRangeSelection()))return;
        const priceFamily=state.data?.rangeEvidence?.evidenceFamilies?.find?.(item=>item?.id==='price-structure')?.data||{};
        const historicalRegime=String(priceFamily.regime||'').toLowerCase();
        const comparableRegime=historicalRegime.includes('trend')?'trending':historicalRegime.includes('rang')?'ranging':historicalRegime.includes('transition')?'transition':'any';
        state.scanFilters={...state.scanFilters,mode:'validated',universe:'current',ranking:'highest_quality',direction:'any',regime:comparableRegime};
        state.scan=null;state.scanError=null;
        toast?.('Searching the current '+state.asset+' market under the closest governed selected-range regime. Historical similarity remains descriptive.',{tone:'info'});
        await scan();return;
      }
      const target={news:'.q-dpg-range-timeline',flow:'.q-dpg-range-flow',compare:'.q-dpg-ppf',replay:'.q-dpg-range-replay',similar:'.q-dpg-similar-moves'}[action]||null;
      if(action==='note'){
        if(!(await commitRangeSelection()))return;
        const note=buildDecisionResearchNote(state.data,{requestedRr:state.rr,customRr:state.rr==='custom'?state.customRr:null,targetTouchCalibration:state.ledger?.calibration||null});
        downloadDecisionResearchNote(note);toast?.('Selected-range research note exported',{tone:'success'});return;
      }
      await commitRangeSelection(target);
    }));
    const svg=main.querySelector('[data-dpg-chart]');
    if(!svg||!state.data)return;
    svg.dataset.mode=state.chartMode;
    let anchor=null,pendingIndex=null,paintFrame=0;
    const candles=state.data.market.candles,intervalMs=INTERVAL_MS[state.interval];
    const indexAt=(event)=>{
      const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
      const matrix=svg.getScreenCTM();if(!matrix)return 0;
      const local=point.matrixTransform(matrix.inverse());
      return clamp(Math.round((local.x-CHART_GEOMETRY.pad)/(CHART_GEOMETRY.split-CHART_GEOMETRY.pad)*(candles.length-1)),0,candles.length-1);
    };
    const paintRange=(rawStart,rawEnd)=>{
      if(rawStart===null||rawEnd===null)return;
      const start=Math.min(rawStart,rawEnd),end=Math.max(rawStart,rawEnd),width=CHART_GEOMETRY.split-CHART_GEOMETRY.pad;
      const center=(index)=>CHART_GEOMETRY.pad+index/Math.max(1,candles.length-1)*width,candleWidth=Math.max(1.2,width/candles.length*.62),startX=center(start),endX=center(end),left=Math.max(CHART_GEOMETRY.pad,startX-candleWidth*.8),right=Math.min(CHART_GEOMETRY.split,endX+candleWidth*.8);
      const group=svg.querySelector('[data-dpg-selection]');group?.removeAttribute('hidden');
      const rect=svg.querySelector('[data-dpg-selection-rect]');rect?.setAttribute('x',String(left));rect?.setAttribute('width',String(Math.max(1,right-left)));
      for(const [selector,x] of [['[data-dpg-selection-start]',startX],['[data-dpg-selection-end]',endX],['[data-dpg-selection-start-handle]',startX],['[data-dpg-selection-end-handle]',endX]]){
        const element=svg.querySelector(selector);if(!element)continue;
        if(element.tagName.toLowerCase()==='line'){element.setAttribute('x1',String(x));element.setAttribute('x2',String(x));}else element.setAttribute('cx',String(x));
      }
      svg.querySelectorAll('[data-candle-index]').forEach(element=>element.classList.toggle('is-selected',Number(element.dataset.candleIndex)>=start&&Number(element.dataset.candleIndex)<=end));
      const draft=buildRangeSelection(candles,start,end,intervalMs),metrics=rangeSelectionMetrics(candles,draft,state.interval),label=main.querySelector('[data-dpg-selection-label]');
      if(label&&metrics)label.textContent='Selecting '+metrics.candles+' candle'+(metrics.candles===1?'':'s')+' · '+formatRangeDuration(metrics.durationMs)+' · '+(Number.isFinite(metrics.movePct)?(metrics.movePct>=0?'+':'')+metrics.movePct.toFixed(2)+'%':'move unavailable');
    };
    const queuePaint=(index)=>{pendingIndex=index;if(paintFrame)return;paintFrame=requestAnimationFrame(()=>{paintFrame=0;if(anchor!==null)paintRange(anchor,pendingIndex);});};
    svg.addEventListener('pointerdown',(event)=>{
      if(state.chartMode==='navigate')return;
      event.preventDefault();chartGestureActive=true;anchor=indexAt(event);pendingIndex=anchor;paintRange(anchor,pendingIndex);svg.setPointerCapture?.(event.pointerId);
    });
    svg.addEventListener('pointermove',(event)=>{if(anchor===null||state.chartMode==='navigate')return;event.preventDefault();queuePaint(state.chartMode==='select-candle'?anchor:indexAt(event));});
    const finishSelection=(event,cancel=false)=>{
      if(anchor===null){chartGestureActive=false;return;}
      if(paintFrame){cancelAnimationFrame(paintFrame);paintFrame=0;}
      const end=cancel?anchor:(state.chartMode==='select-candle'?anchor:indexAt(event)),draft=buildRangeSelection(candles,anchor,end,intervalMs);
      anchor=null;pendingIndex=null;chartGestureActive=false;
      if(cancel||!draft){draw();return;}
      state.draft=draft;draw();
    };
    svg.addEventListener('pointerup',(event)=>finishSelection(event,false));
    svg.addEventListener('pointercancel',(event)=>finishSelection(event,true));
  };
  async function loadLedger({redraw=true}={}){
    if(!ledgerAuthenticated()){state.ledger=null;state.ledgerError=null;return;}
    if(state.ledgerLoading)return;
    state.ledgerLoading=true;state.ledgerError=null;if(redraw)draw();
    try{state.ledger=await api('/api/v1/decision-ledger?limit=50');recordTargetTouchSample(state.ledger);}
    catch(error){state.ledger=null;state.ledgerError=error?.message||'Observed setup ledger is unavailable.';recordTargetTouchSample(null);}
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
    const observabilityStartedAt=startDecisionObservation();
    state.scanning=true;state.scanError=null;draw();
    try{
      const params=new URLSearchParams({interval:state.interval,horizon:state.horizon,rr:state.rr,mode:state.scanFilters.mode,ranking:state.scanFilters.ranking});
      if(state.rr==='custom')params.set('customRr',state.customRr);
      if(state.scanFilters.universe==='current')params.set('assets',state.asset);
      for(const key of ['direction','minEvidenceQuality','minCalibratedConfidence','minMtfAgreement','liquidity','volatility','regime','eventRiskTolerance','freshness'])params.set(key,String(state.scanFilters[key]??''));
      params.set('setupFreshness','current');
      state.scan=await api('/api/v1/decision-scan?'+params.toString());
      updateSlo(recordScannerObservation({startedAt:observabilityStartedAt,scan:state.scan}));
      const eligibleCount=Math.max(0,Number(state.scan?.eligibleCount)||0);
      emitProductEvent('qelly_view_interaction',{route:'decision-provenance',feature:'decision_scan',action:'complete',state:telemetryToken(state.scan?.state||'unavailable')});
      emitProductEvent('qelly_view_interaction',{route:'decision-provenance',feature:'eligible_setup',action:'count',state:eligibleCount>0?'nonzero':'zero',...(eligibleCount>0?{count:Math.min(100,eligibleCount)}:{})});
      const firstEligible=state.scan?.validatedSetup||state.scan?.candidates?.find?.(item=>item?.eligible);
      if(firstEligible?.asset&&firstEligible?.interval&&(firstEligible.asset!==state.asset||firstEligible.interval!==state.interval)){
        cancelRangeEvidenceRequest();
        state.asset=firstEligible.asset;state.interval=firstEligible.interval;state.horizon=normalizeHorizon(state.interval,state.horizon);state.draft=null;state.selection=null;
        state.assetRecent=recordDecisionAssetRecent(state.assetRecent,state.asset);
        saveDecisionAssetPreferences({favorites:state.assetFavorites,recent:state.assetRecent});
      }
    }catch(error){
      state.scan=null;state.scanError=error?.message||'The governed asset scan could not be completed. No substitute candidates were generated.';
      updateSlo(recordScannerObservation({startedAt:observabilityStartedAt,failed:true}));
      emitRuntimeSignal({feature:'decision_scan',action:'failure',state:'unavailable',surface:'api'});
    }finally{
      state.scanning=false;
      if(state.scan?.candidates?.some?.(item=>item?.eligible))await load();
      else draw();
    }
  }
  async function enrichDecisionNews(snapshot){
    const enrichment=snapshot?.evidence?.news?.enrichment;
    if(!enrichment?.url||snapshot?.evidence?.news?.state!=='pending')return;
    const graphId=snapshot?.graphId||null;
    try{
      const result=await api(enrichment.url);
      if(!state.data||state.data.graphId!==graphId)return;
      const current=state.data.evidence?.news||{};
      state.data={...state.data,evidence:{...state.data.evidence,news:{
        ...current,
        state:result?.state||'unavailable',
        provider:result?.provider||current.provider||'GDELT',
        articles:Array.isArray(result?.articles)?result.articles:[],
        observedAt:result?.fetchedAt??null,
        cache:result?.cache??null,
        fallbackReason:result?.fallbackReason??null,
        enrichment:{state:'complete',url:null,eligibilityImpact:'none'},
        boundary:result?.boundary||'Post-Decision contextual enrichment only; QELLY VIEW is unchanged.'
      }}};
      draw();
    }catch(error){
      if(!state.data||state.data.graphId!==graphId)return;
      const current=state.data.evidence?.news||{};
      state.data={...state.data,evidence:{...state.data.evidence,news:{
        ...current,state:'unavailable',articles:[],
        enrichment:{state:'failed',url:null,eligibilityImpact:'none'},
        fallbackReason:String(error?.message||'News context unavailable').slice(0,240),
        boundary:'Post-Decision news enrichment failed. The already-computed QELLY VIEW remains unchanged because news has no eligibility impact.'
      }}};
      draw();
    }
  }

  async function loadAssetCatalog({redraw=true}={}){
    try{
      const catalog=await api('/api/v1/decision-assets');
      if(!Array.isArray(catalog?.groups)||!Array.isArray(catalog?.selectableSymbols)||!catalog.selectableSymbols.length)throw new Error('Decision asset capability catalog is invalid.');
      state.assetCatalog=catalog;state.assetCatalogError=null;
    }catch(error){
      state.assetCatalog=fallbackAssetCatalog();
      state.assetCatalogError='Live capability catalog unavailable. QELLY is limited to the existing six Decision assets until the catalog returns.';
    }
    const allowed=new Set(state.assetCatalog.selectableSymbols);
    state.assetFavorites=state.assetFavorites.filter(symbol=>allowed.has(symbol));
    state.assetRecent=state.assetRecent.filter(symbol=>allowed.has(symbol));
    if(!allowed.has(state.asset))state.asset=state.assetCatalog.selectableSymbols[0];
    state.assetRecent=recordDecisionAssetRecent(state.assetRecent,state.asset);
    saveDecisionAssetPreferences({favorites:state.assetFavorites,recent:state.assetRecent});
    if(redraw)draw();
  }

  async function load(){
    if(scheduledLoadTimer){clearTimeout(scheduledLoadTimer);scheduledLoadTimer=0;}
    const requestId=++decisionLoadRequest;
    decisionLoadController?.abort();
    const controller=new AbortController();decisionLoadController=controller;
    const observabilityStartedAt=startDecisionObservation();
    state.loading=true;state.error=null;draw();
    try{
      if(!Array.isArray(state.assetCatalog?.selectableSymbols)||!state.assetCatalog.selectableSymbols.includes(state.asset))throw new Error('Selected asset is unavailable under the current Decision capability contract.');
      const range=state.selection?'&selectionStart='+encodeURIComponent(state.selection.start)+'&selectionEnd='+encodeURIComponent(state.selection.end):'';
      const rr='&rr='+encodeURIComponent(state.rr)+(state.rr==='custom'?'&customRr='+encodeURIComponent(state.customRr):'');
      const nextBars=state.nextMoveBars==='custom'?'&nextBars='+encodeURIComponent(state.nextMoveCustomBars):'';
      const previous=state.data?.decisionSnapshot||null;
      const next=await api('/api/v1/decision-proven-graph?asset='+encodeURIComponent(state.asset)+'&interval='+encodeURIComponent(state.interval)+'&horizon='+encodeURIComponent(state.horizon)+rr+nextBars+range,{signal:controller.signal});
      if(requestId!==decisionLoadRequest)return false;
      state.previousSnapshot=previous&&next?.decisionSnapshot&&previous.asset===next.decisionSnapshot.asset&&previous.interval===next.decisionSnapshot.interval?previous:null;
      state.data=next;
      updateSlo(recordDecisionObservation({startedAt:observabilityStartedAt,data:next,rrState:rrTelemetryState(state.rr)}));
      void enrichDecisionNews(next);
      emitProductEvent('qelly_view_interaction',{route:'decision-provenance',feature:'decision_view',action:'result',state:telemetryToken(next?.qellyView?.action||'unavailable')});
      emitProductEvent('qelly_view_interaction',{route:'decision-provenance',feature:'calibration',action:'state',state:telemetryToken(next?.quant?.calibration?.state||'uncalibrated')});
      return true;
    }catch(error){
      if(error?.name==='AbortError'){emitRuntimeSignal({feature:'decision',action:'abort',state:'superseded',surface:'api'});return false;}
      if(requestId===decisionLoadRequest){
        state.data=null;state.previousSnapshot=null;state.error=error?.message||'Fresh market evidence could not be reached. No substitute data was generated.';
        updateSlo(recordDecisionObservation({startedAt:observabilityStartedAt,rrState:rrTelemetryState(state.rr),failed:true}));
        emitRuntimeSignal({feature:'decision',action:'failure',state:'unavailable',surface:'api'});
      }
      return false;
    }finally{
      if(decisionLoadController===controller)decisionLoadController=null;
      if(requestId===decisionLoadRequest){state.loading=false;draw();if(state.error){const feedback=main.querySelector(".q-dpg-state--error");feedback?.scrollIntoView({block:"center",behavior:"instant"});feedback?.focus({preventScroll:true});}if(ledgerAuthenticated()&&!state.ledger&&!state.ledgerLoading)void loadLedger();}
    }
  }
  draw();
  await loadAssetCatalog({redraw:false});
  await load();
}

export const __decisionProvenGraphRouteTest=Object.freeze({CHAT_DECISION_CONTEXT_KEY,DECISION_ASSETS,readChatDecisionContext,storeResearchContext,normalizeHorizon,validHorizons,telemetryToken,rrTelemetryState,canonicalDecisionAsset,displayTime,formatRangeDuration,selectionIndexBounds,buildRangeSelection,rangeSelectionMetrics,macroContext});
