import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import { routeDefinitions } from '../apps/web/public/assets/route-registry.mjs';
import { closeRuntime, startServer } from '../src/server/server.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publicRoot=path.join(root,'dist','frontend');
const outputRoot=path.join(root,'outputs','qelly-all-screens-local-audit');
const runtimePath=await mkdtemp(path.join(os.tmpdir(),'qelly-all-screens-audit-'));
const expectedOrigin='https://qelly.test';
const fixtureSession='sess-local-primary';
const publicRoutes=new Set(routeDefinitions.filter((item)=>item.public===true).map((item)=>item.route));
const viewports=[['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]];
const criticalTypes=new Set(['document','script','stylesheet','font','image']);
const mime=new Map([
  ['.css','text/css; charset=utf-8'],['.js','application/javascript; charset=utf-8'],
  ['.mjs','application/javascript; charset=utf-8'],['.json','application/json; charset=utf-8'],
  ['.html','text/html; charset=utf-8'],['.svg','image/svg+xml'],['.png','image/png'],
  ['.jpg','image/jpeg'],['.jpeg','image/jpeg'],['.webp','image/webp'],['.ico','image/x-icon'],
  ['.woff','font/woff'],['.woff2','font/woff2'],['.webmanifest','application/manifest+json; charset=utf-8']
]);

const exists=async(file)=>access(file).then(()=>true,()=>false);
const browserCandidates=[
  process.env.QELLY_BROWSER_EXECUTABLE,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome'
].filter(Boolean);
let executablePath;
for(const candidate of browserCandidates){if(await exists(candidate)){executablePath=candidate;break;}}

if(!await exists(path.join(publicRoot,'index.html')))throw new Error('Built frontend is missing; run npm run build:frontend first.');
await mkdir(outputRoot,{recursive:true});
const sourceIndex=await readFile(path.join(publicRoot,'index.html'),'utf8');
const index=sourceIndex.replace('<head>','<head><base href="https://qelly.test/">');

const fixtureSeed=['qelly','all','screens','local','audit','0000001'].join('-');
const environment={
  ...process.env,
  NODE_ENV:'test',
  QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',
  QELLY_PRODUCTION_IDENTITY_ENABLED:'false',
  QELLY_DEVELOPMENT_IDENTITY_ENABLED:'true',
  QELLY_DEVELOPMENT_IDENTITY_EXPLICIT_HEADER_ONLY:'true',
  QELLY_DATABASE_MODE:'sqlite',
  QELLY_JOB_QUEUE_MODE:'database',
  QELLY_SESSION_SECRET:`${fixtureSeed}-session`,
  QELLY_PASSWORD_PEPPER:`${fixtureSeed}-pepper`,
  QELLY_EXPOSE_RECOVERY_CODE_IN_DEVELOPMENT:'false',
  QELLY_LIVE_MARKET_ENABLED:'false',
  QELLY_EXTERNAL_PROVIDERS_ENABLED:'false',
  QELLY_SECRET_KEYRING_JSON:JSON.stringify({old:`${fixtureSeed}-old-key-material`,active:`${fixtureSeed}-active-key-material`}),
  QELLY_SECRET_ACTIVE_KEY_ID:'active'
};
const priorEnvironment=new Map(Object.keys(environment).map((key)=>[key,process.env[key]]));
Object.assign(process.env,environment);

let server;
let browser;
const results=[];
try{
  server=await startServer({port:0,runtimePath,environment});
  const apiOrigin=`http://127.0.0.1:${server.port}`;
  const requestJson=async(pathname,authenticated=false)=>{
    const response=await fetch(`${apiOrigin}${pathname}`,{headers:authenticated?{'X-Qelly-Session-Id':fixtureSession}:{}});
    if(!response.ok)throw new Error(`${pathname} preflight returned ${response.status}`);
    return response.json();
  };
  const anonymousConfig=await requestJson('/api/v1/config');
  const authenticatedConfig=await requestJson('/api/v1/config',true);
  const authenticatedStatus=await requestJson('/api/v1/auth/status',true);
  if(anonymousConfig.auth?.authenticated!==false)throw new Error('Anonymous config preflight did not remain anonymous.');
  if(authenticatedConfig.auth?.authenticated!==true||authenticatedStatus.authenticated!==true)throw new Error('Authenticated fixture preflight failed.');

  browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
  for(const [viewportName,viewport] of viewports){
    const contexts=new Map();
    for(const authenticated of [false,true])contexts.set(authenticated,await browser.newContext({viewport,deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'}));
    for(const definition of routeDefinitions){
      const routeName=definition.route;
      const authenticated=!publicRoutes.has(routeName);
      const page=await contexts.get(authenticated).newPage();
      const errors=[];
      const observations=[];
      page.on('console',(message)=>{if(message.type()==='error')errors.push({type:'console',text:message.text()});});
      page.on('pageerror',(error)=>errors.push({type:'pageerror',text:error.message}));
      page.on('requestfailed',(request)=>{
        const item={type:'requestfailed',resourceType:request.resourceType(),url:request.url(),failure:request.failure()?.errorText??'unknown'};
        (criticalTypes.has(item.resourceType)?errors:observations).push(item);
      });
      page.on('response',(response)=>{
        if(response.status()<400)return;
        const item={type:'http',resourceType:response.request().resourceType(),status:response.status(),url:response.url()};
        (criticalTypes.has(item.resourceType)?errors:observations).push(item);
      });
      await page.route('**/*',async(route)=>{
        const request=route.request();
        const url=new URL(request.url());
        if(url.hostname==='qelly.test'&&(url.pathname==='/'||url.pathname==='/index.html')){
          await route.fulfill({status:200,contentType:'text/html; charset=utf-8',headers:{'cache-control':'no-store'},body:index});return;
        }
        if(url.hostname==='qelly.test'&&!url.pathname.startsWith('/api/')){
          const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '');
          const candidate=path.resolve(publicRoot,relative);
          if(candidate.startsWith(`${publicRoot}${path.sep}`)&&await exists(candidate)){
            await route.fulfill({status:200,contentType:mime.get(path.extname(candidate).toLowerCase())??'application/octet-stream',headers:{'cache-control':'no-store'},body:await readFile(candidate)});return;
          }
        }
        if(url.hostname==='unpkg.com'){
          await route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:'window.LightweightCharts=window.LightweightCharts||undefined;'});return;
        }
        if(url.hostname==='s3.tradingview.com'){
          observations.push({type:'external-isolation',resourceType:request.resourceType(),url:request.url(),detail:'External TradingView display script intentionally isolated from the governed local audit.'});
          await route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:'/* external TradingView display script intentionally isolated */'});return;
        }
        if(url.pathname.startsWith('/api/v1/stream/')){
          await route.fulfill({status:200,contentType:'text/event-stream; charset=utf-8',headers:{'cache-control':'no-cache'},body:'event: stream.heartbeat.v1\ndata: {"status":"qelly-local-audit"}\n\n'});return;
        }
        if(!authenticated&&url.pathname==='/api/v1/config'){
          await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify({...anonymousConfig,auth:{...anonymousConfig.auth,authenticated:false},defaultRoute:routeName})});return;
        }
        if(!authenticated&&url.pathname==='/api/v1/auth/status'){
          await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify({authenticated:false,mode:'anonymous-test-runtime',productionFoundation:{developmentIdentityEnabled:true}})});return;
        }
        const headers={...request.headers()};
        for(const name of ['host','content-length','accept-encoding','connection','origin','referer','cookie','x-qelly-session-id'])delete headers[name];
        if(authenticated)headers['x-qelly-session-id']=fixtureSession;
        const method=request.method();
        const response=await fetch(`${apiOrigin}${url.pathname}${url.search}`,{method,headers,body:['GET','HEAD'].includes(method)?undefined:request.postDataBuffer(),redirect:'manual'});
        const responseHeaders={};
        for(const [name,value] of response.headers)if(!['content-encoding','transfer-encoding','connection','content-length','set-cookie'].includes(name))responseHeaders[name]=value;
        await route.fulfill({status:response.status,headers:responseHeaders,body:method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer())});
      });

      const started=Date.now();
      const expectedTitle=`${definition.label} · Qelly Intelligence`;
      const expectedHash=`#/${routeName}`;
      const screenshot=path.join(outputRoot,`${routeName}__${viewportName}.png`);
      let heading=null,title=null,resolvedHash=null,overflowPx=null,pageHeightPx=null;
      try{
        await page.goto(`${expectedOrigin}/#/${routeName}`,{waitUntil:'domcontentloaded',timeout:30000});
        await page.locator('main#main h1').first().waitFor({state:'visible',timeout:20000});
        await page.waitForFunction(()=>document.querySelector('main#main')?.getAttribute('aria-busy')!=='true',null,{timeout:20000});
        await page.evaluate(()=>document.fonts?.ready);
        await page.waitForTimeout(300);
        heading=(await page.locator('main#main h1').first().textContent())?.trim()??null;
        title=await page.title();
        resolvedHash=await page.evaluate(()=>location.hash.split('?')[0]);
        overflowPx=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
        pageHeightPx=await page.evaluate(()=>document.documentElement.scrollHeight);
        if(!heading||['Unable to render this route.','Route unavailable','Qelly foundation failed to start'].includes(heading))errors.push({type:'semantic',text:`Invalid route heading: ${heading}`});
        if(title!==expectedTitle)errors.push({type:'route-identity',text:`Expected title ${expectedTitle}; received ${title}`});
        if(resolvedHash!==expectedHash)errors.push({type:'route-identity',text:`Expected hash ${expectedHash}; received ${resolvedHash}`});
        if(overflowPx>2)errors.push({type:'horizontal-overflow',text:`Document overflowed viewport by ${overflowPx}px`});
        await page.screenshot({path:screenshot,fullPage:true,animations:'disabled'});
      }catch(error){
        errors.push({type:'render',text:error.message});
        await page.screenshot({path:screenshot,fullPage:true,animations:'disabled'}).catch(()=>{});
      }
      results.push({route:routeName,label:definition.label,section:definition.section,public:publicRoutes.has(routeName),authenticatedFixture:authenticated,viewport:viewportName,dimensions:viewport,heading,title,resolvedHash,expectedTitle,expectedHash,overflowPx,pageHeightPx,consoleErrors:errors,networkObservations:observations,status:errors.length?'failed':'passed',elapsedMs:Date.now()-started,file:path.relative(root,screenshot).split(path.sep).join('/')});
      await page.close();
    }
    for(const context of contexts.values())await context.close();
  }

  const failures=results.filter((item)=>item.status!=='passed');
  const report={schemaVersion:1,generatedAt:new Date().toISOString(),evidenceBoundary:'verified-governed-local-test-runtime',browserExecutable:executablePath??'playwright-managed',routeCount:routeDefinitions.length,viewportCount:viewports.length,renderCount:results.length,passed:results.length-failures.length,failed:failures.length,consoleErrorCount:results.reduce((sum,item)=>sum+item.consoleErrors.length,0),authentication:{anonymousConfigAuthenticated:false,authenticatedConfigAuthenticated:true,authenticatedStatusAuthenticated:true,fixtureSession},status:failures.length?'failed':'passed',renders:results};
  await writeFile(path.join(outputRoot,'AUDIT_LOG.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify({status:report.status,routes:report.routeCount,renders:report.renderCount,passed:report.passed,failed:report.failed,consoleErrors:report.consoleErrorCount,browserExecutable:report.browserExecutable,failures:failures.slice(0,12)},null,2));
  if(failures.length)process.exitCode=1;
}finally{
  await browser?.close().catch(()=>{});
  if(server){server.server.closeIdleConnections?.();await new Promise((resolve)=>server.server.close(resolve));await closeRuntime(server.runtime);}
  await rm(runtimePath,{recursive:true,force:true});
  for(const [key,value] of priorEnvironment){if(value===undefined)delete process.env[key];else process.env[key]=value;}
}
