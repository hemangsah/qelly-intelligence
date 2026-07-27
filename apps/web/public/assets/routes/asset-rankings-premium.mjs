import { icon } from '../icon-registry.mjs';
import { bindChart,chartMarkup } from './asset-rankings-chart.mjs';
import { COLUMN_DEFINITIONS,compactNumber,deterministicOHLC,deterministicRows,money,observedAt,percent,tone } from './asset-rankings-data.mjs';
import { bindTable,tableMarkup } from './asset-rankings-table.mjs';

const VIEW_KEY='qelly-premium-market-view-v3';
const WATCH_KEY='qelly-premium-watchlist-v3';
const safeStorage={
  read(key,fallback){try{return JSON.parse(localStorage.getItem(key)??'null')??fallback;}catch{return fallback;}},
  write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
};

function initialView(){
  const stored=safeStorage.read(VIEW_KEY,{});
  const columns=new Set(Array.isArray(stored.columns)?stored.columns:COLUMN_DEFINITIONS.map(([key])=>key));
  return {
    mode:['discovery','terminal','research'].includes(stored.mode)?stored.mode:'discovery',
    chartMode:['candlestick','line','area'].includes(stored.chartMode)?stored.chartMode:'candlestick',
    timeframe:['1H','4H','1D','1W'].includes(stored.timeframe)?stored.timeframe:'1D',
    density:['comfortable','compact','terminal'].includes(stored.density)?stored.density:'compact',
    query:'',direction:'all',confidence:'0',universe:'all',savedView:'all',sorts:[],columns
  };
}

function applyView(rows,view,watchlist){
  const query=view.query.trim().toLowerCase();
  const filtered=rows.filter((row)=>{
    if(query&&!`${row.symbol} ${row.name}`.toLowerCase().includes(query))return false;
    if(view.direction==='positive'&&row.change24h<=0)return false;
    if(view.direction==='negative'&&row.change24h>=0)return false;
    if(row.confidence<Number(view.confidence))return false;
    if(view.universe==='funding-positive'&&row.funding<=0)return false;
    if(view.universe==='oi-expansion'&&row.oiChange<=1.5)return false;
    if(view.universe==='liquidation-risk'&&row.liquidation<5e6)return false;
    if(view.savedView==='momentum'&&row.change7d<4)return false;
    if(view.savedView==='derivatives'&&row.openInterest<1e9)return false;
    if(view.savedView==='quality'&&row.confidence<88)return false;
    if(view.savedView==='watchlist'&&!watchlist.has(row.id))return false;
    return true;
  });
  if(!view.sorts.length)return filtered;
  return [...filtered].sort((left,right)=>{
    for(const {key,direction} of view.sorts){
      const a=left[key],b=right[key];
      const comparison=typeof a==='number'&&typeof b==='number'?a-b:String(a??'').localeCompare(String(b??''));
      if(comparison)return direction==='ascending'?comparison:-comparison;
    }
    return 0;
  });
}

function marketPulse(rows){
  const totalCap=rows.reduce((sum,row)=>sum+row.marketCap,0);
  const volume=rows.reduce((sum,row)=>sum+row.volume,0);
  const oi=rows.reduce((sum,row)=>sum+row.openInterest,0);
  const liquidations=rows.reduce((sum,row)=>sum+row.liquidation,0);
  const advancers=rows.filter((row)=>row.change24h>0).length;
  const breadth=Math.round(advancers/rows.length*100);
  const averageFunding=rows.reduce((sum,row)=>sum+row.funding,0)/rows.length;
  return `<section class="q-mi-kpis q-mi-market-pulse" aria-label="Market pulse">
    <article class="q-mi-kpi is-primary"><span>Global market cap</span><strong>$${compactNumber(totalCap)}</strong><small class="is-positive">+1.86% · broad participation</small></article>
    <article class="q-mi-kpi is-primary"><span>24h spot volume</span><strong>$${compactNumber(volume)}</strong><small>16-asset review universe</small></article>
    <article class="q-mi-kpi"><span>Open interest</span><strong>$${compactNumber(oi)}</strong><small class="is-positive">+2.14% aggregate</small></article>
    <article class="q-mi-kpi"><span>Liquidations</span><strong>$${compactNumber(liquidations)}</strong><small class="is-negative">Long pressure 58%</small></article>
    <article class="q-mi-kpi"><span>Funding</span><strong>${percent(averageFunding,4)}</strong><small>OI-weighted neutral-positive</small></article>
    <article class="q-mi-kpi"><span>Volatility</span><strong>52.8</strong><small>30-day composite</small></article>
    <article class="q-mi-breadth"><span>Market breadth <b>${advancers} / ${rows.length-advancers}</b></span><div><i style="width:${breadth}%"></i></div><small>${breadth}% advancing</small></article>
    <article class="q-mi-regime">${icon('markets')}<span><small>Market regime</small><strong>Risk-on, selective leverage</strong></span></article>
    <article class="q-mi-pressure">${icon('derivatives')}<span><small>Derivatives pressure</small><strong>OI rising faster than price</strong></span></article>
  </section>`;
}

function intelligenceMarkup(rows,mode){
  const leaders=[...rows].sort((a,b)=>b.oiChange-a.oiChange).slice(0,4);
  return `<aside class="q-mi-side-stack" aria-label="Market intelligence">
    <section class="q-mi-intelligence-module"><header><div><p>Derivatives lens</p><h2>Pressure monitor</h2></div><span>Terminal</span></header>
      ${leaders.map((row,index)=>`<button type="button" data-mi-explain="${row.id}"><i class="${tone(row.oiChange)}"></i><span><strong>${index+1}. ${row.symbol}</strong><small>OI ${percent(row.oiChange)} · funding ${percent(row.funding,4)}</small></span><b>$${compactNumber(row.openInterest)}</b></button>`).join('')}
    </section>
    <section class="q-mi-intelligence-module"><header><div><p>Provider agreement</p><h2>Evidence quality</h2></div><span>4 sources</span></header>
      <div class="q-mi-agreement"><strong>92</strong><span><b>High agreement</b><small>Variance remains below the review threshold across price and volume observations.</small></span></div>
      <div class="q-mi-heat-strip" aria-label="Provider agreement heat strip"><i></i><i></i><i></i><i class="is-warning"></i><i></i><i></i><i></i><i></i></div>
    </section>
    ${mode==='research'?`<section class="q-mi-research-note"><p>Research context</p><h2>Leverage is expanding without a matching deterioration in breadth.</h2><blockquote>Supporting evidence: positive OI change, contained funding, and 75% advancing breadth. Contradiction: liquidation concentration remains elevated in high-beta assets.</blockquote><footer>Generated from deterministic review evidence · not investment advice</footer></section>`:''}
  </aside>`;
}

function statusCenter(){
  return `<div class="q-mi-truth-banner" role="status"><span class="q-mi-status-dot"></span><strong>Static visual preview</strong><span>Deterministic demo observations · backend unavailable · no production trading or persistence</span><button type="button" data-mi-status-detail>Review boundary</button></div>`;
}

function drawerMarkup(){
  return `<aside class="q-mi-drawer" data-mi-drawer aria-hidden="true" aria-labelledby="q-mi-drawer-title">
    <button type="button" class="q-mi-drawer-backdrop" data-mi-drawer-close aria-label="Close explanation"></button>
    <section><header><div><p>Evidence-backed explanation</p><h2 id="q-mi-drawer-title">Explain this move</h2></div><button type="button" data-mi-drawer-close aria-label="Close explanation">${icon('close')}</button></header>
      <div data-mi-drawer-content></div>
    </section>
  </aside>`;
}

function explanation(row){
  return `<div class="q-mi-explanation-summary"><span class="q-mi-asset-mark">${row.symbol.slice(0,2)}</span><div><strong>${row.name}</strong><small>${money(row.price)} · ${percent(row.change24h)} over 24h</small></div><b>${row.confidence}/100 confidence</b></div>
    <section><h3>Most supported interpretation</h3><p>Price strength is accompanied by ${percent(row.oiChange)} open-interest expansion and ${percent(row.funding,4)} funding. The evidence supports renewed directional participation, while the funding level does not yet indicate an extreme crowding regime.</p></section>
    <section class="q-mi-evidence-grid"><article><span>Supports</span><strong>OI expansion</strong><p>Participation increased while liquidity stayed above the review threshold.</p></article><article><span>Contradicts</span><strong>Liquidation risk</strong><p>$${compactNumber(row.liquidation)} of deterministic liquidation exposure may amplify reversals.</p></article></section>
    <section><h3>Source and limitations</h3><dl><div><dt>Source</dt><dd>${row.source}</dd></div><div><dt>Observed</dt><dd>${new Date(row.observedAt).toLocaleString('en-US')}</dd></div><div><dt>Freshness</dt><dd>${row.freshness}</dd></div><div><dt>Method</dt><dd>Qelly deterministic composite v2</dd></div></dl><p>This is a static review explanation, not live market evidence or investment advice.</p></section>
    <footer><button type="button">Export evidence package</button><button type="button">Open Decision Provenance</button></footer>`;
}

export async function renderAssetRankings(main,{api,escapeHtml,navigate,toast,staticVisualPreview}){
  const response=await api('/api/v1/public/markets/assets?sort=change&direction=desc');
  const rows=deterministicRows(response.items??[]);
  const candles=deterministicOHLC({seed:rows[0].price,count:120});
  const view=initialView();
  const watchlist=new Set(safeStorage.read(WATCH_KEY,[]));
  const save=()=>{
    safeStorage.write(VIEW_KEY,{mode:view.mode,chartMode:view.chartMode,timeframe:view.timeframe,density:view.density,columns:[...view.columns]});
    safeStorage.write(WATCH_KEY,[...watchlist]);
  };
  const openDrawer=(id)=>{
    const row=rows.find((item)=>item.id===id)||rows[0];
    const drawer=main.querySelector('[data-mi-drawer]');
    drawer.querySelector('[data-mi-drawer-content]').innerHTML=explanation(row);
    drawer.classList.add('is-open');drawer.setAttribute('aria-hidden','false');document.body.classList.add('q-mi-drawer-open');
    drawer.querySelector('[data-mi-drawer-close]')?.focus();
  };
  const closeDrawer=()=>{const drawer=main.querySelector('[data-mi-drawer]');drawer?.classList.remove('is-open');drawer?.setAttribute('aria-hidden','true');document.body.classList.remove('q-mi-drawer-open');};
  const render=()=>{
    save();
    const visible=applyView(rows,view,watchlist);
    const chartCount={"1H":42,"4H":64,"1D":88,"1W":120}[view.timeframe]??88;
    main.innerHTML=`<section class="q-mi-page" data-mi-mode="${view.mode}">
      ${statusCenter()}
      <header class="q-mi-page-head"><div><p>Markets / Global intelligence</p><h1>Asset rankings</h1><span>Discovery breadth, derivatives context, and decision evidence in one calm institutional workspace.</span></div>
        <div class="q-mi-layout-modes" role="group" aria-label="Workspace layout">
          ${[['discovery','discovery','Discovery'],['terminal','terminal','Terminal'],['research','research','Research']].map(([mode,iconName,label])=>`<button type="button" data-mi-layout-mode="${mode}" class="${view.mode===mode?'is-active':''}" aria-pressed="${view.mode===mode}">${icon(iconName)} ${label}</button>`).join('')}
        </div>
      </header>
      ${marketPulse(rows)}
      ${tableMarkup(visible,view,{watchlist,escapeHtml})}
      <div class="q-mi-analytical-grid">${chartMarkup(candles.slice(-chartCount),{mode:view.chartMode,timeframe:view.timeframe})}${intelligenceMarkup(rows,view.mode)}</div>
      ${drawerMarkup()}
    </section>`;
    main.querySelectorAll('[data-mi-layout-mode]').forEach((button)=>button.addEventListener('click',()=>{view.mode=button.dataset.miLayoutMode;render();}));
    bindTable(main,{rows,view,watchlist,render,toast,onExplain:openDrawer});
    bindChart(main,candles.slice(-chartCount),{onMode:(mode)=>{view.chartMode=mode;render();},onTimeframe:(timeframe)=>{view.timeframe=timeframe;render();},onExplain:openDrawer});
    main.querySelectorAll('[data-mi-drawer-close]').forEach((button)=>button.addEventListener('click',closeDrawer));
    main.querySelectorAll('.q-mi-side-stack [data-mi-explain]').forEach((button)=>button.addEventListener('click',()=>openDrawer(button.dataset.miExplain)));
    main.querySelector('[data-mi-status-detail]')?.addEventListener('click',()=>toast('Static visual preview: deterministic review data, backend unavailable, no persistence or execution.',{tone:'neutral'}));
    main.querySelector('.q-mi-table-scroll')?.addEventListener('keydown',(event)=>{
      const row=event.target.closest('tr');if(!row)return;
      if(event.key==='Enter'){event.preventDefault();openDrawer(row.dataset.miRow);}
      if(event.key==='ArrowDown'){event.preventDefault();row.nextElementSibling?.focus();}
      if(event.key==='ArrowUp'){event.preventDefault();row.previousElementSibling?.focus();}
    });
    if(!staticVisualPreview)main.querySelector('.q-mi-truth-banner span:nth-of-type(2)').textContent=`Provider state observed ${new Date(observedAt).toLocaleString('en-US')}`;
  };
  render();
}
