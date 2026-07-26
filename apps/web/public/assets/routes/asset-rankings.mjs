const DEMO_SUPPLEMENT = Object.freeze({
  BTC:{change7d:6.22,marketCap:1_270_000_000_000,funding:0.0068,openInterest:31_400_000_000,liquidation:52_400_000,confidence:50,accent:'#f6a10a',derivatives:true},
  ETH:{change7d:4.18,marketCap:410_200_000_000,funding:0.0059,openInterest:14_800_000_000,liquidation:31_600_000,confidence:50,accent:'#9a8cff',derivatives:true},
  SOL:{change7d:8.12,marketCap:72_600_000_000,funding:0.0112,openInterest:4_700_000_000,liquidation:11_900_000,confidence:50,accent:'#64e6c6',derivatives:true},
  BNB:{change7d:2.02,marketCap:48_100_000_000,funding:0.0044,openInterest:3_100_000_000,liquidation:7_300_000,confidence:50,accent:'#ffbe55',derivatives:true},
  XRP:{change7d:-1.41,marketCap:60_400_000_000,funding:0.0031,openInterest:2_100_000_000,liquidation:4_200_000,confidence:50,accent:'#efefef',derivatives:true},
  ADA:{change7d:3.86,marketCap:18_500_000_000,funding:0.0052,openInterest:1_300_000_000,liquidation:2_600_000,confidence:50,accent:'#6bd4ff',derivatives:false}
});

const KPI_FIXTURES = Object.freeze([
  {label:'Global Market Cap',value:'$2.41T',detail:'+1.86%',tone:'positive',spark:[8,11,10,16,15,21,24]},
  {label:'24h Volume',value:'$109.7B',detail:'−3.24%',tone:'negative',spark:[24,21,23,17,18,12,14]},
  {label:'Open Interest',value:'$114.65B',detail:'+0.54%',tone:'informational',spark:[12,14,13,17,16,20,22]},
  {label:'Liquidations',value:'$180.19M',detail:'−47.29%',tone:'negative',spark:[25,22,18,20,15,10,8]},
  {label:'Funding Regime',value:'+0.0071%',detail:'Neutral',tone:'evidence',spark:[15,14,16,15,17,16,17]},
  {label:'Market Breadth',value:'62 / 38',detail:'Advancers lead',tone:'positive',spark:[10,13,12,16,18,21,23]}
]);

const TABLE_COLUMNS = Object.freeze([
  {key:'asset',label:'Asset'},
  {key:'price',label:'Price',numeric:true},
  {key:'change24h',label:'24h',numeric:true},
  {key:'change7d',label:'7d',numeric:true},
  {key:'volume',label:'Volume',numeric:true},
  {key:'marketCap',label:'Market Cap',numeric:true},
  {key:'funding',label:'Funding',numeric:true},
  {key:'openInterest',label:'OI',numeric:true},
  {key:'liquidation',label:'Liquidation',numeric:true},
  {key:'confidence',label:'Confidence',numeric:true},
  {key:'source',label:'Source'},
  {key:'watchlist',label:'Watchlist'}
]);

const TIMEFRAME_POINTS = Object.freeze({'1H':24,'4H':72,'1D':120,'1W':168});
const DEMO_WATCHLIST_KEY = 'qelly-static-preview-watchlist-v1';
const DEMO_VIEW_KEY = 'qelly-static-preview-market-view-v1';

const compactNumber=(value,{currency=true}={})=>{
  if(value==null||Number.isNaN(Number(value)))return 'N/A';
  return new Intl.NumberFormat('en-US',{
    notation:'compact',
    style:currency?'currency':'decimal',
    currency:'USD',
    maximumFractionDigits:2
  }).format(Number(value));
};

const priceLabel=(value)=>{
  if(value==null||Number.isNaN(Number(value)))return 'N/A';
  const number=Number(value);
  const digits=number<1?4:number<100?2:0;
  return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:digits,maximumFractionDigits:digits}).format(number);
};

const percentLabel=(value,{funding=false}={})=>{
  if(value==null||Number.isNaN(Number(value)))return 'N/A';
  const number=Number(value);
  return `${number>0?'+':''}${number.toFixed(funding?4:2)}%`;
};

const safeStorage=()=>({
  read(key,fallback){
    try{return JSON.parse(localStorage.getItem(key)??JSON.stringify(fallback));}
    catch{return fallback;}
  },
  write(key,value){
    try{localStorage.setItem(key,JSON.stringify(value));return true;}
    catch{return false;}
  }
});

function normalizeRows(items,staticVisualPreview){
  return items.map((item,index)=>{
    const demo=staticVisualPreview?(DEMO_SUPPLEMENT[item.symbol]??{}):{};
    const source=item.source??{};
    return {
      id:item.canonicalId??item.id??item.symbol,
      canonicalId:item.canonicalId??item.id??item.symbol,
      symbol:item.symbol,
      name:item.name,
      price:item.price,
      change24h:item.change24h,
      change7d:item.change7d??demo.change7d??null,
      volume:item.quoteVolume24h??item.volume24h??null,
      marketCap:item.marketCap??demo.marketCap??null,
      funding:item.fundingRate??demo.funding??null,
      openInterest:item.openInterest??demo.openInterest??null,
      liquidation:item.liquidation24h??demo.liquidation??null,
      confidence:source.confidence==null?(demo.confidence??null):Math.round(Number(source.confidence)*100),
      source:source.providerName??source.provider??'Unavailable',
      sourceState:source.qualityState??source.freshness??'unavailable',
      observedAt:source.observedAt??source.observationTime??null,
      accent:demo.accent??['#f6a10a','#9a8cff','#64e6c6','#ffbe55','#efefef','#6bd4ff'][index%6],
      derivatives:demo.derivatives??item.fundingRate!=null??false
    };
  });
}

function sparkline(values){
  const width=116,height=34,pad=2;
  const min=Math.min(...values),max=Math.max(...values),span=Math.max(1,max-min);
  const points=values.map((value,index)=>`${pad+(index/Math.max(1,values.length-1))*(width-pad*2)},${height-pad-((value-min)/span)*(height-pad*2)}`).join(' ');
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}"/></svg>`;
}

function derivedKpis(rows,staticVisualPreview){
  if(staticVisualPreview)return KPI_FIXTURES;
  const volume=rows.reduce((sum,row)=>sum+(Number(row.volume)||0),0);
  const marketCapRows=rows.filter((row)=>row.marketCap!=null);
  const openInterestRows=rows.filter((row)=>row.openInterest!=null);
  const liquidationRows=rows.filter((row)=>row.liquidation!=null);
  const fundingRows=rows.filter((row)=>row.funding!=null);
  const advancers=rows.filter((row)=>Number(row.change24h)>0).length;
  const decliners=rows.filter((row)=>Number(row.change24h)<0).length;
  const totalMarketCap=marketCapRows.reduce((sum,row)=>sum+Number(row.marketCap),0);
  const totalOpenInterest=openInterestRows.reduce((sum,row)=>sum+Number(row.openInterest),0);
  const totalLiquidations=liquidationRows.reduce((sum,row)=>sum+Number(row.liquidation),0);
  const averageFunding=fundingRows.length?fundingRows.reduce((sum,row)=>sum+Number(row.funding),0)/fundingRows.length:null;
  return [
    {label:'Global Market Cap',value:marketCapRows.length?compactNumber(totalMarketCap):'N/A',detail:marketCapRows.length?'Observed assets':'Unavailable',tone:'informational',spark:[8,11,10,16,15,21,24]},
    {label:'24h Volume',value:compactNumber(volume),detail:`${rows.length} assets`,tone:'informational',spark:[24,21,23,17,18,12,14]},
    {label:'Open Interest',value:openInterestRows.length?compactNumber(totalOpenInterest):'N/A',detail:openInterestRows.length?'Provider values':'Unavailable',tone:'evidence',spark:[12,14,13,17,16,20,22]},
    {label:'Liquidations',value:liquidationRows.length?compactNumber(totalLiquidations):'N/A',detail:liquidationRows.length?'Provider values':'Unavailable',tone:'negative',spark:[25,22,18,20,15,10,8]},
    {label:'Funding Regime',value:averageFunding==null?'N/A':percentLabel(averageFunding,{funding:true}),detail:averageFunding==null?'Unavailable':'Observed mean',tone:'evidence',spark:[15,14,16,15,17,16,17]},
    {label:'Market Breadth',value:`${advancers} / ${decliners}`,detail:advancers>=decliners?'Advancers lead':'Decliners lead',tone:advancers>=decliners?'positive':'negative',spark:[10,13,12,16,18,21,23]}
  ];
}

function chartModel(points,limit){
  const visible=points.slice(-Math.min(limit,points.length));
  if(!visible.length)return {visible:[],markup:'<div class="q-mi-chart-empty">Chart observations unavailable.</div>'};
  const width=1000,height=330,left=44,right=76,top=24,bottom=42;
  const values=visible.map((point)=>Number(point.close??point.value));
  const minimum=Math.min(...values),maximum=Math.max(...values),span=Math.max(1e-9,maximum-minimum);
  const coordinates=values.map((value,index)=>({
    x:left+(index/Math.max(1,values.length-1))*(width-left-right),
    y:height-bottom-((value-minimum)/span)*(height-top-bottom),
    value,
    point:visible[index]
  }));
  const polyline=coordinates.map((point)=>`${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
  const area=`${left},${height-bottom} ${polyline} ${width-right},${height-bottom}`;
  const yTicks=Array.from({length:4},(_,index)=>{
    const ratio=index/3;
    const y=top+ratio*(height-top-bottom);
    const value=maximum-ratio*span;
    return `<g><line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}" class="q-mi-chart-gridline"/><text x="${width-right+12}" y="${y+4}" class="q-mi-chart-axis-label">${priceLabel(value)}</text></g>`;
  }).join('');
  const xTickIndexes=[0,Math.floor((visible.length-1)/3),Math.floor((visible.length-1)*2/3),visible.length-1];
  const xTicks=xTickIndexes.map((index)=>{
    const coordinate=coordinates[index];
    const date=new Date((visible[index].time??0)*1000);
    const label=Number.isNaN(date.getTime())?String(index+1):date.toLocaleDateString('en-US',{month:'short',day:'2-digit'});
    return `<g><line x1="${coordinate.x}" y1="${top}" x2="${coordinate.x}" y2="${height-bottom}" class="q-mi-chart-gridline is-vertical"/><text x="${coordinate.x}" y="${height-14}" text-anchor="middle" class="q-mi-chart-axis-label">${label}</text></g>`;
  }).join('');
  const latest=coordinates.at(-1);
  return {
    visible,
    coordinates,
    latest:latest.value,
    markup:`<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-labelledby="q-mi-chart-title q-mi-chart-description">
      <title id="q-mi-chart-title">Crypto Market Composite deterministic preview chart</title>
      <desc id="q-mi-chart-description">A line chart of ${visible.length} deterministic preview observations. Latest value ${priceLabel(latest.value)}. This is not live market data.</desc>
      <defs><linearGradient id="q-mi-area-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8E1D4B" stop-opacity=".58"/><stop offset="1" stop-color="#8E1D4B" stop-opacity="0"/></linearGradient></defs>
      ${yTicks}${xTicks}
      <polygon points="${area}" class="q-mi-chart-area"/>
      <polyline points="${polyline}" class="q-mi-chart-line"/>
      <line x1="${latest.x}" y1="${top}" x2="${latest.x}" y2="${height-bottom}" class="q-mi-chart-cursor"/>
      <circle cx="${latest.x}" cy="${latest.y}" r="5" class="q-mi-chart-point"/>
      <rect x="${left}" y="${top}" width="${width-left-right}" height="${height-top-bottom}" class="q-mi-chart-hit"/>
    </svg>`
  };
}

function movementClass(value){
  const number=Number(value);
  return number>0?'is-positive':number<0?'is-negative':'is-neutral';
}

export async function renderAssetRankings(main,{api,escapeHtml,navigate,toast,staticVisualPreview}){
  const [data,candles]=await Promise.all([
    api('/api/v1/public/markets/assets?sort=change&direction=desc'),
    api('/api/v1/public/markets/assets/QI-CRYPTO-BTC/candles?interval=1h&limit=168')
  ]);
  const rows=normalizeRows(data.items??[],staticVisualPreview);
  const kpis=derivedKpis(rows,staticVisualPreview);
  const storage=safeStorage();
  const storedWatchlist=staticVisualPreview?storage.read(DEMO_WATCHLIST_KEY,[]):[];
  const watchlist=new Set(Array.isArray(storedWatchlist)?storedWatchlist:[]);
  const savedView=staticVisualPreview?storage.read(DEMO_VIEW_KEY,null):null;
  const view={
    query:'',
    direction:'all',
    confidence:'0',
    universe:'all',
    density:'standard',
    timeframe:'1D',
    visibleColumns:new Set(TABLE_COLUMNS.map((column)=>column.key))
  };
  if(savedView&&typeof savedView==='object'){
    view.query=String(savedView.query??'');
    view.direction=['all','positive','negative'].includes(savedView.direction)?savedView.direction:'all';
    view.confidence=['0','50','75','90'].includes(String(savedView.confidence))?String(savedView.confidence):'0';
    view.universe=['all','derivatives','spot'].includes(savedView.universe)?savedView.universe:'all';
    view.density=['compact','standard','research'].includes(savedView.density)?savedView.density:'standard';
    view.timeframe=TIMEFRAME_POINTS[savedView.timeframe]?savedView.timeframe:'1D';
    if(Array.isArray(savedView.visibleColumns)){
      const permitted=new Set(TABLE_COLUMNS.map((column)=>column.key));
      view.visibleColumns=new Set(savedView.visibleColumns.filter((key)=>permitted.has(key)));
      view.visibleColumns.add('asset');
      view.visibleColumns.add('watchlist');
    }
  }

  const truthLabel=staticVisualPreview
    ? 'Static visual preview · deterministic demo observations · backend unavailable · no production trading or persistence'
    : data.truthBoundary;
  const gainers=[...rows].sort((a,b)=>Number(b.change24h)-Number(a.change24h)).slice(0,3);

  main.innerHTML=`<section class="q-page q-mi-page">
    <div class="q-mi-truth-banner" role="status">
      <span class="q-mi-truth-icon" aria-hidden="true">◇</span>
      <strong>${staticVisualPreview?'Static visual preview':'Market data boundary'}</strong>
      <span>${escapeHtml(truthLabel)}</span>
    </div>
    <header class="q-mi-page-head">
      <div>
        <p class="q-mi-eyebrow">Markets / cross-asset intelligence</p>
        <h1>Global Market Intelligence</h1>
        <p>Market breadth, derivatives pressure, institutional flows and governed evidence in one analytical surface.</p>
      </div>
      <div class="q-mi-page-actions">
        <button type="button" class="q-mi-button" data-mi-save-view>Saved View</button>
        <button type="button" class="q-mi-button" data-mi-customize>Customize</button>
        <button type="button" class="q-mi-button is-primary" data-mi-explain>Explain Market Move <span aria-hidden="true">✦</span></button>
      </div>
    </header>
    <section class="q-mi-kpis" aria-label="Global market summary">
      ${kpis.map((item)=>`<article class="q-mi-kpi is-${item.tone}">
        <div class="q-mi-kpi-label"><span>${escapeHtml(item.label)}</span><span class="q-mi-demo-mark">${staticVisualPreview?'demo':'observed'}</span></div>
        <strong>${escapeHtml(item.value)}</strong>
        <div class="q-mi-kpi-foot"><span class="${item.detail.startsWith('+')?'is-positive':item.detail.startsWith('−')||item.detail.startsWith('-')?'is-negative':''}">${escapeHtml(item.detail)}</span><span>${sparkline(item.spark)}</span></div>
      </article>`).join('')}
    </section>
    <div class="q-mi-intelligence-layout">
      <section class="q-mi-card q-mi-chart-card">
        <header class="q-mi-card-head">
          <div>
            <span class="q-mi-card-kicker">QELLY-MI-01 · ${staticVisualPreview?'deterministic demo':'provider observations'}</span>
            <h2>Crypto Market Composite</h2>
          </div>
          <div class="q-mi-segment" role="group" aria-label="Chart timeframe">
            ${Object.keys(TIMEFRAME_POINTS).map((timeframe)=>`<button type="button" data-mi-timeframe="${timeframe}" class="${timeframe===view.timeframe?'is-active':''}" aria-pressed="${timeframe===view.timeframe}">${timeframe}</button>`).join('')}
          </div>
        </header>
        <div class="q-mi-chart-meta">
          <span><strong id="q-mi-chart-latest">—</strong> <small>composite level</small></span>
          <span class="q-mi-state-pill is-demo">◇ Demo · not live</span>
        </div>
        <div id="q-mi-chart" class="q-mi-chart-visual">
          <div class="q-mi-chart-tooltip" hidden></div>
        </div>
        <footer class="q-mi-source-line">
          <span>Source: <strong>${escapeHtml(candles.source?.attribution??'Unavailable')}</strong></span>
          <span>Observed: ${escapeHtml(candles.source?.observedAt??data.generatedAt??'Unavailable')}</span>
          <span>Freshness: ${staticVisualPreview?'fixed demo snapshot':escapeHtml(candles.source?.mode??data.mode)}</span>
        </footer>
      </section>
      <aside class="q-mi-side-stack" aria-label="Market intelligence watch">
        <section class="q-mi-card q-mi-mini-card">
          <header><div><span class="q-mi-card-kicker">Momentum scan</span><h2>Top Gainers</h2></div><span class="q-mi-state-pill is-demo">demo</span></header>
          <div class="q-mi-mini-rows">
            ${gainers.map((row,index)=>`<button type="button" data-mi-open-asset="${escapeHtml(row.canonicalId)}">
              <span class="q-mi-rank">${String(index+1).padStart(2,'0')}</span>
              <span><strong>${escapeHtml(row.symbol)}</strong><small>${index===0?'Volume expansion':'Composite momentum'}</small></span>
              <b class="${movementClass(row.change24h)}">${percentLabel(row.change24h)}</b>
            </button>`).join('')}
          </div>
        </section>
        <section class="q-mi-card q-mi-mini-card">
          <header><div><span class="q-mi-card-kicker">Pressure monitor</span><h2>Risk Watch</h2></div><span class="q-mi-state-pill is-warning">△ review</span></header>
          <div class="q-mi-risk-rows">
            <div><span><strong>Unusual OI</strong><small>SOL positioning · demo signal</small></span><b class="is-negative">+14.2%</b></div>
            <div><span><strong>Funding dislocation</strong><small>SOL perpetual · demo metric</small></span><b class="is-warning">+0.0112%</b></div>
            <div><span><strong>Stablecoin flow</strong><small>Illustrative 24h net estimate</small></span><b class="is-positive">+$480M</b></div>
            <div><span><strong>Provider warning</strong><small>No external provider or backend connection</small></span><b class="is-warning">Unavailable</b></div>
          </div>
        </section>
      </aside>
    </div>
    <section class="q-mi-card q-mi-table-card" data-mi-density="${view.density}">
      <header class="q-mi-table-toolbar">
        <div class="q-mi-segment q-mi-universe" role="group" aria-label="Asset universe">
          <button type="button" data-mi-universe="all" class="${view.universe==='all'?'is-active':''}" aria-pressed="${view.universe==='all'}">All Assets</button>
          <button type="button" data-mi-universe="derivatives" class="${view.universe==='derivatives'?'is-active':''}" aria-pressed="${view.universe==='derivatives'}">Derivatives</button>
          <button type="button" data-mi-universe="spot" class="${view.universe==='spot'?'is-active':''}" aria-pressed="${view.universe==='spot'}">Spot</button>
        </div>
        <label class="q-mi-search">
          <span aria-hidden="true">⌕</span>
          <span class="sr-only">Search assets</span>
          <input type="search" data-mi-search value="${escapeHtml(view.query)}" placeholder="Search assets…" autocomplete="off">
        </label>
        <label class="q-mi-density">
          <span class="sr-only">Table density</span>
          <select data-mi-density-select aria-label="Table density">
            <option value="standard" ${view.density==='standard'?'selected':''}>Standard density</option>
            <option value="compact" ${view.density==='compact'?'selected':''}>Compact density</option>
            <option value="research" ${view.density==='research'?'selected':''}>Research density</option>
          </select>
        </label>
        <button type="button" class="q-mi-button" data-mi-filter-toggle aria-expanded="false">Filters</button>
        <button type="button" class="q-mi-button" data-mi-columns-toggle aria-expanded="false">Columns</button>
      </header>
      <div class="q-mi-filter-strip" data-mi-filter-strip hidden>
        <label><span>Direction</span><select data-mi-direction><option value="all" ${view.direction==='all'?'selected':''}>All directions</option><option value="positive" ${view.direction==='positive'?'selected':''}>Advancers</option><option value="negative" ${view.direction==='negative'?'selected':''}>Decliners</option></select></label>
        <label><span>Minimum confidence</span><select data-mi-confidence><option value="0" ${view.confidence==='0'?'selected':''}>Any confidence</option><option value="50" ${view.confidence==='50'?'selected':''}>50+</option><option value="75" ${view.confidence==='75'?'selected':''}>75+</option><option value="90" ${view.confidence==='90'?'selected':''}>90+</option></select></label>
        <button type="button" class="q-mi-button" data-mi-reset>Reset filters</button>
        <span>Filters apply locally to the observations already displayed.</span>
      </div>
      <div class="q-mi-column-menu" data-mi-column-menu hidden>
        <strong>Visible columns</strong>
        <div>${TABLE_COLUMNS.map((column)=>`<label><input type="checkbox" value="${column.key}" ${view.visibleColumns.has(column.key)?'checked':''} ${['asset','watchlist'].includes(column.key)?'disabled':''}><span>${escapeHtml(column.label)}</span></label>`).join('')}</div>
        <small>Asset and Watchlist remain visible. This preference is local to the browser.</small>
      </div>
      <div class="q-mi-table-summary">
        <div><strong>Institutional Asset Monitor</strong><span id="q-mi-row-summary" aria-live="polite"></span></div>
        <div><span class="q-mi-state-pill is-demo">◇ deterministic demo</span><span data-mi-watch-count>${watchlist.size} watched</span></div>
      </div>
      <div id="q-mi-table-host"></div>
    </section>
    <div class="q-mi-drawer-scrim" data-mi-drawer-scrim hidden></div>
    <aside class="q-mi-explain-drawer" data-mi-drawer role="dialog" aria-modal="true" aria-labelledby="q-mi-drawer-title" hidden>
      <header><div><p class="q-mi-eyebrow">Illustrative explanation · deterministic demo</p><h2 id="q-mi-drawer-title">Explain Market Move</h2></div><button type="button" data-mi-drawer-close aria-label="Close market explanation">×</button></header>
      <p>Qelly assembles a transparent example from deterministic observations and competing hypotheses. It is not a live explanation or investment advice.</p>
      <ol>
        <li><strong>Price structure</strong><span>The composite holds above its packaged seven-day median.</span><small>Demo observation · fixed snapshot</small></li>
        <li><strong>Derivative confirmation</strong><span>Illustrative open interest expands while funding remains moderate.</span><small>Demo metric · no connected provider</small></li>
        <li><strong>Spot-flow evidence</strong><span>Packaged volume breadth supports the positive composite move.</span><small>Derived locally · confidence limited</small></li>
        <li class="is-contradiction"><strong>Risk contradiction</strong><span>Concentrated positioning increases sensitivity to a reversal.</span><small>Illustrative risk hypothesis</small></li>
        <li><strong>Conclusion</strong><span>Constructive demo regime with elevated leverage sensitivity.</span><small>Not live · not advice · no execution</small></li>
      </ol>
      <button type="button" class="q-mi-button is-primary" data-mi-open-provenance>Open Decision Provenance</button>
    </aside>
  </section>`;

  const tableCard=main.querySelector('.q-mi-table-card');
  const tableHost=main.querySelector('#q-mi-table-host');
  const rowSummary=main.querySelector('#q-mi-row-summary');
  const watchCount=main.querySelector('[data-mi-watch-count]');
  const columnMenu=main.querySelector('[data-mi-column-menu]');
  const filterStrip=main.querySelector('[data-mi-filter-strip]');
  const drawer=main.querySelector('[data-mi-drawer]');
  const drawerScrim=main.querySelector('[data-mi-drawer-scrim]');
  let drawerReturnFocus=null;

  const visibleRows=()=>rows.filter((row)=>{
    const query=view.query.trim().toLowerCase();
    const matchesQuery=!query||`${row.symbol} ${row.name}`.toLowerCase().includes(query);
    const matchesDirection=view.direction==='all'||view.direction==='positive'&&Number(row.change24h)>0||view.direction==='negative'&&Number(row.change24h)<0;
    const matchesConfidence=Number(row.confidence??0)>=Number(view.confidence);
    const matchesUniverse=view.universe!=='derivatives'||row.derivatives;
    return matchesQuery&&matchesDirection&&matchesConfidence&&matchesUniverse;
  });

  const cellMarkup=(row,key)=>{
    if(key==='asset')return `<button type="button" class="q-mi-asset-cell" data-mi-open-asset="${escapeHtml(row.canonicalId)}"><span class="q-mi-coin" style="--q-mi-coin:${escapeHtml(row.accent)}">${escapeHtml(row.symbol.slice(0,2))}</span><span><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.symbol)} · ${escapeHtml(row.canonicalId)}</small></span></button>`;
    if(key==='price')return `<span class="q-mi-number">${priceLabel(row.price)}</span>`;
    if(key==='change24h')return `<span class="q-mi-number ${movementClass(row.change24h)}">${percentLabel(row.change24h)}</span>`;
    if(key==='change7d')return `<span class="q-mi-number ${movementClass(row.change7d)}">${percentLabel(row.change7d)}</span>`;
    if(key==='volume')return `<span class="q-mi-number">${compactNumber(row.volume)}</span>`;
    if(key==='marketCap')return `<span class="q-mi-number">${compactNumber(row.marketCap)}</span>`;
    if(key==='funding')return `<span class="q-mi-number ${movementClass(row.funding)}">${percentLabel(row.funding,{funding:true})}</span>`;
    if(key==='openInterest')return `<span class="q-mi-number">${compactNumber(row.openInterest)}</span>`;
    if(key==='liquidation')return `<span class="q-mi-number">${compactNumber(row.liquidation)}</span>`;
    if(key==='confidence')return row.confidence==null?'<span class="q-mi-unavailable">N/A</span>':`<span class="q-mi-confidence"><span><i style="width:${Math.max(0,Math.min(100,row.confidence))}%"></i></span><b>${row.confidence}/100</b></span>`;
    if(key==='source')return `<span class="q-mi-provider"><i aria-hidden="true"></i><span><strong>${escapeHtml(row.source)}</strong><small>${staticVisualPreview?'Demo source · not live':escapeHtml(row.sourceState)}</small></span></span>`;
    if(key==='watchlist'){
      const watched=watchlist.has(row.id);
      return `<button type="button" class="q-mi-watch ${watched?'is-watched':''}" data-mi-watch="${escapeHtml(row.id)}" aria-pressed="${watched}" aria-label="${watched?'Remove':'Add'} ${escapeHtml(row.symbol)} ${staticVisualPreview?'from browser demo watchlist':'from watchlist'}">${watched?'★':'☆'}</button>`;
    }
    return '<span class="q-mi-unavailable">N/A</span>';
  };

  const renderTable=()=>{
    const filtered=visibleRows();
    const columns=TABLE_COLUMNS.filter((column)=>view.visibleColumns.has(column.key));
    rowSummary.textContent=`${filtered.length} of ${rows.length} assets · ${view.universe==='all'?'all markets':view.universe}`;
    tableHost.innerHTML=`<div class="q-mi-table-scroll" tabindex="0" aria-label="Scrollable institutional asset monitor">
      <table>
        <caption>Institutional asset monitor with deterministic demo values clearly labelled as not live</caption>
        <thead><tr>${columns.map((column)=>`<th scope="col" data-column="${column.key}" class="${column.numeric?'is-numeric':''}">${escapeHtml(column.label)}</th>`).join('')}</tr></thead>
        <tbody>${filtered.map((row)=>`<tr>${columns.map((column)=>`<td data-column="${column.key}" class="${column.numeric?'is-numeric':''}">${cellMarkup(row,column.key)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
      ${filtered.length?'':'<div class="q-mi-table-empty"><strong>No matching assets</strong><span>Reset the local filters or search another symbol.</span></div>'}
    </div>`;
  };

  const persistView=()=>storage.write(DEMO_VIEW_KEY,{
    query:view.query,
    direction:view.direction,
    confidence:view.confidence,
    universe:view.universe,
    density:view.density,
    timeframe:view.timeframe,
    visibleColumns:[...view.visibleColumns]
  });

  const renderChart=()=>{
    const model=chartModel(candles.points??[],TIMEFRAME_POINTS[view.timeframe]);
    const chart=main.querySelector('#q-mi-chart');
    const tooltip=chart.querySelector('.q-mi-chart-tooltip');
    chart.innerHTML=`${model.markup}<div class="q-mi-chart-tooltip" hidden></div>`;
    main.querySelector('#q-mi-chart-latest').textContent=model.visible.length?priceLabel(model.latest):'N/A';
    main.querySelectorAll('[data-mi-timeframe]').forEach((button)=>{
      const active=button.dataset.miTimeframe===view.timeframe;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    const svg=chart.querySelector('svg');
    const activeTooltip=chart.querySelector('.q-mi-chart-tooltip');
    if(!svg||!model.visible.length)return;
    svg.addEventListener('pointermove',(event)=>{
      const bounds=svg.getBoundingClientRect();
      const ratio=Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width));
      const index=Math.min(model.visible.length-1,Math.round(ratio*(model.visible.length-1)));
      const point=model.visible[index];
      const date=new Date((point.time??0)*1000);
      activeTooltip.innerHTML=`<strong>${priceLabel(point.close??point.value)}</strong><span>${Number.isNaN(date.getTime())?'Demo observation':date.toLocaleString('en-US',{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</span><small>Deterministic demo · not live</small>`;
      activeTooltip.style.left=`${Math.max(76,Math.min(bounds.width-88,event.clientX-bounds.left))}px`;
      activeTooltip.style.top=`${Math.max(54,event.clientY-bounds.top-10)}px`;
      activeTooltip.hidden=false;
    });
    svg.addEventListener('pointerleave',()=>{activeTooltip.hidden=true;});
  };

  const openDrawer=(trigger)=>{
    drawerReturnFocus=trigger;
    drawer.hidden=false;
    drawerScrim.hidden=false;
    requestAnimationFrame(()=>{
      drawer.classList.add('is-open');
      drawerScrim.classList.add('is-open');
      drawer.querySelector('[data-mi-drawer-close]')?.focus();
    });
  };

  const closeDrawer=()=>{
    drawer.classList.remove('is-open');
    drawerScrim.classList.remove('is-open');
    setTimeout(()=>{
      drawer.hidden=true;
      drawerScrim.hidden=true;
      drawerReturnFocus?.focus?.();
    },180);
  };

  renderTable();
  renderChart();
  tableCard.dataset.miDensity=view.density;

  main.querySelector('[data-mi-search]').addEventListener('input',(event)=>{view.query=event.target.value;renderTable();});
  main.querySelector('[data-mi-density-select]').addEventListener('change',(event)=>{view.density=event.target.value;tableCard.dataset.miDensity=view.density;});
  main.querySelector('[data-mi-direction]').addEventListener('change',(event)=>{view.direction=event.target.value;renderTable();});
  main.querySelector('[data-mi-confidence]').addEventListener('change',(event)=>{view.confidence=event.target.value;renderTable();});
  main.querySelectorAll('[data-mi-universe]').forEach((button)=>button.addEventListener('click',()=>{
    view.universe=button.dataset.miUniverse;
    main.querySelectorAll('[data-mi-universe]').forEach((candidate)=>{
      const active=candidate===button;
      candidate.classList.toggle('is-active',active);
      candidate.setAttribute('aria-pressed',String(active));
    });
    renderTable();
  }));
  main.querySelectorAll('[data-mi-timeframe]').forEach((button)=>button.addEventListener('click',()=>{
    view.timeframe=button.dataset.miTimeframe;
    renderChart();
  }));
  main.querySelector('[data-mi-filter-toggle]').addEventListener('click',(event)=>{
    filterStrip.hidden=!filterStrip.hidden;
    event.currentTarget.setAttribute('aria-expanded',String(!filterStrip.hidden));
  });
  const toggleColumns=(trigger)=>{
    columnMenu.hidden=!columnMenu.hidden;
    main.querySelectorAll('[data-mi-columns-toggle],[data-mi-customize]').forEach((button)=>button.setAttribute('aria-expanded',String(!columnMenu.hidden)));
    if(!columnMenu.hidden)columnMenu.querySelector('input:not(:disabled)')?.focus();
    else trigger?.focus?.();
  };
  main.querySelector('[data-mi-columns-toggle]').addEventListener('click',(event)=>toggleColumns(event.currentTarget));
  main.querySelector('[data-mi-customize]').addEventListener('click',(event)=>toggleColumns(event.currentTarget));
  columnMenu.querySelectorAll('input').forEach((input)=>input.addEventListener('change',()=>{
    input.checked?view.visibleColumns.add(input.value):view.visibleColumns.delete(input.value);
    renderTable();
  }));
  main.querySelector('[data-mi-reset]').addEventListener('click',()=>{
    view.query='';view.direction='all';view.confidence='0';view.universe='all';
    main.querySelector('[data-mi-search]').value='';
    main.querySelector('[data-mi-direction]').value='all';
    main.querySelector('[data-mi-confidence]').value='0';
    main.querySelectorAll('[data-mi-universe]').forEach((button)=>{
      const active=button.dataset.miUniverse==='all';
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    renderTable();
  });
  main.querySelector('[data-mi-save-view]').addEventListener('click',()=>{
    if(!staticVisualPreview){toast('Saved views require the authenticated workspace backend.',{tone:'danger'});return;}
    const saved=persistView();
    toast(saved?'Saved to this browser · demo only':'Browser storage is unavailable; the demo view was not saved.',{tone:saved?'success':'danger'});
  });
  tableHost.addEventListener('click',(event)=>{
    const watch=event.target.closest('[data-mi-watch]');
    if(watch){
      if(!staticVisualPreview){navigate('watchlist');return;}
      const id=watch.dataset.miWatch;
      watchlist.has(id)?watchlist.delete(id):watchlist.add(id);
      storage.write(DEMO_WATCHLIST_KEY,[...watchlist]);
      watchCount.textContent=`${watchlist.size} watched`;
      renderTable();
      toast(`${watchlist.has(id)?'Added to':'Removed from'} browser demo watchlist · not persisted to Qelly`,{tone:'success'});
      return;
    }
    const asset=event.target.closest('[data-mi-open-asset]');
    if(asset)navigate('asset',asset.dataset.miOpenAsset);
  });
  main.querySelectorAll('.q-mi-mini-rows [data-mi-open-asset]').forEach((button)=>button.addEventListener('click',()=>navigate('asset',button.dataset.miOpenAsset)));
  main.querySelectorAll('[data-mi-explain]').forEach((button)=>button.addEventListener('click',()=>openDrawer(button)));
  drawer.querySelector('[data-mi-drawer-close]').addEventListener('click',closeDrawer);
  drawerScrim.addEventListener('click',closeDrawer);
  drawer.querySelector('[data-mi-open-provenance]').addEventListener('click',()=>{closeDrawer();navigate('decision-provenance');});
  const keydown=(event)=>{if(event.key==='Escape'&&!drawer.hidden){event.preventDefault();closeDrawer();}};
  window.addEventListener('keydown',keydown);
  window.__qellyLiveMarketCleanup=()=>window.removeEventListener('keydown',keydown);
}
