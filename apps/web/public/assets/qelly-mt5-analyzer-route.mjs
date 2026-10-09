/* Wave CZ: dedicated, browser-local MT5 closing-deal analyzer.
 * Reuses the audited QELLY Verify parser and metrics; does not persist raw files. */
import {ensureRouteStylesheet} from './route-stylesheet-readiness.mjs';
import {createLocalMt5Task} from './qelly-mt5-worker-client.mjs';
import {renderMt5ClosedDealEvidence} from './qelly-mt5-visuals.mjs';
import {compareMt5ClosedDealReports} from './qelly-mt5-comparison.mjs';
import {renderMt5Comparison} from './qelly-mt5-comparison-ui.mjs';
import {buildMt5ShareSafePackage,buildMt5ChatDraft} from './qelly-mt5-share-safe.mjs';
import {buildMt5LocalResearchNote} from './qelly-mt5-research-note.mjs';

const MAX_BYTES=5*1024*1024;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let owner=null;
let reports={A:null,B:null};
let errors={A:'',B:''};
let loading={A:false,B:false};
let generation={A:0,B:0};
const tasks={A:null,B:null};
const stylePaths=['./qelly-mt5-analyzer.css','./qelly-mt5-visuals.css','./qelly-mt5-comparison.css'];
function ensureStyles(){return Promise.all(stylePaths.map(path=>ensureRouteStylesheet(new URL(path+'?v=20261008-editorial1',import.meta.url).href,{attribute:'data-qelly-mt5-ready-'+path.split('/').pop().replaceAll('.','-'),value:'true'})));}

function download(name,payload){
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download=name;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),500);
}
function downloadMarkdown(name,text){
 const blob=new Blob([text],{type:'text/markdown;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download=name;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),500);
}
const slotStatus=slot=>loading[slot]?'Parsing and validating this file locally…':
 errors[slot]|| (reports[slot]?
  reports[slot].report.sample.deals+' validated closing deals · '+reports[slot].name:'No report selected');
function slotMarkup(slot){
 const value=reports[slot];
 return '<article class="q-mt5-route-upload" data-mt5-route-slot="'+slot+'">'+
 '<div class="q-mt5-route-upload-head"><span class="q-mt5-route-step">Report '+slot+'</span>'+
 '<strong>'+esc(slot==='A'?'Analyze your report':'Optional comparison report')+'</strong></div>'+
 '<label class="q-mt5-route-drop" data-mt5-route-drop="'+slot+'">'+
 '<span aria-hidden="true" class="q-mt5-route-upload-icon">⇧</span>'+
 '<strong>Browse or drop MT5 HTML / HTM / XLSX</strong>'+
 '<small>5 MB maximum · closing deals only · file never leaves this browser</small>'+
 '<input type="file" accept=".html,.htm,.xlsx,text/html,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-mt5-route-input="'+slot+'" aria-describedby="q-mt5-route-status-'+slot+'">'+
 '</label><p role="status" aria-live="polite" id="q-mt5-route-status-'+slot+'">'+esc(slotStatus(slot))+'</p>'+
 (value||loading[slot]?'<button type="button" data-mt5-route-clear="'+slot+'" class="q-mt5-route-clear">Clear Report '+slot+'</button>':'')+
 '</article>';
}
function mainMarkup(){
 const one=reports.A,other=reports.B,hasBoth=Boolean(one&&other);
 return '<section class="q-page q-mt5-route" data-mt5-analyzer-route>'+
 '<header class="q-mt5-route-hero"><div><p class="q-mt5-eyebrow">QELLY Tools · Deterministic local research</p>'+
 '<h1>MT5 Report Analyzer</h1><p>Understand observed results from MT5 closing-deal reports. Analyze one report, then optionally compare a second report without uploading either file.</p>'+
 '<div class="q-mt5-route-links"><a href="#/qelly-verify">QELLY Verify & CSV tools</a><a href="#/qelly-verify?view=methodology">Evidence methodology</a></div></div>'+
 '<aside><strong>Private by default</strong><p>HTML and XLSX are parsed as local data. No macros, scripts, network upload, account equity fabrication or trading execution.</p>'+
 '<small>Unverified: account currency, broker timezone, entry-side costs and external report authenticity.</small></aside></header>'+
 '<section class="q-mt5-route-grid" aria-label="Choose local MT5 reports">'+slotMarkup('A')+slotMarkup('B')+'</section>'+
 '<section class="q-mt5-route-controls"><button type="button" data-mt5-route-reset'+(!one&&!other&&!loading.A&&!loading.B?' disabled':'')+'>Clear both reports</button>'+
 '<button type="button" data-mt5-route-export'+(!one?' disabled':'')+'>Export share-safe analysis JSON</button>'+ 
 '<button type="button" data-mt5-route-note'+(!one?' disabled':'')+'>Download local research note (.md)</button>'+ 
 '<button type="button" data-mt5-route-chat'+(!one?' disabled':'')+'>Review aggregate findings in QELLY Chat</button></section>'+
 '<p class="q-mt5-route-share-note">Markdown research notes stay on this device and contain aggregate P&amp;L and allowed symbol labels. Review downloaded notes before sharing. Chat opens an editable draft containing only derived, user-supplied statistics. Nothing is sent by opening it. If you press Send, the summary is sent to QELLY Chat and may be retained in this browser session.</p>'+
 (one?'<section class="q-mt5-route-primary" aria-label="Primary MT5 report"><header><p class="q-mt5-route-step">Observed evidence</p><h2>'+esc(one.name)+'</h2></header>'+
 renderMt5ClosedDealEvidence(one.report,{id:'mt5-analyzer-primary'})+'</section>':
 '<section class="q-mt5-route-empty"><h2>Your MT5 analysis will appear here</h2>'+
 '<p>Start with an exported MT5 Deals report. Broker balance, equity, deposits and entry-side costs will remain unassessed unless independently verified.</p></section>')+
 (hasBoth?'<section class="q-mt5-route-pair">'+renderMt5Comparison(compareMt5ClosedDealReports(one.report,other.report))+'</section>':
 '<p class="q-mt5-route-pair-help">Add Report B to compare observed, sample-limited outcomes. Monetary differences remain withheld without verified compatible currencies.</p>')+
 '<footer>Research only. Uploaded reports and local analysis are cleared when you leave this route or reload the page.</footer></section>';
}
function render(){
 if(!owner||location.hash.split('?')[0]!=='#/mt5-report-analyzer')return;
 owner.dataset.qellyMt5Analyzer='active';
 owner.setAttribute('aria-busy','false');
 owner.innerHTML=mainMarkup();
 for(const input of owner.querySelectorAll('[data-mt5-route-input]')){
  input.addEventListener('change',()=>{const f=input.files?.[0];if(f)void importFile(f,input.dataset.mt5RouteInput);});
 }
 for(const drop of owner.querySelectorAll('[data-mt5-route-drop]')){
  drop.addEventListener('dragover',event=>{event.preventDefault();drop.classList.add('is-dragging');});
  drop.addEventListener('dragleave',()=>drop.classList.remove('is-dragging'));
  drop.addEventListener('drop',event=>{event.preventDefault();drop.classList.remove('is-dragging');
    const f=event.dataTransfer?.files?.[0];if(f)void importFile(f,drop.dataset.mt5RouteDrop);});
 }
 for(const button of owner.querySelectorAll('[data-mt5-route-clear]')){
  button.addEventListener('click',()=>clearSlot(button.dataset.mt5RouteClear));
 }
 owner.querySelector('[data-mt5-route-reset]')?.addEventListener('click',()=>{clearAll();render();});
 owner.querySelector('[data-mt5-route-export]')?.addEventListener('click',()=>{
  if(!reports.A)return;
  download('qelly-mt5-analyzer-share-safe.json',buildMt5ShareSafePackage(reports.A.report,reports.B?.report??null));
 });
 owner.querySelector('[data-mt5-route-note]')?.addEventListener('click',()=>{
  if(!reports.A)return;
  downloadMarkdown('qelly-mt5-research-note.md',buildMt5LocalResearchNote(reports.A.report,reports.B?.report??null));
 });
 owner.querySelector('[data-mt5-route-chat]')?.addEventListener('click',()=>{
  if(!reports.A)return;
  const prompt=buildMt5ChatDraft(reports.A.report,reports.B?.report??null);
  document.dispatchEvent(new CustomEvent('qelly:open-ai',{detail:{prompt,mode:'explain'}}));
 });
 document.title='MT5 Report Analyzer · Qelly Intelligence';
}
function clearSlot(slot){
 if(slot!=='A'&&slot!=='B')return;
 generation[slot]++;tasks[slot]?.cancel();tasks[slot]=null;reports[slot]=null;errors[slot]='';loading[slot]=false;
 render();
}
function clearAll(){
 for(const slot of ['A','B']){
  generation[slot]++;tasks[slot]?.cancel();tasks[slot]=null;reports[slot]=null;errors[slot]='';loading[slot]=false;
 }
}
async function importFile(file,slot){
 if(!owner||!['A','B'].includes(slot))return;
 const token=++generation[slot];
 tasks[slot]?.cancel();tasks[slot]=null;
 reports[slot]=null;errors[slot]='';loading[slot]=true;render();
 try{
  const extension=String(file.name||'').toLowerCase().split('.').pop();
  if(!['html','htm','xlsx'].includes(extension))throw new Error('Choose an HTML, HTM or XLSX MT5 Deals report.');
  if(!Number.isSafeInteger(file.size)||file.size<=0||file.size>MAX_BYTES)throw new Error('The file must be nonempty and no larger than 5 MB.');
  const mime=String(file.type||'');
  if(mime&&!['text/html','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream'].includes(mime))
    throw new Error('File format and MIME type do not agree with a supported MT5 export.');
  const source=new Uint8Array(await file.arrayBuffer());
  if(generation[slot]!==token||!owner)return;
  const task=createLocalMt5Task({source,format:extension==='xlsx'?'xlsx':'html'});
  tasks[slot]=task;
  const report=await task.promise;
  if(generation[slot]!==token||!owner)return;
  reports[slot]={name:String(file.name).slice(0,120),report};
 }catch(error){
  if(generation[slot]!==token||!owner)return;
  errors[slot]=String(error?.message||'Unsupported MT5 Deals report').slice(0,240);
 }finally{
  if(generation[slot]===token&&owner){tasks[slot]=null;loading[slot]=false;render();}
 }
}
export function resetMt5ReportAnalyzer(){
 clearAll();owner=null;
 if(window.__qellyMt5AnalyzerCleanup===resetMt5ReportAnalyzer)window.__qellyMt5AnalyzerCleanup=null;
}
export function renderMt5ReportAnalyzer(main){
 if(!main)throw new TypeError('An existing QELLY main region is required');
 if(owner&&owner!==main)resetMt5ReportAnalyzer();
 owner=main;
 window.__qellyMt5AnalyzerCleanup=resetMt5ReportAnalyzer;
 return ensureStyles().then(()=>{
  if(owner!==main||location.hash.split('?')[0]!=='#/mt5-report-analyzer')return;
  render();main.focus({preventScroll:true});
 });
}
