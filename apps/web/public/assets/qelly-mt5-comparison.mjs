/* Wave DB: strictly local comparison of two validated MT5 closed-deal reports.
 * No fabricated currency, position matching, account equity or causal claims. */
import {buildMt5ObservedDiagnostics} from './qelly-mt5-diagnostics.mjs';
const round=(value,places=3)=>Number.isFinite(value)?Number(value.toFixed(places)):null;
const cleanMetric=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
const groupByKey=(groups)=>new Map((Array.isArray(groups)?groups:[]).filter(x=>x&&(typeof x.key==='string'||Number.isInteger(x.key))&&String(x.key).length<=40).map(x=>[String(x.key),x]));
const dimension=(name,a,b,{minimum=1,rate=false}={})=>{
  const valid=cleanMetric(a)!==null&&cleanMetric(b)!==null;
  const enough=valid&&minimum>=30;
  return Object.freeze({label:name,reportA:cleanMetric(a),reportB:cleanMetric(b),delta:valid&&minimum>=30?round(b-a,rate?2:4):null,comparisonState:!valid?'UNAVAILABLE':enough?'OBSERVED_SAMPLE_DIFFERENCE':'LIMITED_SAMPLE',interpretation:'Descriptive difference only. Different market regimes, periods, sizing and broker costs are not controlled.'});
};
const boundedConcentration=(diagnostics,id)=>{
 const f=diagnostics.findings.find(item=>item.id===id);
 if(!f||!Number.isFinite(f.value)||f.value<0||f.value>100||!Number.isSafeInteger(f.sampleCount)||f.sampleCount<1)
  return Object.freeze({pct:null,closes:0,state:'UNAVAILABLE'});
 return Object.freeze({pct:f.value,closes:f.sampleCount,state:f.state});
};
const comparativeConcentration=(label,a,b)=>Object.freeze({
 label,reportA:a.pct,reportB:b.pct,delta:null,
 comparisonState:a.pct===null||b.pct===null?'UNAVAILABLE':'SIDE_BY_SIDE_ONLY',
 sampleA:a.closes,sampleB:b.closes,stateA:a.state,stateB:b.state,
 interpretation:'Within-report gross winning/losing closing-deal share only. Distinct denominators, capital, exposure, periods and full costs prevent a comparative difference or strategy ranking.'
});
const reportCheck=(report)=>{
  if(!report||report.schema!=='qelly.mt5.closed-deals/1.0'||report.truthState!=='DETERMINISTIC LOCAL ANALYSIS')throw new TypeError('Two locally validated MT5 closed-deal reports are required');
  const n=report.sample?.deals;
  if(!Number.isSafeInteger(n)||n<1||n>100000||!report.metrics||cleanMetric(report.metrics.netPnl)===null)throw new TypeError('MT5 report has no valid closing-deal evidence');
  return report;
};
const safeGroup=(g)=>g?Object.freeze({trades:Number(g.count)||0,winRatePct:cleanMetric(g.winRatePct),netPnl:cleanMetric(g.net)}):null;
export function compareMt5ClosedDealReports(left,right){
  const a=reportCheck(left),b=reportCheck(right),aN=a.sample.deals,bN=b.sample.deals,minN=Math.min(aN,bN);
  const da=buildMt5ObservedDiagnostics(a),db=buildMt5ObservedDiagnostics(b);
  const concentrations={
   A:{winning:boundedConcentration(da,'largest-profit-share'),losing:boundedConcentration(da,'largest-loss-share')},
   B:{winning:boundedConcentration(db,'largest-profit-share'),losing:boundedConcentration(db,'largest-loss-share')}
  };
  const one=(r,which)=>Object.freeze({sample:r.sample.grade,deals:r.sample.deals,wins:r.sample.wins,losses:r.sample.losses,netPnl:r.metrics.netPnl,
    profitFactor:cleanMetric(r.metrics.profitFactor),winRatePct:cleanMetric(r.metrics.winRatePct),expectancy:cleanMetric(r.metrics.expectedPnlPerDeal),
    closedDealDrawdown:cleanMetric(r.metrics.maxClosedDealDrawdown),consecutiveLosses:cleanMetric(r.metrics.maxConsecutiveLosses),
    profitConcentration:concentrations[which].winning,lossConcentration:concentrations[which].losing,
    chronological:r.series?.chronological===true,entryCostsReconciled:false,sourceVerified:false});
  const symbolsA=groupByKey(a.groups?.symbol),symbolsB=groupByKey(b.groups?.symbol);
  const symbols=[...new Set([...symbolsA.keys(),...symbolsB.keys()])].sort((x,y)=>x.localeCompare(y)).slice(0,48)
    .map(symbol=>Object.freeze({symbol,reportA:safeGroup(symbolsA.get(symbol)),reportB:safeGroup(symbolsB.get(symbol))}));
  const groups={};for(const key of ['side','weekday','hour','month']){
    const aa=groupByKey(a.groups?.[key]),bb=groupByKey(b.groups?.[key]);
    groups[key]=Object.freeze([...new Set([...aa.keys(),...bb.keys()])].sort((x,y)=>x.localeCompare(y)).slice(0,36)
      .map(item=>Object.freeze({key:item,reportA:safeGroup(aa.get(item)),reportB:safeGroup(bb.get(item))})));
  }
  const pa=a.metrics.profitFactor,pb=b.metrics.profitFactor;
  const dimensions=Object.freeze([
    dimension('Observed win rate (percentage points)',a.metrics.winRatePct,b.metrics.winRatePct,{minimum:minN,rate:true}),
    dimension('Profit factor',pa,pb,{minimum:minN}),
    dimension('Observed loss-streak length',a.metrics.maxConsecutiveLosses,b.metrics.maxConsecutiveLosses,{minimum:minN}),
    comparativeConcentration('Largest winning close share (%)',concentrations.A.winning,concentrations.B.winning),
    comparativeConcentration('Largest losing close share (%)',concentrations.A.losing,concentrations.B.losing)
  ]);
  const warnings=[
    'Both reports contain realized closed-deal observations, not verified broker equity, matched positions or independently verified strategy outcomes.',
    'Account currency, starting balance, leverage, deposit/withdrawal flows and broker execution conditions were not validated. Monetary differences and strategy rankings are withheld.',
    'Different periods, exposures, symbol mixes or correlated accounts may invalidate direct causal comparisons.',
    'Entry-side costs are not fully reconciled; each report may understate the full cost of trading.',
    'Time buckets use the uploaded broker clock. Timezone and trading session labels are unknown.',
    'Largest single-close profit and loss shares use different within-report gross P&L denominators; only side-by-side observations are shown, not comparative differences or investment-performance rankings.'
  ];
  if(minN<30)warnings.push('LIMITED SAMPLE: at least one report contains fewer than 30 closed deals. Suppressing numeric rate/ratio deltas and any inference of a difference.');
  if(!a.series?.chronological||!b.series?.chronological)warnings.push('At least one report lacks complete verified chronological ordering; sequence and period comparisons are not supported.');
  const missingA=Object.values(a.costs||{}).some(x=>x?.coveragePct<100),missingB=Object.values(b.costs||{}).some(x=>x?.coveragePct<100);
  if(missingA||missingB)warnings.push('At least one report has incomplete closing-deal commission, fee or swap coverage.');
  return Object.freeze({
    schema:'qelly.mt5.closed-deal-comparison/1.0',truthState:'DETERMINISTIC LOCAL COMPARISON',
    reportA:one(a,'A'),reportB:one(b,'B'),
    comparability:Object.freeze({sampleStatus:minN<30?'LIMITED_SAMPLE':'OBSERVED_SAMPLES',minimumClosedDeals:minN,
      monetaryDeltas:'WITHHELD_UNVERIFIED_CURRENCY',causalAttribution:'NOT_ASSESSED',
      pnlUnitsCompatible:false,accountEquityComparable:false,tradeFrequencyComparable:false,
      reason:'Independent broker currency, funding, duration, exposure and position metadata are unavailable.'}),
    dimensions,symbols:Object.freeze(symbols),groups:Object.freeze(groups),warnings:Object.freeze(warnings),
    privacy:Object.freeze({rawFilesRetained:false,brokerAccountsIncluded:false,uploaded:false,sourceRowsIncluded:false})
  });
}
