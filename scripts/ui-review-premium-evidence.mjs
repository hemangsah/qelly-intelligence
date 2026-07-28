import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir,readFile,readdir,stat,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const frontendRoot=path.join(root,'dist/frontend');
const outputRoot=path.join(root,'.ui-review/qelly-ui-rescue-review');
const implementationOutput=path.join(outputRoot,'implementation');
const reportsOutput=path.join(outputRoot,'reports');
const figmaOutput=path.join(outputRoot,'figma');
const host='127.0.0.1';
const port=Number(process.env.QELLY_UI_PREMIUM_EVIDENCE_PORT??4176);
const origin=`http://${host}:${port}`;
const reviewUrl=`${origin}/qelly-intelligence/#/asset-rankings`;
const reviewCommit=process.env.QELLY_REVIEW_COMMIT??'local-working-tree';
const contentTypes={'.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2'};
const personas=[
  ['burgundy-command','scalper-velocity','Scalper Velocity'],
  ['porcelain-burgundy','investor-compound','Investor Compound'],
  ['burgundy-night','aggressive-alpha','Aggressive Alpha'],
  ['graphite-terminal','quant-operator','Quant Operator'],
  ['midnight-research','research-oracle','Research Oracle'],
  ['high-contrast','signal-access','Signal Access']
];
const requiredFiles=[
  ...personas.map(([,slug])=>`implementation/persona-${slug}.png`),
  'implementation/query-builder.png',
  'figma/master-frame-evidence.png',
  'figma/MASTER_FRAME_EVIDENCE.md'
];

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
async function exists(file){try{await stat(file);return true;}catch{return false;}}
async function writeJson(file,value){await writeFile(file,`${JSON.stringify(value,null,2)}\n`,'utf8');}
function safeFile(relative){
  const file=path.resolve(frontendRoot,relative);
  if(file!==frontendRoot&&!file.startsWith(`${frontendRoot}${path.sep}`))return null;
  return file;
}
function startServer(){
  const server=createServer(async(request,response)=>{
    try{
      const url=new URL(request.url??'/',origin);
      if(url.pathname==='/favicon.ico'){response.writeHead(204);response.end();return;}
      if(!url.pathname.startsWith('/qelly-intelligence/')){response.writeHead(404);response.end('Not found');return;}
      let relative=decodeURIComponent(url.pathname.slice('/qelly-intelligence/'.length));
      if(!relative||relative.endsWith('/'))relative+='index.html';
      const file=safeFile(relative);if(!file)throw new Error('Unsafe path');
      const body=await readFile(file);
      response.writeHead(200,{'Cache-Control':'no-store','Content-Type':contentTypes[path.extname(file)]??'application/octet-stream'});
      response.end(body);
    }catch{response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});response.end('Not found');}
  });
  return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>resolve(server));});
}
async function openPage(browser,{reducedMotion='no-preference'}={}){
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,colorScheme:'dark',reducedMotion});
  const errors=[];const failures=[];const page=await context.newPage();
  page.on('pageerror',(error)=>errors.push({kind:'pageerror',message:error.message}));
  page.on('console',(message)=>{if(message.type()!=='error')return;const location=message.location();if(location.url&&!location.url.startsWith(origin))return;errors.push({kind:'console',message:message.text(),sourceUrl:location.url??''});});
  page.on('requestfailed',(request)=>{if(!request.url().startsWith(origin))return;if(!['document','script','stylesheet','font','image'].includes(request.resourceType()))return;failures.push({kind:'requestfailed',url:request.url(),resourceType:request.resourceType(),errorText:request.failure()?.errorText??'unknown'});});
  await page.goto(reviewUrl,{waitUntil:'networkidle'});
  await page.locator('.q-mi-page').waitFor({state:'visible'});
  await page.evaluate(async()=>{if(document.fonts?.ready)await document.fonts.ready;await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  return {context,page,errors,failures};
}
async function capturePersonas(browser,observed){
  const opened=await openPage(browser);
  try{
    for(const [value,slug,label] of personas){
      await opened.page.locator('#global-theme-selector').selectOption(value);
      await opened.page.locator(`html[data-theme="${value}"]`).waitFor({state:'attached'});
      await opened.page.waitForTimeout(80);
      await opened.page.screenshot({path:path.join(implementationOutput,`persona-${slug}.png`),animations:'disabled',scale:'css'});
      observed.personas.push({value,slug,label,passed:true});
    }
    observed.errors.push(...opened.errors.map((item)=>({...item,capture:'personas'})));
    observed.failures.push(...opened.failures.map((item)=>({...item,capture:'personas'})));
  }finally{await opened.context.close();}
}
async function captureQueryBuilder(browser,observed){
  const opened=await openPage(browser);
  try{
    const page=opened.page;
    await page.locator('[data-mi-filter-toggle]').click();
    const sheet=page.locator('[data-mi-filter-sheet].is-open');
    await sheet.waitFor({state:'visible'});
    await page.locator('[data-mi-direction]').selectOption('positive');
    await page.locator('[data-mi-confidence]').evaluate((element)=>{element.value='80';element.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.locator('[data-mi-universe]').selectOption('oi-expansion');
    await sheet.locator('section').screenshot({path:path.join(implementationOutput,'query-builder.png'),animations:'disabled',scale:'css'});
    const values=await page.evaluate(()=>({
      direction:document.querySelector('[data-mi-direction]')?.value,
      confidence:document.querySelector('[data-mi-confidence]')?.value,
      universe:document.querySelector('[data-mi-universe]')?.value,
      title:document.querySelector('#q-mi-filter-title')?.textContent
    }));
    observed.queryBuilder={passed:values.direction==='positive'&&values.confidence==='80'&&values.universe==='oi-expansion'&&values.title==='Filter rankings',values};
    observed.errors.push(...opened.errors.map((item)=>({...item,capture:'query-builder'})));
    observed.failures.push(...opened.failures.map((item)=>({...item,capture:'query-builder'})));
  }finally{await opened.context.close();}
}
async function inspectShell(browser,observed){
  const opened=await openPage(browser);
  try{
    observed.shell=await opened.page.evaluate(()=>{
      const main=document.querySelector('#main');const dock=document.querySelector('.q-edge-dock');const rail=document.querySelector('.q-rail');const shelf=document.querySelector('.q-context-shelf');const switcher=document.querySelector('.q-workspace-switcher strong');const table=document.querySelector('.q-mi-table-card');
      const mainRect=main.getBoundingClientRect();const dockRect=dock.getBoundingClientRect();const railRect=rail.getBoundingClientRect();const shelfRect=shelf.getBoundingClientRect();const titleRect=switcher.getBoundingClientRect();
      const text=document.body.innerText;const previewMentions=(text.match(/Static visual preview/gi)??[]).length;
      const forbiddenGlyphs=(text.match(/[☰⚙✓✣⌁◉]/g)??[]);
      const railDuration=getComputedStyle(rail).transitionDuration;
      return {
        title:switcher.textContent.trim(),titleNotTruncated:switcher.scrollWidth<=switcher.clientWidth+1&&titleRect.width>0,
        mainTop:Math.round(mainRect.top),shelfBottom:Math.round(shelfRect.bottom),mainLeft:Math.round(mainRect.left),dockRight:Math.round(dockRect.right),
        railRight:Math.round(railRect.right),railHidden:rail.getAttribute('aria-hidden')==='true'&&railRect.right<=dockRect.right+1,
        mainOutline:getComputedStyle(main).outlineStyle,tableTop:Math.round(table.getBoundingClientRect().top),tableInFirstScreen:table.getBoundingClientRect().top<innerHeight,
        previewMentions,forbiddenGlyphs,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,railDuration
      };
    });
    const shell=observed.shell;
    shell.passed=shell.titleNotTruncated&&Math.abs(shell.mainTop-shell.shelfBottom)<=2&&Math.abs(shell.mainLeft-shell.dockRight)<=2&&shell.railHidden&&shell.mainOutline==='none'&&shell.tableInFirstScreen&&shell.previewMentions<=3&&shell.forbiddenGlyphs.length===0&&!shell.pageOverflow&&shell.railDuration!=='0s';
    observed.errors.push(...opened.errors.map((item)=>({...item,capture:'shell'})));
    observed.failures.push(...opened.failures.map((item)=>({...item,capture:'shell'})));
  }finally{await opened.context.close();}
}
async function writeMasterFrameEvidence(browser){
  const desktop=await readFile(path.join(implementationOutput,'desktop-1440-premium.png'),'base64');
  const mobile=await readFile(path.join(implementationOutput,'mobile-390-premium.png'),'base64');
  const context=await browser.newContext({viewport:{width:1600,height:1040},deviceScaleFactor:1,colorScheme:'dark'});const page=await context.newPage();
  try{
    await page.setContent(`<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;padding:34px;background:#070507;color:#f5f1f3;font-family:Inter,system-ui,sans-serif}h1{margin:0 0 8px;font-size:30px}p{margin:0 0 26px;color:#b8aeb3}.frames{display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:24px;align-items:start}.frame{padding:14px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:#0d0a0c}.frame header{display:flex;justify-content:space-between;margin-bottom:10px;font-size:12px;color:#b8aeb3}.frame img{display:block;width:100%;height:auto;border:1px solid rgba(255,255,255,.08)}footer{margin-top:22px;padding-top:14px;border-top:1px solid rgba(255,255,255,.1);font-size:12px;color:#e0b460}</style></head><body><h1>Qelly premium master-frame evidence</h1><p>Generator-derived desktop and mobile review evidence aligned with the executable Figma handoff.</p><div class="frames"><section class="frame"><header><strong>Asset Rankings · Desktop 1440</strong><span>Editable master target</span></header><img src="data:image/png;base64,${desktop}"></section><section class="frame"><header><strong>Asset Rankings · Mobile 390</strong><span>Purpose-built responsive target</span></header><img src="data:image/png;base64,${mobile}"></section></div><footer>CI handoff preview — not an export from a hosted Figma file. Run figma/code.js in Figma to generate editable pages, variables, components, and master frames.</footer></body></html>`,{waitUntil:'load'});
    await page.screenshot({path:path.join(figmaOutput,'master-frame-evidence.png'),fullPage:true,animations:'disabled',scale:'css'});
  }finally{await context.close();}
  await writeFile(path.join(figmaOutput,'MASTER_FRAME_EVIDENCE.md'),'# Master-frame evidence\n\n`master-frame-evidence.png` is a CI-generated handoff preview using the same approved desktop and mobile implementation targets bundled with the executable Figma generator. It is **not** represented as an export from a hosted Figma file. Run `figma/code.js` inside Figma to create the editable 31-page semantic system, variables, components, and master frames.\n','utf8');
}
async function listFiles(directory,prefix=''){
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const relative=path.join(prefix,entry.name);const absolute=path.join(directory,entry.name);
    if(entry.isDirectory())files.push(...await listFiles(absolute,relative));else if(relative.split(path.sep).join('/')!=='reports/ARTIFACT_MANIFEST.json')files.push({relative,absolute});
  }
  return files;
}
async function finalizeReports(observed){
  const missing=[];for(const relative of requiredFiles)if(!await exists(path.join(outputRoot,relative)))missing.push(relative);
  const consolePath=path.join(reportsOutput,'CONSOLE_ERRORS.json');const consoleReport=JSON.parse(await readFile(consolePath,'utf8'));
  consoleReport.errors.push(...observed.errors);consoleReport.failedResources.push(...observed.failures);consoleReport.result=consoleReport.errors.length||consoleReport.failedResources.length?'failed':'passed';await writeJson(consolePath,consoleReport);
  const interactionPath=path.join(reportsOutput,'INTERACTIONS.json');const interactions=JSON.parse(await readFile(interactionPath,'utf8'));
  interactions.checks.push({name:'all-six-personas',passed:observed.personas.length===6&&observed.personas.every((item)=>item.passed),evidence:observed.personas});
  interactions.checks.push({name:'configured-query-builder',passed:observed.queryBuilder.passed,evidence:observed.queryBuilder.values});
  interactions.checks.push({name:'premium-shell-manual-contract',passed:observed.shell.passed,evidence:observed.shell});
  await writeJson(interactionPath,interactions);
  const validationPath=path.join(reportsOutput,'VALIDATION_SUMMARY.json');const validation=JSON.parse(await readFile(validationPath,'utf8'));
  validation.premiumEvidence={personas:observed.personas,queryBuilder:observed.queryBuilder,shell:observed.shell,requiredArtifacts:{expected:requiredFiles.length,missing}};
  validation.result=validation.result==='passed'&&missing.length===0&&consoleReport.result==='passed'&&observed.queryBuilder.passed&&observed.shell.passed&&observed.personas.length===6?'passed':'failed';
  await writeJson(validationPath,validation);
  const files=await listFiles(outputRoot);const entries=[];
  for(const file of files){const bytes=await readFile(file.absolute);entries.push({path:file.relative.split(path.sep).join('/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
  await writeJson(path.join(reportsOutput,'ARTIFACT_MANIFEST.json'),{schemaVersion:3,artifact:'qelly-ui-rescue-review',label:'Premium static visual preview',generatedAt:new Date().toISOString(),commit:reviewCommit,postPremiumEvidence:true,files:entries});
  assert(validation.result==='passed',`Premium evidence completion failed: ${JSON.stringify({missing,consoleReport,observed},null,2)}`);
}

await Promise.all([mkdir(implementationOutput,{recursive:true}),mkdir(reportsOutput,{recursive:true}),mkdir(figmaOutput,{recursive:true})]);
assert(await exists(frontendRoot),'dist/frontend is missing');
assert(await exists(path.join(reportsOutput,'VALIDATION_SUMMARY.json')),'premium review reports are missing');
const server=await startServer();let browser;
const observed={personas:[],queryBuilder:null,shell:null,errors:[],failures:[]};
try{
  browser=await chromium.launch({headless:true});
  await capturePersonas(browser,observed);
  await captureQueryBuilder(browser,observed);
  await inspectShell(browser,observed);
  await writeMasterFrameEvidence(browser);
  await finalizeReports(observed);
  console.log(JSON.stringify({status:'premium-evidence-completion-passed',commit:reviewCommit,personas:observed.personas.length,queryBuilder:observed.queryBuilder,shell:observed.shell},null,2));
}finally{
  if(browser)await browser.close();
  await new Promise((resolve,reject)=>server.close((error)=>error?reject(error):resolve()));
}
