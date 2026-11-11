// Test-harness evidence only. No page policy, flags, listeners or runtime are changed.
export const BLOCKED_UNLOAD_MESSAGE='Permissions policy violation: unload is not allowed in this document.';
const VENDOR_ORIGIN='https://www.tradingview-widget.com';
export const CONSOLE_CORRELATION_WINDOW_MS=250;
const parseURL=value=>{try{return new URL(value);}catch{return null;}};
const vendorURL=value=>{const url=parseURL(value);return url&&url.origin===VENDOR_ORIGIN&&!url.username&&!url.password?url:null;};
const chartURL=value=>vendorURL(value)?.pathname==='/embed-widget/advanced-chart/';
const bundleURL=value=>{const url=vendorURL(value);return Boolean(url&&!url.search&&!url.hash&&/^\/static\/bundles\/embed\/\d+\.[a-f0-9]+\.js$/.test(url.pathname));};
const lineOf=location=>location?.lineNumber??location?.line;
const stackFrames=stack=>[...(stack?.callFrames||[]),...(stack?.parent?stackFrames(stack.parent):[])];
const nativeKey=entry=>JSON.stringify([entry.frameToken,entry.timestamp,entry.source,entry.level,entry.text,entry.url,entry.lineNumber,entry.stackTrace]);

// Every term is necessary. An identical string without native, non-main, owned
// iframe provenance is a fatal error, including sourceURL-spoofed console.error.
export function isMarketDisplayWidgetUnloadAdvisory(consoleError,nativeEntry){
  if(consoleError?.kind!=='console'||consoleError.type!=='error'||consoleError.text!==BLOCKED_UNLOAD_MESSAGE||consoleError.argumentCount!==0)return false;
  if(!bundleURL(consoleError.location?.url)||!Number.isInteger(lineOf(consoleError.location)))return false;
  if(consoleError.owningFrameURL!==null&&!chartURL(consoleError.owningFrameURL))return false;
  if(!nativeEntry||nativeEntry.source!=='violation'||nativeEntry.level!=='error'||nativeEntry.text!==BLOCKED_UNLOAD_MESSAGE)return false;
  if(nativeEntry.sessionIsMainFrame!==false||!chartURL(nativeEntry.sessionFrameURL)||!nativeEntry.frameToken)return false;
  if(nativeEntry.url!==consoleError.location.url||nativeEntry.lineNumber!==lineOf(consoleError.location)||!bundleURL(nativeEntry.url))return false;
  if(!Number.isFinite(consoleError.at)||!Number.isFinite(nativeEntry.at)||Math.abs(consoleError.at-nativeEntry.at)>CONSOLE_CORRELATION_WINDOW_MS)return false;
  if(!Number.isFinite(nativeEntry.timestamp))return false;
  const owner=nativeEntry.frameOwner;
  if(owner?.verified!==true||owner.hostId!=='v6-market-tradingview'||owner.provider!=='tradingview'||owner.usage!=='display-only'||owner.elementTag!=='IFRAME'||!chartURL(owner.iframeSrc)||owner.frameURL!==nativeEntry.sessionFrameURL)return false;
  const calls=stackFrames(nativeEntry.stackTrace);
  return calls.length>0&&calls.every(call=>bundleURL(call.url))&&calls.some(call=>call.url===nativeEntry.url&&call.lineNumber===nativeEntry.lineNumber);
}

// Native entries are consumed once. Duplicate protocol deliveries cannot excuse
// another error. Ambiguous matches across different frame targets remain fatal.
export function correlateFirstPaintConsoleErrors(consoleErrors,nativeEntries){
  const unique=new Map();
  for(const entry of nativeEntries){
    if(entry.consumed)continue;
    const key=nativeKey(entry);
    if(!unique.has(key))unique.set(key,entry);
  }
  const available=[...unique.values()],used=new Set(),advisories=[],fatal=[];
  for(const error of consoleErrors){
    const matches=available.map((entry,index)=>({entry,index})).filter(({entry,index})=>!used.has(index)&&isMarketDisplayWidgetUnloadAdvisory(error,entry));
    if(matches.length&&new Set(matches.map(({entry})=>entry.frameToken)).size===1){
      matches.sort((a,b)=>Math.abs(a.entry.at-error.at)-Math.abs(b.entry.at-error.at)||a.index-b.index);
      const match=matches[0];used.add(match.index);
      advisories.push({classification:'external_display_widget_blocked_unload',consoleError:error,nativeEntry:match.entry});
    }else fatal.push(error);
  }
  return {advisories,fatal,unmatchedNativeEntries:available.filter((_,index)=>!used.has(index))};
}

export async function attachFirstPaintConsoleProvenance(page,context,errors){
  const rawConsoleErrors=[],pageErrors=[],nativeEntries=[],attachmentErrors=[],advisories=[];
  const initialErrors=[...errors],errorRecords=[];
  const pending=new Set(),sessions=new Map(),attaching=new Map(),frameTokens=new WeakMap();
  let nextFrame=0,classified=0,disposed=false,activeEvidence=null;
  const track=promise=>{pending.add(promise);promise.finally(()=>pending.delete(promise)).catch(()=>{});return promise;};
  const tokenFor=frame=>{if(!frameTokens.has(frame))frameTokens.set(frame,'frame-'+(++nextFrame));return frameTokens.get(frame);};
  const readOwner=async frame=>{
    if(frame===page.mainFrame())return null;
    let element;
    try{
      element=await frame.frameElement();
      const owner=await element.evaluate(node=>{
        const host=node.closest('#v6-market-tradingview');
        return {verified:Boolean(host&&host.contains(node)),hostId:host?.id||null,provider:host?.dataset.externalProvider||null,usage:host?.dataset.usage||null,elementTag:node.tagName,iframeSrc:node.src||null};
      });
      return {...owner,frameURL:frame.url()};
    }catch{return null;}
    finally{await element?.dispose().catch(()=>{});}
  };
  const attachFrame=async frame=>{
    if(disposed||sessions.has(frame))return sessions.get(frame)?.session;
    if(attaching.has(frame))return attaching.get(frame);
    const task=(async()=>{
      let session;
      try{
        session=await context.newCDPSession(frame===page.mainFrame()?page:frame);
        if(disposed){await session.detach();return null;}
        const frameToken=tokenFor(frame);
        session.on('Log.entryAdded',({entry})=>{
          if(entry.level!=='error')return;
          const native={at:Date.now(),timestamp:entry.timestamp,frameToken,sessionIsMainFrame:frame===page.mainFrame(),sessionFrameURL:frame.url(),frameOwner:null,source:entry.source,level:entry.level,text:entry.text,url:entry.url,lineNumber:entry.lineNumber,stackTrace:entry.stackTrace||null};
          nativeEntries.push(native);
          activeEvidence?.nativeEntries.push(native);
          // Resolve the actual iframe element for this event, never a cached
          // about:blank owner. A detached/navigated frame fails closed.
          track(readOwner(frame).then(owner=>{native.frameOwner=owner;}));
        });
        await session.send('Log.enable');
        sessions.set(frame,{session});
        return session;
      }catch(error){
        attachmentErrors.push({frameToken:tokenFor(frame),frameURL:frame.url(),error:String(error?.message||error)});
        await session?.detach().catch(()=>{});
        return null;
      }finally{attaching.delete(frame);}
    })();
    attaching.set(frame,task);return task;
  };
  const onFrame=frame=>{track(attachFrame(frame));};
  const onDetached=frame=>{const state=sessions.get(frame);sessions.delete(frame);if(state)track(state.session.detach().catch(()=>{}));};
  const onPageError=error=>{const item={kind:'pageerror',at:Date.now(),text:String(error),stack:error.stack||null};pageErrors.push(item);errorRecords.push(item);errors.push(item.text);activeEvidence?.pageErrors.push(item);};
  const onConsole=message=>{
    if(message.type()!=='error')return;
    const args=message.args();
    const item={kind:'console',at:Date.now(),type:message.type(),text:message.text(),location:message.location(),argumentCount:args.length,owningFrameURL:null,topPageURL:page.url(),resourceErrorHandledByExistingNetworkChecks:/^Failed to load resource:/i.test(message.text())};
    rawConsoleErrors.push(item);
    activeEvidence?.rawConsoleErrors.push(item);
    // Every error is fatal immediately. Only proven, consumed native evidence
    // may remove a provisional error at a synchronous classification boundary.
    if(!item.resourceErrorHandledByExistingNetworkChecks){errorRecords.push(item);errors.push(item.text);}
    if(args[0])track(args[0].evaluate(()=>location.href).then(url=>{item.owningFrameURL=url;}).catch(()=>{}));
  };
  page.on('frameattached',onFrame);page.on('framenavigated',onFrame);page.on('framedetached',onDetached);
  page.on('pageerror',onPageError);page.on('console',onConsole);
  page.once('close',()=>{page.off('pageerror',onPageError);page.off('console',onConsole);});
  await attachFrame(page.mainFrame());
  const checkpoint=()=>{activeEvidence=null;return {rawConsoleErrors:rawConsoleErrors.length,pageErrors:pageErrors.length,nativeEntries:nativeEntries.length,advisories:advisories.length};};
  const snapshot=(start={rawConsoleErrors:0,pageErrors:0,nativeEntries:0,advisories:0})=>({schema:'qelly.first-paint.console-provenance/1.0',rawConsoleErrors:rawConsoleErrors.slice(start.rawConsoleErrors),pageErrors:pageErrors.slice(start.pageErrors),nativeEntries:nativeEntries.slice(start.nativeEntries),advisories:advisories.slice(start.advisories),attachmentErrors:[...attachmentErrors],rawErrorsRetained:true,policyChanged:false,browserFlagsChanged:false});
  return {
    checkpoint,
    async flush(start){
      activeEvidence=null;
      const marketWidgetState=await page.locator('#v6-market-tradingview').evaluateAll(nodes=>nodes.map(node=>({hostId:node.id,provider:node.dataset.externalProvider||null,usage:node.dataset.usage||null,state:node.dataset.externalState||null,fallbackVisible:Boolean(node.querySelector('.qelly-tradingview-fallback')),iframeSources:[...node.querySelectorAll('iframe')].map(frame=>frame.src)}))).catch(()=>[]);
      // Protocol barriers settle already-emitted evidence; no extra page waits.
      while(pending.size)await Promise.allSettled([...pending]);
      await Promise.allSettled([...sessions.values()].map(({session})=>session.send('Runtime.getIsolateId')));
      while(pending.size)await Promise.allSettled([...pending]);
      const unclassified=rawConsoleErrors.slice(classified).filter(item=>!item.resourceErrorHandledByExistingNetworkChecks);
      const result=correlateFirstPaintConsoleErrors(unclassified,nativeEntries);
      // Remove consumed native evidence from future matching without losing it.
      const consumedKeys=new Set(result.advisories.map(advisory=>nativeKey(advisory.nativeEntry)));
      for(const advisory of result.advisories){advisories.push(advisory);advisory.consoleError.classification='external_display_widget_blocked_unload';}
      for(const entry of nativeEntries)if(consumedKeys.has(nativeKey(entry)))entry.consumed=true;
      errors.splice(0,errors.length,...initialErrors,...errorRecords.filter(item=>item.classification!=='external_display_widget_blocked_unload').map(item=>item.text));
      classified=rawConsoleErrors.length;
      const evidence=snapshot(start);
      evidence.marketWidgetState=marketWidgetState;
      activeEvidence=evidence;
      return evidence;
    },
    async dispose(){
      disposed=true;
      page.off('frameattached',onFrame);page.off('framenavigated',onFrame);page.off('framedetached',onDetached);
      while(pending.size)await Promise.allSettled([...pending]);
      await Promise.allSettled([...sessions.values()].map(({session})=>session.detach()));
      sessions.clear();
    }
  };
}
