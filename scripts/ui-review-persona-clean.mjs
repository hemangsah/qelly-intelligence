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
const host='127.0.0.1';
const port=Number(process.env.QELLY_UI_PERSONA_CLEAN_PORT??4177);
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
async function renderPersona(browser,value,slug,label){
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,colorScheme:'dark'});
  const errors=[];const failures=[];const page=await context.newPage();
  page.on('pageerror',(error)=>errors.push({kind:'pageerror',message:error.message}));
  page.on('console',(message)=>{if(message.type()!=='error')return;const location=message.location();if(location.url&&!location.url.startsWith(origin))return;errors.push({kind:'console',message:message.text(),sourceUrl:location.url??''});});
  page.on('requestfailed',(request)=>{if(!request.url().startsWith(origin))return;if(!['document','script','stylesheet','font','image'].includes(request.resourceType()))return;failures.push({kind:'requestfailed',url:request.url(),resourceType:request.resourceType(),errorText:request.failure()?.errorText??'unknown'});});
  try{
    await page.goto(reviewUrl,{waitUntil:'networkidle'});
    await page.locator('.q-mi-page').waitFor({state:'visible'});
    await page.addStyleTag({content:'.q-toast-stack{display:none!important}.q-toast{display:none!important}'});
    await page.locator('#global-theme-selector').selectOption(value);
    await page.locator(`html[data-theme="${value}"]`).waitFor({state:'attached'});
    await page.evaluate(async()=>{document.querySelectorAll('.q-toast-stack,.q-toast').forEach((node)=>node.remove());if(document.fonts?.ready)await document.fonts.ready;await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
    const evidence=await page.evaluate(()=>({
      theme:document.documentElement.dataset.theme,
      persona:document.documentElement.dataset.persona,
      title:document.querySelector('.q-mi-page-head h1')?.textContent,
      visibleToasts:[...document.querySelectorAll('.q-toast,.q-toast-stack')].filter((node)=>getComputedStyle(node).display!=='none').length,
      pageOverflow:document.documentElement.scrollWidth>innerWidth+1
    }));
    const passed=evidence.theme===value&&evidence.visibleToasts===0&&!evidence.pageOverflow&&evidence.title==='Asset rankings';
    await page.screenshot({path:path.join(implementationOutput,`persona-${slug}.png`),animations:'disabled',scale:'css'});
    return {value,slug,label,passed,evidence,errors,failures};
  }finally{await context.close();}
}
async function listFiles(directory,prefix=''){
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const relative=path.join(prefix,entry.name);const absolute=path.join(directory,entry.name);
    if(entry.isDirectory())files.push(...await listFiles(absolute,relative));else if(relative.split(path.sep).join('/')!=='reports/ARTIFACT_MANIFEST.json')files.push({relative,absolute});
  }
  return files;
}
async function updateReports(results){
  const allPassed=results.length===6&&results.every((item)=>item.passed&&item.errors.length===0&&item.failures.length===0);
  const interactionsPath=path.join(reportsOutput,'INTERACTIONS.json');const interactions=JSON.parse(await readFile(interactionsPath,'utf8'));
  interactions.checks=interactions.checks.filter((item)=>item.name!=='clean-persona-captures');
  interactions.checks.push({name:'clean-persona-captures',passed:allPassed,evidence:results});
  await writeJson(interactionsPath,interactions);
  const validationPath=path.join(reportsOutput,'VALIDATION_SUMMARY.json');const validation=JSON.parse(await readFile(validationPath,'utf8'));
  validation.premiumEvidence.cleanPersonaCaptures={passed:allPassed,results};
  validation.result=validation.result==='passed'&&allPassed?'passed':'failed';
  await writeJson(validationPath,validation);
  const consolePath=path.join(reportsOutput,'CONSOLE_ERRORS.json');const consoleReport=JSON.parse(await readFile(consolePath,'utf8'));
  for(const result of results){consoleReport.errors.push(...result.errors.map((item)=>({...item,capture:`persona-${result.slug}`})));consoleReport.failedResources.push(...result.failures.map((item)=>({...item,capture:`persona-${result.slug}`})));}
  consoleReport.result=consoleReport.errors.length||consoleReport.failedResources.length?'failed':'passed';
  await writeJson(consolePath,consoleReport);
  const files=await listFiles(outputRoot);const entries=[];
  for(const file of files){const bytes=await readFile(file.absolute);entries.push({path:file.relative.split(path.sep).join('/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
  await writeJson(path.join(reportsOutput,'ARTIFACT_MANIFEST.json'),{schemaVersion:4,artifact:'qelly-ui-rescue-review',label:'Premium static visual preview',generatedAt:new Date().toISOString(),commit:reviewCommit,cleanPersonaEvidence:true,files:entries});
  assert(validation.result==='passed'&&consoleReport.result==='passed',`Clean persona evidence failed: ${JSON.stringify(results,null,2)}`);
}

await Promise.all([mkdir(implementationOutput,{recursive:true}),mkdir(reportsOutput,{recursive:true})]);
assert(await exists(frontendRoot),'dist/frontend is missing');
assert(await exists(path.join(reportsOutput,'VALIDATION_SUMMARY.json')),'premium reports are missing');
const server=await startServer();let browser;
try{
  browser=await chromium.launch({headless:true});
  const results=[];
  for(const persona of personas)results.push(await renderPersona(browser,...persona));
  await updateReports(results);
  console.log(JSON.stringify({status:'clean-persona-captures-passed',commit:reviewCommit,personas:results},null,2));
}finally{
  if(browser)await browser.close();
  await new Promise((resolve,reject)=>server.close((error)=>error?reject(error):resolve()));
}
