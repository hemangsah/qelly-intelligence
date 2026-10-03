/* Wave DB: deterministic observations from normalized MT5 closing deals.
 * No raw positions, account identity, uploaded bytes or future-performance claims. */
const SCHEMA='qelly.mt5.closed-deal-diagnostics/1.0';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const round=(x,d=4)=>finite(x)?Number(x.toFixed(d)):null;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groupKinds=Object.freeze([
 {key:'symbol',label:'Symbol',boundary:'Only exported symbol labels; netted bucket P&L is not individual losing-trade attribution.'},
 {key:'side',label:'Direction',boundary:'Buy/sell labels describe closing deals, not matched position-level returns.'},
 {key:'hour',label:'Report-clock hour',boundary:'The exported clock has no verified timezone; no market-session attribution.'}
]);
const validReport=r=>r?.schema==='qelly.mt5.closed-deals/1.0'
 &&r.truthState==='DETERMINISTIC LOCAL ANALYSIS'
 &&Number.isSafeInteger(r.sample?.deals)&&r.sample.deals>=1&&r.sample.deals<=100000
 &&finite(r.metrics?.netPnl)&&finite(r.metrics?.grossProfit)
 &&finite(r.metrics?.grossLoss)&&r.groups&&typeof r.groups==='object';
function eligibleNegative(groups,total,kind){
 if(!Array.isArray(groups))return [];
 return groups.filter(g=>{
  if(!g||!Number.isSafeInteger(g.count)||g.count<5||g.count>total||!finite(g.net)||g.net>=0)return false;
  if(kind==='hour')return Number.isInteger(Number(g.key))&&Number(g.key)>=0&&Number(g.key)<24;
  return typeof g.key==='string'&&g.key.length>0&&g.key.length<=40;
 }).sort((a,b)=>a.net-b.net||b.count-a.count||String(a.key).localeCompare(String(b.key)));
}
export function buildMt5ObservedDiagnostics(report){
 if(!validReport(report))throw new TypeError('Validated normalized MT5 closing-deal report required');
 const n=report.sample.deals,limited=n<30,findings=[],gaps=[];
 const m=report.metrics;
 const pnlLabel=m.netPnl<0?'Observed negative net closing-deal P&L':m.netPnl>0?'Observed positive net closing-deal P&L':'Observed zero net closing-deal P&L';
 findings.push(Object.freeze({
  id:'net-observed',label:pnlLabel,value:round(m.netPnl),
  units:'unverified reported P&L units',sampleCount:n,
  evidence:'Gross profit '+round(m.grossProfit)+'; gross loss '+round(m.grossLoss)+'.',
  state:limited?'LIMITED_SAMPLE':'OBSERVED_SAMPLE'
 }));
 for(const def of groupKinds){
  const eligible=eligibleNegative(report.groups[def.key],n,def.key);
  if(!eligible.length){gaps.push('No '+def.label.toLowerCase()+' bucket with at least five closing deals and observed negative net P&L.');continue;}
  const g=eligible[0],name=def.key==='hour'?String(g.key).padStart(2,'0')+':00 (report clock)':String(g.key);
  findings.push(Object.freeze({
   id:'negative-'+def.key,label:'Largest eligible negative-net '+def.label.toLowerCase()+' bucket',
   group:name,value:round(g.net),units:'unverified reported P&L units',
   sampleCount:g.count,winRatePct:finite(g.winRatePct)?round(g.winRatePct,2):null,
   evidence:def.boundary,
   state:limited?'LIMITED_SAMPLE':g.count<15?'SMALL_GROUP':'OBSERVED_GROUP'
  }));
 }
 const costs=report.costs||{};
 for(const field of ['commission','fee','swap']){
  const c=costs[field];
  if(!c||!finite(c.coveragePct)||c.coveragePct<0||c.coveragePct>100
   ||!finite(c.knownTotal)){gaps.push('Reported '+field+' coverage or total is unavailable.');continue;}
  if(c.knownTotal<0){
   findings.push(Object.freeze({
    id:'reported-'+field,label:'Known reported closing-deal '+field,
    value:round(c.knownTotal),units:'unverified reported cost units',
    sampleCount:n,coveragePct:round(c.coveragePct,2),
    evidence:'Known exported entries only. This amount may already be included in reported deal P&L; entry-side costs are unreconciled.',
    state:c.coveragePct===100?'OBSERVED_COST':'INCOMPLETE_COST_COVERAGE'
   }));
  }
 }
 const winCount=Number.isSafeInteger(report.sample?.wins)?report.sample.wins:0;
 if(finite(m.largestProfitContributionPct)&&finite(m.largestWinningDealPnl)&&winCount>0){
  findings.push(Object.freeze({
   id:'largest-profit-share',label:'Largest observed single closing-deal profit share',
   value:round(m.largestProfitContributionPct,2),units:'percent of aggregate observed winning closing-deal P&L',
   sampleCount:winCount,shareBasis:'gross positive closing-deal P&L',
   evidence:'Largest winning close '+round(m.largestWinningDealPnl)+' / total gross winning close P&L '+round(m.grossProfit)+'. Individual closes may be partial position exits; account currency, capital and entry-side costs are unverified.',
   state:limited?'LIMITED_SAMPLE':winCount<5?'SMALL_WIN_SET':'OBSERVED_SAMPLE'
  }));
 }else gaps.push('No observed winning closing deal supports a largest-profit contribution calculation.');
 const lossCount=Number.isSafeInteger(report.sample?.losses)?report.sample.losses:0;
 if(finite(m.largestLossContributionPct)&&lossCount>0){
  findings.push(Object.freeze({
   id:'largest-loss-share',label:'Largest observed single closing-deal loss share',
   value:round(m.largestLossContributionPct,2),units:'percent of aggregate observed losing closing-deal P&L',
   sampleCount:lossCount,shareBasis:'gross negative closing-deal P&L',
   evidence:'Largest losing close '+round(m.largestLosingDealPnl)+' / total gross losing close magnitude '+round(m.grossLoss)+'. Individual closing deals may be partial position exits; no account-currency or entry-cost verification.',
   state:limited?'LIMITED_SAMPLE':lossCount<5?'SMALL_LOSS_SET':'OBSERVED_SAMPLE'
  }));
 }else gaps.push('No observed losing closing deal supports a largest-loss contribution calculation.');
 if(report.series?.uniqueChronological===true&&Number.isSafeInteger(m.longestUnderwaterClosingDeals)){
  if(m.longestUnderwaterClosingDeals>0)findings.push(Object.freeze({
   id:'longest-underwater-deals',label:'Longest closing-deal sequence below its prior cumulative P&L high',
   value:m.longestUnderwaterClosingDeals,units:'consecutive strictly time-ordered closing deals, not elapsed time',
   sampleCount:n,
   evidence:'Measured on all normalized closing deals, not the downsampled chart. Report timestamps are strictly increasing; the P&L baseline begins at zero and is not broker account equity.',
   state:limited?'LIMITED_SAMPLE':'OBSERVED_SAMPLE'
  }));
 }else gaps.push('A strictly increasing, unambiguous broker report-clock sequence is unavailable; longest underwater closing-deal span is withheld.');
 const warnings=[
  'Descriptive analysis of this uploaded sample only; not a forecast or evidence that a strategy caused the observed result.',
  'Currency, account equity, balance, deposits, exposure, entry-side costs and source authenticity have not been independently verified.',
  'Bucket P&L aggregates realized closing deals; buckets with fewer than five deals are excluded from negative-net highlights.',
  'Reported clock hours are not market sessions because the broker timezone is unverified.',
  'Single-deal loss contribution and closing-deal underwater spans are descriptive local-sequence observations, not future loss probabilities, position-level risk or broker account-equity drawdown. Single-deal profit concentration is also descriptive, not investment returns, future probabilities or evidence of a strategy advantage.'
 ];
 if(limited)warnings.push('LIMITED SAMPLE: fewer than 30 closing deals; no statistical or causal subgroup conclusions are supported.');
 if(report.series?.chronological!==true)warnings.push('Report ordering is unverified; no time-sequence or drawdown-cluster conclusion is supported.');
 if((report.groups?.hour||[]).length===0)gaps.push('No valid report-clock hour observations were available.');
 return Object.freeze({
  schema:SCHEMA,truthState:'DETERMINISTIC LOCAL DIAGNOSTICS',
  sample:Object.freeze({deals:n,grade:limited?'LIMITED_SAMPLE':'OBSERVED_SAMPLE',highlightMinGroupDeals:5}),
  findings:Object.freeze(findings),unavailable:Object.freeze(gaps),
  warnings:Object.freeze(warnings),
  privacy:Object.freeze({sourceRowsIncluded:false,accountIdentifiersIncluded:false,rawFileRetained:false,uploaded:false})
 });
}
export function renderMt5ObservedDiagnostics(report){
 const analysis=buildMt5ObservedDiagnostics(report),f=analysis.findings;
 const item=x=>'<article class="q-mt5-diagnostic-card"><span class="q-mt5-diagnostic-state">'+esc(x.state.replaceAll('_',' '))+'</span>'+
 '<h5>'+esc(x.label)+'</h5>'+(x.group?'<p><strong>'+esc(x.group)+'</strong></p>':'')+
 '<p class="q-mt5-diagnostic-value">'+esc(x.value===null?'Unavailable':x.value)+'</p>'+
 '<p>'+esc(x.units)+' · '+esc(x.sampleCount)+' closing deals'+
 (x.coveragePct===undefined?'':' · '+esc(x.coveragePct)+'% field coverage')+
 (x.winRatePct===undefined||x.winRatePct===null?'':' · '+esc(x.winRatePct)+'% observed win rate')+'</p>'+
 '<small>'+esc(x.evidence)+'</small></article>';
 return '<section class="q-mt5-diagnostics" aria-labelledby="q-mt5-diagnostics-heading" data-mt5-observed-diagnostics>'+
 '<header><p class="q-mt5-eyebrow">Report-grounded diagnostics</p><h4 id="q-mt5-diagnostics-heading">What the closing-deal evidence shows</h4>'+
 '<p>'+esc(analysis.sample.grade.replaceAll('_',' '))+' · The highlighted groups are descriptive, not strategy rankings or causal explanations.</p></header>'+
 '<div class="q-mt5-diagnostic-grid">'+f.map(item).join('')+'</div>'+
 (analysis.unavailable.length?'<details><summary>Unavailable or insufficient evidence ('+analysis.unavailable.length+')</summary><ul>'+analysis.unavailable.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></details>':'')+
 '<div class="q-mt5-diagnostic-boundary"><strong>Interpretation boundaries</strong><ul>'+analysis.warnings.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div></section>';
}
