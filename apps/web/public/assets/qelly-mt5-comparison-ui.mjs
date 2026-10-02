/* Accessible, local-only MT5 A/B comparison; uploaded filenames are untrusted. */
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=(value,d=2)=>typeof value==='number'&&Number.isFinite(value)?new Intl.NumberFormat('en',{maximumFractionDigits:d}).format(value):'Not available';
const diff=(value,unit='')=>typeof value==='number'&&Number.isFinite(value)?(value>0?'+':'')+n(value,2)+unit:'Withheld';
const paired=(label,a,b,{money=false,ratio=false,delta=null}={})=>
  '<tr><th scope="row">'+esc(label)+'</th><td>'+n(a,ratio?3:2)+'</td><td>'+n(b,ratio?3:2)+'</td><td>'+
  (money?'Withheld (currency unverified)':diff(delta,ratio?'':' percentage points'))+'</td></tr>';
const sample=({label,name,report})=>
  '<article class="q-mt5-compare-card"><span class="q-mt5-compare-index">'+esc(label)+'</span><strong>'+esc(name||'Local report')+
  '</strong><dl><div><dt>Closing deals</dt><dd>'+n(report.deals,0)+'</dd></div><div><dt>Win rate</dt><dd>'+n(report.winRatePct,2)+
  '%</dd></div><div><dt>Net closed-deal P&amp;L</dt><dd>'+n(report.netPnl,4)+'</dd></div></dl><small>Reported P&amp;L units are not independently verified.</small></article>';
const groupRows=(items,limit)=>items.slice(0,limit).map(item=>
  '<tr><th scope="row">'+esc(item.symbol||item.key)+'</th><td>'+n(item.reportA?.trades,0)+'</td><td>'+n(item.reportB?.trades,0)+
  '</td><td>'+n(item.reportA?.winRatePct,2)+'%</td><td>'+n(item.reportB?.winRatePct,2)+'%</td></tr>').join('');
export function renderMt5Comparison(report,{nameA='Report A',nameB='Report B'}={}){
 if(report?.schema!=='qelly.mt5.closed-deal-comparison/1.0'||report.truthState!=='DETERMINISTIC LOCAL COMPARISON'||!report.reportA||!report.reportB||!report.comparability)throw new TypeError('Validated local MT5 comparison required');
 const pct=report.dimensions.find(x=>x.label.startsWith('Observed win rate')),pf=report.dimensions.find(x=>x.label==='Profit factor');
 const diffLabel=report.comparability.sampleStatus==='LIMITED_SAMPLE'?'LIMITED SAMPLE':'OBSERVED SAMPLES';
 const moneyNote='No currency-converted P&amp;L difference, equity comparison, future return probability or strategy ranking is calculated.';
 let out='<section class="q-mt5-compare-result" aria-labelledby="q-mt5-compare-title" data-mt5-comparison-result>'+
   '<header><p class="q-mt5-compare-kicker">Local report research · '+esc(diffLabel)+'</p><h3 id="q-mt5-compare-title">Report A versus Report B</h3>'+
   '<p>Compare two independent, validated MT5 closing-deal samples. This does not establish which trading strategy will perform better.</p></header>'+
   '<div class="q-mt5-compare-card-grid">'+sample({label:'A',name:nameA,report:report.reportA})+
   sample({label:'B',name:nameB,report:report.reportB})+'</div>'+
   '<p class="q-mt5-compare-boundary" role="note"><strong>Comparability boundary.</strong> '+moneyNote+'</p>'+
   '<div class="q-mt5-compare-scroll"><table><caption>Two-report metrics and sample-limited descriptive differences</caption>'+
   '<thead><tr><th scope="col">Observed metric</th><th scope="col">Report A</th><th scope="col">Report B</th><th scope="col">B minus A</th></tr></thead><tbody>'+
   paired('Win rate (%)',report.reportA.winRatePct,report.reportB.winRatePct,{delta:pct?.delta})+
   paired('Profit factor',report.reportA.profitFactor,report.reportB.profitFactor,{ratio:true,delta:pf?.delta})+
   paired('Closed-deal drawdown',report.reportA.closedDealDrawdown,report.reportB.closedDealDrawdown,{money:true})+
   paired('Observed net P&L',report.reportA.netPnl,report.reportB.netPnl,{money:true})+
   paired('Average P&L per deal',report.reportA.expectancy,report.reportB.expectancy,{money:true})+
   paired('Loss streak (deals)',report.reportA.consecutiveLosses,report.reportB.consecutiveLosses)+
   '</tbody></table></div>';
 const tables=[['By symbol',report.symbols],['By direction',report.groups.side],['By report-clock hour',report.groups.hour]];
 for(const [title,data] of tables){
   if(!data?.length)continue;
   out+='<section class="q-mt5-compare-breakdown"><h4>'+esc(title)+'</h4><div class="q-mt5-compare-scroll"><table><caption>'+esc(title)+' sample counts and win rates (no cross-currency profit ranking)</caption>'+
   '<thead><tr><th scope="col">Group</th><th scope="col">A deals</th><th scope="col">B deals</th><th scope="col">A win %</th><th scope="col">B win %</th></tr></thead><tbody>'+groupRows(data,12)+'</tbody></table></div></section>';
 }
 out+='<section class="q-mt5-compare-warnings"><h4>Interpretation and data limits</h4><ul>'+report.warnings.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></section>'+
   '<p class="q-mt5-compare-privacy">Files are processed locally and discarded after parsing. This comparison is held in browser memory only until you clear it or reload this tab.</p></section>';
 return out;
}
