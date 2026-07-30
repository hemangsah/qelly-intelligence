import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { chromium, firefox, webkit } from 'playwright';
import { calculateFormula, listFormulaDefinitions } from '../apps/web/public/assets/calculation/formula-engine.mjs';
import { calculateIndicator, listIndicatorDefinitions } from '../apps/web/public/assets/calculation/indicator-engine.mjs';

const head=process.env.QELLY_REVIEW_HEAD??process.env.GITHUB_SHA??'unknown';
const output=path.resolve('.prompt2b-review');
const screenshots=path.join(output,'screenshots');
await mkdir(screenshots,{recursive:true});

const sha256=(buffer)=>createHash('sha256').update(buffer).digest('hex');
const dist=path.resolve('dist/frontend');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  let rel=decodeURIComponent(url.pathname).replace(/^\/qelly-intelligence\/?/,'');
  if(!rel||rel.endsWith('/'))rel+='index.html';
  const target=path.join(dist,rel);
  try{const body=await readFile(target);res.writeHead(200,{'content-type':mime[path.extname(target)]??'application/octet-stream','cache-control':'no-store'});res.end(body);}
  catch{try{const body=await readFile(path.join(dist,'index.html'));res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(body);}catch{res.writeHead(404);res.end('not found');}}
});
await new Promise(resolve=>server.listen(4174,'127.0.0.1',resolve));
const base='http://127.0.0.1:4174/qelly-intelligence/';

const browserTypes=[['chromium',chromium],['firefox',firefox],['webkit',webkit]];
const viewports=[[360,800],[390,844],[430,932],[768,1024],[1024,768],[1280,800],[1440,1000],[1728,1080],[1920,1080]];
const themes=[
  {label:'dark',persona:'burgundy-command',colorScheme:'dark'},
  {label:'porcelain-light',persona:'porcelain-burgundy',colorScheme:'light'},
  {label:'oled',persona:'burgundy-night',colorScheme:'dark'},
  {label:'high-contrast',persona:'high-contrast',colorScheme:'dark'}
];
const motions=['full','reduced'];
const routes=['calculator-center','india-finance','indicator-library','formula-library','saved-calculations'];
const records=[];
const failures=[];
const screenshotManifest=[];
const progressPath=path.join(output,'PROGRESS.json');
const writeProgress=async(payload)=>writeFile(progressPath,JSON.stringify({head,updatedAt:new Date().toISOString(),completedRecords:records.length,failures:failures.length,...payload},null,2)+'\n');

const shouldCapture=(browser,width,theme,motion,route)=>
  (browser==='chromium'&&width===1440&&motion==='full')||
  (browser==='chromium'&&width===390&&motion==='reduced'&&(theme==='dark'||theme==='porcelain-light'))||
  (route==='calculator-center'&&width===1440&&theme==='dark'&&motion==='reduced'&&(browser==='firefox'||browser==='webkit'));

const waitForRoute=async(page)=>{
  await page.waitForSelector('html[data-app-ready="true"]',{state:'attached',timeout:30000});
  await page.waitForFunction(()=>{
    const main=document.querySelector('#main');
    return main&&main.getAttribute('aria-busy')==='false'&&main.childElementCount>0&&(main.textContent??'').trim().length>60;
  },null,{timeout:30000});
  await page.evaluate(async()=>{await document.fonts?.ready;});
  await page.waitForFunction(()=>!document.querySelector('.qelly-opening'),null,{timeout:5000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
};

const applyThemeAndMotion=async(page,theme,motion)=>{
  await page.evaluate((persona)=>{
    const selector=document.querySelector('#global-theme-selector');
    if(!selector)throw new Error('Governed persona selector is unavailable');
    selector.value=persona;
    selector.dispatchEvent(new Event('change',{bubbles:true}));
  },theme.persona);
  await page.waitForFunction((persona)=>{
    const root=document.documentElement;
    return root.dataset.theme===persona&&root.dataset.persona===persona;
  },theme.persona,{timeout:10000});
  await page.evaluate((mode)=>{
    document.documentElement.dataset.motion=mode;
    if(mode==='reduced')document.documentElement.style.setProperty('--q-motion-scale','0');
    else document.documentElement.style.removeProperty('--q-motion-scale');
  },motion);
  await page.evaluate(async()=>{await document.fonts?.ready;});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
};

const clickTrustedAction=async(page,selector,actionName)=>{
  const action=page.locator(selector);
  await action.waitFor({state:'visible',timeout:10000});
  if(!await action.isEnabled())throw new Error(`${actionName} action is disabled`);
  await page.mouse.move(1,1);
  await action.scrollIntoViewIfNeeded();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.evaluate(({selector,actionName})=>{
    delete window.__qellyReviewTrustedAction;
    const handler=(event)=>{
      const target=event.target instanceof Element?event.target.closest(selector):null;
      if(!target)return;
      window.__qellyReviewTrustedAction={actionName,isTrusted:event.isTrusted,tagName:target.tagName,dataAction:target.getAttribute('data-action')};
      document.removeEventListener('click',handler,true);
    };
    document.addEventListener('click',handler,true);
  },{selector,actionName});
  const point=await page.evaluate((selector)=>{
    const element=document.querySelector(selector);
    if(!(element instanceof HTMLElement))throw new Error(`Missing action ${selector}`);
    const rect=element.getBoundingClientRect();
    const inset=Math.max(4,Math.min(12,Math.min(rect.width,rect.height)/4));
    const candidates=[
      [rect.left+rect.width/2,rect.top+rect.height/2],
      [rect.left+inset,rect.top+rect.height/2],
      [rect.right-inset,rect.top+rect.height/2],
      [rect.left+rect.width/2,rect.top+inset],
      [rect.left+rect.width/2,rect.bottom-inset]
    ];
    for(const [x,y] of candidates){
      const hit=document.elementFromPoint(x,y);
      if(hit&&(hit===element||element.contains(hit)))return {x,y};
    }
    throw new Error(`No unobstructed click point for ${selector}`);
  },selector);
  await page.mouse.move(point.x,point.y);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
  const settled=await page.evaluate((selector)=>{
    const element=document.querySelector(selector);
    if(!(element instanceof HTMLElement))return null;
    const rect=element.getBoundingClientRect();
    const x=rect.left+rect.width/2,y=rect.top+rect.height/2;
    const hit=document.elementFromPoint(x,y);
    return hit&&(hit===element||element.contains(hit))?{x,y}:null;
  },selector);
  if(!settled)throw new Error(`Action moved behind another element before click: ${selector}`);
  await page.mouse.move(settled.x,settled.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForFunction((expected)=>window.__qellyReviewTrustedAction?.actionName===expected&&window.__qellyReviewTrustedAction?.isTrusted===true,actionName,{timeout:3000});
};

const measureNavigationClearance=async(page)=>page.evaluate(async()=>{
  const main=document.querySelector('#main');
  const navigation=document.querySelector('#mobile-navigation');
  if(!main||!navigation||getComputedStyle(navigation).position!=='fixed'||getComputedStyle(navigation).display==='none')return {supported:false,obscured:0,navHeight:0,clearance:null,focusClearance:null,scrollOwner:'none'};
  const sentinel=document.createElement('div');
  sentinel.tabIndex=-1;
  sentinel.dataset.reviewEnd='true';
  sentinel.setAttribute('aria-hidden','true');
  sentinel.style.cssText='display:block;inline-size:1px;block-size:1px;padding:0;margin:0;border:0;opacity:.001;';
  main.append(sentinel);
  const scrollingElement=document.scrollingElement||document.documentElement;
  const scrollOwner=(()=>{let node=sentinel.parentElement;while(node&&node!==document.body&&node!==document.documentElement){const style=getComputedStyle(node);if(/auto|scroll|overlay/.test(style.overflowY)&&node.scrollHeight>node.clientHeight+1)return node;node=node.parentElement;}return scrollingElement;})();
  const ownerName=scrollOwner===scrollingElement?'document':`${scrollOwner.tagName.toLowerCase()}${scrollOwner.id?`#${scrollOwner.id}`:''}${scrollOwner.classList.length?`.${[...scrollOwner.classList].join('.')}`:''}`;
  const previousRootBehavior=document.documentElement.style.scrollBehavior;
  const previousOwnerBehavior=scrollOwner.style.scrollBehavior;
  document.documentElement.style.scrollBehavior='auto';
  scrollOwner.style.scrollBehavior='auto';
  const target=Math.max(0,scrollOwner.scrollHeight-(scrollOwner===scrollingElement?innerHeight:scrollOwner.clientHeight));
  let settled=false;
  for(let attempt=0;attempt<60;attempt++){scrollOwner.scrollTop=target;await new Promise(resolve=>requestAnimationFrame(resolve));if(Math.abs(scrollOwner.scrollTop-target)<=1){settled=true;break;}}
  sentinel.focus({preventScroll:true});
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const navRect=navigation.getBoundingClientRect();
  const sentinelRect=sentinel.getBoundingClientRect();
  const candidates=[...main.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')].filter(element=>!navigation.contains(element)&&getComputedStyle(element).visibility!=='hidden'&&getComputedStyle(element).display!=='none');
  const lastAction=candidates.at(-1)??null;
  if(lastAction){lastAction.focus({preventScroll:true});await new Promise(resolve=>requestAnimationFrame(resolve));}
  const finalNavRect=navigation.getBoundingClientRect();
  const lastRect=lastAction?.getBoundingClientRect?.()??null;
  const obscured=candidates.filter(element=>{const rect=element.getBoundingClientRect();return rect.width>0&&rect.height>0&&rect.top<innerHeight&&rect.bottom>finalNavRect.top+1;}).length;
  const result={supported:true,obscured,navHeight:finalNavRect.height,clearance:navRect.top-sentinelRect.bottom,focusClearance:lastRect?finalNavRect.top-lastRect.bottom:null,scrollOwner:ownerName,targetScroll:target,actualScroll:scrollOwner.scrollTop,settled,lastAction:lastAction?.outerHTML?.slice(0,180)??null};
  sentinel.remove();
  document.documentElement.style.scrollBehavior=previousRootBehavior;
  scrollOwner.style.scrollBehavior=previousOwnerBehavior;
  return result;
});

try{
  for(const [browserName,type] of browserTypes){
    const browser=await type.launch({headless:true});
    for(const [width,height] of viewports)for(const theme of themes)for(const motion of motions){
      const context=await browser.newContext({viewport:{width,height},reducedMotion:motion==='reduced'?'reduce':'no-preference',colorScheme:theme.colorScheme,acceptDownloads:true});
      await context.addInitScript(()=>{
        sessionStorage.setItem('qelly.brand.opening.v1','seen');
        localStorage.removeItem('qelly.calculations.v1');
        window.__qellyCLS=0;
        if('PerformanceObserver' in window){try{new PerformanceObserver((list)=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)window.__qellyCLS+=entry.value;}).observe({type:'layout-shift',buffered:true});}catch{}}
      });
      for(const route of routes){
        await writeProgress({phase:'attempting',browser:browserName,width,height,appearance:theme.label,persona:theme.persona,motion,route});
        const page=await context.newPage();
        const consoleErrors=[];const pageErrors=[];const failedResources=[];const actionErrors=[];
        page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
        page.on('pageerror',error=>pageErrors.push(error.message));
        page.on('requestfailed',request=>{if(request.url().startsWith('http://127.0.0.1'))failedResources.push({url:request.url(),error:request.failure()?.errorText??'unknown'});});
        const started=performance.now();
        await page.goto(`${base}#/${route}`,{waitUntil:'domcontentloaded',timeout:30000});
        await waitForRoute(page);
        await applyThemeAndMotion(page,theme,motion);
        if(route==='calculator-center'){
          try{
            const initial=await page.locator('#result-primary').textContent();
            await clickTrustedAction(page,'[data-action="calculate"]','calculator-calculate');
            await page.waitForFunction((before)=>{const element=document.querySelector('#result-primary');const evidence=document.querySelector('#result-evidence');return Boolean(element)&&element.textContent!==before&&!element.textContent.includes('Ready for')&&Boolean(evidence?.textContent?.trim());},initial,{timeout:10000});
          }catch(error){actionErrors.push({action:'calculator-calculate',name:error.name,message:error.message});}
        }
        if(route==='indicator-library'){
          try{
            const initial=await page.locator('#indicator-primary').textContent();
            await clickTrustedAction(page,'[data-action="calculate"]','indicator-calculate');
            await page.waitForFunction((before)=>{const element=document.querySelector('#indicator-primary');return Boolean(element)&&element.textContent!==before&&element.textContent!=='Ready';},initial,{timeout:10000});
          }catch(error){actionErrors.push({action:'indicator-calculate',name:error.name,message:error.message});}
        }
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const navClearance=await measureNavigationClearance(page);
        const loadMs=performance.now()-started;
        const metrics=await page.evaluate(()=>{
          const root=document.documentElement,body=document.body,main=document.querySelector('#main');
          const visible=(element)=>{const style=getComputedStyle(element),rect=element.getBoundingClientRect();return !element.disabled&&style.visibility!=='hidden'&&style.display!=='none'&&rect.width>0&&rect.height>0;};
          const interactive=[...document.querySelectorAll('button,input,select,textarea,a[href]')].filter(visible);
          const unlabeled=interactive.filter(element=>{if(element.tagName==='BUTTON'||element.tagName==='A')return !(element.textContent??'').trim()&&!element.getAttribute('aria-label')&&!element.getAttribute('title');const id=element.id;return !element.getAttribute('aria-label')&&!element.getAttribute('aria-labelledby')&&!(id&&document.querySelector(`label[for="${CSS.escape(id)}"]`))&&!element.closest('label');}).length;
          const contentBottom=Math.max(...[...document.querySelectorAll('#main > *, #main section, #main article')].map(element=>element.getBoundingClientRect().bottom+scrollY),0);
          const style=getComputedStyle(root);
          return {textLength:(main?.textContent??'').trim().length,overflowX:Math.max(0,root.scrollWidth-root.clientWidth),documentHeight:root.scrollHeight,contentBottom,excessTrailingSpace:Math.max(0,root.scrollHeight-contentBottom),fontStatus:document.fonts.status,theme:root.dataset.theme??'',persona:root.dataset.persona??'',resolvedAppearance:root.dataset.resolvedAppearance??root.dataset.appearance??'',motion:root.dataset.motion??'',semanticPalette:{canvas:style.getPropertyValue('--q-surface-canvas').trim()||style.getPropertyValue('--q-background').trim(),surface:style.getPropertyValue('--q-surface').trim(),text:style.getPropertyValue('--q-text').trim(),focus:style.getPropertyValue('--q-focus').trim(),positive:style.getPropertyValue('--q-positive').trim(),negative:style.getPropertyValue('--q-negative').trim(),chartGrid:style.getPropertyValue('--q-chart-grid').trim()},bodyBackground:getComputedStyle(body).backgroundColor,logo:Boolean(document.querySelector('.q-brand-lockup,.q-app-brand,.q-brand-mark,img[src*="qelly"],svg[aria-label*="Qelly" i]')),unlabeledControls:unlabeled,cls:Number(window.__qellyCLS??0),headingCount:document.querySelectorAll('h1,h2,h3').length,tableCount:document.querySelectorAll('table').length,activeElement:document.activeElement?.tagName??''};
        });
        const truth=await page.evaluate((current)=>{const text=(document.querySelector('#main')?.textContent??'');if(current==='calculator-center')return /DETERMINISTIC LOCAL/.test(text)&&/not personalized investment/.test(text)&&!/live result/i.test(text);if(current==='india-finance')return /effective/i.test(text)&&/unavailable/i.test(text);if(current==='indicator-library')return /USER-PROVIDED OHLCV/.test(text)&&/No external indicator API/.test(text);if(current==='saved-calculations')return /browser/i.test(text)&&!/cloud save is connected/i.test(text);return /Formula/.test(text)&&/version/i.test(text);},route);
        const record={browser:browserName,width,height,appearance:theme.label,persona:theme.persona,motion,route,loadMs:Number(loadMs.toFixed(2)),...metrics,navClearance,truth,consoleErrors,pageErrors,failedResources,actionErrors};
        const reasons=[];
        if(metrics.textLength<60)reasons.push('empty-content');
        if(metrics.overflowX>1)reasons.push(`horizontal-overflow:${metrics.overflowX}`);
        if(metrics.fontStatus!=='loaded')reasons.push(`font:${metrics.fontStatus}`);
        if(!metrics.logo)reasons.push('logo-missing');
        if(metrics.theme!==theme.persona||metrics.persona!==theme.persona)reasons.push(`theme-not-applied:${metrics.theme}/${metrics.persona}`);
        if(metrics.motion!==motion)reasons.push(`motion-not-applied:${metrics.motion}`);
        if(metrics.unlabeledControls>0)reasons.push(`unlabeled-controls:${metrics.unlabeledControls}`);
        if(navClearance.supported&&(navClearance.obscured>0||navClearance.clearance<0||navClearance.focusClearance<0))reasons.push(`fixed-nav-clearance:${navClearance.obscured}/${navClearance.clearance}/${navClearance.focusClearance}`);
        if(metrics.cls>0.1)reasons.push(`cls:${metrics.cls}`);
        if(metrics.excessTrailingSpace>height)reasons.push(`blank-tail:${metrics.excessTrailingSpace}`);
        if(!truth)reasons.push('truth-boundary');
        if(consoleErrors.length)reasons.push(`console-errors:${consoleErrors.length}`);
        if(pageErrors.length)reasons.push(`page-errors:${pageErrors.length}`);
        if(failedResources.length)reasons.push(`failed-local-resources:${failedResources.length}`);
        if(actionErrors.length)reasons.push(`action-errors:${actionErrors.length}`);
        records.push(record);
        if(reasons.length)failures.push({...record,reasons});
        if(shouldCapture(browserName,width,theme.label,motion,route)||reasons.length){
          const name=`${browserName}-${route}-${width}x${height}-${theme.label}-${motion}.png`;
          await page.screenshot({path:path.join(screenshots,name),fullPage:false});
          const bytes=await readFile(path.join(screenshots,name));
          screenshotManifest.push({name,bytes:bytes.length,sha256:sha256(bytes),browser:browserName,route,width,height,appearance:theme.label,persona:theme.persona,motion,failure:reasons.length>0,reasons});
        }
        await writeProgress({phase:'completed',browser:browserName,width,height,appearance:theme.label,persona:theme.persona,motion,route,reasons,actionErrors});
        await page.close();
      }
      await context.close();
    }
    await browser.close();
  }
}finally{await new Promise(resolve=>server.close(resolve));}

const close=Array.from({length:10000},(_,index)=>100+Math.sin(index/17)*3+index*0.0008);
const high=close.map((value,index)=>value+0.7+(index%4)*0.02);
const low=close.map((value,index)=>value-0.8-(index%3)*0.02);
const open=close.map((value,index)=>value+(index%2?0.1:-0.1));
const volume=close.map((_,index)=>1000+(index%250)*11);
const performanceCases=[];
for(const indicatorId of ['sma','ema','rsi','atr','bollinger-bands','supertrend','vwap','mfi']){const started=performance.now();const result=calculateIndicator(indicatorId,{open,high,low,close,volume,period:14});performanceCases.push({type:'indicator',id:indicatorId,points:10000,durationMs:Number((performance.now()-started).toFixed(3)),status:result.status});}
for(const [formulaId,inputs] of [['loan-amortization',{principal:7500000,annualRatePercent:8.5,months:360}],['xirr',{cashflows:[{amount:-100000,date:'2020-01-01'},{amount:120000,date:'2021-01-01'}]}],['portfolio-volatility',{weights:[0.4,0.35,0.25],covarianceMatrix:[[0.04,0.01,0.008],[0.01,0.03,0.006],[0.008,0.006,0.02]]}]]){const started=performance.now();const result=calculateFormula(formulaId,inputs);performanceCases.push({type:'formula',id:formulaId,durationMs:Number((performance.now()-started).toFixed(3)),status:result.status});}
const performanceFailures=performanceCases.filter(item=>item.status!=='success'||item.durationMs>2000);
const themePairs=[];
for(const browser of browserTypes.map(([name])=>name))for(const route of routes){const samples=Object.fromEntries(themes.map(theme=>[theme.label,records.find(item=>item.browser===browser&&item.route===route&&item.width===1440&&item.motion==='full'&&item.appearance===theme.label)]));const signatures=Object.fromEntries(Object.entries(samples).map(([label,item])=>[label,item?JSON.stringify({body:item.bodyBackground,palette:item.semanticPalette,theme:item.theme}):null]));const distinct=new Set(Object.values(signatures).filter(Boolean)).size;themePairs.push({browser,route,signatures,distinct,allApplied:Object.values(samples).every(Boolean),different:distinct===themes.length});}
const themeFailures=themePairs.filter(item=>!item.allApplied||!item.different);
const report={schemaVersion:3,repository:'hemangsah/qelly-intelligence',head,generatedAt:new Date().toISOString(),formulaDefinitions:listFormulaDefinitions().length,indicatorDefinitions:listIndicatorDefinitions().length,browserMatrix:{records:records.length,passed:records.length-failures.length,failed:failures.length,browsers:browserTypes.map(([name])=>name),viewports:viewports.map(([width,height])=>`${width}x${height}`),themes:themes.map(item=>item.label),motions,routes},performance:{cases:performanceCases,failures:performanceFailures},themeDifferentiation:{pairs:themePairs,failures:themeFailures},screenshots:screenshotManifest,failures,actionEvidence:{mode:'single trusted pointer click after unobstructed hit-test',retries:0,forcedClicks:0}};
await writeFile(path.join(output,'BROWSER_MATRIX.json'),JSON.stringify({head,records,failures},null,2)+'\n');
await writeFile(path.join(output,'PERFORMANCE.json'),JSON.stringify({head,cases:performanceCases,failures:performanceFailures},null,2)+'\n');
await writeFile(path.join(output,'THEME_DIFFERENTIATION.json'),JSON.stringify({head,pairs:themePairs,failures:themeFailures},null,2)+'\n');
await writeFile(path.join(output,'SCREENSHOT_MANIFEST.json'),JSON.stringify({head,files:screenshotManifest},null,2)+'\n');
await writeFile(path.join(output,'SUMMARY.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(path.join(output,'README.md'),`# Qelly Prompt 2B Wave 1 Review\n\nExact head: \`${head}\`\n\n- Formula definitions: ${report.formulaDefinitions}\n- Indicator definitions: ${report.indicatorDefinitions}\n- Browser records: ${report.browserMatrix.records}\n- Browser failures: ${report.browserMatrix.failed}\n- Performance failures: ${performanceFailures.length}\n- Theme differentiation failures: ${themeFailures.length}\n- Screenshots: ${screenshotManifest.length}\n- Action evidence: one trusted pointer click, no retries and no forced clicks\n\nThe compiled preview is a disconnected static visual preview. Font binaries are intentionally excluded from the downloadable review package. No external financial provider, broker, exchange, wallet, trading or custody capability is connected.\n`);
console.log(JSON.stringify({browserRecords:records.length,browserFailures:failures.length,performanceFailures:performanceFailures.length,themeFailures:themeFailures.length,screenshots:screenshotManifest.length,actionEvidence:report.actionEvidence},null,2));
if(failures.length||performanceFailures.length||themeFailures.length)process.exit(1);
