const STORAGE_KEY='qelly-premium-market-view-v2';
const WATCH_KEY='qelly-premium-watchlist-v2';
const MODES=['discovery','terminal','research'];
const TIMEFRAMES={
  '1H':42,'4H':64,'1D':78,'1W':96
};
const ICONS={
  search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  sliders:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6"/></svg>',
  columns:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M9 5v14M15 5v14"/></svg>',
  star:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>',
  explain:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H8l-4 4V5Z"/><path d="M9 9h6M9 12h4"/></svg>',
  chevron:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  activity:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg>',
  shield:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
  pulse:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h3l2-7 4 12 2-6h5"/></svg>',
  close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  download:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 20h16"/></svg>'
};
const icon=(name)=>`<span class="qv-icon">${ICONS[name]??''}</span>`;
const esc=(value,escapeHtml)=>escapeHtml(value??'');
const money=(value)=>value==null?'â€”':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:Math.abs(value)>=1e6?'compact':'standard',maximumFractionDigits:Math.abs(value)<1?4:2}).format(Number(value));
const compact=(value)=>value==null?'â€”':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(Number(value));
const pct=(value,digits=2)=>value==null?'â€”':`${Number(value)>0?'+':''}${Number(value).toFixed(digits)}%`;
const tone=(value)=>Number(value)>0?'positive':Number(value)<0?'negative':'neutral';
function storage(){return {read(key,fallback){try{return JSON.parse(localStorage.getItem(key)??'null')??fallback}catch{return fallback}},write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}};}
function deterministicOHLC(seed=64500,count=96){
  let price=seed;let volume=2400;const out=[];const start=Date.UTC(2026,6,20,0,0,0)/1000;
  for(let i=0;i<count;i++){
    const cycle=Math.sin(i*.41)*.0038+Math.sin(i*.13)*.0062;
    const impulse=((i*17)%11-5)*.0007;
    const drift=(i>58?.0014:.0002);
    const open=price;
    const close=open*(1+cycle+impulse+drift);
    const spread=Math.abs(Math.sin(i*.77))*.006+.0025;
    const high=Math.max(open,close)*(1+spread);
    const low=Math.min(open,close)*(1-spread*.82);
    volume=Math.max(900,volume*(.84+Math.abs(Math.sin(i*.33))*.34));
    out.push({time:start+i*3600,open,high,low,close,volume});price=close;
  }
  return out;
}
function normalizeRows(items,staticVisualPreview){
  const fallback=[
    ['BTC','Bitcoin',65291.65,1.30,1.75,16.16e9,1.31e12,31.8e9,.0067,54.2e6,94],
    ['ETH','Ethereum',1955.03,3.70,5.25,8.11e9,235.7e9,14.2e9,.0054,29.8e6,92],
    ['SOL','Solana',76.25,1.69,.04,1.19e9,44.46e9,4.9e9,.0108,13.1e6,88],
    ['XRP','XRP',1.10,.58,1.38,682.4e6,69.18e9,2.4e9,.0032,5.2e6,86],
    ['BNB','BNB',573.51,.51,1.49,821e6,76.34e9,3.2e9,.0041,7.8e6,90],
    ['DOGE','Dogecoin',.07281,.60,1.05,565.7e6,12.44e9,1.7e9,.0094,8.9e6,82],
    ['ADA','Cardano',.17,1.20,2.60,352e6,6.1e9,.73e9,.0028,2.9e6,79],
    ['LINK','Chainlink',8.77,3.88,4.57,234e6,6.56e9,.91e9,.0061,3.6e6,87],
    ['AVAX','Avalanche',6.70,2.14,3.02,198e6,2.9e9,.67e9,.0058,2.7e6,83],
    ['SUI','Sui',.72,4.18,6.12,288e6,2.6e9,.88e9,.0111,4.1e6,80],
    ['HYPE','Hyperliquid',60.34,3.27,.57,208e6,15.24e9,2.7e9,.0148,9.6e6,84],
    ['AAVE','Aave',100.49,2.32,3.74,145e6,1.52e9,.46e9,.0049,1.9e6,89]
  ];
  const sourceRows=(items?.length?items:fallback.map((r)=>({symbol:r[0],name:r[1],price:r[2],change24h:r[3],change7d:r[4],quoteVolume24h:r[5],marketCap:r[6],openInterest:r[7],fundingRate:r[8],liquidation24h:r[9],source:{providerName:'Qelly deterministic composite',confidence:r[10]/100,qualityState:'simulated'}})));
  return sourceRows.slice(0,40).map((item,index)=>{
    const f=fallback[index%fallback.length]; const source=item.source??{};
    const change24h=item.change24h??f[3], change7d=item.change7d??f[4];
    return {
      rank:index+1,id:item.canonicalId??item.id??item.symbol,symbol:item.symbol??f[0],name:item.name??f[1],price:item.price??f[2],
      change1h:Number(change24h)*.18,change24h,change7d,change30d:Number(change7d)*1.42,
      volume:item.quoteVolume24h??item.volume24h??f[5],marketCap:item.marketCap??f[6],fdv:(item.marketCap??f[6])*1.12,
      supply:(item.marketCap??f[6])/(item.price??f[2]),liquidity:(item.quoteVolume24h??f[5])*.34,
      funding:item.fundingRate??f[8],openInterest:item.openInterest??f[7],oiChange:Number(change24h)*.62,
      liquidation:item.liquidation24h??f[9],volatility:Math.abs(Number(change7d))*1.15+18,
      confidence:Math.round((source.confidence??f[10]/100)*100),source:source.providerName??source.provider??'Qelly composite',
      freshness:source.qualityState??source.freshness??(staticVisualPreview?'simulated':'unavailable'),
      spark:Array.from({length:18},(_,n)=>(item.price??f[2])*(1+Math.sin((n+index)*.43)*.018+n*.0012))
    };
  });
}
function spark(values){const w=96,h=28,min=Math.min(...values),max=Math.max(...values),span=max-min||1;const pts=values.map((v,i)=>`${(i/(values.length-1))*w},${h-((v-min)/span)*h}`).join(' ');return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>`;}
function candlestickChart(candles){
  const width=980,height=260,pad={l:48,r:72,t:16,b:38};const values=candles.flatMap(c=>[c.high,c.low]);const min=Math.min(...values),max=Math.max(...values),span=max-min||1;const plotW=width-pad.l-pad.r,plotH=height-pad.t-pad.b;const step=plotW/candles.length,body=Math.max(2,step*.55);
  const y=v=>pad.t+(max-v)/span*plotH; const x=i=>pad.l+i*step+step/2;
  const grid=Array.from({length:5},(_,i)=>{const yy=pad.t+i*plotH/4;const v=max-i*span/4;return `<g><line x1="${pad.l}" y1="${yy}" x2="${width-pad.r}" y2="${yy}"/><text x="${width-pad.r+10}" y="${yy+4}">${money(v)}</text></g>`}).join('');
  const marks=candles.map((c,i)=>{const up=c.close>=c.open;const yy=Math.min(y(c.open),y(c.close));const bh=Math.max(1.5,Math.abs(y(c.open)-y(c.close)));return `<g class="${up?'up':'down'}" data-candle="${i}"><line x1="${x(i)}" y1="${y(c.high)}" x2="${x(i)}" y2="${y(c.low)}"/><rect x="${x(i)-body/2}" y="${yy}" width="${body}" height="${bh}" rx="1"/><rect class="hit" x="${x(i)-step/2}" y="${pad.t}" width="${step}" height="${plotH}"/></g>`}).join('');
  const volumes=candles.map((c,i)=>{const maxV=Math.max(...candles.map(d=>d.volume));const vh=c.volume/maxV*34;return `<rect class="volume ${c.close>=c.open?'up':'down'}" x="${x(i)-body/2}" y="${height-pad.b-vh}" width="${body}" height="${vh}"/>`}).join('');
  return `<svg class="qv-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="qv-chart-title qv-chart-desc"><title id="qv-chart-title">Deterministic Bitcoin OHLC candlestick chart</title><desc id="qv-chart-desc">Realistic deterministic hourly open, high, low, close and volume observations for static review. Not live market data.</desc><g class="grid">${grid}</g><g class="volume-bars">${volumes}</g><g class="candles">${marks}</g><line class="crosshair x"/><line class="crosshair y"/></svg>`;
}
function tableColumns(){return [
 ['rank','#'],['watch',''],['asset','Asset'],['price','Price'],['change1h','1h'],['change24h','24h'],['change7d','7d'],['change30d','30d'],['spark','Trend'],['volume','Volume'],['marketCap','Market cap'],['fdv','FDV'],['liquidity','Liquidity'],['funding','Funding'],['openInterest','OI'],['oiChange','OI Î”'],['liquidation','Liquidation'],['volatility','Volatility'],['confidence','Confidence'],['source','Source'],['freshness','Freshness'],['explain','']
 ];}
function rowMarkup(row,watchlist,escapeHtml){
 const watched=watchlist.has(row.id);return `<tr data-row="${esc(row.id,escapeHtml)}" tabindex="0">
 <td class="rank">${row.rank}</td><td><button class="icon-button watch ${watched?'is-active':''}" data-watch="${esc(row.id,escapeHtml)}" aria-pressed="${watched}" aria-label="${watched?'Remove from':'Add to'} watchlist">${icon('star')}</button></td>
 <td class="asset sticky"><span class="asset-mark">${esc(row.symbol.slice(0,2),escapeHtml)}</span><span><strong>${esc(row.name,escapeHtml)}</strong><small>${esc(row.symbol,escapeHtml)}</small></span></td>
 <td class="number">${money(row.price)}</td><td class="number ${tone(row.change1h)}">${pct(row.change1h)}</td><td class="number ${tone(row.change24h)}">${pct(row.change24h)}</td><td class="number ${tone(row.change7d)}">${pct(row.change7d)}</td><td class="number ${tone(row.change30d)}">${pct(row.change30d)}</td>
 <td class="spark ${tone(row.change7d)}">${spark(row.spark)}</td><td class="number">$${compact(row.volume)}</td><td class="number">$${compact(row.marketCap)}</td><td class="number">$${compact(row.fdv)}</td><td class="number">$${compact(row.liquidity)}</td>
 <td class="number ${tone(row.funding)}">${pct(row.funding,4)}</td><td class="number">$${compact(row.openInterest)}</td><td class="number ${tone(row.oiChange)}">${pct(row.oiChange)}</td><td class="number negative">$${compact(row.liquidation)}</td><td class="number">${row.volatility.toFixed(1)}</td>
 <td><span class="confidence"><i style="--score:${row.confidence}%"></i>${row.confidence}</span></td><td><span class="source">${esc(row.source,escapeHtml)}</span></td><td><span class="freshness">${esc(row.freshness,escapeHtml)}</span></td>
 <td><button class="icon-button explain" data-explain="${esc(row.id,escapeHtml)}" aria-label="Explain ${esc(row.symbol,escapeHtml)} move">${icon('explain'i}</button></td></tr>`;
}
function mobileRow(row,watchlist,escapeHtml){return `<article class="qv-mobile-row" data-mobile-row="${esc(row.id,escapeHtml)}"><button class="mobile-main" data-expand="${esc(row.id,escapeHtml)}"><span class="asset-mark">${esc(row.symbol.slice(0,2),escapeHtml)}</span><span class="mobile-identity"><strong>${esc(row.name,escapeHtml)}</strong><small>#${row.rank} Â· ${esc(row.symbol,escapeHtml)}</small></span><span class="mobile-price"><strong>${money(row.price)}</strong><small class="${tone(row.change24h)}">${pct(row.change24h)}</small></span>${icon('chevron')}</button><div class="mobile-detail"><div><span>Volume</span><strong>$${compact(row.volume)}</strong></div><div><span>Market cap</span><strong>$${compact(row.marketCap)}</strong></div><div><span>Open interest</span><strong>$${compact(row.openInterest)}</strong></div><div><span>Funding</span><strong class="${tone(row.funding)}">${pct(row.funding,4)}</strong></div><div class="mobile-actions"><button data-watch="${esc(row.id,escapeHtml)}">${icon('star')} ${watchlist.has(row.id)?'Watching':'Watch'}</button><button data-explain="${esc(row.id,escapeHtml)}">${icon('explain')} Explain move</button></div></div></article>`;}
function renderDrawer(row,escapeHtml){return `<div class="qv-drawer-backdrop" data-close-drawer></div><aside class="qv-drawer is-open" data-mi-drawer aria-label="Explain This Move"><header><div><small>Decision intelligence</small><h2>Explain ${esc(row.symbol,escapeHtml)} move</h2></div><button class="icon-button" data-mi-drawer-close aria-label="Close explanation">${icon('close')}</button></header><div class="drawer-score"><span>Confidence</span><strong>${row.confidence}%</strong><i style="--score:${row.confidence}%"></i></div><section><h3>Evidence synthesis</h3><p>${esc(row.name,escapeHtml)} advanced ${pct(row.change24h)} over 24 hours while open interest changed ${pct(row.oiChange)}. The deterministic review model attributes the move to improving breadth, positive spot impulse and moderate leverage expansion.</p></section><div class="evidence-grid"><article><span>Supporting</span><strong>Spot volume acceleration</strong><small>$${compact(row.volume)} observed</small></article><article><span>Contradicting</span><strong>Funding is elevated</strong><small>${pct(row.funding,4)} composite</small></article><article><span>Source quality</span><strong>${row.confidence}% confidence</strong><small>${esc(row.source,escapeHtml)}</small></article><article><span>Limitation</span><strong>Static review data</strong><small>No live provider connection</small></article></div><footer><button class="secondary">${icon('download')} Export evidence</button><button class="primary">Open provenance graph</button></footer></aside>`;}
export async function renderAssetRankings(main,{api,escapeHtml,navigate,toast,staticVisualPreview}){
 const [data,candleResponse]=await Promise.all([api('/api/v1/public/markets/assets?sort=change&direction=desc').catch(()=>({items:[]})),api('/api/v1/public/markets/assets/QI-CRYPTO-BTC/candles?interval=1h&limit=168').catch(()=>({points:[]}),]);
 const rows=normalizeRows(data.items??[],staticVisualPreview);const candles=deterministicOHLC(Number(rows[0]?.price??64500),96);const store=storage();const watchlist=new Set(store.read(WATCH_KEY,[]));const saved=store.read(STORAGE_KEY,{});
 const state={mode:MODES.includes(saved.mode)?saved.mode:'discovery',query:'',direction:'all',sort:'rank',descending:false,density:saved.density??'compact',timeframe:'1D',columnsOpen:false,filtersOpen:false};
 main.innerHTML=`<section class="qv-page" data-mode="${state.mode}"><div class="qv-status-center"><span class="status-dot"></span><strong>Static visual preview</strong><span>Deterministic review data Â· backend unavailable</span><button data-status-details>Details</button></div>
 <header class="qv-page-head"><div><p>Markets / Global intelligence</p><h1>Asset rankings</h1><span>Discovery breadth, derivatives pressure and evidence quality in one institutional surface.</span></div><div class="qv-layout-modes" role="group" aria-label="Layout mode">${MODES.map(m=>`<button data-mode="${m}" class="${m===state.mode?'is-active':''}">${m[0].toUpperCase()+m.slice(1)}</button>`).join('')}</div></header>
 <section class="qv-pulse" aria-label="Market pulse"><article class="primary"><span>Global market cap</span><strong>$2.23T</strong><small class="positive">+1.37% today</small></article><article class="primary"><span>24h market volume</span><strong>$46.35B</strong><small class="positive">+20.58% velocity</small></article><div class="secondary"><span>Open interest</span><strong>$114.8B</strong><small class="positive">+0.8%</small></div><div class="secondary"><span>Liquidations</span><strong>$182.4M</strong><small class="negative">64% long</small></div><div class="secondary"><span>BTC dominance</span><strong>58.65%</strong><small>âˆLŒ‰OÜÛX[Ù]]ˆÛ\ÜÏHœÙXÛÛ™\HÜ[‘[™[™È™YÚ[YOÜÜ[İ›Û™Ï“™]]˜[
ÏÜİ›Û™ÏÛX[ŒŒÉOÜÛX[Ù]]ˆÛ\ÜÏH˜œ™XYÜ[“X\šÙ]œ™XYÜÜ[]Hİ[OHÚYŒ‰HÚOÙ]İ›Û™ÏŒˆÈÎÜİ›Û™ÏÙ]]ˆÛ\ÜÏHœ™YÚ[YH‰ÚXÛÛŠ	ØXİ]š]IÊ_OÜ[ÛX[”™YÚ[YOÜÛX[İ›Û™ÏÛÛœİXİ]™Hš\ÚË[ÛÜİ›Û™ÏÜÜ[Ù]]ˆÛ\ÜÏHœ™\Üİ\™H‰ÚXÛÛŠ	Ü[ÙIÊ_OÜ[ÛX[‘\š]˜]]™\È™\Üİ\™OÜÛX[İ›Û™Ï“[Ù\˜]H]™\˜YÙH^[œÚ[ÛÜİ›Û™ÏÜÜ[Ù]ÜÙXİ[Û‚ˆÙXİ[ÛˆÛ\ÜÏHœ]‹]ÛÜšÜÜXÙH]ˆÛ\ÜÏHœ]‹XÚ\\[™[XY\]ÛX[•ÈÈTÑÛÛ\ÜÚ]OÜÛX[İ›Û™Ï‰Û[Û™^JØ[™\Ë˜]
LJK˜ÛÜÙJ_OÜİ›Û™ÏÜ[ˆÛ\ÜÏHœÜÚ]]™HŠÌ‹ŒN	OÜÜ[Ù]]ˆÛ\ÜÏH˜Ú\]ÛÛÈ]‰ÓØš™XİšÙ^\ÊSQQ”SQTÊK›X\
O˜]Ûˆ]K][YYœ˜[YOH‰İHˆÛ\ÜÏH‰İOO\İ]K[YYœ˜[YOÉÚ\ËXXİ]™IÎ‰ÉßH‰İOØ]Û˜
Kš›Ú[Š	ÉÊ_OÙ]]Ûˆ]KXÚ\]\OØ[™\ÏØ]Û]Ûˆ]KXÚ\\ØØ[O“[™X\Ø]ÛÙ]ÚXY\]ˆÛ\ÜÏHœ]‹XÚ\]Ü˜\‰ØØ[™\İXÚĞÚ\
Ø[™\ËœÛXÙJUSQQ”SQTÖÜİ]K[YYœ˜[YWJJ_O]ˆÛ\ÜÏHœ]‹XÚ\]ÛÛ\ˆY[Ù]Ù]›Ûİ\Ü[“ÒÈ
È›Û[YOÜÜ[Ü[”Ûİ\˜ÙNˆY[H]\›Z[š\İXÈÛÛ\ÜÚ]OÜÜ[Ü[ÛÛ™šY[˜ÙHM	OÜÜ[]Ûˆ]K[ZKY^Z[‰ÚXÛÛŠ	Ù^Z[‰Ê_H^Z[ˆ\È[İ™OØ]ÛÙ›Ûİ\Ù]‚ˆ\ÚYHÛ\ÜÏHœ]‹Z[[YÙ[˜ÙHXY\Ü[’[[YÙ[˜ÙH]Y]YOÜÜ[]Û•šY]È[Ø]ÛÚXY\\XÛOHÛ\ÜÏHœÜÚ]]™HÚO]İ›Û™Ï“ÒH]™\™Ù[˜ÙOÜİ›Û™ÏÜ[”ÓÓÒH\Èš\Ú[™È˜\İ\ˆ[ˆÜİ›Û[YKÜÜ[Ù]LØØ\XÛO\XÛOHÛ\ÜÏHØ\›š[™ÈÚO]İ›Û™Ï‘[™[™È^™[YOÜİ›Û™ÏÜ[’TH[™[™È[\™YHL\˜Ù[[KÜÜ[Ù]ÏØØ\XÛO\XÛOHÛ\ÜÏH›™YØ]]™HÚO]İ›Û™Ï“\]ZY][Ûˆ™\Üİ\™OÜİ›Û™ÏÜ[•ÈİÛœÚYHÛ\İ\ˆ™X\ˆ	ŒËLÜÜ[Ù]ØØ\XÛO\XÛOHÛ\ÜÏH™]šY[˜ÙHÚO]İ›Û™Ï”›İšY\ˆ\ØYÜ™Y[Y[Üİ›Û™ÏÜ[‘U›Û[YH˜\šX[˜ÙHÚY[™YXÜ›ÜÜÈ™[Y\ËÜÜ[Ù]ÍØØ\XÛOØ\ÚYOÜÙXİ[Û‚ˆÙXİ[ÛˆÛ\ÜÏHœ]‹]X›K\İ\™˜XÙHXY\ˆÛ\ÜÏHœ]‹]X›K]ÛÛ˜\ˆ]‘ÛØ˜[\ÜÙ][š]™\œÙOÚÜ[‰Ü›İÜË›[™İH˜[šÙY\ÜÙ]È0­ÈŒˆ[˜[]XØ[ÛÛ[[œÏÜÜ[Ù]]ˆÛ\ÜÏHÛÛ˜\‹XXİ[ÛœÈX™[Û\ÜÏHœÙX\˜Ú‰ÚXÛÛŠ	ÜÙX\˜Ú	Ê_O[œ]]K[ZK\ÙX\˜ÚXÙZÛ\H”ÙX\˜Ú\ÜÙ]Èˆ\šXK[X™[H”ÙX\˜Ú\ÜÙ]ÈÛX™[]Ûˆ]K[ZKYš[\œÏ‰ÚXÛÛŠ	ÜÛY\œÉÊ_Hš[\œÏØ]Û]Ûˆ]K[ZKXÛÛ[[œË]ÙÙÛO‰ÚXÛÛŠ	ØÛÛ[[œÉÊ_HÛÛ[[œÏØ]ÛÙ[Xİ]K[ZKY[œÚ]K\Ù[Xİ\šXK[X™[H•X›H[œÚ]HÜ[Ûˆ˜[YOH˜ÛÛ\XİÛÛ\XİÛÜ[ÛÜ[Ûˆ˜[YOHœİ[™\™”İ[™\™ÛÜ[ÛÜÙ[Xİ]Ûˆ]KY^Ü‰ÚXÛÛŠ	ÙİÛ›ØY	Ê_H^ÜØ]ÛÙ]ÚXY\]ˆÛ\ÜÏHœ]‹\]Y\K\İš\]ÛˆÛ\ÜÏHš\ËXXİ]™Hˆ]KY\™Xİ[ÛH˜[[\ÜÙ]ÏØ]Û]Ûˆ]KY\™Xİ[ÛHœÜÚ]]™HY˜[˜Ù\œÏØ]Û]Ûˆ]KY\™Xİ[ÛH›™YØ]]™H‘XÛ[™\œÏØ]Û]Û’YÚÒOØ]Û]Û‘[™[™È^™[Y\ÏØ]Û]Û”›İšY\ˆ\ØYÜ™Y[Y[Ø]ÛÜ[”Ø]™YšY]ÎˆÛØ˜[[[YÙ[˜ÙOÜÜ[Ù]‚ˆ]ˆÛ\ÜÏHœ]‹]X›K\ØÜ›ÛˆXš[™^HŒX›OXY‰İX›PÛÛ[[œÊ
K›X\

ÚÙ^KX™[JOO˜]KXÛÛ[[H‰ÚÙ^_Hˆ]K\ÛÜH‰ÚÙ^_H‰ÛX™[Oİ˜
Kš›Ú[Š	ÉÊ_OİİXY›ÙHYHœ]‹]X›KX›ÙHİ›ÙOİX›OÙ]]ˆÛ\ÜÏHœ]‹[[Øš[K[\İˆYHœ]‹[[Øš[K[\İÙ]ÜÙXİ[Û‚ˆ]ˆÛ\ÜÏHœ]‹\ÚY]ˆ]KYš[\‹\ÚY]\šXKZY[HYH]ˆÛ\ÜÏHœÚY]X˜XÚÙ›Üˆ]KXÛÜÙK\ÚY]Ù]ÙXİ[ÛXY\“X\šÙ]š[\œÏÚ]ÛˆÛ\ÜÏHšXÛÛ‹X]Ûˆˆ]KXÛÜÙK\ÚY]‰ÚXÛÛŠ	ØÛÜÙIÊ_OØ]ÛÚXY\X™[‘\™Xİ[ÛÙ[Xİ]KYš[\‹Y\™Xİ[ÛÜ[Ûˆ˜[YOH˜[[\ÜÙ]ÏÛÜ[ÛÜ[Ûˆ˜[YOHœÜÚ]]™HY˜[˜Ù\œÏÛÜ[ÛÜ[Ûˆ˜[YOH›™YØ]]™H‘XÛ[™\œÏÛÜ[ÛÜÙ[XİÛX™[X™[“Z[š[][HÛÛ™šY[˜ÙO[œ]\OHœ˜[™ÙHˆZ[HŒˆX^HMHˆ˜[YOHŒˆ]KYš[\‹XÛÛ™šY[˜ÙOÛX™[X™[•[š]™\œÙOÙ[XİÜ[Û[\ÜÙ]ÏÛÜ[ÛÜ[Û‘\š]˜]]™\È[˜X›YÛÜ[ÛÜ[Û’YÚ\]ZY]OÛÜ[ÛÜÙ[XİÛX™[›Ûİ\]Ûˆ]K\™\Ù]Yš[\œÏ”™\Ù]Ø]Û]ÛˆÛ\ÜÏHœš[X\Hˆ]KX\KYš[\œÏ\Hš[\œÏØ]ÛÙ›Ûİ\ÜÙXİ[ÛÙ]‚ˆ]ˆÛ\ÜÏHœ]‹XÛÛ[[‹[Y[Hˆ]K[ZKXÛÛ[[‹[Y[HY[XY\İ›Û™Ï•š\ÚX›HÛÛ[[œÏÜİ›Û™Ï]ÛˆÛ\ÜÏHšXÛÛ‹X]Ûˆˆ]KXÛÜÙKXÛÛ[[œÏ‰ÚXÛÛŠ	ØÛÜÙIÊ_OØ]ÛÚXY\‰İX›PÛÛ[[œÊ
K™š[\ŠÏOˆVÉÜ˜[šÉË	İØ]Ú	Ë	Ø\ÜÙ]	Ë	Ù^Z[‰×Kš[˜ÛY\ÊÖÌJJK›X\
ÏO˜X™[[œ]\OH˜ÚXÚØ›ŞˆÚXÚÙY]KXÛÛ[[‹]ÙÙÛOH‰ØÖÌ_H‰ØÖÌW_OÛX™[˜
Kš›Ú[Š	ÉÊ_OÙ]]ˆ]KY˜]Ù\‹ZÜİÙ]ÜÙXİ[Û˜ÂˆÛÛœİ›Ûİ[XZ[‹œ]Y\TÙ[XİÜŠ	Ëœ]‹\YÙIÊNØÛÛœİ›ÙO[XZ[‹œ]Y\TÙ[XİÜŠ	ÈÜ]‹]X›KX›ÙIÊNØÛÛœİ[Øš[O[XZ[‹œ]Y\TÙ[XİÜŠ	ÈÜ]‹[[Øš[K[\İ	ÊNÂˆ[˜İ[Ûˆš\ÚX›T›İÜÊ
^Û]\İ\›İÜË™š[\ŠOˆ\İ]Kœ]Y\_	Ü‹›˜[Y_H	Ü‹œŞ[X›ÛXÓİÙ\Ø\ÙJ
Kš[˜ÛY\Êİ]Kœ]Y\JJNÚYŠİ]K™\™Xİ[ÛOOIÜÜÚ]]™IÊ[\İ[\İ™š[\ŠOœ‹˜Ú[™ÙLŒ
NÚYŠİ]K™\™Xİ[ÛOOIÛ™YØ]]™IÊ[\İ[\İ™š[\ŠOœ‹˜Ú[™ÙL
NÜ™]\›ˆË‹‹›\İKœÛÜ

KŠOOØÛÛœİ]XVÜİ]KœÛÜOÏÌX–Üİ]KœÛÜOÏÌÜ™]\›ˆ
\[Ùˆ]OOIÜİš[™ÉÏÔİš[™Ê]ŠK›ØØ[PÛÛ\\™Jİš[™ÊŠJN“[X™\Š]ŠKS[X™\ŠŠJJŠİ]K™\ØÙ[™[™ÏËLNŒJ_JNßBˆ[˜İ[Ûˆ˜]Ê
^ØÛÛœİ\İ]š\ÚX›T›İÜÊ
Nİ›ÙKš[›™\’S[\İ›X\
Oœ›İÓX\šİ\
‹Ø]Ú\İ\ØØ\R[
JKš›Ú[Š	ÉÊNÛ[Øš[Kš[›™\’S[\İ›X\
O›[Øš[T›İÊ‹Ø]Ú\İ\ØØ\R[
JKš›Ú[Š	ÉÊNØš[™[˜[ZXÊ
NßBˆ[˜İ[Ûˆ\œÚ\İ

^ÜİÜ™KÜš]JÕÔQÑWÒÑVKÛ[ÙNœİ]K›[ÙK[œÚ]Nœİ]K™[œÚ]_JNÜİÜ™KÜš]JĞUÒÒÑVKË‹‹Ø]Ú\İJNßBˆ[˜İ[Ûˆš[™[˜[ZXÊ
^ÛXZ[‹œ]Y\TÙ[XİÜ[
	ÖÙ]K]Ø]ÚIÊK™›Ü‘XXÚ
O˜‹›Û˜ÛXÚÏJ
OOØÛÛœİYX‹™]\Ù]Ø]ÚİØ]Ú\İš\ÊY
OİØ]Ú\İ™[]JY
NØ]Ú\İ˜Y
Y
NÜ\œÚ\İ

NÙ˜]Ê
NİØ\İ
Ø]Ú\İš\ÊY
OÉĞYYÈØØ[™]šY]ÈØ]Ú\İ	Î‰Ô™[[İ™Yœ›ÛHØØ[™]šY]ÈØ]Ú\İ	ËİÛ™N‰ÜİXØÙ\ÜÉßJNßJNÛXZ[‹œ]Y\TÙ[XİÜ[
	ÖÙ]KY^Z[—IÊK™›Ü‘XXÚ
O˜‹›Û˜ÛXÚÏJ
OO›Ü[‘^Z[Š›İÜË™š[™
Oœ‹šYOOX‹™]\Ù]™^Z[ŠOÏÜ›İÜÖÌJJNÛXZ[‹œ]Y\TÙ[XİÜ[
	ÖÙ]KY^[™IÊK™›Ü‘XXÚ
O˜‹›Û˜ÛXÚÏJ
OO˜‹˜ÛÜÙ\İ
	Ëœ]‹[[Øš[K\›İÉÊK˜Û\ÜÓ\İÙÙÛJ	Ú\Ë[Ü[‰ÊJNßBˆ[˜İ[ÛˆÜ[‘^Z[Š›İÊ^ÛXZ[‹œ]Y\TÙ[XİÜŠ	ÖÙ]KY˜]Ù\‹ZÜİIÊKš[›™\’S\™[™\‘˜]Ù\Š›İË\ØØ\R[
NÛXZ[‹œ]Y\TÙ[XİÜŠ	ÖÙ]K[ZKY˜]Ù\‹XÛÜÙWIÊK›Û˜ÛXÚÏXÛÜÙQ^Z[ÛXZ[‹œ]Y\TÙ[XİÜŠ	ÖÙ]KXÛÜÙKY˜]Ù\—IÊK›Û˜ÛXÚÏXÛÜÙQ^Z[ßBˆ[˜İ[ÛˆÛÜÙQ^Z[Š
^ÛXZ[‹œ]Y\TÙ[XİÜŠ	ÖÙ]KY˜]Ù\‹ZÜİIÊKš[›™\’SIÉÎßBˆXZ[‹œ]Y\TÙ[XİÜ[
	ÖÙ]K[[ÙWIÊK™›Ü‘XXÚ
O˜‹›Û˜ÛXÚÏJ
OOÜİ]K›[ÙOX‹™]\Ù]›[ÙNÜ›Ûİ™]\Ù]›[ÙO\İ]K›[ÙNÛXZ[‹œ]Y\TÙ[XİÜ[
	ÖÙ]K[[ÙWIÊK™›Ü‘XXÚ
O˜‹˜Û\ÜÓ\İÙÙÛJ	Ú\ËXXİ]™IËOOXŠJNÜ\œÚ\İ

NßJNÂˆXZ[‹œ]Y\TÙ[XİÜŠ	ÖÙ]K[ZK\ÙX\˜ÚIÊK›Ûš[œ]YOOÜİ]Kœ]Y\OYK\™Ù]˜[YKš[J
KÓİÙ\Ø\ÙJ
NÙ˜]Ê
NßNÂˆXZ[‹œ]Y\TÙ[XİÜ[
	ÖÙ]KY\™Xİ[Û—IÊK™›Ü‘XXÚ
O˜‹›Û˜ÛXÚÏJ
OOÜİ]K™\™Xİ[ÛX‹™]\Ù]™\™Xİ[ÛÛXZ[‹œ]Y\TÙ[XİÜ[
	ÖÙ]KY\™Xİ[Û—IÊK™›Ü‘XXÚ
O˜‹˜Û\ÜÓ\İÙÙÛJ	Ú\ËXXİ]™IËOOXŠJNÙ˜]Ê
NßJNÂˆXZ[‹œ]Y\TÙ[XİÜ[
	ÖÙ]K\ÛÜIÊK™›Ü‘XXÚ
O›Û˜ÛXÚÏJ
OOÜİ]K™\ØÙ[™[™Ï\İ]KœÛÜOO]™]\Ù]œÛÜÈ\İ]K™\ØÙ[™[™Î™˜[ÙNÜİ]KœÛÜ]™]\Ù]œÛÜÙ˜]Ê
NßJNÂˆXZ[‹œ]Y\TÙ[XİÜŠ	ÖÙ]K[ZKY[œÚ]K\Ù[XİIÊK˜[YO\İ]K™[œÚ]NÛXZ[‹œ]Y\TÙ[XİÜŠ	ÖÙ]K[ZKY[œÚ]K\Ù[XİIÊK›Û˜Ú[™ÙOYOOÜİ]K™[œÚ]OYK\™Ù]˜[YNÜ›Ûİ™]\Ù]™[œÚ]O\İ]K™[œÚ]NÜ\œÚ\İ

NßNÂˆÛÛœİY[O[XZ[‹œ]Y\TÙ[XİÜŠ	ÖÙ]K[ZKXÛÛ[[‹[Y[WIÊNÛXZ[‹œ]Y\TÙ[XİÜŠ	ÖÙ]K[ZKXÛÛ[[œË]ÙÙÛWIÊK›Û˜ÛXÚÏJ
OOÛY[KšY[H[Y[KšY[ßNÛXZ[‹œ]Y\TÙ[XİÜŠ	ÖÙ]KXÛÜÙKXÛÛ[[œ×IÊK›Û˜ÛXÚÏJ
OO›Y[KšY[]YNÛXZ[‹œ]Y\TÙ[XİÜ[
	ÖÙ]KXÛÛ[[‹]ÙÙÛWIÊK™›Ü‘XXÚ
[œ]Oš[œ]›Û˜Ú[™ÙOJ
OOœ›Ûİ˜Û\ÜÓ\İÙÙÛJYKIÚ[œ]™]\Ù]˜ÛÛ[[•ÙÙÛ_XZ[œ]˜ÚXÚÙY
JNÂˆÛÛœİÚY][XZ[‹œ]Y\TÙ[XİÜŠ	ÖÙ]KYš[\‹\ÚY]IÊNØÛÛœİÜ[”ÚY]J
OOÜÚY]˜Û\ÜÓ\İ˜Y
	Ú\Ë[Ü[‰ÊNÜÚY]œÙ]]šX]J	Ø\šXKZY[‰Ë	Ù˜[ÙIÊNßNØÛÛœİÛÜÙTÚY]J
OOÜÚY]˜Û\ÜÓ\İœ™[[İ™J	Ú\Ë[Ü[‰ÊNÜÚY]œÙ]]šX]J	Ø\šXKZY[‰Ë	İYIÊNßNÛXZ[‹œ]Y\TÙ[XİÜŠ	ÖÙ]K[ZKYš[\œ×IÊK›Û˜ÛXÚÏ[Ü[”ÚY]ÛXZ[‹œ]Y\TÙ[XİÜ[
	ÖÙ]KXÛÜÙK\ÚY]IÊK™›Ü‘XXÚ
O›Û˜ÛXÚÏXÛÜÙTÚY]
NÛXZ[‹œ]Y\TÙ[XİÜŠ	ÖÙ]KX\KYš[\œ×IÊK›Û˜ÛXÚÏJ
OOÜİ]K™\™Xİ[Û[XZ[‹œ]Y\TÙ[XİÜŠ	ÖÙ]KYš[\‹Y\™Xİ[Û—IÊK˜[YNØÛÜÙTÚY]

NÙ˜]Ê
NßNÛXZ[‹œ]Y\TÙ[XİÜŠ	ÖÙ]K\™\Ù]Yš[\œ×IÊK›Û˜ÛXÚÏJ
OOÜİ]K™\™Xİ[ÛIØ[	ÎÛXZ[‹œ]Y\TÙ[XİÜŠ	ÖÙ]KYš[\‹Y\™Xİ[Û—IÊK˜[YOIØ[	ÎßNÂˆXZ[‹œ]Y\TÙ[XİÜ[
	ÖÙ]K][YYœ˜[YWIÊK™›Ü‘XXÚ
O˜‹›Û˜ÛXÚÏJ
OOÜİ]K[YYœ˜[YOX‹™]\Ù][YYœ˜[YNÛXZ[‹œ]Y\TÙ[XİÜ[
	ÖÙ]K][YYœ˜[YWIÊK™›Ü‘XXÚ
O˜‹˜Û\ÜÓ\İÙÙÛJ	Ú\ËXXİ]™IËOOXŠJNÛXZ[‹œ]Y\TÙ[XİÜŠ	Ëœ]‹XÚ\]Ü˜\	ÊKš[›™\’SXØ[™\İXÚĞÚ\
Ø[™\ËœÛXÙJUSQQ”SQTÖÜİ]K[YYœ˜[YWJJJÉÏ]ˆÛ\ÜÏHœ]‹XÚ\]ÛÛ\ˆY[Ù]‰ÎØš[™Ú\

NßJNÂˆ[˜İ[Ûˆš[™Ú\

^ØÛÛœİİ™Ï[XZ[‹œ]Y\TÙ[XİÜŠ	Ëœ]‹XÚ\\İ™ÉÊNØÛÛœİÛÛ\[XZ[‹œ]Y\TÙ[XİÜŠ	Ëœ]‹XÚ\]ÛÛ\	ÊNÜİ™ÏËœ]Y\TÙ[XİÜ[
	ÖÙ]KXØ[™WIÊK™›Ü‘XXÚ
ÏOÙËœ]Y\TÙ[XİÜŠ	Ëš]	ÊK˜Y]™[\İ[™\Š	ÜÚ[\™[\‰Ë

OOØÛÛœİÏXØ[™\ËœÛXÙJUSQQ”SQTÖÜİ]K[YYœ˜[YWJVÓ[X™\ŠË™]\Ù]˜Ø[™JWNİÛÛ\šY[Y˜[ÙNİÛÛ\š[›™\’SXİ›Û™Ï‰Û™]È]JË[YJŒL
KÓØØ[Tİš[™Ê	Ù[‹UTÉËÛ[Û‰ÜÚÜ	Ë^N‰Ì‹YYÚ]	Ëİ\‰Ì‹YYÚ]	ßJ_OÜİ›Û™ÏÜ[“È	Û[Û™^JË›Ü[Š_H0­È	Û[Û™^JËšYÚ
_OÜÜ[Ü[“	Û[Û™^JË›İÊ_H0­ÈÈ	Û[Û™^JË˜ÛÜÙJ_OÜÜ[ÛX[•›Û[YH	ØÛÛ\Xİ
Ë›Û[YJ_OÜÛX[˜ßJNÙËœ]Y\TÙ[XİÜŠ	Ëš]	ÊK˜Y]™[\İ[™\Š	ÜÚ[\›X]™IË

OOÛÛ\šY[]YJNßJNßBˆXZ[‹œ]Y\TÙ[XİÜŠ	ÖÙ]K[ZKY^Z[—IÊK›Û˜ÛXÚÏJ
OO›Ü[‘^Z[Š›İÜÖÌJNÛXZ[‹œ]Y\TÙ[XİÜŠ	ÖÙ]KY^ÜIÊK›Û˜ÛXÚÏJ
OOØ\İ
	Ôİ]XÈ™]šY]È^Ü™\\™YØØ[IËİÛ™N‰ÜİXØÙ\ÜÉßJNØš[™Ú\

NÙ˜]Ê
NÂŸB