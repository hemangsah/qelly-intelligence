import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.QELLY_SCREEN_EVIDENCE_SHA,'b5d795ef57114ba0a12dbe9ba692e6fb4ff1dd60');
assert.equal(process.env.QELLY_HEADER_LIVE,'true');assert.equal(process.env.QELLY_HEADER_PREVIEW,'true');assert.equal(process.env.QELLY_HEADER_ACTUAL_ZOOM,'true');
const source=await readFile('scripts/qelly-header-pointer-e2e.mjs','utf8'),sourceSha256=createHash('sha256').update(source).digest('hex');
assert.equal(sourceSha256,'0f9c951f5a3bff379fe39c2dfff36cf5fb895baf47c9c395f1cb5bbd8dd8208d');
const out='preview/header-zoom-timing-probe';await mkdir(out,{recursive:true});
const start=performance.now(),contexts=[],pages=[],requests=[],errors=[],instrumentedContexts=new WeakSet(),instrumentedPages=new WeakSet();let errorText=null;
function instrumentPage(page,contextId){if(instrumentedPages.has(page))return;instrumentedPages.add(page);const id=pages.length+1,record={id,contextId,documentReadyEvents:[],requestCount:0};pages.push(record);const identities=new WeakMap();
 page.on('request',request=>{if(requests.length>=5000)return;const url=new URL(request.url()),row={id:requests.length+1,pageId:id,contextId,method:request.method(),resourceType:request.resourceType(),origin:url.origin,path:url.pathname,startedMs:performance.now()-start};identities.set(request,row);requests.push(row);record.requestCount++;});
 page.on('response',response=>{const row=identities.get(response.request());if(row){row.status=response.status();row.responseMs=performance.now()-start;}});
 page.on('requestfinished',request=>{const row=identities.get(request);if(row){row.finishedMs=performance.now()-start;row.networkTiming=request.timing();}});
 page.on('requestfailed',request=>{const row=identities.get(request);if(row){row.failedMs=performance.now()-start;row.failure=request.failure()?.errorText;}});
 page.on('domcontentloaded',()=>record.documentReadyEvents.push({event:'domcontentloaded',atMs:performance.now()-start}));page.on('load',()=>record.documentReadyEvents.push({event:'load',atMs:performance.now()-start}));page.on('pageerror',error=>errors.push({pageId:id,message:error.message}));
}
function instrumentContext(context,kind){if(instrumentedContexts.has(context))return;instrumentedContexts.add(context);const id=contexts.length+1;contexts.push({id,kind,startedMs:performance.now()-start});context.on('page',page=>instrumentPage(page,id));for(const page of context.pages())instrumentPage(page,id);}
const launch=chromium.launch.bind(chromium),persistent=chromium.launchPersistentContext.bind(chromium);
chromium.launch=async(...args)=>{const browser=await launch(...args),create=browser.newContext.bind(browser);browser.newContext=async(...values)=>{const context=await create(...values);instrumentContext(context,'ordinary');return context;};return browser;};
chromium.launchPersistentContext=async(...args)=>{const context=await persistent(...args);instrumentContext(context,'actual-zoom-persistent');return context;};
try{await import(pathToFileURL(process.cwd()+'/scripts/qelly-header-pointer-e2e.mjs'));}catch(error){errorText=error.stack||String(error);process.exitCode=1;}
finally{
 let actual;try{actual=JSON.parse(await readFile('preview/header-zoom-e2e/report.json','utf8'));}catch{}
 const incomplete=requests.filter(row=>row.finishedMs===undefined&&row.failedMs===undefined),failed=requests.filter(row=>row.failedMs!==undefined),slowest=requests.filter(row=>row.finishedMs!==undefined).sort((a,b)=>(b.finishedMs-b.startedMs)-(a.finishedMs-a.startedMs)).slice(0,12);
 const report={schema:'qelly.header-zoom.passive-timing/1.0',status:!errorText&&actual?.status==='passed'?'passed':'failed',sourceSha:process.env.QELLY_SCREEN_EVIDENCE_SHA,runnerSha:process.env.GITHUB_SHA,sourceSha256,sourceTestUnchanged:true,assertionsUnchanged:true,timeoutsUnchanged:true,error:errorText,actualResultStatus:actual?.status??null,actualResultRecords:actual?.results?.length??0,actualPreview:actual?.site??null,actualZoom:actual?.actualZoom??null,blockedWriteAttempts:actual?.blockedWrites??null,outgoingWrites:actual?.outgoingWrites??null,contexts,pages,requests,requestCount:requests.length,incompleteRequests:incomplete,failedRequests:failed,slowestCompletedRequests:slowest,pageErrors:errors,productFilesChanged:false,fullSuiteRetried:false,latencyMeasured:false,boundary:'Existing exact-preview header zoom program imported unchanged. Passive Playwright event observations only; no route, response, timeout or assertion is changed. Request URLs omit queries. A passing recheck does not prove the transport cause of the earlier navigation timeout and does not replace the full candidate suite.'};
 await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log('QELLY_HEADER_ZOOM_TIMING_PROBE '+JSON.stringify({status:report.status,sourceSha:report.sourceSha,sourceSha256,actualResultRecords:report.actualResultRecords,requestCount:requests.length,incompleteRequests:incomplete.map(({origin,path,resourceType})=>({origin,path,resourceType})),failedRequests:failed.map(({origin,path,failure})=>({origin,path,failure})),error:errorText}));
}
