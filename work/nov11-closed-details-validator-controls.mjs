// Parser/acceptance negative controls only. No local browser/build or image files.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import {hash} from './nov11-closed-details-source-fragments.mjs';
import {validateClosedDetailsPng} from './nov11-closed-details-png.mjs';
import {validateClosedDetailsNative} from './nov11-closed-details-native-validator.mjs';
import {closedDetailsFloorCases as cases} from './nov11-closed-details-fixture-cases.mjs';
const contract=JSON.parse(await readFile('work/nov11-closed-details-source-contract.json','utf8')),runner='f'.repeat(40),table=Uint32Array.from({length:256},(_,v)=>{for(let i=0;i<8;i++)v=(v&1)?0xedb88320^(v>>>1):v>>>1;return v>>>0;});
const crc=b=>{let v=0xffffffff;for(const c of b)v=table[(v^c)&255]^(v>>>8);return(v^0xffffffff)>>>0;};
const chunk=(type,data)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length,0);b.write(type,4);data.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,data.length+8)),data.length+8);return b;};
const png=(width,height,color)=>{const head=Buffer.alloc(13);head.writeUInt32BE(width);head.writeUInt32BE(height,4);head[8]=8;head[9]=2;const stride=width*3,raw=Buffer.alloc((stride+1)*height);for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let c=0;c<3;c++)raw[y*(stride+1)+1+x*3+c]=color[c];return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);};
const images=new Map(),fileProof=new Map();for(const width of [1440,768,390,320])for(let color=0;color<3;color++){const height=width<=390?844:900,b=png(width,height,color===0?[11,8,10]:color===1?[36,18,25]:[180,12,90]);images.set(width+'-'+color,{bytes:b,proof:{sha256:hash(b),...validateClosedDetailsPng(b,{width,height})}});}
const meta=(file,width,color)=>{const p=images.get(width+'-'+color);fileProof.set(file,p.proof);return{file,sha256:p.proof.sha256,bytes:p.bytes.length,width,height:width<=390?844:900};};
const readPng=async m=>{const p=fileProof.get(m.file);assert.ok(p);return p;};
const traversal={ 'closed-first-summary':[4,2,2], 'nested-closed-summary':[6,4,4], 'inner-open-outer-closed':[5,3,3], 'outer-open-inner-closed':[5,2,2], 'multiple-summaries':[5,3,3], 'no-explicit-summary':[2,1,0], 'summary-after-body-node':[5,3,3], 'normal-visible-text':[2,0,0] },rows=[];
for(const appearance of ['dark','light'])for(const width of [1440,768,390,320])for(const arm of ['baseline','candidate']){
 const scenarios=[];for(const item of cases){if(item.id==='normal-visible-text')scenarios.push({item,method:'none'});else for(const method of ['pointer','Enter','programmatic'])scenarios.push({item,method});}for(const [special,method] of [['space-key','Space'],['constructor-unavailable','programmatic'],['dynamic-closed-label','programmatic']])scenarios.push({item:cases[0],method,special});
 for(let index=0;index<scenarios.length;index++){
  const {item,method,special=null}=scenarios[index],contextId=appearance+'-'+width,sceneId=item.id+(special?'-'+special:'')+'-'+method,prefix=contextId+'-'+arm+'-'+String(index).padStart(2,'0'),ids=[...item.html.matchAll(/<span\b[^>]*id="([^"]+)"/g)].map(m=>m[1]);if(special==='dynamic-closed-label')ids.push('dynamicText');
  const legacy=arm==='baseline'||special==='constructor-unavailable',core=ids.length-(special==='dynamic-closed-label'?1:0),visible=legacy?core:item.mustFloorInitially.length,[q,m,c]=legacy?[0,0,0]:traversal[item.id],initiallyOpen=item.id==='inner-open-outer-closed'?['inner']:item.id==='outer-open-inner-closed'?['outer']:[];
  const targets=ids.map(id=>({id,present:true,paintEligible:item.mustFloorInitially.includes(id),fontSize:legacy||item.mustFloorInitially.includes(id)?12:8,floor:legacy||item.mustFloorInitially.includes(id),display:'block',visibility:'visible'}));
  const initial={stage:'initial-settled',phase:'mount-'+sceneId,now:1,timeOrigin:1000,targets,openDetails:[{id:'outer',open:initiallyOpen.includes('outer'),pseudoContentVisibility:initiallyOpen.includes('outer')?'visible':'hidden'},...(item.html.includes('id="inner"')?[{id:'inner',open:initiallyOpen.includes('inner'),pseudoContentVisibility:initiallyOpen.includes('inner')?'visible':'hidden'}]:[])]};
  const call={id:1,phase:'mount-'+sceneId,scopeId:'main',scopeTag:'MAIN',start:0,end:1,rectangleReads:1+visible,fontStyleReads:1+visible,closestReads:1+core+q,containsReads:c,closedAncestorQueries:q,closedAncestorMatches:m,classAdds:visible};
  const calls=[call];if(arm==='candidate')for(const id of initiallyOpen)calls.push({...call,id:calls.length+1,scopeTag:'DETAILS',scopeId:id,start:2,end:3,rectangleReads:0,fontStyleReads:0,closestReads:0,containsReads:0,closedAncestorQueries:0,closedAncestorMatches:0,classAdds:0});
  const events=[];if(['pointer','Enter','Space'].includes(method))events.push({kind:'native-click',trusted:true});if(['Enter','Space'].includes(method))events.push({kind:'native-keydown',trusted:true,key:method==='Space'?' ':method});
  const steps=[],observations=[],plans=method==='none'?[]:item.id==='outer-open-inner-closed'?['inner']:item.id==='nested-closed-summary'?['outer','inner']:['outer'];
  for(let stepIndex=0;stepIndex<plans.length;stepIndex++){
   const id=plans[stepIndex],sample={stage:method==='programmatic'?'programmatic-post-setter':'native-activation-microtask',phase:sceneId+'-'+stepIndex,now:4+stepIndex,timeOrigin:1000,targets:ids.map(id=>({id,present:true,paintEligible:!(item.id==='nested-closed-summary'&&stepIndex===0&&id==='innerBody'),fontSize:12,floor:true,display:'block',visibility:'visible'})),openDetails:[]};observations.push(sample);
   const before=meta('references/'+prefix+'-'+stepIndex+'-closed.png',width,0),after=meta('references/'+prefix+'-'+stepIndex+'-open.png',width,1),frames=[{...meta('frames/'+prefix+'-'+stepIndex+'-000.png',width,0),sessionId:1,metadata:{timestamp:1}},{...meta('frames/'+prefix+'-'+stepIndex+'-001.png',width,1),sessionId:2,metadata:{timestamp:2}}];
   steps.push({targetId:id,method,beforeReference:before,afterReference:after,samples:[sample],targetOpen:true,focus:{id:'summary-'+id,tag:'SUMMARY'},visibility:'visible',transport:{frames,acknowledgements:2,ackErrors:[],maxFramesInFlightObserved:1,overflow:0,lateFrames:0,allActualPaintsCertified:false}});
  }
  rows.push({contextId,appearance,width,height:width<=390?844:900,arm,sceneId,caseId:item.id,method,special,watchIds:ids,expectedInitiallyVisible:item.mustFloorInitially,expectedInitiallyDeferred:item.mustDeferInitially,initial,steps,calls,events,observations,droppedObservations:0,final:observations.at(-1)||initial,protectedWritesSent:0});
 }
}
const summary={sourceSha:contract.base,runnerSha:runner,measurementStatus:'completed',sourceBindings:Object.fromEntries(Object.entries(contract.sourceBindings).map(([k,v])=>[k,{...v,checked:true}])),sourceFragments:contract.sourceFragments,instrumentedFloorBindings:contract.instrumentedFloorBindings,expectedContexts:16,contextsObserved:16,expectedScenesPerContext:25,expectedRows:400,rows:400,protectedWritesSent:0,productionSourceChanged:false,productionOptimizationApplied:false,firstPaintCertificate:false,rendererStageB:{modeViews:0,fullPayloadActionParityAccepted:false}};
const valid=await validateClosedDetailsNative(summary,rows,{expectedRunnerSha:runner,contract,readPng});assert.equal(valid.nativePolicyAccepted,true);assert.equal(valid.fullRendererParityAccepted,false);
const candidate=rows.find(r=>r.arm==='candidate'&&r.method==='programmatic'&&!r.special),controls=[
 ['wrong-source',(s)=>{s.sourceSha='0'.repeat(40);}],
 ['wrong-runner',(s)=>{s.runnerSha='0'.repeat(40);}],
 ['early-visible-font',(_s,r)=>{const row=r.find(r=>r.arm==='candidate'&&r.method==='programmatic'&&!r.special);row.observations[0].targets.find(t=>t.paintEligible).fontSize=8;}],
 ['missing-postsetter',(_s,r)=>{r.find(r=>r.arm==='candidate'&&r.method==='programmatic'&&!r.special).steps[0].samples=[];}],
 ['untrusted-keyboard',(_s,r)=>{r.find(r=>r.arm==='candidate'&&r.method==='Enter'&&!r.special).events.forEach(e=>e.trusted=false);}],
 ['visible-summary-skipped',(_s,r)=>{r.find(r=>r.arm==='candidate'&&!r.special).initial.targets[0].paintEligible=false;}],
 ['forged-closest-count',(_s,r)=>{r.find(r=>r.arm==='candidate'&&!r.special).calls[0].closestReads++;}],
 ['missing-default-open-work',(_s,r)=>{const row=r.find(r=>r.arm==='candidate'&&r.caseId==='inner-open-outer-closed');row.calls=row.calls.filter(c=>c.scopeTag!=='DETAILS');}],
 ['fallback-policy-changed',(_s,r)=>{r.find(r=>r.arm==='candidate'&&r.special==='constructor-unavailable').calls[0].closedAncestorQueries=1;}],
 ['failed-ack',(_s,r)=>{r.find(r=>r.arm==='candidate'&&r.steps.length).steps[0].transport.ackErrors.push('failed');}],
 ['capture-overflow',(_s,r)=>{r.find(r=>r.arm==='candidate'&&r.steps.length).steps[0].transport.overflow=1;}],
 ['late-omitted-frame',(_s,r)=>{r.find(r=>r.arm==='candidate'&&r.steps.length).steps[0].transport.lateFrames=1;}],
 ['lost-focus',(_s,r)=>{r.find(r=>r.arm==='candidate'&&r.steps.length).steps[0].focus.id='wrong';}],
 ['protected-write',s=>{s.protectedWritesSent=1;}],
 ['forged-renderer-credit',s=>{s.rendererStageB.fullPayloadActionParityAccepted=true;}],
 ['changed-model-source',s=>{s.sourceBindings['functions/api/v1/decision-proven-graph.js'].sha256='0'.repeat(64);}],
 ['changed-instrumented-floor',s=>{s.instrumentedFloorBindings.candidate.instrumentedSha256='0'.repeat(64);}]
];
for(const [name,mutate] of controls){const s=structuredClone(summary),r=structuredClone(rows);mutate(s,r);let rejected=false;try{rejected=!(await validateClosedDetailsNative(s,r,{expectedRunnerSha:runner,contract,readPng})).nativePolicyAccepted;}catch{rejected=true;}assert.equal(rejected,true,'Reject negative evidence '+name);}
const changedFrame=structuredClone(rows),frame=changedFrame.find(r=>r.arm==='candidate'&&r.steps.length).steps[0].transport.frames[0],old=fileProof.get(frame.file),foreign=images.get('1440-2').proof;frame.sha256=foreign.sha256;frame.bytes=images.get('1440-2').bytes.length;fileProof.set(frame.file,foreign);assert.equal((await validateClosedDetailsNative(summary,changedFrame,{expectedRunnerSha:runner,contract,readPng})).nativePolicyAccepted,false);fileProof.set(frame.file,old);
const prefixRows=structuredClone(rows.filter(r=>r.contextId==='dark-1440'&&r.caseId==='closed-first-summary'&&r.method==='programmatic'&&!r.special)),candidatePrefix=prefixRows.find(r=>r.arm==='candidate');
const badTarget=candidatePrefix.observations[0].targets.find(t=>t.id==='bodyText');badTarget.fontSize=8;badTarget.floor=false;
const unsafe=[];for(const sample of candidatePrefix.observations)for(const target of sample.targets)if(target.paintEligible&&target.fontSize<12)unsafe.push({stage:sample.stage,now:sample.now,id:target.id,fontSize:target.fontSize});
const prefixSummary={...structuredClone(summary),measurementStatus:'completed-prefix-rejection',rows:2,contextsObserved:2,prefixDecision:{completed:true,rows:2,expandedMatrixRun:false,unsafeCandidateObservations:unsafe}};
const rejectedPrefix=await validateClosedDetailsNative(prefixSummary,prefixRows,{expectedRunnerSha:runner,contract,readPng});assert.equal(rejectedPrefix.status,'rejected-conservative-earliest-dom-font-prefix');assert.equal(rejectedPrefix.nativePolicyAccepted,false);assert.equal(rejectedPrefix.prefixRowsValidated,2);assert.equal(rejectedPrefix.fullMatrixRowsValidated,0);assert.equal(rejectedPrefix.pixelMismatches.length,0);assert.equal(rejectedPrefix.firstPaintCertificate,false);
const fabricatedPositive=structuredClone(prefixRows);for(const s of fabricatedPositive.find(r=>r.arm==='candidate').observations)for(const t of s.targets){t.fontSize=12;t.floor=true;}
await assert.rejects(()=>validateClosedDetailsNative({...prefixSummary,prefixDecision:{...prefixSummary.prefixDecision,unsafeCandidateObservations:[]}},fabricatedPositive,{expectedRunnerSha:runner,contract,readPng}),'A partial prefix can never claim a positive native pass');
const b=images.get('320-0').bytes,corrupt=Buffer.from(b);corrupt[29]^=1;assert.throws(()=>validateClosedDetailsPng(corrupt,{width:320,height:844}));assert.throws(()=>validateClosedDetailsPng(b.subarray(0,b.length-1),{width:320,height:844}));assert.throws(()=>validateClosedDetailsPng(b,{width:321,height:844}));
const report={recordedAt:new Date().toISOString(),status:'local-acceptance-validator-controls-passed-not-browser-proof',syntheticRows:400,validSyntheticCorpusAccepted:true,conservativeTwoRowPrefixRejectedWithoutPaintClaim:true,partialPositivePrefixCannotPass:true,negativeVariantsRejected:[...controls.map(([name])=>name),'changed-frame-pixels','PNG-CRC','PNG-truncation','PNG-wrong-dimensions','partial-prefix-positive-credit'],pngShapesDecoded:images.size,browserExecutedLocally:false,buildExecutedLocally:false,imageFilesWrittenLocally:0,sourceCandidateAccepted:false,firstVisibleFrameSafetyProved:false,fullRendererCredit:false};
await mkdir('outputs',{recursive:true});await writeFile('outputs/QELLY_NOV11_CLOSED_DETAILS_VALIDATOR_CONTROLS.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
