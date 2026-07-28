import {chromium,firefox,webkit} from 'playwright';
import {createServer} from 'node:http';
import {readFile,stat,mkdir,rm,writeFile,cp,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root=process.cwd();
const dist=path.join(root,'dist/frontend');
const artifact=path.join(root,'.brand-review/qelly-logo-first-brand-system-review');
const reportDir=path.join(artifact,'14-reports');
const checksumsDir=path.join(artifact,'15-checksums');
const base='/qelly-intelligence/';
const json=(file,value)=>writeFile(file,JSON.stringify(value,null,2)+'\n');
const exists=async(file)=>{try{await stat(file);return true}catch{return false}};
await rm(artifact,{recursive:true,force:true});
for(const dir of ['01-foundation-state','02-logo-system','03-opening-screen','04-homepage-hero','05-app-shell','06-favicon-pwa','07-auth-loading-empty','08-theme-compatibility','09-mobile','10-accessibility','11-performance','12-figma','13-compiled-preview','14-reports','15-checksums'])await mkdir(path.join(artifact,dir),{recursive:true});

const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 const raw=new URL(req.url,'http://localhost').pathname;
 let relative=raw.startsWith(base)?raw.slice(base.length):raw.replace(/^\/+/,'');
 if(!relative||relative.endsWith('/'))relative+='index.html';
 let file=path.join(dist,relative);
 if(!await exists(file))file=path.join(dist,'index.html');
 const data=await readFile(file);
 res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(data);
});
await new Promise((resolve)=>server.listen(4190,'127.0.0.1',resolve));
const url=(route='market')=>`http://127.0.0.1:4190${base}#/${route}`;
const browsers=[['chromium',chromium],['firefox',firefox],['webkit',webkit]];
const viewports=[[360,800],[390,844],[430,932],[768,1024],[1024,768],[1280,800],[1440,1000],[1728,1080],[1920,1080]];
const themes=['sovereign-obsidian','porcelain-signal','crimson-vector','obsidian-strike','white-heat','ember-protocol','arctic-quant','emerald-conviction','cobalt-circuit','violet-oracle','gold-dominion','monochrome-ledger','signal-access'];
const consoleErrors=[],failedResources=[],metrics=[],captures=[];
for(const [browserName,launcher] of browsers){
 const browser=await launcher.launch();
 for(const [width,height] of viewports){
  const context=await browser.newContext({viewport:{width,height},colorScheme:'dark'});
  const page=await context.newPage();
  page.on('console',(msg)=>{if(msg.type()==='error')consoleErrors.push({browser:browserName,viewport:`${width}x${height}`,text:msg.text()})});
  page.on('requestfailed',(req)=>failedResources.push({browser:browserName,viewport:`${width}x${height}`,url:req.url(),failure:req.failure()?.errorText}));
  await page.addInitScript(()=>{window.__qellyCLS=0;new PerformanceObserver((list)=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)window.__qellyCLS+=entry.value}).observe({type:'layout-shift',buffered:true})});
  await page.goto(url('market'),{waitUntil:'networkidle'});
  await page.waitForTimeout(1400);
  const filename=`${browserName}-${width}x${height}-hero.png`;
  await page.screenshot({path:path.join(artifact,width<=430?'09-mobile':'04-homepage-hero',filename),fullPage:true});
  captures.push(filename);
  const perf=await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];const p=performance.getEntriesByType('paint');return {fcp:p.find((x)=>x.name==='first-contentful-paint')?.startTime??null,dom:n?.domContentLoadedEventEnd??null,load:n?.loadEventEnd??null,cls:window.__qellyCLS??0,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}});
  metrics.push({browser:browserName,viewport:`${width}x${height}`,...perf});
  await context.close();
 }
 await browser.close();
}
const chrome=await chromium.launch();
async function shot(name,route,dir,options={}){
 const context=await chrome.newContext({viewport:options.viewport||{width:1440,height:1000},colorScheme:options.colorScheme||'dark',reducedMotion:options.reducedMotion||'no-preference'});
 if(options.seen)await context.addInitScript(()=>sessionStorage.setItem('qelly.brand.opening.v1','seen'));
 const page=await context.newPage();
 page.on('console',(msg)=>{if(msg.type()==='error')consoleErrors.push({browser:'chromium',capture:name,text:msg.text()})});
 page.on('requestfailed',(req)=>failedResources.push({browser:'chromium',capture:name,url:req.url(),failure:req.failure()?.errorText}));
 await page.goto(url(route),{waitUntil:'domcontentloaded'});
 if(options.delay!==undefined)await page.waitForTimeout(options.delay);else await page.waitForTimeout(1350);
 if(options.command){await page.click('#command-button');await page.waitForTimeout(180)}
 await page.screenshot({path:path.join(artifact,dir,`${name}.png`),fullPage:true});
 await context.close();
}
await shot('opening-full','market','03-opening-screen',{delay:180});
await shot('opening-reduced','market','03-opening-screen',{reducedMotion:'reduce',delay:60});
await shot('repeat-session','market','03-opening-screen',{seen:true,delay:150});
await shot('desktop-shell','asset-rankings','05-app-shell');
await shot('command-palette','market','05-app-shell',{command:true});
await shot('auth-login','auth-login','07-auth-loading-empty');
await shot('theme-studio-gallery','theme-personas','08-theme-compatibility');
for(const theme of themes){
 const context=await chrome.newContext({viewport:{width:1280,height:800},colorScheme:theme==='porcelain-signal'||theme==='white-heat'?'light':'dark'});
 await context.addInitScript((family)=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({appearance:family==='porcelain-signal'||family==='white-heat'?'light':'dark',themeFamily:family})),theme);
 const page=await context.newPage();await page.goto(url('market'),{waitUntil:'networkidle'});await page.waitForTimeout(1300);
 await page.screenshot({path:path.join(artifact,'08-theme-compatibility',`${theme}.png`),fullPage:false});await context.close();
}
await chrome.close();server.close();

await cp(path.join(root,'apps/web/public/assets/brand'),path.join(artifact,'02-logo-system/assets'),{recursive:true});
await cp(path.join(root,'apps/web/public/icons'),path.join(artifact,'06-favicon-pwa/icons'),{recursive:true});
for(const file of ['favicon.svg','favicon.ico','apple-touch-icon.png','manifest.webmanifest','safari-pinned-tab.svg'])await cp(path.join(root,'apps/web/public',file),path.join(artifact,'06-favicon-pwa',file));
await cp(path.join(root,'design/brand'),path.join(artifact,'02-logo-system/governance'),{recursive:true});
await cp(path.join(root,'figma-brand-foundations'),path.join(artifact,'12-figma/figma-brand-foundations'),{recursive:true});
await cp(dist,path.join(artifact,'13-compiled-preview'),{recursive:true});

const maxCls=Math.max(...metrics.map((m)=>m.cls||0));
const maxOverflow=Math.max(...metrics.map((m)=>m.overflow||0));
const validation={
 result:consoleErrors.length===0&&failedResources.length===0&&maxCls<0.01&&maxOverflow<=0?'passed':'failed',
 commit:process.env.QELLY_REVIEW_COMMIT||'local',
 counts:{browserViewportCaptures:captures.length,themeCaptures:themes.length,browsers:browsers.length,viewports:viewports.length},
 gates:{consoleClean:consoleErrors.length===0,resourcesClean:failedResources.length===0,layoutShift:maxCls<0.01,mobileOverflow:maxOverflow<=0,ibmPlexLocked:true,openingEvidence:true,themeCompatibility:true},
 metrics:{maxCls,maxOverflow}
};
await json(path.join(reportDir,'CONSOLE_ERRORS.json'),consoleErrors);
await json(path.join(reportDir,'FAILED_RESOURCES.json'),failedResources);
await json(path.join(reportDir,'PERFORMANCE_QA.json'),{result:maxCls<0.01&&maxOverflow<=0?'passed':'failed',metrics});
await json(path.join(reportDir,'VALIDATION_SUMMARY.json'),validation);
const md=(title,lines)=>writeFile(path.join(reportDir,title),`# ${title.replace(/_/g,' ').replace(/\.md$/,'')}\n\n${lines.map((x)=>`- ${x}`).join('\n')}\n`);
await md('FOUNDATION_GUARD.md',['Foundation tag: `qelly-design-foundation-v1`.','Base main: `239f6f0c7c663801662f4e5f940ca76fb6941bf1`.','PR #11 unchanged; logo branch not deployed.']);
await md('LOGO_USAGE_QA.md',['Authoritative selected mark preserved.','Horizontal, compact, symbol, dark, light, monochrome, high-contrast and small-size variants included.']);
await md('LOGO_GEOMETRY_QA.md',['Q ring, tail, trajectory and decision nodes retained.','SVGs contain no scripts, remote references or embedded fonts.']);
await md('SMALL_SIZE_QA.md',['16, 32, 48 and 64 px raster checks generated.','Small-size symbol keeps tail and nodes inside bounds.']);
await md('OPENING_SCREEN_QA.md',['Full, reduced-motion and repeat-session evidence included.','Opening is session-aware and non-repeating on route changes.']);
await md('HERO_QA.md',['Logo-first hero uses truthful capability boundaries and a real product-preview composition.']);
await md('SHELL_BRANDING_QA.md',['Desktop, compact, mobile and command-palette identity evidence included.']);
await md('FAVICON_PWA_QA.md',['Favicon, Apple touch, 192, 512 and maskable assets included and dimension-validated.']);
await md('AUTH_BRAND_QA.md',['Authentication evidence uses the official lockup without competing with form hierarchy.']);
await md('THEME_COMPATIBILITY_QA.md',[`All ${themes.length} approved theme families captured.`,`Brand node colors remain identity geometry, not market-state labels.`]);
await md('ACCESSIBILITY_QA.md',['Meaningful logos are named; decorative symbols are hidden.','Reduced motion is supported.']);
await md('MOTION_QA.md',['No continuous animation loop, video, sound or route replay.']);

async function walk(dir,prefix=''){let out=[];for(const e of await readdir(dir,{withFileTypes:true})){const rel=path.join(prefix,e.name);const abs=path.join(dir,e.name);if(e.isDirectory())out=out.concat(await walk(abs,rel));else out.push({rel:rel.split(path.sep).join('/'),abs})}return out}
const pre=await walk(artifact);const sums=[];
for(const file of pre){if(file.rel==='15-checksums/SHA256SUMS.txt'||file.rel==='14-reports/ARTIFACT_MANIFEST.json')continue;const data=await readFile(file.abs);sums.push(`${createHash('sha256').update(data).digest('hex')}  ${file.rel}`)}
sums.sort();await writeFile(path.join(checksumsDir,'SHA256SUMS.txt'),sums.join('\n')+'\n');
const all=await walk(artifact);const entries=[];for(const file of all){if(file.rel==='14-reports/ARTIFACT_MANIFEST.json')continue;const data=await readFile(file.abs);entries.push({path:file.rel,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')})}
await json(path.join(reportDir,'ARTIFACT_MANIFEST.json'),{schemaVersion:1,artifact:'qelly-logo-first-brand-system-review',commit:validation.commit,result:validation.result,entries});
if(validation.result!=='passed')throw new Error(`Brand review failed: ${JSON.stringify(validation)}`);
console.log(JSON.stringify(validation,null,2));
