import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {startServer} from './release-a5-evidence-server.mjs';
import {buildDecisionRangeEvidence} from '../functions/_lib/decision-range-evidence.js';
import {buildDecisionHistoricalNewsTimeline} from '../functions/_lib/decision-range-timeline.js';
import {buildDecisionRangeFlowParticipation} from '../functions/_lib/decision-range-flow.js';

const outputDir=path.resolve('preview/decision-range-e2e');
await mkdir(outputDir,{recursive:true});
const productionOrigin='https://terminal.qellyintelligence.com';
const server=await startServer({port:0,host:'127.0.0.1'});
const localOrigin=`http://127.0.0.1:${server.port}`;
const executablePath=process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium';
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const results=[];
let selectedDecisionReloads=0;

const proxyDecision=async(route)=>{
  const requestUrl=new URL(route.request().url());
  if(requestUrl.pathname.includes('/api/v1/decision-proven-graph')&&requestUrl.searchParams.has('selectionStart')){
    selectedDecisionReloads++;
    await route.fulfill({status:503,contentType:'application/json; charset=utf-8',body:JSON.stringify({error:{code:'selected_decision_reload_forbidden',message:'The range workflow must not refetch the full Decision endpoint.'}})});
    return;
  }
  if(requestUrl.pathname.includes('/api/v1/decision-range-evidence')){
    const target=new URL(requestUrl.pathname+requestUrl.search,productionOrigin);
    const upstream=await fetch(target,{headers:{accept:'application/json'}});
    const upstreamBody=await upstream.text();
    if(!upstream.ok){
      await route.fulfill({status:upstream.status,contentType:upstream.headers.get('content-type')||'application/json; charset=utf-8',body:upstreamBody});
      return;
    }
    const responsePayload=JSON.parse(upstreamBody);
    const payload={...responsePayload,selection:responsePayload.selectedMove,market:null};
    const rangeEvidenceBase=responsePayload.rangeEvidence;
    const start=Number(requestUrl.searchParams.get('rangeStart')),end=Number(requestUrl.searchParams.get('rangeEnd')),duration=Math.max(60_000,end-start);
    const article=(title,offset,source,url)=>({title,source,publishedAt:new Date(offset).toISOString(),url});
    const newsBuckets={
      before:{state:'live',coverageState:'COMPLETE',exactWindow:true,window:{start:new Date(start-duration).toISOString(),end:new Date(start).toISOString()},articles:[article('Bitcoin policy context before selected move',start-Math.min(duration/2,3_600_000),'fixture-before.example','https://fixture-before.example/a')]},
      during:{state:'live',coverageState:'COMPLETE',exactWindow:true,window:{start:new Date(start).toISOString(),end:new Date(end).toISOString()},articles:[article('Bitcoin <img src=x onerror=alert(1)> ETF inflow update during selected move',start+duration/2,'fixture-during.example','https://fixture-during.example/b')]},
      after:{state:'live',coverageState:'COMPLETE',exactWindow:true,window:{start:new Date(end).toISOString(),end:new Date(end+duration).toISOString()},articles:[article('Bitcoin market context after selected move',end+Math.min(duration/2,3_600_000),'fixture-after.example','https://fixture-after.example/c')]}
    };
    const timeline=buildDecisionHistoricalNewsTimeline({asset:responsePayload.asset,rangeEvidence:rangeEvidenceBase,newsBuckets});
    const flowParticipation=responsePayload.flowParticipation||rangeEvidenceBase?.flowParticipation||null;
    const rangeEvidence={...rangeEvidenceBase,timeline,flowParticipation};
    const body=JSON.stringify({...responsePayload,rangeEvidence,timeline,flowParticipation});
    await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body});
    return;
  }
  const target=new URL(requestUrl.pathname+requestUrl.search,productionOrigin);
  const response=await fetch(target,{headers:{accept:'application/json'}});
  const body=await response.text();
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
  await page.route('**/api/v1/decision-range-evidence**',proxyDecision);
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
  const timeline=page.locator('[data-dpg-range-timeline]').first();
  await timeline.waitFor({state:'visible',timeout:20_000});
  const timelineText=(await timeline.innerText()).replace(/\s+/g,' ').trim(),normalizedTimeline=timelineText.toLowerCase();
  const timelineRequired=['what caused this move?','historical news / event timeline','before','during','after','association only','direct'].every(label=>normalizedTimeline.includes(label));
  const injectedImageCount=await timeline.locator('img[src="x"]').count();
  if(!timelineRequired||injectedImageCount)failures.push({type:'range-timeline',text:timelineText,timelineRequired,injectedImageCount});
  const flowPanel=page.locator('[data-dpg-range-flow]').first();
  await flowPanel.waitFor({state:'visible',timeout:20_000});
  const flowText=(await flowPanel.innerText()).replace(/\s+/g,' ').trim(),normalizedFlow=flowText.toLowerCase();
  const flowRequired=['flow / participation evidence','known named flows','observed order flow','public institutional data','unknown actor activity','actor identity unavailable','true order flow unavailable'].every(label=>normalizedFlow.includes(label));
  const forbiddenFlowClaims=['identified whale','confirmed institution bought','confirmed institution sold'].some(label=>normalizedFlow.includes(label));
  if(!flowRequired||forbiddenFlowClaims)failures.push({type:'range-flow',text:flowText,flowRequired,forbiddenFlowClaims});
  await page.screenshot({path:path.join(outputDir,`decision-range-selected-${name}.png`),fullPage:true});
  if(selectedDecisionReloads!==0)failures.push({type:'selected-decision-reload',count:selectedDecisionReloads});
  const result={name,viewport,touch,persistent,candles,boundaries,handles,summary:text,rangeIntelligence:intelligenceRequired,rangeIntelligenceText:intelligenceText,rangeTimeline:timelineRequired,rangeTimelineText:timelineText,rangeFlow:flowRequired,rangeFlowText:flowText,selectedDecisionReloads,failures};
  results.push(result);
  await context.close();
};

const exerciseRangeFailure=async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage();
  const failures=[];
  page.on('pageerror',error=>failures.push({type:'pageerror',message:error.message}));
  await page.route('**/api/v1/decision-proven-graph**',proxyDecision);
  await page.route('**/api/v1/decision-news-context**',proxyDecision);
  await page.route('**/api/v1/decision-range-evidence**',async route=>{
    await route.fulfill({status:503,contentType:'application/json; charset=utf-8',body:JSON.stringify({error:{code:'range_fixture_failure',message:'Range evidence fixture unavailable'}})});
  });
  await page.goto(localOrigin+'/#/decision-provenance',{waitUntil:'domcontentloaded',timeout:45_000});
  const chart=page.locator('[data-dpg-chart]').first();
  await chart.waitFor({state:'visible',timeout:45_000});
  const box=await chart.boundingBox();
  if(!box)throw new Error('range-failure: chart bounding box unavailable');
  await page.mouse.move(box.x+box.width*.25,box.y+box.height*.5);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.48,box.y+box.height*.5,{steps:10});
  await page.mouse.up();
  await page.locator('[data-dpg-explain]').first().click();
  const errorPanel=page.locator('[data-dpg-range-evidence-error]').first();
  await errorPanel.waitFor({state:'visible',timeout:20_000});
  const chartStillVisible=await chart.isVisible();
  const pageText=(await page.locator('main').innerText()).replace(/\s+/g,' ').trim().toLowerCase();
  const liveResearchLost=pageText.includes('live research unavailable');
  const overlay=page.locator('[data-dpg-selection]').first();
  const overlayPersistent=(await overlay.getAttribute('hidden'))===null&&await page.locator('.q-dpg-candle.is-selected').count()>1;
  const errorText=(await errorPanel.innerText()).replace(/\s+/g,' ').trim();
  if(!chartStillVisible||liveResearchLost||!overlayPersistent||!errorText.toLowerCase().includes('current decision preserved'))failures.push({type:'range-failure-resilience',chartStillVisible,liveResearchLost,overlayPersistent,errorText});
  if(selectedDecisionReloads!==0)failures.push({type:'selected-decision-reload',count:selectedDecisionReloads});
  results.push({name:'range-failure',chartStillVisible,liveResearchLost,overlayPersistent,errorText,selectedDecisionReloads,failures});
  await context.close();
};

try{
  await exercise({name:'desktop',viewport:{width:1440,height:1000}});
  await exercise({name:'mobile',viewport:{width:390,height:844},touch:true});
  await exerciseRangeFailure();
}finally{
  await browser.close();
  await new Promise(resolve=>server.server.close(resolve));
  await server.evidenceUpstream?.server?.close?.();
}

const report={status:results.every(item=>item.failures.length===0)?'passed':'failed',productionBackend:productionOrigin,frontendHead:process.env.QELLY_SCREEN_EVIDENCE_SHA||process.env.GITHUB_SHA||null,results};
await writeFile(path.join(outputDir,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.status!=='passed')process.exitCode=1;
