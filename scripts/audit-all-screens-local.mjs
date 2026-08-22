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
const requestedRoutes=new Set(String(process.env.QELLY_AUDIT_ROUTES||'').split(',').map((item)=>item.trim()).filter(Boolean));
const auditRouteDefinitions=requestedRoutes.size?routeDefinitions.filter((item)=>requestedRoutes.has(item.route)):routeDefinitions;
if(requestedRoutes.size&&auditRouteDefinitions.length!==requestedRoutes.size)throw new Error('QELLY_AUDIT_ROUTES contains an unknown route');
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
    for(const definition of auditRouteDefinitions){
      const routeName=definition.route;
      const authenticated=!publicRoutes.has(routeName);
      const page=await contexts.get(authenticated).newPage();
      const errors=[];
      const observations=[];
      page.on('console',(message)=>{
        if(message.type()!=='error')return;
        const item={type:'console',text:message.text()};
        (/^Failed to load resource: the server responded with a status of (?:401|403|404)/.test(item.text)?observations:errors).push(item);
      });
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
      let heading=null,title=null,resolvedHash=null,overflowPx=null,pageHeightPx=null,uiAudit=null;
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
        uiAudit=await page.evaluate(({mobile})=>{
          const main=document.querySelector('main#main');
          const visible=(element)=>{
            const style=getComputedStyle(element),box=element.getBoundingClientRect();
            return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&box.width>0&&box.height>0;
          };
          const seconds=(value)=>String(value||'').split(',').reduce((maximum,item)=>{
            const token=item.trim();
            const number=Number.parseFloat(token)||0;
            return Math.max(maximum,token.endsWith('ms')?number/1000:number);
          },0);
          const accessibleName=(element)=>{
            const labelledBy=String(element.getAttribute('aria-labelledby')||'').trim().split(/\s+/).filter(Boolean).map((id)=>document.getElementById(id)?.textContent||'').join(' ');
            const labels='labels' in element?[...(element.labels||[])].map((label)=>label.textContent||'').join(' '):'';
            return [element.getAttribute('aria-label'),labelledBy,labels,element.getAttribute('title'),element.getAttribute('alt'),element.textContent,element.value,element.getAttribute('placeholder')].find((value)=>String(value||'').trim())||'';
          };
          const controls=[...document.querySelectorAll('button,a[href],input:not([type="hidden"]),select,textarea,summary,[role="button"],[role="tab"],[role="link"]')].filter(visible);
          const effectiveBox=(element)=>element.matches('input[type="checkbox"],input[type="radio"],input[type="file"]')&&element.closest('label')?element.closest('label').getBoundingClientRect():element.getBoundingClientRect();
          const unlabeled=controls.filter((element)=>!accessibleName(element)).map((element)=>element.outerHTML.slice(0,180));
          const smallTargets=mobile?controls.filter((element)=>{const box=effectiveBox(element);return box.width<44||box.height<44;}).map((element)=>{const box=effectiveBox(element);return{name:accessibleName(element).trim().slice(0,60),tag:element.tagName,width:Math.round(box.width),height:Math.round(box.height)};}):[];
          const tinyText=[...main.querySelectorAll('*')].filter((element)=>visible(element)&&element.children.length===0&&(element.textContent||'').trim()&&!element.closest('.sr-only,[aria-hidden="true"]')&&Number.parseFloat(getComputedStyle(element).fontSize)<12).map((element)=>({tag:element.tagName,text:element.textContent.trim().slice(0,70),fontSize:getComputedStyle(element).fontSize}));
          const headings=[...main.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible);
          const headingLevels=headings.map((element)=>Number(element.tagName[1]));
          const headingJumps=headingLevels.filter((level,index)=>index>0&&level>headingLevels[index-1]+1).length;
          const ids=[...document.querySelectorAll('[id]')].map((element)=>element.id).filter(Boolean);
          const duplicateIds=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
          const brokenAria=[...document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls]')].flatMap((element)=>['aria-labelledby','aria-describedby','aria-controls'].flatMap((attribute)=>String(element.getAttribute(attribute)||'').split(/\s+/).filter((id)=>id&&!document.getElementById(id)).map((id)=>({attribute,id,element:element.outerHTML.slice(0,140)}))));
          const imageIssues=[...document.images].flatMap((element)=>{
            const issues=[];
            if(!element.hasAttribute('alt'))issues.push({issue:'missing-alt',src:element.getAttribute('src')});
            if(!element.hasAttribute('width')||!element.hasAttribute('height'))issues.push({issue:'missing-dimensions',src:element.getAttribute('src')});
            if(element.complete&&(!element.naturalWidth||!element.naturalHeight))issues.push({issue:'broken-image',src:element.getAttribute('src')});
            return issues;
          });
          const svgIssues=[...document.querySelectorAll('svg')].filter(visible).filter((element)=>element.getAttribute('aria-hidden')!=='true'&&!(element.getAttribute('role')==='img'&&(element.getAttribute('aria-label')||element.querySelector('title')))).map((element)=>element.outerHTML.slice(0,160));
          const canvasIssues=[...document.querySelectorAll('canvas')].filter(visible).filter((element)=>!(element.getAttribute('aria-label')||element.getAttribute('aria-labelledby')||element.textContent?.trim())).map((element)=>element.outerHTML.slice(0,160));
          const motionIssues=[...document.querySelectorAll('*')].filter(visible).flatMap((element)=>{
            const style=getComputedStyle(element),animation=seconds(style.animationDuration),transition=seconds(style.transitionDuration);
            return animation>.01||transition>.01?[{tag:element.tagName,className:String(element.className||'').slice(0,80),animation,transition}]:[];
          });
          const clippedText=[...main.querySelectorAll('*')].filter((element)=>visible(element)&&(element.textContent||'').trim()&&element.scrollWidth>element.clientWidth+2&&['hidden','clip'].includes(getComputedStyle(element).overflowX)).map((element)=>({tag:element.tagName,text:element.textContent.trim().slice(0,70),clientWidth:element.clientWidth,scrollWidth:element.scrollWidth}));
          const placeholderEvidence=[...main.querySelectorAll('time')].filter((element)=>/^00:00(?::00)?$/.test((element.textContent||'').trim())&&!element.dateTime).map((element)=>element.outerHTML.slice(0,120));
          return {h1Count:headings.filter((element)=>element.tagName==='H1').length,headingJumps,unlabeled,smallTargets,tinyText,duplicateIds,brokenAria,imageIssues,svgIssues,canvasIssues,motionIssues,clippedText,placeholderEvidence,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};
        },{mobile:viewportName==='mobile'});
        if(!heading||['Unable to render this route.','Route unavailable','Qelly foundation failed to start'].includes(heading))errors.push({type:'semantic',text:`Invalid route heading: ${heading}`});
        if(title!==expectedTitle)errors.push({type:'route-identity',text:`Expected title ${expectedTitle}; received ${title}`});
        if(resolvedHash!==expectedHash)errors.push({type:'route-identity',text:`Expected hash ${expectedHash}; received ${resolvedHash}`});
        if(overflowPx>2)errors.push({type:'horizontal-overflow',text:`Document overflowed viewport by ${overflowPx}px`});
        const uiChecks=[
          ['heading-count',uiAudit.h1Count===1,`Expected one visible h1; received ${uiAudit.h1Count}`],
          ['heading-order',uiAudit.headingJumps===0,`Heading hierarchy skipped ${uiAudit.headingJumps} level(s)`],
          ['control-labels',uiAudit.unlabeled.length===0,`${uiAudit.unlabeled.length} visible control(s) lack an accessible name`],
          ['touch-targets',uiAudit.smallTargets.length===0,`${uiAudit.smallTargets.length} mobile target(s) are smaller than 44px`],
          ['text-size',uiAudit.tinyText.length===0,`${uiAudit.tinyText.length} visible text node(s) are smaller than 12px`],
          ['duplicate-ids',uiAudit.duplicateIds.length===0,`${uiAudit.duplicateIds.length} duplicate id(s) found`],
          ['aria-references',uiAudit.brokenAria.length===0,`${uiAudit.brokenAria.length} ARIA reference(s) target missing elements`],
          ['images',uiAudit.imageIssues.length===0,`${uiAudit.imageIssues.length} image accessibility or sizing issue(s) found`],
          ['svg-semantics',uiAudit.svgIssues.length===0,`${uiAudit.svgIssues.length} visible SVG(s) lack decorative or named-image semantics`],
          ['canvas-semantics',uiAudit.canvasIssues.length===0,`${uiAudit.canvasIssues.length} visible canvas element(s) lack a label or fallback`],
          ['reduced-motion',uiAudit.reducedMotion&&uiAudit.motionIssues.length===0,`${uiAudit.motionIssues.length} animation or transition(s) remain active with reduced motion`],
          ['placeholder-evidence',uiAudit.placeholderEvidence.length===0,`${uiAudit.placeholderEvidence.length} unlabeled zero-time evidence value(s) found`]
        ];
        for(const [type,passed,text] of uiChecks)if(!passed)errors.push({type,text});
        if(uiAudit.clippedText.length)observations.push({type:'clipped-text',count:uiAudit.clippedText.length,samples:uiAudit.clippedText.slice(0,5)});
        await page.screenshot({path:screenshot,fullPage:true,animations:'disabled'});
      }catch(error){
        errors.push({type:'render',text:error.message});
        await page.screenshot({path:screenshot,fullPage:true,animations:'disabled'}).catch(()=>{});
      }
      results.push({route:routeName,label:definition.label,section:definition.section,public:publicRoutes.has(routeName),authenticatedFixture:authenticated,viewport:viewportName,dimensions:viewport,heading,title,resolvedHash,expectedTitle,expectedHash,overflowPx,pageHeightPx,uiAudit,consoleErrors:errors,networkObservations:observations,status:errors.length?'failed':'passed',elapsedMs:Date.now()-started,file:path.relative(root,screenshot).split(path.sep).join('/')});
      await page.close();
    }
    for(const context of contexts.values())await context.close();
  }

  const failures=results.filter((item)=>item.status!=='passed');
  const report={schemaVersion:1,generatedAt:new Date().toISOString(),evidenceBoundary:'verified-governed-local-test-runtime',browserExecutable:executablePath??'playwright-managed',routeCount:auditRouteDefinitions.length,viewportCount:viewports.length,renderCount:results.length,passed:results.length-failures.length,failed:failures.length,consoleErrorCount:results.reduce((sum,item)=>sum+item.consoleErrors.length,0),authentication:{anonymousConfigAuthenticated:false,authenticatedConfigAuthenticated:true,authenticatedStatusAuthenticated:true,fixtureSession},status:failures.length?'failed':'passed',renders:results};
  await writeFile(path.join(outputRoot,'AUDIT_LOG.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify({status:report.status,routes:report.routeCount,renders:report.renderCount,passed:report.passed,failed:report.failed,consoleErrors:report.consoleErrorCount,browserExecutable:report.browserExecutable,failures:failures.slice(0,12)},null,2));
  if(failures.length)process.exitCode=1;
}finally{
  await browser?.close().catch(()=>{});
  if(server){server.server.closeIdleConnections?.();await new Promise((resolve)=>server.server.close(resolve));await closeRuntime(server.runtime);}
  await rm(runtimePath,{recursive:true,force:true});
  for(const [key,value] of priorEnvironment){if(value===undefined)delete process.env[key];else process.env[key]=value;}
}
