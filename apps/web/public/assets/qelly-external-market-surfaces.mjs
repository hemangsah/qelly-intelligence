import {mountTradingViewDisplay} from './market/tradingview-display-widget.mjs';

let activeHandle=null;
let lastSignature='';

const externalLink=(href,label)=>`<a class="q-button q-button--secondary" href="${href}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;

function ensurePanel(main){
  const chart=main.querySelector('#qelly-live-chart');
  if(!chart)return null;
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
  const layout=chart.closest('.q-live-layout');
  if(layout)layout.after(panel);else main.append(panel);
  return panel;
}

function sync(){
  const main=document.getElementById('main');
  if(!main)return;
  const panel=ensurePanel(main);
  if(!panel){lastSignature='';activeHandle?.destroy?.();activeHandle=null;return;}
  const symbol=main.querySelector('#live-symbol')?.value||'BTCUSDT';
  const interval=main.querySelector('#live-interval')?.value||'1h';
  const signature=`${symbol}:${interval}`;
  if(signature===lastSignature&&activeHandle)return;
  lastSignature=signature;
  activeHandle?.destroy?.();
  const host=panel.querySelector('#qelly-tradingview-display');
  if(!host)return;
  try{activeHandle=mountTradingViewDisplay(host,{symbol,interval});}
  catch(error){host.innerHTML=`<div class="q-empty-state"><strong>External chart unavailable</strong><p>${String(error?.message||error)}</p></div>`;}
}

const main=document.getElementById('main');
if(main){
  const observer=new MutationObserver(()=>queueMicrotask(sync));
  observer.observe(main,{childList:true,subtree:true});
  main.addEventListener('change',(event)=>{if(event.target?.matches?.('#live-symbol,#live-interval,#live-provider'))sync();});
  sync();
}

window.__qellyExternalMarketSurfaces={sync};
