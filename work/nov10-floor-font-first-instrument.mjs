import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';

export const SOURCE_SHA='172eb87d5cd229a11eb751578fb26dfbe344b0db';
export const SOURCE_SHELL_SHA256='a4548e535a59fda0d20095ce0867ee812f4d0e2b1a284faf81c5096cb2c8153f';
// Filled from read-only GitHub contents reads at SOURCE_SHA; verified again in the cloud checkout.
export const SOURCE_FILE_HASHES={
  "apps/web/public/assets/qelly-production-shell.mjs": {
    "bytes": 23467,
    "sha256": "a4548e535a59fda0d20095ce0867ee812f4d0e2b1a284faf81c5096cb2c8153f",
    "blobSha": "87465e2128d206e2acd053a49db42aeda5fd2cdf"
  },
  "apps/web/public/assets/routes/decision-proven-graph.mjs": {
    "bytes": 230923,
    "sha256": "a41453df7cc3e247d3c7d144b602957eba37ec8eb3c03da4264706d806dc77de",
    "blobSha": "ec263949fe2873f148b0c46f49657b57f28b80c8"
  },
  "apps/web/public/assets/qelly-decision-proven-graph.css": {
    "bytes": 113527,
    "sha256": "3e448d76f44cae03d1c93090e7fffe31dbcc80c0436605eaaec1e659a0ef1fc7",
    "blobSha": "dcd72b3ec207839d74b2b49cc6e02dfe0c36cf2b"
  },
  "functions/api/v1/decision-proven-graph.js": {
    "bytes": 48652,
    "sha256": "533466d29eca278f9c2955ca3675aa60b570b888f21fa1b0ead565a6b0785a0d",
    "blobSha": "85e541b8af5740dec9c25a4cf00b9e44ce0ff0d5"
  },
  "functions/_lib/decision-asset-capabilities.js": {
    "bytes": 4713,
    "sha256": "039783fe850ef17a6d0efcc6b532447be7dbbe6935dc36c621b38832f7e27fba",
    "blobSha": "9988617ae481d8cef2c0953621c2dc0e7dcf65b6"
  },
  "functions/api/v1/decision-news-context.js": {
    "bytes": 2956,
    "sha256": "9750673fb8b8f52d7d159e5fd4a26a266b8e1e6f9c952fb5f51008dbe6b39467",
    "blobSha": "456a57c0f01f7a43165199f4bc963a8d05352de0"
  },
  "scripts/release-a5-evidence-server.mjs": {
    "bytes": 19238,
    "sha256": "4cda0ee0c8af0579f956c2062cdb127f10b387985b0ead8123e7883d03a67aa3",
    "blobSha": "39344dc910b49e5951e6f3f65a1b9d024b66de31"
  }
};
export const hash=value=>createHash('sha256').update(value).digest('hex');
const START='function applyAccessibilityFloor(){';
const END='\nfunction annotateRoute(){';
const OPEN='/*QELLY_NOV10_FONT_FIRST_ENTRY_BEGIN*/const __qfmProbe=window.__QELLY_NOV10_FONT_FIRST_MECHANISM__;const __qfmInvocation=__qfmProbe.enterFloor();try{/*QELLY_NOV10_FONT_FIRST_ENTRY_END*/';
const CLOSE='/*QELLY_NOV10_FONT_FIRST_EXIT_BEGIN*/}finally{__qfmProbe.exitFloor(__qfmInvocation);}/*QELLY_NOV10_FONT_FIRST_EXIT_END*/';
const exactlyOnce=(text,needle)=>assert.equal(text.split(needle).length,2,'Unique instrumentation boundary: '+needle);
export function floorParts(text){
  exactlyOnce(text,START);exactlyOnce(text,END);
  const start=text.indexOf(START),end=text.indexOf(END,start),chunk=text.slice(start,end);
  assert.ok(end>start);const open=start+chunk.indexOf('{')+1,close=start+chunk.lastIndexOf('}');
  assert.ok(close>open);return {start,end,open,close,body:text.slice(open,close),floor:text.slice(start,end)};
}
export function instrumentShell(original,expectedFloor){
  assert.ok(!original.includes('QELLY_NOV10_FONT_FIRST_'));assert.ok(!original.includes('__qfm'));
  const parts=floorParts(original);assert.equal(parts.floor,expectedFloor,'Built floor must equal exact pinned source floor');
  const instrumented=original.slice(0,parts.open)+OPEN+original.slice(parts.open,parts.close)+CLOSE+original.slice(parts.close);
  exactlyOnce(instrumented,OPEN);exactlyOnce(instrumented,CLOSE);
  const reversed=instrumented.replace(OPEN,'').replace(CLOSE,'');
  assert.equal(reversed,original,'Removing only instrumentation must restore every original response byte');
  const after=floorParts(instrumented);
  assert.equal(after.body,OPEN+parts.body+CLOSE,'Original body bytes, ordering and synchronous control flow must be preserved');
  return {instrumented,receipt:{originalResponseSha256:hash(original),instrumentedResponseSha256:hash(instrumented),reversedResponseSha256:hash(reversed),originalFloorSha256:hash(parts.floor),originalFloorBodySha256:hash(parts.body),sourceBodyBytePreserved:true,reversalExact:true,instrumentationKind:'Entry/exit wrapper only; original body remains byte-identical inside try/finally; no scheduling change'}};
}

// This function is serialized into the browser by Playwright; no Node bindings.
export function installProbe({appearance}){
  if(location.protocol==='about:')return;
  localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({appearance,themeFamily:'sovereign-obsidian',persona:'quant-operator'}));
  localStorage.removeItem('qelly.decision.ui-mode.v1');
  const p=window.__QELLY_NOV10_FONT_FIRST_MECHANISM__={version:1,phase:'initial-loading',events:[],frames:[],floorCalls:[],frameIndex:0,mainRevision:0,operationCounts:{},stack:[],droppedEvents:0,instrumentOnlyObservers:['main childList observer','document childList attachment observer','continuous rAF observation heartbeat'],frameMeaning:'Observed rAF intervals; neither actual paints nor INP'};
  const record=(kind,extra={})=>{
    if(p.events.length>=40000){p.droppedEvents++;return null;}
    const event={kind,ts:performance.now(),frameIndex:p.frameIndex,mainRevision:p.mainRevision,phase:p.phase,visibility:document.visibilityState,...extra};p.events.push(event);return event;
  };
  p.mark=phase=>{p.phase=phase;record('phase');};
  p.enterFloor=()=>{
    const call={id:p.floorCalls.length+1,start:performance.now(),frameIndex:p.frameIndex,phase:p.phase,mainRevision:p.mainRevision,visibility:document.visibilityState,rectangleReads:0,fontStyleReads:0,boundsReads:0,rangeReads:0,canvasMetricReads:0,floorClassAdds:0};
    p.floorCalls.push(call);p.stack.push(call);record('floor-entry',{callId:call.id});return call;
  };
  p.exitFloor=call=>{call.end=performance.now();record('floor-exit',{callId:call.id,rectangleReads:call.rectangleReads,fontStyleReads:call.fontStyleReads});p.stack.pop();};
  const count=key=>{const phase=p.operationCounts[p.phase]??={rectangleReads:0,fontStyleReads:0,boundsReads:0,rangeReads:0,canvasMetricReads:0};phase[key]++;const call=p.stack.at(-1);if(call)call[key]++;};
  const wrap=(owner,name,key)=>{const original=owner[name];assertBrowserFunction(original,name);owner[name]=function(...args){count(key);return Reflect.apply(original,this,args);};};
  const assertBrowserFunction=(fn,name)=>{if(typeof fn!=='function')throw Error('Required operation unavailable: '+name);};
  wrap(Element.prototype,'getClientRects','rectangleReads');wrap(window,'getComputedStyle','fontStyleReads');wrap(Element.prototype,'getBoundingClientRect','boundsReads');wrap(Range.prototype,'getClientRects','rangeReads');wrap(Range.prototype,'getBoundingClientRect','rangeReads');wrap(CanvasRenderingContext2D.prototype,'measureText','canvasMetricReads');
  const tokenAdd=DOMTokenList.prototype.add;DOMTokenList.prototype.add=function(...tokens){const call=p.stack.at(-1);if(call&&tokens.includes('q-v8-text-floor'))call.floorClassAdds++;return Reflect.apply(tokenAdd,this,tokens);};
  // A setter wrapper gives synchronous timestamps for the actual root writes.
  // MutationObserver timestamps below are separately labeled delivery times.
  const descriptor=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
  Object.defineProperty(Element.prototype,'innerHTML',{...descriptor,set(value){
    if(this.id!=='main')return Reflect.apply(descriptor.set,this,[value]);
    record('main-innerHTML-before',{oldChildCount:this.childNodes.length});
    const result=Reflect.apply(descriptor.set,this,[value]);p.mainRevision++;record('main-innerHTML-after',{newChildCount:this.childNodes.length});return result;
  }});
  for(const [prototype,names] of [[Node.prototype,['appendChild','insertBefore','removeChild','replaceChild']],[Element.prototype,['append','prepend','replaceChildren','insertAdjacentHTML']]])for(const name of names){
    const original=prototype[name];if(typeof original!=='function')continue;
    prototype[name]=function(...args){
      if(this.id!=='main'||(name==='insertAdjacentHTML'&&!['afterbegin','beforeend'].includes(String(args[0]).toLowerCase())))return Reflect.apply(original,this,args);
      record('main-method-before',{method:name,oldChildCount:this.childNodes.length});
      const result=Reflect.apply(original,this,args);p.mainRevision++;record('main-method-after',{method:name,newChildCount:this.childNodes.length});return result;
    };
  }
  let observedMain=null,mainObserver;
  const attach=()=>{
    const main=document.getElementById('main');if(!main||main===observedMain)return;
    mainObserver?.disconnect();observedMain=main;record('main-observer-attached');
    mainObserver=new MutationObserver(records=>record('main-mutation-delivery',{timestampMeaning:'Observer delivery, not exact mutation time',records:records.map(row=>({added:row.addedNodes.length,removed:row.removedNodes.length}))}));
    mainObserver.observe(main,{childList:true});
  };
  const attachmentObserver=new MutationObserver(()=>{attach();if(observedMain)attachmentObserver.disconnect();});attachmentObserver.observe(document,{childList:true,subtree:true});attach();if(observedMain)attachmentObserver.disconnect();
  const heartbeat=timestamp=>{p.frameIndex++;p.frames.push({index:p.frameIndex,rafTimestamp:timestamp,callbackNow:performance.now(),phase:p.phase,visibility:document.visibilityState});if(p.frames.length<20000)p.frameRequest=requestAnimationFrame(heartbeat);};
  p.frameRequest=requestAnimationFrame(heartbeat);
  document.addEventListener('visibilitychange',()=>record('visibilitychange'));
  window.addEventListener('resize',()=>record('resize'));
  window.addEventListener('hashchange',()=>record('hashchange',{route:location.hash}));
  p.stop=()=>{cancelAnimationFrame(p.frameRequest);mainObserver?.disconnect();attachmentObserver.disconnect();record('probe-stopped');};
}

export function summarizeIntervals(probe){
  const nextFrame=ts=>probe.frames.find(frame=>frame.callbackNow>=ts)?.index??null;
  const calls=probe.floorCalls.map(call=>({...call,nextObservedFrame:nextFrame(call.start)}));
  const groups=new Map();for(const call of calls){if(call.nextObservedFrame===null||call.visibility!=='visible')continue;const key=call.phase+'|'+call.nextObservedFrame;const list=groups.get(key)||[];list.push(call);groups.set(key,list);}
  const multiple=[...groups].filter(([,list])=>list.length>1).map(([key,list])=>({key,calls:list.map(call=>call.id),mainRevisions:list.map(call=>call.mainRevision),rectangleReads:list.reduce((n,call)=>n+call.rectangleReads,0),fontStyleReads:list.reduce((n,call)=>n+call.fontStyleReads,0)}));
  const routine=multiple.filter(row=>row.key.startsWith('initial-loading|')||row.key.startsWith('ready-mode-')||row.key.startsWith('resize|'));
  return {calls:calls.length,rectangleReads:calls.reduce((n,call)=>n+call.rectangleReads,0),fontStyleReads:calls.reduce((n,call)=>n+call.fontStyleReads,0),multipleCallsBeforeSameObservedFrame:multiple,routineMultipleCallsBeforeSameObservedFrame:routine,stressOrFeasibilityMultipleCallsBeforeSameObservedFrame:multiple.filter(row=>!routine.includes(row)),coalescingMechanismObserved:multiple.length>0,routineCoalescingMechanismObserved:routine.length>0,decision:routine.length?'Potential routine same-interval opportunity; neither redundant work nor optimization benefit proven':multiple.length?'Reject routine-performance justification: repeats appeared only in synthetic stress/feasibility intervals':'Reject frame-coalescing hypothesis for these measured phases: no repeated visible passes before one observed frame',callsWithNoSubsequentObservedFrame:calls.filter(call=>call.nextObservedFrame===null).length,unobservedPaintBoundary:true};
}

export function prepareFontFirstShell(original){
 const before="    if(!element.textContent?.trim()||!element.getClientRects().length)continue;\n    const size=Number.parseFloat(getComputedStyle(element).fontSize);\n    if(Number.isFinite(size)&&size<12)smallText.push(element);";
 const after="    if(!element.textContent?.trim())continue;\n    const size=Number.parseFloat(getComputedStyle(element).fontSize);\n    if(Number.isFinite(size)&&size<12&&element.getClientRects().length)smallText.push(element);";
 assert.equal(original.split(before).length,2);const candidate=original.replace(before,after);assert.equal(candidate.replace(after,before),original);
 return{candidate,baselineFloor:floorParts(original).floor,candidateFloor:floorParts(candidate).floor,receipt:{originalSha256:hash(original),candidateSha256:hash(candidate),reversedSha256:hash(candidate.replace(after,before)),exactThreeLinePredicateReplacement:true,sourceReversalExact:true,sourceBodyChangedOnlyByPredicateOrder:true,newSelectors:0,newCaches:0,newObservers:0,schedulingChanged:false,batchedClassWritesPreserved:true,visibilityGuardPreserved:true,threshold:12,before,after}};
}


const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const table=Uint32Array.from({length:256},(_,n)=>{for(let bit=0;bit<8;bit++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc32=bytes=>{let value=0xffffffff;for(const byte of bytes)value=table[(value^byte)&255]^(value>>>8);return(value^0xffffffff)>>>0;};
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};

// Decode the noninterlaced 8-bit RGB/RGBA PNG format produced by Chromium.
// All chunks are CRC-checked; zlib validates the compressed stream and Adler checksum.
// Every scanline is fully unfiltered, rather than trusting its signature or IHDR.
export function validateFontFirstPng(bytes,expected){
 assert.ok(Buffer.isBuffer(bytes));assert.ok(bytes.length>=57);assert.ok(bytes.subarray(0,8).equals(signature));
 let offset=8,header=null,ended=false,idatStarted=false,idatEnded=false;const compressed=[];
 while(offset<bytes.length){
  assert.ok(offset+12<=bytes.length,'Truncated PNG chunk header');const length=bytes.readUInt32BE(offset);assert.ok(length<=bytes.length-offset-12,'Truncated PNG chunk');
  const type=bytes.toString('ascii',offset+4,offset+8),data=bytes.subarray(offset+8,offset+8+length);assert.match(type,/^[A-Za-z]{4}$/);assert.equal(crc32(bytes.subarray(offset+4,offset+8+length)),bytes.readUInt32BE(offset+8+length),'PNG chunk CRC '+type);
  if(!header){
   assert.equal(type,'IHDR');assert.equal(length,13);const width=data.readUInt32BE(0),height=data.readUInt32BE(4),depth=data[8],colorType=data[9];
   assert.equal(width,expected.width);assert.equal(height,expected.height);assert.ok(width>0&&height>0&&width*height<=100000000);assert.equal(depth,8);assert.ok(colorType===2||colorType===6,'Unsupported Chromium PNG color type');assert.equal(data[10],0);assert.equal(data[11],0);assert.equal(data[12],0,'Interlaced PNG is outside the screenshot contract');header={width,height,colorType,channels:colorType===2?3:4};
  }else if(type==='IHDR')assert.fail('Repeated PNG header');
  else if(type==='IDAT'){assert.equal(idatEnded,false,'Noncontiguous PNG image data');idatStarted=true;compressed.push(data);}
  else if(type==='IEND'){assert.equal(length,0);assert.equal(idatStarted,true);ended=true;offset+=12;assert.equal(offset,bytes.length,'Trailing PNG bytes');break;}
  else{
   if(idatStarted)idatEnded=true;assert.ok(type[0]===type[0].toLowerCase(),'Unsupported critical PNG chunk '+type);assert.ok(!['acTL','fcTL','fdAT'].includes(type),'Animated PNG is outside the screenshot contract');
  }
  offset+=length+12;
 }
 assert.ok(header&&ended&&compressed.length>0,'Incomplete PNG');const stride=header.width*header.channels,expectedBytes=(stride+1)*header.height;
 const input=Buffer.concat(compressed),inflated=inflateSync(input,{maxOutputLength:expectedBytes+1,info:true});assert.equal(inflated.engine.bytesWritten,input.length,'Trailing compressed PNG bytes');const decoded=inflated.buffer;assert.equal(decoded.length,expectedBytes,'Wrong PNG scanline byte count');
 let previous=Buffer.alloc(stride),row=Buffer.alloc(stride),cursor=0;const pixelDigest=createHash('sha256');
 for(let y=0;y<header.height;y++){
  const filter=decoded[cursor++];assert.ok(filter<=4,'Invalid PNG scanline filter');
  for(let x=0;x<stride;x++){const raw=decoded[cursor++],left=x>=header.channels?row[x-header.channels]:0,up=previous[x],upperLeft=x>=header.channels?previous[x-header.channels]:0;row[x]=(raw+(filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,upperLeft)))&255;}
  pixelDigest.update(row);[row,previous]=[previous,row];
 }
 assert.equal(cursor,decoded.length);return{width:header.width,height:header.height,colorType:header.colorType,channels:header.channels,chunksCrcVerified:true,pixelsDecoded:true,pixelSha256:pixelDigest.digest('hex')};
}
