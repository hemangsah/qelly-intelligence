/* Wave DA presentational renderer. Input must be normalized, non-sensitive MT5 evidence. */
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,d=2)=>typeof v==='number'&&Number.isFinite(v)?new Intl.NumberFormat('en',{maximumFractionDigits:d}).format(v):'Not available';
const metric=(title,value,note)=>'<article class="q-mt5-kpi"><span>'+esc(title)+'</span><strong>'+esc(value)+'</strong><small>'+esc(note)+'</small></article>';
const polyline=(points,field)=>{
 if(!Array.isArray(points)||!points.length)return '';
 const numbers=points.map(x=>x[field]).filter(x=>typeof x==='number'&&Number.isFinite(x));
 if(numbers.length!==points.length)return '';
 const lo=field==='drawdown'?0:Math.min(0,...numbers),hi=Math.max(field==='drawdown'?1:0,...numbers),span=Math.max(hi-lo,1e-8);
 const x=i=>30+(i/Math.max(1,points.length-1))*660;
 const y=v=>field==='drawdown'?16+((v-lo)/span)*172:16+((hi-v)/span)*172;
 return points.map((p,i)=>(i?'L':'M')+x(i).toFixed(2)+' '+y(p[field]).toFixed(2)).join(' ');
};
const chart=(points,field,title,prefix)=>{
 const key=prefix+'-'+field,titleId=key+'-title',descId=key+'-desc';
 if(!points.length)return '<p>No valid closed-deal series is available.</p>';
 return '<figure class="q-mt5-chart"><svg role="img" viewBox="0 0 720 210" aria-labelledby="'+esc(titleId)+' '+esc(descId)+'">'+
 '<title id="'+esc(titleId)+'">'+esc(title)+'</title><desc id="'+esc(descId)+'">Source-order closed-deal sequence; not broker account equity or balance.</desc>'+
 '<path class="q-mt5-zero-line" d="M30 188 H690"></path><path class="q-mt5-line '+(field==='drawdown'?'q-mt5-line-loss':'')+'" d="'+polyline(points,field)+'"></path>'+
 '</svg><figcaption>'+esc(title)+' · '+points.length+' plotted points, sourced from validated closing deals.</figcaption></figure>';
};
const breakdown=(name,entries)=>{
 if(!entries?.length)return '';
 return '<section class="q-mt5-breakdown"><h4>'+esc(name)+'</h4><table><thead><tr><th scope="col">Group</th><th scope="col">Deals</th><th scope="col">Observed P&amp;L</th><th scope="col">Win rate</th></tr></thead><tbody>'+
 entries.slice(0,12).map(row=>'<tr><th scope="row">'+esc(row.key)+'</th><td>'+num(row.count,0)+'</td><td>'+num(row.net,4)+'</td><td>'+num(row.winRatePct,2)+'%'+(row.count<5?' <span class="q-mt5-small-n">(small N)</span>':'')+'</td></tr>').join('')+
 '</tbody></table></section>';
};
export function renderMt5ClosedDealEvidence(report,{id='mt5-evidence'}={}){
 if(report?.schema!=='qelly.mt5.closed-deals/1.0'||!Array.isArray(report?.series?.points)||!report?.metrics||!report?.sample)throw new TypeError('Verified normalized MT5 analytics report required');
 const prefix=/^[a-z][a-z0-9-]{0,31}$/i.test(id)?id:'mt5-evidence';
 const m=report.metrics,s=report.sample,stats=report.statisticalEvidence,g=report.groups||{},series=report.series;
 const statistical=stats?.status==='OBSERVED SAMPLE RESAMPLING'?
 '<section class="q-mt5-statistical"><h4>Sample-only statistical stress</h4><p>Bootstrapped mean P&amp;L interval: '+esc(stats.bootstrapMean95.map(n=>num(n,4)).join(' to '))+
 '. Reshuffled closed-deal drawdown 95th percentile: '+num(stats.reorderedDrawdown95,4)+'. These resamples do not predict future performance.</p></section>':
 '<p class="q-mt5-limit">Statistical resampling withheld: sample too small or outside the bounded analysis range.</p>';
 return '<section class="q-mt5-report" aria-label="MT5 closed-deal evidence"><header><p class="q-mt5-eyebrow">MT5 Report Analyzer · Observed closed deals</p><h3>Deal-by-deal performance</h3><p>'+esc(s.grade)+' · '+num(s.deals,0)+' realized closing deals · account currency unverified</p></header>'+
 '<p class="q-mt5-disclosure" role="note">These calculations use realized closing-deal P&amp;L. The curves are NOT broker account equity or balance. Starting capital, deposits, floating P&amp;L and entry-side costs are not reconciled.</p>'+
 '<div class="q-mt5-kpis">'+metric('Net closed-deal P&L',num(m.netPnl,4),'reported P&L units')+
 metric('Gross profit',num(m.grossProfit,4),'observed closing deals')+metric('Gross loss',num(m.grossLoss,4),'absolute amount')+
 metric('Profit factor',num(m.profitFactor,3),m.profitFactor===null?'no observed gross loss':'profit / loss')+
 metric('Mean per closed deal',num(m.expectedPnlPerDeal,4),'historical sample only')+
 metric('Observed drawdown',num(m.maxClosedDealDrawdown,4),'closed-deal sequence')+
 '</div><div class="q-mt5-charts">'+chart(series.points,'cumulative','Cumulative closed-deal P&L',prefix)+chart(series.points,'drawdown','Closed-deal underwater drawdown',prefix)+'</div>'+
 '<p class="q-mt5-limit">Curve order: '+(series.chronological?'all available report timestamps are nondecreasing':'unverified; follows report row order')+'. No account equity, open trade marks or deposits are inferred.</p>'+
 '<div class="q-mt5-breakdowns">'+breakdown('By symbol',g.symbol)+breakdown('By direction',g.side)+breakdown('By report-clock hour',g.hour)+breakdown('By weekday',g.weekday)+'</div>'+
 statistical+'<section class="q-mt5-notes"><h4>Validation and limitations</h4><ul>'+report.warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul></section></section>';
}
