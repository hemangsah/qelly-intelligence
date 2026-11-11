// Test-harness evidence only. No page policy, flags, listeners or runtime are changed.
export const BLOCKED_UNLOAD_MESSAGE='Permissions policy violation: unload is not allowed in this document.';
const VENDOR_ORIGIN='https://www.tradingview-widget.com';
export const CONSOLE_CORRELATION_WINDOW_MS=250;
const parseURL=value=>{try{return new URL(value);}catch{return null;}};
const vendorURL=value=>{const url=parseURL(value);return url&&url.origin===VENDOR_ORIGIN&&!url.username&&!url.password?url:null;};
const chartURL=value=>vendorURL(value)?.pathname==='/embed-widget/advanced-chart/';
const bundleURL=value=>{const url=vendorURL(value);return Boolean(url&&!url.search&&!url.hash&&/^\/static\/bundles\/embed\/\d+\.[a-f0-9]+\.js$/.test(url.pathname));};
const ownedChart=(owner,url)=>owner?.verified===true&&owner.hostId==='v6-market-tradingview'&&owner.provider==='tradingview'&&owner.usage==='display-only'&&owner.elementTag==='IFRAME'&&chartURL(owner.iframeSrc)&&owner.frameURL===url;
// Only an immediately verified, controlled reload can attest a retiring frame.
// The event-time lookup remains null in the raw record; it is never overwritten
// by an old owner. Unknown ownership or any other lookup failure stays fatal.
export function hasRetiringNavigationProof(entry){
  const p=entry?.retiringNavigationProof,l=entry?.ownerLookup;
  if(!p||p.schema!=='qelly.first-paint.retiring-navigation/1.0'||p.operation!=='reload'||p.succeeded!==true||p.mainNavigations!==1)return false;
  if(entry.frameOwner!==null||!l||l.error!=='frame.frameElement: Frame has been detached.'||l.detachedBefore!==false||l.detachedAfter!==true)return false;
  if(p.frameToken!==entry.frameToken||p.frameURL!==entry.sessionFrameURL||p.attachedAtEvent!==true||p.generationBefore!==p.generationAtEvent||p.generationBefore!==p.generationAfter)return false;
  const pageURL=parseURL(p.pageURLBefore);
  if(!Number.isInteger(p.generationBefore)||p.generationBefore<0||!/^reload-[1-9][0-9]*$/.test(p.navigationToken||'')||!pageURL||!['http:','https:'].includes(pageURL.protocol)||pageURL.username||pageURL.password||pageURL.hash!=='#/market'||p.pageURLBefore!==p.pageURLAfter||!ownedChart(p.ownerSnapshot,entry.sessionFrameURL))return false;
  const times=[p.ownerVerifiedAt,p.navigationStartedAt,entry.timestamp,entry.at,p.frameDetachedAt,p.mainNavigatedAt,p.navigationCompletedAt,l.startedAt,l.completedAt];
  if(!times.every(Number.isFinite))return false;
  if(p.ownerVerifiedAt>p.navigationStartedAt||p.navigationStartedAt>entry.timestamp||entry.timestamp>entry.at||entry.at>p.frameDetachedAt||p.frameDetachedAt>p.navigationCompletedAt)return false;
  if(p.navigationStartedAt-p.ownerVerifiedAt>250||entry.at-p.navigationStartedAt>250||p.frameDetachedAt-entry.at>250||Math.abs(p.mainNavigatedAt-p.frameDetachedAt)>250)return false;
  if(p.mainNavigatedAt<p.navigationStartedAt||p.mainNavigatedAt>p.navigationCompletedAt||l.startedAt<entry.at||l.completedAt<p.frameDetachedAt||l.completedAt-l.startedAt>250)return false;
  return true;
}
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
  if(!ownedChart(owner,nativeEntry.sessionFrameURL)&&!hasRetiringNavigationProof(nativeEntry))return false;
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
  const generations=new WeakMap(),retiringCandidates=new Map();
  let navigation=null,nextNavigation=0;
  const detached=frame=>{try{return frame.isDetached();}catch{return null;}};
  const generation=frame=>generations.get(frame)||0;
  let nextFrame=0,classified=0,disposed=false,activeEvidence=null;
  const track=promise=>{pending.add(promise);promise.finally(()=>pending.delete(promise)).catch(()=>{});return promise;};
  const tokenFor=frame=>{if(!frameTokens.has(frame))frameTokens.set(frame,'frame-'+(++nextFrame));return frameTokens.get(frame);};
  const readOwner=async frame=>{
    const lookup={owner:null,startedAt:Date.now(),completedAt:null,detachedBefore:detached(frame),detachedAfter:null,error:null};
    if(frame===page.mainFrame()){lookup.completedAt=Date.now();lookup.detachedAfter=detached(frame);return lookup;}
    let element;
    try{
      element=await frame.frameElement();
      const owner=await element.evaluate(node=>{
        const host=node.closest('#v6-market-tradingview');
        return {verified:Boolean(host&&host.contains(node)),hostId:host?.id||null,provider:host?.dataset.externalProvider||null,usage:host?.dataset.usage||null,elementTag:node.tagName,iframeSrc:node.src||null};
      });
      lookup.owner={...owner,frameURL:frame.url()};
    }catch(error){lookup.error=String(error?.message||error);}
    finally{lookup.completedAt=Date.now();lookup.detachedAfter=detached(frame);await element?.dispose().catch(()=>{});}
    return lookup;
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
          if(navigation?.owners.has(frame))retiringCandidates.set(native,{navigation,frame,snapshot:navigation.owners.get(frame),generationAtEvent:generation(frame),attachedAtEvent:detached(frame)===false});
          nativeEntries.push(native);
          activeEvidence?.nativeEntries.push(native);
          // Keep the actual event-time lookup, including a detach failure.
          track(readOwner(frame).then(lookup=>{native.frameOwner=lookup.owner;native.ownerLookup=lookup;}));
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
  const onNavigated=frame=>{
    generations.set(frame,generation(frame)+1);
    if(navigation&&frame===page.mainFrame())navigation.mainNavigations.push({at:Date.now(),url:frame.url()});
    onFrame(frame);
  };
  const onDetached=frame=>{
    if(navigation?.owners.has(frame))navigation.detached.set(frame,Date.now());
    const state=sessions.get(frame);sessions.delete(frame);if(state)track(state.session.detach().catch(()=>{}));
  };
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
  page.on('frameattached',onFrame);page.on('framenavigated',onNavigated);page.on('framedetached',onDetached);
  page.on('pageerror',onPageError);page.on('console',onConsole);
  page.once('close',()=>{page.off('pageerror',onPageError);page.off('console',onConsole);});
  await attachFrame(page.mainFrame());
  const checkpoint=()=>{activeEvidence=null;return {rawConsoleErrors:rawConsoleErrors.length,pageErrors:pageErrors.length,nativeEntries:nativeEntries.length,advisories:advisories.length};};
  const snapshot=(start={rawConsoleErrors:0,pageErrors:0,nativeEntries:0,advisories:0})=>({schema:'qelly.first-paint.console-provenance/1.0',rawConsoleErrors:rawConsoleErrors.slice(start.rawConsoleErrors),pageErrors:pageErrors.slice(start.pageErrors),nativeEntries:nativeEntries.slice(start.nativeEntries),advisories:advisories.slice(start.advisories),attachmentErrors:[...attachmentErrors],rawErrorsRetained:true,policyChanged:false,browserFlagsChanged:false});
  return {
    checkpoint,
    async observeReload(operation){
      if(navigation)throw new Error('Concurrent reload provenance is not supported');
      const n={token:'reload-'+(++nextNavigation),owners:new Map(),detached:new Map(),mainNavigations:[],pageURLBefore:page.url(),startedAt:null,completedAt:null,succeeded:false};
      for(const frame of page.frames()){
        if(frame===page.mainFrame())continue;
        const before=generation(frame),lookup=await readOwner(frame);
        if(lookup.detachedBefore===false&&lookup.detachedAfter===false&&before===generation(frame)&&ownedChart(lookup.owner,frame.url()))n.owners.set(frame,{owner:lookup.owner,verifiedAt:lookup.completedAt,frameToken:tokenFor(frame),frameURL:frame.url(),generation:before});
      }
      n.startedAt=Date.now();navigation=n;
      try{const value=await operation();n.succeeded=true;return value;}
      finally{n.completedAt=Date.now();n.pageURLAfter=page.url();navigation=null;}
    },
    async flush(start){
      activeEvidence=null;
      const marketWidgetState=await page.locator('#v6-market-tradingview').evaluateAll(nodes=>nodes.map(node=>({hostId:node.id,provider:node.dataset.externalProvider||null,usage:node.dataset.usage||null,state:node.dataset.externalState||null,fallbackVisible:Boolean(node.querySelector('.qelly-tradingview-fallback')),iframeSources:[...node.querySelectorAll('iframe')].map(frame=>frame.src)}))).catch(()=>[]);
      // Protocol barriers settle already-emitted evidence; no extra page waits.
      while(pending.size)await Promise.allSettled([...pending]);
      await Promise.allSettled([...sessions.values()].map(({session})=>session.send('Runtime.getIsolateId')));
      while(pending.size)await Promise.allSettled([...pending]);
      for(const [entry,candidate] of retiringCandidates){
        const {navigation:n,frame,snapshot:s}=candidate;
        entry.retiringNavigationProof={schema:'qelly.first-paint.retiring-navigation/1.0',operation:'reload',navigationToken:n.token,succeeded:n.succeeded,mainNavigations:n.mainNavigations.length,ownerSnapshot:s.owner,ownerVerifiedAt:s.verifiedAt,navigationStartedAt:n.startedAt,navigationCompletedAt:n.completedAt,pageURLBefore:n.pageURLBefore,pageURLAfter:n.pageURLAfter,frameToken:s.frameToken,frameURL:s.frameURL,generationBefore:s.generation,generationAtEvent:candidate.generationAtEvent,generationAfter:generation(frame),attachedAtEvent:candidate.attachedAtEvent,frameDetachedAt:n.detached.get(frame)??null,mainNavigatedAt:n.mainNavigations[0]?.at??null};
      }
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
      page.off('frameattached',onFrame);page.off('framenavigated',onNavigated);page.off('framedetached',onDetached);
      while(pending.size)await Promise.allSettled([...pending]);
      await Promise.allSettled([...sessions.values()].map(({session})=>session.detach()));
      sessions.clear();
    }
  };
}
