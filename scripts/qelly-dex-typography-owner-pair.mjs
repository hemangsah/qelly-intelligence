import{contrastRatio}from'../apps/web/public/assets/theme-intelligence-core.mjs';
import {chromium} from 'playwright';import assert from 'node:assert/strict';import{mkdir,writeFile,readFile}from'node:fs/promises';import{startServer}from'./release-a5-evidence-server.mjs';
import{createHash}from'node:crypto';
import{dexTypographyExpectedCss,dexTypographyRendererSha}from'./qelly-dex-typography-owner-report.mjs';
const expected=process.env.QELLY_DEX_TYPE_EXPECT;assert.ok(['red','green'].includes(expected));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),sourceCssBindings=[];
for(const file of dexTypographyExpectedCss[expected]){
 const source=await readFile(file.path),built=await readFile(file.path.replace('apps/web/public/','dist/frontend/'));
 assert.equal(hash(source),file.sha256);assert.deepEqual(built,source);
 sourceCssBindings.push({path:file.path,sourceSha256:hash(source),builtSha256:hash(built),builtBytesVerified:true});
}
const rendererSha256=hash(await readFile('apps/web/public/assets/routes/dex-discovery.mjs'));assert.equal(rendererSha256,dexTypographyRendererSha);
const controlsMatrix=process.env.QELLY_DEX_CONTROL_MATRIX==='true',live=process.env.QELLY_DEX_LIVE==='true';const out='preview/dex-typography-owner-pair';await mkdir(out,{recursive:true});const server=live?null:await startServer({port:0,host:'127.0.0.1'}),browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});const results=[],typographyResults=[],sourceDisclosureTypographyResults=[],contentResults=[];let activePage=null;
let site=server?'http://127.0.0.1:'+server.port:'https://terminal.qellyintelligence.com';
if(live){
 const sha=process.env.QELLY_SCREEN_EVIDENCE_SHA;assert.match(sha||'',/^[a-f0-9]{40}$/);
 if(process.env.QELLY_DEX_PREVIEW==='true'){
  const response=await fetch('https://api.github.com/repos/'+process.env.GITHUB_REPOSITORY+'/commits/'+sha+'/check-runs',{headers:{authorization:'Bearer '+process.env.GH_TOKEN,accept:'application/vnd.github+json'}});assert.equal(response.status,200);
  const checks=await response.json(),check=checks.check_runs.find(c=>c.name==='Cloudflare Pages'&&c.conclusion==='success');
  const id=check?.details_url?.match(/pages\/view\/qelly-intelligence\/([a-f0-9]{8})-/)?.[1];assert.ok(id,'Exact preview deployment check missing');site='https://'+id+'.qelly-intelligence.pages.dev';
 }
 let matched=false;for(let attempt=0;attempt<60;attempt++){try{const r=await fetch(site+'/qelly-release.json',{cache:'no-store',signal:AbortSignal.timeout(10000)});matched=r.ok&&(await r.json()).releaseSha===sha;}catch{}if(matched)break;await new Promise(r=>setTimeout(r,10000));}assert.equal(matched,true,'Exact public release identity required');
}

// This function is serialized by Playwright; keep its browser helpers self-contained.
function dexTypographyBrowserSnapshot(options={mode:'primary'}){
 const fail=message=>{throw Error('DEX typography: '+message);};
 const parse=value=>{
  const m=value.match(/^rgba?\(([^)]+)\)$/);if(!m)fail('unsupported measured color '+value);
  const values=m[1].split(',').map(Number),color=values.slice(0,3),alpha=values[3]??1;
  if(color.length!==3||!color.every(n=>Number.isFinite(n)&&n>=0&&n<=255)||!Number.isFinite(alpha)||alpha<0||alpha>1)fail('invalid measured color '+value);
  return{color,alpha};
 };
 const lum=color=>color.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const rect=r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height});
 const intersection=(box,clips)=>{
  const result={left:box.left,right:box.right,top:box.top,bottom:box.bottom};
  for(const clip of clips){if(clip.clipsX){result.left=Math.max(result.left,clip.rect.left);result.right=Math.min(result.right,clip.rect.right);}if(clip.clipsY){result.top=Math.max(result.top,clip.rect.top);result.bottom=Math.min(result.bottom,clip.rect.bottom);}}
  result.width=Math.max(0,result.right-result.left);result.height=Math.max(0,result.bottom-result.top);return result;
 };
 const measure=(element,{key,role,directText=false,control=false})=>{
  const style=getComputedStyle(element),bounds=rect(element.getBoundingClientRect()),ancestors=[],backgroundLayers=[],clippingAncestors=[];let background=null,effectiveOpacity=1;
  for(let ancestor=element;ancestor;ancestor=ancestor.parentElement){
   const s=getComputedStyle(ancestor),opacity=Number(s.opacity),layer={tag:ancestor.tagName,className:ancestor.className?.toString()||'',display:s.display,visibility:s.visibility,contentVisibility:s.contentVisibility||'visible',opacity};
   ancestors.push(layer);effectiveOpacity*=opacity;
   // Group opacity, masks and filters need paint compositing beyond this bounded probe.
   if(!Number.isFinite(opacity)||opacity!==1)fail('unsupported group opacity for '+key);
   if(s.filter!=='none'||s.clipPath!=='none'||(s.maskImage&&s.maskImage!=='none')||s.mixBlendMode!=='normal')fail('unsupported painted/clipped effect for '+key);
   // Controls below report font/box/visibility only. Their existing action-contrast
   // assertions remain in the inherited runner; do not infer paint contrast here.
   if(!control&&!background){
    const c=parse(s.backgroundColor);backgroundLayers.push({color:s.backgroundColor,alpha:c.alpha,image:s.backgroundImage});
    if(s.backgroundImage!=='none'||(c.alpha!==0&&c.alpha!==1))fail('unsupported translucent/image background for '+key);
    if(c.alpha===1)background=c.color;
   }
   // The document viewport is deliberately not a clip boundary: labels span a long page.
   if(ancestor!==document.documentElement&&ancestor!==document.body&&!(control&&ancestor===element)){
    const clipsX=/^(hidden|clip|auto|scroll)$/.test(s.overflowX),clipsY=/^(hidden|clip|auto|scroll)$/.test(s.overflowY);
    if(clipsX||clipsY){const r=ancestor.getBoundingClientRect(),left=r.left+ancestor.clientLeft,top=r.top+ancestor.clientTop;clippingAncestors.push({tag:ancestor.tagName,className:ancestor.className?.toString()||'',overflowX:s.overflowX,overflowY:s.overflowY,clipsX,clipsY,rect:{left,right:left+ancestor.clientWidth,top,bottom:top+ancestor.clientHeight,width:ancestor.clientWidth,height:ancestor.clientHeight}});}
   }
  }
  const visible=ancestors.every(a=>a.display!=='none'&&a.visibility==='visible'&&a.contentVisibility!=='hidden')&&effectiveOpacity>0;
  const geometry={rect:bounds,visibleRect:intersection(bounds,clippingAncestors),clippingAncestors,display:style.display,visibility:style.visibility,contentVisibility:style.contentVisibility||'visible',effectiveOpacity,ancestors,visible};
  if(!visible||bounds.width<=0||bounds.height<=0)fail('invisible/nonpositive element '+key);
  const font=Number.parseFloat(style.fontSize),lineHeightComputed=style.lineHeight,
   lineHeight=lineHeightComputed==='normal'?'normal':Number.parseFloat(lineHeightComputed);
  if(control){
   const text=element.tagName==='SELECT'?element.selectedOptions[0]?.textContent?.trim():element.value||element.textContent?.trim()||element.getAttribute('placeholder');
   return{key,role,text:text||key,tag:element.tagName.toLowerCase(),font,lineHeight,lineHeightComputed,...geometry};
  }
  const textNodes=directText?[...element.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim()):null;
  const text=directText?textNodes.map(n=>n.textContent).join(' ').trim():element.textContent.trim();
  const ranges=directText?textNodes.map(node=>{const range=document.createRange();range.selectNodeContents(node);return range;}):[(()=>{const range=document.createRange();range.selectNodeContents(element);return range;})()];
  const glyphs=ranges.flatMap(range=>[...range.getClientRects()]).filter(r=>r.width>0&&r.height>0).map(r=>{const box=rect(r);return{...box,visibleRect:intersection(box,clippingAncestors)};});
  if(!background)fail('no opaque measured background for '+key);
  const foreground=parse(style.color),alpha=foreground.alpha*effectiveOpacity,composite=foreground.color.map((v,i)=>v*alpha+background[i]*(1-alpha)),a=lum(composite),b=lum(background);
  return{key,role,text,font,lineHeight,lineHeightComputed,...geometry,foreground:style.color,background,backgroundLayers,composite,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),glyphs,floorClass:element.classList.contains('q-v8-text-floor')};
 };
 const common={appearance:document.documentElement.dataset.resolvedAppearance,width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+2};
 if(options.mode==='source'){
  const source=[...document.querySelectorAll('.q-dx-source')][options.sourceIndex];if(!source||source.dataset.dexSource!==options.sourceId)fail('source identity changed');
  const details=source.querySelector('details');if(!details?.open)fail('source disclosure is closed');
  const counters={},labels=[...details.querySelectorAll('p,dt,dd')].map(element=>{const role='disclosure-'+element.tagName.toLowerCase(),index=counters[role]??0;counters[role]=index+1;return measure(element,{role,key:options.sourceId+':'+role+':'+index});});
  return{...common,sourceId:options.sourceId,sourceIndex:options.sourceIndex,openWhileMeasured:details.open,labels};
 }
 const groups=[['eyebrow','.q-dx-page .q-eyebrow'],['brief-definition','.q-dx-brief dt'],['source-stage','.q-dx-source>header>span'],['method-definition','.q-dx-method dt'],['gate-label','.q-dx-gate-map dt']];
 const entries=groups.flatMap(([role,selector])=>[...document.querySelectorAll(selector)].map((element,index)=>({element,role,key:role+':'+index})));
 const directoryLabels=[...document.querySelectorAll('.q-dx-directory>header label')];
 for(const[labelIndex,label]of directoryLabels.entries()){const span=[...label.children].find(e=>e.tagName==='SPAN'&&e.textContent.trim());entries.push({element:span||label,role:'directory-label',key:'directory-label:'+labelIndex,directText:!span});}
 entries.sort((a,b)=>a.element===b.element?0:(a.element.compareDocumentPosition(b.element)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1));
 const labels=entries.map(entry=>{const result=measure(entry.element,entry);if(entry.role==='source-stage')result.sourceId=entry.element.closest('.q-dx-source').dataset.dexSource;return result;});
 const allControls=[...document.querySelectorAll('.q-dx-page button,.q-dx-page input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]),.q-dx-page select,.q-dx-page textarea,.q-dx-page a.q-button')];
 const comparisonControls=allControls.filter(element=>element.hasAttribute('data-dex-compare-clear'));if(comparisonControls.length!==1)fail('Expected one separately governed comparison clear control');
 const comparisonClear=comparisonControls[0],comparisonDetails=comparisonClear.closest('[data-dex-comparison]');
 const comparisonControlScope={schema:'qelly.dex.comparison-initial-control-scope/1.0',allDomControls:allControls.length,excludedControlKeys:['button:data-dex-compare-clear'],nativeDetailsClosed:comparisonDetails instanceof HTMLDetailsElement&&!comparisonDetails.open,painted:comparisonClear.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}),nativeDisabled:comparisonClear.disabled,ariaDisabled:comparisonClear.getAttribute('aria-disabled')};
 const controls=allControls.filter(element=>!element.hasAttribute('data-dex-compare-clear')).filter(element=>{const box=element.getBoundingClientRect();return box.width>0&&box.height>0;}).map((element,index)=>{
  const tag=element.tagName.toLowerCase(),attribute=['data-dex-chat','data-dex-clear','data-dex-reset','data-dex-search','data-dex-stage'].find(a=>element.hasAttribute(a)),identity=element.getAttribute('name')||attribute||element.getAttribute('href')||String(index);
  return measure(element,{role:'control',key:tag+':'+identity,control:true});
 });
 return{...common,labels,controls,comparisonControlScope};
}

async function collectDexTypography(page){
 await page.evaluate(()=>document.fonts.ready);
 return page.evaluate(dexTypographyBrowserSnapshot,{mode:'primary'});
}

async function collectDexSourceDisclosureTypography(page,out,appearance,width){
 const sources=page.locator('.q-dx-source'),count=await sources.count();assert.equal(count,13);
 const statesBefore=await sources.evaluateAll(nodes=>nodes.map((source,index)=>({sourceId:source.dataset.dexSource,sourceIndex:index,open:source.querySelector('details').open})));
 const previousScroll=await page.evaluate(()=>({x:scrollX,y:scrollY})),previousFocus=await page.evaluateHandle(()=>document.activeElement),cases=[],screenshots=[];
 try{
  for(const original of statesBefore){
   const source=sources.nth(original.sourceIndex),details=source.locator('details'),summary=details.locator('summary');
   // Even an already-open disclosure is reopened through its actual Enter interaction.
   await summary.focus();if(original.open){await page.keyboard.press('Enter');await assertClosed(details);}
   await page.keyboard.press('Enter');await page.waitForFunction(index=>document.querySelectorAll('.q-dx-source')[index]?.querySelector('details').open,original.sourceIndex);
   await page.evaluate(()=>document.fonts.ready);const measured=await page.evaluate(dexTypographyBrowserSnapshot,{mode:'source',sourceId:original.sourceId,sourceIndex:original.sourceIndex});
   if(original.sourceIndex===0||original.sourceIndex===count-1){
    await details.evaluate(element=>{element.scrollIntoView({block:'start',behavior:'instant'});window.scrollBy(0,-110);});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const position=original.sourceIndex===0?'first':'last',file='dex-disclosure-'+position+'-'+appearance+'-'+width+'.png';
    const geometry=await details.evaluate(element=>{const r=element.getBoundingClientRect(),summary=element.querySelector('summary').getBoundingClientRect(),box=r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}),left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);return{width:innerWidth,height:innerHeight,scrollX,scrollY,open:element.open,rect:box(r),summaryRect:box(summary),visibleRect:{left,right,top,bottom,width:Math.max(0,right-left),height:Math.max(0,bottom-top)}};});
    await page.screenshot({path:out+'/'+file});screenshots.push({file,position,sourceId:original.sourceId,sourceIndex:original.sourceIndex,...geometry});
   }
   if(!original.open){await summary.focus();await page.keyboard.press('Enter');await assertClosed(details);}
   cases.push({...measured,originalOpen:original.open,openedByKeyboard:true,restoredOpen:(await details.getAttribute('open'))!==null});
  }
 }finally{
  // Restore every state even if a measurement or screenshot fails.
  for(const original of statesBefore){const details=sources.nth(original.sourceIndex).locator('details');if(((await details.getAttribute('open'))!==null)!==original.open){await details.locator('summary').focus();await page.keyboard.press('Enter');}}
  await previousFocus.evaluate(element=>element?.focus?.({preventScroll:true}));await previousFocus.dispose();
  await page.evaluate(position=>scrollTo(position.x,position.y),previousScroll);
 }
 const statesAfter=await sources.evaluateAll(nodes=>nodes.map((source,index)=>({sourceId:source.dataset.dexSource,sourceIndex:index,open:source.querySelector('details').open})));
 assert.deepEqual(statesAfter,statesBefore);
 return{appearance,width,height:width===390?844:900,sourceCount:count,sources:cases,statesBefore,statesAfter,restored:true,screenshots};
 async function assertClosed(details){await page.waitForFunction(index=>!document.querySelectorAll('.q-dx-source')[index]?.querySelector('details').open,await details.evaluate(element=>[...document.querySelectorAll('.q-dx-source')].indexOf(element.closest('.q-dx-source'))));}
}

async function collectDexContent(page){return page.evaluate(()=>{
 const root=document.querySelector('.q-dx-page'),text=node=>(node.textContent||'').replace(/\s+/g,' ').trim();
 return{appearance:document.documentElement.dataset.resolvedAppearance,width:innerWidth,height:innerHeight,allText:text(root),
  sources:[...root.querySelectorAll('.q-dx-source')].map((node,index)=>({sourceId:node.dataset.dexSource,sourceIndex:index,text:text(node)})),
  captions:[...root.querySelectorAll('h1,h2,h3,h4,p,small,label,dt,dd,summary,th,td')].map((node,index)=>({index,tag:node.tagName.toLowerCase(),text:text(node)})),
  controls:[...root.querySelectorAll('button,input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]),select,textarea,a')].map((node,index)=>({index,tag:node.tagName.toLowerCase(),name:node.getAttribute('name'),href:node.getAttribute('href'),ariaLabel:node.getAttribute('aria-label'),text:text(node),value:typeof node.value==='string'?node.value:null}))};
 });}

assert.equal(controlsMatrix,true);assert.equal(live,false);
try{for(const appearance of ['dark','light'])for(const width of (controlsMatrix?[1440,768,390,320]:[1440,390])){
 const context=await browser.newContext({viewport:{width,height:width===390?844:900},colorScheme:appearance,hasTouch:width===390,serviceWorkers:'block'});let writes=0;
 await context.addInitScript(value=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:value})),appearance);
 await context.route('**/*',async r=>{if(['GET','HEAD','OPTIONS'].includes(r.request().method()))await r.continue();else{writes++;await r.abort();}});
 if(!live)await context.route('**/api/v1/preferences/layout',async r=>{if(r.request().method()!=='GET'){writes++;return r.abort();}const response=await r.fetch(),data=await response.json();await r.fulfill({response,json:{...data,appearance}});});
 const page=await context.newPage();activePage=page;await page.goto(site+'/#/dex-discovery',{waitUntil:'domcontentloaded'});await page.locator('.q-dx-source').first().waitFor();await page.waitForFunction(value=>document.documentElement.dataset.resolvedAppearance===value,appearance);
 await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.brandReady==='true');await page.locator('.qelly-opening').waitFor({state:'hidden'});const actionColors=await page.locator('[data-dex-chat]').evaluate(n=>{const s=getComputedStyle(n);return {foreground:s.color,background:s.backgroundColor};});const hex=value=>'#'+value.match(/\d+/g).slice(0,3).map(n=>Number(n).toString(16).padStart(2,'0')).join('');const actionContrast=contrastRatio(hex(actionColors.foreground),hex(actionColors.background));assert.ok(actionContrast>=4.5,'Chat draft action must have readable contrast in '+appearance+': '+JSON.stringify(actionColors));
 typographyResults.push(await collectDexTypography(page));contentResults.push(await collectDexContent(page));await page.screenshot({path:out+'/dex-top-'+appearance+'-'+width+'.png'});const total=await page.locator('.q-dx-source').count();assert.ok(total>0);assert.equal(await page.locator('.q-dx-capability-table [role=cell]').filter({hasText:'Unavailable'}).count(),7);
 const hierarchy=await page.evaluate(()=>{const brief=document.querySelector('#dex-research-brief'),market=document.querySelector('#dex-market-evidence');return {briefBeforeMarket:!!(brief.compareDocumentPosition(market)&Node.DOCUMENT_POSITION_FOLLOWING),boundaryClosed:!document.querySelector('[data-dex-boundary]').open};});assert.equal(hierarchy.briefBeforeMarket,true);assert.equal(hierarchy.boundaryClosed,true);
 await page.locator('[data-dex-boundary] summary').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('[data-dex-boundary]').getAttribute('open'),'');assert.ok((await page.locator('[data-dex-boundary]').innerText()).includes('oracle, bridge, governance'));await page.keyboard.press('Enter');assert.equal(await page.locator('[data-dex-boundary]').getAttribute('open'),null);
 const sourceGates=await page.locator('[data-dex-gate]').evaluateAll(nodes=>nodes.map(n=>{const parts=n.querySelector('[data-dex-gate-count]').textContent.match(/^(\d+) \/ (\d+) sources$/),bar=n.querySelector('i'),style=getComputedStyle(bar);return {id:n.dataset.dexGate,count:Number(parts[1]),total:Number(parts[2]),widthPercent:parseFloat(bar.style.width),background:style.backgroundColor,accent:getComputedStyle(n).getPropertyValue('--q-accent').trim()};}));assert.equal(sourceGates.length,4);assert.equal(sourceGates.reduce((n,g)=>n+g.count,0),total);for(const gate of sourceGates){assert.equal(gate.total,total);assert.ok(Math.abs(gate.widthPercent-gate.count/total*100)<0.001);assert.ok(gate.count>=0);}
 assert.ok((await page.locator('.q-dx-gate-map').innerText()).includes('do not measure protocol quality'));

 // Static source evidence and disclosure controls must stay readable beside the dock.
 for(const selector of['.q-dx-gate-map','.q-dx-source','.q-dx-method dl','.q-dx-metrics']){await page.locator(selector).first().evaluate(e=>{const target=e.matches('.q-dx-metrics')?e.lastElementChild:e;target.scrollIntoView({block:'end',behavior:'instant'});});await page.waitForFunction(()=>document.querySelector('.q-ai-root').dataset.clearance==='content');await page.waitForFunction(()=>{const e=document.querySelector('[data-q-ai-launcher]'),s=getComputedStyle(e);return Number(s.opacity)===0&&s.pointerEvents==='none'&&e.tabIndex===-1&&e.getAttribute('aria-hidden')==='true';});if(selector==='.q-dx-metrics'){
 const summaryHit=await page.evaluate(()=>{const launcher=document.querySelector('[data-q-ai-launcher]'),actual=launcher.getBoundingClientRect(),s=getComputedStyle(launcher),bottom=innerHeight-(Number.parseFloat(s.bottom)||0),d={left:(innerWidth-actual.width)/2,right:(innerWidth+actual.width)/2,top:bottom-actual.height,bottom},group=document.querySelector('.q-dx-metrics');const tiles=[...group.querySelectorAll('article')].map(e=>({e,r:e.getBoundingClientRect()}));const tile=tiles.find(({r})=>r.left<d.right&&r.right>d.left&&r.top<d.bottom&&r.bottom>d.top);if(!tile)return {overlap:false};const x=(Math.max(tile.r.left,d.left)+Math.min(tile.r.right,d.right))/2,y=(Math.max(tile.r.top,d.top)+Math.min(tile.r.bottom,d.bottom))/2;return {overlap:true,tileReceivesHit:tile.e.contains(document.elementFromPoint(x,y)),tiles:tiles.length,opacity:s.opacity,pointer:s.pointerEvents,ariaHidden:launcher.getAttribute('aria-hidden'),tabIndex:launcher.tabIndex};});
 assert.equal(summaryHit.overlap,true);assert.equal(summaryHit.tileReceivesHit,true);assert.equal(summaryHit.tiles,6);assert.equal(summaryHit.opacity,'0');assert.equal(summaryHit.pointer,'none');assert.equal(summaryHit.ariaHidden,'true');assert.equal(summaryHit.tabIndex,-1);
 }
 await page.keyboard.press('Control+/');await page.locator('[data-q-ai-assistant]').waitFor({state:'visible'});await page.waitForFunction(()=>document.activeElement?.matches('[data-q-ai-form] textarea'));await page.keyboard.press('Escape');await page.locator('[data-q-ai-assistant]').waitFor({state:'hidden'});}
 await page.locator('.q-dx-source summary').first().focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.q-dx-source details').first().getAttribute('open'),'');await page.keyboard.press('Enter');assert.equal(await page.locator('.q-dx-source details').first().getAttribute('open'),null);await page.evaluate(()=>window.scrollTo(0,0));
 await page.locator('[data-dex-search]').fill('no-source-matches-this');assert.equal(await page.locator('.q-dx-source').count(),0);await page.locator('[data-dex-reset]').click();assert.equal(await page.locator('.q-dx-source').count(),total);
 await page.locator('[data-dex-stage]').selectOption('rights-review');assert.ok(await page.locator('.q-dx-source').count()>0);assert.equal(await page.locator('.q-dx-source:not([data-stage="rights-review"])').count(),0);await page.locator('[data-dex-reset]').click();
 await page.locator('[name=chain]').fill('Ethereum');await page.locator('[name=protocol]').fill('<img src=x onerror=alert(1)>');assert.equal(await page.locator('[data-dex-brief] img').count(),0);assert.ok((await page.locator('[data-dex-brief]').innerText()).includes('<img src=x onerror=alert(1)>'));
 await page.locator('[data-dex-evidence]').first().check();await page.locator('[name=market]').fill('user-supplied contract');assert.equal(await page.locator('[data-dex-evidence]').first().isChecked(),true);await page.locator('[name=hypothesis]').fill('Which evidence is missing?');
 await page.locator('[data-dex-section="dex-market-evidence"]').click();assert.equal(await page.locator('#dex-market-evidence').evaluate(n=>document.activeElement===n),true);
 await page.locator('[data-dex-chat]').click();await page.locator('[data-q-ai-assistant]').waitFor({state:'visible'});const draft=await page.locator('[data-q-ai-form] textarea').inputValue();assert.ok(draft.includes('Ethereum')&&draft.includes('user-supplied contract')&&draft.includes('not verified evidence'));await page.waitForFunction(()=>document.activeElement?.matches('[data-q-ai-form] textarea'));const draftComposer=await page.locator('[data-q-ai-form] textarea').evaluate(e=>({height:e.getBoundingClientRect().height,scrollTop:e.scrollTop,selectionStart:e.selectionStart,selectionEnd:e.selectionEnd,valueLength:e.value.length}));assert.ok(draftComposer.height>92&&draftComposer.height<=160.5,'DEX prefill should grow within its cap');assert.equal(draftComposer.scrollTop,0,'DEX draft should start at its research boundary');assert.equal(draftComposer.selectionStart,0);assert.equal(draftComposer.selectionEnd,0);assert.equal(await page.locator('[data-q-ai-message-role="user"]').count(),0);await page.locator('[data-q-ai-close]').click();
 await page.locator('[data-dex-clear]').click();await page.locator('.q-toast').filter({hasText:'DEX research brief cleared.'}).waitFor();await page.locator('.q-toast').filter({hasText:'DEX research brief cleared.'}).getByRole('button',{name:'Dismiss notification'}).click({trial:true});const toastSizing=await page.locator('.q-toast').filter({hasText:'DEX research brief cleared.'}).getByRole('button',{name:'Dismiss notification'}).evaluate(node=>{const styles=getComputedStyle(node),properties=['width','height','min-width','min-height','max-width','max-height','transform','zoom'],matchedRules=[];const visit=(rules,asset)=>{for(const rule of rules){if(rule.selectorText){try{if(node.matches(rule.selectorText)){const declarations=properties.flatMap(property=>rule.style.getPropertyValue(property)?[{property,value:rule.style.getPropertyValue(property),priority:rule.style.getPropertyPriority(property)}]:[]);if(declarations.length)matchedRules.push({asset,selector:rule.selectorText,declarations});}}catch{}}else if(rule.cssRules){if(rule.constructor.name==='CSSMediaRule'&&!matchMedia(rule.conditionText).matches)continue;visit(rule.cssRules,asset);}}};for(const sheet of document.styleSheets)try{visit(sheet.cssRules,sheet.href||'inline');}catch{}return{inlineStyle:node.getAttribute('style'),className:node.className,computed:Object.fromEntries(properties.map(p=>[p,styles.getPropertyValue(p)])),matchedRules};});console.log(JSON.stringify({toastSizing,appearance,width}));await writeFile(out+'/toast-sizing.json',JSON.stringify({toastSizing,appearance,width},null,2));const toastColors=await page.locator('.q-toast').filter({hasText:'DEX research brief cleared.'}).evaluate(n=>{const s=getComputedStyle(n),b=n.querySelector('button').getBoundingClientRect();return {foreground:s.color,background:s.backgroundColor,dismissWidth:b.width,dismissHeight:b.height};});const toastContrast=contrastRatio(hex(toastColors.foreground),hex(toastColors.background));assert.ok(toastContrast>=4.5,'Toast must remain readable in '+appearance);assert.ok(toastColors.dismissWidth>=44&&toastColors.dismissHeight>=44,'Toast dismiss target must be touch accessible: '+JSON.stringify(toastColors));await page.screenshot({path:out+'/dex-feedback-'+appearance+'-'+width+'.png'});await page.locator('.q-toast').filter({hasText:'DEX research brief cleared.'}).getByRole('button',{name:'Dismiss notification'}).click();await page.locator('.q-toast').filter({hasText:'DEX research brief cleared.'}).waitFor({state:'hidden'});assert.equal(await page.locator('[name=chain]').inputValue(),'');assert.equal(await page.locator('[data-dex-evidence]:checked').count(),0);
 await page.locator('.q-dx-source summary').first().click();await page.locator('.q-dx-source details').first().locator('dl').waitFor({state:'visible'});sourceDisclosureTypographyResults.push(await collectDexSourceDisclosureTypography(page,out,appearance,width));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 const cascadeSamples=await page.evaluate(()=>{
 const properties=['background','background-color','border','border-radius','box-shadow','color','padding','display'];
 return ['.q-dx-hero','.q-dx-hero aside','.q-dx-source','.q-dx-source details','.q-dx-source>a','.q-ai-launcher'].map(selector=>{
  const node=document.querySelector(selector);if(!node)return {selector,missing:true};const styles=getComputedStyle(node),matches=[];
  const visit=(rules,asset,conditions=[])=>{for(const rule of rules){if(rule.selectorText){try{if(node.matches(rule.selectorText)){const declarations=properties.flatMap(property=>{const value=rule.style.getPropertyValue(property);return value?[{property,value,priority:rule.style.getPropertyPriority(property)}]:[];});if(declarations.length)matches.push({asset,selector:rule.selectorText,declarations,conditions});}}catch{}}else if(rule.cssRules){if(rule.constructor.name==='CSSMediaRule'&&!matchMedia(rule.conditionText).matches)continue;visit(rule.cssRules,asset,[...conditions,{type:rule.constructor.name,condition:rule.conditionText||rule.name||null,containerBoundary:rule.constructor.name==='CSSContainerRule'?'not independently resolved':null}]);}}};
  for(const sheet of document.styleSheets)try{visit(sheet.cssRules,sheet.href||'inline');}catch{}
  return {selector,classes:node.className,computed:Object.fromEntries(properties.map(p=>[p,styles.getPropertyValue(p)])),matchedRules:matches};
 });
 });
 const boxlessSurfaces=await page.locator('.q-dx-hero,.q-dx-source,.q-dx-source details').evaluateAll(nodes=>nodes.map(n=>{const s=getComputedStyle(n);return {className:n.className,shadow:s.boxShadow,radius:s.borderRadius};}));assert.ok(boxlessSurfaces.every(n=>n.shadow==='none'&&n.radius==='0px'),'DEX surfaces must be owned by the boxless route layout');
   const controls=await page.locator('.q-dx-page button,.q-dx-page input:not([type=checkbox]),.q-dx-page select,.q-dx-page textarea,.q-dx-page a.q-button').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.height;}).map(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return{tag:n.tagName,borders:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],radius:s.borderRadius,shadow:s.boxShadow,height:r.height};}));assert.ok(controls.length>=9);for(const control of controls){assert.deepEqual(control.borders,['0px','0px','0px','0px']);assert.equal(control.radius,'0px');assert.equal(control.shadow,'none');assert.ok(control.height>=44);}
  await page.locator('[name=chain]').focus();const controlFocus=await page.locator('[name=chain]').evaluate(n=>({outline:Number.parseFloat(getComputedStyle(n).outlineWidth),style:getComputedStyle(n).outlineStyle}));assert.ok(controlFocus.outline>=2&&controlFocus.style!=='none');
const borderlessSurfaces=await page.locator('.q-dx-page,.q-dx-page *').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0;}).map(n=>{const s=getComputedStyle(n);return {tag:n.tagName,className:n.className,borders:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth]};}));assert.ok(borderlessSurfaces.length>50);assert.ok(borderlessSurfaces.every(n=>n.borders.every(v=>v==='0px')),'DEX decoration must remain borderless: '+JSON.stringify(borderlessSurfaces.filter(n=>n.borders.some(v=>v!=='0px'))));
 await page.screenshot({path:out+'/dex-source-'+appearance+'-'+width+'.png'});await page.locator('#dex-contract-context').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/dex-method-'+appearance+'-'+width+'.png'});await page.evaluate(()=>scrollTo(0,0));const fullPageGeometry=await page.evaluate(()=>({width:innerWidth,height:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)}));await page.screenshot({path:out+'/dex-'+appearance+'-'+width+'.png',fullPage:true});
 const governedSource=await (await page.request.get(site+'/api/v1/discovery/dex')).json();assert.equal(governedSource.summary.total,total);const invalidGate={...governedSource,summary:{...governedSource.summary,byStage:{...governedSource.summary.byStage,'contract-required':-1}}};await page.route('**/api/v1/discovery/dex',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(invalidGate)}));await page.reload({waitUntil:'domcontentloaded'});await page.locator('.q-dx-gate-map').waitFor();assert.equal(await page.locator('[data-dex-gate-count]').count(),0);assert.ok((await page.locator('.q-dx-gate-map').innerText()).includes('Source gate counts are unavailable'));assert.equal(await page.locator('.q-dx-source').count(),total);assert.equal(await page.locator('.q-dx-capability-table [role=cell]').filter({hasText:'Unavailable'}).count(),7);await page.unroute('**/api/v1/discovery/dex');
 await page.route('**/api/v1/discovery/dex',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'DEX research unavailable'})}));await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-dex-retry]').waitFor();assert.equal(await page.locator('.q-dx-source').count(),0);assert.ok((await page.locator('.q-dx-error').innerText()).includes('No TVL, volume, APR, liquidity or safety value was substituted'));await page.screenshot({path:out+'/dex-failure-'+appearance+'-'+width+'.png'});
 assert.equal(writes,0,'DEX/Chat interactions must not initiate non-read requests');results.push({appearance,width,total,actionContrast,toastContrast,boxlessSurfaces,borderlessSurfaces,controls,controlFocus,cascadeSamples,hierarchy,sourceGates,sourceEvidenceClearance:true,gateMapClearance:true,methodologyClearance:true,summaryEvidenceClearance:true,summaryTileHitTest:true,keyboardChatAvailable:true,disclosureKeyboardPreserved:true,invalidGateFailsClosed:true,filters:true,briefRetained:true,escapedInput:true,chatDraftOnly:true,draftComposer,keyboardSectionFocus:true,overflow:false,failureState:true,nonReadRequests:0,fullPageGeometry,governedDirectoryHash:hash(JSON.stringify({sources:governedSource.sources,summary:governedSource.summary,evidenceFields:governedSource.evidenceFields}))});await context.close();
}}catch(error){await activePage?.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/report.json',JSON.stringify({status:'failed',expected,sourceCssBindings,rendererSha256,typographyResults,sourceDisclosureTypographyResults,contentResults,error:error.stack,results},null,2));throw error;}finally{await browser.close();if(server){await new Promise(r=>server.server.close(r));await new Promise(r=>server.evidenceUpstream.server.close(r));}}
await writeFile(out+'/report.json',JSON.stringify({status:'passed',schema:'qelly.dex.typography-owner/3.0',expected,sourceCssBindings,rendererSha256,typographyResults,sourceDisclosureTypographyResults,contentResults,fixtureOnly:true,allOriginalInteractionAssertionsPreserved:true,newRules:22,newStylesheets:0,newPriorityOverrides:0,newObservers:0,newProvidersEnabled:false,numericalEnginesChanged:false,authConfigurationChanged:false,walletExecutionEnabled:false,causalPerformanceImprovementClaimed:false,productionAccepted:false,fullDexWaveAccepted:false,sourceSha:process.env.QELLY_SCREEN_EVIDENCE_SHA,results,site,live,boundary:live?'Exact deployed runtime with actual governed responses; all outgoing writes blocked. The API failure case is an explicit isolated injected error. Full DEX flagship and all-route acceptance remain separate.':'Isolated governed evidence fixture; deployed acceptance is separate.'},null,2));console.log(JSON.stringify({status:'passed',cases:results.length}));
