import { icon } from '../icon-registry.mjs';
import { COLUMN_DEFINITIONS,compactNumber,money,percent,tone } from './asset-rankings-data.mjs';

const safe=(value,escapeHtml)=>escapeHtml(value??'');
const numericColumns=new Set(['price','change1h','change24h','change7d','change30d','volume','marketCap','fdv','supply','liquidity','funding','openInterest','oiChange','liquidation','volatility','confidence']);

function sparkline(values){
  const width=96,height=28;
  const minimum=Math.min(...values),maximum=Math.max(...values),span=Math.max(.000001,maximum-minimum);
  const points=values.map((value,index)=>`${index/(values.length-1)*width},${height-(value-minimum)/span*height}`).join(' ');
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}"/></svg>`;
}

function cell(column,row,{watchlist,escapeHtml}){
  switch(column){
    case 'rank':return `<td class="q-mi-rank">${row.rank}</td>`;
    case 'watchlist':{
      const watched=watchlist.has(row.id);
      return `<td><button type="button" class="q-mi-icon-button" data-mi-watch="${safe(row.id,escapeHtml)}" aria-label="${watched?'Remove from':'Add to'} watchlist" aria-pressed="${watched}">${icon(watched?'starFilled':'star')}</button></td>`;
    }
    case 'asset':return `<td class="q-mi-asset" data-column="asset"><span class="q-mi-asset-mark">${safe(row.symbol.slice(0,2),escapeHtml)}</span><span><strong>${safe(row.name,escapeHtml)}</strong><small>${safe(row.symbol,escapeHtml)} · #${row.rank}</small></span></td>`;
    case 'price':return `<td class="q-mi-number">${money(row.price)}</td>`;
    case 'change1h':case 'change24h':case 'change7d':case 'change30d':return `<td class="q-mi-number ${tone(row[column])}">${percent(row[column])}</td>`;
    case 'sparkline':return `<td class="q-mi-spark ${tone(row.change7d)}">${sparkline(row.sparkline)}</td>`;
    case 'volume':case 'marketCap':case 'fdv':case 'liquidity':case 'openInterest':case 'liquidation':return `<td class="q-mi-number">$${compactNumber(row[column])}</td>`;
    case 'supply':return `<td class="q-mi-number">${compactNumber(row.supply)} ${safe(row.symbol,escapeHtml)}</td>`;
    case 'funding':return `<td class="q-mi-number ${tone(row.funding)}">${percent(row.funding,4)}</td>`;
    case 'oiChange':return `<td class="q-mi-number ${tone(row.oiChange)}">${percent(row.oiChange)}</td>`;
    case 'volatility':return `<td class="q-mi-number">${Number(row.volatility).toFixed(1)}</td>`;
    case 'confidence':return `<td><span class="q-mi-confidence"><i style="--q-mi-confidence:${row.confidence}%"></i><b>${row.confidence}</b></span></td>`;
    case 'source':return `<td><span class="q-mi-source">${safe(row.source,escapeHtml)}</span></td>`;
    case 'freshness':return `<td><span class="q-mi-freshness">${safe(row.freshness,escapeHtml)}</span></td>`;
    case 'explain':return `<td><button type="button" class="q-mi-icon-button" data-mi-explain="${safe(row.id,escapeHtml)}" aria-label="Explain ${safe(row.symbol,escapeHtml)} move">${icon('explain')}</button></td>`;
    default:return '<td>—</td>';
  }
}

export function tableMarkup(rows,view,{watchlist,escapeHtml}={}){
  const visibleColumns=COLUMN_DEFINITIONS.filter(([key])=>view.columns.has(key));
  return `<section class="q-mi-table-card" data-mi-density="${view.density}">
    <header class="q-mi-table-toolbar">
      <div><p>Primary market surface</p><h2>Asset rankings</h2><span><b data-mi-result-count>${rows.length}</b> instruments · deterministic review universe</span></div>
      <div class="q-mi-table-actions">
        <label class="q-mi-search">${icon('search')}<span class="sr-only">Search assets</span><input data-mi-search type="search" placeholder="Search asset or symbol" value="${safe(view.query,escapeHtml)}"></label>
        <button type="button" data-mi-filter-toggle aria-expanded="false">${icon('filter')} Filters</button>
        <button type="button" data-mi-columns-toggle aria-expanded="false">${icon('columns')} Columns</button>
        <select data-mi-density-select aria-label="Table density"><option value="comfortable" ${view.density==='comfortable'?'selected':''}>Comfortable</option><option value="compact" ${view.density==='compact'?'selected':''}>Compact</option><option value="terminal" ${view.density==='terminal'?'selected':''}>Terminal</option></select>
        <button type="button" data-mi-export>${icon('download')} Export</button>
      </div>
    </header>
    <div class="q-mi-saved-views" aria-label="Ranking views">
      ${[['all','All assets'],['momentum','Momentum leaders'],['derivatives','Derivatives pressure'],['quality','High confidence'],['watchlist','Watchlist']].map(([key,label])=>`<button type="button" data-mi-view="${key}" class="${view.savedView===key?'is-active':''}" aria-pressed="${view.savedView===key}">${label}</button>`).join('')}
      <span>Multi-sort: Shift + column</span>
    </div>
    <div class="q-mi-column-menu" data-mi-column-menu hidden>
      <header><strong>Visible columns</strong><button type="button" data-mi-column-close aria-label="Close column manager">${icon('close')}</button></header>
      ${COLUMN_DEFINITIONS.map(([key,label])=>`<label><input type="checkbox" data-mi-column="${key}" ${view.columns.has(key)?'checked':''}><span>${label}</span></label>`).join('')}
    </div>
    <div class="q-mi-filter-sheet" data-mi-filter-sheet aria-hidden="true">
      <button class="q-mi-sheet-backdrop" type="button" data-mi-filter-backdrop aria-label="Close filters"></button>
      <section role="dialog" aria-modal="true" aria-labelledby="q-mi-filter-title">
        <header><div><p>Query builder</p><h2 id="q-mi-filter-title">Filter rankings</h2></div><button type="button" data-mi-filter-close aria-label="Close filters">${icon('close')}</button></header>
        <label>Direction<select data-mi-direction><option value="all">All</option><option value="positive">Positive 24h</option><option value="negative">Negative 24h</option></select></label>
        <label>Minimum confidence<input data-mi-confidence type="range" min="0" max="95" step="5" value="${view.confidence}"><output>${view.confidence}</output></label>
        <label>Derivatives state<select data-mi-universe><option value="all">All instruments</option><option value="funding-positive">Positive funding</option><option value="oi-expansion">OI expansion</option><option value="liquidation-risk">Liquidation risk</option></select></label>
        <div><button type="button" data-mi-filter-reset>Reset</button><button type="button" data-mi-filter-apply>Apply filters</button></div>
      </section>
    </div>
    <div class="q-mi-table-scroll" tabindex="0" aria-label="Asset rankings data table. Scroll horizontally for all metrics.">
      <table><caption>Qelly premium asset rankings with price, performance, liquidity, derivatives, source, freshness, and evidence actions.</caption>
        <thead><tr>${visibleColumns.map(([key,label])=>`<th data-sort="${key}" aria-sort="none" class="${key==='asset'?'is-sticky':''}">${label}${numericColumns.has(key)?icon('more',{size:12}):''}</th>`).join('')}</tr></thead>
        <tbody data-mi-table-body>${rows.map((row)=>`<tr data-mi-row="${safe(row.id,escapeHtml)}" tabindex="0">${visibleColumns.map(([key])=>cell(key,row,{watchlist,escapeHtml})).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="q-mi-mobile-rankings" data-mi-mobile-list>
      ${rows.map((row)=>mobileRow(row,{watchlist,escapeHtml})).join('')}
    </div>
    <footer><span>Source and confidence remain attached to each row.</span><span>Use horizontal table scroll on desktop; mobile uses prioritized expandable rows.</span></footer>
  </section>`;
}

function mobileRow(row,{watchlist,escapeHtml}){
  const watched=watchlist.has(row.id);
  return `<article class="q-mi-mobile-row" data-mi-mobile-row="${safe(row.id,escapeHtml)}">
    <div class="q-mi-mobile-row-main">
      <button type="button" data-mi-mobile-expand="${safe(row.id,escapeHtml)}" aria-expanded="false"><span class="q-mi-asset-mark">${safe(row.symbol.slice(0,2),escapeHtml)}</span><span><strong>${safe(row.name,escapeHtml)}</strong><small>#${row.rank} · ${safe(row.symbol,escapeHtml)}</small></span></button>
      <span class="q-mi-mobile-price"><strong>${money(row.price)}</strong><small class="${tone(row.change24h)}">${percent(row.change24h)}</small></span>
      <button type="button" class="q-mi-icon-button" data-mi-watch="${safe(row.id,escapeHtml)}" aria-pressed="${watched}" aria-label="${watched?'Remove from':'Add to'} watchlist">${icon(watched?'starFilled':'star')}</button>
    </div>
    <div class="q-mi-mobile-metrics" aria-label="Performance metrics"><span>1h <b class="${tone(row.change1h)}">${percent(row.change1h)}</b></span><span>7d <b class="${tone(row.change7d)}">${percent(row.change7d)}</b></span><span>OI <b>$${compactNumber(row.openInterest)}</b></span><span>Funding <b class="${tone(row.funding)}">${percent(row.funding,4)}</b></span></div>
    <div class="q-mi-mobile-detail" hidden><dl><div><dt>Market cap</dt><dd>$${compactNumber(row.marketCap)}</dd></div><div><dt>Volume</dt><dd>$${compactNumber(row.volume)}</dd></div><div><dt>Liquidation</dt><dd>$${compactNumber(row.liquidation)}</dd></div><div><dt>Confidence</dt><dd>${row.confidence}/100</dd></div><div><dt>Source</dt><dd>${safe(row.source,escapeHtml)}</dd></div><div><dt>Freshness</dt><dd>${safe(row.freshness,escapeHtml)}</dd></div></dl><button type="button" data-mi-explain="${safe(row.id,escapeHtml)}">${icon('explain')} Explain this move</button></div>
  </article>`;
}

function rowMatches(row,view,watchlist){
  const query=view.query.trim().toLowerCase();
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
}

function sortedRows(rows,sorts){
  if(!sorts.length)return [...rows];
  return [...rows].sort((left,right)=>{
    for(const {key,direction} of sorts){
      const a=left[key],b=right[key];
      const comparison=typeof a==='number'&&typeof b==='number'?a-b:String(a??'').localeCompare(String(b??''));
      if(comparison)return direction==='ascending'?comparison:-comparison;
    }
    return 0;
  });
}

export function bindTable(root,{rows,view,watchlist,render,toast,onExplain}={}){
  const filtered=()=>sortedRows(rows.filter((row)=>rowMatches(row,view,watchlist)),view.sorts);
  root.querySelector('[data-mi-search]')?.addEventListener('input',(event)=>{view.query=event.target.value;render();});
  root.querySelector('[data-mi-density-select]')?.addEventListener('change',(event)=>{view.density=event.target.value;render();});
  root.querySelectorAll('[data-mi-view]').forEach((button)=>button.addEventListener('click',()=>{view.savedView=button.dataset.miView;render();}));
  root.querySelectorAll('[data-sort]').forEach((header)=>header.addEventListener('click',(event)=>{
    const key=header.dataset.sort;
    const existing=view.sorts.find((item)=>item.key===key);
    const next=existing?.direction==='descending'?'ascending':'descending';
    view.sorts=event.shiftKey?[...view.sorts.filter((item)=>item.key!==key),{key,direction:next}]:[{key,direction:next}];
    render();
  }));
  root.querySelectorAll('[data-mi-watch]').forEach((button)=>button.addEventListener('click',()=>{
    const id=button.dataset.miWatch;
    if(watchlist.has(id))watchlist.delete(id);else watchlist.add(id);
    render();
  }));
  root.querySelectorAll('[data-mi-explain]').forEach((button)=>button.addEventListener('click',()=>onExplain?.(button.dataset.miExplain)));
  root.querySelectorAll('[data-mi-mobile-expand]').forEach((button)=>button.addEventListener('click',()=>{
    const detail=button.closest('.q-mi-mobile-row').querySelector('.q-mi-mobile-detail');
    const open=detail.hidden;detail.hidden=!open;button.setAttribute('aria-expanded',String(open));
  }));
  const columnMenu=root.querySelector('[data-mi-column-menu]');
  const toggleColumnMenu=(open)=>{if(!columnMenu)return;columnMenu.hidden=!open;root.querySelector('[data-mi-columns-toggle]')?.setAttribute('aria-expanded',String(open));};
  root.querySelector('[data-mi-columns-toggle]')?.addEventListener('click',()=>toggleColumnMenu(columnMenu.hidden));
  root.querySelector('[data-mi-column-close]')?.addEventListener('click',()=>toggleColumnMenu(false));
  root.querySelectorAll('[data-mi-column]').forEach((input)=>input.addEventListener('change',()=>{
    if(input.checked)view.columns.add(input.dataset.miColumn);else view.columns.delete(input.dataset.miColumn);
    if(view.columns.size<5){view.columns.add(input.dataset.miColumn);toast?.('Keep at least five columns visible',{tone:'neutral'});}
    render();
  }));
  const sheet=root.querySelector('[data-mi-filter-sheet]');
  const toggleSheet=(open)=>{if(!sheet)return;sheet.classList.toggle('is-open',open);sheet.setAttribute('aria-hidden',String(!open));root.querySelector('[data-mi-filter-toggle]')?.setAttribute('aria-expanded',String(open));};
  root.querySelector('[data-mi-filter-toggle]')?.addEventListener('click',()=>toggleSheet(true));
  root.querySelector('[data-mi-filter-close]')?.addEventListener('click',()=>toggleSheet(false));
  root.querySelector('[data-mi-filter-backdrop]')?.addEventListener('click',()=>toggleSheet(false));
  root.querySelector('[data-mi-confidence]')?.addEventListener('input',(event)=>event.target.nextElementSibling.textContent=event.target.value);
  root.querySelector('[data-mi-filter-apply]')?.addEventListener('click',()=>{
    view.direction=root.querySelector('[data-mi-direction]').value;view.confidence=root.querySelector('[data-mi-confidence]').value;view.universe=root.querySelector('[data-mi-universe]').value;toggleSheet(false);render();
  });
  root.querySelector('[data-mi-filter-reset]')?.addEventListener('click',()=>{view.direction='all';view.confidence='0';view.universe='all';toggleSheet(false);render();});
  root.querySelector('[data-mi-export]')?.addEventListener('click',()=>{
    const records=filtered();
    const blob=new Blob([JSON.stringify({generatedAt:new Date().toISOString(),mode:'static-visual-review',rows:records},null,2)],{type:'application/json'});
    const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='qelly-asset-rankings-review.json';link.click();URL.revokeObjectURL(link.href);
  });
  root.querySelector('[data-mi-result-count]')?.replaceChildren(String(filtered().length));
}
