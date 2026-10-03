/* Wave DB/CY: opt-in aggregate-only MT5 -> QELLY Chat handoff.
 * Never put uploaded report bytes, account IDs, tickets or report filenames in Chat.
 * The user must press Send separately after reading the draft. */
import {buildMt5ObservedDiagnostics} from './qelly-mt5-diagnostics.mjs';
import {compareMt5ClosedDealReports} from './qelly-mt5-comparison.mjs';

const SNAPSHOT_KEYS=['schema','truthState','sample','metrics','costs','groups','series','statisticalEvidence','warnings','unavailable'];
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
 const reportA=Object.fromEntries(SNAPSHOT_KEYS.map(key=>[key,a[key]]));
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
