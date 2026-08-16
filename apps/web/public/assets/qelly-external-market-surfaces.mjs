import {mountTradingViewDisplay} from './market/tradingview-display-widget.mjs';

let activeHandle=null;
let lastSignature='';

function ensureStyles(){
  if(document.querySelector('link[data-qelly-v6-production-convergence]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='/assets/qelly-v6-production-convergence.css';
  link.dataset.qellyV6ProductionConvergence='true';
  document.head.append(link);
}

const externalLink=(href,label)=>`<a class="q-button q-button--secondary" href="${href}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
const formatRate=(value)=>Number.isFinite(Number(value))?new Intl.NumberFormat('en-IN',{maximumFractionDigits:6}).format(Number(value)):'—';
const formatDate=(value)=>{const date=new Date(value||'');return Number.isNaN(date.getTime())?'Not supplied':date.toLocaleString('en-IN');};
const stateTone=(state)=>String(state||'').toUpperCase()==='LIVE'?'live':String(state||'').toUpperCase()==='DELAYED'?'delayed':String(state||'').toUpperCase()==='CACHED'?'cached':String(state||'').toUpperCase()==='STALE'?'stale':'unavailable';

function text(tag,value,className){
  const node=document.createElement(tag);
  if(className)node.className=className;
  node.textContent=String(value??'');
  return node;
}

async function loadGovernedReferenceRates(panel){
  if(panel.dataset.loading==='true'||panel.dataset.loaded==='true')return;
  panel.dataset.loading='true';
  const grid=panel.querySelector('[data-qelly-reference-grid]');
  const health=panel.querySelector('[data-qelly-data-plane-health]');
  const badge=panel.querySelector('[data-qelly-reference-state]');
  try{
    const response=await fetch('/api/v1/platform/data-plane?limit=200',{credentials:'same-origin',headers:{Accept:'application/json'}});
    const payload=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(payload?.error?.message||`Governed data plane returned ${response.status}`);
    const items=(Array.isArray(payload?.items)?payload.items:[]).filter(item=>String(item.assetClass||'').toLowerCase()==='fx');
    const preferred=['USD','INR','GBP','JPY','CHF','CNY','CAD','AUD'];
    const ranked=[...items].sort((a,b)=>{
      const left=preferred.indexOf(String(a.quoteAsset||''));
      const right=preferred.indexOf(String(b.quoteAsset||''));
      const li=left<0?999:left,ri=right<0?999:right;
      return li-ri||String(a.symbol||'').localeCompare(String(b.symbol||''));
    }).slice(0,12);
    grid.replaceChildren();
    for(const item of ranked){
      const card=document.createElement('article');
      card.className='q-governed-rate-card';
      const top=document.createElement('div');
      top.className='q-governed-rate-top';
      top.append(text('strong',item.symbol||'—'));
      const chip=text('span',String(item.truthState||'UNAVAILABLE').toUpperCase(),`q-status q-status--${stateTone(item.truthState)}`);
      top.append(chip);
      card.append(top,text('b',formatRate(item.value),'q-governed-rate-value'),text('small',`${item.unit||''} · observed ${formatDate(item.observedAt)}`));
      grid.append(card);
    }
    if(!ranked.length)grid.append(text('div','No governed FX observations are currently available.','q-empty-state'));
    const plane=payload?.dataPlane||{};
    health.textContent=`${Number(plane.instrumentCount)||0} instruments · ${Number(plane.seriesCount)||0} series · ${Number(plane.pointCount)||0} observations · ${Number(plane.openQualityEventCount)||0} open quality events`;
    const state=ranked[0]?.truthState||'UNAVAILABLE';
    badge.textContent=`${String(state).toUpperCase()} · ECB`;
    badge.className=`q-status q-status--${stateTone(state)}`;
    panel.querySelector('[data-qelly-reference-observed]').textContent=`Latest observed ${formatDate(plane.latestObservedAt)}`;
    panel.dataset.loaded='true';
  }catch(error){
    grid.replaceChildren(text('div',String(error?.message||error),'q-empty-state'));
    health.textContent='Governed data-plane verification unavailable';
    badge.textContent='UNAVAILABLE';
    badge.className='q-status q-status--unavailable';
  }finally{
    panel.dataset.loading='false';
  }
}

function ensureGovernedPanel(main,chart){
  let panel=main.querySelector('[data-qelly-governed-reference-surface]');
  if(panel)return panel;
  panel=document.createElement('section');
  panel.className='q-panel q-governed-reference-surface';
  panel.dataset.qellyGovernedReferenceSurface='ecb-reference-rates';
  panel.innerHTML=`
    <div class="q-panel-head q-external-market-head">
      <div>
        <p class="q-eyebrow">Qelly governed data</p>
        <h2>ECB reference-rate data plane</h2>
        <p>Persisted provider observations from the approved ECB reference-rate source. These are real provider observations with a daily reference cadence; they are not simulated and are not execution prices.</p>
      </div>
      <span class="q-status q-status--delayed" data-qelly-reference-state>LOADING · ECB</span>
    </div>
    <div class="q-panel-body">
      <div class="q-governed-data-plane-strip"><strong data-qelly-data-plane-health>Loading governed data plane…</strong><span data-qelly-reference-observed>Observation time pending</span></div>
      <div class="q-governed-reference-grid" data-qelly-reference-grid><div class="q-empty-state">Loading approved provider observations…</div></div>
      <div class="q-chart-attribution"><span>Source: European Central Bank euro foreign exchange reference rates</span><span>Truth state and observed time are retained from the normalized Qelly data plane.</span></div>
    </div>`;
  const layout=chart.closest('.q-live-layout');
  if(layout)layout.after(panel);else main.append(panel);
  void loadGovernedReferenceRates(panel);
  return panel;
}

function ensureExternalPanel(main,chart,governedPanel){
  let panel=main.querySelector('[data-qelly-external-market-surface]');
  if(panel)return panel;
  panel=document.createElement('section');
  panel.className='q-panel q-external-market-surface';
  panel.dataset.qellyExternalMarketSurface='tradingview-display-only';
  panel.innerHTML=`
    <div class="q-panel-head q-external-market-head">
      <div>
        <p class="q-eyebrow">External market display</p>
        <h2>TradingView market visualization</h2>
        <p>Independent human-readable chart surface. It is not a Qelly provider and its values never feed Qelly calculations, risk, alerts or decisions.</p>
      </div>
      <span class="q-status q-status--delayed">DISPLAY ONLY</span>
    </div>
    <div class="q-panel-body">
      <div class="q-external-market-boundary"><strong>Data boundary</strong><span>TradingView widget data remains inside the external widget boundary. Qelly internal analytics continue to use only governed provider data with explicit rights.</span></div>
      <div id="qelly-tradingview-display" class="q-external-tradingview-stage" aria-label="External TradingView market chart"></div>
      <div class="q-external-research-actions">
        ${externalLink('https://www.tradingview.com/','Open TradingView')}
        ${externalLink('https://www.forexfactory.com/calendar','Open Forex Factory calendar')}
        <span>Forex Factory opens as external research; Qelly does not scrape or ingest it.</span>
      </div>
    </div>`;
  if(governedPanel)governedPanel.after(panel);
  else{
    const layout=chart.closest('.q-live-layout');
    if(layout)layout.after(panel);else main.append(panel);
  }
  return panel;
}

function sync(){
  const main=document.getElementById('main');
  if(!main)return;
  const chart=main.querySelector('#qelly-live-chart');
  if(!chart){lastSignature='';activeHandle?.destroy?.();activeHandle=null;return;}
  ensureStyles();
  const governedPanel=ensureGovernedPanel(main,chart);
  const panel=ensureExternalPanel(main,chart,governedPanel);
  const symbol=main.querySelector('#live-symbol')?.value||'BTCUSDT';
  const interval=main.querySelector('#live-interval')?.value||'1h';
  const signature=`${symbol}:${interval}`;
  if(signature===lastSignature&&activeHandle)return;
  lastSignature=signature;
  activeHandle?.destroy?.();
  const host=panel.querySelector('#qelly-tradingview-display');
  if(!host)return;
  try{activeHandle=mountTradingViewDisplay(host,{symbol,interval});}
  catch(error){host.replaceChildren(text('div',String(error?.message||error),'q-empty-state'));}
}

const main=document.getElementById('main');
if(main){
  const observer=new MutationObserver(()=>queueMicrotask(sync));
  observer.observe(main,{childList:true,subtree:true});
  main.addEventListener('change',(event)=>{if(event.target?.matches?.('#live-symbol,#live-interval,#live-provider'))sync();});
  sync();
}

window.__qellyExternalMarketSurfaces={sync};
