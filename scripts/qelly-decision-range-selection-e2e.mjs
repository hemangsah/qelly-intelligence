import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {startServer} from './release-a5-evidence-server.mjs';
import {buildDecisionRangeEvidence} from '../functions/_lib/decision-range-evidence.js';
import {buildDecisionHistoricalNewsTimeline} from '../functions/_lib/decision-range-timeline.js';
import {buildDecisionRangeFlowParticipation} from '../functions/_lib/decision-range-flow.js';
import {buildDecisionNextMoveResearch} from '../functions/_lib/decision-next-move.js';
import {decisionAssetCapabilities} from '../functions/_lib/decision-asset-capabilities.js';
import {buildDecisionRangeReplay,buildSelectedRangeSimilarMoves} from '../functions/_lib/decision-range-history.js';
import {buildSelectedRangeCrossAssetAnalysis} from '../functions/_lib/decision-selected-cross-asset.js';

const outputDir=path.resolve('preview/decision-range-e2e');
await mkdir(outputDir,{recursive:true});
const productionOrigin='https://terminal.qellyintelligence.com';
const server=await startServer({port:0,host:'127.0.0.1'});
const localOrigin=`http://127.0.0.1:${server.port}`;
const executablePath=process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium';
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const results=[];
let latestSelectedPayload=null,lastScanRequest=null;
const fixtureEpochMs=(value)=>{
  if(value==null||value==='')return null;
  const numeric=Number(value);
  if(Number.isFinite(numeric))return Math.abs(numeric)<100_000_000_000?numeric*1000:numeric;
  const parsed=Date.parse(String(value));
  return Number.isFinite(parsed)?parsed:null;
};

const proxyDecision=async(route)=>{
  const requestUrl=new URL(route.request().url());
  if(requestUrl.pathname.includes('/api/v1/decision-assets')){
    const body=JSON.stringify({...decisionAssetCapabilities(),generatedAt:new Date().toISOString()});
    await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body});
    return;
  }
  if(requestUrl.pathname.includes('/api/v1/decision-scan')){
    lastScanRequest=Object.fromEntries(requestUrl.searchParams.entries());
    const interval=requestUrl.searchParams.get('interval')||'15m';
    const mode=requestUrl.searchParams.get('mode')||'validated';
    const ranking=requestUrl.searchParams.get('ranking')||'highest_quality';
    const asset=(requestUrl.searchParams.get('assets')||'BTC').split(',')[0].toUpperCase();
    const candidateInterval=mode==='aggressive'&&interval==='15m'?'30m':interval;
    const closest={
      label:'CLOSEST CANDIDATE — NOT YET VALIDATED',validated:false,asset,interval:candidateInterval,direction:'SELL',
      possibleTrigger:'Wait for the independent calibration gate to pass while the verified entry structure remains intact.',
      missingConditions:['calibration_gate_not_passed'],
      whatMustHappen:['The independent calibration gate must pass; probability cannot be fabricated.'],
      probabilityState:'UNCALIBRATED',calibratedProbability:null,
      contradiction:'Independent probability calibration is not yet eligible.',
      eventRisk:{state:'unavailable',level:'UNAVAILABLE'},researchPriority:68.4,
      boundary:'This is a research candidate only. It is not a valid setup, trade recommendation, target guarantee or substitute for missing evidence.'
    };
    const candidate={
      asset,interval:candidateInterval,horizon:requestUrl.searchParams.get('horizon')||'4h',truthState:'LIVE',action:'SELL',state:'NO_ELIGIBLE_SETUP',
      eligible:false,conditional:false,filterFailures:['calibration_gate_not_passed'],validationFailures:['calibration_gate_not_passed'],preferenceFailures:[],relaxedPreferences:[],
      discoveryMode:mode,researchPriority:68.4,
      evidence:{qualityScore:.76,calibrationGatedEvidenceConfidence:null,calibrationState:'UNCALIBRATED',calibrationEligible:false,timeframeAgreement:.75,timeframeDirection:'SELL'},
      market:{lastPrice:84000,regime:'trending',volatilityRegime:'NORMAL',structure:'LH_LL',liquidityState:'live',spreadState:'TIGHT',spreadBps:2},
      eventRisk:{state:'unavailable',level:'UNAVAILABLE'},
      trade:{status:'NO_TRADE',sourceStatus:'NO_TRADE',setupType:'PULLBACK',rr:'1:2',rrRelaxed:false,feasibility:'FEASIBLE',entry:84000,stop:84600,target:82800},
      contradictions:['Independent probability calibration is not yet eligible.']
    };
    const body=JSON.stringify({
      schemaVersion:'qelly.decision-scan/3.0.0',generatedAt:new Date().toISOString(),state:'NO_ELIGIBLE_SETUP',mode,ranking,
      universe:[asset],governedUniverse:['BTC','ETH','SOL','HYPE','XRP','DOGE'],interval,horizon:requestUrl.searchParams.get('horizon')||'4h',
      riskReward:{mode:requestUrl.searchParams.get('rr')||'auto'},filters:{direction:requestUrl.searchParams.get('direction')||'any'},
      searchPlan:{scope:requestUrl.searchParams.has('assets')?'CURRENT_ASSET':'ALL_SUPPORTED_MARKETS',assets:[asset],intervals:mode==='aggressive'?[interval,candidateInterval]:[interval],directions:[(requestUrl.searchParams.get('direction')||'any').toUpperCase()],riskRewards:['1:1','1:2','1:3','1:4'],setupTypes:['PULLBACK'],boundedVariantCount:mode==='aggressive'?2:1,aggressiveBroadening:mode==='aggressive',boundary:'Aggressive Discovery broadens supported assets, adjacent supported timeframes and existing R:R/setup possibilities. It never fabricates direction, provider evidence, calibration, structural validity or event safety.'},
      validatedSetup:null,closestCandidate:closest,candidates:[candidate],eligibleCount:0,conditionalCount:0,availableCount:1,unavailableCount:0,failures:[],
      performance:{totalMs:25,assetDecisionMs:{[asset+':'+candidateInterval]:20},concurrency:1},
      eventRisk:{state:'unavailable',connectedFeed:false,reason:'No approved production event feed is connected. Strict event-risk filters fail closed.'},
      boundaries:{researchOnly:true,execution:false,fabricatedFallback:false,aggressiveCanFabricateValidSetup:false,aggressiveBypassesCalibration:false,aggressiveBypassesFreshness:false,aggressiveBypassesProviderFailure:false,aggressiveBypassesCriticalEventRisk:false,closestCandidateIsValidated:false,noTradeFirstClass:true}
    });
    await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body});
    return;
  }
  if(requestUrl.pathname.includes('/api/v1/decision-range-evidence')&&latestSelectedPayload?.selection){
    const payload=structuredClone(latestSelectedPayload);
    const start=Number(requestUrl.searchParams.get('rangeStart')),end=Number(requestUrl.searchParams.get('rangeEnd')),duration=Math.max(60_000,end-start);
    const article=(title,offset,source,url)=>({title,source,publishedAt:new Date(offset).toISOString(),url});
    const newsBuckets={
      before:{state:'live',coverageState:'COMPLETE',exactWindow:true,window:{start:new Date(start-duration).toISOString(),end:new Date(start).toISOString()},articles:[article('Bitcoin policy context before selected move',start-Math.min(duration/2,3_600_000),'fixture-before.example','https://fixture-before.example/a')]},
      during:{state:'live',coverageState:'COMPLETE',exactWindow:true,window:{start:new Date(start).toISOString(),end:new Date(end).toISOString()},articles:[article('Bitcoin <img src=x onerror=alert(1)> ETF inflow update during selected move',start+duration/2,'fixture-during.example','https://fixture-during.example/b')]},
      after:{state:'live',coverageState:'COMPLETE',exactWindow:true,window:{start:new Date(end).toISOString(),end:new Date(end+duration).toISOString()},articles:[article('Bitcoin market context after selected move',end+Math.min(duration/2,3_600_000),'fixture-after.example','https://fixture-after.example/c')]}
    };
    const fixtureCandles=payload.market?.candles||[];
    const fixtureBenchmark=fixtureCandles.map((item,index)=>({
      ...item,
      open:Number(item.open??item.o)*(1+index*.00001),
      high:Number(item.high??item.h)*(1+index*.00001),
      low:Number(item.low??item.l)*(1+index*.00001),
      close:Number(item.close??item.c)*(1+index*.00001)
    }));
    const selectedRangeCrossAsset=buildSelectedRangeCrossAssetAnalysis(fixtureCandles,fixtureBenchmark,{selection:payload.selection,asset:payload.asset,benchmark:payload.asset==='BTC'?'ETH':'BTC',assetClass:'crypto'});
    payload.evidence={...payload.evidence,selectedCrossAssetAnalysis:selectedRangeCrossAsset};
    const rangeEvidenceBase=buildDecisionRangeEvidence({graph:payload,evidence:payload.evidence,assetClass:'crypto',venue:'Hyperliquid',timezone:'UTC'});
    const flowParticipation=buildDecisionRangeFlowParticipation({graph:payload,evidence:payload.evidence});
    const timeline=buildDecisionHistoricalNewsTimeline({asset:payload.asset,rangeEvidence:rangeEvidenceBase,newsBuckets});
    const rangeEvidence={...rangeEvidenceBase,timeline,flowParticipation};
    const rangeReplay=buildDecisionRangeReplay({
      candles:fixtureCandles,
      selection:payload.selection,
      interval:payload.interval,
      newsArticles:[...newsBuckets.before.articles,...newsBuckets.during.articles,...newsBuckets.after.articles],
      fundingRows:[],
      benchmarkCandles:fixtureBenchmark,
      benchmark:payload.asset==='BTC'?'ETH':'BTC'
    });
    const selectedRangeSimilarMoves=buildSelectedRangeSimilarMoves(fixtureCandles,{selection:payload.selection,interval:payload.interval,limit:5});
    const body=JSON.stringify({schemaVersion:'qelly.decision-range-evidence-response/1.4.0',asset:payload.asset,interval:payload.interval,horizon:payload.horizon,selectedMove:payload.selection,rangeEvidence,timeline,flowParticipation,selectedRangeCrossAsset,rangeReplay,selectedRangeSimilarMoves});
    await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body});
    return;
  }
  const target=new URL(requestUrl.pathname+requestUrl.search,productionOrigin);
  const response=await fetch(target,{headers:{accept:'application/json'}});
  let body=await response.text();
  if(response.ok&&requestUrl.pathname.includes('/api/v1/decision-proven-graph')){
    try{
      const payload=JSON.parse(body),customBars=requestUrl.searchParams.has('nextBars')?Number(requestUrl.searchParams.get('nextBars')):null;
      payload.nextMoveResearch=buildDecisionNextMoveResearch(payload.market?.candles||[],{asset:payload.asset,interval:payload.interval,customBars,paths:128});
      if(requestUrl.searchParams.has('selectionStart')){
        const selectedStart=fixtureEpochMs(payload.selection?.start),selectedEnd=fixtureEpochMs(payload.selection?.end);
        if(!Number.isFinite(selectedStart)||!Number.isFinite(selectedEnd)||!(selectedStart<selectedEnd))throw new Error('CE browser fixture received invalid selected-range bounds');
        const selectedDuration=Math.max(60_000,selectedEnd-selectedStart),selectedCandles=payload.market?.candles||[];
        const fixtureNews=[
          {title:'Replay evidence available early',source:'fixture-replay.example',publishedAt:new Date(selectedStart+Math.min(selectedDuration*.2,3_600_000)).toISOString(),url:'https://fixture-replay.example/early'},
          {title:'Replay evidence available later',source:'fixture-replay.example',publishedAt:new Date(selectedStart+Math.min(selectedDuration*.75,8*3_600_000)).toISOString(),url:'https://fixture-replay.example/late'}
        ];
        const fixtureFunding=[
          {time:selectedStart+Math.min(selectedDuration*.3,4*3_600_000),fundingRate:.0001,premium:.0002},
          {time:selectedStart+Math.min(selectedDuration*.85,10*3_600_000),fundingRate:.00015,premium:.00025}
        ];
        const fixtureBenchmark=selectedCandles.map((item,index)=>({
          ...item,
          o:Number(item.o??item.open)*(1+index*.00001),
          h:Number(item.h??item.high)*(1+index*.00001),
          l:Number(item.l??item.low)*(1+index*.00001),
          c:Number(item.c??item.close)*(1+index*.00001)
        }));
        const selectedRangeCrossAsset=buildSelectedRangeCrossAssetAnalysis(selectedCandles,fixtureBenchmark,{selection:payload.selection,asset:payload.asset,benchmark:payload.asset==='BTC'?'ETH':'BTC',assetClass:'crypto'});
        payload.evidence={...payload.evidence,selectedCrossAssetAnalysis:selectedRangeCrossAsset};
        payload.selectedRangeCrossAsset=selectedRangeCrossAsset;
        payload.rangeEvidence=buildDecisionRangeEvidence({graph:payload,evidence:payload.evidence,assetClass:'crypto',venue:'Hyperliquid',timezone:'UTC'});
        payload.rangeReplay=buildDecisionRangeReplay({candles:selectedCandles,selection:payload.selection,interval:payload.interval,newsArticles:fixtureNews,fundingRows:fixtureFunding,benchmarkCandles:fixtureBenchmark,benchmark:payload.asset==='BTC'?'ETH':'BTC'});
        payload.selectedRangeSimilarMoves=buildSelectedRangeSimilarMoves(selectedCandles,{selection:payload.selection,interval:payload.interval,limit:5});
        if(payload.rangeReplay?.state!=='AVAILABLE')throw new Error('CE browser fixture failed to construct an available no-hindsight replay');
        latestSelectedPayload=payload;
      }
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
  await page.route('**/api/v1/decision-scan**',proxyDecision);
  await page.route('**/api/v1/decision-proven-graph**',proxyDecision);
  await page.route('**/api/v1/decision-news-context**',proxyDecision);
  await page.route('**/api/v1/decision-range-evidence**',proxyDecision);
  await page.goto(localOrigin+'/#/decision-provenance',{waitUntil:'domcontentloaded',timeout:45_000});
  const chart=page.locator('[data-dpg-chart]').first();
  await chart.waitFor({state:'visible',timeout:45_000});
  const ciMotion=await page.evaluate(()=>{
    const dock=document.querySelector('.q-dpg-chat-dock__bar'),mode=document.querySelector('[data-dpg-chart-mode]');
    const dockStyle=dock?getComputedStyle(dock):null,modeStyle=mode?getComputedStyle(mode):null;
    return {dockAnimation:dockStyle?.animationName||'',dockTransition:dockStyle?.transitionDuration||'',modeTransition:modeStyle?.transitionDuration||''};
  });
  if(ciMotion.dockAnimation!=='none'||(ciMotion.modeTransition&&ciMotion.modeTransition!=='0s'))failures.push({type:'ci-reduced-motion',...ciMotion});
  const ciTouchTargets=await page.evaluate(()=>{
    const selectors=['[data-dpg-chart-mode]','[data-dpg-asset-picker-toggle]','[data-dpg-chat-dock-toggle]'];
    return selectors.map(selector=>{const node=document.querySelector(selector),rect=node?.getBoundingClientRect();return {selector,width:rect?.width||0,height:rect?.height||0};});
  });
  if(ciTouchTargets.some(item=>item.height<44||item.width<44))failures.push({type:'ci-touch-targets',targets:ciTouchTargets});
  const projectedRange=page.locator('[data-dpg-projected-range]').first();
  await projectedRange.waitFor({state:'visible',timeout:10_000});
  const projectedState=await projectedRange.getAttribute('data-projection-state');
  const projectedObservedClass=await projectedRange.locator('[data-candle-index]').count();
  const projectedLabel=String(await projectedRange.locator('.q-dpg-projected-range__label').textContent()||'').trim();
  if(projectedState!=='PROJECTED'||projectedObservedClass!==0||projectedLabel!=='PROJECTED')failures.push({type:'next-move-projection-boundary',projectedState,projectedObservedClass,projectedLabel});
  const nextMove=page.locator('[data-dpg-next-move]').first();
  await nextMove.waitFor({state:'visible',timeout:10_000});
  const nextMoveText=(await nextMove.innerText()).replace(/\s+/g,' ').trim().toLowerCase();
  const nextMoveRequired=['next move research','projected','bullish','neutral / small range','bearish','expected range','likely high / low band','expected volatility','calibration','projection invalidation','probability governance'].every(label=>nextMoveText.includes(label));
  const probabilityCards=await nextMove.locator('.q-dpg-next-move__probabilities strong').allTextContents();
  const probabilitySafe=probabilityCards.length===3&&probabilityCards.every(value=>value==='UNCALIBRATED'||/^\d+(?:\.\d+)?%$/.test(value));
  if(!nextMoveRequired||!probabilitySafe)failures.push({type:'next-move-research',nextMoveRequired,probabilitySafe,probabilityCards,text:nextMoveText});
  await nextMove.locator('[data-dpg-next-bars="3"]').click();
  await page.waitForTimeout(80);
  const activeThree=await page.locator('[data-dpg-next-move]').first().getAttribute('data-active-bars');
  if(activeThree!=='3')failures.push({type:'next-move-horizon',activeThree});
  await page.locator('[data-dpg-next-bars="1"]').first().click();

  const cfSetup=page.locator('[data-dpg-cf-setup]').first();
  await cfSetup.waitFor({state:'visible',timeout:10_000});
  const cfSetupText=(await cfSetup.innerText()).replace(/\s+/g,' ').trim().toLowerCase();
  const cfSetupRequired=['current setup','direction','entry','stop','invalidation','selected r:r','setup probability','calibration','expiry','event risk','t1 / t2 / t3 / t4','lifecycle','r:r visual ladder'].every(label=>cfSetupText.includes(label));
  const cfLifecycleCurrent=await cfSetup.locator('.q-dpg-cf-lifecycle .is-current').count();
  const cfLifecycleIcons=await cfSetup.locator('.q-dpg-cf-lifecycle b').count();
  const cfTargetCards=await cfSetup.locator('.q-dpg-cf-targets span').count();
  const cfRrCards=await cfSetup.locator('[data-dpg-cf-rr-card]').count();
  const cfRrIds=await cfSetup.locator('[data-dpg-cf-rr]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-dpg-cf-rr')));
  const cfProbabilityText=String(await cfSetup.locator('.q-dpg-cf-setup__facts').innerText()).toUpperCase();
  if(!cfSetupRequired||cfLifecycleCurrent!==1||cfLifecycleIcons<10||cfTargetCards!==4||cfRrCards!==6||JSON.stringify(cfRrIds)!==JSON.stringify(['1','2','3','4','auto','custom'])||(!cfProbabilityText.includes('UNCALIBRATED')&&!/%/.test(cfProbabilityText)))failures.push({type:'cf-setup-summary',cfSetupRequired,cfLifecycleCurrent,cfLifecycleIcons,cfTargetCards,cfRrCards,cfRrIds,cfProbabilityText,text:cfSetupText});

  const cfWatch=page.locator('[data-dpg-cf-watch]').first();
  await cfWatch.waitFor({state:'visible',timeout:10_000});
  const cfWatchText=(await cfWatch.innerText()).replace(/\s+/g,' ').trim().toLowerCase();
  const cfWatchCount=await cfWatch.locator('li').count();
  if(cfWatchCount<3||cfWatchCount>5||!cfWatchText.includes('what should i watch?')||!cfWatchText.includes('evidence triggers'))failures.push({type:'cf-watch-next',cfWatchCount,text:cfWatchText});

  const cfScenarios=page.locator('[data-dpg-cf-scenarios]').first();
  await cfScenarios.waitFor({state:'visible',timeout:10_000});
  const cfScenarioText=(await cfScenarios.innerText()).replace(/\s+/g,' ').trim().toLowerCase();
  const cfScenarioCards=await cfScenarios.locator('[data-dpg-cf-scenario]').count();
  const cfScenarioRequired=['scenario map','bull','base','bear','target zone','what must happen','invalidation','calibration','research only'].every(label=>cfScenarioText.includes(label));
  const cfHighProbabilitySafe=await cfScenarios.locator('[data-dpg-cf-scenario]').evaluateAll(nodes=>nodes.every(node=>{
    const value=String(node.querySelector('h3')?.textContent||'').trim();
    const numeric=value.endsWith('%')?Number(value.slice(0,-1)):null;
    if(!Number.isFinite(numeric)||numeric<80)return true;
    const state=String(node.querySelector('header > span')?.textContent||'').toUpperCase();
    return state.includes('STRICT CALIBRATION');
  }));
  if(cfScenarioCards<3||cfScenarioCards>4||!cfScenarioRequired||!cfHighProbabilitySafe)failures.push({type:'cf-scenario-map',cfScenarioCards,cfScenarioRequired,cfHighProbabilitySafe,text:cfScenarioText});

  await page.locator('[data-dpg-cf-rr="2"]').first().click();
  await page.waitForFunction(()=>document.querySelector('[data-dpg-rr]')?.value==='2',null,{timeout:10_000});
  await page.waitForFunction(()=>document.querySelector('[data-dpg-cf-rr-card="2"]')?.classList.contains('is-active')===true,null,{timeout:10_000});
  const cfRrTwoActive=await page.locator('[data-dpg-cf-rr-card="2"].is-active').count();
  await page.locator('[data-dpg-cf-rr="auto"]').first().click();
  await page.waitForFunction(()=>document.querySelector('[data-dpg-rr]')?.value==='auto',null,{timeout:10_000});
  const cfRrAutoActive=await page.locator('[data-dpg-cf-rr-card="auto"].is-active').count();
  if(cfRrTwoActive!==1||cfRrAutoActive!==1)failures.push({type:'cf-rr-interaction',cfRrTwoActive,cfRrAutoActive});

  const assetPickerToggle=page.locator('[data-dpg-asset-picker-toggle]').first();
  await assetPickerToggle.waitFor({state:'visible',timeout:10_000});
  await assetPickerToggle.click();
  const assetPicker=page.locator('[data-dpg-asset-picker-panel]').first();
  await assetPicker.waitFor({state:'visible',timeout:10_000});
  const pickerBox=await assetPicker.boundingBox();
  const pickerFitsViewport=Boolean(pickerBox)&&pickerBox.x>=0&&pickerBox.y>=0&&pickerBox.x+pickerBox.width<=viewport.width+1&&pickerBox.y+Math.min(pickerBox.height,viewport.height)<=viewport.height+1;
  const pickerText=(await assetPicker.innerText()).replace(/\s+/g,' ').trim().toLowerCase();
  const pickerRequired=['provider-capability universe','crypto','forex','indian indices','indian stocks','global stocks','metals','commodities','global indices','rates / bonds','etfs','reference only','unavailable'].every(label=>pickerText.includes(label));
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
  const favoritesFilter=page.locator('[data-dpg-asset-filter="favorites"]').first();
  const favoritesHitTarget=await favoritesFilter.evaluate((node)=>{
    const rect=node.getBoundingClientRect(),hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
    return hit===node||Boolean(hit?.closest?.('[data-dpg-asset-filter="favorites"]'));
  });
  if(!favoritesHitTarget)failures.push({type:'asset-picker-filter-hit-target'});
  await favoritesFilter.click();
  await page.waitForTimeout(60);
  const favoriteEth=await page.locator('[data-dpg-asset-select="ETH"]:visible').count();
  if(favoriteEth!==1)failures.push({type:'asset-picker-favorite',favoriteEth});
  await page.locator('[data-dpg-asset-search]').first().focus();
  await page.keyboard.press('Escape');
  await assetPicker.waitFor({state:'hidden',timeout:5000});
  const assetPickerFocusReturned=await page.evaluate(()=>document.activeElement?.matches?.('[data-dpg-asset-picker-toggle]')===true);
  if(!assetPickerFocusReturned)failures.push({type:'ci-asset-picker-focus-return'});
  const timeframeSelect=page.locator('[data-dpg-interval]').first();
  const timeframeValues=await timeframeSelect.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value));
  const timeframeGroups=await timeframeSelect.locator('optgroup').evaluateAll(nodes=>nodes.map(node=>node.label));
  const timeframeCoverage=['1m','3m','5m','15m','30m','1h','2h','4h','1d'].every(value=>timeframeValues.includes(value))&&['SCALP','INTRADAY','SWING'].every(label=>timeframeGroups.includes(label));
  if(!timeframeCoverage)failures.push({type:'timeframe-picker-coverage',timeframeValues,timeframeGroups});
  const education=page.locator('.q-dpg-education').first();
  const educationText=(await education.innerText()).replace(/\s+/g,' ').trim().toLowerCase();
  const educationRequired=['decision terms & help','r:r','invalidation','funding','oi','calibration','no trade','selected-range evidence'].every(label=>educationText.includes(label));
  const tooltipCount=await education.locator('[role="tooltip"]').count();
  if(!educationRequired||tooltipCount<7)failures.push({type:'decision-education-help',educationRequired,tooltipCount,text:educationText});
  const setupFinder=page.locator('[data-dpg-setup-finder]').first();
  await setupFinder.waitFor({state:'visible',timeout:10_000});
  const setupFinderText=(await setupFinder.innerText()).replace(/\s+/g,' ').trim().toLowerCase();
  const setupFinderRequired=['find setup now','validated setup','aggressive discovery','all markets','current asset','long + short','long','short','highest quality','lowest event risk','closest candidate'].every(label=>setupFinderText.includes(label));
  if(!setupFinderRequired)failures.push({type:'setup-finder-controls',text:setupFinderText});
  lastScanRequest=null;
  await page.locator('[data-dpg-scan-mode="aggressive"]').first().click();
  await page.locator('[data-dpg-scan-universe="current"]').first().click();
  await page.locator('[data-dpg-scan-direction="short"]').first().click();
  await page.locator('[data-dpg-scan-ranking]').first().selectOption('lowest_event_risk');
  await page.locator('[data-dpg-setup-finder] [data-dpg-scan]').first().click();
  const closestCandidate=page.locator('[data-dpg-closest-candidate]').first();
  await closestCandidate.waitFor({state:'visible',timeout:10_000});
  const closestText=(await closestCandidate.innerText()).replace(/\s+/g,' ').trim().toLowerCase();
  const closestCandidateRequired=['closest candidate','not yet validated','uncalibrated','missing conditions','calibration gate'].every(label=>closestText.includes(label));
  const setupRequestOk=lastScanRequest?.mode==='aggressive'&&lastScanRequest?.ranking==='lowest_event_risk'&&lastScanRequest?.assets==='BTC'&&lastScanRequest?.direction==='short'&&lastScanRequest?.rr==='auto';
  const closestInterval=await closestCandidate.locator('[data-dpg-scan-interval]').first().getAttribute('data-dpg-scan-interval');
  if(!closestCandidateRequired||!setupRequestOk||closestInterval!=='30m')failures.push({type:'setup-finder-aggressive',closestCandidateRequired,setupRequestOk,lastScanRequest,closestInterval,text:closestText});
  const chatDock=page.locator('[data-dpg-chat-dock]').first();
  await chatDock.waitFor({state:'visible',timeout:10_000});
  const chatDockToggle=page.locator('[data-dpg-chat-dock-toggle]').first();
  const collapsedComposer=page.locator('[data-dpg-chat-dock-composer]').first();
  const composerTargetStable=await collapsedComposer.count()===1&&!await collapsedComposer.isVisible();
  if(!composerTargetStable)failures.push({type:'ci-dock-aria-controls-target'});
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
  await page.locator('[data-dpg-chat-input]').first().press('Escape');
  await dockComposer.waitFor({state:'hidden',timeout:5000});
  const dockFocusReturned=await page.evaluate(()=>document.activeElement?.matches?.('[data-dpg-chat-dock-toggle]')===true);
  if(!dockFocusReturned)failures.push({type:'ci-dock-focus-return'});
  await chatDockToggle.press('Enter');
  await dockComposer.waitFor({state:'visible',timeout:5000});
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
  const simpleControls=await simpleTab.getAttribute('aria-controls'),simplePanelRole=await page.locator('#qelly-decision-panel-simple').getAttribute('role');
  if(simpleControls!=='qelly-decision-panel-simple'||simplePanelRole!=='tabpanel')failures.push({type:'ci-mode-semantics',simpleControls,simplePanelRole});
  await simpleTab.focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>document.querySelector('[data-dpg-ui-mode="advanced"]')?.getAttribute('aria-selected')==='true',{timeout:5000});
  const advancedKeyboardFocus=await page.evaluate(()=>document.activeElement?.matches?.('[data-dpg-ui-mode="advanced"]')===true);
  if(!advancedKeyboardFocus)failures.push({type:'ci-mode-keyboard-focus'});
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(()=>document.querySelector('[data-dpg-ui-mode="simple"]')?.getAttribute('aria-selected')==='true',{timeout:5000});
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
  const spokenRange=String(await page.locator('[data-dpg-range-announcement]').first().textContent()||'').toLowerCase();
  const spokenRangeComplete=['selected range from','candles','move','high','low'].every(label=>spokenRange.includes(label));
  const sliderValueText=await page.locator('[data-dpg-range-start]').first().getAttribute('aria-valuetext');
  if(!spokenRangeComplete||!sliderValueText||sliderValueText.toLowerCase().includes('unavailable'))failures.push({type:'ci-screen-reader-range',spokenRange,sliderValueText});
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
  const rangeCrossAsset=page.locator('[data-dpg-range-cross-asset]').first();
  await rangeCrossAsset.waitFor({state:'visible',timeout:20_000});
  const rangeCrossAssetText=(await rangeCrossAsset.innerText()).replace(/\s+/g,' ').trim(),normalizedRangeCrossAsset=rangeCrossAssetText.toLowerCase();
  const rangeCrossAssetRequired=['cross-asset','selected range','relative strength','correlation','beta','before','during','after','pairwise','descriptive only'].every(label=>normalizedRangeCrossAsset.includes(label));
  const rangeCrossAssetClassification=await rangeCrossAsset.getAttribute('data-classification');
  const forbiddenCrossAssetCausality=['btc caused','benchmark caused','caused by btc','broad risk move confirmed'].some(label=>normalizedRangeCrossAsset.includes(label));
  if(!rangeCrossAssetRequired||rangeCrossAssetClassification==='UNAVAILABLE'||forbiddenCrossAssetCausality)failures.push({type:'range-cross-asset',rangeCrossAssetRequired,rangeCrossAssetClassification,forbiddenCrossAssetCausality,text:rangeCrossAssetText});
  const timeline=page.locator('[data-dpg-range-timeline]').first();
  await timeline.waitFor({state:'visible',timeout:20_000});
  const timelineText=(await timeline.innerText()).replace(/\s+/g,' ').trim(),normalizedTimeline=timelineText.toLowerCase();
  const timelineRequired=['what caused this move?','historical news / event timeline','before','during','after','association only','direct'].every(label=>normalizedTimeline.includes(label));
  const injectedImageCount=await timeline.locator('img[src="x"]').count();
  if(!timelineRequired||injectedImageCount)failures.push({type:'range-timeline',text:timelineText,timelineRequired,injectedImageCount});
  const replayPanel=page.locator('[data-dpg-range-replay]').first();
  await replayPanel.waitFor({state:'visible',timeout:20_000});
  const replayText=(await replayPanel.innerText()).replace(/\s+/g,' ').trim(),normalizedReplay=replayText.toLowerCase();
  const replayRequired=['range replay','no hindsight','available as of','future evidence'].every(label=>normalizedReplay.includes(label));
  const replaySlider=page.locator('[data-dpg-replay-slider]').first();
  const replayMax=Number(await replaySlider.getAttribute('max'));
  const replayBefore=(await replayPanel.locator('header h3').innerText()).trim();
  if(replayMax>0){
    await replaySlider.fill(String(replayMax));
    await page.waitForTimeout(80);
  }
  const replayAfter=(await page.locator('[data-dpg-range-replay] header h3').first().innerText()).trim();
  const replayScrubs=replayMax===0||replayBefore!==replayAfter;
  if(!replayRequired||!replayScrubs)failures.push({type:'range-replay',replayRequired,replayScrubs,replayMax,replayBefore,replayAfter,text:replayText});
  const similarPanel=page.locator('[data-dpg-similar-moves]').first();
  await similarPanel.waitFor({state:'visible',timeout:20_000});
  const similarText=(await similarPanel.innerText()).replace(/\s+/g,' ').trim(),normalizedSimilar=similarText.toLowerCase();
  const similarRequired=['find similar moves','selected range','descriptive only','not calibration','leakage'].every(label=>normalizedSimilar.includes(label));
  if(!similarRequired)failures.push({type:'range-similar-moves',similarRequired,text:similarText});
  const flowPanel=page.locator('[data-dpg-range-flow]').first();
  await flowPanel.waitFor({state:'visible',timeout:20_000});
  const flowText=(await flowPanel.innerText()).replace(/\s+/g,' ').trim(),normalizedFlow=flowText.toLowerCase();
  const flowRequired=['flow / participation evidence','known named flows','observed order flow','public institutional data','unknown actor activity','actor identity unavailable','true order flow unavailable'].every(label=>normalizedFlow.includes(label));
  const forbiddenFlowClaims=['identified whale','confirmed institution bought','confirmed institution sold'].some(label=>normalizedFlow.includes(label));
  if(!flowRequired||forbiddenFlowClaims)failures.push({type:'range-flow',text:flowText,flowRequired,forbiddenFlowClaims});
  await page.screenshot({path:path.join(outputDir,`decision-range-selected-${name}.png`),fullPage:true});
  lastScanRequest=null;
  const similarSetupButton=page.locator('[data-dpg-range-action="similar-setup"]').first();
  const similarSetupVisible=await similarSetupButton.isVisible().catch(()=>false);
  if(similarSetupVisible){
    await similarSetupButton.click();
    await page.waitForFunction(()=>Boolean(window.__QELLY_E2E_LAST_SCAN_REQUEST__)||Boolean(document.querySelector('[data-dpg-closest-candidate]')),{timeout:20_000}).catch(()=>{});
  }
  const similarSetupBridge=similarSetupVisible&&lastScanRequest?.mode==='validated'&&lastScanRequest?.assets==='BTC'&&lastScanRequest?.ranking==='highest_quality'&&lastScanRequest?.direction==='any';
  if(!similarSetupBridge)failures.push({type:'range-similar-current-setup-bridge',similarSetupVisible,lastScanRequest});
  const result={name,viewport,touch,timeframeCoverage,educationHelp:educationRequired&&tooltipCount>=7,similarSetupBridge,nextMove:{projectedState,nextMoveRequired,probabilitySafe,activeThree},waveCf:{setup:cfSetupRequired,lifecycleCurrent:cfLifecycleCurrent,watchCount:cfWatchCount,scenarioCards:cfScenarioCards,highProbabilitySafe:cfHighProbabilitySafe,rrCards:cfRrCards,rrInteractive:cfRrTwoActive===1&&cfRrAutoActive===1},assetPicker:{fitsViewport:pickerFitsViewport,required:pickerRequired,selectableCount,favoriteEth},setupFinder:{required:setupFinderRequired,aggressiveRequest:setupRequestOk,closestCandidate:closestCandidateRequired,closestInterval},decisionModes:{simpleDefault:true,advanced:advancedRequired,research:researchRequired},qellyDock:{centered:dockCentered,composer:dockComposerRequired,rangeAware:rangeAwareDock},persistent,candles,boundaries,handles,summary:text,rangeIntelligence:intelligenceRequired,rangeIntelligenceText:intelligenceText,rangeCrossAsset:rangeCrossAssetRequired&&!forbiddenCrossAssetCausality,rangeCrossAssetClassification,rangeCrossAssetText,rangeTimeline:timelineRequired,rangeTimelineText:timelineText,rangeReplay:replayRequired&&replayScrubs,rangeReplayText:replayText,rangeSimilarMoves:similarRequired,rangeSimilarMovesText:similarText,rangeFlow:flowRequired,rangeFlowText:flowText,failures};
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
