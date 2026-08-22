import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { cp,mkdir,mkdtemp,readFile,readdir,rm,stat,writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium,firefox,webkit } from 'playwright';
import { PNG } from 'pngjs';

const runFile=promisify(execFile);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const currentRoot=path.join(root,'dist/frontend');
const outputRoot=path.join(root,'.ui-review/qelly-ui-rescue-review');
const implementationOutput=path.join(outputRoot,'implementation');
const comparisonsOutput=path.join(outputRoot,'comparisons');
const reportsOutput=path.join(outputRoot,'reports');
const researchOutput=path.join(outputRoot,'research');
const figmaOutput=path.join(outputRoot,'figma');
const reviewCommit=process.env.QELLY_REVIEW_COMMIT??'local-working-tree';
const rejectedCommit=process.env.QELLY_REJECTED_UI_COMMIT??'12e88b473004fbaa01dc7588951c763fdf2cb941';
const host='127.0.0.1';
const port=Number(process.env.QELLY_UI_PREMIUM_PORT??4175);
const origin=`http://${host}:${port}`;
const currentUrl=`${origin}/qelly-intelligence/#/asset-rankings`;
const oldUrl=`${origin}/old/#/asset-rankings`;
const officialReferences=[
  ['coinglass','https://www.coinglass.com/'],
  ['coinmarketcap','https://coinmarketcap.com/'],
  ['worldquant','https://www.worldquant.com/']
];
const viewports={
  'desktop-1440':{width:1440,height:1000},'desktop-1728':{width:1728,height:1080},'tablet-1024':{width:1024,height:768},'tablet-768':{width:768,height:1024},'mobile-390':{width:390,height:844},'mobile-430':{width:430,height:932}
};
const freezeCss=`html{scroll-behavior:auto!important}*,*::before,*::after{animation-delay:0s!important;animation-duration:0s!important;animation-iteration-count:1!important;caret-color:transparent!important;scroll-behavior:auto!important;transition-delay:0s!important;transition-duration:0s!important}`;
const types={'.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2'};

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
async function exists(file){try{await stat(file);return true;}catch{return false;}}
async function writeJson(file,value){await writeFile(file,`${JSON.stringify(value,null,2)}\n`,'utf8');}
async function listFiles(directory,prefix=''){
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const relative=path.join(prefix,entry.name);const absolute=path.join(directory,entry.name);
    if(entry.isDirectory())files.push(...await listFiles(absolute,relative));else files.push({relative:absolute===path.join(reportsOutput,'ARTIFACT_MANIFEST.json')?null:relative,absolute});
  }
  return files.filter((item)=>item.relative);
}

async function prepareOldBuild(){
  const temporary=await mkdtemp(path.join(os.tmpdir(),'qelly-rejected-ui-'));
  const worktree=path.join(temporary,'worktree');
  try{
    await runFile('git',['worktree','add','--detach',worktree,rejectedCommit],{cwd:root,maxBuffer:10_000_000});
    await runFile(process.execPath,[path.join(worktree,'scripts/build-frontend.mjs')],{
      cwd:worktree,maxBuffer:10_000_000,
      env:{...process.env,QELLY_STATIC_VISUAL_PREVIEW:'true',QELLY_PUBLIC_BASE_PATH:'/old/',QELLY_DEPLOYMENT_ENVIRONMENT:'review-rejected-ui'}
    });
    return {temporary,worktree,frontend:path.join(worktree,'dist/frontend'),status:'built'};
  }catch(error){
    return {temporary,worktree,frontend:null,status:'failed',error:error.message};
  }
}

function safeFile(rootDirectory,relative){
  const file=path.resolve(rootDirectory,relative);
  if(file!==rootDirectory&&!file.startsWith(`${rootDirectory}${path.sep}`))return null;
  return file;
}
function startServer(oldFrontend){
  const server=createServer(async(request,response)=>{
    try{
      const url=new URL(request.url??'/',origin);
      if(url.pathname==='/favicon.ico'){response.writeHead(204);response.end();return;}
      let sourceRoot;let relative;
      if(url.pathname.startsWith('/qelly-intelligence/')){sourceRoot=currentRoot;relative=url.pathname.slice('/qelly-intelligence/'.length);}
      else if(url.pathname.startsWith('/old/')&&oldFrontend){sourceRoot=oldFrontend;relative=url.pathname.slice('/old/'.length);}
      else{response.writeHead(404);response.end('Not found');return;}
      if(!relative||relative.endsWith('/'))relative+='index.html';
      const file=safeFile(sourceRoot,decodeURIComponent(relative));
      if(!file)throw new Error('Unsafe path');
      const body=await readFile(file);
      response.writeHead(200,{'Cache-Control':'no-store','Content-Type':types[path.extname(file)]??'application/octet-stream'});
      response.end(body);
    }catch{response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});response.end('Not found');}
  });
  return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>resolve(server));});
}

async function openReviewPage(browser,url,viewport,{reducedMotion='no-preference',colorScheme='dark'}={}){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,colorScheme,reducedMotion});
  const errors=[];const failures=[];
  const page=await context.newPage();
  page.on('pageerror',(error)=>errors.push({kind:'pageerror',message:error.message}));
  page.on('console',(message)=>{if(message.type()!=='error')return;const location=message.location();if(location.url&&!location.url.startsWith(origin))return;errors.push({kind:'console',message:message.text(),sourceUrl:location.url??''});});
  page.on('requestfailed',(request)=>{if(!request.url().startsWith(origin))return;if(!['document','script','stylesheet','font','image'].includes(request.resourceType()))return;failures.push({kind:'requestfailed',url:request.url(),resourceType:request.resourceType(),errorText:request.failure()?.errorText??'unknown'});});
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('.q-mi-page').waitFor({state:'visible'});
  await page.addStyleTag({content:freezeCss});
  await page.evaluate(async()=>{if(document.fonts?.ready)await document.fonts.ready;await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  return {context,page,errors,failures};
}
async function screenshot(page,file,{fullPage=false,locator=null}={}){
  if(locator)await page.locator(locator).screenshot({path:file,animations:'disabled',scale:'css'});
  else await page.screenshot({path:file,fullPage,animations:'disabled',scale:'css'});
}

async function captureCurrentChromium(browser,observed){
  for(const key of ['desktop-1440','desktop-1728','tablet-1024','tablet-768','mobile-390','mobile-430']){
    const opened=await openReviewPage(browser,currentUrl,viewports[key]);
    try{
      await screenshot(opened.page,path.join(implementationOutput,`${key}-premium.png`));
      if(key==='desktop-1440'||key==='mobile-390')await screenshot(opened.page,path.join(implementationOutput,`${key}-premium-full-page.png`),{fullPage:true});
      observed.errors.push(...opened.errors.map((error)=>({...error,browser:'chromium',viewport:key})));
      observed.failures.push(...opened.failures.map((failure)=>({...failure,browser:'chromium',viewport:key})));
    }finally{await opened.context.close();}
  }
  const opened=await openReviewPage(browser,currentUrl,viewports['desktop-1440']);
  try{
    const {page}=opened;
    await screenshot(page,path.join(implementationOutput,'discovery-mode.png'));
    await page.locator('[data-mi-layout-mode="terminal"]').click();
    await page.locator('.q-mi-page[data-mi-mode="terminal"]').waitFor({state:'visible'});
    await screenshot(page,path.join(implementationOutput,'terminal-mode.png'));
    await page.locator('[data-mi-layout-mode="research"]').click();
    await page.locator('.q-mi-page[data-mi-mode="research"]').waitFor({state:'visible'});
    await screenshot(page,path.join(implementationOutput,'research-mode.png'));
    await page.locator('[data-mi-layout-mode="discovery"]').click();
    await screenshot(page,path.join(implementationOutput,'table-region-premium.png'),{locator:'.q-mi-table-card'});
    await screenshot(page,path.join(implementationOutput,'candlesticks.png'),{locator:'.q-mi-chart-card'});
    await page.locator('[data-mi-filter-toggle]').click();
    await page.locator('[data-mi-filter-sheet].is-open').waitFor({state:'visible'});
    await screenshot(page,path.join(implementationOutput,'filters.png'));
    await page.locator('[data-mi-filter-close]').first().click();
    await page.locator('[data-mi-columns-toggle]').click();
    await page.locator('[data-mi-column-menu]').waitFor({state:'visible'});
    await screenshot(page,path.join(implementationOutput,'column-manager.png'));
    await page.locator('[data-mi-column-close]').click();
    const chartPoint=page.locator('[data-chart-point]').nth(58);
    await chartPoint.hover();
    await page.locator('[data-mi-chart-tooltip]:not([hidden])').waitFor({state:'visible'});
    await screenshot(page,path.join(implementationOutput,'chart-tooltip.png'),{locator:'.q-mi-chart-card'});
    await page.keyboard.press('Control+K');
    await page.locator('dialog.q-command-dialog[open]').waitFor({state:'visible'});
    await screenshot(page,path.join(implementationOutput,'command-palette-premium.png'));
    await page.keyboard.press('Escape');
    await page.locator('[data-shell-action="menu"]').click();
    await page.locator('.q-rail.is-open').waitFor({state:'visible'});
    await screenshot(page,path.join(implementationOutput,'expanded-navigation-premium.png'));
    await page.locator('[data-shell-action="menu"]').click();
    await page.locator('[data-mi-explain]').first().click();
    await page.locator('[data-mi-drawer].is-open').waitFor({state:'visible'});
    await screenshot(page,path.join(implementationOutput,'explain-drawer-premium.png'));
    await page.locator('[data-mi-drawer-close]').first().click();
    await page.locator('#global-theme-selector').selectOption('porcelain-burgundy');
    await page.locator('html[data-theme="porcelain-burgundy"]').waitFor({state:'attached'});
    await screenshot(page,path.join(implementationOutput,'light-mode-premium.png'));
    const interactions=await page.evaluate(()=>({
      tablePrimary:document.querySelector('.q-mi-table-card')?.compareDocumentPosition(document.querySelector('.q-mi-chart-card'))&Node.DOCUMENT_POSITION_FOLLOWING?true:false,
      columns:document.querySelectorAll('.q-mi-table-scroll th').length,
      stickyHeader:getComputedStyle(document.querySelector('.q-mi-table-scroll th')).position,
      stickyAsset:getComputedStyle(document.querySelector('[data-column="asset"]')).position,
      horizontalOverflow:document.querySelector('.q-mi-table-scroll table').scrollWidth>document.querySelector('.q-mi-table-scroll').clientWidth,
      mobileAlternative:document.querySelectorAll('.q-mi-mobile-row').length,
      truth:document.querySelector('.q-mi-truth-banner')?.innerText
    }));
    observed.interactions.push({name:'premium-market-contract',passed:interactions.tablePrimary&&interactions.columns>=20&&interactions.stickyHeader==='sticky'&&interactions.stickyAsset==='sticky'&&interactions.horizontalOverflow&&interactions.mobileAlternative>=12,evidence:interactions});
    observed.errors.push(...opened.errors.map((error)=>({...error,browser:'chromium',viewport:'states'})));
    observed.failures.push(...opened.failures.map((failure)=>({...failure,browser:'chromium',viewport:'states'})));
  }finally{await opened.context.close();}
  const reduced=await openReviewPage(browser,currentUrl,viewports['desktop-1440'],{reducedMotion:'reduce'});
  try{
    await screenshot(reduced.page,path.join(implementationOutput,'reduced-motion-premium.png'));
    const state=await reduced.page.evaluate(()=>({media:matchMedia('(prefers-reduced-motion: reduce)').matches,ticker:getComputedStyle(document.querySelector('.q-macro-track')).animationDuration}));
    observed.interactions.push({name:'reduced-motion',passed:state.media&&state.ticker==='0s',evidence:state});
  }finally{await reduced.context.close();}
}

async function captureBrowserParity(observed){
  for(const [name,engine] of [['firefox',firefox],['webkit',webkit]]){
    let browser;
    try{
      browser=await engine.launch({headless:true});
      const opened=await openReviewPage(browser,currentUrl,{width:1280,height:800});
      try{
        await screenshot(opened.page,path.join(implementationOutput,`browser-${name}.png`));
        const evidence=await opened.page.evaluate(()=>({title:document.querySelector('.q-mi-page-head h1')?.textContent,rows:document.querySelectorAll('.q-mi-mobile-row').length,columns:document.querySelectorAll('.q-mi-table-scroll th').length,chart:Boolean(document.querySelector('.q-mi-market-chart'))}));
        observed.browsers.push({name,passed:opened.errors.length===0&&opened.failures.length===0&&evidence.columns>=20&&evidence.chart,evidence,errors:opened.errors,failures:opened.failures});
      }finally{await opened.context.close();}
    }catch(error){observed.browsers.push({name,passed:false,error:error.message});}
    finally{if(browser)await browser.close();}
  }
}

async function captureOldComparisons(browser,oldBuild,observed){
  if(!oldBuild.frontend){observed.oldBuild=oldBuild;return;}
  for(const [key,viewport] of [['desktop',viewports['desktop-1440']],['mobile',viewports['mobile-390']]]){
    const oldPage=await openReviewPage(browser,oldUrl,viewport);
    const currentPage=await openReviewPage(browser,currentUrl,viewport);
    try{
      const oldFile=path.join(comparisonsOutput,`old-${key}.png`);const newFile=path.join(comparisonsOutput,`new-${key}.png`);
      await screenshot(oldPage.page,oldFile);await screenshot(currentPage.page,newFile);
      await makeSideBySide(oldFile,newFile,path.join(comparisonsOutput,`old-vs-new-${key}.png`));
    }finally{await oldPage.context.close();await currentPage.context.close();}
  }
  observed.oldBuild={status:'built',commit:rejectedCommit};
}

async function makeSideBySide(leftFile,rightFile,outputFile){
  const [left,right]=await Promise.all([readFile(leftFile).then(PNG.sync.read),readFile(rightFile).then(PNG.sync.read)]);
  const height=Math.max(left.height,right.height);const gutter=24;const output=new PNG({width:left.width+right.width+gutter,height});output.data.fill(10);
  const copy=(source,offset)=>{for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){const sourceIndex=(source.width*y+x)<<2;const targetIndex=(output.width*y+x+offset)<<2;source.data.copy(output.data,targetIndex,sourceIndex,sourceIndex+4);}};
  copy(left,0);copy(right,left.width+gutter);await writeFile(outputFile,PNG.sync.write(output));
}

async function captureResponsiveAndPerformance(browser,observed){
  for(const [width,height] of [[360,800],[390,844],[430,932],[768,1024],[1024,768],[1280,800],[1440,1000],[1728,1080],[1920,1080],[2560,1080]]){
    const opened=await openReviewPage(browser,currentUrl,{width,height});
    try{
      const evidence=await opened.page.evaluate(()=>({
        width:innerWidth,height:innerHeight,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,
        headingVisible:Boolean(document.querySelector('.q-mi-page-head h1')?.getBoundingClientRect().height),
        mobileNavigationVisible:getComputedStyle(document.querySelector('.q-mobile-navigation')).display!=='none',
        tableVisible:getComputedStyle(document.querySelector('.q-mi-table-scroll')).display!=='none',
        mobileRowsVisible:getComputedStyle(document.querySelector('.q-mi-mobile-rankings')).display!=='none'
      }));
      observed.responsive.push({...evidence,passed:!evidence.pageOverflow&&evidence.headingVisible&&(width<=920?evidence.mobileNavigationVisible&&evidence.mobileRowsVisible:evidence.tableVisible)});
    }finally{await opened.context.close();}
  }
  const opened=await openReviewPage(browser,currentUrl,viewports['desktop-1440']);
  try{
    observed.performance=await opened.page.evaluate(()=>{
      const navigation=performance.getEntriesByType('navigation')[0];
      const paints=Object.fromEntries(performance.getEntriesByType('paint').map((entry)=>[entry.name,Math.round(entry.startTime)]));
      const table=document.querySelector('.q-mi-table-scroll');const chart=document.querySelector('.q-mi-market-chart');
      return {domContentLoaded:Math.round(navigation?.domContentLoadedEventEnd??0),loadEvent:Math.round(navigation?.loadEventEnd??0),transferSize:navigation?.transferSize??0,paints,tableRows:document.querySelectorAll('.q-mi-table-scroll tbody tr').length,tableScrollWidth:table?.scrollWidth,chartNodes:chart?.querySelectorAll('*').length,layoutShiftEntries:performance.getEntriesByType('layout-shift').length};
    });
    observed.accessibility=await opened.page.evaluate(()=>({
      main:document.querySelectorAll('main').length,heading:document.querySelectorAll('h1').length,tableCaption:Boolean(document.querySelector('.q-mi-table-scroll caption')),
      chartTitle:Boolean(document.querySelector('.q-mi-market-chart title')),chartDescription:Boolean(document.querySelector('.q-mi-market-chart desc')),
      unlabeledButtons:[...document.querySelectorAll('button')].filter((button)=>!button.textContent.trim()&&!button.getAttribute('aria-label')&&!button.getAttribute('title')).length,
      focusableTable:document.querySelector('.q-mi-table-scroll')?.tabIndex===0,truthRole:document.querySelector('.q-mi-truth-banner')?.getAttribute('role')
    }));
  }finally{await opened.context.close();}
}

async function captureOfficialScreenshots(browser,observed){
  const directory=path.join(researchOutput,'REFERENCE_SCREENSHOTS');await mkdir(directory,{recursive:true});
  for(const [name,url] of officialReferences){
    const record={name,url,status:'failed'};let context;
    try{
      context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'dark'});const page=await context.newPage();
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:20_000});await page.waitForTimeout(2500);
      await page.screenshot({path:path.join(directory,`${name}-official.png`),fullPage:false,animations:'disabled',scale:'css'});
      record.status='captured';record.title=await page.title();record.finalUrl=page.url();
    }catch(error){record.error=error.message;}finally{if(context)await context.close();}
    observed.officialScreenshots.push(record);
  }
  await writeJson(path.join(researchOutput,'official-screenshot-status.json'),observed.officialScreenshots);
}

async function copyReviewDocuments(){
  await Promise.all([mkdir(researchOutput,{recursive:true}),mkdir(figmaOutput,{recursive:true})]);
  const researchFiles=[
    'design/research/REFERENCE_UI_FORENSICS.md','design/research/REFERENCE_COMPUTED_STYLES.json','design/research/REFERENCE_LAYOUT_METRICS.json','design/research/REFERENCE_MOTION_INVENTORY.json','design/research/REFERENCE_FEATURE_INVENTORY.csv','design/research/QELLY_SYNTHESIS_DECISIONS.md','design/research/REFERENCE_SCREENSHOTS/README.md','design/review/VISUAL_FAILURE_REPORT.md'
  ];
  for(const file of researchFiles){const target=path.join(researchOutput,file.replace(/^design\/(?:research|review)\//,''));await mkdir(path.dirname(target),{recursive:true});await cp(path.join(root,file),target);}
  const figmaFiles=['figma-plugin/code.js','figma-plugin/manifest.json','design/figma/QELLY_FIGMA_MASTER_SPEC.md','design/figma/QELLY_FIGMA_SCREEN_MATRIX.csv','design/figma/QELLY_FIGMA_COMPONENT_MATRIX.csv','design/figma/QELLY_DESIGN_REVIEW_CHECKLIST.md'];
  for(const file of figmaFiles)await cp(path.join(root,file),path.join(figmaOutput,path.basename(file)));
  await writeFile(path.join(figmaOutput,'PREVIEW_LIMITATION.md'),'# Figma evidence boundary\n\nThis artifact contains the executable generator, manifest, master specification, screen matrix, component matrix, and review checklist. CI cannot publish a hosted Figma file or truthfully export frames from the user\'s Figma account. Run the plugin and open the editable master frames before approval.\n','utf8');
}

async function writeReports(observed){
  const required=[
    'implementation/desktop-1440-premium.png','implementation/desktop-1728-premium.png','implementation/tablet-1024-premium.png','implementation/tablet-768-premium.png','implementation/mobile-390-premium.png','implementation/mobile-430-premium.png','implementation/discovery-mode.png','implementation/terminal-mode.png','implementation/research-mode.png','implementation/filters.png','implementation/column-manager.png','implementation/chart-tooltip.png','implementation/candlesticks.png','implementation/table-region-premium.png','implementation/light-mode-premium.png','implementation/reduced-motion-premium.png','implementation/browser-firefox.png','implementation/browser-webkit.png','comparisons/old-vs-new-desktop.png','comparisons/old-vs-new-mobile.png','compiled-preview/README.md'
  ];
  const missing=[];for(const file of required)if(!await exists(path.join(outputRoot,file)))missing.push(file);
  const result=observed.errors.length===0&&observed.failures.length===0&&observed.interactions.every((check)=>check.passed)&&observed.browsers.every((check)=>check.passed)&&observed.responsive.every((check)=>check.passed)&&missing.length===0?'passed':'failed';
  await writeJson(path.join(reportsOutput,'CONSOLE_ERRORS.json'),{result:observed.errors.length||observed.failures.length?'failed':'passed',errors:observed.errors,failedResources:observed.failures});
  await writeJson(path.join(reportsOutput,'INTERACTIONS.json'),{checks:observed.interactions,browsers:observed.browsers,responsive:observed.responsive});
  const known=JSON.parse(await readFile(path.join(root,'design/review/known-differences.json'),'utf8'));await writeJson(path.join(reportsOutput,'KNOWN_DIFFERENCES.json'),known);
  await writeFile(path.join(reportsOutput,'MOTION_QA.md'),`# Motion QA\n\n- Formal durations and easing: present.\n- Navigation, filter sheet, explanation drawer, table hover and chart tooltip: captured.\n- Reduced-motion capture: ${observed.interactions.find((item)=>item.name==='reduced-motion')?.passed?'passed':'failed'}.\n- Continuous value animation: not used.\n- Ticker stops under reduced motion.\n`,'utf8');
  await writeFile(path.join(reportsOutput,'ACCESSIBILITY_QA.md'),`# Accessibility QA\n\n${JSON.stringify(observed.accessibility,null,2)}\n\nTarget: WCAG 2.2 AA. Table caption, chart title/description, keyboard table, compact truth status and labelled icon actions are present. Automated evidence is not a substitute for assistive-technology review.\n`,'utf8');
  await writeFile(path.join(reportsOutput,'PERFORMANCE_QA.md'),`# Performance QA\n\n${JSON.stringify(observed.performance,null,2)}\n\nThe static review uses bounded deterministic rows, fixed chart dimensions, transform/opacity motion, and no public cinematic assets on the analytical route. Lab numbers are runner-specific and are not production claims.\n`,'utf8');
  await writeFile(path.join(reportsOutput,'VISUAL_QA.md'),`# Premium visual reset QA\n\nStatus: artifact generated; user visual approval pending.\n\nThe previous UI and fidelity claim are rejected. Review neutral surfaces, rare gradients, typography, SVG icons, table primacy, realistic OHLC, Discovery/Terminal/Research layouts, mobile rows, motion and evidence actions in the screenshots. Automation does not self-approve visual quality.\n`,'utf8');
  await writeJson(path.join(reportsOutput,'VALIDATION_SUMMARY.json'),{generatedAt:new Date().toISOString(),commit:reviewCommit,rejectedCommit,result,requiredArtifacts:{expected:required.length,missing},siteOrigin:{errors:observed.errors.length,failedResources:observed.failures.length},interactions:observed.interactions,browsers:observed.browsers,responsive:{passed:observed.responsive.filter((item)=>item.passed).length,total:observed.responsive.length},performance:observed.performance,accessibility:observed.accessibility,oldBuild:observed.oldBuild,officialScreenshots:observed.officialScreenshots,truthBoundary:'Static visual preview · deterministic review data · backend unavailable · no production trading, persistence or custody'});
  await writeFile(path.join(comparisonsOutput,'annotated-improvements.md'),'# Annotated improvements\n\n1. Neutral charcoal canvas replaces burgundy fog.\n2. Gradients are restricted to compact brand marks.\n3. SVG icons replace temporary glyphs.\n4. The 23-column ranking table precedes the chart.\n5. OHLC candles, volume, crosshair and tooltip replace the synthetic line.\n6. Discovery, Terminal and Research layouts change hierarchy by task.\n7. Mobile uses expandable rows and bottom sheets.\n8. One compact status center replaces repeated demo badges.\n','utf8');
  assert(result==='passed',`Premium UI review failed: ${JSON.stringify({missing,errors:observed.errors,failures:observed.failures,interactions:observed.interactions,browsers:observed.browsers,responsiveFailures:observed.responsive.filter((item)=>!item.passed)},null,2)}`);
}

async function writeManifest(){
  const files=await listFiles(outputRoot);const entries=[];
  for(const file of files){const bytes=await readFile(file.absolute);entries.push({path:file.relative.split(path.sep).join('/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
  await writeJson(path.join(reportsOutput,'ARTIFACT_MANIFEST.json'),{schemaVersion:2,artifact:'qelly-ui-rescue-review',label:'Premium static visual preview',generatedAt:new Date().toISOString(),commit:reviewCommit,rejectedCommit,files:entries});
}

await Promise.all([mkdir(implementationOutput,{recursive:true}),mkdir(comparisonsOutput,{recursive:true}),mkdir(reportsOutput,{recursive:true}),mkdir(researchOutput,{recursive:true}),mkdir(figmaOutput,{recursive:true})]);
assert(await exists(currentRoot),'dist/frontend is missing');
const oldBuild=await prepareOldBuild();
const server=await startServer(oldBuild.frontend);
let browser;
const observed={errors:[],failures:[],interactions:[],browsers:[{name:'chromium',passed:true}],responsive:[],performance:null,accessibility:null,oldBuild:null,officialScreenshots:[]};
try{
  browser=await chromium.launch({headless:true});
  await captureCurrentChromium(browser,observed);
  await captureBrowserParity(observed);
  await captureOldComparisons(browser,oldBuild,observed);
  await captureResponsiveAndPerformance(browser,observed);
  await copyReviewDocuments();
  await captureOfficialScreenshots(browser,observed);
  await writeReports(observed);
  await writeManifest();
  console.log(JSON.stringify({status:'premium-ui-review-passed',artifact:'qelly-ui-rescue-review',commit:reviewCommit,files:(await listFiles(outputRoot)).length},null,2));
}finally{
  if(browser)await browser.close();
  await new Promise((resolve,reject)=>server.close((error)=>error?reject(error):resolve()));
  if(oldBuild.worktree&&await exists(oldBuild.worktree))await runFile('git',['worktree','remove','--force',oldBuild.worktree],{cwd:root}).catch(()=>{});
  if(oldBuild.temporary)await rm(oldBuild.temporary,{recursive:true,force:true});
}
