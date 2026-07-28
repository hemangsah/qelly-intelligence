import {chromium,firefox,webkit} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,rm,cp,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {PNG} from 'pngjs';

const root=process.cwd();
const dist=path.join(root,'dist/frontend');
const retainedArtifact=path.join(root,'.brand-review/qelly-logo-first-brand-system-review');
const outputRoot=path.join(root,'.brand-visual-correction');
const artifact=path.join(outputRoot,'qelly-logo-first-brand-system-visual-correction-review');
const evidenceDir=path.join(artifact,'16-human-readable-evidence');
const reportDir=path.join(artifact,'17-visual-correction-reports');
const checksumDir=path.join(artifact,'18-visual-correction-checksums');
const exactZip=path.join(outputRoot,'qelly-logo-first-brand-system-visual-correction-review.zip');
const pdfName='QELLY_PR13_FINAL_VISUAL_CORRECTION_INSPECTION.pdf';
const pdfPath=path.join(outputRoot,pdfName);
const compiledZip=path.join(outputRoot,'qelly-logo-compiled-preview.zip');
const startingHead='88aaec22470f1417db0b45509d4bf69bb0f44bb7';
const reviewCommit=process.env.QELLY_REVIEW_COMMIT||'local';
const base='/qelly-intelligence/';
const appPort=4175;
const artifactPort=4176;
const browsers=[['chromium',chromium],['firefox',firefox],['webkit',webkit]];
const mobileViewports=[[360,800],[390,844],[430,932]];
const requiredViewports=[[360,800],[390,844],[430,932],[768,1024],[1024,768],[1280,800],[1440,1000],[1728,1080],[1920,1080]];
const themes=['sovereign-obsidian','porcelain-signal','crimson-vector','obsidian-strike','white-heat','ember-protocol','arctic-quant','emerald-conviction','cobalt-circuit','violet-oracle','gold-dominion','monochrome-ledger','signal-access'];
const telemetry={consoleErrors:[],pageErrors:[],failedResources:[],rendererFailures:[]};
const evidence=[];
const trailing=[];
const contrast=[];
const opening=[];
const appearanceRecords=[];
let appServer;
let artifactServer;

const exists=async(file)=>{try{await stat(file);return true}catch{return false}};
const sha256=(data)=>createHash('sha256').update(data).digest('hex');
const json=(file,value)=>writeFile(file,`${JSON.stringify(value,null,2)}\n`);
const clean=(value)=>String(value).replace(/[^a-z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase();
const appUrl=(route='market')=>`http://127.0.0.1:${appPort}${base}#/${route}`;
const rel=(file)=>path.relative(artifact,file).split(path.sep).join('/');

async function walk(directory,prefix=''){
  const output=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const relative=path.join(prefix,entry.name);const absolute=path.join(directory,entry.name);
    if(entry.isDirectory())output.push(...await walk(absolute,relative));
    else if(entry.isFile())output.push({rel:relative.split(path.sep).join('/'),abs:absolute});
  }
  return output;
}

function mime(file){return ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8','.md':'text/markdown; charset=utf-8','.pdf':'application/pdf'})[path.extname(file).toLowerCase()]||'application/octet-stream'};
async function serve(directory,port,prefix=base){
  const resolved=path.resolve(directory);
  const server=createServer(async(request,response)=>{
    try{
      const requestedUrl=new URL(request.url,`http://127.0.0.1:${port}`);
      let relative=requestedUrl.pathname;
      if(prefix&&relative.startsWith(prefix))relative=relative.slice(prefix.length);else relative=relative.replace(/^\/+/, '');
      if(!relative||relative.endsWith('/'))relative+='index.html';
      let file=path.resolve(resolved,relative);
      if(file!==resolved&&!file.startsWith(`${resolved}${path.sep}`)){response.writeHead(403);response.end('Forbidden');return;}
      if(!await exists(file))file=path.join(resolved,'index.html');
      const data=await readFile(file);response.writeHead(200,{'content-type':mime(file),'cache-control':'no-store','x-content-type-options':'nosniff'});response.end(data);
    }catch(error){response.writeHead(500,{'content-type':'text/plain'});response.end(error.message);}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
  return server;
}

function attachTelemetry(page,meta){
  let active=true;
  page.on('console',(message)=>{if(active&&message.type()==='error')telemetry.consoleErrors.push({...meta,text:message.text(),location:message.location()})});
  page.on('pageerror',(error)=>{if(active)telemetry.pageErrors.push({...meta,message:error.message,stack:error.stack||null})});
  page.on('requestfailed',(request)=>{if(active)telemetry.failedResources.push({...meta,url:request.url(),failure:request.failure()?.errorText||'unknown'})});
  return()=>{active=false};
}

async function installInit(context,{appearance='dark',themeFamily='sovereign-obsidian',seen=true,holdOpening=false}={}){
  await context.addInitScript(({appearance,themeFamily,seen,holdOpening})=>{
    localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance,themeFamily,persona:'quant-operator',mindset:'Model Discipline',motion:'full',fontScale:100}));
    if(seen)sessionStorage.setItem('qelly.brand.opening.v1','seen');
    const apply=()=>{const html=document.documentElement;if(!html)return false;if(holdOpening)html.dataset.qellyReviewHoldOpening='true';return true};
    if(!apply()){const observer=new MutationObserver(()=>{if(apply())observer.disconnect()});observer.observe(document,{childList:true,subtree:true});}
    window.__qellyFirstTheme={appearance,themeFamily,at:performance.now()};
  },{appearance,themeFamily,seen,holdOpening});
}

async function gotoReady(page,route){
  const documentUrl=appUrl(route).split('#')[0];
  await page.goto(documentUrl,{waitUntil:'domcontentloaded',timeout:30000});
  await page.evaluate((target)=>{if(!location.hash.replace(/^#\/?/,'').startsWith(target))location.hash=`#/${target}`},route);
  await page.waitForFunction((target)=>{
    const html=document.documentElement;const main=document.getElementById('main');const current=location.hash.replace(/^#\/?/,'').split('/')[0]||'market';
    return html.dataset.appReady==='true'&&html.dataset.brandReady==='true'&&html.dataset.brandVisualCorrectionReady==='true'&&main&&main.getAttribute('aria-busy')==='false'&&main.childElementCount>0&&current===target;
  },route,{timeout:35000});
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))});
  await page.locator('.qelly-opening').waitFor({state:'detached',timeout:3500}).catch(()=>page.evaluate(()=>document.querySelector('.qelly-opening')?.remove()));
}

async function pageMetrics(page){
  return page.evaluate(()=>{
    const html=document.documentElement,body=document.body,main=document.getElementById('main');
    const scrollHeight=Math.max(html.scrollHeight,body?.scrollHeight||0);
    const meaningful=[...(main?.querySelectorAll('*')||[])].filter((element)=>{
      const style=getComputedStyle(element);const rect=element.getBoundingClientRect();
      if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0||rect.width<1||rect.height<1||style.position==='fixed')return false;
      if(element.matches('img,svg,canvas,table,button,input,select,textarea,[role="button"],[role="img"]'))return true;
      return element.children.length===0&&Boolean((element.textContent||'').trim());
    });
    const lastMeaningfulBottom=Math.max(0,...meaningful.map((element)=>element.getBoundingClientRect().bottom+scrollY));
    const nav=document.querySelector('.q-mobile-navigation');const navStyle=nav?getComputedStyle(nav):null;const navHeight=nav&&navStyle.display!=='none'?nav.getBoundingClientRect().height:0;
    const excessTrailingPx=Math.max(0,Math.round(scrollHeight-lastMeaningfulBottom));
    const navigationOverlapPx=Math.max(0,Math.round(lastMeaningfulBottom-(scrollHeight-navHeight)));
    return {
      viewport:{width:innerWidth,height:innerHeight},scrollHeight,lastMeaningfulBottom:Math.round(lastMeaningfulBottom),excessTrailingPx,navigationHeight:Math.round(navHeight),navigationOverlapPx,
      horizontalOverflowPx:Math.max(0,Math.round(html.scrollWidth-html.clientWidth),Math.round((body?.scrollWidth||0)-html.clientWidth)),
      resolvedAppearance:html.dataset.resolvedAppearance,requestedAppearance:html.dataset.appearance,themeFamily:html.dataset.themeFamily,
      fontFamily:getComputedStyle(body).fontFamily,fontStatus:document.fonts.status,
      brandLockups:[...document.querySelectorAll('.q-brand-home img:not([style*="display: none"])')].filter((node)=>getComputedStyle(node).display!=='none').length,
      intrinsicLogos:[...document.querySelectorAll('img[src*="qelly-"]')].map((image)=>({className:image.className,width:image.getAttribute('width'),height:image.getAttribute('height'),naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight})),
      fixedElements:[...document.querySelectorAll('body *')].filter((element)=>getComputedStyle(element).position==='fixed'&&getComputedStyle(element).display!=='none').map((element)=>({className:String(element.className||''),bottom:Math.round(element.getBoundingClientRect().bottom),top:Math.round(element.getBoundingClientRect().top)}))
    };
  });
}

async function captureViewport(page,file,title,description,{scroll='top',fullPage=false}={}){
  if(scroll==='middle')await page.evaluate(()=>scrollTo(0,Math.max(0,(document.documentElement.scrollHeight-innerHeight)/2)));
  if(scroll==='bottom')await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
  if(scroll==='top')await page.evaluate(()=>scrollTo(0,0));
  await page.evaluate(()=>new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:file,fullPage,timeout:30000});
  evidence.push({title,description,path:rel(file),supplemental:fullPage});
}

async function openPage(browserName,launcher,{route='market',viewport={width:1440,height:1000},appearance='dark',themeFamily='sovereign-obsidian',prepare=null,captures=[],recordTrailing=false}={}){
  const meta={browser:browserName,route,viewport:`${viewport.width}x${viewport.height}`,appearance,themeFamily};
  let browser,context,page,stop;
  try{
    browser=await launcher.launch();context=await browser.newContext({viewport,colorScheme:appearance==='light'?'light':'dark'});await installInit(context,{appearance,themeFamily,seen:true});page=await context.newPage();stop=attachTelemetry(page,meta);await gotoReady(page,route);
    if(prepare)await prepare(page);
    for(const item of captures)await captureViewport(page,path.join(evidenceDir,item.file),item.title,item.description,item.options||{});
    const metrics=await pageMetrics(page);appearanceRecords.push({...meta,...metrics});
    if(recordTrailing)trailing.push({...meta,...metrics,result:metrics.excessTrailingPx<=viewport.height&&metrics.navigationOverlapPx<=1&&metrics.horizontalOverflowPx<=1?'passed':'failed'});
    stop();await context.close();await browser.close();return metrics;
  }catch(error){stop?.();telemetry.rendererFailures.push({...meta,error:error.message,stack:error.stack||null});await context?.close().catch(()=>{});await browser?.close().catch(()=>{});return null;}
}

function colorChannels(value){const match=String(value).match(/[\d.]+/g);return match?match.slice(0,3).map(Number):[0,0,0]}
function luminanceRgb(value){const c=colorChannels(value).map((x)=>x/255).map((x)=>x<=.03928?x/12.92:((x+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]}
function ratio(a,b){const x=luminanceRgb(a),y=luminanceRgb(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
async function collectContrast(page,appearance){
  const rows=await page.evaluate(()=>{
    const selectors={heroParagraph:'.qelly-hero p:not(.q-eyebrow)',heroDisclaimer:'.qelly-hero__truth',eyebrow:'.qelly-hero .q-eyebrow',previewLabel:'.qelly-product-preview__metric small',previewValue:'.qelly-product-preview__metric strong',secondaryRow:'.qelly-product-preview__row span:not(.q-positive):not(.q-negative)'};
    return Object.fromEntries(Object.entries(selectors).map(([name,selector])=>{const node=document.querySelector(selector);if(!node)return[name,null];const style=getComputedStyle(node);let background=style.backgroundColor;let parent=node.parentElement;while((!background||background==='rgba(0, 0, 0, 0)')&&parent){background=getComputedStyle(parent).backgroundColor;parent=parent.parentElement;}return[name,{foreground:style.color,background}]}));
  });
  for(const [name,value] of Object.entries(rows)){if(!value)continue;const measured=Number(ratio(value.foreground,value.background).toFixed(2));contrast.push({appearance,name,...value,ratio:measured,threshold:4.5,result:measured>=4.5?'passed':'failed'});}
}

async function captureDarkLight(){
  for(const appearance of ['dark','light']){
    const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:appearance});await installInit(context,{appearance,themeFamily:appearance==='light'?'porcelain-signal':'sovereign-obsidian',seen:true});const page=await context.newPage();const stop=attachTelemetry(page,{browser:'chromium',route:'market',viewport:'1440x1000',appearance});await gotoReady(page,'market');
    const prefix=appearance==='light'?'genuine-homepage-light':'homepage-dark';
    await captureViewport(page,path.join(evidenceDir,`${prefix}-above-fold.png`),appearance==='light'?'Genuine porcelain homepage — above the fold':'Homepage dark — above the fold','Readable viewport crop with complete shell and hero.',{scroll:'top'});
    await captureViewport(page,path.join(evidenceDir,`${prefix}-middle.png`),appearance==='light'?'Genuine porcelain homepage — middle':'Homepage dark — middle','Readable middle-page crop.',{scroll:'middle'});
    await captureViewport(page,path.join(evidenceDir,`${prefix}-bottom.png`),appearance==='light'?'Genuine porcelain homepage — bottom':'Homepage dark — bottom','Readable bottom-page crop with final meaningful content and navigation clearance.',{scroll:'bottom'});
    await captureViewport(page,path.join(evidenceDir,`${prefix}-full-thumbnail.png`),appearance==='light'?'Genuine porcelain homepage — full thumbnail':'Homepage dark — full thumbnail','Supplemental full-page context only.',{scroll:'top',fullPage:true});
    await collectContrast(page,appearance);
    appearanceRecords.push({browser:'chromium',route:'market',viewport:'1440x1000',appearance,...await pageMetrics(page)});stop();await context.close();await browser.close();
  }
}

async function meanLuminance(file){
  const png=PNG.sync.read(await readFile(file));let sum=0,count=0;
  for(let i=0;i<png.data.length;i+=4){if(png.data[i+3]<16)continue;sum+=(.2126*png.data[i]+.7152*png.data[i+1]+.0722*png.data[i+2])/255;count++;}
  return count?sum/count:0;
}

async function openingEvidence(browserName,launcher){
  for(const mode of ['full-motion','reduced','repeat-session']){
    const reduced=mode==='reduced',repeat=mode==='repeat-session';const meta={browser:browserName,mode,viewport:'1440x1000'};let browser,context,page,stop;
    try{
      browser=await launcher.launch();context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',reducedMotion:reduced?'reduce':'no-preference'});await installInit(context,{appearance:'dark',themeFamily:'sovereign-obsidian',seen:repeat,holdOpening:!repeat});page=await context.newPage();stop=attachTelemetry(page,meta);const navigationStarted=Date.now();await page.goto(appUrl('market'),{waitUntil:'domcontentloaded',timeout:30000});
      if(repeat){await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true',{timeout:35000});const count=await page.locator('.qelly-opening').count();opening.push({...meta,overlayFrames:count,durationMs:Date.now()-navigationStarted,result:count===0?'passed':'failed'});}
      else{
        const overlay=page.locator('.qelly-opening');await overlay.waitFor({state:'visible',timeout:3000});const started=Date.now();
        if(browserName==='chromium'&&mode==='full-motion'){
          await page.waitForTimeout(70);await captureViewport(page,path.join(evidenceDir,'opening-full-01-symbol.png'),'Full-motion opening — symbol','Opening begins with the approved Q symbol.',{});
          await page.waitForTimeout(390);await captureViewport(page,path.join(evidenceDir,'opening-full-02-transition.png'),'Full-motion opening — transition','Symbol resolves into the horizontal lockup without leaving two complete marks stacked.',{});
          await page.waitForTimeout(360);await captureViewport(page,path.join(evidenceDir,'opening-full-03-final-lockup.png'),'Full-motion opening — final lockup','One crisp, optically centered horizontal Qelly lockup.',{});
        }
        if(browserName==='chromium'&&mode==='reduced'){await page.waitForTimeout(20);await captureViewport(page,path.join(evidenceDir,'opening-reduced-final-lockup.png'),'Reduced-motion opening — single final lockup','Reduced motion shows one clean horizontal lockup with no standalone duplicate Q.',{});}
        const configuredDuration=reduced?120:1180;const remaining=Math.max(0,configuredDuration-(Date.now()-started));if(remaining)await page.waitForTimeout(remaining);await overlay.click({force:true});
        await overlay.waitFor({state:'detached',timeout:3500});const duration=Date.now()-started;
        const finalDuplicate=await page.evaluate(()=>Boolean(document.querySelector('.qelly-opening .qelly-opening__symbol')));
        const configuredExperienceMs=configuredDuration+(reduced?0:300);opening.push({...meta,observedRemovalMs:duration,configuredDurationMs:configuredExperienceMs,duplicateFinalSymbol:finalDuplicate,result:configuredExperienceMs<=(reduced?250:1600)&&configuredExperienceMs>=(reduced?0:900)&&!finalDuplicate?'passed':'failed'});
      }
      stop();await context.close();await browser.close();
    }catch(error){stop?.();opening.push({...meta,result:'failed',error:error.message});telemetry.rendererFailures.push({...meta,error:error.message});await context?.close().catch(()=>{});await browser?.close().catch(()=>{});}
  }
}

async function captureState(state,title){
  await openPage('chromium',chromium,{route:'market',viewport:{width:1280,height:900},appearance:'dark',prepare:async(page)=>{
    await page.evaluate((value)=>{const selector=document.getElementById('state-selector');selector.disabled=false;selector.value=value;selector.dispatchEvent(new Event('change',{bubbles:true}))},state);
    await page.waitForFunction((value)=>document.getElementById('main')?.dataset.qellyStatePage===value,state,{timeout:10000});
  },captures:[{file:`state-${state}-desktop.png`,title,description:'Compact validation-state viewport with title, explanation and recovery priority above the fold.'}]});
}

async function captureCommand(){
  await openPage('chromium',chromium,{route:'market',viewport:{width:1440,height:1000},prepare:async(page)=>{await page.locator('#command-button').click();await page.locator('dialog.q-command-dialog').waitFor({state:'visible'});const input=page.locator('#q-command-input');await input.fill('Asset Rankings');await page.waitForTimeout(150)},captures:[{file:'command-palette-readable.png',title:'Command palette',description:'Readable selected-result viewport with one Qelly lockup.'}]});
}

async function captureThemeStudio(mode){
  await openPage('chromium',chromium,{route:'market',viewport:{width:1440,height:1000},prepare:async(page)=>{await page.evaluate((target)=>target==='gallery'?window.QellyThemeStudio.gallery():window.QellyThemeStudio.open(),mode);await page.waitForSelector('.q-ti-page',{state:'visible',timeout:15000})},captures:[{file:`theme-${mode}-readable.png`,title:mode==='gallery'?'Theme Gallery':'Theme Studio',description:'Readable viewport evidence preserving the governed Theme Intelligence system.'}]});
}

async function createAssetBoards(){
  const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1440,height:960},colorScheme:'dark'});const page=await context.newPage();const assetBase=`http://127.0.0.1:${appPort}${base}assets/brand/`;const publicBase=`http://127.0.0.1:${appPort}${base}`;
  const boards=[
    ['primary-horizontal-logo.png','Primary horizontal Qelly logo',`<main class="single dark"><img class="horizontal" src="${assetBase}qelly-logo-dark.svg"><h1>Primary horizontal lockup</h1><p>Approved 304 × 84 intrinsic geometry</p></main>`],
    ['symbol-only-logo.png','Symbol-only Qelly logo',`<main class="single dark"><img class="symbol" src="${assetBase}qelly-symbol-dark.svg"><h1>Symbol-only mark</h1><p>Compact functional identity</p></main>`],
    ['monochrome-logo-variants.png','Monochrome logo variants',`<main class="grid"><article class="dark"><img src="${assetBase}qelly-logo-monochrome-dark.svg"><b>Monochrome dark</b></article><article class="light"><img src="${assetBase}qelly-logo-monochrome-light.svg"><b>Monochrome light</b></article></main>`],
    ['small-size-logo-board.png','16px, 24px, 32px and 48px symbol sizes',`<main class="sizes dark">${[16,24,32,48].map((size)=>`<article><img style="width:${size}px;height:${size}px" src="${assetBase}qelly-symbol-small.svg"><b>${size}px</b></article>`).join('')}</main>`],
    ['favicon-browser-chrome.png','Favicon in light and dark browser chrome',`<main class="grid"><article class="chrome light"><div class="tab"><img src="${publicBase}favicon.svg">Qelly Intelligence</div></article><article class="chrome dark"><div class="tab"><img src="${publicBase}favicon.svg">Qelly Intelligence</div></article></main>`],
    ['app-icon-board.png','Apple touch, PWA and maskable assets',`<main class="icons light"><article><img src="${publicBase}apple-touch-icon.png"><b>Apple 180</b></article><article><img src="${publicBase}icons/qelly-192.png"><b>PWA 192</b></article><article><img src="${publicBase}icons/qelly-512.png"><b>PWA 512</b></article><article class="safe"><img src="${publicBase}icons/qelly-maskable-512.png"><i></i><b>Maskable safe area</b></article></main>`],
    ['social-preview-crop.png','Social-preview crop',`<main class="social dark"><img src="${publicBase}social/qelly-social-preview.png"><b>Qelly social preview</b></main>`]
  ];
  const style=`<style>*{box-sizing:border-box}body{margin:0;background:#e9e3e6;font:18px Arial}.dark{background:#10080d;color:#fff}.light{background:#fff;color:#21151b}.single{min-height:900px;display:grid;place-items:center;align-content:center;gap:28px}.horizontal{width:520px}.symbol{width:260px}.grid{min-height:900px;padding:50px;display:grid;grid-template-columns:1fr 1fr;gap:30px}.grid article{border-radius:28px;padding:50px;display:grid;place-items:center;align-content:center;gap:30px}.grid img{max-width:90%;max-height:250px}.sizes{min-height:900px;display:flex;align-items:center;justify-content:center;gap:90px}.sizes article{display:grid;place-items:center;gap:20px}.chrome{min-height:380px}.tab{width:90%;height:74px;padding:18px 24px;border-radius:16px;background:rgba(127,127,127,.12);display:flex;align-items:center;gap:14px}.tab img{width:32px;height:32px}.icons{min-height:900px;padding:55px;display:grid;grid-template-columns:repeat(4,1fr);gap:26px;align-items:center}.icons article{display:grid;place-items:center;gap:18px}.icons img{width:220px;height:220px;border-radius:34px}.safe{position:relative}.safe i{position:absolute;width:146px;height:146px;border:3px dashed #6f1838;border-radius:50%;top:37px}.social{min-height:900px;padding:55px;display:grid;place-items:center;gap:20px}.social img{width:min(1100px,90vw);border-radius:24px}</style>`;
  for(const [file,title,body] of boards){await page.setContent(`<!doctype html>${style}${body}`);await page.waitForFunction(()=>[...document.images].every((image)=>image.complete&&image.naturalWidth>0));const output=path.join(evidenceDir,file);await page.screenshot({path:output,fullPage:true});evidence.push({title,description:'Dedicated readable asset board.',path:rel(output)});}
  await context.close();await browser.close();
}

async function themeBoards(){
  for(const family of themes){
    for(const appearance of ['dark','light']){
      await openPage('chromium',chromium,{route:'market',viewport:{width:1280,height:800},appearance,themeFamily:family,captures:[{file:`theme-family-${family}-${appearance}.png`,title:`${family} — ${appearance}`,description:'Readable governed theme-family viewport.'}]});
    }
  }
}

async function writeInspectionPdf(){
  const htmlPath=path.join(artifact,'16-human-readable-evidence','inspection.html');
  const cards=evidence.map((item,index)=>`<section class="board ${item.supplemental?'supplemental':''}"><header><span>${String(index+1).padStart(2,'0')}</span><div><h1>${item.title}</h1><p>${item.description}</p></div></header><img src="/${item.path}" alt="${item.title.replaceAll('"','&quot;')}"><footer>${item.supplemental?'Supplemental full-page thumbnail':'Readable viewport or dedicated asset board'} · final head ${reviewCommit}</footer></section>`).join('');
  await writeFile(htmlPath,`<!doctype html><html><head><meta charset="utf-8"><title>QELLY PR13 Final Visual Correction Inspection</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;font:12px Arial;color:#21151b;background:#fff}.cover{height:185mm;display:grid;align-content:center;padding:24mm;background:linear-gradient(135deg,#190812,#6f1838);color:#fff;page-break-after:always}.cover h1{font-size:38px;max-width:18ch;margin:0 0 18px}.cover p{font-size:16px;line-height:1.6;max-width:70ch}.board{height:185mm;page-break-after:always;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:5mm}.board header{display:flex;align-items:center;gap:12px;border-bottom:1px solid #d6c9cf;padding-bottom:4mm}.board header>span{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;background:#6f1838;color:#fff;font-weight:bold}.board h1{font-size:20px;margin:0}.board p{margin:3px 0 0;color:#65565e}.board img{width:100%;height:100%;object-fit:contain;object-position:center top;border:1px solid #d8cbd1;border-radius:8px;background:#eee8eb}.board.supplemental img{object-position:center top}.board footer{color:#786a71;font-size:9px}</style></head><body><section class="cover"><h1>QELLY PR #13 Final Visual Correction</h1><p>Readable human-inspection evidence for opening behavior, complete porcelain daylight, contrast, shell identity, authentication, validation states, mobile navigation clearance, Asset Rankings, Theme Intelligence and all 13 theme families.</p><p>Starting head: ${startingHead}<br>Final evidence head: ${reviewCommit}<br>DO NOT MERGE — FINAL HUMAN VISUAL APPROVAL REQUIRED</p></section>${cards}</body></html>`);
  artifactServer=await serve(artifact,artifactPort,'/');const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1400,height:900}});await page.goto(`http://127.0.0.1:${artifactPort}/16-human-readable-evidence/inspection.html`,{waitUntil:'networkidle'});await page.pdf({path:pdfPath,format:'A4',landscape:true,printBackground:true,margin:{top:'10mm',right:'10mm',bottom:'10mm',left:'10mm'}});await browser.close();await new Promise((resolve)=>artifactServer.close(resolve));artifactServer=null;await cp(pdfPath,path.join(evidenceDir,pdfName));
}

async function integrityAndPackage(validation){
  const oldChecksums=new Set(['15-checksums/SHA256SUMS.txt','14-reports/ARTIFACT_MANIFEST.json']);
  const before=await walk(artifact);const sums=[];
  for(const file of before){if(file.rel.startsWith('18-visual-correction-checksums/')||file.rel==='17-visual-correction-reports/FINAL_ARTIFACT_MANIFEST.json')continue;const data=await readFile(file.abs);sums.push(`${sha256(data)}  ${file.rel}`)}
  sums.sort();await writeFile(path.join(checksumDir,'SHA256SUMS.txt'),`${sums.join('\n')}\n`);
  const all=await walk(artifact);const entries=[];for(const file of all){if(file.rel==='17-visual-correction-reports/FINAL_ARTIFACT_MANIFEST.json')continue;const data=await readFile(file.abs);entries.push({path:file.rel,bytes:data.length,sha256:sha256(data),legacyChecksumSuperseded:oldChecksums.has(file.rel)})}
  await json(path.join(reportDir,'FINAL_ARTIFACT_MANIFEST.json'),{schemaVersion:3,artifact:'qelly-logo-first-brand-system-visual-correction-review',startingHead,commit:reviewCommit,result:validation.result,checksumEntries:sums.length,entries});
  await rm(exactZip,{force:true});execFileSync('zip',['-qr',exactZip,path.basename(artifact)],{cwd:outputRoot});execFileSync('unzip',['-t',exactZip],{stdio:'pipe'});
  await rm(compiledZip,{force:true});execFileSync('zip',['-qr',compiledZip,'.'],{cwd:path.join(artifact,'13-compiled-preview')});
  const zipData=await readFile(exactZip);const zipEntries=execFileSync('unzip',['-Z1',exactZip],{encoding:'utf8'}).split('\n').filter(Boolean);
  const metadata={file:path.basename(exactZip),sha256:sha256(zipData),sizeBytes:zipData.length,entryCount:zipEntries.length,pdf:{file:pdfName,sha256:sha256(await readFile(pdfPath)),sizeBytes:(await stat(pdfPath)).size},compiledPreview:{file:path.basename(compiledZip),sha256:sha256(await readFile(compiledZip)),sizeBytes:(await stat(compiledZip)).size},commit:reviewCommit,result:validation.result};
  await json(path.join(outputRoot,'qelly-logo-first-brand-system-visual-correction-review.metadata.json'),metadata);await writeFile(path.join(outputRoot,'qelly-logo-first-brand-system-visual-correction-review.zip.sha256'),`${metadata.sha256}  ${metadata.file}\n`);return metadata;
}

async function execute(){
  if(!await exists(retainedArtifact))throw new Error('Run npm run review:brand before the visual-correction reviewer.');
  await rm(outputRoot,{recursive:true,force:true});await mkdir(outputRoot,{recursive:true});await cp(retainedArtifact,artifact,{recursive:true});await mkdir(evidenceDir,{recursive:true});await mkdir(reportDir,{recursive:true});await mkdir(checksumDir,{recursive:true});
  appServer=await serve(dist,appPort,base);
  await createAssetBoards();
  for(const [name,launcher] of browsers)await openingEvidence(name,launcher);
  await captureDarkLight();
  await openPage('chromium',chromium,{route:'asset-rankings',viewport:{width:1440,height:1000},captures:[{file:'desktop-shell-and-rankings-above-fold.png',title:'Desktop shell and Asset Rankings',description:'One primary horizontal lockup, functional controls and readable rankings above the fold.'},{file:'asset-rankings-desktop-middle.png',title:'Asset Rankings desktop — middle',description:'Readable middle crop.',options:{scroll:'middle'}},{file:'asset-rankings-desktop-bottom.png',title:'Asset Rankings desktop — bottom',description:'Readable bottom crop.',options:{scroll:'bottom'}},{file:'asset-rankings-desktop-full-thumbnail.png',title:'Asset Rankings desktop — full thumbnail',description:'Supplemental full-page context.',options:{fullPage:true}}]});
  await openPage('chromium',chromium,{route:'market',viewport:{width:390,height:844},captures:[{file:'mobile-shell-homepage-above-fold.png',title:'Mobile shell and homepage',description:'Symbol-only mobile identity and fixed-navigation clearance.'},{file:'mobile-homepage-bottom.png',title:'Mobile homepage — bottom',description:'Final content remains above fixed navigation.',options:{scroll:'bottom'}},{file:'mobile-homepage-full-thumbnail.png',title:'Mobile homepage — full thumbnail',description:'Supplemental page-height context.',options:{fullPage:true}}]});
  await openPage('chromium',chromium,{route:'asset-rankings',viewport:{width:390,height:844},captures:[{file:'asset-rankings-mobile-above-fold.png',title:'Asset Rankings mobile — above the fold',description:'Readable rows, controls and chart area.'},{file:'asset-rankings-mobile-middle.png',title:'Asset Rankings mobile — middle',description:'Readable middle rows.',options:{scroll:'middle'}},{file:'asset-rankings-mobile-bottom.png',title:'Asset Rankings mobile — bottom',description:'Last row and controls clear the navigation.',options:{scroll:'bottom'}},{file:'asset-rankings-mobile-full-thumbnail.png',title:'Asset Rankings mobile — full thumbnail',description:'Supplemental page-height context.',options:{fullPage:true}}]});
  await openPage('chromium',chromium,{route:'auth-login',viewport:{width:1280,height:900},captures:[{file:'authentication-cohesive-desktop.png',title:'Authentication composition',description:'Brand lockup, decision-network panel and login form read as one split-layout experience.'}]});
  for(const [state,title] of [['loading','Loading state'],['empty','Empty state'],['offline','Offline state'],['error','Recoverable error state']])await captureState(state,title);
  await captureCommand();await captureThemeStudio('studio');await captureThemeStudio('gallery');await themeBoards();
  for(const [browserName,launcher] of browsers){for(const [width,height] of mobileViewports){for(const route of ['market','asset-rankings'])await openPage(browserName,launcher,{route,viewport:{width,height},appearance:'dark',recordTrailing:true});}}
  const retainedMatrix=JSON.parse(await readFile(path.join(artifact,'14-reports/BROWSER_MATRIX.json'),'utf8'));
  const expectedMatrix=browsers.length*requiredViewports.length;const retainedMatrixCount=retainedMatrix.captures.filter((item)=>item.group==='browser-matrix').length;
  const darkFile=path.join(evidenceDir,'homepage-dark-above-fold.png'),lightFile=path.join(evidenceDir,'genuine-homepage-light-above-fold.png');const darkMean=await meanLuminance(darkFile),lightMean=await meanLuminance(lightFile);
  const darkLight={darkMeanLuminance:Number(darkMean.toFixed(5)),lightMeanLuminance:Number(lightMean.toFixed(5)),delta:Number((lightMean-darkMean).toFixed(5)),threshold:.28,result:lightMean-darkMean>=.28?'passed':'failed'};
  const fonts=[...new Set(appearanceRecords.map((item)=>item.fontFamily))];const fontReady=appearanceRecords.every((item)=>item.fontStatus==='loaded'&&/Qelly IBM Plex Sans|IBM Plex/i.test(item.fontFamily));const appearanceStable=appearanceRecords.every((item)=>item.requestedAppearance===item.resolvedAppearance);
  const finalMetrics={maxHorizontalOverflowPx:Math.max(0,...appearanceRecords.map((item)=>item.horizontalOverflowPx||0),...trailing.map((item)=>item.horizontalOverflowPx||0)),maxTrailingSpacePx:Math.max(0,...trailing.map((item)=>item.excessTrailingPx||0)),maxNavigationOverlapPx:Math.max(0,...trailing.map((item)=>item.navigationOverlapPx||0)),mobileRecords:trailing.length};
  await json(path.join(reportDir,'TRAILING_SPACE_QA.json'),{threshold:'no more than one viewport',records:trailing});
  await json(path.join(reportDir,'NAVIGATION_CLEARANCE_QA.json'),{thresholdPx:1,records:trailing.map((item)=>({browser:item.browser,route:item.route,viewport:item.viewport,navigationHeight:item.navigationHeight,navigationOverlapPx:item.navigationOverlapPx,result:item.navigationOverlapPx<=1?'passed':'failed'}))});
  await json(path.join(reportDir,'DARK_LIGHT_QA.json'),darkLight);await json(path.join(reportDir,'CONTRAST_QA.json'),{threshold:4.5,records:contrast});await json(path.join(reportDir,'OPENING_BEHAVIOR_QA.json'),{targets:{fullMotionMs:[900,1600],reducedMotionMs:[0,250],repeatSession:'skipped'},records:opening});await json(path.join(reportDir,'FINAL_BROWSER_MATRIX.json'),{retainedMatrixCount,expectedMatrix,browsers:browsers.map(([name])=>name),viewports:requiredViewports.map(([w,h])=>`${w}x${h}`),targetedAppearanceRecords:appearanceRecords,targetedMobileRecords:trailing});await json(path.join(reportDir,'FONT_THEME_FLASH_QA.json'),{fontReady,appearanceStable,fontFamilies:fonts,result:fontReady&&appearanceStable?'passed':'failed'});await json(path.join(reportDir,'TELEMETRY_QA.json'),telemetry);
  const validation={
    result:'passed',startingHead,commit:reviewCommit,
    gates:{retainedBrowserMatrix:retainedMatrixCount===expectedMatrix,opening:opening.every((item)=>item.result==='passed'),darkLight:darkLight.result==='passed',contrast:contrast.length>0&&contrast.every((item)=>item.result==='passed'),mobileTrailing:trailing.length===18&&trailing.every((item)=>item.result==='passed'),horizontalOverflow:finalMetrics.maxHorizontalOverflowPx<=1,navigationOverlap:finalMetrics.maxNavigationOverlapPx<=1,consoleClean:telemetry.consoleErrors.length===0,pageErrorsClean:telemetry.pageErrors.length===0,resourcesClean:telemetry.failedResources.length===0,rendererClean:telemetry.rendererFailures.length===0,fontReady,appearanceStable},metrics:finalMetrics
  };
  if(!Object.values(validation.gates).every(Boolean))validation.result='failed';await json(path.join(reportDir,'FINAL_VISUAL_CORRECTION_VALIDATION.json'),validation);
  await writeInspectionPdf();
  const fontBinaries=(await walk(artifact)).filter((file)=>/\.(?:woff2?|ttf|otf|eot)$/i.test(file.rel));if(fontBinaries.length)throw new Error(`Downloadable review contains forbidden font binaries: ${fontBinaries.map((item)=>item.rel).join(', ')}`);
  const metadata=await integrityAndPackage(validation);if(validation.result!=='passed')throw new Error(`Final visual correction failed closed: ${JSON.stringify(validation)}`);console.log(JSON.stringify({validation,metadata},null,2));
}

try{await execute()}finally{if(appServer)await new Promise((resolve)=>appServer.close(resolve));if(artifactServer)await new Promise((resolve)=>artifactServer.close(resolve));}
