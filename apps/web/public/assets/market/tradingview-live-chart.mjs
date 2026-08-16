function css(name,fallback){return getComputedStyle(document.documentElement).getPropertyValue(name).trim()||fallback;}
const esc=(value)=>String(value??'').replace(/[&<>"']/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const finite=(value)=>Number.isFinite(Number(value));

function normalize(points=[]){
  return points.map((point)=>({time:Number(point.time),open:Number(point.open),high:Number(point.high),low:Number(point.low),close:Number(point.close),volume:Number(point.volume||0)})).filter((point)=>finite(point.time)&&finite(point.open)&&finite(point.high)&&finite(point.low)&&finite(point.close)&&point.high>=Math.max(point.open,point.close)&&point.low<=Math.min(point.open,point.close));
}

function movingAverage(points,period=20){
  const out=[];
  let sum=0;
  for(let index=0;index<points.length;index++){
    sum+=points[index].close;
    if(index>=period)sum-=points[index-period].close;
    if(index>=period-1)out.push({index,value:sum/period});
  }
  return out;
}

function chartMarkup(points,symbol){
  if(!points.length)return '<div class="q-empty-state"><strong>Chart unavailable</strong><p>No valid governed candle observations were supplied.</p></div>';
  const width=1120,height=520,padLeft=56,padRight=74,padTop=28,priceBottom=392,volumeTop=420,volumeBottom=492;
  const plotWidth=width-padLeft-padRight;
  const lows=points.map((point)=>point.low),highs=points.map((point)=>point.high);
  const min=Math.min(...lows),max=Math.max(...highs),range=Math.max(max-min,Math.abs(max)*0.00001,1e-9);
  const y=(value)=>padTop+((max-value)/range)*(priceBottom-padTop);
  const step=plotWidth/Math.max(points.length,1),bodyWidth=Math.max(1.4,Math.min(8,step*.62));
  const maxVolume=Math.max(...points.map((point)=>point.volume),1);
  const up=css('--q-positive','#16a36a'),down=css('--q-negative','#df4963'),grid=css('--q-chart-grid','rgba(120,25,55,.10)'),label=css('--q-chart-label','#9f8790'),accent=css('--q-accent','#7a1238'),maColor=css('--q-warning','#d39524'),watermark=css('--q-chart-watermark','rgba(114,15,50,.055)');
  const gridRows=Array.from({length:6},(_,index)=>{
    const ratio=index/5,gy=padTop+ratio*(priceBottom-padTop),value=max-ratio*range;
    return `<line x1="${padLeft}" y1="${gy.toFixed(2)}" x2="${width-padRight}" y2="${gy.toFixed(2)}" stroke="${grid}" stroke-width="1"/><text x="${width-padRight+8}" y="${(gy+4).toFixed(2)}" fill="${label}" font-size="11">${Number(value).toLocaleString('en-US',{maximumFractionDigits:Math.abs(value)>=100?2:6})}</text>`;
  }).join('');
  const verticals=Array.from({length:7},(_,index)=>{const gx=padLeft+(plotWidth*index/6);return `<line x1="${gx.toFixed(2)}" y1="${padTop}" x2="${gx.toFixed(2)}" y2="${volumeBottom}" stroke="${grid}" stroke-width="1"/>`;}).join('');
  const candles=points.map((bar,index)=>{
    const x=padLeft+(index+.5)*step,open=y(bar.open),close=y(bar.close),high=y(bar.high),low=y(bar.low),top=Math.min(open,close),body=Math.max(1.2,Math.abs(close-open)),color=bar.close>=bar.open?up:down;
    return `<g data-candle-index="${index}"><line x1="${x.toFixed(2)}" y1="${high.toFixed(2)}" x2="${x.toFixed(2)}" y2="${low.toFixed(2)}" stroke="${color}" stroke-width="1"/><rect x="${(x-bodyWidth/2).toFixed(2)}" y="${top.toFixed(2)}" width="${bodyWidth.toFixed(2)}" height="${body.toFixed(2)}" rx="1" fill="${color}"/></g>`;
  }).join('');
  const volumes=points.map((bar,index)=>{
    const x=padLeft+(index+.5)*step,h=Math.max(1,(bar.volume/maxVolume)*(volumeBottom-volumeTop)),color=bar.close>=bar.open?up:down;
    return `<rect x="${(x-bodyWidth/2).toFixed(2)}" y="${(volumeBottom-h).toFixed(2)}" width="${bodyWidth.toFixed(2)}" height="${h.toFixed(2)}" fill="${color}" opacity=".30"/>`;
  }).join('');
  const ma=movingAverage(points,20).map((point)=>`${(padLeft+(point.index+.5)*step).toFixed(2)},${y(point.value).toFixed(2)}`).join(' ');
  const firstTime=new Date(points[0].time*1000),lastTime=new Date(points.at(-1).time*1000);
  const timeLabel=(date)=>Number.isNaN(date.getTime())?'—':date.toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
  return `<div class="q-first-party-chart" data-qelly-chart-engine="first-party-svg">
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${esc(symbol)} governed candlestick chart" data-qelly-market-svg>
      <g aria-hidden="true">${gridRows}${verticals}</g>
      <text x="${width/2}" y="${height/2-24}" text-anchor="middle" fill="${watermark}" font-size="42" font-weight="700">QELLY · ${esc(symbol)}</text>
      <g aria-label="Candlesticks">${candles}</g>
      <g aria-label="Volume">${volumes}</g>
      ${ma?`<polyline points="${ma}" fill="none" stroke="${maColor}" stroke-width="2" vector-effect="non-scaling-stroke" aria-label="SMA 20"/>`:''}
      <line data-qelly-crosshair-x x1="0" y1="${padTop}" x2="0" y2="${volumeBottom}" stroke="${accent}" stroke-width="1" stroke-dasharray="4 4" visibility="hidden" vector-effect="non-scaling-stroke"/>
      <line data-qelly-crosshair-y x1="${padLeft}" y1="0" x2="${width-padRight}" y2="0" stroke="${accent}" stroke-width="1" stroke-dasharray="4 4" visibility="hidden" vector-effect="non-scaling-stroke"/>
      <text x="${padLeft}" y="${height-8}" fill="${label}" font-size="11">${esc(timeLabel(firstTime))}</text>
      <text x="${width-padRight}" y="${height-8}" text-anchor="end" fill="${label}" font-size="11">${esc(timeLabel(lastTime))}</text>
      <text x="${padLeft}" y="${volumeTop-8}" fill="${label}" font-size="10">VOLUME</text>
      <text x="${padLeft+62}" y="${volumeTop-8}" fill="${maColor}" font-size="10">SMA 20</text>
    </svg>
    <div class="q-chart-fallback-note"><strong>Qelly first-party renderer</strong><span>CSP-safe · no third-party runtime script · renders only the governed data envelope supplied by Qelly.</span></div>
  </div>`;
}

export async function mountLiveMarketChart(container,{points,symbol='BTCUSDT',interval='1m',onCrosshair=null}={}){
  if(!container)return {engine:'Qelly first-party SVG',destroy(){},update(){}};
  let series=normalize(points),destroyed=false,frame=null;
  const maxPoints=Math.max(30,series.length||260);

  const bindCrosshair=()=>{
    const svg=container.querySelector('[data-qelly-market-svg]');
    if(!svg)return;
    const xLine=svg.querySelector('[data-qelly-crosshair-x]'),yLine=svg.querySelector('[data-qelly-crosshair-y]');
    const width=1120,padLeft=56,padRight=74,padTop=28,priceBottom=392,plotWidth=width-padLeft-padRight;
    const min=Math.min(...series.map((point)=>point.low)),max=Math.max(...series.map((point)=>point.high)),range=Math.max(max-min,Math.abs(max)*0.00001,1e-9);
    const y=(value)=>padTop+((max-value)/range)*(priceBottom-padTop);
    svg.addEventListener('pointermove',(event)=>{
      if(!series.length)return;
      const rect=svg.getBoundingClientRect();
      if(!rect.width)return;
      const localX=(event.clientX-rect.left)/rect.width*width;
      const ratio=Math.max(0,Math.min(0.999999,(localX-padLeft)/plotWidth));
      const index=Math.min(series.length-1,Math.max(0,Math.floor(ratio*series.length)));
      const bar=series[index],x=padLeft+(index+.5)*(plotWidth/series.length),cy=y(bar.close);
      xLine?.setAttribute('x1',String(x));xLine?.setAttribute('x2',String(x));xLine?.setAttribute('visibility','visible');
      yLine?.setAttribute('y1',String(cy));yLine?.setAttribute('y2',String(cy));yLine?.setAttribute('visibility','visible');
      if(typeof onCrosshair==='function')onCrosshair(bar);
    });
    svg.addEventListener('pointerleave',()=>{xLine?.setAttribute('visibility','hidden');yLine?.setAttribute('visibility','hidden');});
  };

  const render=()=>{if(destroyed)return;container.innerHTML=chartMarkup(series,symbol);bindCrosshair();};
  const schedule=()=>{if(frame!==null)return;const run=()=>{frame=null;render();};frame=typeof requestAnimationFrame==='function'?requestAnimationFrame(run):setTimeout(run,0);};
  render();

  return {
    engine:'Qelly first-party SVG',
    interval,
    update(point){
      const normalized=normalize([point])[0];
      if(!normalized||destroyed)return;
      if(series.length&&series.at(-1).time===normalized.time)series[series.length-1]=normalized;else series.push(normalized);
      if(series.length>maxPoints)series=series.slice(-maxPoints);
      schedule();
    },
    destroy(){
      destroyed=true;
      if(frame!==null){if(typeof cancelAnimationFrame==='function')cancelAnimationFrame(frame);else clearTimeout(frame);frame=null;}
      container.replaceChildren();
    }
  };
}
