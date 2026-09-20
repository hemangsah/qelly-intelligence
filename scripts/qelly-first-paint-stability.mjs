import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startServer} from '../src/server/server.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist/frontend');
const out=path.join(root,'preview','first-paint-stability');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});

const runtime=await mkdtemp(path.join(tmpdir(),'qelly-first-paint-'));
const api=await startServer({port:0,runtimePath:runtime,environment:{
  ...process.env,NODE_ENV:'test',QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'true',
  QELLY_DEVELOPMENT_IDENTITY_ENABLED:'false',QELLY_DATABASE_MODE:'sqlite',QELLY_JOB_QUEUE_MODE:'database',
  QELLY_SESSION_SECRET:'qelly-first-paint-session-secret-000000000001',
  QELLY_PASSWORD_PEPPER:'qelly-first-paint-pepper',
  QELLY_LIVE_MARKET_ENABLED:'false',QELLY_EXTERNAL_PROVIDERS_ENABLED:'false',
  QELLY_SECRET_KEYRING_JSON:JSON.stringify({old:'old-secret-material-abcdefghijklmnopqrstuvwxyz',active:'active-secret-material-abcdefghijklmnopqrstuvwxyz'}),
  QELLY_SECRET_ACTIVE_KEY_ID:'active'
}});
const apiBase='http://127.0.0.1:'+api.port;

const mime=(file)=>file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')||file.endsWith('.mjs')?'application/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.json')?'application/json; charset=utf-8':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.woff2')?'font/woff2':'application/octet-stream';
const safePath=(pathname)=>{
  const decoded=decodeURIComponent(pathname);
  if(decoded.includes('..'))return null;
  return path.join(dist,decoded==='/'?'index.html':decoded.replace(/^\//,''));
};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname.startsWith('/api/')||url.pathname==='/methodology/verify'){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const headers={...req.headers};delete headers.host;delete headers['content-length'];delete headers.connection;
      const response=await fetch(apiBase+url.pathname+url.search,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks),redirect:'manual'});
      res.writeHead(response.status,Object.fromEntries([...response.headers].filter(([key])=>!['content-encoding','transfer-encoding','connection','content-length','set-cookie'].includes(key.toLowerCase()))));
      res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const target=safePath(url.pathname);if(!target){res.writeHead(400);res.end('bad path');return;}
    try{const body=await readFile(target);res.writeHead(200,{'Content-Type':mime(target),'Cache-Control':'no-store'});res.end(body);}
    catch{res.writeHead(404);res.end('not found');}
  }catch(error){res.writeHead(500,{'Content-Type':'text/plain'});res.end(String(error?.message||error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();const base='http://127.0.0.1:'+address.port;

const routes=[
  ['market','#/market'],['decision','#/decision-provenance'],['calculator','#/calculator-center'],
  ['india','#/india-finance'],['asset','#/asset/QI-CRYPTO-BTC']
];
const viewports=[['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]];
const samples=[0,100,250,500,1000,2000,4000,7000];
const legacySelectors=['.q-global-strip','.q-command-bar','.q-rail','.q-persona-ribbon','.q-context-shelf','.q-edge-dock','.q-compare-tray','.q-worldclass-context'];
const report={schemaVersion:1,generatedAt:new Date().toISOString(),releaseSha:process.env.QELLY_SCREEN_EVIDENCE_SHA||process.env.GITHUB_SHA||'local',samples,scenarios:[],status:'passed'};

const visibleCount=async(page,selector)=>page.locator(selector).evaluateAll(nodes=>nodes.filter(node=>{const style=getComputedStyle(node),box=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0&&box.width>0&&box.height>0;}).length);
const snapshot=async(page,elapsed)=>{
  const legacy={};for(const selector of legacySelectors)legacy[selector]=await visibleCount(page,selector);
  return {
    elapsedMs:elapsed,
    appReady:await page.locator('html').get_attribute('data-app-ready'),
    currentShells:await page.locator('[data-qelly-current-shell="true"]').count(),
    visibleProductHeaders:await visibleCount(page,'.q-product-header'),
    legacyCommandBars:await page.locator('.q-command-bar').count(),
    visibleLegacy:legacy,
    primaryNavCount:await page.locator('#q-product-navigation').count(),
    mainBusy:await page.locator('#main').get_attribute('aria-busy'),
    mainChildren:await page.locator('#main').evaluate(node=>node.childElementCount),
    heading:await page.locator('#main h1').first.text_content().catch(()=>null),
    title:await page.title(),
    stylesheetLinks:await page.locator('link[rel="stylesheet"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')))
  };
};

const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try{
  for(const [viewportName,viewport] of viewports){
    for(const [routeName,hash] of routes){
      const context=await browser.new_context({viewport,device_scale_factor:1,reduced_motion:'reduce'});
      const page=await context.new_page();
      const errors=[];page.on('pageerror',error=>errors.push(String(error)));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
      for(const mode of ['cold','warm']){
        const started=performance.now();
        if(mode==='cold')await page.goto(base+'/'+hash,{waitUntil:'domcontentloaded',timeout:20000});
        else await page.reload({waitUntil:'domcontentloaded',timeout:20000});
        const domLoaded=performance.now();
        const frames=[];
        for(const target of samples){
          const due=domLoaded+target;const wait=Math.max(0,due-performance.now());if(wait)await page.waitForTimeout(wait);
          const state=await snapshot(page,Math.round(performance.now()-domLoaded));frames.push(state);
          await page.screenshot({path:path.join(out,routeName+'__'+viewportName+'__'+mode+'__'+String(target).padStart(4,'0')+'.png'),animations:'disabled'});
        }
        const obsolete=frames.flatMap(frame=>Object.entries(frame.visibleLegacy).filter(([,count])=>count>0).map(([selector,count])=>({elapsedMs:frame.elapsedMs,selector,count})));
        const structural=frames.filter(frame=>frame.currentShells!==1||frame.visibleProductHeaders!==1||frame.legacyCommandBars!==0||frame.primaryNavCount!==1);
        const last=frames.at(-1);
        const passed=obsolete.length===0&&structural.length===0&&last.appReady==='true'&&last.mainChildren>0&&errors.length===0;
        report.scenarios.push({route:routeName,hash,viewport:viewportName,mode,navigationToDomContentLoadedMs:Math.round(domLoaded-started),frames,obsolete,structural,errors,status:passed?'passed':'failed'});
        if(!passed)report.status='failed';
      }
      await context.close();
    }
  }
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
  await new Promise(resolve=>api.server.close(resolve));
  await rm(runtime,{recursive:true,force:true});
}
await writeFile(path.join(out,'first-paint-stability.json'),JSON.stringify(report,null,2)+'\n');
const summary={status:report.status,scenarios:report.scenarios.length,failed:report.scenarios.filter(item=>item.status!=='passed').length,maxDomContentLoadedMs:Math.max(...report.scenarios.map(item=>item.navigationToDomContentLoadedMs)),maxReadyFrameMs:Math.max(...report.scenarios.map(item=>item.frames.find(frame=>frame.appReady==='true')?.elapsedMs??7001))};
console.log(JSON.stringify(summary,null,2));
if(report.status!=='passed')process.exit(1);
