import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import {
  cp,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const frontendRoot=path.join(root,'dist/frontend');
const referenceRoot=path.join(root,'design/reference');
const referenceFile=path.join(referenceRoot,'QELLY_EXPECTED_FULL_UI_WORKING.html');
const outputRoot=path.join(root,'.ui-review/qelly-ui-rescue-review');
const implementationOutput=path.join(outputRoot,'implementation');
const referenceOutput=path.join(outputRoot,'reference');
const comparisonOutput=path.join(outputRoot,'comparisons');
const reportsOutput=path.join(outputRoot,'reports');
const compiledOutput=path.join(outputRoot,'compiled-preview');
const host='127.0.0.1';
const port=Number(process.env.QELLY_UI_REVIEW_PORT??4173);
const origin=`http://${host}:${port}`;
const implementationUrl=`${origin}/qelly-intelligence/#/asset-rankings`;
const referenceUrl=`${origin}/reference/QELLY_EXPECTED_FULL_UI_WORKING.html#markets`;
const reviewCommit=process.env.QELLY_REVIEW_COMMIT??'local-working-tree';

const viewports=[
  {key:'desktop-1440',width:1440,height:1000},
  {key:'tablet-1024',width:1024,height:768},
  {key:'tablet-768',width:768,height:1024},
  {key:'mobile-390',width:390,height:844}
];

const contentTypes={
  '.css':'text/css; charset=utf-8',
  '.html':'text/html; charset=utf-8',
  '.ico':'image/x-icon',
  '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8',
  '.png':'image/png',
  '.svg':'image/svg+xml',
  '.woff':'font/woff',
  '.woff2':'font/woff2'
};

const freezeCss=`
  html{scroll-behavior:auto!important}
  *,*::before,*::after{
    animation-delay:0s!important;
    animation-duration:0s!important;
    animation-iteration-count:1!important;
    caret-color:transparent!important;
    scroll-behavior:auto!important;
    transition-delay:0s!important;
    transition-duration:0s!important;
  }
`;

function assert(condition,message){
  if(!condition)throw new Error(message);
}

async function ensureInputs(){
  const [frontend,reference]=await Promise.all([stat(frontendRoot),stat(referenceFile)]);
  assert(frontend.isDirectory(),'dist/frontend is missing; build the static frontend first');
  assert(reference.isFile(),'Approved UI reference is missing');
  const builtReference=path.join(frontendRoot,'design/reference/QELLY_EXPECTED_FULL_UI_WORKING.html');
  try{
    await stat(builtReference);
    throw new Error('Approved UI reference must not be bundled in dist/frontend');
  }catch(error){
    if(error.code!=='ENOENT')throw error;
  }
}

async function prepareOutput(){
  await Promise.all([
    mkdir(implementationOutput,{recursive:true}),
    mkdir(referenceOutput,{recursive:true}),
    mkdir(comparisonOutput,{recursive:true}),
    mkdir(reportsOutput,{recursive:true}),
    mkdir(compiledOutput,{recursive:true})
  ]);
  await cp(frontendRoot,path.join(compiledOutput,'qelly-intelligence'),{recursive:true});
  await writeFile(path.join(compiledOutput,'README.md'),`# Qelly Static visual preview

This compiled review is frontend-only and contains deterministic demo observations. It has no connected backend, production trading, or persistent Qelly mutations.

Run \`node serve-preview.mjs\`, then open:

\`http://127.0.0.1:4173/qelly-intelligence/#/asset-rankings\`
`,'utf8');
  await writeFile(path.join(compiledOutput,'serve-preview.mjs'),`import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const types={'.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
createServer(async(request,response)=>{
  try{
    const url=new URL(request.url??'/','http://127.0.0.1');
    let pathname=decodeURIComponent(url.pathname);
    if(pathname==='/')pathname='/qelly-intelligence/';
    if(pathname.endsWith('/'))pathname+='index.html';
    const file=path.resolve(root,\`.\${pathname}\`);
    if(file!==root&&!file.startsWith(\`\${root}\${path.sep}\`))throw new Error('Unsafe path');
    const body=await readFile(file);
    response.writeHead(200,{'Cache-Control':'no-store','Content-Type':types[path.extname(file)]??'application/octet-stream'});
    response.end(body);
  }catch{
    response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});
    response.end('Not found');
  }
}).listen(4173,'127.0.0.1',()=>console.log('Qelly Static visual preview: http://127.0.0.1:4173/qelly-intelligence/#/asset-rankings'));
`,'utf8');
}

function resolveServedFile(pathname){
  if(pathname==='/favicon.ico')return null;
  if(pathname==='/qelly-intelligence')return {redirect:'/qelly-intelligence/'};
  if(pathname.startsWith('/qelly-intelligence/')){
    let relative=decodeURIComponent(pathname.slice('/qelly-intelligence/'.length));
    if(!relative||relative.endsWith('/'))relative+='index.html';
    const file=path.resolve(frontendRoot,relative);
    if(file!==frontendRoot&&!file.startsWith(`${frontendRoot}${path.sep}`))return false;
    return {file};
  }
  if(pathname.startsWith('/reference/')){
    const relative=decodeURIComponent(pathname.slice('/reference/'.length));
    const file=path.resolve(referenceRoot,relative);
    if(file!==referenceRoot&&!file.startsWith(`${referenceRoot}${path.sep}`))return false;
    return {file};
  }
  return false;
}

function startServer(){
  const server=createServer(async(request,response)=>{
    try{
      const url=new URL(request.url??'/',origin);
      const target=resolveServedFile(url.pathname);
      if(url.pathname==='/favicon.ico'){
        response.writeHead(204);
        response.end();
        return;
      }
      if(!target){
        response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});
        response.end('Not found');
        return;
      }
      if(target.redirect){
        response.writeHead(302,{Location:target.redirect});
        response.end();
        return;
      }
      const body=await readFile(target.file);
      response.writeHead(200,{
        'Cache-Control':'no-store',
        'Content-Type':contentTypes[path.extname(target.file)]??'application/octet-stream'
      });
      if(request.method==='HEAD')response.end();
      else response.end(body);
    }catch{
      response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});
      response.end('Not found');
    }
  });
  return new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(port,host,()=>resolve(server));
  });
}

function observePage(page,surface,viewport,errors,failures){
  page.on('pageerror',(error)=>{
    errors.push({surface,viewport,kind:'pageerror',message:error.message});
  });
  page.on('console',(message)=>{
    if(message.type()!=='error')return;
    const location=message.location();
    const sourceUrl=location.url??'';
    if(sourceUrl&&!sourceUrl.startsWith(origin))return;
    errors.push({
      surface,
      viewport,
      kind:'console',
      message:message.text(),
      sourceUrl,
      lineNumber:location.lineNumber,
      columnNumber:location.columnNumber
    });
  });
  page.on('requestfailed',(request)=>{
    const url=request.url();
    if(!url.startsWith(origin))return;
    if(!['document','script','stylesheet','font','image'].includes(request.resourceType()))return;
    failures.push({
      surface,
      viewport,
      kind:'requestfailed',
      resourceType:request.resourceType(),
      url,
      errorText:request.failure()?.errorText??'unknown'
    });
  });
}

async function stabilize(page){
  await page.addStyleTag({content:freezeCss});
  await page.evaluate(async()=>{
    if(document.fonts?.ready)await document.fonts.ready;
    await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
  await page.waitForTimeout(80);
}

async function openSurface(browser,{surface,viewport,errors,failures}){
  const context=await browser.newContext({
    viewport:{width:viewport.width,height:viewport.height},
    deviceScaleFactor:1,
    colorScheme:'dark',
    reducedMotion:'reduce'
  });
  const page=await context.newPage();
  observePage(page,surface,viewport.key,errors,failures);
  const url=surface==='reference'?referenceUrl:implementationUrl;
  await page.goto(url,{waitUntil:'networkidle'});
  const selector=surface==='reference'?'#page-markets.active':'.q-mi-page';
  await page.locator(selector).waitFor({state:'visible'});
  await stabilize(page);
  return {context,page};
}

async function geometryFor(page,surface){
  return page.evaluate((kind)=>{
    const rect=(selector)=>{
      const element=document.querySelector(selector);
      if(!element)return null;
      const box=element.getBoundingClientRect();
      return {
        x:Number(box.x.toFixed(2)),
        y:Number(box.y.toFixed(2)),
        width:Number(box.width.toFixed(2)),
        height:Number(box.height.toFixed(2))
      };
    };
    const style=(selector,property)=>{
      const element=document.querySelector(selector);
      return element?getComputedStyle(element)[property]:null;
    };
    const implementation=kind==='implementation';
    const selectors=implementation
      ? {
          ticker:'.q-global-strip',
          dock:'.q-edge-dock',
          command:'.q-command-bar',
          content:'#main',
          heading:'.q-mi-page-head h1',
          kpis:'.q-mi-kpis',
          kpi:'.q-mi-kpi',
          chart:'.q-mi-chart-card',
          intelligence:'.q-mi-side-stack',
          table:'.q-mi-table-card'
        }
      : {
          ticker:'.ticker',
          dock:'.dock',
          command:'.top',
          content:'.container',
          heading:'#page-markets .head h1',
          kpis:'#page-markets .kpis',
          kpi:'#page-markets .kpi',
          chart:'#page-markets .chart',
          intelligence:'#page-markets .side',
          table:'#market'
        };
    const stickyHeader=implementation?'.q-mi-table-scroll th':'#market th';
    const stickyAsset=implementation?'.q-mi-table-scroll [data-column="asset"]':'#market th:first-child';
    return {
      viewport:{width:innerWidth,height:innerHeight},
      rectangles:Object.fromEntries(Object.entries(selectors).map(([key,selector])=>[key,rect(selector)])),
      styles:{
        bodyBackground:style('body','backgroundImage'),
        headingFont:style(selectors.heading,'fontFamily'),
        headingSize:style(selectors.heading,'fontSize'),
        kpiColumns:style(selectors.kpis,'gridTemplateColumns'),
        kpiRadius:style(selectors.kpi,'borderRadius'),
        tableFont:style(implementation?'.q-mi-table-scroll table':'#market','fontSize'),
        stickyHeaderPosition:style(stickyHeader,'position'),
        stickyAssetPosition:style(stickyAsset,'position'),
        numericVariant:style(implementation?'.q-mi-number':'#market td:nth-child(2)','fontVariantNumeric')
      },
      counts:{
        kpis:document.querySelectorAll(implementation?'.q-mi-kpi':'#page-markets .kpi').length,
        tableHeaders:document.querySelectorAll(implementation?'.q-mi-table-scroll th':'#market th').length,
        visibleMobileControls:[...document.querySelectorAll(implementation?'.q-mobile-navigation button':'.mobile button')].filter((element)=>getComputedStyle(element).display!=='none'&&element.getBoundingClientRect().width>0).length
      }
    };
  },surface);
}

async function captureBaseViewports(browser,errors,failures){
  const geometry={reference:{},implementation:{}};
  for(const viewport of viewports){
    for(const surface of ['reference','implementation']){
      const {context,page}=await openSurface(browser,{surface,viewport,errors,failures});
      const output=surface==='reference'?referenceOutput:implementationOutput;
      await page.screenshot({
        path:path.join(output,`${viewport.key}.png`),
        fullPage:false,
        animations:'disabled',
        scale:'css'
      });
      await page.screenshot({
        path:path.join(output,`${viewport.key}-full-page.png`),
        fullPage:true,
        animations:'disabled',
        scale:'css'
      });
      geometry[surface][viewport.key]=await geometryFor(page,surface);
      await context.close();
    }
  }
  await writeJson(path.join(reportsOutput,'geometry.json'),geometry);
  return geometry;
}

async function withImplementationPage(browser,viewport,errors,failures,callback){
  const opened=await openSurface(browser,{surface:'implementation',viewport,errors,failures});
  try{return await callback(opened.page);}
  finally{await opened.context.close();}
}

async function captureSpecialStates(browser,errors,failures){
  const desktop=viewports[0];
  const mobile=viewports[3];

  await withImplementationPage(browser,desktop,errors,failures,async(page)=>{
    const menu=page.locator('[data-shell-action="menu"]');
    assert(await menu.count()===1,'Expected one desktop navigation menu control');
    await menu.click();
    await page.locator('.q-rail.is-open').waitFor({state:'visible'});
    await stabilize(page);
    await page.screenshot({path:path.join(implementationOutput,'expanded-navigation.png'),animations:'disabled',scale:'css'});
  });

  await withImplementationPage(browser,desktop,errors,failures,async(page)=>{
    const explain=page.locator('[data-mi-explain]');
    assert(await explain.count()===1,'Expected one Explain Market Move control');
    await explain.click();
    await page.locator('[data-mi-drawer].is-open').waitFor({state:'visible'});
    await stabilize(page);
    await page.screenshot({path:path.join(implementationOutput,'explain-drawer.png'),animations:'disabled',scale:'css'});
  });

  await withImplementationPage(browser,desktop,errors,failures,async(page)=>{
    await page.locator('.q-mi-table-card').screenshot({
      path:path.join(implementationOutput,'table-region.png'),
      animations:'disabled',
      scale:'css'
    });
  });

  await withImplementationPage(browser,desktop,errors,failures,async(page)=>{
    await page.locator('#global-theme-selector').selectOption('porcelain-burgundy');
    await page.locator('html[data-theme="porcelain-burgundy"]').waitFor({state:'attached'});
    await stabilize(page);
    await page.screenshot({path:path.join(implementationOutput,'light-mode.png'),animations:'disabled',scale:'css'});
  });

  await withImplementationPage(browser,desktop,errors,failures,async(page)=>{
    await page.locator('#global-theme-selector').selectOption('burgundy-command');
    await page.locator('html[data-theme="burgundy-command"]').waitFor({state:'attached'});
    await stabilize(page);
    await page.screenshot({path:path.join(implementationOutput,'persona-scalper.png'),animations:'disabled',scale:'css'});
  });

  await withImplementationPage(browser,desktop,errors,failures,async(page)=>{
    await page.locator('#global-theme-selector').selectOption('midnight-research');
    await page.locator('html[data-theme="midnight-research"]').waitFor({state:'attached'});
    await stabilize(page);
    await page.screenshot({path:path.join(implementationOutput,'persona-research.png'),animations:'disabled',scale:'css'});
  });

  await withImplementationPage(browser,mobile,errors,failures,async(page)=>{
    const mobileNavigation=page.locator('.q-mobile-navigation');
    await mobileNavigation.waitFor({state:'visible'});
    await page.screenshot({path:path.join(implementationOutput,'mobile-navigation.png'),animations:'disabled',scale:'css'});
    const railToggle=page.locator('#rail-toggle');
    assert(await railToggle.count()===1,'Expected one mobile navigation toggle');
    await railToggle.click();
    await page.locator('.q-rail.is-open').waitFor({state:'visible'});
    await stabilize(page);
    await page.screenshot({path:path.join(implementationOutput,'mobile-navigation-expanded.png'),animations:'disabled',scale:'css'});
  });
}

async function runInteractionChecks(browser,errors,failures){
  const results={generatedAt:new Date().toISOString(),checks:[]};
  const record=(name,passed,evidence)=>results.checks.push({name,passed:Boolean(passed),evidence});
  const desktop=viewports[0];
  await withImplementationPage(browser,desktop,errors,failures,async(page)=>{
    const truth=await page.locator('.q-mi-truth-banner').innerText();
    record(
      'static-preview-truth-labels',
      truth.includes('Static visual preview')&&truth.includes('deterministic demo')&&truth.includes('backend unavailable')&&truth.includes('no production trading or persistence'),
      truth
    );

    const runtimeConfig=await page.evaluate(()=>window.__QELLY_CONFIG__);
    record(
      'safe-static-runtime-config',
      runtimeConfig.staticVisualPreview===true&&runtimeConfig.backendAvailable===false&&runtimeConfig.apiBaseUrl==='',
      runtimeConfig
    );

    await page.keyboard.press('Control+K');
    const commandDialog=page.locator('dialog.q-command-dialog[open]');
    await commandDialog.waitFor({state:'visible'});
    const focused=await page.evaluate(()=>document.activeElement?.id??null);
    record('keyboard-command-palette',focused==='q-command-input',{focused});
    await page.keyboard.press('Escape');

    const motion=await page.evaluate(()=>({
      media:matchMedia('(prefers-reduced-motion: reduce)').matches,
      tickerAnimation:getComputedStyle(document.querySelector('.q-macro-track')).animationDuration
    }));
    record('reduced-motion',motion.media&&motion.tickerAnimation==='0s',motion);

    const rows=page.locator('#q-mi-table-host tbody tr');
    const initialRows=await rows.count();
    await page.locator('[data-mi-search]').fill('Bitcoin');
    const filteredRows=await rows.count();
    record('asset-search-filter',initialRows>filteredRows&&filteredRows===1,{initialRows,filteredRows});
    await page.locator('[data-mi-search]').fill('');

    await page.locator('[data-mi-density-select]').selectOption('compact');
    const density=await page.locator('.q-mi-table-card').getAttribute('data-mi-density');
    record('table-density-switch',density==='compact',{density});

    await page.locator('[data-mi-columns-toggle]').click();
    const columnMenuVisible=await page.locator('[data-mi-column-menu]').isVisible();
    record('column-controls',columnMenuVisible,{columnMenuVisible});
    await page.locator('[data-mi-columns-toggle]').click();

    const watch=page.locator('[data-mi-watch]').first();
    await watch.click();
    const watched=await watch.getAttribute('aria-pressed');
    record('local-demo-watchlist',watched==='true',{ariaPressed:watched});

    await page.locator('[data-mi-timeframe="1W"]').click();
    const selectedTimeframe=await page.locator('[data-mi-timeframe="1W"]').getAttribute('aria-pressed');
    record('chart-timeframe',selectedTimeframe==='true',{selectedTimeframe});

    await page.locator('[data-mi-explain]').click();
    const drawerVisible=await page.locator('[data-mi-drawer].is-open').isVisible();
    record('explain-market-move-drawer',drawerVisible,{drawerVisible});
    await page.locator('[data-mi-drawer-close]').click();

    await page.locator('[data-shell-action="menu"]').click();
    const navVisible=await page.locator('.q-rail.is-open').isVisible();
    record('expandable-product-navigation',navVisible,{navVisible});
    await page.locator('[data-shell-action="menu"]').click();

    const unavailable=page.locator('[data-preview-unavailable="Derivatives"]');
    await unavailable.click();
    const toast=page.locator('.q-toast').filter({hasText:'backend'});
    await toast.waitFor({state:'visible'});
    record('unavailable-state-feedback',await toast.isVisible(),{text:await toast.innerText()});

    await page.locator('#global-theme-selector').selectOption('porcelain-burgundy');
    const lightTheme=await page.locator('html').getAttribute('data-theme');
    record('light-appearance',lightTheme==='porcelain-burgundy',{lightTheme});

    await page.locator('#global-theme-selector').selectOption('midnight-research');
    const researchPersona=await page.locator('html').getAttribute('data-theme');
    record('persona-research-mode',researchPersona==='midnight-research',{researchPersona});

    const tableSemantics=await page.evaluate(()=>({
      stickyHeader:getComputedStyle(document.querySelector('.q-mi-table-scroll th')).position,
      stickyAsset:getComputedStyle(document.querySelector('.q-mi-table-scroll [data-column="asset"]')).position,
      horizontalOverflow:document.querySelector('.q-mi-table-scroll table').scrollWidth>document.querySelector('.q-mi-table-scroll').clientWidth,
      tableTabIndex:document.querySelector('.q-mi-table-scroll').tabIndex
    }));
    record(
      'institutional-table-behavior',
      tableSemantics.stickyHeader==='sticky'&&tableSemantics.stickyAsset==='sticky'&&tableSemantics.horizontalOverflow&&tableSemantics.tableTabIndex===0,
      tableSemantics
    );
  });

  await withImplementationPage(browser,viewports[3],errors,failures,async(page)=>{
    const mobileState=await page.evaluate(()=>({
      bottomNavigationVisible:getComputedStyle(document.querySelector('.q-mobile-navigation')).display!=='none',
      bottomNavigationItems:document.querySelectorAll('.q-mobile-navigation button').length,
      desktopDockHidden:getComputedStyle(document.querySelector('.q-edge-dock')).display==='none',
      menuToggleVisible:getComputedStyle(document.querySelector('#rail-toggle')).display!=='none'
    }));
    record(
      'responsive-mobile-navigation',
      mobileState.bottomNavigationVisible&&mobileState.bottomNavigationItems===5&&mobileState.desktopDockHidden&&mobileState.menuToggleVisible,
      mobileState
    );
  });

  record(
    'empty-state-review',
    false,
    'The static-preview Asset Rankings route does not expose an empty-state switch; this remains a manual known difference rather than a fabricated screenshot.'
  );
  await writeJson(path.join(reportsOutput,'tested-interactions.json'),results);
  return results;
}

async function readPng(file){
  return PNG.sync.read(await readFile(file));
}

function copyPixel(source,target,sourceX,sourceY,targetX,targetY){
  const sourceIndex=(source.width*sourceY+sourceX)<<2;
  const targetIndex=(target.width*targetY+targetX)<<2;
  target.data[targetIndex]=source.data[sourceIndex];
  target.data[targetIndex+1]=source.data[sourceIndex+1];
  target.data[targetIndex+2]=source.data[sourceIndex+2];
  target.data[targetIndex+3]=source.data[sourceIndex+3];
}

async function makeSideBySide(leftFile,rightFile,outputFile){
  const [left,right]=await Promise.all([readPng(leftFile),readPng(rightFile)]);
  assert(left.width===right.width&&left.height===right.height,`Comparison dimensions differ for ${outputFile}`);
  const gutter=24;
  const output=new PNG({width:left.width+right.width+gutter,height:left.height});
  output.data.fill(255);
  for(let y=0;y<left.height;y++){
    for(let x=0;x<left.width;x++){
      copyPixel(left,output,x,y,x,y);
      copyPixel(right,output,x,y,x+left.width+gutter,y);
    }
  }
  await writeFile(outputFile,PNG.sync.write(output));
}

async function makeAnnotatedDifference(referencePath,implementationPath,outputFile){
  const [reference,implementation]=await Promise.all([readPng(referencePath),readPng(implementationPath)]);
  assert(reference.width===implementation.width&&reference.height===implementation.height,`Difference dimensions differ for ${outputFile}`);
  const output=new PNG({width:reference.width,height:reference.height});
  let changed=0;
  for(let y=0;y<reference.height;y++){
    for(let x=0;x<reference.width;x++){
      const index=(reference.width*y+x)<<2;
      const delta=Math.max(
        Math.abs(reference.data[index]-implementation.data[index]),
        Math.abs(reference.data[index+1]-implementation.data[index+1]),
        Math.abs(reference.data[index+2]-implementation.data[index+2])
      );
      if(delta>38){
        changed++;
        output.data[index]=Math.round(implementation.data[index]*.42+255*.58);
        output.data[index+1]=Math.round(implementation.data[index+1]*.42+38*.58);
        output.data[index+2]=Math.round(implementation.data[index+2]*.42+112*.58);
      }else{
        const grey=Math.round(
          implementation.data[index]*.2126+
          implementation.data[index+1]*.7152+
          implementation.data[index+2]*.0722
        );
        output.data[index]=Math.round(grey*.58);
        output.data[index+1]=Math.round(grey*.58);
        output.data[index+2]=Math.round(grey*.58);
      }
      output.data[index+3]=255;
    }
  }
  await writeFile(outputFile,PNG.sync.write(output));
  return {
    changedPixels:changed,
    totalPixels:reference.width*reference.height,
    changedRatio:Number((changed/(reference.width*reference.height)).toFixed(6)),
    annotation:'Magenta indicates pixels whose maximum RGB channel delta exceeds 38; grey areas are closer at that coordinate.'
  };
}

async function generateComparisons(){
  const sets=[
    {viewport:'desktop-1440',name:'desktop'},
    {viewport:'tablet-1024',name:'tablet'},
    {viewport:'tablet-768',name:'tablet-768'},
    {viewport:'mobile-390',name:'mobile'}
  ];
  const metrics={};
  for(const item of sets){
    const referencePath=path.join(referenceOutput,`${item.viewport}.png`);
    const implementationPath=path.join(implementationOutput,`${item.viewport}.png`);
    await makeSideBySide(referencePath,implementationPath,path.join(comparisonOutput,`${item.name}-side-by-side.png`));
    metrics[item.viewport]=await makeAnnotatedDifference(
      referencePath,
      implementationPath,
      path.join(comparisonOutput,`${item.name}-annotated-differences.png`)
    );
  }
  await writeJson(path.join(reportsOutput,'pixel-difference-metrics.json'),metrics);
  return metrics;
}

async function writeJson(file,value){
  await writeFile(file,`${JSON.stringify(value,null,2)}\n`,'utf8');
}

async function writeReports({geometry,errors,failures,interactions,differenceMetrics}){
  await writeJson(path.join(reportsOutput,'console-errors.json'),{
    generatedAt:new Date().toISOString(),
    siteOrigin:origin,
    errors,
    failedResources:failures,
    result:errors.length===0&&failures.length===0?'passed':'failed'
  });

  const knownDifferencesPath=path.join(root,'design/review/known-differences.json');
  let knownDifferences;
  try{knownDifferences=JSON.parse(await readFile(knownDifferencesPath,'utf8'));}
  catch{
    knownDifferences={
      status:'preliminary-automated-capture',
      critical:[],
      major:[
        'Manual screenshot review and fidelity percentage are pending the first workflow artifact.',
        'The static preview does not expose an Asset Rankings empty-state switch.'
      ],
      minor:[
        'The implementation uses the repository typography stack rather than embedding a new remote font.',
        'The institutional table is intentionally wider than the approved reference and scrolls horizontally.'
      ],
      deliberate:[
        'Production APIs, schemas, persistence and infrastructure are not reproduced by the reference HTML.',
        'All fallback market observations remain explicitly deterministic demo data.',
        'The approved HTML is review-only and is scheduled for removal before final merge.'
      ]
    };
  }
  await writeJson(path.join(reportsOutput,'known-differences.json'),knownDifferences);

  const manualReportPath=path.join(root,'design/review/VISUAL_QA.md');
  let report;
  try{report=await readFile(manualReportPath,'utf8');}
  catch{
    const geometrySummary=Object.fromEntries(viewports.map((viewport)=>[
      viewport.key,
      {
        reference:geometry.reference[viewport.key]?.rectangles,
        implementation:geometry.implementation[viewport.key]?.rectangles
      }
    ]));
    report=`# Qelly UI rescue visual QA

Status: automated capture complete; manual screenshot assessment pending.

Approximate visual fidelity: **not claimed until the generated screenshots are manually compared**.

The workflow rendered the approved reference and implementation at ${viewports.map((viewport)=>`${viewport.width}×${viewport.height}`).join(', ')}, froze continuous animation, captured interactive states, and generated side-by-side and annotated differences.

## Automated evidence

- Site-origin JavaScript errors: ${errors.length}
- Failed local resources: ${failures.length}
- Interaction checks passing: ${interactions.checks.filter((check)=>check.passed).length}/${interactions.checks.length}
- Pixel-difference data: available in \`pixel-difference-metrics.json\`; it is not used as a substitute for manual visual judgment.
- Geometry data: available in \`geometry.json\`.

## Manual review gate

Before this draft PR can leave draft state, a reviewer must inspect ticker and command heights, dock width, content alignment, burgundy strength, typography, KPI geometry, chart dominance, intelligence stack, table behavior, responsive stacking, mobile controls, light mode, persona modes, and Explain Market Move.

The first artifact intentionally reports no fidelity percentage. After manual inspection, \`design/review/VISUAL_QA.md\` and \`design/review/known-differences.json\` must be added or updated, then the workflow must rerun so the downloadable artifact contains the signed-off manual assessment.

<!-- geometry-summary ${JSON.stringify(geometrySummary)} -->
`;
  }
  await writeFile(path.join(reportsOutput,'VISUAL_QA.md'),report,'utf8');
  await writeJson(path.join(reportsOutput,'review-summary.json'),{
    generatedAt:new Date().toISOString(),
    commit:reviewCommit,
    artifact:'qelly-ui-rescue-review',
    viewports,
    consoleErrors:errors.length,
    failedResources:failures.length,
    interactionChecks:{
      passed:interactions.checks.filter((check)=>check.passed).length,
      total:interactions.checks.length
    },
    differenceMetrics,
    manualReportSupplied:report.includes('Status: automated capture complete; manual screenshot assessment pending.')===false
  });
}

async function listFiles(directory,prefix=''){
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const relative=path.join(prefix,entry.name);
    const absolute=path.join(directory,entry.name);
    if(entry.isDirectory())files.push(...await listFiles(absolute,relative));
    else files.push({relative:absolute===path.join(outputRoot,'reports/artifact-manifest.json')?null:relative,absolute});
  }
  return files.filter((item)=>item.relative);
}

async function writeManifest(){
  const files=await listFiles(outputRoot);
  const entries=[];
  for(const file of files){
    const bytes=await readFile(file.absolute);
    entries.push({
      path:file.relative.split(path.sep).join('/'),
      bytes:bytes.length,
      sha256:createHash('sha256').update(bytes).digest('hex')
    });
  }
  const referenceBytes=await readFile(referenceFile);
  await writeJson(path.join(reportsOutput,'artifact-manifest.json'),{
    schemaVersion:1,
    artifact:'qelly-ui-rescue-review',
    label:'Static visual preview',
    generatedAt:new Date().toISOString(),
    commit:reviewCommit,
    reference:{
      repositoryPath:'design/reference/QELLY_EXPECTED_FULL_UI_WORKING.html',
      sha256:createHash('sha256').update(referenceBytes).digest('hex'),
      bundledInCompiledPreview:false,
      removalBeforeMerge:true
    },
    viewports,
    files:entries
  });
}

await ensureInputs();
await prepareOutput();
const server=await startServer();
let browser;
const errors=[];
const failures=[];
try{
  browser=await chromium.launch({headless:true});
  const geometry=await captureBaseViewports(browser,errors,failures);
  await captureSpecialStates(browser,errors,failures);
  const interactions=await runInteractionChecks(browser,errors,failures);
  const differenceMetrics=await generateComparisons();
  await writeReports({geometry,errors,failures,interactions,differenceMetrics});
  await writeManifest();
  const requiredInteractionFailures=interactions.checks.filter((check)=>!check.passed&&check.name!=='empty-state-review');
  console.log(JSON.stringify({
    status:errors.length===0&&failures.length===0&&requiredInteractionFailures.length===0?'ui-review-passed':'ui-review-failed',
    artifact:'qelly-ui-rescue-review',
    output:path.relative(root,outputRoot),
    viewports,
    screenshots:(await listFiles(outputRoot)).filter((file)=>file.relative.endsWith('.png')).length,
    siteOriginErrors:errors.length,
    failedResources:failures.length,
    interactions:{
      passed:interactions.checks.filter((check)=>check.passed).length,
      total:interactions.checks.length,
      requiredFailures:requiredInteractionFailures.map((check)=>check.name)
    }
  },null,2));
  if(errors.length||failures.length||requiredInteractionFailures.length)process.exitCode=1;
}finally{
  if(browser)await browser.close();
  await new Promise((resolve,reject)=>server.close((error)=>error?reject(error):resolve()));
}
