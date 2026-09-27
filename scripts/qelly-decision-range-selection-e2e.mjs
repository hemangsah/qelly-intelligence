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
let latestSelectedPayload=null;

const proxyDecision=async(route)=>{
  const requestUrl=new URL(route.request().url());
  if(requestUrl.pathname.includes('/api/v1/decision-range-evidence')&&latestSelectedPayload?.selection){
    const payload=structuredClone(latestSelectedPayload);
    const rangeEvidenceBase=buildDecisionRangeEvidence({graph:payload,evidence:payload.evidence,assetClass:'crypto',venue:'Hyperliquid',timezone:'UTC'});
    const start=Number(requestUrl.searchParams.get('rangeStart')),end=Number(requestUrl.searchParams.get('rangeEnd')),duration=Math.max(60_000,end-start);
    const article=(title,offset,source,url)=>({title,source,publishedAt:new Date(offset).toISOString(),url});
    const newsBuckets={
      before:{state:'live',coverageState:'COMPLETE',exactWindow:true,window:{start:new Date(start-duration).toISOString(),end:new Date(start).toISOString()},articles:[article('Bitcoin policy context before selected move',start-Math.min(duration/2,3_600_000),'fixture-before.example','https://fixture-before.example/a')]},
      during:{state:'live',coverageState:'COMPLETE',exactWindow:true,window:{start:new Date(start).toISOString(),end:new Date(end).toISOString()},articles:[article('Bitcoin <img src=x onerror=alert(1)> ETF inflow update during selected move',start+duration/2,'fixture-during.example','https://fixture-during.example/b')]},
      after:{state:'live',coverageState:'COMPLETE',exactWindow:true,window:{start:new Date(end).toISOString(),end:new Date(end+duration).toISOString()},articles:[article('Bitcoin market context after selected move',end+Math.min(duration/2,3_600_000),'fixture-after.example','https://fixture-after.example/c')]}
    };
    const flowParticipation=buildDecisionRangeFlowParticipation({graph:payload,evidence:payload.evidence});
    const timeline=buildDecisionHistoricalNewsTimeline({asset:payload.asset,rangeEvidence:rangeEvidenceBase,newsBuckets});
    const rangeEvidence={...rangeEvidenceBase,timeline,flowParticipation};
    const body=JSON.stringify({schemaVersion:'qelly.decision-range-evidence-response/1.2.0',asset:payload.asset,interval:payload.interval,horizon:payload.horizon,selectedMove:payload.selection,rangeEvidence,timeline,flowParticipation});
    await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body});
    return;
  }
  const target=new URL(requestUrl.pathname+requestUrl.search,productionOrigin);
  const response=await fetch(target,{headers:{accept:'application/json'}});
  let body=await response.text();
  if(response.ok&&requestUrl.searchParams.has('selectionStart')&&requestUrl.pathname.includes('/api/v1/decision-proven-graph')){
    try{
      const payload=JSON.parse(body);
      payload.rangeEvidence=buildDecisionRangeEvidence({graph:payload,evidence:payload.evidence,assetClass:'crypto',venue:'Hyperliquid',timezone:'UTC'});
      latestSelectedPayload=payload;
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
  await page.route('**/api/v1/decision-assets**',proxyDecision);
  await page.route('**/api/v1/decision-proven-graph**',proxyDecision);
  await page.route('**/api/v1/decision-news-context**',proxyDecision);
  await page.route('**/api/v1/decision-range-evidence**',proxyDecision);
  await page.goto(localOrigin+'/#/decision-provenance',{waitUntil:'domcontentloaded',timeout:45_000});
  const chart=page.locator('[data-dpg-chart]').first();
  await chart.waitFor({state:'visible',timeout:45_000});
  const assetPickerToggle=page.locator('[data-dpg-asset-picker-toggle]').first();
  await assetPickerToggle.waitFor({state:'visible',timeout:10_000});
  await assetPickerToggle.click();
  const assetPicker=page.locator('[data-dpg-asset-picker-panel]').first();
  await assetPicker.waitFor({state:'visible',timeout:10_000});
  const pickerBox=await assetPicker.boundingBox();
  const pickerFitsViewport=Boolean(pickerBox)&&pickerBox.x>=0&&pickerBox.y>=0&&pickerBox.x+pickerBox.width<=viewport.width+1&&pickerBox.y+Math.min(pickerBox.height,viewport.height)<=viewport.height+1;
  const pickerText=(await assetPicker.innerText()).replace(/\s+/g,' ').trim().toLowerCase();
  const pickerRequired=['provider-capability universe','crypto','forex','indian indices','indian stocks','global stocks','metals','commodities','global indices','reference only','unavailable'].every(label=>pickerText.includes(label));
  const selectableCount=await assetPicker.locator('[data-dpg-asset-select]').count();
  const unavailableSelectableCount=await assetPicker.locator('.is-unavailable [data-dpg-asset-select]').count();
  if(!pickerFitsViewport||!pickerRequired||selectableCount!==6||unavailableSelectableCount!==0)failures.push({type:'asset-picker-capability',pickerFitsViewport,pickerRequired,selectableCount,unavailableSelectableCount,text:pickerText});
  const search=assetPicker.locator('[data-dpg-asset-search]').first();
  await search.fill('ETH');
  await page.waitForTimeout(80);
  const visibleAssetRows=await assetPicker.locator('[data-dpg-asset-row]:visible').count();
  const visibleEth=await assetPicker.locator('[data-dpg-asset-select="ETH"]:visible').count();
  if(visibleAssetRows!==1||visibleEth!==1)failures.push({type:'asset-picker-search',visibleAssetRows,visibleEth});
  await assetPicker.locator('[data-dpg-asset-favorite="ETH"]').first().click();
  await page.locator('[data-dpg-asset-filter="favorites"]').first().click();
  await page.waitForTimeout(60);
  const favoriteEth=await page.locator('[data-dpg-asset-select="ETH"]:visible').count();
  if(favoriteEth!==1)failures.push({type:'asset-picker-favorite',favoriteEth});
  await page.locator('[data-dpg-asset-picker-close]').first().click();
  await assetPicker.waitFor({state:'hidden',timeout:5000});
  const chatDock=page.locator('[data-dpg-chat-dock]').first();
  await chatDock.waitFor({state:'visible',timeout:10_000});
  const chatDockToggle=page.locator('[data-dpg-chat-dock-toggle]').first();
  const dockBox=await chatDock.boundingBox();
  const dockCentered=Boolean(dockBox)&&Math.abs((dockBox.x+dockBox.width/2)-viewport.width/2)<=6&&dockBox.x>=0&&dockBox.x+dockBox.width<=viewport.width+1;
  const legacyDecisionChatControls=await page.locator('.q-dpg-hero__actions [data-dpg-open-chat],[data-dpg-range-action="chat"]').count();
  const genericLauncher=page.locator('[data-q-ai-launcher]').first();
  const genericLauncherVisible=await genericLauncher.isVisible().catch(()=>false);
  if(!dockCentered||legacyDecisionChatControls||genericLauncherVisible)failures.push({type:'qelly-dock-shell',dockCentered,legacyDecisionChatControls,genericLauncherVisible,dockBox});
  await chatDockToggle.focus();
  await page.keyboard.press('Enter');
  const dockComposer=page.locator('[data-dpg-chat-dock-composer]').first();
  await dockComposer.waitFor({state:'visible',timeout:10_000});
  const dockComposerText=(await dockComposer.innerText()).replace(/\s+/g,' ').trim().toLowerCase();
  const dockComposerRequired=['qelly context dock','explain qelly view','existing qelly chat','current decision evidence'].every(label=>dockComposerText.includes(label));
  if(!dockComposerRequired)failures.push({type:'qelly-dock-composer',text:dockComposerText});
  await page.locator('[data-dpg-chat-quick="view"]').first().click();
  const globalAssistant=page.locator('[data-q-ai-assistant]').first();
  await globalAssistant.waitFor({state:'visible',timeout:10_000});
  const assistantAsset=await page.locator('[data-q-ai-asset]').first().inputValue();
  const assistantTimeframe=await page.locator('[data-q-ai-timeframe]').first().inputValue();
  if(assistantAsset!=='BTC'||!assistantTimeframe)failures.push({type:'qelly-dock-handoff',assistantAsset,assistantTimeframe});
  await page.locator('[data-q-ai-close]').first().click();
  await globalAssistant.waitFor({state:'hidden',timeout:10_000});
  const simpleTab=page.locator('[data-dpg-ui-mode="simple"]').first(),advancedTab=page.locator('[data-dpg-ui-mode="advanced"]').first(),researchTab=page.locator('[data-dpg-ui-mode="research"]').first();
  if(await simpleTab.getAttribute('aria-selected')!=='true')failures.push({type:'decision-mode-default',message:'Simple Mode is not the default'});
  if(await page.locator('[data-dpg-mode-panel="advanced"]').count())failures.push({type:'decision-mode-simple-leak',message:'Advanced panel rendered in Simple Mode'});
  if(await page.locator('[data-dpg-mode-panel="research"]').count())failures.push({type:'decision-mode-simple-leak',message:'Research panel rendered in Simple Mode'});
  await advancedTab.click();
  await page.locator('[data-dpg-mode-panel="advanced"]').first().waitFor({state:'visible',timeout:10_000});
  const advancedText=(await page.locator('[data-dpg-mode-panel="advanced"]').first().innerText()).replace(/\s+/g,' ').toLowerCase();
  const advancedRequired=['advanced mode','practitioner evidence','market structure','derivatives','macro'].every(label=>advancedText.includes(label));
  if(!advancedRequired)failures.push({type:'decision-mode-advanced',text:advancedText});
  await researchTab.click();
  await page.locator('[data-dpg-mode-panel="research"]').first().waitFor({state:'visible',timeout:10_000});
  const researchText=(await page.locator('[data-dpg-mode-panel="research"]').first().innerText()).replace(/\s+/g,' ').toLowerCase();
  const researchRequired=['research lab','calibration','model trace','methodology and sources'].every(label=>researchText.includes(label));
  if(!researchRequired)failures.push({type:'decision-mode-research',text:researchText});
  await simpleTab.click();
  await page.locator('[data-dpg-mode-panel="simple"]').first().waitFor({state:'visible',timeout:10_000});
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
  const rangeDockText=(await page.locator('[data-dpg-chat-dock-toggle]').first().innerText()).replace(/\s+/g,' ').trim().toLowerCase();
  const rangeAwareDock=rangeDockText.includes('selected range');
  if(!rangeAwareDock)failures.push({type:'qelly-dock-range-context',text:rangeDockText});
  await page.evaluate(()=>window.scrollBy(0,1));
  await page.waitForTimeout(80);
  const clearanceProbe=await page.locator('[data-dpg-chat-dock]').first().evaluate((node)=>{
    const workbench=document.querySelector('.q-dpg-range-workbench'),rect=workbench?.getBoundingClientRect(),style=getComputedStyle(node);
    const reserved=112,zoneOverlap=Boolean(rect&&rect.bottom>innerHeight-reserved&&rect.top<innerHeight);
    return {clearance:node.dataset.clearance||'unset',opacity:style.opacity,pointerEvents:style.pointerEvents,zoneOverlap};
  });
  if(clearanceProbe.zoneOverlap&&(clearanceProbe.clearance!=='chart'||clearanceProbe.pointerEvents!=='none'))failures.push({type:'qelly-dock-chart-clearance',...clearanceProbe});
  await page.evaluate(()=>{
    const workbench=document.querySelector('.q-dpg-range-workbench');
    if(!workbench)return;
    const rect=workbench.getBoundingClientRect(),expandedReserved=Math.min(440,Math.max(230,innerHeight*.52));
    const delta=Math.max(0,rect.bottom-(innerHeight-expandedReserved)+28);
    if(delta>0)window.scrollBy(0,delta);
  });
  await page.waitForFunction(()=>document.querySelector('[data-dpg-chat-dock]')?.dataset.clearance==='clear',{timeout:5000});
  const restoredDockBox=await page.locator('[data-dpg-chat-dock-toggle]').first().boundingBox();
  const dockRestored=Boolean(restoredDockBox)&&restoredDockBox.y>=0&&restoredDockBox.y+restoredDockBox.height<=viewport.height+1;
  if(!dockRestored)failures.push({type:'qelly-dock-clearance-return',restoredDockBox});
  await page.locator('[data-dpg-chat-dock-toggle]').first().click();
  const openDockState=await page.locator('[data-dpg-chat-dock]').first().getAttribute('data-clearance');
  if(openDockState!=='clear')failures.push({type:'qelly-dock-open-clearance',openDockState});
  const selectedQuickCount=await page.locator('[data-dpg-chat-quick="selected"]').count();
  if(selectedQuickCount!==1)failures.push({type:'qelly-dock-range-action',selectedQuickCount});
  const closeHitTarget=await page.locator('[data-dpg-chat-dock-close]').first().evaluate((node)=>{
    const rect=node.getBoundingClientRect(),hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
    return hit===node||Boolean(hit?.closest?.('[data-dpg-chat-dock-close]'));
  });
  if(!closeHitTarget)failures.push({type:'qelly-dock-close-hit-target'});
  await page.locator('[data-dpg-chat-dock-close]').first().click();
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
  const result={name,viewport,touch,assetPicker:{fitsViewport:pickerFitsViewport,required:pickerRequired,selectableCount,favoriteEth},decisionModes:{simpleDefault:true,advanced:advancedRequired,research:researchRequired},qellyDock:{centered:dockCentered,composer:dockComposerRequired,rangeAware:rangeAwareDock},persistent,candles,boundaries,handles,summary:text,rangeIntelligence:intelligenceRequired,rangeIntelligenceText:intelligenceText,rangeTimeline:timelineRequired,rangeTimelineText:timelineText,rangeFlow:flowRequired,rangeFlowText:flowText,failures};
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
