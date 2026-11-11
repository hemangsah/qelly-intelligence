import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function captureNativeOpening(page,{out,prefix,action,maxFrames=24}){
 await mkdir(out+'/frames',{recursive:true});const cdp=await page.context().newCDPSession(page);await cdp.send('Page.enable');
 const frames=[],acks=[],ackErrors=[];let active=true,inFlight=0,maxInFlight=0,overflow=0,lateFrames=0,firstFrameResolve;const firstFrame=new Promise(r=>firstFrameResolve=r);
 cdp.on('Page.screencastFrame',frame=>{
  inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);
  const ack=cdp.send('Page.screencastFrameAck',{sessionId:frame.sessionId}).catch(e=>ackErrors.push(e.message)).finally(()=>inFlight--);acks.push(ack);
  if(!active){lateFrames++;return;}if(frames.length>=maxFrames){overflow++;return;}
  frames.push({data:frame.data,sessionId:frame.sessionId,metadata:frame.metadata,receivedAtEpochMs:Date.now()});firstFrameResolve();
 });
 let actionError;
 try{
  await cdp.send('Page.startScreencast',{format:'png',everyNthFrame:1});
  let timer;try{await Promise.race([firstFrame,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('No initial compositor frame')),2500);})]);}finally{clearTimeout(timer);}
  await action();
  await page.waitForTimeout(220);
 }catch(e){actionError={message:e.message,stack:e.stack};}
 finally{await cdp.send('Page.stopScreencast').catch(e=>ackErrors.push('stop:'+e.message));active=false;await Promise.allSettled(acks);await cdp.detach().catch(e=>ackErrors.push('detach:'+e.message));}
 const written=[];
 for(let i=0;i<frames.length;i++){const f=frames[i],bytes=Buffer.from(f.data,'base64');assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));const file='frames/'+prefix+'-'+String(i).padStart(3,'0')+'.png';await writeFile(out+'/'+file,bytes);written.push({file,sha256:hash(bytes),bytes:bytes.length,sessionId:f.sessionId,metadata:f.metadata,receivedAtEpochMs:f.receivedAtEpochMs,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)});}
 return{frames:written,acknowledgements:acks.length,ackErrors,maxFramesInFlightObserved:maxInFlight,overflow,lateFrames,actionError,transport:'CDP Page.startScreencast PNG everyNthFrame1 with per-frame acknowledgements',allActualPaintsCertified:false,captureBoundary:'Delivered compositor frames with swap metadata; the transport does not certify that every actual paint was delivered. rAF observations are separately labelled DOM samples.'};
}
