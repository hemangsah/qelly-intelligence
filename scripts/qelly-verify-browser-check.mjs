import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const baseUrl=String(process.env.QELLY_VERIFY_BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const output=path.resolve(process.env.QELLY_VERIFY_EVIDENCE_DIR||'dist/qelly-verify-browser');
await mkdir(output,{recursive:true});

async function inspect({name,viewport,reducedMotion='no-preference'}){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport,reducedMotion,serviceWorkers:'block',acceptDownloads:false});
  const page=await context.newPage();
  const pageErrors=[];
  const consoleErrors=[];
  page.on('pageerror',error=>pageErrors.push({name:error.name,message:error.message}));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  const response=await page.goto(`${baseUrl}/#/market?view=qelly-verify`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('[data-qelly-verify-surface]',{state:'visible',timeout:30000});
  const analysisRequests=[];
  const observe=request=>{if(request.method()!=='GET'&&request.method()!=='HEAD')analysisRequests.push({method:request.method(),url:request.url()});};
  page.on('request',observe);
  await page.locator('[data-verify-sample]').click();
  await page.waitForSelector('.q-verify-report',{state:'visible',timeout:15000});
  await page.waitForTimeout(250);
  page.off('request',observe);
  const evidence=await page.evaluate(()=>{
    const scoreValues=[...document.querySelectorAll('.q-verify-score strong')].map(node=>Number(node.textContent));
    const main=document.querySelector('#main');
    const report=document.querySelector('.q-verify-report');
    const body=document.body;
    return {
      appReady:document.documentElement.dataset.appReady||null,
      heading:document.querySelector('.q-verify-hero h1')?.textContent?.trim()||null,
      flow:[...document.querySelectorAll('.q-verify-flow span')].map(node=>node.textContent.trim()),
      reportVisible:Boolean(report),
      scoreValues,
      metricCount:document.querySelectorAll('.q-verify-metrics article').length,
      warningCount:document.querySelectorAll('.q-verify-evidence-grid li').length,
      exportAvailable:Boolean(document.querySelector('[data-verify-export]')),
      localBoundary:document.querySelector('.q-verify-boundary')?.textContent?.replace(/\s+/g,' ').trim()||null,
      mainBusy:main?.getAttribute('aria-busy')||null,
      horizontalOverflow:body.scrollWidth>document.documentElement.clientWidth+1
    };
  });
  await page.screenshot({path:path.join(output,`${name}.png`),fullPage:true});
  await browser.close();
  return {name,viewport,reducedMotion,navigationStatus:response?.status()??null,evidence,pageErrors,consoleErrors,analysisRequests};
}

const results=[
  await inspect({name:'desktop',viewport:{width:1440,height:1000}}),
  await inspect({name:'mobile-reduced-motion',viewport:{width:375,height:812},reducedMotion:'reduce'})
];
await writeFile(path.join(output,'evidence.json'),JSON.stringify({baseUrl,results},null,2));

for(const result of results){
  if(result.navigationStatus!==200)throw new Error(`${result.name}_navigation_${result.navigationStatus}`);
  if(result.evidence.appReady!=='true')throw new Error(`${result.name}_app_not_ready`);
  if(result.evidence.heading!=='Put your strategy through evidence, not belief.')throw new Error(`${result.name}_heading_invalid`);
  if(result.evidence.flow.join('>')!=='Upload>Validate>Analyze>Decide')throw new Error(`${result.name}_workflow_invalid`);
  if(!result.evidence.reportVisible||result.evidence.scoreValues.length!==3||result.evidence.scoreValues.some(value=>!Number.isFinite(value)||value<0||value>100))throw new Error(`${result.name}_scores_invalid`);
  if(result.evidence.metricCount<8||result.evidence.warningCount<2||!result.evidence.exportAvailable)throw new Error(`${result.name}_report_incomplete`);
  if(!/processed in this browser|not uploaded/i.test(result.evidence.localBoundary||''))throw new Error(`${result.name}_local_boundary_missing`);
  if(result.evidence.horizontalOverflow)throw new Error(`${result.name}_horizontal_overflow`);
  if(result.pageErrors.length)throw new Error(`${result.name}_page_errors_${JSON.stringify(result.pageErrors)}`);
  const relevantConsole=result.consoleErrors.filter(message=>!/favicon|Failed to load resource.*404/i.test(message));
  if(relevantConsole.length)throw new Error(`${result.name}_console_errors_${JSON.stringify(relevantConsole)}`);
  if(result.analysisRequests.length)throw new Error(`${result.name}_analysis_network_requests_${JSON.stringify(result.analysisRequests)}`);
}

console.log(JSON.stringify({status:'qelly-verify-browser-accepted',output,viewports:results.map(result=>result.name)}));
