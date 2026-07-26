let loaderPromise=null;
const CDN='https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js';

export async function loadTradingViewLightweightCharts(){
  if(window.LightweightCharts)return window.LightweightCharts;
  if(loaderPromise)return loaderPromise;
  loaderPromise=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-qelly-lightweight-charts]');
    if(existing){existing.addEventListener('load',()=>resolve(window.LightweightCharts));existing.addEventListener('error',reject);return;}
    const script=document.createElement('script');script.src=CDN;script.async=true;script.dataset.qellyLightweightCharts='true';
    script.onload=()=>window.LightweightCharts?resolve(window.LightweightCharts):reject(new Error('TradingView Lightweight Charts did not initialize'));
    script.onerror=()=>reject(new Error('TradingView Lightweight Charts CDN unavailable'));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

function css(name,fallback){return getComputedStyle(document.documentElement).getPropertyValue(name).trim()||fallback;}
function addCandles(chart,lib,options){
  if(typeof chart.addSeries==='function'&&lib.CandlestickSeries)return chart.addSeries(lib.CandlestickSeries,options);
  return chart.addCandlestickSeries(options);
}
function addHistogram(chart,lib,options){
  if(typeof chart.addSeries==='function'&&lib.HistogramSeries)return chart.addSeries(lib.HistogramSeries,options);
  return chart.addHistogramSeries(options);
}
function addLine(chart,lib,options){
  if(typeof chart.addSeries==='function'&&lib.LineSeries)return chart.addSeries(lib.LineSeries,options);
  return chart.addLineSeries(options);
}
function movingAverage(points,period=20){
  return points.map((point,index)=>{if(index<period-1)return null;const value=points.slice(index-period+1,index+1).reduce((sum,x)=>sum+x.close,0)/period;return {time:point.time,value};}).filter(Boolean);
}

export async function mountLiveMarketChart(container,{points,symbol='BTCUSDT',interval='1m',onCrosshair=null}={}){
  if(!container)return {destroy(){},update(){}};
  try{
    const lib=await loadTradingViewLightweightCharts();
    container.innerHTML='';
    const chart=lib.createChart(container,{width:container.clientWidth||900,height:520,layout:{background:{type:'solid',color:'transparent'},textColor:css('--q-chart-label','#9f8790'),fontFamily:'JetBrains Mono, ui-monospace, monospace',fontSize:11},grid:{vertLines:{color:css('--q-chart-grid','rgba(120,25,55,.08)')},horzLines:{color:css('--q-chart-grid','rgba(120,25,55,.08)')}},crosshair:{mode:lib.CrosshairMode?.Normal??0,vertLine:{color:css('--q-accent','#7a1238'),width:1,style:2,labelBackgroundColor:css('--q-burgundy-core','#2a000f')},horzLine:{color:css('--q-accent','#7a1238'),width:1,style:2,labelBackgroundColor:css('--q-burgundy-core','#2a000f')}},rightPriceScale:{borderColor:css('--q-chart-border','#d9c4cc'),scaleMargins:{top:.08,bottom:.24}},timeScale:{borderColor:css('--q-chart-border','#d9c4cc'),timeVisible:true,secondsVisible:interval==='1s'||interval==='1m'},handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true},kineticScroll:{mouse:true,touch:true},watermark:{visible:true,fontSize:42,horzAlign:'center',vertAlign:'center',color:css('--q-chart-watermark','rgba(114,15,50,.055)'),text:`QELLY · ${symbol}`}});
    const candles=addCandles(chart,lib,{upColor:'#16a36a',downColor:'#df4963',wickUpColor:'#16a36a',wickDownColor:'#df4963',borderVisible:false,priceLineVisible:true,lastValueVisible:true});
    const volume=addHistogram(chart,lib,{priceFormat:{type:'volume'},priceScaleId:'volume',color:css('--q-accent','#7a1238'),lastValueVisible:false,priceLineVisible:false});
    chart.priceScale('volume').applyOptions({scaleMargins:{top:.82,bottom:0}});
    const ma=addLine(chart,lib,{color:'#d39524',lineWidth:2,priceLineVisible:false,lastValueVisible:false,title:'SMA 20'});
    const normalized=points.map(point=>({time:Number(point.time),open:Number(point.open),high:Number(point.high),low:Number(point.low),close:Number(point.close)}));
    candles.setData(normalized);
    volume.setData(points.map(point=>({time:Number(point.time),value:Number(point.volume),color:Number(point.close)>=Number(point.open)?'rgba(22,163,106,.30)':'rgba(223,73,99,.30)'})));
    ma.setData(movingAverage(points,20));
    chart.timeScale().fitContent();
    if(onCrosshair&&typeof chart.subscribeCrosshairMove==='function')chart.subscribeCrosshairMove((param)=>{const value=param.seriesData?.get?.(candles);if(value)onCrosshair(value);});
    const resize=()=>chart.applyOptions({width:container.clientWidth||900});
    const observer=new ResizeObserver(resize);observer.observe(container);
    return {engine:'TradingView Lightweight Charts',update(point){candles.update(point);volume.update({time:point.time,value:point.volume,color:point.close>=point.open?'rgba(22,163,106,.30)':'rgba(223,73,99,.30)'});},destroy(){observer.disconnect();chart.remove();}};
  }catch(error){
    container.innerHTML=fallbackChart(points,symbol,error.message);
    return {engine:'Qelly SVG fallback',update(){},destroy(){}};
  }
}

function fallbackChart(points,symbol,reason){
  const sampled=points.filter((_,index)=>index%Math.max(1,Math.floor(points.length/100))===0);const width=1120,height=500,pad=34;
  const min=Math.min(...sampled.map(item=>item.low)),max=Math.max(...sampled.map(item=>item.high));const y=value=>pad+(max-value)/(max-min||1)*(height-pad*2);const step=(width-pad*2)/Math.max(1,sampled.length);
  const candles=sampled.map((bar,index)=>{const x=pad+index*step+step*.5,open=y(bar.open),close=y(bar.close),high=y(bar.high),low=y(bar.low),top=Math.min(open,close),body=Math.max(1,Math.abs(close-open));return `<line x1="${x}" y1="${high}" x2="${x}" y2="${low}" stroke="${bar.close>=bar.open?'#16a36a':'#df4963'}"/><rect x="${x-Math.max(1,step*.28)}" y="${top}" width="${Math.max(2,step*.56)}" height="${body}" rx="1" fill="${bar.close>=bar.open?'#16a36a':'#df4963'}"/>`;}).join('');
  return `<div class="q-live-fallback"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${symbol} candlestick chart">${candles}</svg><div class="q-chart-fallback-note"><strong>Qelly fallback renderer</strong><span>${reason}</span></div></div>`;
}
