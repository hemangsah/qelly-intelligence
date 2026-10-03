/* Standalone, browser-local research note from allowlisted aggregate MT5 evidence.
 * Source file bytes, filenames, trade rows, account IDs and tokens never enter
 * this formatter. Exporting a note requires an explicit user action. */
import {buildMt5ShareSafePackage} from './qelly-mt5-share-safe.mjs';

const value=x=>typeof x==='number'&&Number.isFinite(x)?String(Number(x.toFixed(4))):'Unavailable';
const ratio=x=>x===null||x===undefined?'Unavailable':value(x);
const sampleLabel=grade=>grade==='LIMITED_SAMPLE'?'LIMITED SAMPLE':'OBSERVED SAMPLE';
const pct=x=>typeof x==='number'&&Number.isFinite(x)?value(x)+'%':'Unavailable';
const noteFor=(label,report,diagnostics)=>{
 const m=report.metrics,findings=diagnostics.findings.slice(0,12),gaps=diagnostics.unavailable.slice(0,12);
 const lines=[
  '## '+label,
  '',
  '**Evidence:** '+diagnostics.sample.deals+' realized closing deals · '+sampleLabel(diagnostics.sample.grade)+'.',
  '',
  '| Observed metric | Reported value |',
  '| --- | ---: |',
  '| Net closed-deal P&L | '+value(m.netPnl)+' unverified units |',
  '| Gross positive closing-deal P&L | '+value(m.grossProfit)+' unverified units |',
  '| Gross negative closing-deal P&L | '+value(m.grossLoss)+' unverified units |',
  '| Win rate | '+pct(m.winRatePct)+' |',
  '| Profit factor | '+ratio(m.profitFactor)+' |',
  '| Expected P&L per closing deal | '+value(m.expectedPnlPerDeal)+' unverified units |',
  '| Maximum closed-deal sequence drawdown | '+value(m.maxClosedDealDrawdown)+' unverified units |',
  '',
  'The sequence drawdown above is derived from reported realized closing deals, **not** verified broker account-equity drawdown.',
  '',
  '### Known closing-deal cost coverage',
  ''
 ];
 for(const field of ['commission','fee','swap']){
  const c=report.costs?.[field]||{};
  lines.push('- '+field[0].toUpperCase()+field.slice(1)+': '+value(c.knownTotal)+' unverified units; '+pct(c.coveragePct)+' exported-field coverage. These known costs may already be included in reported deal P&L; entry-side charges have not been reconciled.');
 }
 lines.push('','### Evidence-linked observations','');
 for(const finding of findings){
  const group=typeof finding.group==='string'?' · '+finding.group:'';
  const coverage=typeof finding.coveragePct==='number'?'; field coverage '+pct(finding.coveragePct):'';
  lines.push('- **'+finding.label+group+':** '+value(finding.value)+' '+finding.units+' across '+finding.sampleCount+' closing deals'+coverage+'. '+finding.state.replaceAll('_',' ')+'. '+finding.evidence);
 }
 if(!findings.length)lines.push('- No diagnostic observations can be supported by this report.');
 lines.push('','### Unavailable evidence','');
 if(!gaps.length)lines.push('- No additional subgroup gaps were detected by the local diagnostics. This does not establish independent source authenticity.');
 else for(const gap of gaps)lines.push('- '+gap);
 return lines;
};
export function buildMt5LocalResearchNote(a,b=null){
 const pack=buildMt5ShareSafePackage(a,b);
 const lines=[
  '# QELLY MT5 Research Note',
  '',
  '**Research basis:** User-supplied, browser-local, unverified MT5 closing-deal exports. This note is descriptive research, not an audit, investment advice, strategy ranking or future-performance prediction.',
  '',
  '**Privacy:** No raw trades, report filenames, account identifiers, passwords, tickets or source file bytes are included. This local download contains aggregate financial results and any allowed symbol labels—review it before sharing.',
  '',
  ...noteFor('Report A',pack.reportA,pack.diagnosticsA)
 ];
 if(b){
  lines.push('','---','',...noteFor('Report B',pack.reportB,pack.diagnosticsB));
  const c=pack.comparison;
  lines.push('','## Descriptive report comparison','','Both reports are separate observed samples. Currency, exposure, period, account equity, funding and full costs have not been independently matched. **All monetary differences and strategy rankings are withheld.**','');
  lines.push('| Descriptive comparison | Report A | Report B | Status |','| --- | ---: | ---: | --- |');
  for(const d of c.dimensions.slice(0,8)){
   const delta=typeof d.delta==='number'?'Observed difference '+value(d.delta):d.comparisonState==='LIMITED_SAMPLE'?'Insufficient sample':d.comparisonState==='SIDE_BY_SIDE_ONLY'?'Not comparable (distinct denominators)':'Unavailable';
   lines.push('| '+d.label+' | '+value(d.reportA)+' | '+value(d.reportB)+' | '+delta+' |');
  }
  lines.push('','No causal attribution or matched-position equivalence is implied.');
 }
 const warnings=[...new Set([...pack.diagnosticsA.warnings,...(pack.diagnosticsB?.warnings||[]),...(pack.comparison?.warnings||[])])];
 lines.push('','## Evidence limitations','');
 for(const text of warnings.slice(0,22))lines.push('- '+text);
 lines.push('','## Reproducibility and handling','',
  '- Calculations are deterministic within the local QELLY MT5 Report Analyzer using normalized closing-deal evidence.',
  '- Negative-net subgroup highlights require at least five observed closing deals per group. Samples under 30 closing deals are explicitly limited.',
  '- No external broker statement, portfolio equity, deposits, account currency, broker timezone, entry-side costs or source authenticity has been verified.',
  '- Original reports are not uploaded by this export. Once downloaded, the research note is a separate local file and is not automatically deleted when the browser route is cleared.',
  '- To retain the structured calculation receipt locally, use the separate share-safe JSON export.');
 return lines.join('\n')+'\n';
}
