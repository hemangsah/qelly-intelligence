import {buildMt5ObservedDiagnostics} from './qelly-mt5-diagnostics.mjs';
import {analyzeTrades,parseTradeCsv,sampleTradeCsv} from './qelly-verify-engine.mjs';
import {parseMt5Html,parseMt5Xlsx,MT5_REPORT_LIMITS} from './qelly-mt5-report-parser.mjs';
import {analyzeMt5ClosedDeals} from './qelly-mt5-advanced-metrics.mjs';
import {renderMt5ClosedDealEvidence} from './qelly-mt5-visuals.mjs';
import {compareMt5ClosedDealReports} from './qelly-mt5-comparison.mjs';
import {renderMt5Comparison} from './qelly-mt5-comparison-ui.mjs';
import {QELLY_VERIFY_METHODOLOGY,QELLY_VERIFY_METHODOLOGY_VERSION,QELLY_VERIFY_REPORT_SCHEMA} from './qelly-verify-methodology.mjs';
import {composeStrategyEvidenceReport} from './qelly-verify-report.mjs';
import {applyV53VerifyCanonical} from './qelly-v53-verify-canonical.mjs';

const main=document.getElementById('main');
const MAX_FILE_BYTES=5*1024*1024;
const COMPARISON_STYLESHEET=new URL('./qelly-mt5-comparison.css',import.meta.url).href;
const ensureComparisonStyles=()=>{if(document.querySelector('link[data-qelly-mt5-comparison]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href=COMPARISON_STYLESHEET;link.dataset.qellyMt5Comparison='active';document.head.append(link);};
const MT5_VISUAL_STYLESHEET=new URL('./qelly-mt5-visuals.css',import.meta.url).href;
const ensureMt5Styles=()=>{if(document.querySelector('link[data-qelly-mt5-evidence]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href=MT5_VISUAL_STYLESHEET;link.dataset.qellyMt5Evidence='active';document.head.append(link);};
let current=null;
let comparison={A:null,B:null};
let comparisonError='';
const comparisonGeneration={A:0,B:0};

const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const number=(value,digits=2)=>value==null?'—':new Intl.NumberFormat(undefined,{maximumFractionDigits:digits}).format(Number(value));
const percent=value=>value==null?'—':`${number(value)}%`;
const download=(name,content,type)=>{const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),500);};
const scoreTone=(value,inverted=false)=>{const score=inverted?100-Number(value):Number(value);return score>=70?'strong':score>=45?'mixed':'weak';};

function comparisonShell(){
 const ready=Boolean(comparison.A&&comparison.B);
 const status=slot=>comparison[slot]?escapeHtml(comparison[slot].name)+' · '+number(comparison[slot].report.sample.deals,0)+' closing deals':'No report selected';
 const inputs=['A','B'].map(slot=>'<label class="q-mt5-compare-input"><strong>Report '+slot+'</strong><input type="file" data-mt5-compare-file="'+slot+'" accept=".html,.htm,.xlsx,text/html,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-describedby="q-mt5-compare-status-'+slot+'"><small id="q-mt5-compare-status-'+slot+'">'+status(slot)+'</small></label>').join('');
 const result=ready?renderMt5Comparison(compareMt5ClosedDealReports(comparison.A.report,comparison.B.report),{nameA:comparison.A.name,nameB:comparison.B.name}):'';
 return '<section class="q-mt5-comparison" data-qelly-mt5-comparison aria-label="MT5 report comparison">'+
 '<header><p class="q-verify-kicker">Step 2 · Local A/B comparison</p><h2>Compare two MT5 reports</h2><p>Select two separate HTML or XLSX Deals reports. Files remain local; differences are descriptive and monetary deltas are withheld until account currencies can be verified.</p></header>'+
 '<div class="q-mt5-compare-inputs">'+inputs+'</div><p role="status" aria-live="polite" data-mt5-compare-status>'+escapeHtml(comparisonError||(ready?'Both reports parsed locally.':'Choose both reports to see a governed comparison.'))+'</p>'+
 '<div class="q-mt5-compare-controls"><button type="button" data-mt5-compare-export'+(ready?'':' disabled')+'>Export share-safe comparison JSON</button>'+
 '<button type="button" data-mt5-compare-reset'+(!comparison.A&&!comparison.B?' disabled':'')+'>Clear both reports</button></div>'+result+'</section>';
}
function verifyShell(evidence=null,validation=null,sourceName='No file selected',mt5Report=null){
  return `<section class="q-verify-page" data-qelly-verify-surface>
    <header class="q-verify-hero"><div class="q-verify-hero__copy"><p class="q-verify-kicker">Qelly Verify · Strategy Intelligence Report</p><h1>Put your strategy through evidence, not belief.</h1><p>Upload an MT5 Deals HTML/XLSX report or structured trade CSV. Qelly validates realized deal rows, measures performance and observed risk, tests trade-order sensitivity and produces a versioned evidence report.</p><div class="q-verify-flow" aria-label="Qelly Verify workflow"><span>Upload</span><i>→</i><span>Validate</span><i>→</i><span>Analyze</span><i>→</i><span>Decide</span></div><p class="q-verify-method-link"><a href="#/qelly-verify?view=methodology">Read the public evidence methodology</a></p></div>
      <aside class="q-verify-boundary"><strong>Local-only prototype evidence workflow</strong><p>Your file is processed in this browser and is not uploaded. No live AI model, order execution or personalized financial recommendation is active.</p><dl><div><dt>Data transfer</dt><dd>None</dd></div><div><dt>Method</dt><dd>${escapeHtml(QELLY_VERIFY_METHODOLOGY_VERSION)}</dd></div><div><dt>Execution</dt><dd>Disabled</dd></div></dl></aside></header>
    <section class="q-verify-workspace"><article class="q-verify-upload-card"><div><p class="q-verify-kicker">Step 1 · Strategy evidence</p><h2>Import local MT5 reports or trade CSV</h2><p>Supported: structured CSV; MT5 HTML/XLSX containing Deals with Type, Direction, and numeric Profit. Only realized closing buy/sell deals are analyzed. Entry-side costs, account cash flows and external authenticity remain unverified.</p></div><label class="q-verify-dropzone" data-verify-dropzone><input type="file" accept=".csv,.txt,.htm,.html,.xlsx,text/csv,text/plain,text/html,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-verify-file><span class="q-verify-dropzone__icon" aria-hidden="true">⇧</span><strong>Choose or drop CSV, MT5 HTML or MT5 XLSX</strong><small>Maximum 5 MB · up to 100,000 realized closing deals · processed locally · no workbook macros</small></label><div class="q-verify-upload-actions"><button type="button" class="q-button q-button--secondary" data-verify-sample>Run governed sample</button><button type="button" class="q-button q-button--ghost" data-verify-download-sample>Download sample CSV</button>${evidence?'<button type="button" class="q-button q-button--ghost" data-verify-reset>Clear report</button>':''}</div><p class="q-verify-file-state" role="status" aria-live="polite" data-verify-status>${escapeHtml(sourceName)}</p></article>${comparisonShell()}${reportMarkup(evidence,validation,mt5Report,sourceName)}</section>
  </section>`;
}

function scoreCard(label,entry,{inverted=false,detail=''}={}){if(!entry)return'';const tone=scoreTone(entry.value,inverted);return `<article class="q-verify-score is-${tone}"><div><span>${escapeHtml(label)}</span><strong>${number(entry.value,0)}</strong><small>${escapeHtml(entry.band)}</small></div><div class="q-verify-score__track" aria-label="${escapeHtml(label)} ${number(entry.value,0)} out of 100"><i style="width:${Math.max(0,Math.min(100,entry.value))}%"></i></div><p>${escapeHtml(detail)}</p></article>`;}
const stateList=items=>`<ul class="q-verify-state-list">${items.map(item=>`<li><span class="q-verify-state is-${item.state.toLowerCase().replaceAll(' ','-')}">${escapeHtml(item.state)}</span><div><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.detail)}</p></div></li>`).join('')}</ul>`;

function reportMarkup(evidence,validation,mt5Report=null,sourceName='No file selected'){
  if(!evidence&&mt5Report)return `<section class="q-verify-report q-verify-mt5-only" aria-live="polite"><header class="q-verify-report__head"><div><p class="q-verify-kicker">MT5 limited-sample evidence</p><h2>${escapeHtml(sourceName)}</h2><p>${mt5Report.sample.deals} closing deals · general heuristic scores require 5–5,000 deals</p></div><div><button type="button" class="q-button q-button--primary" data-verify-export>Export observed MT5 evidence</button><button type="button" class="q-button q-button--ghost" data-verify-print>Print report</button></div></header>${renderMt5ClosedDealEvidence(mt5Report)}<p class="q-verify-file-state" role="note">Only observed closing-deal analytics are shown; sample size is insufficient for the general strategy-scoring engine or exceeds its bounded MT5 window.</p></section>`;
  if(!evidence)return `<section class="q-verify-empty"><div aria-hidden="true">Q</div><h2>Your evidence report will appear here</h2><p>Start with a CSV or the governed sample. Qelly will not fabricate missing trades, market regimes, execution assumptions or out-of-sample evidence.</p></section>`;
  const performance=evidence.performance;const allocation=evidence.allocationResearch;const posture=evidence.executiveSummary.posture;
  return `<section class="q-verify-report" aria-live="polite">
    <header class="q-verify-report__head"><div><p class="q-verify-kicker">Qelly Strategy Evidence Report</p><h2>${escapeHtml(evidence.source.name)}</h2><p>${evidence.sample.trades} valid trades · ${validation.invalidRows} rejected · report ${escapeHtml(evidence.reportId)}</p></div><div><span class="q-verify-truth">${escapeHtml(evidence.truthState)}</span><button type="button" class="q-button q-button--primary" data-verify-export>Export evidence JSON</button><button type="button" class="q-button q-button--ghost" data-verify-print>Print report</button></div></header>
    <nav class="q-verify-report-nav" aria-label="Evidence report sections"><a href="#qv-summary">Summary</a><a href="#qv-data">Data</a><a href="#qv-performance">Performance</a>${mt5Report?'<a href="#qv-mt5">MT5 detail</a>':''}<a href="#qv-risk">Risk</a><a href="#qv-coverage">Coverage</a><a href="#qv-provenance">Provenance</a></nav>
    <section id="qv-summary" class="q-verify-executive is-${escapeHtml(posture.tone)}"><div><p class="q-verify-kicker">Executive evidence posture</p><h3>${escapeHtml(posture.label)}</h3><p>${escapeHtml(posture.statement)}</p></div><aside><strong>Primary warning</strong><p>${escapeHtml(evidence.executiveSummary.primaryWarning)}</p></aside></section>
    <section id="qv-data" class="q-verify-validation"><div><strong>${validation.validRows}</strong><span>Valid rows</span></div><div><strong>${validation.invalidRows}</strong><span>Rejected rows</span></div><div><strong>${percent(evidence.dataQuality.usableRowRate)}</strong><span>Usable-row rate</span></div><div><strong>${Object.keys(validation.detectedFields).length}</strong><span>Fields mapped</span></div></section>
    <section class="q-verify-data-notes"><h3>Data-quality observations</h3><ul>${evidence.dataQuality.issues.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></section>
    <section class="q-verify-score-grid">${scoreCard('Strategy Quality',evidence.scores.strategyQuality,{detail:QELLY_VERIFY_METHODOLOGY.scoreDisclosure.strategyQuality})}${scoreCard('Robustness',evidence.scores.robustness,{detail:QELLY_VERIFY_METHODOLOGY.scoreDisclosure.robustness})}${scoreCard('Overfitting Risk',evidence.scores.overfittingRisk,{inverted:true,detail:QELLY_VERIFY_METHODOLOGY.scoreDisclosure.overfittingRisk})}</section>
    <section id="qv-performance" class="q-verify-metrics" aria-label="Strategy evidence metrics"><article><span>Net P&amp;L</span><strong>${number(performance.netProfit)}</strong><small>Uploaded P&amp;L units</small></article><article><span>Expectancy</span><strong>${number(performance.expectancy)}</strong><small>Average per trade</small></article><article><span>Profit factor</span><strong>${performance.profitFactor==null?'∞':number(performance.profitFactor)}</strong><small>Gross profit ÷ gross loss</small></article><article><span>Win rate</span><strong>${percent(performance.winRate)}</strong><small>${evidence.sample.wins} wins · ${evidence.sample.losses} losses</small></article><article><span>Max drawdown</span><strong>${number(performance.maxDrawdown)}</strong><small>Observed P&amp;L drawdown</small></article><article><span>Stress drawdown</span><strong>${number(evidence.sequenceStress.stressMaxDrawdown)}</strong><small>95th-percentile reordered sequence</small></article><article><span>Payoff ratio</span><strong>${number(performance.payoffRatio)}</strong><small>Average win ÷ average loss</small></article><article><span>Top-3 concentration</span><strong>${percent(performance.topThreeConcentration)}</strong><small>Share of absolute outcome</small></article></section>
    ${mt5Report?`<section id="qv-mt5" aria-label="MT5 realized-deal analytics">${renderMt5ClosedDealEvidence(mt5Report)}</section>`:''}
    <section id="qv-risk" class="q-verify-analysis-grid"><article class="q-verify-panel"><p class="q-verify-kicker">Capital discipline · HEURISTIC</p><h3>Constrained Kelly research range</h3><div class="q-verify-allocation"><strong>${percent(allocation.constrainedFractionalKellyLow)}–${percent(allocation.constrainedFractionalKellyHigh)}</strong><span>of capital per independent risk unit</span></div><dl><div><dt>Raw Kelly estimate</dt><dd>${percent(allocation.rawKelly)}</dd></div><div><dt>Default constraint</dt><dd>10%–25% of raw Kelly</dd></div><div><dt>Hard prototype cap</dt><dd>5%</dd></div></dl><p>${escapeHtml(allocation.boundary)}</p></article><article class="q-verify-panel"><p class="q-verify-kicker">Stability · HEURISTIC</p><h3>First half versus second half</h3><dl><div><dt>First-half expectancy</dt><dd>${number(performance.firstHalfExpectancy)}</dd></div><div><dt>Second-half expectancy</dt><dd>${number(performance.secondHalfExpectancy)}</dd></div><div><dt>Observed loss streak</dt><dd>${performance.longestLosingStreak}</dd></div><div><dt>95% sequence loss streak</dt><dd>${evidence.sequenceStress.stressLosingStreak}</dd></div></dl><p>${escapeHtml(evidence.internalStability.boundary)}</p></article></section>
    <section class="q-verify-evidence-grid"><article><p class="q-verify-kicker">Critical warnings</p><h3>What requires attention</h3><ul>${evidence.warnings.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></article><article><p class="q-verify-kicker">Failure conditions</p><h3>What blocks stronger interpretation</h3><ul>${evidence.failureConditions.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></article></section>
    <section id="qv-coverage" class="q-verify-coverage"><article><p class="q-verify-kicker">Evidence coverage</p><h3>Computed and heuristic outputs</h3>${stateList(evidence.evidenceCoverage.computed)}</article><article><p class="q-verify-kicker">Evidence gaps</p><h3>Explicitly not assessed</h3>${stateList(evidence.evidenceCoverage.notAssessed)}</article></section>
    <section id="qv-provenance" class="q-verify-provenance"><div><p class="q-verify-kicker">Reproducibility</p><h3>Evidence provenance</h3><dl><div><dt>Input fingerprint</dt><dd><code>${escapeHtml(evidence.source.fingerprint.algorithm)}:${escapeHtml(evidence.source.fingerprint.value)}</code></dd></div><div><dt>Report schema</dt><dd>${escapeHtml(evidence.schema)}</dd></div><div><dt>Methodology</dt><dd>${escapeHtml(evidence.methodologyVersion)}</dd></div><div><dt>Engine</dt><dd>${escapeHtml(evidence.engineVersion)}</dd></div><div><dt>Generated</dt><dd>${escapeHtml(evidence.generatedAt)}</dd></div></dl></div><aside><strong>Interpretation boundary</strong><p>${escapeHtml(evidence.executiveSummary.conclusionBoundary)}</p><a href="#/qelly-verify?view=methodology">Open complete methodology</a></aside></section>
    ${validation.invalidExamples.length?`<details class="q-verify-invalid"><summary>Review rejected rows</summary><ol>${validation.invalidExamples.map(item=>`<li>Row ${item.row}: ${escapeHtml(item.reason)}</li>`).join('')}</ol></details>`:''}
    <footer class="q-verify-report__footer"><strong>Human validation remains required.</strong><span>Numerical reproducibility does not prove external validity, live readiness or future performance.</span></footer>
  </section>`;
}

function methodologyMarkup(){
  const methodology=QELLY_VERIFY_METHODOLOGY;
  return `<section class="q-verify-page q-methodology-page" data-qelly-methodology-surface><header class="q-verify-hero"><div class="q-verify-hero__copy"><p class="q-verify-kicker">Evidence · Public methodology</p><h1>Every conclusion needs an evidence state.</h1><p>${escapeHtml(methodology.purpose)}</p><div class="q-verify-flow"><span>COMPUTED</span><i>·</i><span>HEURISTIC</span><i>·</i><span>NOT ASSESSED</span><i>·</i><span>BOUNDARY</span></div></div><aside class="q-verify-boundary"><strong>${escapeHtml(methodology.version)}</strong><p>Versioned methodology for the local Qelly Verify prototype.</p><dl><div><dt>Report schema</dt><dd>${escapeHtml(QELLY_VERIFY_REPORT_SCHEMA)}</dd></div><div><dt>Personalized advice</dt><dd>None</dd></div><div><dt>Execution</dt><dd>Disabled</dd></div></dl></aside></header>
    <section class="q-methodology-principles"><p class="q-verify-kicker">Governing principles</p><h2>Evidence before prediction</h2><ol>${methodology.governingPrinciples.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ol></section>
    <section class="q-methodology-classes">${methodology.evidenceClasses.map(entry=>`<article><span class="q-verify-state is-${entry.state}">${escapeHtml(entry.label)}</span><p>${escapeHtml(entry.description)}</p></article>`).join('')}</section>
    <section class="q-methodology-modules"><header><p class="q-verify-kicker">Current modules</p><h2>What the prototype calculates</h2></header>${methodology.modules.map(entry=>`<article id="method-${entry.id}"><div><span class="q-verify-state is-${entry.state}">${escapeHtml(entry.state.toUpperCase())}</span><h3>${escapeHtml(entry.label)}</h3><p>${escapeHtml(entry.description)}</p></div><ul>${entry.limitations.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></article>`).join('')}</section>
    <section class="q-methodology-not-assessed"><header><p class="q-verify-kicker">Evidence gaps</p><h2>What Qelly does not infer</h2><p>These areas remain unavailable until the required independent data and validation design are supplied.</p></header>${stateList(methodology.notAssessed.map(entry=>({state:'NOT ASSESSED',label:entry.label,detail:entry.description})))}</section>
    <section class="q-methodology-scores"><p class="q-verify-kicker">Score disclosure</p><h2>Transparent prototype weights</h2><dl><div><dt>Strategy Quality</dt><dd>${escapeHtml(methodology.scoreDisclosure.strategyQuality)}</dd></div><div><dt>Robustness</dt><dd>${escapeHtml(methodology.scoreDisclosure.robustness)}</dd></div><div><dt>Overfitting Risk</dt><dd>${escapeHtml(methodology.scoreDisclosure.overfittingRisk)}</dd></div></dl></section>
    <section class="q-verify-provenance"><div><p class="q-verify-kicker">Reproducibility</p><h3>Versioned evidence packages</h3><ul>${Object.values(methodology.reproducibility).map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></div><aside><strong>Use the methodology</strong><p>Generate a local report, inspect every unassessed area and export the versioned evidence package.</p><a class="q-button q-button--primary" href="#/qelly-verify">Analyze a strategy</a></aside></section></section>`;
}

function bind(){
  main?.querySelectorAll('[data-mt5-compare-file]').forEach(input=>input.addEventListener('change',()=>{const file=input.files?.[0];if(file)loadComparisonFile(file,input.dataset.mt5CompareFile);}));
  main?.querySelector('[data-mt5-compare-reset]')?.addEventListener('click',()=>{comparison={A:null,B:null};comparisonError='';comparisonGeneration.A++;comparisonGeneration.B++;renderVerify();});
  main?.querySelector('[data-mt5-compare-export]')?.addEventListener('click',()=>{if(comparison.A&&comparison.B){const result=compareMt5ClosedDealReports(comparison.A.report,comparison.B.report);download('qelly-mt5-comparison-share-safe.json',JSON.stringify(result,null,2),'application/json');}});
  const input=main?.querySelector('[data-verify-file]');const dropzone=main?.querySelector('[data-verify-dropzone]');
  input?.addEventListener('change',()=>{const file=input.files?.[0];if(file)analyzeFile(file);});dropzone?.addEventListener('dragover',event=>{event.preventDefault();dropzone.classList.add('is-dragging');});dropzone?.addEventListener('dragleave',()=>dropzone.classList.remove('is-dragging'));dropzone?.addEventListener('drop',event=>{event.preventDefault();dropzone.classList.remove('is-dragging');const file=event.dataTransfer?.files?.[0];if(file)analyzeFile(file);});
  main?.querySelector('[data-verify-sample]')?.addEventListener('click',()=>analyzeText(sampleTradeCsv(),'Qelly governed strategy sample.csv'));main?.querySelector('[data-verify-download-sample]')?.addEventListener('click',()=>download('qelly-verify-sample.csv',sampleTradeCsv(),'text/csv'));main?.querySelector('[data-verify-reset]')?.addEventListener('click',()=>{current=null;renderVerify();});main?.querySelector('[data-verify-export]')?.addEventListener('click',()=>{if(!current?.evidence&&!current?.mt5Report)return;const documentBody=current.evidence?(current.mt5Report?{...current.evidence,mt5ClosedDealAnalysis:current.mt5Report,mt5ObservedDiagnostics:buildMt5ObservedDiagnostics(current.mt5Report)}:current.evidence):{schema:'qelly.mt5.limited-sample/1.0',sourceName:current.sourceName,mt5ClosedDealAnalysis:current.mt5Report,mt5ObservedDiagnostics:buildMt5ObservedDiagnostics(current.mt5Report)};const suffix=current.evidence?.reportId||'observed-closing-deals';download(`qelly-strategy-evidence-${suffix}.json`,JSON.stringify(documentBody,null,2),'application/json');});main?.querySelector('[data-verify-print]')?.addEventListener('click',()=>window.print());
}

async function loadComparisonFile(file,slot){
 if(!['A','B'].includes(slot))return;
 if(file.size>MAX_FILE_BYTES){++comparisonGeneration[slot];comparison[slot]=null;comparisonError='Report '+slot+': 5 MB limit exceeded.';renderVerify();return;}
 const ext=file.name.toLowerCase().split('.').pop();
 if(!['html','htm','xlsx'].includes(ext)){++comparisonGeneration[slot];comparison[slot]=null;comparisonError='Report '+slot+': choose MT5 HTML or XLSX.';renderVerify();return;}
 const generation=++comparisonGeneration[slot];
 comparisonError='Reading Report '+slot+' locally…';
 const status=main?.querySelector('[data-mt5-compare-status]');if(status)status.textContent=comparisonError;
 try{
  const bytes=ext==='xlsx'?new Uint8Array(await file.arrayBuffer()):await file.text();
  const parsed=ext==='xlsx'?await parseMt5Xlsx(bytes,{maxRows:MT5_REPORT_LIMITS.rows}):parseMt5Html(bytes,{maxRows:MT5_REPORT_LIMITS.rows});
  const report=analyzeMt5ClosedDeals(parsed.trades,parsed.validation);
  if(comparisonGeneration[slot]!==generation)return;
  comparison[slot]={name:String(file.name).slice(0,140),report};comparisonError='';
 }catch(error){
  if(comparisonGeneration[slot]!==generation)return;
  comparison[slot]=null;comparisonError='Report '+slot+': '+String(error?.message||'Unsupported MT5 Deals report').slice(0,250);
 }
 renderVerify();
}
async function analyzeFile(file){
  const status=main?.querySelector('[data-verify-status]');if(!file)return;
  if(file.size>MAX_FILE_BYTES){if(status)status.textContent='File rejected: the 5 MB local-analysis limit was exceeded.';return;}
  const extension=file.name.toLowerCase().split('.').pop();
  const format=extension==='xlsx'?'mt5-xlsx':['htm','html'].includes(extension)?'mt5-html':['csv','txt'].includes(extension)?'csv':null;
  if(!format){if(status)status.textContent='Unsupported file type. Choose MT5 XLSX, MT5 HTML or trade CSV.';return;}
  if(status)status.textContent=`Reading ${file.name} locally…`;
  main?.setAttribute('aria-busy','true');
  try{
    const source=format==='mt5-xlsx'?new Uint8Array(await file.arrayBuffer()):await file.text();
    await analyzeText(source,file.name,format);
  }catch(error){renderError(error,file.name);}
  finally{main?.setAttribute('aria-busy','false');}
}
async function analyzeText(sourceText,sourceName,format='csv'){
  await new Promise(resolve=>setTimeout(resolve,0));
  try{
    const parsed=format==='mt5-html'?parseMt5Html(sourceText,{maxRows:MT5_REPORT_LIMITS.rows})
      :format==='mt5-xlsx'?await parseMt5Xlsx(sourceText,{maxRows:MT5_REPORT_LIMITS.rows})
      :parseTradeCsv(sourceText);
    const mt5Report=parsed.validation.mt5?analyzeMt5ClosedDeals(parsed.trades,parsed.validation):null;
    // The general heuristic engine has a 5-deal minimum and bounded MT5
    // resampling window. Show local, descriptive MT5 evidence outside it.
    const generalEngineEligible=!mt5Report||(parsed.trades.length>=5&&parsed.trades.length<=5000);
    const analysis=generalEngineEligible?analyzeTrades(parsed.trades,{sourceName}):null;
    const evidence=analysis?await composeStrategyEvidenceReport({analysis,validation:parsed.validation,sourceText,sourceName}):null;
    current={validation:parsed.validation,evidence,mt5Report,sourceName};
    renderVerify();
  }catch(error){renderError(error,sourceName);}
}
function renderError(error,sourceName){current=null;renderVerify();const status=main?.querySelector('[data-verify-status]');if(status){status.classList.add('is-error');status.textContent=`${sourceName}: ${error?.message||'The file could not be analyzed.'}`;}}

export function renderVerify(){
  if(!main)return;
  main.dataset.qellyVerifyOwner='true';
  document.documentElement.dataset.qellyVerifySubview='qelly-verify';
  main.setAttribute('aria-busy','false');
  if(current?.mt5Report)ensureMt5Styles();
  ensureComparisonStyles();
  main.innerHTML=verifyShell(current?.evidence,current?.validation,current?.evidence?.source?.name||current?.sourceName,current?.mt5Report);
  bind();
  applyV53VerifyCanonical();
  document.title='Qelly Verify · Qelly Intelligence';
  main.focus({preventScroll:true});
}
export function renderMethodology(){
  if(!main)return;
  main.dataset.qellyVerifyOwner='methodology';
  document.documentElement.dataset.qellyVerifySubview='methodology';
  main.setAttribute('aria-busy','false');
  main.innerHTML=methodologyMarkup();
  document.title='Qelly Evidence Methodology · Qelly Intelligence';
  main.focus({preventScroll:true});
}
export function resetVerifyState(){current=null;comparison={A:null,B:null};comparisonError='';comparisonGeneration.A++;comparisonGeneration.B++;}
window.QellyVerify=Object.freeze({render:renderVerify,renderMethodology,reset:resetVerifyState,analyzeTrades,parseTradeCsv,sampleTradeCsv,composeStrategyEvidenceReport,methodology:QELLY_VERIFY_METHODOLOGY});
