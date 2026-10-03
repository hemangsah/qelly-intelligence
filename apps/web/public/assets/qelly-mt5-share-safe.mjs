/* Wave DB/CY: opt-in aggregate-only MT5 -> QELLY Chat handoff.
 * Never put uploaded report bytes, account IDs, tickets or report filenames in Chat.
 * The user must press Send separately after reading the draft. */
import {buildMt5ObservedDiagnostics} from './qelly-mt5-diagnostics.mjs';
import {compareMt5ClosedDealReports} from './qelly-mt5-comparison.mjs';

const METRICS=['netPnl','grossProfit','grossLoss','profitFactor','expectedPnlPerDeal','winRatePct','maxClosedDealDrawdown','recoveryFactor','maxConsecutiveWins','maxConsecutiveLosses','sharpe','sortino','calmar','relativeAccountDrawdown'];
const numericObject=(value,keys)=>Object.fromEntries(keys.map(key=>[key,typeof value?.[key]==='number'&&Number.isFinite(value[key])?value[key]:null]));
function snapshotReport(r){
 const sample={...numericObject(r.sample,['deals','wins','losses','flat']),grade:r.sample.grade};
 const metrics=numericObject(r.metrics,METRICS);
 const costs=Object.fromEntries(['commission','fee','swap'].map(key=>[key,numericObject(r.costs?.[key],['knownTotal','coveragePct'])]));
 const groups=Object.fromEntries(['symbol','side','weekday','hour','month'].map(key=>[key,(Array.isArray(r.groups?.[key])?r.groups[key]:[]).slice(0,1000).map(item=>({
  key:key==='symbol'&&/^[A-Za-z0-9._/-]{1,16}$/.test(String(item.key))?String(item.key)
    :key==='side'&&/^(?:buy|sell)$/.test(String(item.key))?String(item.key)
    :key==='hour'&&/^(?:[01]?\d|2[0-3])$/.test(String(item.key))?String(item.key)
    :key==='weekday'&&/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/.test(String(item.key))?String(item.key)
    :key==='month'&&/^\d{4}-(?:0[1-9]|1[0-2])$/.test(String(item.key))?String(item.key):'(withheld label)',
  ...numericObject(item,['count','net','wins','losses','winRatePct'])
 }))]));
 const series={chronological:r.series?.chronological===true,total:r.series?.total,points:(r.series?.points||[]).slice(0,160).map(item=>numericObject(item,['index','cumulative','drawdown']))};
 const stats=r.statisticalEvidence||{};
 const statisticalEvidence={
  ...numericObject(stats,['sampleSize','meanPnl','sampleSd','descriptiveSkew','descriptiveExcessKurtosis','bootstrapRuns','reorderRuns','reorderedDrawdown95']),
  status:String(stats.status||'unavailable').slice(0,70),
  bootstrapMean95:Array.isArray(stats.bootstrapMean95)?stats.bootstrapMean95.slice(0,2).map(x=>typeof x==='number'&&Number.isFinite(x)?x:null):null,
  resamplingBoundary:typeof stats.resamplingBoundary==='string'?stats.resamplingBoundary.slice(0,200):null,
  assumptions:Array.isArray(stats.assumptions)?stats.assumptions.slice(0,4).map(x=>String(x).slice(0,220)):[]
 };
 return {schema:r.schema,truthState:r.truthState,sample,metrics,costs,groups,series,statisticalEvidence,
  warnings:Array.isArray(r.warnings)?r.warnings.slice(0,15).map(x=>String(x).slice(0,250)):[],
  unavailable:Array.isArray(r.unavailable)?r.unavailable.slice(0,15).map(x=>String(x).slice(0,180)):[]
 };
}
const round=x=>typeof x==='number'&&Number.isFinite(x)?Number(x.toFixed(4)):null;
const label=(id,group)=>{
 if(id==='negative-side'&&/^(buy|sell)$/i.test(String(group)))return String(group).toLowerCase();
 if(id==='negative-symbol'&&/^[A-Za-z0-9._/-]{1,16}$/.test(String(group)))return String(group);
 if(id==='negative-hour'&&/^(?:[01]\d|2[0-3]):00 \(report clock\)$/.test(String(group)))return String(group);
 return '(reported bucket label withheld)';
};
const privacy=Object.freeze({rawFilesRetained:false,sourceRowsIncluded:false,accountIdentifiersIncluded:false,uploaded:false});
export function buildMt5ShareSafePackage(a,b=null){
 const diagnosticsA=buildMt5ObservedDiagnostics(a);
 const diagnosticsB=b?buildMt5ObservedDiagnostics(b):null;
 const reportA=snapshotReport(a);
 const comparison=b?compareMt5ClosedDealReports(a,b):null;
 return {
  schema:'qelly.mt5.share-safe-local/1.1',truthState:'DETERMINISTIC LOCAL ANALYSIS',
  reportA,diagnosticsA,diagnosticsB,comparison,privacy
 };
}
export function buildMt5ChatDraft(a,b=null){
 const da=buildMt5ObservedDiagnostics(a),db=b?buildMt5ObservedDiagnostics(b):null;
 const line=(r,d,name)=>{
  const m=r.metrics;
  const statements=[
   name+': '+d.sample.deals+' realized closing deals ('+d.sample.grade.replaceAll('_',' ').toLowerCase()+').',
   'Observed net P&L '+round(m.netPnl)+' (currency unverified); win rate '+round(m.winRatePct)+'%; profit factor '+(round(m.profitFactor)??'unavailable')+'.'
  ];
  for(const item of d.findings.filter(x=>x.id.startsWith('negative-')).slice(0,3)){
   statements.push('Largest eligible negative-net '+item.id.slice(9)+' bucket '+label(item.id,item.group)+': '+round(item.value)+' unverified units across '+item.sampleCount+' closes.');
  }
  const missing=d.unavailable.length?'Insufficient evidence: '+d.unavailable.length+' subgroup/cost coverage gaps.':'';
  if(missing)statements.push(missing);
  return statements.join('\n');
 };
 const blocks=[
  'Review this user-supplied, browser-local MT5 aggregate summary. It has NOT been verified by QELLY Chat or any broker. Explain only the descriptive closing-deal observations, missingness and relevant validation questions; do not infer cause, recommend trading, predict results, or present a strategy ranking.',
  line(a,da,'Report A')
 ];
 if(b){
  blocks.push(line(b,db,'Report B'));
  blocks.push('Comparison: monetary deltas are withheld because account currencies, capital, exposure, periods and full trading costs are unverified.');
 }
 blocks.push('Limits: broker timezone, account equity, floating P&L, deposits, starting capital and entry-side costs are not validated. No raw trade rows, tickets, filenames or broker account identifiers were shared.');
 const draft=blocks.join('\n\n');
 if(draft.length>2200)throw new RangeError('MT5 Chat draft exceeds the governed local summary limit');
 return draft;
}
