import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const baseUrl=String(process.env.QELLY_VERIFY_BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const output=path.resolve(process.env.QELLY_VERIFY_EVIDENCE_DIR||'dist/qelly-verify-browser');
await mkdir(output,{recursive:true});

const generatedAt='2026-08-06T00:00:00.000Z';
const apiFixture=pathname=>{
  if(pathname==='/api/v1/config')return {auth:{authenticated:false},defaultRoute:'market',csrf:{token:''},capabilities:{authentication:false,cloudSync:false,liveProviders:false,protectedWrites:false}};
  if(pathname==='/api/v1/auth/status')return {authenticated:false};
  if(pathname==='/api/v1/market/overview')return {market:[],providers:{},referenceRates:{count:0,state:'simulated'},generatedAt};
  if(pathname==='/api/v1/public/markets/overview')return {items:[],kpis:[],breadth:{advancers:0,decliners:0},providerStatus:{provider:'Browser fixture',status:'simulated',lastSuccessAt:null,cacheEntries:0},mode:'simulated',truthBoundary:'Deterministic browser acceptance fixture.',generatedAt};
  if(pathname.includes('/candles'))return {points:[],source:{attribution:'Browser fixture',observedAt:generatedAt,mode:'simulated'}};
  if(pathname==='/api/v1/public/providers')return {providers:[]};
  return {};
};

async function routeDiagnostics(page){return page.evaluate(()=>{const main=document.getElementById('main');return {href:location.href,hash:location.hash,readyState:document.readyState,appReady:document.documentElement.dataset.appReady||null,bootstrapState:window.__QELLY_VERIFY_ROUTE__?JSON.parse(JSON.stringify(window.__QELLY_VERIFY_ROUTE__)):null,verifyApi:typeof window.QellyVerify?.render,methodologyApi:typeof window.QellyVerify?.renderMethodology,mainOwner:main?.dataset.qellyVerifyOwner||null,mainBusy:main?.getAttribute('aria-busy')||null,mainText:main?.textContent?.replace(/\s+/g,' ').trim().slice(0,2000)||null};});}

async function inspect({name,viewport,reducedMotion='no-preference'}){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport,reducedMotion,serviceWorkers:'block',acceptDownloads:false});
  const page=await context.newPage();
  await page.route('https://api.preview.invalid/**',async route=>{const url=new URL(route.request().url());await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(apiFixture(url.pathname))});});
  const pageErrors=[];const consoleErrors=[];
  page.on('pageerror',error=>pageErrors.push({name:error.name,message:error.message,stack:error.stack||null}));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});

  /* Prove the old market alias still normalizes, but require the canonical V5.3
     formula workbench to own the resulting Qelly Verify page. */
  const response=await page.goto(`${baseUrl}/#/market?view=qelly-verify`,{waitUntil:'domcontentloaded',timeout:45000});
  try{
    await page.waitForURL(/#\/qelly-verify(?:[/?#]|$)/,{timeout:30000});
    await page.waitForSelector('[data-qelly-verify-surface]',{state:'visible',timeout:30000});
    await page.waitForSelector('[data-v53-verify-workbench="accepted-lock"]',{state:'visible',timeout:30000});
  }catch(error){
    const diagnostics=await routeDiagnostics(page);
    await page.screenshot({path:path.join(output,`${name}-route-failure.png`),fullPage:true});
    await writeFile(path.join(output,`${name}-route-failure.json`),JSON.stringify({diagnostics,pageErrors,consoleErrors,error:{name:error.name,message:error.message}},null,2));
    await browser.close();
    throw Object.assign(new Error(`${name}_verify_route_unavailable_${JSON.stringify(diagnostics)}`),{cause:error});
  }

  const canonical=await page.evaluate(()=>({
    hash:location.hash,
    appReady:document.documentElement.dataset.appReady||null,
    heading:document.querySelector('.q-verify-hero h1')?.textContent?.trim()||null,
    workbenchVisible:Boolean(document.querySelector('[data-v53-verify-workbench="accepted-lock"]')),
    formulaSelector:Boolean(document.querySelector('[data-v53-verify-formula]')),
    kpiCount:document.querySelectorAll('.q-v53-verify-kpis article').length,
    evidenceCount:document.querySelectorAll('.q-v53-verify-evidence>div').length,
    inspectorVisible:Boolean(document.querySelector('.q-v53-verify-inspector')),
    strategySecondary:Boolean(document.querySelector('.q-v53-strategy-tools')),
    horizontalOverflow:document.body.scrollWidth>document.documentElement.clientWidth+1
  }));

  /* Preserve and exercise the historical local CSV analyzer as a secondary
     evidence tool. It must not own the primary accepted-lock surface. */
  await page.locator('.q-v53-strategy-tools>summary').click();
  const analysisRequests=[];const observe=request=>{if(request.method()!=='GET'&&request.method()!=='HEAD')analysisRequests.push({method:request.method(),url:request.url()});};
  page.on('request',observe);
  await page.locator('[data-verify-sample]').click();
  await page.waitForSelector('.q-verify-report',{state:'visible',timeout:15000});
  await page.waitForTimeout(250);
  page.off('request',observe);

  const report=await page.evaluate(()=>({
    flow:[...document.querySelectorAll('.q-verify-flow span')].map(node=>node.textContent.trim()),
    reportVisible:Boolean(document.querySelector('.q-verify-report')),
    scoreValues:[...document.querySelectorAll('.q-verify-score strong')].map(node=>Number(node.textContent)),
    metricCount:document.querySelectorAll('.q-verify-metrics article').length,
    warningCount:document.querySelectorAll('.q-verify-evidence-grid li').length,
    failureConditionCount:document.querySelectorAll('.q-verify-evidence-grid article:nth-child(2) li').length,
    coverageComputed:document.querySelectorAll('#qv-coverage article:first-child .q-verify-state-list li').length,
    coverageNotAssessed:document.querySelectorAll('#qv-coverage article:last-child .q-verify-state-list li').length,
    provenance:document.querySelector('#qv-provenance')?.textContent?.replace(/\s+/g,' ').trim()||null,
    exportAvailable:Boolean(document.querySelector('[data-verify-export]')),
    printAvailable:Boolean(document.querySelector('[data-verify-print]')),
    localBoundary:document.querySelector('.q-verify-boundary')?.textContent?.replace(/\s+/g,' ').trim()||null,
    horizontalOverflow:document.body.scrollWidth>document.documentElement.clientWidth+1
  }));
  await page.screenshot({path:path.join(output,`${name}-report.png`),fullPage:true});

  await page.goto(`${baseUrl}/#/market?view=evidence-methodology`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('[data-qelly-methodology-surface]',{state:'visible',timeout:30000});
  const methodology=await page.evaluate(()=>({
    heading:document.querySelector('.q-methodology-page .q-verify-hero h1')?.textContent?.trim()||null,
    classCount:document.querySelectorAll('.q-methodology-classes article').length,
    moduleCount:document.querySelectorAll('.q-methodology-modules>article').length,
    notAssessedCount:document.querySelectorAll('.q-methodology-not-assessed .q-verify-state-list li').length,
    scoreDisclosureCount:document.querySelectorAll('.q-methodology-scores dl div').length,
    versionText:document.querySelector('.q-methodology-page .q-verify-boundary')?.textContent||'',
    horizontalOverflow:document.body.scrollWidth>document.documentElement.clientWidth+1
  }));
  await page.screenshot({path:path.join(output,`${name}-methodology.png`),fullPage:true});
  await browser.close();
  return {name,viewport,reducedMotion,navigationStatus:response?.status()??null,canonical,report,methodology,pageErrors,consoleErrors,analysisRequests};
}

const results=[await inspect({name:'desktop',viewport:{width:1440,height:1000}}),await inspect({name:'mobile-reduced-motion',viewport:{width:375,height:812},reducedMotion:'reduce'})];
await writeFile(path.join(output,'evidence.json'),JSON.stringify({baseUrl,results},null,2));

for(const result of results){
  if(result.navigationStatus!==200)throw new Error(`${result.name}_navigation_${result.navigationStatus}`);
  if(result.canonical.hash!=='#/qelly-verify')throw new Error(`${result.name}_alias_not_normalized_${result.canonical.hash}`);
  if(result.canonical.appReady!=='true')throw new Error(`${result.name}_app_not_ready`);
  if(result.canonical.heading!=='Formula validation, assumptions, sensitivity and reproducibility.')throw new Error(`${result.name}_canonical_heading_invalid`);
  if(!result.canonical.workbenchVisible||!result.canonical.formulaSelector||result.canonical.kpiCount<6||result.canonical.evidenceCount<6||!result.canonical.inspectorVisible)throw new Error(`${result.name}_canonical_workbench_incomplete`);
  if(!result.canonical.strategySecondary)throw new Error(`${result.name}_secondary_strategy_tools_missing`);
  if(result.canonical.horizontalOverflow)throw new Error(`${result.name}_canonical_horizontal_overflow`);
  if(result.report.flow.join('>')!=='Upload>Validate>Analyze>Decide')throw new Error(`${result.name}_workflow_invalid`);
  if(!result.report.reportVisible||result.report.scoreValues.length!==3||result.report.scoreValues.some(value=>!Number.isFinite(value)||value<0||value>100))throw new Error(`${result.name}_scores_invalid`);
  if(result.report.metricCount<8||result.report.warningCount<2||result.report.failureConditionCount<1)throw new Error(`${result.name}_report_incomplete`);
  if(result.report.coverageComputed!==6||result.report.coverageNotAssessed!==8)throw new Error(`${result.name}_coverage_invalid`);
  if(!/input fingerprint|report schema|methodology|engine/i.test(result.report.provenance||''))throw new Error(`${result.name}_provenance_missing`);
  if(!result.report.exportAvailable||!result.report.printAvailable)throw new Error(`${result.name}_export_controls_missing`);
  if(!/processed in this browser|not uploaded/i.test(result.report.localBoundary||''))throw new Error(`${result.name}_local_boundary_missing`);
  if(result.report.horizontalOverflow)throw new Error(`${result.name}_report_horizontal_overflow`);
  if(result.methodology.heading!=='Every conclusion needs an evidence state.')throw new Error(`${result.name}_methodology_heading_invalid`);
  if(result.methodology.classCount!==4||result.methodology.moduleCount!==6||result.methodology.notAssessedCount!==8||result.methodology.scoreDisclosureCount!==3)throw new Error(`${result.name}_methodology_incomplete`);
  if(!/qelly-verify-methodology\/1\.0\.0/i.test(result.methodology.versionText))throw new Error(`${result.name}_methodology_version_missing`);
  if(result.methodology.horizontalOverflow)throw new Error(`${result.name}_methodology_horizontal_overflow`);
  if(result.pageErrors.length)throw new Error(`${result.name}_page_errors_${JSON.stringify(result.pageErrors)}`);
  const relevantConsole=result.consoleErrors.filter(message=>!/favicon|Failed to load resource.*404/i.test(message));
  if(relevantConsole.length)throw new Error(`${result.name}_console_errors_${JSON.stringify(relevantConsole)}`);
  if(result.analysisRequests.length)throw new Error(`${result.name}_analysis_network_requests_${JSON.stringify(result.analysisRequests)}`);
}

console.log(JSON.stringify({status:'qelly-evidence-system-browser-accepted',output,viewports:results.map(result=>result.name)}));
