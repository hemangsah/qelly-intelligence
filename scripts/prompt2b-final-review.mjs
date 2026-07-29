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
const viewports=[[360,800],[390,844],[430,932],[768,1024],[1024,768],[1440,1000],[1920,1080]];
const themes=['dark','light','oled','high-contrast'];
const routes=['calculator-center','india-finance','indicator-library','formula-library','saved-calculations'];
const records=[];
const failures=[];
const screenshotManifest=[];

const shouldCapture=(browser,width,appearance,route)=>
  (browser==='chromium'&&width===1440&&(appearance==='dark'||appearance==='light'))||
  (browser==='chromium'&&width===390&&appearance==='dark')||
  (route==='calculator-center'&&width===1440&&appearance==='dark'&&(browser==='firefox'||browser==='webkit'));

for(const [browserName,type] of browserTypes){
  const browser=await type.launch({headless:true});
  for(const [width,height] of viewports){
    for(const appearance of themes){
      const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',colorScheme:appearance==='light'?'light':'dark'});
      await context.addInitScript((value)=>{
        localStorage.setItem('qelly-appearance',value);
        localStorage.setItem('qelly-opening-seen','true');
        localStorage.removeItem('qelly-calculations-v1');
        window.__qellyCLS=0;
        new PerformanceObserver((list)=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)window.__qellyCLS+=entry.value;}).observe({type:'layout-shift',buffered:true});
      },appearance);
      for(const route of routes){
        const page=await context.newPage();
        const consoleErrors=[];const pageErrors=[];const failedResources=[];
        page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
        page.on('pageerror',error=>pageErrors.push(error.message));
        page.on('requestfailed',request=>{if(request.url().startsWith('http://127.0.0.1'))failedResources.push({url:request.url(),error:request.failure()?.errorText??'unknown'});});
        const started=performance.now();
        await page.goto(`${base}#/${route}`,{waitUntil:'domcontentloaded',timeout:30000});
        await page.waitForFunction(()=>((document.querySelector('#main')?.textContent??'').trim().length>60),null,{timeout:20000});
        if(route==='calculator-center'){
          await page.locator('[data-action="calculate"]').click();
          await page.waitForFunction(()=>!document.querySelector('#result-primary')?.textContent?.includes('Ready for'),null,{timeout:10000});
        }
        if(route==='indicator-library'){
          await page.locator('[data-action="calculate"]').click();
          await page.waitForFunction(()=>document.querySelector('#indicator-primary')?.textContent!=='Ready',null,{timeout:10000});
        }
        await page.waitForTimeout(80);
        const loadMs=performance.now()-started;
        const metrics=await page.evaluate(()=>{
          const root=document.documentElement,body=document.body,main=document.querySelector('#main');
          const interactive=[...document.querySelectorAll('button,input,select,textarea,a[href]')].filter(element=>!element.disabled&&getComputedStyle(element).visibility!=='hidden');
          const unlabeled=interactive.filter(element=>{
            if(element.tagName==='BUTTON'||element.tagName==='A')return !(element.textContent??'').trim()&&!element.getAttribute('aria-label')&&!element.getAttribute('title');
            const id=element.id;return !element.getAttribute('aria-label')&&!element.getAttribute('aria-labelledby')&&!(id&&document.querySelector(`label[for="${CSS.escape(id)}"]`))&&!element.closest('label');
          }).length;
          const fixed=[...document.querySelectorAll('*')].filter(element=>getComputedStyle(element).position==='fixed');
          const bottomNav=fixed.find(element=>{const rect=element.getBoundingClientRect();return rect.bottom>=innerHeight-2&&rect.height>35;});
          const contentBottom=Math.max(...[...document.querySelectorAll('#main > *, #main section, #main article')].map(element=>element.getBoundingClientRect().bottom+scrollY),0);
          const excess=Math.max(0,document.documentElement.scrollHeight-contentBottom);
          const bodyStyle=getComputedStyle(body);
          const theme=root.dataset.resolvedAppearance||root.dataset.appearance||root.dataset.theme||'';
          const logo=Boolean(document.querySelector('.q-brand-lockup,.q-app-brand,img[src*="qelly"],svg[aria-label*="Qelly" i]'));
          const hiddenByNav=bottomNav?interactive.filter(element=>{const rect=element.getBoundingClientRect();return rect.bottom>bottomNav.getBoundingClientRect().top&&rect.top<innerHeight&&rect.width>0&&rect.height>0;}).length:0;
          return {textLength:(main?.textContent??'').trim().length,overflowX:Math.max(0,root.scrollWidth-root.clientWidth),documentHeight:root.scrollHeight,contentBottom,excessTrailingSpace:excess,fontStatus:document.fonts.status,theme,bodyBackground:bodyStyle.backgroundColor,logo,unlabeledControls:unlabeled,fixedNavOverlap:hiddenByNav,cls:Number(window.__qellyCLS??0),headingCount:document.querySelectorAll('h1,h2,h3').length,tableCount:document.querySelectorAll('table').length};
        });
        const truth=await page.evaluate((current)=>{
          const text=(document.querySelector('#main')?.textContent??'');
          if(current==='calculator-center')return /DETERMINISTIC LOCAL/.test(text)&&/not personalized investment/.test(text)&&!/live result/i.test(text);
          if(current==='india-finance')return /effective/i.test(text)&&/unavailable/i.test(text);
          if(current==='indicator-library')return /USER-PROVIDED OHLCV/.test(text)&&/No external indicator API/.test(text);
          if(current==='saved-calculations')return /browser/i.test(text)&&!/cloud save is connected/i.test(text);
          return /Formula/.test(text)&&/version/i.test(text);
        },route);
        const record={browser:browserName,width,height,appearance,route,loadMs:Number(loadMs.toFixed(2)),...metrics,truth,consoleErrors,pageErrors,failedResources};
        const reasons=[];
        if(metrics.textLength<60)reasons.push('empty-content');
        if(metrics.overflowX>1)reasons.push(`horizontal-overflow:${metrics.overflowX}`);
        if(metrics.fontStatus!=='loaded')reasons.push(`font:${metrics.fontStatus}`);
        if(!metrics.logo)reasons.push('logo-missing');
        if(metrics.unlabeledControls>0)reasons.push(`unlabeled-controls:${metrics.unlabeledControls}`);
        if(metrics.fixedNavOverlap>0)reasons.push(`fixed-nav-overlap:${metrics.fixedNavOverlap}`);
        if(metrics.cls>0.1)reasons.push(`cls:${metrics.cls}`);
        if(metrics.excessTrailingSpace>height)reasons.push(`blank-tail:${metrics.excessTrailingSpace}`);
        if(!truth)reasons.push('truth-boundary');
        if(consoleErrors.length)reasons.push(`console-errors:${consoleErrors.length}`);
        if(pageErrors.length)reasons.push(`page-errors:${pageErrors.length}`);
        if(failedResources.length)reasons.push(`failed-local-resources:${failedResources.length}`);
        records.push(record);
        if(reasons.length)failures.push({...record,reasons});
        if(shouldCapture(browserName,width,appearance,route)){
          const name=`${browserName}-${route}-${width}x${height}-${appearance}.png`;
          await page.screenshot({path:path.join(screenshots,name),fullPage:false});
          const bytes=await readFile(path.join(screenshots,name));
          screenshotManifest.push({name,bytes:bytes.length,sha256:sha256(bytes),browser:browserName,route,width,height,appearance});
        }
        await page.close();
      }
      await context.close();
    }
  }
  await browser.close();
}
await new Promise(resolve=>server.close(resolve));

const close=Array.from({length:10000},(_,index)=>100+Math.sin(index/17)*3+index*0.0008);
const high=close.map((value,index)=>value+0.7+(index%4)*0.02);
const low=close.map((value,index)=>value-0.8-(index%3)*0.02);
const open=close.map((value,index)=>value+(index%2?0.1:-0.1));
const volume=close.map((_,index)=>1000+(index%250)*11);
const performanceCases=[];
for(const indicatorId of ['sma','ema','rsi','atr','bollinger-bands','supertrend','vwap','mfi']){
  const start=performance.now();
  const result=calculateIndicator(indicatorId,{open,high,low,close,volume,period:14});
  performanceCases.push({type:'indicator',id:indicatorId,points:10000,durationMs:Number((performance.now()-start).toFixed(3)),status:result.status});
}
for(const [formulaId,inputs] of [
  ['loan-amortization',{principal:7500000,annualRatePercent:8.5,months:360}],
  ['xirr',{cashflows:[{amount:-100000,date:'2020-01-01'},{amount:120000,date:'2021-01-01'}]}],
  ['portfolio-volatility',{weights:[0.4,0.35,0.25],covarianceMatrix:[[0.04,0.01,0.008],[0.01,0.03,0.006],[0.008,0.006,0.02]]}]
]){
  const start=performance.now();const result=calculateFormula(formulaId,inputs);performanceCases.push({type:'formula',id:formulaId,durationMs:Number((performance.now()-start).toFixed(3)),status:result.status});
}
const performanceFailures=performanceCases.filter(item=>item.status!=='success'||item.durationMs>2000);
const themePairs=[];
for(const browser of browserTypes.map(([name])=>name))for(const route of routes){const dark=records.find(item=>item.browser===browser&&item.route===route&&item.width===1440&&item.appearance==='dark');const light=records.find(item=>item.browser===browser&&item.route===route&&item.width===1440&&item.appearance==='light');themePairs.push({browser,route,dark:dark?.bodyBackground,light:light?.bodyBackground,different:Boolean(dark&&light&&dark.bodyBackground!==light.bodyBackground)});}
const themeFailures=themePairs.filter(item=>!item.different);
const report={schemaVersion:1,repository:'hemangsah/qelly-intelligence',head,generatedAt:new Date().toISOString(),formulaDefinitions:listFormulaDefinitions().length,indicatorDefinitions:listIndicatorDefinitions().length,browserMatrix:{records:records.length,passed:records.length-failures.length,failed:failures.length,browsers:browserTypes.map(([name])=>name),viewports:viewports.map(([width,height])=>`${width}x${height}`),themes,routes},performance:{cases:performanceCases,failures:performanceFailures},themeDifferentiation:{pairs:themePairs,failures:themeFailures},screenshots:screenshotManifest,failures};
await writeFile(path.join(output,'BROWSER_MATRIX.json'),JSON.stringify({head,records,failures},null,2)+'\n');
await writeFile(path.join(output,'PERFORMANCE.json'),JSON.stringify({head,cases:performanceCases,failures:performanceFailures},null,2)+'\n');
await writeFile(path.join(output,'THEME_DIFFERENTIATION.json'),JSON.stringify({head,pairs:themePairs,failures:themeFailures},null,2)+'\n');
await writeFile(path.join(output,'SCREENSHOT_MANIFEST.json'),JSON.stringify({head,files:screenshotManifest},null,2)+'\n');
await writeFile(path.join(output,'SUMMARY.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(path.join(output,'README.md'),`# Qelly Prompt 2B Wave 1 Review\n\nExact head: \`${head}\`\n\n- Formula definitions: ${report.formulaDefinitions}\n- Indicator definitions: ${report.indicatorDefinitions}\n- Browser records: ${report.browserMatrix.records}\n- Browser failures: ${report.browserMatrix.failed}\n- Performance failures: ${performanceFailures.length}\n- Theme differentiation failures: ${themeFailures.length}\n- Screenshots: ${screenshotManifest.length}\n\nThe compiled preview is a disconnected static visual preview. Font binaries are intentionally excluded from the downloadable review package. No external financial provider, broker, exchange, wallet, trading or custody capability is connected.\n`);
console.log(JSON.stringify({browserRecords:records.length,browserFailures:failures.length,performanceFailures:performanceFailures.length,themeFailures:themeFailures.length,screenshots:screenshotManifest.length},null,2));
if(failures.length||performanceFailures.length||themeFailures.length)process.exit(1);
