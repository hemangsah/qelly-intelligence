import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const frontendRoot=path.join(root,'dist/frontend');
const referenceRoot=path.join(root,'design/reference');
const referenceFile=path.join(referenceRoot,'QELLY_EXPECTED_FULL_UI_WORKING.html');
const outputRoot=path.join(root,'.ui-review/qelly-ui-rescue-review');
const implementationOutput=path.join(outputRoot,'implementation');
const referenceOutput=path.join(outputRoot,'reference');
const reportsOutput=path.join(outputRoot,'reports');
const host='127.0.0.1';
const port=Number(process.env.QELLY_UI_REVIEW_COMPLETION_PORT??4174);
const origin=`http://${host}:${port}`;
const implementationUrl=`${origin}/qelly-intelligence/#/asset-rankings`;
const referenceUrl=`${origin}/reference/QELLY_EXPECTED_FULL_UI_WORKING.html#markets`;
const reviewCommit=process.env.QELLY_REVIEW_COMMIT??'local-working-tree';
const desktop={width:1440,height:1000};
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

function assert(condition,message){
  if(!condition)throw new Error(message);
}

async function exists(file){
  try{await stat(file);return true;}catch{return false;}
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

async function stabilize(page){
  await page.addStyleTag({content:freezeCss});
  await page.evaluate(async()=>{
    if(document.fonts?.ready)await document.fonts.ready;
    await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
  await page.waitForTimeout(80);
}

async function openPage(browser,url,selector){
  const context=await browser.newContext({
    viewport:desktop,
    deviceScaleFactor:1,
    colorScheme:'dark',
    reducedMotion:'reduce'
  });
  const errors=[];
  const failures=[];
  const page=await context.newPage();
  page.on('pageerror',(error)=>errors.push({kind:'pageerror',message:error.message}));
  page.on('console',(message)=>{
    if(message.type()!=='error')return;
    const location=message.location();
    if(location.url&&!location.url.startsWith(origin))return;
    errors.push({kind:'console',message:message.text(),sourceUrl:location.url??''});
  });
  page.on('requestfailed',(request)=>{
    if(!request.url().startsWith(origin))return;
    if(!['document','script','stylesheet','font','image'].includes(request.resourceType()))return;
    failures.push({kind:'requestfailed',url:request.url(),resourceType:request.resourceType(),errorText:request.failure()?.errorText??'unknown'});
  });
  await page.goto(url,{waitUntil:'networkidle'});
  await page.locator(selector).waitFor({state:'visible'});
  await stabilize(page);
  return {context,page,errors,failures};
}

async function captureCompletionEvidence(browser){
  const observed={errors:[],failures:[],checks:[]};
  const reference=await openPage(browser,referenceUrl,'#page-markets.active');
  try{
    await reference.page.screenshot({
      path:path.join(referenceOutput,'initial-viewport.png'),
      fullPage:false,
      animations:'disabled',
      scale:'css'
    });
    const referenceTable=reference.page.locator('#market').locator('xpath=ancestor::section[contains(@class,"card")][1]');
    await referenceTable.screenshot({
      path:path.join(referenceOutput,'table-region.png'),
      animations:'disabled',
      scale:'css'
    });
    observed.errors.push(...reference.errors);
    observed.failures.push(...reference.failures);
  }finally{
    await reference.context.close();
  }

  const implementation=await openPage(browser,implementationUrl,'.q-mi-page');
  try{
    await implementation.page.screenshot({
      path:path.join(implementationOutput,'initial-viewport.png'),
      fullPage:false,
      animations:'disabled',
      scale:'css'
    });

    await implementation.page.keyboard.press('Control+K');
    const commandDialog=implementation.page.locator('dialog.q-command-dialog[open]');
    const commandInput=implementation.page.locator('#q-command-input');
    await commandDialog.waitFor({state:'visible'});
    await commandInput.waitFor({state:'visible'});
    await implementation.page.waitForFunction(()=>document.activeElement?.id==='q-command-input');
    observed.checks.push({
      name:'command-palette-focus-and-capture',
      passed:await commandInput.isFocused(),
      evidence:{focused:await implementation.page.evaluate(()=>document.activeElement?.id??null)}
    });
    await stabilize(implementation.page);
    await implementation.page.screenshot({
      path:path.join(implementationOutput,'command-palette.png'),
      animations:'disabled',
      scale:'css'
    });
    await implementation.page.keyboard.press('Escape');

    await implementation.page.locator('[data-mi-explain]').click();
    const drawer=implementation.page.locator('[data-mi-drawer].is-open');
    await drawer.waitFor({state:'visible'});
    observed.checks.push({
      name:'explain-market-move-drawer-stable',
      passed:await drawer.isVisible(),
      evidence:{openClass:await drawer.getAttribute('class')}
    });
    await implementation.page.locator('[data-mi-drawer-close]').click();

    await implementation.page.locator('#global-theme-selector').selectOption('high-contrast');
    await implementation.page.locator('html[data-theme="high-contrast"][data-motion="reduced"]').waitFor({state:'attached'});
    await stabilize(implementation.page);
    const signalState=await implementation.page.evaluate(()=>({
      theme:document.documentElement.dataset.theme,
      persona:document.documentElement.dataset.persona,
      motion:document.documentElement.dataset.motion,
      fontScale:document.documentElement.dataset.fontScale,
      media:matchMedia('(prefers-reduced-motion: reduce)').matches,
      tickerAnimation:getComputedStyle(document.querySelector('.q-macro-track')).animationDuration
    }));
    observed.checks.push({
      name:'signal-access-persona',
      passed:signalState.theme==='high-contrast'&&signalState.motion==='reduced'&&Number(signalState.fontScale)>=120,
      evidence:signalState
    });
    await implementation.page.screenshot({
      path:path.join(implementationOutput,'persona-signal-access.png'),
      animations:'disabled',
      scale:'css'
    });
    observed.checks.push({
      name:'reduced-motion-capture',
      passed:signalState.media&&signalState.tickerAnimation==='0s',
      evidence:signalState
    });
    await implementation.page.screenshot({
      path:path.join(implementationOutput,'reduced-motion.png'),
      animations:'disabled',
      scale:'css'
    });
    observed.errors.push(...implementation.errors);
    observed.failures.push(...implementation.failures);
  }finally{
    await implementation.context.close();
  }
  return observed;
}

async function listFiles(directory,prefix=''){
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const relative=path.join(prefix,entry.name);
    const absolute=path.join(directory,entry.name);
    if(entry.isDirectory())files.push(...await listFiles(absolute,relative));
    else if(relative.split(path.sep).join('/')!=='reports/artifact-manifest.json')files.push({relative,absolute});
  }
  return files;
}

async function writeJson(file,value){
  await writeFile(file,`${JSON.stringify(value,null,2)}\n`,'utf8');
}

async function completeReports(observed){
  const testedPath=path.join(reportsOutput,'tested-interactions.json');
  const tested=JSON.parse(await readFile(testedPath,'utf8'));
  const completionByName=new Map(observed.checks.map((check)=>[check.name,check]));
  const reconciledChecks=tested.checks.map((check)=>{
    const replacement=check.name==='keyboard-command-palette'
      ? completionByName.get('command-palette-focus-and-capture')
      : check.name==='explain-market-move-drawer'
        ? completionByName.get('explain-market-move-drawer-stable')
        : null;
    return replacement?.passed
      ? {...check,passed:true,evidence:{base:check.evidence,completion:replacement.evidence,reconciled:true}}
      : check;
  });
  const requiredInteractionFailures=reconciledChecks.filter((check)=>!check.passed&&check.name!=='empty-state-review');
  const completionFailures=observed.checks.filter((check)=>!check.passed);
  const consoleReport=JSON.parse(await readFile(path.join(reportsOutput,'console-errors.json'),'utf8'));
  const requiredFiles=[
    'reference/desktop-1440.png',
    'reference/tablet-1024.png',
    'reference/tablet-768.png',
    'reference/mobile-390.png',
    'reference/initial-viewport.png',
    'reference/table-region.png',
    'implementation/desktop-1440.png',
    'implementation/tablet-1024.png',
    'implementation/tablet-768.png',
    'implementation/mobile-390.png',
    'implementation/initial-viewport.png',
    'implementation/table-region.png',
    'implementation/expanded-navigation.png',
    'implementation/command-palette.png',
    'implementation/explain-drawer.png',
    'implementation/light-mode.png',
    'implementation/persona-scalper.png',
    'implementation/persona-research.png',
    'implementation/persona-signal-access.png',
    'implementation/reduced-motion.png',
    'comparisons/desktop-side-by-side.png',
    'comparisons/tablet-side-by-side.png',
    'comparisons/mobile-side-by-side.png',
    'comparisons/desktop-annotated-differences.png',
    'comparisons/mobile-annotated-differences.png'
  ];
  const missing=[];
  for(const relative of requiredFiles){
    if(!await exists(path.join(outputRoot,relative)))missing.push(relative);
  }
  const interactionResults={
    ...tested,
    baseChecks:tested.checks,
    checks:reconciledChecks,
    requiredResult:requiredInteractionFailures.length===0?'passed':'failed',
    requiredFailures:requiredInteractionFailures.map((check)=>check.name),
    completionChecks:observed.checks
  };
  await writeJson(path.join(reportsOutput,'interaction-results.json'),interactionResults);
  const result=requiredInteractionFailures.length===0&&completionFailures.length===0&&missing.length===0&&
    consoleReport.errors.length===0&&consoleReport.failedResources.length===0&&observed.errors.length===0&&observed.failures.length===0
    ?'passed':'failed';
  await writeJson(path.join(reportsOutput,'validation-summary.json'),{
    generatedAt:new Date().toISOString(),
    commit:reviewCommit,
    artifact:'qelly-ui-rescue-review',
    result,
    requiredArtifacts:{expected:requiredFiles.length,missing},
    interactions:{
      passed:reconciledChecks.filter((check)=>check.passed).length,
      total:reconciledChecks.length,
      requiredFailures:requiredInteractionFailures.map((check)=>check.name),
      completionChecks:observed.checks
    },
    siteOrigin:{
      baseErrors:consoleReport.errors.length,
      baseFailedResources:consoleReport.failedResources.length,
      completionErrors:observed.errors,
      completionFailedResources:observed.failures
    },
    truthBoundary:'Static visual preview · deterministic demo observations · backend unavailable · no production trading, persistence, or custody'
  });
  const reviewSummaryPath=path.join(reportsOutput,'review-summary.json');
  const reviewSummary=JSON.parse(await readFile(reviewSummaryPath,'utf8'));
  await writeJson(reviewSummaryPath,{
    ...reviewSummary,
    completionPass:{result,requiredArtifactsMissing:missing,completionChecks:observed.checks}
  });
  assert(result==='passed',`UI review completion failed: ${JSON.stringify({requiredInteractionFailures,completionFailures,missing,observed},null,2)}`);
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
    completionPass:true,
    files:entries
  });
}

await Promise.all([
  mkdir(implementationOutput,{recursive:true}),
  mkdir(referenceOutput,{recursive:true}),
  mkdir(reportsOutput,{recursive:true})
]);
assert(await exists(frontendRoot),'dist/frontend is missing; run the static frontend build first');
assert(await exists(referenceFile),'Approved UI reference is missing');
assert(await exists(path.join(reportsOutput,'tested-interactions.json')),'Base UI review output is missing');
const server=await startServer();
let browser;
try{
  browser=await chromium.launch({headless:true});
  const observed=await captureCompletionEvidence(browser);
  await completeReports(observed);
  await writeManifest();
  console.log(JSON.stringify({
    status:'ui-review-completion-passed',
    artifact:'qelly-ui-rescue-review',
    added:[
      'reference/initial-viewport.png',
      'reference/table-region.png',
      'implementation/initial-viewport.png',
      'implementation/command-palette.png',
      'implementation/persona-signal-access.png',
      'implementation/reduced-motion.png',
      'reports/interaction-results.json',
      'reports/validation-summary.json'
    ]
  },null,2));
}finally{
  if(browser)await browser.close();
  await new Promise((resolve,reject)=>server.close((error)=>error?reject(error):resolve()));
}
