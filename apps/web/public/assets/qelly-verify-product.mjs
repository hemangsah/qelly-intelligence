import {analyzeTrades,parseTradeCsv,sampleTradeCsv} from './qelly-verify-engine.mjs';

const main=document.getElementById('main');
const MAX_FILE_BYTES=5*1024*1024;
let rendering=false;
let scheduled=false;
let current=null;

const escapeHtml=(value)=>String(value??'').replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const routeState=()=>{
  const raw=location.hash.replace(/^#\/?/,'');
  const [path,query='']=raw.split('?');
  return {route:path.split('/')[0]||'market',params:new URLSearchParams(query)};
};
const verifyActive=()=>{const {route,params}=routeState();return route==='market'&&params.get('view')==='qelly-verify';};
const number=(value,digits=2)=>value==null?'—':new Intl.NumberFormat(undefined,{maximumFractionDigits:digits}).format(Number(value));
const percent=(value)=>value==null?'—':`${number(value)}%`;
const download=(name,content,type)=>{const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),500);};
const scoreTone=(value,inverted=false)=>{
  const score=inverted?100-Number(value):Number(value);
  return score>=70?'strong':score>=45?'mixed':'weak';
};

function installNavigation(){
  const targets=[document.querySelector('.q-product-nav'),document.querySelector('.q-recovery-header nav')].filter(Boolean);
  for(const nav of targets){
    if(nav.querySelector('[data-qelly-verify-link]'))continue;
    const link=document.createElement('a');
    link.href='#/market?view=qelly-verify';
    link.dataset.qellyVerifyLink='true';
    link.textContent='Verify';
    const first=nav.querySelector('a');
    if(first)nav.insertBefore(link,first);else nav.append(link);
  }
  document.querySelectorAll('[data-qelly-verify-link]').forEach(link=>link.classList.toggle('is-active',verifyActive()));
}

function enhanceHomepage(){
  if(verifyActive())return;
  const {route,params}=routeState();
  if(route!=='market'||params.size)return;
  const home=main?.querySelector('.q-market-home');
  const hero=home?.querySelector('.q-market-hero');
  if(!home||!hero||home.dataset.qellyVerifyAligned==='true')return;
  home.dataset.qellyVerifyAligned='true';
  const kicker=hero.querySelector('.q-market-kicker');
  const heading=hero.querySelector('h1');
  const description=hero.querySelector('.q-market-hero__copy>p:not(.q-market-kicker)');
  const actions=hero.querySelector('.q-market-hero__actions');
  if(kicker)kicker.textContent='Qelly Verify · Strategy intelligence';
  if(heading)heading.textContent='Quantitative intelligence for disciplined market decisions.';
  if(description)description.textContent='Validate strategy evidence, measure drawdown and robustness, stress trade sequences and estimate a constrained capital-allocation range through one auditable decision workflow.';
  if(actions){
    actions.innerHTML='<a class="q-button q-button--primary" href="#/market?view=qelly-verify">Analyze a strategy</a><a class="q-button q-button--secondary" href="./support.html">Request a demo</a>';
  }
  const search=hero.querySelector('.q-market-hero__search');
  if(search)search.hidden=true;
  const capabilities=document.createElement('section');
  capabilities.className='q-verify-home-capabilities';
  capabilities.setAttribute('aria-label','Qelly decision-intelligence capabilities');
  capabilities.innerHTML=`
    <article><span>01</span><h2>Validate the edge</h2><p>Inspect expectancy, profit concentration, sample sufficiency and internal stability.</p></article>
    <article><span>02</span><h2>Understand the regime</h2><p>Connect strategy evidence to changing volatility, liquidity and market context as the platform develops.</p></article>
    <article><span>03</span><h2>Allocate capital</h2><p>Use constrained fractional-Kelly research ranges rather than aggressive full-Kelly exposure.</p></article>
    <article><span>04</span><h2>Control portfolio risk</h2><p>Make drawdown, sequence risk, limitations and critical warnings visible before deployment.</p></article>`;
  hero.insertAdjacentElement('afterend',capabilities);
  document.title='Qelly Intelligence · Quantitative decision intelligence';
}

function shell(report=null,validation=null,sourceName='No file selected'){
  return `<section class="q-verify-page" data-qelly-verify-surface>
    <header class="q-verify-hero">
      <div class="q-verify-hero__copy"><p class="q-verify-kicker">Qelly Verify · Strategy Intelligence Report</p><h1>Put your strategy through evidence, not belief.</h1><p>Upload an MT5 trade-history export or structured trade CSV. Qelly validates the rows, measures performance and drawdown, tests trade-order sensitivity and produces an auditable prototype report.</p><div class="q-verify-flow" aria-label="Qelly Verify workflow"><span>Upload</span><i>→</i><span>Validate</span><i>→</i><span>Analyze</span><i>→</i><span>Decide</span></div></div>
      <aside class="q-verify-boundary"><strong>Local-only prototype</strong><p>Your file is processed in this browser and is not uploaded. No live AI model, order execution or personalized financial recommendation is active.</p><dl><div><dt>Data transfer</dt><dd>None</dd></div><div><dt>Method</dt><dd>Deterministic</dd></div><div><dt>Execution</dt><dd>Disabled</dd></div></dl></aside>
    </header>
    <section class="q-verify-workspace">
      <article class="q-verify-upload-card">
        <div><p class="q-verify-kicker">Step 1 · Strategy evidence</p><h2>Upload a trade CSV</h2><p>Required: a numeric <code>pnl</code>, <code>profit</code> or <code>net_profit</code> column. Optional fields include symbol, side, entry time, exit time and fees.</p></div>
        <label class="q-verify-dropzone" data-verify-dropzone><input type="file" accept=".csv,.txt,text/csv,text/plain" data-verify-file><span class="q-verify-dropzone__icon" aria-hidden="true">⇧</span><strong>Choose or drop a CSV file</strong><small>Maximum 5 MB · up to 100,000 trade rows · processed locally</small></label>
        <div class="q-verify-upload-actions"><button type="button" class="q-button q-button--secondary" data-verify-sample>Run governed sample</button><button type="button" class="q-button q-button--ghost" data-verify-download-sample>Download sample CSV</button>${report?'<button type="button" class="q-button q-button--ghost" data-verify-reset>Clear report</button>':''}</div>
        <p class="q-verify-file-state" role="status" aria-live="polite" data-verify-status>${escapeHtml(sourceName)}</p>
      </article>
      ${reportMarkup(report,validation)}
    </section>
  </section>`;
}

function scoreCard(label,entry,{inverted=false,detail='' }={}){
  if(!entry)return'';
  const tone=scoreTone(entry.value,inverted);
  return `<article class="q-verify-score is-${tone}"><div><span>${escapeHtml(label)}</span><strong>${number(entry.value,0)}</strong><small>${escapeHtml(entry.band)}</small></div><div class="q-verify-score__track" aria-label="${escapeHtml(label)} ${number(entry.value,0)} out of 100"><i style="width:${Math.max(0,Math.min(100,entry.value))}%"></i></div><p>${escapeHtml(detail)}</p></article>`;
}

function reportMarkup(report,validation){
  if(!report)return `<section class="q-verify-empty"><div aria-hidden="true">Q</div><h2>Your evidence report will appear here</h2><p>Start with a CSV or the governed sample. Qelly will not fabricate missing trades, market regimes or execution assumptions.</p></section>`;
  const performance=report.performance;
  const allocation=report.allocation;
  return `<section class="q-verify-report" aria-live="polite">
    <header class="q-verify-report__head"><div><p class="q-verify-kicker">Generated evidence package</p><h2>${escapeHtml(report.sourceName)}</h2><p>${report.sample.trades} valid trades · ${validation.invalidRows} rejected row${validation.invalidRows===1?'':'s'} · ${escapeHtml(validation.detectedPnlColumn)} used as P&amp;L</p></div><div><span class="q-verify-truth">${escapeHtml(report.truthState)}</span><button type="button" class="q-button q-button--primary" data-verify-export>Export evidence JSON</button></div></header>
    <section class="q-verify-validation"><div><strong>${validation.validRows}</strong><span>Valid rows</span></div><div><strong>${validation.invalidRows}</strong><span>Rejected rows</span></div><div><strong>${escapeHtml(validation.delimiter)}</strong><span>Delimiter</span></div><div><strong>${Object.keys(validation.detectedFields).length}</strong><span>Fields mapped</span></div></section>
    <section class="q-verify-score-grid">
      ${scoreCard('Strategy Quality',report.scores.strategyQuality,{detail:'Composite of expectancy, profit factor, drawdown, consistency and sample sufficiency.'})}
      ${scoreCard('Robustness',report.scores.robustness,{detail:'Internal evidence score using sample size, half-sample stability, concentration and losing streak.'})}
      ${scoreCard('Overfitting Risk',report.scores.overfittingRisk,{inverted:true,detail:'Heuristic warning score. Higher means the uploaded sample requires more external validation.'})}
    </section>
    <section class="q-verify-metrics" aria-label="Strategy evidence metrics">
      <article><span>Net P&amp;L</span><strong>${number(performance.netProfit)}</strong><small>Uploaded P&amp;L units</small></article>
      <article><span>Expectancy</span><strong>${number(performance.expectancy)}</strong><small>Average per trade</small></article>
      <article><span>Profit factor</span><strong>${performance.profitFactor==null?'∞':number(performance.profitFactor)}</strong><small>Gross profit ÷ gross loss</small></article>
      <article><span>Win rate</span><strong>${percent(performance.winRate)}</strong><small>${report.sample.wins} wins · ${report.sample.losses} losses</small></article>
      <article><span>Max drawdown</span><strong>${number(performance.maxDrawdown)}</strong><small>Observed P&amp;L drawdown</small></article>
      <article><span>Stress drawdown</span><strong>${number(report.stress.stressMaxDrawdown)}</strong><small>95th-percentile reordered sequence</small></article>
      <article><span>Payoff ratio</span><strong>${number(performance.payoffRatio)}</strong><small>Average win ÷ average loss</small></article>
      <article><span>Top-3 concentration</span><strong>${percent(performance.topThreeConcentration)}</strong><small>Share of absolute outcome</small></article>
    </section>
    <section class="q-verify-analysis-grid">
      <article class="q-verify-panel"><p class="q-verify-kicker">Capital discipline</p><h3>Constrained Kelly research range</h3><div class="q-verify-allocation"><strong>${percent(allocation.constrainedFractionalKellyLow)}–${percent(allocation.constrainedFractionalKellyHigh)}</strong><span>of capital per independent risk unit</span></div><dl><div><dt>Raw Kelly estimate</dt><dd>${percent(allocation.rawKelly)}</dd></div><div><dt>Default constraint</dt><dd>10%–25% of raw Kelly</dd></div><div><dt>Hard prototype cap</dt><dd>5%</dd></div></dl><p>This is a sample-derived research range, not a personalized position-size recommendation.</p></article>
      <article class="q-verify-panel"><p class="q-verify-kicker">Stability evidence</p><h3>First half versus second half</h3><dl><div><dt>First-half expectancy</dt><dd>${number(performance.firstHalfExpectancy)}</dd></div><div><dt>Second-half expectancy</dt><dd>${number(performance.secondHalfExpectancy)}</dd></div><div><dt>Longest observed loss streak</dt><dd>${performance.longestLosingStreak}</dd></div><div><dt>95% sequence loss streak</dt><dd>${report.stress.stressLosingStreak}</dd></div></dl><p>Internal stability is necessary but cannot replace out-of-sample or walk-forward validation.</p></article>
    </section>
    <section class="q-verify-evidence-grid"><article><p class="q-verify-kicker">Critical warnings</p><h3>What requires attention</h3><ul>${report.warnings.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></article><article><p class="q-verify-kicker">Method limitations</p><h3>What Qelly cannot conclude</h3><ul>${report.limitations.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></article></section>
    ${validation.invalidExamples.length?`<details class="q-verify-invalid"><summary>Review rejected rows</summary><ol>${validation.invalidExamples.map(item=>`<li>Row ${item.row}: ${escapeHtml(item.reason)}</li>`).join('')}</ol></details>`:''}
    <footer class="q-verify-report__footer"><strong>Prototype deployment posture: human validation required.</strong><span>Next production layers: out-of-sample testing, walk-forward analysis, Monte Carlo distribution stress, transaction-cost sensitivity and strategy-version comparison.</span></footer>
  </section>`;
}

function bind(){
  const input=main?.querySelector('[data-verify-file]');
  const dropzone=main?.querySelector('[data-verify-dropzone]');
  input?.addEventListener('change',()=>{const file=input.files?.[0];if(file)analyzeFile(file);});
  dropzone?.addEventListener('dragover',event=>{event.preventDefault();dropzone.classList.add('is-dragging');});
  dropzone?.addEventListener('dragleave',()=>dropzone.classList.remove('is-dragging'));
  dropzone?.addEventListener('drop',event=>{event.preventDefault();dropzone.classList.remove('is-dragging');const file=event.dataTransfer?.files?.[0];if(file)analyzeFile(file);});
  main?.querySelector('[data-verify-sample]')?.addEventListener('click',()=>analyzeText(sampleTradeCsv(),'Qelly governed strategy sample.csv'));
  main?.querySelector('[data-verify-download-sample]')?.addEventListener('click',()=>download('qelly-verify-sample.csv',sampleTradeCsv(),'text/csv'));
  main?.querySelector('[data-verify-reset]')?.addEventListener('click',()=>{current=null;renderVerify();});
  main?.querySelector('[data-verify-export]')?.addEventListener('click',()=>{
    if(!current)return;
    download(`qelly-verify-evidence-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({validation:current.validation,report:current.report},null,2),'application/json');
  });
}

async function analyzeFile(file){
  const status=main?.querySelector('[data-verify-status]');
  if(!file)return;
  if(file.size>MAX_FILE_BYTES){if(status)status.textContent='File rejected: the 5 MB local-analysis limit was exceeded.';return;}
  if(status)status.textContent=`Reading ${file.name} locally…`;
  main?.setAttribute('aria-busy','true');
  try{await analyzeText(await file.text(),file.name);}
  catch(error){renderError(error,file.name);}
  finally{main?.setAttribute('aria-busy','false');}
}

async function analyzeText(text,sourceName){
  await new Promise(resolve=>setTimeout(resolve,0));
  try{
    const parsed=parseTradeCsv(text);
    const report=analyzeTrades(parsed.trades,{sourceName});
    current={validation:parsed.validation,report};
    renderVerify();
  }catch(error){renderError(error,sourceName);}
}

function renderError(error,sourceName){
  current=null;
  renderVerify();
  const status=main?.querySelector('[data-verify-status]');
  if(status){status.classList.add('is-error');status.textContent=`${sourceName}: ${error?.message||'The file could not be analyzed.'}`;}
}

export function renderVerify(){
  if(!main)return;
  rendering=true;
  main.dataset.qellyVerifyOwner='true';
  main.setAttribute('aria-busy','false');
  main.innerHTML=shell(current?.report,current?.validation,current?.report?.sourceName);
  bind();
  document.title='Qelly Verify · Strategy Intelligence Report';
  installNavigation();
  main.focus({preventScroll:true});
  rendering=false;
}

function reconcile(){
  scheduled=false;
  if(rendering||!main)return;
  installNavigation();
  if(verifyActive()){
    if(main.dataset.qellyVerifyOwner!=='true')renderVerify();
    return;
  }
  if(main.dataset.qellyVerifyOwner==='true'){
    delete main.dataset.qellyVerifyOwner;
    current=null;
    return;
  }
  enhanceHomepage();
}

function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(reconcile);}

installNavigation();
schedule();
if(main)new MutationObserver(schedule).observe(main,{childList:true,subtree:true});
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('hashchange',schedule);
window.addEventListener('pageshow',schedule);
for(const delay of [80,250,700,1600])setTimeout(schedule,delay);
window.QellyVerify=Object.freeze({render:renderVerify,analyzeTrades,parseTradeCsv,sampleTradeCsv});
