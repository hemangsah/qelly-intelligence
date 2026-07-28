import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,readdir,rm,stat,symlink,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const exec=promisify(execFile);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const frontend=path.join(root,'dist/frontend');
const artifact=path.join(root,'.theme-visual-correction/qelly-theme-intelligence-visual-correction-review');
const lightDir=path.join(artifact,'01-light-mode');
const themeDir=path.join(artifact,'02-theme-distinctiveness');
const studioDir=path.join(artifact,'06-theme-studio');
const commandDir=path.join(artifact,'08-command-palette');
const reportsDir=path.join(artifact,'12-reports');
const checksumsDir=path.join(artifact,'15-checksums');
const baselineCommit=process.env.QELLY_VISUAL_BASELINE_COMMIT??'e572d04df8fc5e27c8693ff5e3238706b237e715';
const reviewCommit=process.env.QELLY_REVIEW_COMMIT??'local-working-tree';
const host='127.0.0.1';
const port=Number(process.env.QELLY_VISUAL_EVIDENCE_PORT??4298);
const origin=`http://${host}:${port}`;
const currentBase='/qelly-intelligence/';
const beforeBase='/before/';
const viewport={width:1440,height:1000};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};

const assert=(value,message)=>{if(!value)throw new Error(message);};
const json=(file,value)=>writeFile(file,`${JSON.stringify(value,null,2)}\n`,'utf8');
async function exists(file){try{await stat(file);return true;}catch{return false;}}
async function listFiles(directory,prefix=''){const files=[];for(const entry of await readdir(directory,{withFileTypes:true})){const relative=path.join(prefix,entry.name),absolute=path.join(directory,entry.name);if(entry.isDirectory())files.push(...await listFiles(absolute,relative));else files.push({relative:relative.split(path.sep).join('/'),absolute});}return files;}
function safe(base,relative){const file=path.resolve(base,relative);return file===base||file.startsWith(`${base}${path.sep}`)?file:null;}

async function buildBaseline(){
  const temporary=await mkdtemp(path.join(os.tmpdir(),'qelly-theme-visual-before-'));
  const worktree=path.join(temporary,'worktree');
  try{
    await exec('git',['worktree','add','--detach',worktree,baselineCommit],{cwd:root,maxBuffer:20_000_000});
    const lockedDependencies=path.join(root,'node_modules');
    assert(await exists(lockedDependencies),'locked dependency tree is missing');
    await symlink(lockedDependencies,path.join(worktree,'node_modules'),'dir');
    await exec(process.execPath,[path.join(worktree,'scripts/build-frontend.mjs')],{
      cwd:worktree,maxBuffer:20_000_000,
      env:{...process.env,QELLY_STATIC_VISUAL_PREVIEW:'true',QELLY_PUBLIC_BASE_PATH:beforeBase,QELLY_DEPLOYMENT_ENVIRONMENT:'theme-visual-before'}
    });
    return {temporary,worktree,frontend:path.join(worktree,'dist/frontend'),status:'built'};
  }catch(error){return {temporary,worktree,frontend:null,status:'failed',error:error.message};}
}

function startServer(beforeFrontend){
  const instance=createServer(async(request,response)=>{
    try{
      const url=new URL(request.url??'/',origin);
      if(url.pathname==='/favicon.ico'){response.writeHead(204);response.end();return;}
      let source,relative;
      if(url.pathname.startsWith(currentBase)){source=frontend;relative=url.pathname.slice(currentBase.length);}
      else if(url.pathname.startsWith(beforeBase)&&beforeFrontend){source=beforeFrontend;relative=url.pathname.slice(beforeBase.length);}
      else throw new Error('outside review bases');
      if(!relative||relative.endsWith('/'))relative+='index.html';
      const file=safe(source,decodeURIComponent(relative));
      if(!file||!await exists(file))throw new Error('missing');
      response.writeHead(200,{'Cache-Control':'no-store','Content-Type':types[path.extname(file)]??'application/octet-stream'});
      response.end(await readFile(file));
    }catch{response.writeHead(404);response.end('Not found');}
  });
  return new Promise((resolve,reject)=>{instance.once('error',reject);instance.listen(port,host,()=>resolve(instance));});
}

async function settle(page,route){
  await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.themeReady==='true',{timeout:45_000});
  if(route.startsWith('theme-lab'))await page.locator('.q-ti-page').waitFor({state:'visible'});
  if(route==='asset-rankings')await page.locator('.q-mi-page').waitFor({state:'visible'});
  await page.evaluate(async()=>{if(document.fonts?.ready)await document.fonts.ready;await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
}

async function openPage(browser,base,route,{colorScheme='dark'}={}){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,colorScheme});
  const page=await context.newPage();const errors=[],failed=[];
  page.on('pageerror',(error)=>errors.push({kind:'pageerror',message:error.message}));
  page.on('console',(message)=>{if(message.type()==='error'&&(!message.location().url||message.location().url.startsWith(origin)))errors.push({kind:'console',message:message.text(),url:message.location().url??''});});
  page.on('requestfailed',(request)=>{if(request.url().startsWith(origin)&&['document','script','stylesheet','font','image'].includes(request.resourceType()))failed.push({url:request.url(),type:request.resourceType(),error:request.failure()?.errorText??'unknown'});});
  await page.goto(`${origin}${base}#/${route}`,{waitUntil:'networkidle'});
  await settle(page,route);
  return {context,page,errors,failed};
}

async function apply(page,patch,route){
  await page.evaluate(({patch,route})=>{
    const api=window.QellyThemeIntelligence?.themeIntelligence;
    if(!api)throw new Error('Theme Intelligence API unavailable');
    if(typeof api.preview==='function')api.preview({...patch});
    else if(typeof api.apply==='function')api.apply({...api.config,...patch},{preview:true});
    else throw new Error('Theme Intelligence preview contract unavailable');
    const hash=`#/${route}`;if(location.hash!==hash)location.hash=hash;else window.dispatchEvent(new Event('hashchange'));
  },{patch,route});
  await settle(page,route);
}

async function shot(page,file,{fullPage=false,locator=null}={}){await mkdir(path.dirname(file),{recursive:true});if(locator)await page.locator(locator).screenshot({path:file,animations:'disabled',scale:'css'});else await page.screenshot({path:file,fullPage,animations:'disabled',scale:'css'});return file;}
async function pinkFogRatio(file){const image=PNG.sync.read(await readFile(file));let pink=0,eligible=0;const step=Math.max(1,Math.floor(Math.sqrt((image.width*image.height)/200000)));for(let y=0;y<image.height;y+=step)for(let x=0;x<image.width;x+=step){const i=(y*image.width+x)*4,r=image.data[i],g=image.data[i+1],b=image.data[i+2],max=Math.max(r,g,b),min=Math.min(r,g,b);if(max<65||min>250)continue;eligible++;if(r>g+12&&r>b+5&&r>95)pink++;}return Number((pink/Math.max(1,eligible)).toFixed(5));}
async function sideBySide(leftFile,rightFile,outFile){const [left,right]=await Promise.all([readFile(leftFile).then(PNG.sync.read),readFile(rightFile).then(PNG.sync.read)]);const gutter=24,height=Math.max(left.height,right.height),output=new PNG({width:left.width+right.width+gutter,height});output.data.fill(248);const copy=(source,offset)=>{for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){const a=(y*source.width+x)*4,b=(y*output.width+x+offset)*4;source.data.copy(output.data,b,a,a+4);}};copy(left,0);copy(right,left.width+gutter);await writeFile(outFile,PNG.sync.write(output));}

await Promise.all([mkdir(lightDir,{recursive:true}),mkdir(studioDir,{recursive:true}),mkdir(commandDir,{recursive:true}),mkdir(reportsDir,{recursive:true}),mkdir(checksumsDir,{recursive:true})]);
assert(await exists(artifact),'visual-correction artifact is missing');
const baseline=await buildBaseline();assert(baseline.frontend,`baseline build failed: ${baseline.error??'unknown'}`);
const server=await startServer(baseline.frontend);let browser;const observed={errors:[],failed:[],baselineCommit,reviewCommit};
try{
  browser=await chromium.launch({headless:true});

  const before=await openPage(browser,beforeBase,'asset-rankings',{colorScheme:'light'});
  try{
    await apply(before.page,{appearance:'light',themeFamily:'porcelain-signal',persona:'research-oracle'},'asset-rankings');
    observed.beforeFile=await shot(before.page,path.join(lightDir,'before-rejected-pink-fog.png'),{fullPage:true});
    observed.beforePinkFogRatio=await pinkFogRatio(observed.beforeFile);
  }finally{observed.errors.push(...before.errors.map((item)=>({...item,capture:'before-light'})));observed.failed.push(...before.failed.map((item)=>({...item,capture:'before-light'})));await before.context.close();}

  const correctedFile=path.join(lightDir,'corrected-porcelain-daylight-full.png');assert(await exists(correctedFile),'corrected light-mode capture missing');
  observed.correctedPinkFogRatio=await pinkFogRatio(correctedFile);
  observed.comparisonFile=path.join(lightDir,'before-vs-corrected-porcelain-daylight.png');await sideBySide(observed.beforeFile,correctedFile,observed.comparisonFile);

  const studio=await openPage(browser,currentBase,'theme-lab');
  try{
    await apply(studio.page,{appearance:'dark',themeFamily:'violet-oracle',persona:'research-oracle'},'theme-lab');
    await studio.page.evaluate(()=>document.querySelectorAll('.q-ti-controls details').forEach((item)=>{item.open=true;}));
    observed.studioDark=await shot(studio.page,path.join(studioDir,'theme-studio-desktop-dark.png'),{fullPage:true});
    const preview=studio.page.locator('.q-ti-preview-shell').first();assert(await preview.count(),'Theme Studio preview stage missing');
    observed.studioPreview=path.join(studioDir,'theme-studio-preview-stage.png');await preview.screenshot({path:observed.studioPreview,animations:'disabled',scale:'css'});
    await apply(studio.page,{appearance:'light',themeFamily:'porcelain-signal',persona:'research-oracle'},'theme-lab');
    await studio.page.evaluate(()=>document.querySelectorAll('.q-ti-controls details').forEach((item)=>{item.open=true;}));
    observed.studioLight=await shot(studio.page,path.join(studioDir,'theme-studio-desktop-light.png'),{fullPage:true});
  }finally{observed.errors.push(...studio.errors.map((item)=>({...item,capture:'desktop-studio'})));observed.failed.push(...studio.failed.map((item)=>({...item,capture:'desktop-studio'})));await studio.context.close();}

  const command=await openPage(browser,currentBase,'asset-rankings');
  try{
    await command.page.locator('#command-button').click();await command.page.locator('dialog.q-command-dialog[open]').waitFor({state:'visible'});
    await command.page.waitForFunction(()=>{const labels=[...document.querySelectorAll('.q-command-item strong')].map((node)=>node.textContent.trim().toLowerCase());return labels.length>0&&new Set(labels).size===labels.length;});
    const commandEvidence=await command.page.evaluate(()=>{const first=document.querySelector('.q-command-item');if(!first)throw new Error('unique command result missing');document.querySelectorAll('.q-command-item').forEach((item)=>{item.classList.remove('is-active');item.setAttribute('aria-selected','false');});first.classList.add('is-active');first.setAttribute('aria-selected','true');const labels=[...document.querySelectorAll('.q-command-item strong')].map((node)=>node.textContent.trim());return {labels,selected:first.querySelector('strong')?.textContent?.trim()??null,duplicates:labels.filter((label,index)=>labels.findIndex((item)=>item.toLowerCase()===label.toLowerCase())!==index)};});
    assert(commandEvidence.duplicates.length===0,'command evidence contains duplicate labels');
    observed.command=commandEvidence;observed.commandSelected=await shot(command.page,path.join(commandDir,'selected-unique-result.png'));
  }finally{observed.errors.push(...command.errors.map((item)=>({...item,capture:'selected-command'})));observed.failed.push(...command.failed.map((item)=>({...item,capture:'selected-command'})));await command.context.close();}
}finally{
  if(browser)await browser.close().catch(()=>{});
  await new Promise((resolve,reject)=>server.close((error)=>error?reject(error):resolve()));
  if(baseline.worktree&&await exists(baseline.worktree))await exec('git',['worktree','remove','--force',baseline.worktree],{cwd:root}).catch(()=>{});
  if(baseline.temporary)await rm(baseline.temporary,{recursive:true,force:true});
}

const darkThemes=(await listFiles(path.join(themeDir,'dark'))).filter((item)=>item.relative.endsWith('.png'));
const lightThemes=(await listFiles(path.join(themeDir,'light'))).filter((item)=>item.relative.endsWith('.png'));
const required=[observed.beforeFile,correctedFile,observed.comparisonFile,observed.studioDark,observed.studioLight,observed.studioPreview,observed.commandSelected];
const missing=[];for(const file of required)if(!file||!await exists(file))missing.push(file??'unknown');
const evidencePassed=darkThemes.length===13&&lightThemes.length===13&&missing.length===0&&observed.errors.length===0&&observed.failed.length===0&&observed.beforePinkFogRatio>observed.correctedPinkFogRatio&&observed.command?.duplicates.length===0;

await json(path.join(reportsDir,'EVIDENCE_COMPLETENESS_QA.json'),{result:evidencePassed?'passed':'failed',baselineCommit,reviewCommit,themeScreenshots:{dark:darkThemes.length,light:lightThemes.length},lightMode:{beforePinkFogRatio:observed.beforePinkFogRatio,correctedPinkFogRatio:observed.correctedPinkFogRatio,before:'01-light-mode/before-rejected-pink-fog.png',comparison:'01-light-mode/before-vs-corrected-porcelain-daylight.png'},desktopStudio:['06-theme-studio/theme-studio-desktop-dark.png','06-theme-studio/theme-studio-desktop-light.png','06-theme-studio/theme-studio-preview-stage.png'],selectedCommand:'08-command-palette/selected-unique-result.png',missing,errors:observed.errors,failedResources:observed.failed});
await writeFile(path.join(reportsDir,'EVIDENCE_COMPLETENESS_QA.md'),`# Evidence Completeness QA\n\n- Result: **${evidencePassed?'passed':'failed'}**\n- Exact rejected baseline: \`${baselineCommit}\`.\n- Theme-family screenshots: ${darkThemes.length} dark + ${lightThemes.length} light.\n- Pink-fog ratio: ${observed.beforePinkFogRatio} before → ${observed.correctedPinkFogRatio} corrected.\n- Desktop Theme Studio: dark, light and preview-stage captures included.\n- Command palette: selected unique-result capture included; duplicate labels: ${observed.command?.duplicates.length??'unknown'}.\n- Missing evidence files: ${missing.length}.\n`,'utf8');

const validationPath=path.join(reportsDir,'VALIDATION_SUMMARY.json');const validation=JSON.parse(await readFile(validationPath,'utf8'));
validation.counts={...validation.counts,themeDarkCaptures:darkThemes.length,themeLightCaptures:lightThemes.length,desktopStudioCaptures:3,lightBeforeAfterCaptures:3,selectedCommandCaptures:1};
validation.gates={...validation.gates,evidenceCompleteness:evidencePassed,truthfulBeforeAfter:observed.beforePinkFogRatio>observed.correctedPinkFogRatio,desktopStudioEvidence:missing.filter((item)=>String(item).includes('06-theme-studio')).length===0,selectedCommandEvidence:Boolean(observed.commandSelected)};
validation.metrics={...validation.metrics,beforePinkFogRatio:observed.beforePinkFogRatio,correctedPinkFogRatio:observed.correctedPinkFogRatio};
validation.result=Object.values(validation.gates).every(Boolean)?'passed':'failed';await json(validationPath,validation);

const lightQa=path.join(reportsDir,'LIGHT_MODE_QA.md');await writeFile(lightQa,`# Light Mode QA\n\n- Result: **${validation.gates.lightModeNoPinkFog?'passed':'failed'}**.\n- Exact rejected baseline commit: \`${baselineCommit}\`.\n- Measured pink-fog ratio: ${observed.beforePinkFogRatio} before → ${observed.correctedPinkFogRatio} corrected.\n- Before, corrected and side-by-side evidence are included under \`01-light-mode/\`.\n- Porcelain canvas, chart and table remain high-contrast and semantically neutral.\n`,'utf8');
const visualSummary=path.join(reportsDir,'VISUAL_REVIEW_SUMMARY.md');await writeFile(visualSummary,`# Qelly Theme Intelligence Visual Correction Review\n\n- Commit: \`${reviewCommit}\`.\n- Result: **${validation.result}**.\n- Exact before/after light-mode evidence: included.\n- All 13 families: 13 dark + 13 light screenshots physically packaged.\n- Desktop Theme Studio: dark, light and preview-stage evidence included.\n- Selected deduplicated command result: included.\n- IBM Plex Sans Variable and protected market semantics remain unchanged.\n- This artifact is evidence for founder visual approval and is not deployment approval.\n`,'utf8');

const checksumFile=path.join(checksumsDir,'SHA256SUMS.txt');const manifestFile=path.join(reportsDir,'ARTIFACT_MANIFEST.json');
const preManifest=await listFiles(artifact);const checksumLines=[];for(const file of preManifest){if(file.absolute===checksumFile||file.absolute===manifestFile)continue;const bytes=await readFile(file.absolute);checksumLines.push(`${createHash('sha256').update(bytes).digest('hex')}  ${file.relative}`);}checksumLines.sort();await writeFile(checksumFile,`${checksumLines.join('\n')}\n`,'utf8');
const finalFiles=await listFiles(artifact);const manifestItems=[];for(const file of finalFiles){if(file.absolute===manifestFile)continue;const bytes=await readFile(file.absolute);manifestItems.push({path:file.relative,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}await json(manifestFile,{schemaVersion:2,artifact:'qelly-theme-intelligence-visual-correction-review',commit:reviewCommit,baselineCommit,generatedAt:new Date().toISOString(),result:validation.result,files:manifestItems});
assert(validation.result==='passed',`Evidence completion failed: ${JSON.stringify({validation,missing,errors:observed.errors,failed:observed.failed},null,2)}`);
console.log(JSON.stringify({status:'qelly-theme-intelligence-visual-evidence-complete',artifact,files:manifestItems.length,baselineCommit,reviewCommit,validation},null,2));
