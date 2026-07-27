import { icon } from '../icon-registry.mjs';
import { money,percent } from './asset-rankings-data.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function chartGeometry(points,{width=1040,height=310}={}){
  const padding={left:58,right:78,top:18,bottom:46};
  const prices=points.flatMap((point)=>[point.high,point.low]);
  const minimum=Math.min(...prices);
  const maximum=Math.max(...prices);
  const span=Math.max(.000001,maximum-minimum);
  const plotWidth=width-padding.left-padding.right;
  const plotHeight=height-padding.top-padding.bottom;
  const step=plotWidth/Math.max(1,points.length);
  const x=(index)=>padding.left+index*step+step/2;
  const y=(value)=>padding.top+(maximum-value)/span*plotHeight;
  return {width,height,padding,minimum,maximum,span,plotWidth,plotHeight,step,x,y};
}

function axes(points,geometry){
  const {width,height,padding,maximum,span,plotWidth,plotHeight,x}=geometry;
  const horizontal=Array.from({length:5},(_,index)=>{
    const ratio=index/4;
    const y=padding.top+ratio*plotHeight;
    const value=maximum-ratio*span;
    return `<g class="q-mi-chart-grid"><line x1="${padding.left}" y1="${y}" x2="${width-padding.right}" y2="${y}"/><text x="${width-padding.right+10}" y="${y+4}">${money(value)}</text></g>`;
  }).join('');
  const indexes=[0,Math.floor(points.length*.25),Math.floor(points.length*.5),Math.floor(points.length*.75),points.length-1];
  const vertical=[...new Set(indexes)].map((index)=>{
    const date=new Date(points[index].time*1000);
    return `<g class="q-mi-chart-grid is-vertical"><line x1="${x(index)}" y1="${padding.top}" x2="${x(index)}" y2="${height-padding.bottom}"/><text x="${x(index)}" y="${height-15}" text-anchor="middle">${date.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</text></g>`;
  }).join('');
  return horizontal+vertical;
}

function candlestickMarkup(points,geometry){
  const {height,padding,step,x,y}=geometry;
  const maximumVolume=Math.max(...points.map((point)=>point.volume));
  const candleWidth=clamp(step*.56,2,9);
  const volumes=points.map((point,index)=>{
    const volumeHeight=point.volume/maximumVolume*42;
    return `<rect class="q-mi-volume ${point.close>=point.open?'is-up':'is-down'}" x="${x(index)-candleWidth/2}" y="${height-padding.bottom-volumeHeight}" width="${candleWidth}" height="${volumeHeight}"/>`;
  }).join('');
  const candles=points.map((point,index)=>{
    const up=point.close>=point.open;
    const bodyTop=Math.min(y(point.open),y(point.close));
    const bodyHeight=Math.max(1.5,Math.abs(y(point.close)-y(point.open)));
    return `<g class="q-mi-candle ${up?'is-up':'is-down'}" data-chart-point="${index}"><line x1="${x(index)}" y1="${y(point.high)}" x2="${x(index)}" y2="${y(point.low)}"/><rect x="${x(index)-candleWidth/2}" y="${bodyTop}" width="${candleWidth}" height="${bodyHeight}" rx=".8"/><rect class="q-mi-chart-hit" x="${x(index)-step/2}" y="${padding.top}" width="${step}" height="${geometry.plotHeight}"/></g>`;
  }).join('');
  return volumes+candles;
}

function lineMarkup(points,geometry,{area=false}={}){
  const {height,padding,x,y}=geometry;
  const polyline=points.map((point,index)=>`${x(index)},${y(point.close)}`).join(' ');
  const polygon=`${x(0)},${height-padding.bottom} ${polyline} ${x(points.length-1)},${height-padding.bottom}`;
  return `${area?`<polygon class="q-mi-area" points="${polygon}"/>`:''}<polyline class="q-mi-line" points="${polyline}"/>${points.map((point,index)=>`<rect class="q-mi-chart-hit" data-chart-point="${index}" x="${x(index)-geometry.step/2}" y="${padding.top}" width="${geometry.step}" height="${geometry.plotHeight}"/>`).join('')}`;
}

export function chartMarkup(points,{mode='candlestick',timeframe='1D'}={}){
  const geometry=chartGeometry(points);
  const latest=points.at(-1);
  const chart=mode==='candlestick'?candlestickMarkup(points,geometry):lineMarkup(points,geometry,{area:mode==='area'});
  return `<section class="q-mi-chart-card" data-chart-mode="${mode}">
    <header class="q-mi-chart-head">
      <div><span>Market composite</span><strong>${money(latest.close)}</strong><em class="${latest.close>=points[0].open?'is-positive':'is-negative'}">${percent((latest.close/points[0].open-1)*100)}</em></div>
      <div class="q-mi-chart-controls" aria-label="Chart controls">
        <div role="group" aria-label="Chart type">
          <button type="button" data-mi-chart-mode="candlestick" class="${mode==='candlestick'?'is-active':''}" aria-pressed="${mode==='candlestick'}">${icon('candlestick')}<span>Candles</span></button>
          <button type="button" data-mi-chart-mode="line" class="${mode==='line'?'is-active':''}" aria-pressed="${mode==='line'}">${icon('line')}<span>Line</span></button>
          <button type="button" data-mi-chart-mode="area" class="${mode==='area'?'is-active':''}" aria-pressed="${mode==='area'}">Area</button>
        </div>
        <div role="group" aria-label="Timeframe">
          ${['1H','4H','1D','1W'].map((item)=>`<button type="button" data-mi-timeframe="${item}" class="${timeframe===item?'is-active':''}" aria-pressed="${timeframe===item}">${item}</button>`).join('')}
        </div>
        <button type="button" data-mi-scale aria-pressed="false">Linear</button>
      </div>
    </header>
    <div class="q-mi-chart-stage" tabindex="0" aria-label="Interactive deterministic OHLC chart. Use left and right arrow keys to inspect observations.">
      <svg class="q-mi-market-chart" viewBox="0 0 ${geometry.width} ${geometry.height}" preserveAspectRatio="none" role="img" aria-labelledby="q-mi-chart-title q-mi-chart-desc">
        <title id="q-mi-chart-title">Deterministic market OHLC and volume chart</title>
        <desc id="q-mi-chart-desc">Realistic deterministic open, high, low, close, volume, open interest, and funding observations for static visual review. Not live market data.</desc>
        ${axes(points,geometry)}${chart}
        <line class="q-mi-crosshair q-mi-crosshair-x" x1="0" y1="0" x2="0" y2="0"/>
        <line class="q-mi-crosshair q-mi-crosshair-y" x1="0" y1="0" x2="0" y2="0"/>
      </svg>
      <div class="q-mi-chart-tooltip" data-mi-chart-tooltip hidden></div>
    </div>
    <footer><span>Qelly deterministic composite</span><span>Observed 27 Jul 2026 · static review</span><span>Confidence 94/100</span><button type="button" data-mi-explain>${icon('explain')} Explain this move</button></footer>
  </section>`;
}

export function bindChart(root,points,{onMode,onTimeframe,onExplain}={}){
  const stage=root.querySelector('.q-mi-chart-stage');
  const svg=root.querySelector('.q-mi-market-chart');
  const tooltip=root.querySelector('[data-mi-chart-tooltip]');
  if(!stage||!svg||!tooltip)return;
  const geometry=chartGeometry(points);
  let active=points.length-1;
  const show=(index)=>{
    active=clamp(index,0,points.length-1);
    const point=points[active];
    const x=geometry.x(active);
    const y=geometry.y(point.close);
    const vertical=svg.querySelector('.q-mi-crosshair-x');
    const horizontal=svg.querySelector('.q-mi-crosshair-y');
    vertical.setAttribute('x1',x);vertical.setAttribute('x2',x);vertical.setAttribute('y1',geometry.padding.top);vertical.setAttribute('y2',geometry.height-geometry.padding.bottom);
    horizontal.setAttribute('x1',geometry.padding.left);horizontal.setAttribute('x2',geometry.width-geometry.padding.right);horizontal.setAttribute('y1',y);horizontal.setAttribute('y2',y);
    tooltip.hidden=false;
    tooltip.innerHTML=`<strong>${new Date(point.time*1000).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric'})}</strong><span>O ${money(point.open)} · H ${money(point.high)}</span><span>L ${money(point.low)} · C ${money(point.close)}</span><span>Volume ${new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(point.volume)} · OI ${money(point.oi,{compact:true})}</span><small>Funding ${percent(point.funding,4)} · deterministic review data</small>`;
    tooltip.style.left=`${clamp(x/geometry.width*100,4,76)}%`;
    tooltip.style.top=`${clamp(y/geometry.height*100,6,58)}%`;
  };
  svg.querySelectorAll('[data-chart-point]').forEach((element)=>element.addEventListener('pointerenter',()=>show(Number(element.dataset.chartPoint))));
  stage.addEventListener('keydown',(event)=>{
    if(event.key==='ArrowLeft'){event.preventDefault();show(active-1);}
    if(event.key==='ArrowRight'){event.preventDefault();show(active+1);}
    if(event.key==='Escape')tooltip.hidden=true;
  });
  stage.addEventListener('pointerleave',()=>{tooltip.hidden=true;});
  root.querySelectorAll('[data-mi-chart-mode]').forEach((button)=>button.addEventListener('click',()=>onMode?.(button.dataset.miChartMode)));
  root.querySelectorAll('[data-mi-timeframe]').forEach((button)=>button.addEventListener('click',()=>onTimeframe?.(button.dataset.miTimeframe)));
  root.querySelectorAll('[data-mi-explain]').forEach((button)=>button.addEventListener('click',()=>onExplain?.('market-composite')));
  show(active);
}
