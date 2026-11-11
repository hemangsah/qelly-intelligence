// A native first-opening safety gate. An unsafe result must not advance to full renderer/performance work.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {BASE_SHA,hash,extractClosedDetailsFragments} from './nov11-closed-details-source-fragments.mjs';
import {installClosedDetailsProbe} from './nov11-closed-details-browser-probe.mjs';
import {captureNativeOpening} from './nov11-closed-details-frame-capture.mjs';
import {closedDetailsFloorCases} from './nov11-closed-details-fixture-cases.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true','Browser/dependencies/artifacts must stay in cloud');
assert.equal(process.env.QELLY_SCREEN_EVIDENCE_SHA,BASE_SHA);assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),BASE_SHA);
const config=JSON.parse(await readFile('scripts/nov11-closed-details-source-contract.json','utf8')),bindings={};
for(const [path,expected] of Object.entries(config.sourceBindings)){const bytes=await readFile(path);assert.equal(hash(bytes),expected.sha256,path);bindings[path]={...expected,checked:true};}assert.equal(Object.keys(bindings).length,7);
const source=await readFile('apps/web/public/assets/qelly-production-shell.mjs','utf8');let candidate=source;
for(const {before,after} of config.edits){assert.equal(candidate.split(before).length,2);candidate=candidate.replace(before,after);}
assert.equal(hash(candidate),config.candidateSha256);const fragments=extractClosedDetailsFragments(source,candidate,config.edits);
const out='preview/nov11-closed-details-native';await mkdir(out+'/rows',{recursive:true});await mkdir(out+'/references',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
const cases=closedDetailsFloorCases,rows=[],rowFiles=[],references=[],prefixRows=[];let active,fatalError,prefixDecision;
const fixtureHtml=appearance=>'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{animation:none!important;transition:none!important;scroll-behavior:auto!important}body{margin:0;padding:18px;font-family:Arial,sans-serif;background:'+(appearance==='dark'?'#0b080a':'#faf5f3')+';color:'+(appearance==='dark'?'#f8eaf0':'#27131b')+'}h1{font-size:20px}#main{padding:16px;background:'+(appearance==='dark'?'#241219':'#f0e2e8')+';max-width:700px;min-height:420px}summary{cursor:pointer;min-height:32px}summary:focus-visible{outline:3px solid #a74e6c;outline-offset:3px}#main span{font-size:8px}.q-v8-text-floor{font-size:12px!important}button{font-size:14px;min-height:36px;margin-bottom:12px}details{margin:8px;padding:8px}details span{display:block;padding:4px}#scene{min-height:52px}</style></head><body><h1>Native disclosure typography</h1><div id="scene"></div><main id="main"></main></body></html>';
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const shot=async(page,file)=>{const bytes=await page.screenshot({path:out+'/'+file,animations:'disabled',caret:'hide'});const r={file,sha256:hash(bytes),bytes:bytes.length,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};references.push(r);return r;};
async function executeContext(appearance,width,arm,{prefixOnly=false}={}){
  const contextId=appearance+'-'+width,context=await browser.newContext({viewport:{width,height:width<=390?844:900},hasTouch:width<=390,colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'}),blocked=[];
  await context.route('**/*',route=>{blocked.push({method:route.request().method(),url:route.request().url(),outcome:'aborted before network'});return route.abort();});
  const page=active=await context.newPage();await page.setContent(fixtureHtml(appearance));await page.evaluate(installClosedDetailsProbe);
  await page.evaluate(program=>{const main=document.getElementById('main');window.__CLOSED_FLOOR__=new Function('main',program)(main);},fragments[arm].program);
  const scenarios=[];
  for(const item of cases){if(item.id==='normal-visible-text')scenarios.push({item,method:'none'});else for(const method of ['pointer','Enter','programmatic'])scenarios.push({item,method});}
  scenarios.push({item:cases[0],method:'Space',special:'space-key'});
  scenarios.push({item:cases[0],method:'programmatic',special:'constructor-unavailable'});
  scenarios.push({item:cases[0],method:'programmatic',special:'dynamic-closed-label'});
  for(let n=0;n<scenarios.length;n++){
   if(prefixOnly&&n!==2)continue;
   const {item,method,special=null}=scenarios[n],sceneId=item.id+(special?'-'+special:'')+'-'+method,prefix=contextId+'-'+arm+'-'+String(n).padStart(2,'0');
   const rowFile='rows/'+prefix+'.json';if(!prefixOnly&&rowFiles.includes(rowFile))continue;
   await page.evaluate(({html,label,withoutConstructor})=>{
    const p=window.__QELLY_CLOSED_DETAILS_PROBE__;p.phase='mount-'+label;p.sceneStart={calls:p.calls.length,observations:p.observations.length,events:p.events.length};p.savedConstructor=window.HTMLDetailsElement;
    if(withoutConstructor)Object.defineProperty(window,'HTMLDetailsElement',{value:undefined,writable:true,configurable:true});
    document.getElementById('scene').textContent=label;document.getElementById('main').innerHTML='<button id="beforeDisclosure">Focus before disclosure</button>'+html;window.__CLOSED_FLOOR__();
   },{html:item.html,label:sceneId,withoutConstructor:special==='constructor-unavailable'});
   await frames(page);
   if(special==='dynamic-closed-label')await page.evaluate(()=>{const e=document.createElement('span');e.id='dynamicText';e.textContent='New text while disclosure is closed';document.getElementById('outer').append(e);window.__CLOSED_FLOOR__();});
   const watchIds=await page.evaluate(()=>[...document.querySelectorAll('#main span[id]')].map(e=>e.id));
   const initial=await page.evaluate(ids=>{const p=window.__QELLY_CLOSED_DETAILS_PROBE__;p.watchIds=ids;return p.observe('initial-settled');},watchIds);
   const steps=[];
   const targets=method==='none'?[]:item.id==='outer-open-inner-closed'?['inner']:item.id==='nested-closed-summary'?['outer','inner']:['outer'];
   for(let stepIndex=0;stepIndex<targets.length;stepIndex++){
    const targetId=targets[stepIndex],target=page.locator('#'+targetId);assert.equal(await target.evaluate(e=>e.open),false,'The opening target must begin closed');
    const summary=target.locator(':scope > summary').first(),hasSummary=await summary.count()>0;
    if(method==='pointer'){if(hasSummary)await summary.hover();else await target.hover({position:{x:14,y:12}});}
    if(method==='Enter'||method==='Space'){
     await page.locator('#beforeDisclosure').focus();
     if(hasSummary)await summary.focus();else await page.keyboard.press('Tab');
    }
    const before=await shot(page,'references/'+prefix+'-'+stepIndex+'-closed.png');
    const start=await page.evaluate(({phase,ids})=>{const p=window.__QELLY_CLOSED_DETAILS_PROBE__;const start=p.observations.length;p.start(phase,ids);p.observe('before-activation');return start;},{phase:sceneId+'-'+stepIndex,ids:watchIds});
    const transport=await captureNativeOpening(page,{out,prefix:prefix+'-'+stepIndex,action:async()=>{
     if(method==='pointer'){if(width<=390){if(hasSummary)await summary.tap();else await target.tap({position:{x:14,y:12}});}else if(hasSummary)await summary.click();else await target.click({position:{x:14,y:12}});}
     else if(method==='Enter'||method==='Space')await page.keyboard.press(method);
     else await target.evaluate(e=>{e.open=true;const p=window.__QELLY_CLOSED_DETAILS_PROBE__;p.observe('programmatic-post-setter');queueMicrotask(()=>p.observe('programmatic-post-setter-microtask'));});
    }});
    await page.evaluate(()=>window.__QELLY_CLOSED_DETAILS_PROBE__.stop());await frames(page);
    const after=await shot(page,'references/'+prefix+'-'+stepIndex+'-open.png');
    const observed=await page.evaluate(({start,targetId})=>{const p=window.__QELLY_CLOSED_DETAILS_PROBE__;return{samples:p.observations.slice(start),targetOpen:document.getElementById(targetId).open,focus:{id:document.activeElement?.id||null,tag:document.activeElement?.tagName||null},visibility:document.visibilityState};},{start,targetId});
    steps.push({targetId,method,beforeReference:before,afterReference:after,...observed,transport});
   }
   const end=await page.evaluate(()=>{
    const p=window.__QELLY_CLOSED_DETAILS_PROBE__,start=p.sceneStart,result={calls:p.calls.slice(start.calls),events:p.events.slice(start.events),observations:p.observations.slice(start.observations),droppedObservations:p.droppedObservations,final:p.observe('scene-final')};
    if(window.HTMLDetailsElement!==p.savedConstructor)Object.defineProperty(window,'HTMLDetailsElement',{value:p.savedConstructor,writable:true,configurable:true});return result;
   });
   const row={contextId,appearance,width,height:width<=390?844:900,arm,sceneId,caseId:item.id,method,special,watchIds,expectedInitiallyVisible:item.mustFloorInitially,expectedInitiallyDeferred:item.mustDeferInitially,initial,steps,...end,protectedWritesSent:0};
   rows.push(row);rowFiles.push(rowFile);if(prefixOnly)prefixRows.push(row);await writeFile(out+'/'+rowFile,JSON.stringify(row,null,2)+'\n');
  }
  assert.deepEqual(blocked,[],'Inline native fixture must not issue network requests');await context.close();active=null;
}
try{
 await executeContext('dark',1440,'baseline',{prefixOnly:true});
 await executeContext('dark',1440,'candidate',{prefixOnly:true});
 const candidatePrefix=prefixRows.find(r=>r.arm==='candidate'),unsafe=[];
 for(const sample of candidatePrefix.observations)for(const target of sample.targets)if(target.paintEligible&&target.fontSize<12)unsafe.push({stage:sample.stage,now:sample.now,id:target.id,fontSize:target.fontSize});
 prefixDecision={completed:true,rows:prefixRows.length,sourceCase:'closed-first-summary',method:'programmatic',unsafeCandidateObservations:unsafe,expandedMatrixRun:unsafe.length===0,scope:'Conservative earliest paint-eligible DOM font gate; a rejected transient is not by itself proof of a painted flash'};
 if(unsafe.length===0)for(const appearance of ['dark','light'])for(const width of [1440,768,390,320])for(const arm of ['baseline','candidate'])await executeContext(appearance,width,arm);
}catch(error){fatalError={message:error.message,stack:error.stack,completedRows:rows.length};await active?.screenshot({path:out+'/producer-failure.png'}).catch(()=>{});}
finally{
 const expectedScenesPerContext=closedDetailsFloorCases.filter(c=>c.id!=='normal-visible-text').length*3+1+3;
 const floorBinding=({code,...binding})=>binding;
 const prefixRejected=prefixDecision?.unsafeCandidateObservations.length>0;
 const summary={sourceSha:BASE_SHA,runnerSha:process.env.GITHUB_SHA,measurementStatus:fatalError?'failed':prefixRejected?'completed-prefix-rejection':'completed',fatalError,prefixDecision,sourceBindings:bindings,sourceFragments:fragments.source,instrumentedFloorBindings:{baseline:floorBinding(fragments.baseline.floor),candidate:floorBinding(fragments.candidate.floor)},expectedContexts:16,contextsObserved:new Set(rows.map(r=>r.contextId+'-'+r.arm)).size,expectedScenesPerContext,expectedRows:16*expectedScenesPerContext,rows:rows.length,rowFiles,references,protectedWritesSent:0,productionSourceChanged:false,productionOptimizationApplied:false,firstPaintCertificate:false,rendererStageB:{status:prefixRejected?'skipped-conservative-prefix-safety-rejection':'not-run-before-independent-native-safety-gate',modeViews:0,fullPayloadActionParityAccepted:false},coverageBoundary:'Only the exact-source floor/helper/listener native opening gate. Dedicated synthetic DOM, no account/provider/model changes. A decisive earliest-visible-font prefix rejection skips the remaining400-row expansion and actual renderer64-view phase. Full400 rows remain mandatory for a positive native gate. Delivered frames do not prove every actual paint was captured.'};
 await writeFile(out+'/summary.json',JSON.stringify(summary,null,2)+'\n');console.log('QELLY_CLOSED_DETAILS_NATIVE '+JSON.stringify({measurementStatus:summary.measurementStatus,rows:rows.length,expectedRows:summary.expectedRows,firstPaintCertificate:false,fullRendererPhaseRun:false}));await browser.close();
}
