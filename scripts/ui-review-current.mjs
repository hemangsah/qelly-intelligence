import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const frontendRoot=path.join(root,'dist/frontend');
const outputRoot=path.join(root,'.ui-review/qelly-current-review');
const screenshotsRoot=path.join(outputRoot,'screens');
const reportsRoot=path.join(outputRoot,'reports');
const host='127.0.0.1';
const port=Number(process.env.QELLY_UI_CURRENT_PORT??4183);
const origin=`http://${host}:${port}`;
const basePath='/qelly-intelligence/';
const routes=[
  'market','asset-rankings','asset','decision-provenance','feature-universe','about-qelly','theme-personas',
  'auth-login','auth-register','auth-recovery','calculator-center','india-finance','indicator-library','formula-library',
  'saved-calculations','formula-detail','indicator-detail','calculator-detail','saved-calculation-detail'
];
const viewports=[['desktop',1440,1000],['phone',390,844]];
const contentTypes={'.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.ico':'image/x-icon','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const freezeCss='html{scroll-behavior:auto!important}*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
function safeFile(relative){const file=path.resolve(frontendRoot,relative);return file===frontendRoot||file.startsWith(`${frontendRoot}${path.sep}`)?file:null;}
function startServer(){
  const server=createServer(async(request,response)=>{
    try{
      const url=new URL(request.url??'/',origin);
      if(url.pathname==='/favicon.ico'){response.writeHead(204);response.end();return;}
      if(!url.pathname.startsWith(basePath)){response.writeHead(404);response.end('Not found');return;}
      let relative=decodeURIComponent(url.pathname.slice(basePath.length));
      if(!relative||relative.endsWith('/'))relative+='index.html';
      const file=safeFile(relative);if(!file)throw new Error('Unsafe path');
      const body=await readFile(file);
      response.writeHead(200,{'Cache-Control':'no-store','Content-Type':contentTypes[path.extname(file)]??'application/octet-stream'});
      response.end(body);
    }catch{response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});response.end('Not found');}
  });
  return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>resolve(server));});
}

function observe(page,errors,failures){
  page.on('pageerror',(error)=>errors.push({kind:'pageerror',message:error.message}));
  page.on('console',(message)=>{if(message.type()!=='error')return;const location=message.location();if(location.url&&!location.url.startsWith(origin))return;if(location.url?.startsWith(`${origin}/api/`))return;errors.push({kind:'console',message:message.text(),sourceUrl:location.url??''});});
  page.on('requestfailed',(request)=>{if(!request.url().startsWith(origin))return;if(!['document','script','stylesheet','font','image'].includes(request.resourceType()))return;failures.push({kind:'requestfailed',url:request.url(),resourceType:request.resourceType(),errorText:request.failure()?.errorText??'unknown'});});
}

async function openRoute(browser,route,width,height){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,colorScheme:'dark',reducedMotion:'reduce'});
  const errors=[];const failures=[];const page=await context.newPage();observe(page,errors,failures);
  await page.goto(`${origin}${basePath}#/${route}`,{waitUntil:'domcontentloaded'});
  const main=page.locator(`#main[data-production-route="${route}"]`);
  await main.waitFor({state:'visible',timeout:30_000});
  await page.locator(`#main[data-production-route="${route}"] h1`).first().waitFor({state:'visible',timeout:30_000});
  await page.locator('html[data-production-system="v8"]').waitFor({state:'attached',timeout:30_000});
  await page.addStyleTag({content:freezeCss});
  await page.evaluate(async()=>{if(document.fonts?.ready)await document.fonts.ready;await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  return {context,page,errors,failures};
}

async function auditPage(page,route,phone){
  return page.evaluate(({expectedRoute,isPhone})=>{
    const main=document.querySelector('#main');
    const visible=(element)=>{const style=getComputedStyle(element),box=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&box.width>0&&box.height>0;};
    const headings=[...main.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible);
    const controls=[...main.querySelectorAll('button,a,input,select,textarea,summary,[role="button"],[role="tab"]')].filter(visible);
    const effectiveBox=(element)=>element.matches('input[type="checkbox"],input[type="radio"],input[type="file"]')&&element.closest('label')?element.closest('label').getBoundingClientRect():element.getBoundingClientRect();
    const unlabeled=controls.filter((element)=>!((element.getAttribute('aria-label')||element.getAttribute('title')||element.textContent||element.value||'').trim())&&!element.matches('input[type="hidden"]')&&!element.closest('label')).map((element)=>element.outerHTML.slice(0,180));
    const smallTargets=isPhone?controls.filter((element)=>{const box=effectiveBox(element);return box.width<44||box.height<44;}).map((element)=>{const box=effectiveBox(element);return{tag:element.tagName,text:(element.getAttribute('aria-label')||element.textContent||'').trim().slice(0,60),width:Math.round(box.width),height:Math.round(box.height)};}):[];
    const smallText=[...main.querySelectorAll('*')].filter((element)=>visible(element)&&element.children.length===0&&(element.textContent||'').trim()&&!element.closest('.sr-only,[aria-hidden="true"]')&&Number.parseFloat(getComputedStyle(element).fontSize)<12).map((element)=>({tag:element.tagName,text:element.textContent.trim().slice(0,60),fontSize:getComputedStyle(element).fontSize}));
    const levels=headings.map((heading)=>Number(heading.tagName[1]));
    return{
      route:main?.dataset.productionRoute,expectedRoute,
      h1Count:headings.filter((heading)=>heading.tagName==='H1').length,
      headingJumps:levels.filter((level,index)=>index&&level>levels[index-1]+1).length,
      pageOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
      routeError:Boolean(main?.querySelector('.q-route-error,[data-route-error]')),
      unlabeled,smallTargets,smallText
    };
  },{expectedRoute:route,isPhone:phone});
}

await Promise.all([mkdir(screenshotsRoot,{recursive:true}),mkdir(reportsRoot,{recursive:true})]);
assert((await stat(frontendRoot)).isDirectory(),'dist/frontend is missing');
const configText=await readFile(path.join(frontendRoot,'qelly-config.js'),'utf8');
assert(/"staticVisualPreview":true/.test(configText),'Current UI review requires the governed static-preview build');
const server=await startServer();let browser;
try{
  browser=await chromium.launch({headless:true});
  const results=[];const allErrors=[];const allFailures=[];
  for(const route of routes){
    const routeDirectory=path.join(screenshotsRoot,route);await mkdir(routeDirectory,{recursive:true});
    for(const [label,width,height] of viewports){
      const opened=await openRoute(browser,route,width,height);
      try{
        await opened.page.screenshot({path:path.join(routeDirectory,`${label}.png`),fullPage:true,animations:'disabled',scale:'css'});
        const audit=await auditPage(opened.page,route,label==='phone');
        const passed=audit.route===route&&audit.h1Count===1&&!audit.headingJumps&&!audit.pageOverflow&&!audit.routeError&&!audit.unlabeled.length&&!audit.smallTargets.length&&!audit.smallText.length&&!opened.errors.length&&!opened.failures.length;
        results.push({route,viewport:label,width,height,passed,audit,errors:opened.errors,failures:opened.failures});
        allErrors.push(...opened.errors.map((item)=>({...item,route,viewport:label})));
        allFailures.push(...opened.failures.map((item)=>({...item,route,viewport:label})));
      }finally{await opened.context.close();}
    }
  }
  const interaction=await openRoute(browser,'market',1440,1000);
  let commandPalette=false;
  try{
    await interaction.page.keyboard.press('Control+K');
    const dialog=interaction.page.locator('dialog.q-command-dialog[open]');
    await dialog.waitFor({state:'visible',timeout:10_000});
    commandPalette=true;
    await interaction.page.screenshot({path:path.join(screenshotsRoot,'command-palette.png'),animations:'disabled',scale:'css'});
  }finally{await interaction.context.close();}
  const failed=results.filter((result)=>!result.passed);
  const summary={status:failed.length||!commandPalette?'failed':'passed',generatedAt:new Date().toISOString(),routes:routes.length,viewports:viewports.length,screenshots:results.length,passed:results.length-failed.length,failed,commandPalette,errors:allErrors,failedResources:allFailures};
  await writeFile(path.join(reportsRoot,'summary.json'),`${JSON.stringify(summary,null,2)}\n`,'utf8');
  await writeFile(path.join(reportsRoot,'README.md'),`# Current Qelly UI review\n\n- Routes: ${routes.length}\n- Viewports: desktop 1440×1000 and phone 390×844\n- Screenshots: ${results.length}\n- Passed: ${results.length-failed.length}\n- Command palette: ${commandPalette?'passed':'failed'}\n- Result: ${summary.status}\n`,'utf8');
  assert(summary.status==='passed',`Current UI review failed: ${JSON.stringify(failed,null,2)}`);
  console.log(JSON.stringify({status:'current-ui-review-passed',routes:routes.length,screenshots:results.length,commandPalette},null,2));
}finally{
  if(browser)await browser.close();
  await new Promise((resolve,reject)=>server.close((error)=>error?reject(error):resolve()));
}
