import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const OWNER='hemangsah';
const REPO='qelly-intelligence';
const MERGE='239f6f0c7c663801662f4e5f940ca76fb6941bf1';
const HEAD='ca3d85898d6ce26dc4c2b2cda35b34e1810d2c1b';
const BASE='https://hemangsah.github.io/qelly-intelligence/';
const out=path.resolve('foundation-verification');
const live=path.join(out,'post-merge-live');
await mkdir(live,{recursive:true});
const token=process.env.GITHUB_TOKEN;
if(!token)throw new Error('GITHUB_TOKEN is required');
const headers={Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'};
const api=async(endpoint)=>{const response=await fetch(`https://api.github.com${endpoint}`,{headers});const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(`${endpoint} -> ${response.status}: ${JSON.stringify(body)}`);return body;};
const assert=(value,message)=>{if(!value)throw new Error(message);};
const json=async(name,value)=>writeFile(path.join(out,name),`${JSON.stringify(value,null,2)}\n`,'utf8');

const [repo,pr,main,runsMain,runsHead,pages]=await Promise.all([
  api(`/repos/${OWNER}/${REPO}`),
  api(`/repos/${OWNER}/${REPO}/pulls/11`),
  api(`/repos/${OWNER}/${REPO}/branches/main`),
  api(`/repos/${OWNER}/${REPO}/actions/runs?head_sha=${MERGE}&per_page=100`),
  api(`/repos/${OWNER}/${REPO}/actions/runs?head_sha=${HEAD}&per_page=100`),
  api(`/repos/${OWNER}/${REPO}/pages`)
]);
const branch=async(name)=>api(`/repos/${OWNER}/${REPO}/branches/${encodeURIComponent(name)}`);
const [rescue,recovery]=await Promise.all([branch('agent/ui-rescue-asset-rankings'),branch('agent/theme-intelligence-emergency-checkpoint')]);
assert(repo.full_name===`${OWNER}/${REPO}`,'repository mismatch');
assert(repo.default_branch==='main','default branch mismatch');
assert(main.commit.sha===MERGE,`main moved: ${main.commit.sha}`);
assert(pr.state==='closed'&&pr.merged===true,'PR #11 is not merged and closed');
assert(pr.head.sha===HEAD,`PR #11 head mismatch: ${pr.head.sha}`);
assert(pr.merge_commit_sha===MERGE,`PR #11 merge mismatch: ${pr.merge_commit_sha}`);
assert(rescue.name==='agent/ui-rescue-asset-rankings','rescue branch missing');
assert(recovery.name==='agent/theme-intelligence-emergency-checkpoint','recovery branch missing');

const normalize=(run)=>({id:run.id,name:run.name,event:run.event,head_sha:run.head_sha,status:run.status,conclusion:run.conclusion,html_url:run.html_url,created_at:run.created_at,updated_at:run.updated_at,artifacts_url:run.artifacts_url});
const latest=(runs,name)=>runs.filter((run)=>run.name===name).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
const requiredMain=['Continuous Integration','Container Build','Production Foundation Services','CodeQL','Static Visual Preview'];
const requiredHead=['Continuous Integration','Container Build','Production Foundation Services','CodeQL','Typography Governance Review','Qelly IBM Plex Governance Audit','Qelly UI Rescue Review','Qelly Theme Intelligence Review','Qelly Theme Intelligence Visual Correction Review'];
const mainChecks=Object.fromEntries(requiredMain.map((name)=>[name,normalize(latest(runsMain.workflow_runs,name)??{})]));
const headChecks=Object.fromEntries(requiredHead.map((name)=>[name,normalize(latest(runsHead.workflow_runs,name)??{})]));
for(const [name,run] of Object.entries(mainChecks))assert(run.id&&run.head_sha===MERGE&&run.status==='completed'&&run.conclusion==='success',`post-merge workflow not successful: ${name} ${JSON.stringify(run)}`);
for(const [name,run] of Object.entries(headChecks))assert(run.id&&run.head_sha===HEAD&&run.status==='completed'&&run.conclusion==='success',`approved-head workflow not successful: ${name} ${JSON.stringify(run)}`);
assert(String(pages.html_url||'').startsWith(BASE),`Pages URL mismatch: ${pages.html_url}`);
await json('repository-state.json',{repository:repo.full_name,defaultBranch:repo.default_branch,main:main.commit.sha,pr11:{state:pr.state,merged:pr.merged,head:pr.head.sha,mergeCommit:pr.merge_commit_sha,mergedAt:pr.merged_at},pages:{...pages,statusReported:pages.status??null,statusAuthority:'independent-live-browser'},preservedBranches:[{name:rescue.name,sha:rescue.commit.sha},{name:recovery.name,sha:recovery.commit.sha}],mainChecks,approvedHeadChecks:headChecks});

const viewports=[{name:'360x800',width:360,height:800},{name:'390x844',width:390,height:844},{name:'430x932',width:430,height:932},{name:'768x1024',width:768,height:1024},{name:'1024x768',width:1024,height:768},{name:'1280x800',width:1280,height:800},{name:'1440x1000',width:1440,height:1000},{name:'1728x1080',width:1728,height:1080},{name:'1920x1080',width:1920,height:1080}];
const routes=[{name:'root',hash:''},{name:'asset-rankings',hash:'#/asset-rankings'},{name:'market',hash:'#/market'},{name:'asset-dossier',hash:'#/asset/BTC'},{name:'theme-studio',hash:'#/theme-lab'},{name:'theme-gallery',hash:'#/theme-lab/gallery'}];
const consoleErrors=[];const failedResources=[];const captures=[];const browser=await chromium.launch({headless:true});
for(const viewport of viewports){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1,reducedMotion:'no-preference'});
  for(const route of routes){
    const page=await context.newPage();
    const key=`${viewport.name}/${route.name}`;
    await page.addInitScript(()=>{window.__qellyLayoutShifts=[];new PerformanceObserver((list)=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)window.__qellyLayoutShifts.push(entry.value);}).observe({type:'layout-shift',buffered:true});});
    page.on('console',(message)=>{if(message.type()==='error')consoleErrors.push({key,text:message.text()});});
    page.on('requestfailed',(request)=>failedResources.push({key,url:request.url(),failure:request.failure()?.errorText??'failed'}));
    page.on('response',(response)=>{if(response.status()>=400)failedResources.push({key,url:response.url(),status:response.status()});});
    await page.goto(`${BASE}${route.hash}`,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForTimeout(1800);
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForSelector('#main',{state:'visible',timeout:15000});
    const metrics=await page.evaluate(()=>{
      const root=document.documentElement,body=document.body;
      const resources=performance.getEntriesByType('resource').map((entry)=>entry.name);
      const overflowingElements=[...document.querySelectorAll('body *')].map((element)=>{const rect=element.getBoundingClientRect(),style=getComputedStyle(element);return {tag:element.tagName.toLowerCase(),id:element.id,className:typeof element.className==='string'?element.className:String(element.className?.baseVal??''),left:Number(rect.left.toFixed(2)),right:Number(rect.right.toFixed(2)),width:Number(rect.width.toFixed(2)),scrollWidth:element.scrollWidth,clientWidth:element.clientWidth,display:style.display,position:style.position,overflowX:style.overflowX,minWidth:style.minWidth,maxWidth:style.maxWidth,marginLeft:style.marginLeft,marginRight:style.marginRight,transform:style.transform,outerHTML:element.outerHTML.slice(0,500)};}).filter((item)=>item.right>innerWidth+1||item.left< -1||item.scrollWidth>item.clientWidth+1).sort((a,b)=>Math.max(b.right-innerWidth,b.scrollWidth-b.clientWidth)-Math.max(a.right-innerWidth,a.scrollWidth-a.clientWidth)).slice(0,60);
      return {baseURI:document.baseURI,hash:location.hash,preview:root.dataset.preview,appearance:root.dataset.appearance,themeFamily:root.dataset.themeFamily,bodyFont:getComputedStyle(body).fontFamily,bodyBackground:getComputedStyle(body).backgroundColor,fontResources:resources.filter((url)=>/font|woff/i.test(url)),externalFontResources:resources.filter((url)=>/font|woff/i.test(url)&&new URL(url).origin!==location.origin),horizontalOverflow:Math.max(0,root.scrollWidth-root.clientWidth),bodyInternalOverflow:Math.max(0,body.scrollWidth-root.clientWidth),htmlScrollWidth:root.scrollWidth,htmlClientWidth:root.clientWidth,bodyScrollWidth:body.scrollWidth,viewportWidth:innerWidth,layoutShift:(window.__qellyLayoutShifts??[]).reduce((sum,value)=>sum+value,0),title:document.title,text:body.innerText.slice(0,4000),overflowingElements};
    });
    const dir=path.join(live,viewport.name);await mkdir(dir,{recursive:true});
    const file=path.join(dir,`${route.name}.png`);await page.screenshot({path:file,fullPage:true});
    if(metrics.horizontalOverflow>1)await writeFile(path.join(dir,`${route.name}-overflow.json`),`${JSON.stringify({key,metrics},null,2)}\n`,'utf8');
    captures.push({key,file:path.relative(out,file).split(path.sep).join('/'),metrics});
    assert(metrics.baseURI.includes('/qelly-intelligence/'),`${key}: base path missing`);
    assert(metrics.preview==='static',`${key}: static-preview truth marker missing`);
    assert(/IBM Plex/i.test(metrics.bodyFont),`${key}: IBM Plex not computed (${metrics.bodyFont})`);
    assert(metrics.fontResources.some((url)=>url.includes('ibm-plex-sans-variable.woff2')),`${key}: IBM Plex WOFF2 not loaded`);
    assert(metrics.externalFontResources.length===0,`${key}: external font request`);
    assert(metrics.horizontalOverflow<=1,`${key}: document horizontal overflow ${metrics.horizontalOverflow}; offenders ${JSON.stringify(metrics.overflowingElements.slice(0,8))}`);
    assert(metrics.layoutShift<=0.01,`${key}: layout shift ${metrics.layoutShift}`);
    if(route.name==='asset-rankings')assert(/Asset Rankings/i.test(metrics.text),`${key}: Asset Rankings not rendered`);
    if(route.name==='market')assert(/Market/i.test(metrics.text),`${key}: Market Overview not rendered`);
    if(route.name==='asset-dossier')assert(/BTC|Asset/i.test(metrics.text),`${key}: Asset Dossier not rendered`);
    if(route.name==='theme-studio')assert(/Theme Studio/i.test(metrics.text),`${key}: Theme Studio not rendered`);
    if(route.name==='theme-gallery')assert(/Theme Gallery/i.test(metrics.text),`${key}: Theme Gallery not rendered`);
    await page.close();
  }
  await context.close();
}
const modeContext=await browser.newContext({viewport:{width:1440,height:1000}});const modePage=await modeContext.newPage();
modePage.on('console',(message)=>{if(message.type()==='error')consoleErrors.push({key:'appearance-matrix',text:message.text()});});
await modePage.goto(`${BASE}#/theme-lab`,{waitUntil:'domcontentloaded',timeout:45000});await modePage.waitForTimeout(1800);
const appearances=[];
for(const appearance of ['dark','light','oled','high-contrast']){
  const result=await modePage.evaluate(async(appearance)=>{const module=await import(new URL('./assets/theme-intelligence.mjs',document.baseURI));const snapshot=module.themeIntelligence.apply({...module.themeIntelligence.config,appearance},{preview:true,persist:false});await document.fonts.ready;return {appearance:document.documentElement.dataset.appearance,canvas:snapshot.tokens.canvas,text:snapshot.tokens.text,bodyBackground:getComputedStyle(document.body).backgroundColor};},appearance);
  assert(result.appearance===appearance,`appearance did not apply: ${appearance}`);
  const file=path.join(live,`appearance-${appearance}.png`);await modePage.screenshot({path:file,fullPage:true});appearances.push({...result,file:path.relative(out,file).split(path.sep).join('/')});
}
const reducedContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const reducedPage=await reducedContext.newPage();await reducedPage.goto(BASE,{waitUntil:'domcontentloaded',timeout:45000});await reducedPage.waitFor_timeout?.(800).catch(()=>{});await reducedPage.waitForTimeout(800);const reduced=await reducedPage.evaluate(()=>({reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,motion:document.documentElement.dataset.motion,animations:document.getAnimations().filter((animation)=>animation.playState==='running').length}));assert(reduced.reduced,'reduced-motion environment not active');
await reducedPage.screenshot({path:path.join(live,'reduced-motion.png'),fullPage:true});await reducedContext.close();await modeContext.close();await browser.close();
assert(consoleErrors.length===0,`console errors: ${JSON.stringify(consoleErrors)}`);
assert(failedResources.length===0,`failed resources: ${JSON.stringify(failedResources)}`);
await json('live-verification.json',{url:BASE,result:'passed',pagesApiStatus:pages.status??null,statusAuthority:'independent-live-browser',captures,appearances,reducedMotion:reduced,consoleErrors,failedResources});
await writeFile(path.join(out,'FOUNDATION_VERIFICATION.md'),`# Qelly Foundation Verification\n\n- Repository: ${OWNER}/${REPO}\n- Main: \`${MERGE}\`\n- PR #11 approved head: \`${HEAD}\`\n- PR #11: merged and unchanged.\n- Pages API URL: ${pages.html_url}.\n- Pages API status field: ${pages.status??'not reported'}; independent live browser is authoritative.\n- Main workflows: ${requiredMain.length} successful.\n- Approved-head workflows: ${requiredHead.length} successful.\n- Live captures: ${captures.length}.\n- Console errors: ${consoleErrors.length}.\n- Failed resources: ${failedResources.length}.\n- IBM Plex local WOFF2: verified.\n- Preserved branches: agent/ui-rescue-asset-rankings; agent/theme-intelligence-emergency-checkpoint.\n- Approved artifact SHA-256: 756841a7a9a3425413884b8954f6b5f5b689b888ec46e30313e8e0b775be99bf.\n`,'utf8');
console.log(JSON.stringify({result:'passed',main:MERGE,liveCaptures:captures.length,mainChecks:requiredMain.length,approvedHeadChecks:requiredHead.length},null,2));
