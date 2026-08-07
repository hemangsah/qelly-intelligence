import { icon } from '../icon-registry.mjs';
import { bindChart,chartMarkup } from './asset-rankings-chart.mjs';
import { COLUMN_DEFINITIONS,compactNumber,demonstrationRows,deterministicOHLC,money,percent,tone } from './asset-rankings-data.mjs';
import { bindTable,tableMarkup } from './asset-rankings-table.mjs';

const VIEW_KEY='qelly-premium-market-view-v3';
const WATCH_KEY='qelly-premium-watchlist-v3';
const safeStorage={
  read(key,fallback){try{return JSON.parse(localStorage.getItem(key)??'null')??fallback;}catch{return fallback;}},
  write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
};

function routeQuery(){
  const query=String(location.hash.split('?')[1]??'');
  const parameters=new URLSearchParams(query);
  return parameters.get('query')??parameters.get('q')??'';
}

function initialView(){
  const stored=safeStorage.read(VIEW_KEY,{});
  const columns=new Set(Array.isArray(stored.columns)?stored.columns:COLUMN_DEFINITIONS.map(([key])=>key));
  return {
    mode:['discovery','terminal','research'].includes(stored.mode)?stored.mode:'discovery',
    chartMode:['candlestick','line','area'].includes(stored.chartMode)?stored.chartMode:'candlestick',
    timeframe:['1H','4H','1D','1W'].includes(stored.timeframe)?stored.timeframe:'1D',
    density:['comfortable','compact','terminal'].includes(stored.density)?stored.density:'compact',
    query:routeQuery(),direction:'all',confidence:'0',universe:'all',savedView:'all',sorts:[],columns
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
  return `<section class="q-mi-kpis q-mi-market-pulse" aria-label="Deterministic demonstration market pulse">
    <article class="q-mi-kpi is-primary"><span>Demonstration market cap</span><strong>$${compactNumber(totalCap)}</strong><small>Fixed review universe · not a live aggregate</small></article>
    <article class="q-mi-kpi is-primary"><span>Demonstration volume</span><strong>$${compactNumber(volume)}</strong><small>${rows.length}-asset fixed scenario</small></article>
    <article class="q-mi-kpi"><span>Demonstration open interest</span><strong>$${compactNumber(oi)}</strong><small>Scenario input · not provider evidence</small></article>
    <article class="q-mi-kpi"><span>Demonstration liquidations</span><strong>$${compactNumber(liquidations)}</strong><small>Scenario input · not observed exposure</small></article>
    <article class="q-mi-kpi"><span>Demonstration funding</span><strong>${percent(averageFunding,4)}</strong><small>Unweighted scenario average</small></article>
    <article class="q-mi-kpi"><span>Demonstration volatility</span><strong>52.8</strong><small>Fixed scenario score</small></article>
    <article class="q-mi-breadth"><span>Scenario breadth <b>${advancers} / ${rows.length-advancers}</b></span><div><i style="width:${breadth}%"></i></div><small>${breadth}% advancing in the demonstration</small></article>
    <article class="q-mi-regime">${icon('markets')}<span><small>Regime assessment</small><strong>Not assessed from live evidence</strong></span></article>
    <article class="q-mi-pressure">${icon('derivatives')}<span><small>Derivatives pressure</small><strong>Demonstration only</strong></span></article>
  </section>`;
}

function intelligenceMarkup(rows,mode){
  const leaders=[...rows].sort((a,b)=>b.oiChange-a.oiChange).slice(0,4);
  return `<aside class="q-mi-side-stack" aria-label="Demonstration market intelligence">
    <section class="q-mi-intelligence-module"><header><div><p>Demonstration derivatives lens</p><h2>Scenario pressure monitor</h2></div><span>Demo</span></header>
      ${leaders.map((row,index)=>`<button type="button" data-mi-explain="${row.id}"><i class="${tone(row.oiChange)}"></i><span><strong>${index+1}. ${row.symbol}</strong><small>Scenario OI ${percent(row.oiChange)} · funding ${percent(row.funding,4)}</small></span><b>$${compactNumber(row.openInterest)}</b></button>`).join('')}
    </section>
    <section class="q-mi-intelligence-module"><header><div><p>Evidence boundary</p><h2>Provider agreement</h2></div><span>Not assessed</span></header>
      <div class="q-mi-agreement"><strong>—</strong><span><b>No live provider-agreement score</b><small>The values on this screen come from one fixed deterministic scenario and must not be interpreted as current market observations.</small></span></div>
      <div class="q-mi-heat-strip" aria-label="Provider agreement unavailable"><i class="is-warning"></i><i class="is-warning"></i><i class="is-warning"></i><i class="is-warning"></i></div>
    </section>
    ${mode==='research'?`<section class="q-mi-research-note"><p>Research boundary</p><h2>This workspace demonstrates how Qelly structures evidence; it does not establish a current market conclusion.</h2><blockquote>Computed from fixed scenario rows. Provider freshness, cross-source agreement, transaction costs and execution quality are not assessed.</blockquote><footer>Deterministic demonstration · not investment advice</footer></section>`:''}
  </aside>`;
}

function statusCenter(staticVisualPreview){
  return `<div class="q-mi-truth-banner" role="status"><span class="q-mi-status-dot"></span><strong>Deterministic demonstration</strong><span>${staticVisualPreview?'Static visual preview · backend unavailable · ':''}fixed scenario observations · no live provider blending · no trading or persistence</span><button type="button" data-mi-status-detail>Review boundary</button></div>`;
}

function drawerMarkup(){
  return `<aside class="q-mi-drawer" data-mi-drawer aria-hidden="true" aria-labelledby="q-mi-drawer-title">
    <button type="button" class="q-mi-drawer-backdrop" data-mi-drawer-close aria-label="Close explanation"></button>
    <section><header><div><p>Demonstration explanation</p><h2 id="q-mi-drawer-title">Explain this scenario</h2></div><button type="button" data-mi-drawer-close aria-label="Close explanation">${icon('close')}</button></header>
      <div data-mi-drawer-content></div>
    </section>
  </aside>`;
}

function explanation(row){
  return `<div class="q-mi-explanation-summary"><span class="q-mi-asset-mark">${row.symbol.slice(0,2)}</span><div><strong>${row.name}</strong><small>${money(row.price)} · ${percent(row.change24h)} scenario change</small></div><b>${row.confidence}/100 heuristic score</b></div>
    <section><h3>Demonstration interpretation</h3><p>The fixed scenario combines ${percent(row.oiChange)} open-interest expansion with ${percent(row.funding,4)} funding. This illustrates the structure of a Qelly explanation; it is not a current claim about ${row.symbol}.</p></section>
    <section class="q-mi-evidence-grid"><article><span>Scenario support</span><strong>OI expansion</strong><p>A deterministic input used to demonstrate the evidence hierarchy.</p></article><article><span>Scenario contradiction</span><strong>Liquidation sensitivity</strong><p>$${compactNumber(row.liquidation)} is a fixed scenario value, not observed exposure.</p></article></section>
    <section><h3>Source and limitations</h3><dl><div><dt>Source</dt><dd>${row.source}</dd></div><div><dt>Scenario date</dt><dd>${new Date(row.observedAt).toLocaleString('en-US')}</dd></div><div><dt>Truth state</dt><dd>${row.evidenceState}</dd></div><div><dt>Method</dt><dd>Qelly deterministic demonstration v3</dd></div></dl><p>Live provider freshness, cross-source agreement, transaction costs, execution conditions and personalized suitability are not assessed.</p></section>
    <footer><button type="button" data-mi-export-evidence>Export demonstration evidence</button><button type="button" data-mi-open-provenance>Open Decision Provenance</button></footer>`;
}

function downloadEvidence(row){
  const payload={
    schemaVersion:'qelly.asset-ranking-demonstration/1.0.0',
    generatedAt:new Date().toISOString(),
    truthState:'DEMONSTRATION',
    boundary:'Fixed deterministic scenario. No live provider blending, execution, custody or personalized recommendation.',
    row
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download=`qelly-${row.symbol.toLowerCase()}-demonstration-evidence.json`;
  document.body.append(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
}

export async function renderAssetRankings(main,{escapeHtml,navigate,toast,staticVisualPreview}){
  const rows=demonstrationRows();
  const candles=deterministicOHLC({seed:rows[0].price,count:120});
  const view=initialView();
  const watchlist=new Set(safeStorage.read(WATCH_KEY,[]));
  let returnFocus=null;
  main.__qellyAssetRankingsKeyboard?.abort?.();
  const keyboardController=new AbortController();
  main.__qellyAssetRankingsKeyboard=keyboardController;
  const save=()=>{
    safeStorage.write(VIEW_KEY,{mode:view.mode,chartMode:view.chartMode,timeframe:view.timeframe,density:view.density,columns:[...view.columns]});
    safeStorage.write(WATCH_KEY,[...watchlist]);
  };
  const closeDrawer=()=>{
    const drawer=main.querySelector('[data-mi-drawer]');
    drawer?.classList.remove('is-open');drawer?.setAttribute('aria-hidden','true');document.body.classList.remove('q-mi-drawer-open');
    returnFocus?.focus?.();returnFocus=null;
  };
  const openDrawer=(id,trigger=null)=>{
    const row=rows.find((item)=>item.id===id)||rows[0];
    const drawer=main.querySelector('[data-mi-drawer]');
    returnFocus=trigger??document.activeElement;
    drawer.querySelector('[data-mi-drawer-content]').innerHTML=explanation(row);
    drawer.classList.add('is-open');drawer.setAttribute('aria-hidden','false');document.body.classList.add('q-mi-drawer-open');
    drawer.querySelector('[data-mi-drawer-close]')?.focus();
    drawer.querySelector('[data-mi-export-evidence]')?.addEventListener('click',()=>{downloadEvidence(row);toast('Demonstration evidence exported.',{tone:'positive'});});
    drawer.querySelector('[data-mi-open-provenance]')?.addEventListener('click',()=>navigate('decision-provenance'));
  };
  const render=()=>{
    save();
    const visible=applyView(rows,view,watchlist);
    const chartCount={"1H":42,"4H":64,"1D":88,"1W":120}[view.timeframe]??88;
    main.innerHTML=`<section class="q-mi-page" data-mi-mode="${view.mode}" data-evidence-state="DEMONSTRATION">
      ${statusCenter(staticVisualPreview)}
      <header class="q-mi-page-head"><div><p>Markets / Demonstration workspace</p><h1>Asset rankings</h1><span>A fixed scenario showing Qelly's evidence structure. Values are not live market observations.</span></div>
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
    bindTable(main,{rows,view,watchlist,render,toast,onExplain:(id,trigger)=>openDrawer(id,trigger)});
    bindChart(main,candles.slice(-chartCount),{onMode:(mode)=>{view.chartMode=mode;render();},onTimeframe:(timeframe)=>{view.timeframe=timeframe;render();},onExplain:(id,trigger)=>openDrawer(id,trigger)});
    main.querySelectorAll('[data-mi-drawer-close]').forEach((button)=>button.addEventListener('click',closeDrawer));
    main.querySelectorAll('.q-mi-side-stack [data-mi-explain]').forEach((button)=>button.addEventListener('click',()=>openDrawer(button.dataset.miExplain,button)));
    main.querySelector('[data-mi-status-detail]')?.addEventListener('click',()=>toast('Deterministic demonstration: fixed values, no live provider blending, no persistence, execution or personalized advice.',{tone:'neutral'}));
    main.querySelector('.q-mi-table-scroll')?.addEventListener('keydown',(event)=>{
      const row=event.target.closest('tr');if(!row)return;
      if(event.key==='Enter'){event.preventDefault();openDrawer(row.dataset.miRow,row);}
      if(event.key==='ArrowDown'){event.preventDefault();row.nextElementSibling?.focus();}
      if(event.key==='ArrowUp'){event.preventDefault();row.previousElementSibling?.focus();}
    });
  };
  main.addEventListener('keydown',(event)=>{
    if(event.key==='Escape'&&main.querySelector('[data-mi-drawer].is-open')){
      event.preventDefault();
      closeDrawer();
    }
  },{signal:keyboardController.signal});
  render();
}
