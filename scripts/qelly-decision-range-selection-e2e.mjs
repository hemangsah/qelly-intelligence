import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {startServer} from './release-a5-evidence-server.mjs';
import {buildDecisionRangeEvidence} from '../functions/_lib/decision-range-evidence.js';

const outputDir=path.resolve('preview/decision-range-e2e');
await mkdir(outputDir,{recursive:true});
const productionOrigin='https://terminal.qellyintelligence.com';
const server=await startServer({port:0,host:'127.0.0.1'});
const localOrigin=`http://127.0.0.1:${server.port}`;
const executablePath=process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium';
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const results=[];

const proxyDecision=async(route)=>{
  const requestUrl=new URL(route.request().url());
  const target=new URL(requestUrl.pathname+requestUrl.search,productionOrigin);
  const response=await fetch(target,{headers:{accept:'application/json'}});
  let body=await response.text();
  if(response.ok&&requestUrl.searchParams.has('selectionStart')&&requestUrl.pathname.includes('/api/v1/decision-proven-graph')){
    try{
      const payload=JSON.parse(body);
      payload.rangeEvidence=buildDecisionRangeEvidence({graph:payload,evidence:payload.evidence,assetClass:'crypto',venue:'Hyperliquid',timezone:'UTC'});
      body=JSON.stringify(payload);
    }catch{}
  }
  await route.fulfill({status:response.status,contentType:response.headers.get('content-type')||'application/json; charset=utf-8',body});
};

const exercise=async({name,viewport,touch=false})=>{
  const context=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce',hasTouch:touch,isMobile:touch});
  const page=await context.newPage();
  const failures=[];
  page.on('pageerror',error=>failures.push({type:'pageerror',message:error.message}));
  page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('Failed to load resource'))failures.push({type:'console',message:message.text()});});
  await page.route('**/api/v1/decision-proven-graph**',proxyDecision);
  await page.route('**/api/v1/decision-news-context**',proxyDecision);
  await page.goto(localOrigin+'/#/decision-provenance',{waitUntil:'domcontentloaded',timeout:45_000});
  const chart=page.locator('[data-dpg-chart]').first();
  await chart.waitFor({state:'visible',timeout:45_000});
  await chart.scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);
  const box=await chart.boundingBox();
  if(!box)throw new Error(name+': chart bounding box unavailable');
  const start={x:box.x+box.width*.24,y:box.y+box.height*.54};
  const end={x:box.x+box.width*.53,y:box.y+box.height*.54};
  if(touch){
    const cdp=await context.newCDPSession(page);
    try{
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x,y:start.y,radiusX:2,radiusY:2,force:1}]});
      for(let step=1;step<=8;step++){
        const point={x:start.x+(end.x-start.x)*step/8,y:start.y};
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x,y:point.y,radiusX:2,radiusY:2,force:1}]});
      }
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }finally{
      await cdp.detach();
    }
  }else{
    await page.mouse.move(start.x,start.y);
    await page.mouse.down();
    await page.mouse.move(end.x,end.y,{steps:12});
    await page.mouse.up();
  }
  const summary=page.locator('.q-dpg-range-summary').first();
  await summary.waitFor({state:'visible',timeout:10_000});
  const overlay=page.locator('[data-dpg-selection]').first();
  const hidden=await overlay.getAttribute('hidden');
  const candles=await page.locator('.q-dpg-candle.is-selected').count();
  const boundaries=await page.locator('.q-dpg-selection__boundary').count();
  const handles=await page.locator('.q-dpg-selection__handle').count();
  const text=(await summary.innerText()).replace(/\s+/g,' ').trim();
  const normalizedSummary=text.toLowerCase();
  const persistent=hidden===null&&candles>1&&boundaries===2&&handles===2;
  const required=['start','end','duration','candles','move','high','low'].every(label=>normalizedSummary.includes(label));
  const timestampsAvailable=!normalizedSummary.includes('time unavailable');
  if(!persistent)failures.push({type:'range-overlay',hidden,candles,boundaries,handles});
  if(!required||!timestampsAvailable)failures.push({type:'range-summary',text,required,timestampsAvailable});
  await page.locator('[data-dpg-explain]').first().click();
  const intelligence=page.locator('[data-dpg-range-intelligence]').first();
  await intelligence.waitFor({state:'visible',timeout:45_000});
  const intelligenceText=(await intelligence.innerText()).replace(/\s+/g,' ').trim();
  const normalizedIntelligence=intelligenceText.toLowerCase();
  const intelligenceRequired=['selected move intelligence','exact range','evidence coverage','current context','association, not proof of causation','before','during','after'].every(label=>normalizedIntelligence.includes(label));
  if(!intelligenceRequired)failures.push({type:'range-intelligence',text:intelligenceText});
  await page.screenshot({path:path.join(outputDir,`decision-range-selected-${name}.png`),fullPage:true});
  const result={name,viewport,touch,persistent,candles,boundaries,handles,summary:text,rangeIntelligence:intelligenceRequired,rangeIntelligenceText:intelligenceText,failures};
  results.push(result);
  await context.close();
};

try{
  await exercise({name:'desktop',viewport:{width:1440,height:1000}});
  await exercise({name:'mobile',viewport:{width:390,height:844},touch:true});
}finally{
  await browser.close();
  await new Promise(resolve=>server.server.close(resolve));
  await server.evidenceUpstream?.server?.close?.();
}

const report={status:results.every(item=>item.failures.length===0)?'passed':'failed',productionBackend:productionOrigin,frontendHead:process.env.QELLY_SCREEN_EVIDENCE_SHA||process.env.GITHUB_SHA||null,results};
await writeFile(path.join(outputDir,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.status!=='passed')process.exitCode=1;
