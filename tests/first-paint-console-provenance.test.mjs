import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {BLOCKED_UNLOAD_MESSAGE,isMarketDisplayWidgetUnloadAdvisory,correlateFirstPaintConsoleErrors,attachFirstPaintConsoleProvenance} from '../scripts/first-paint-console-provenance.mjs';

// Shapes and source/stack coordinates were observed in the strict Chromium158
// diagnostic42928544937, not manufactured by the classifier implementation.
const bundle='https://www.tradingview-widget.com/static/bundles/embed/51676.9e0a05802fc2e56fe933.js';
const frame='https://www.tradingview-widget.com/embed-widget/advanced-chart/?locale=en#fixture';
const fixture=()=>({
  error:{kind:'console',at:1000,type:'error',text:BLOCKED_UNLOAD_MESSAGE,location:{url:bundle,lineNumber:9,columnNumber:0},argumentCount:0,owningFrameURL:null,topPageURL:'http://127.0.0.1:1234/#/market'},
  native:{at:1001,timestamp:1794355551590,frameToken:'frame-2',sessionIsMainFrame:false,sessionFrameURL:frame,source:'violation',level:'error',text:BLOCKED_UNLOAD_MESSAGE,url:bundle,lineNumber:9,frameOwner:{verified:true,hostId:'v6-market-tradingview',provider:'tradingview',usage:'display-only',elementTag:'IFRAME',iframeSrc:frame,frameURL:frame},stackTrace:{callFrames:[{functionName:'r',url:bundle,lineNumber:9,columnNumber:1177},{functionName:'_instantiatePushStream',url:bundle,lineNumber:4,columnNumber:2990}]}}
});

test('observed native blocked-unload evidence is retained as a narrow advisory',()=>{
  const {error,native}=fixture();
  const result=correlateFirstPaintConsoleErrors([error],[native]);
  assert.equal(isMarketDisplayWidgetUnloadAdvisory(error,native),true);
  assert.equal(result.advisories.length,1);assert.deepEqual(result.fatal,[]);
  assert.equal(result.advisories[0].consoleError,error);assert.equal(result.advisories[0].nativeEntry,native);
});

const negativeCases=[
  ['first-party console error with the same text',({error})=>{error.argumentCount=1;error.owningFrameURL='http://127.0.0.1:1234/#/market';}],
  ['spoofed vendor sourceURL still has a first-party execution frame',({error})=>{error.owningFrameURL='http://127.0.0.1:1234/#/market';}],
  ['first-party script URL',({error,native})=>{error.location.url=native.url='http://127.0.0.1:1234/assets/app.mjs';}],
  ['missing console source URL',({error})=>{delete error.location.url;}],
  ['missing console line',({error})=>{delete error.location.lineNumber;}],
  ['missing native frame URL',({native})=>{delete native.sessionFrameURL;}],
  ['missing native frame token',({native})=>{delete native.frameToken;}],
  ['main-frame native violation',({native})=>{native.sessionIsMainFrame=true;}],
  ['missing main-frame exclusion',({native})=>{delete native.sessionIsMainFrame;}],
  ['non-chart vendor iframe',({native})=>{native.sessionFrameURL='https://www.tradingview-widget.com/embed-widget/ticker-tape/';}],
  ['lookalike host',({error})=>{error.location.url=error.location.url.replace('www.tradingview-widget.com','www.tradingview-widget.com.evil.test');}],
  ['unapproved vendor host',({error})=>{error.location.url=error.location.url.replace('www.tradingview-widget.com','tradingview-widget.com');}],
  ['insecure URL',({error})=>{error.location.url=error.location.url.replace('https:','http:');}],
  ['credential-bearing URL',({error})=>{error.location.url=error.location.url.replace('https://','https://user@');}],
  ['unapproved port',({error})=>{error.location.url=error.location.url.replace('.com/','.com:8443/');}],
  ['unrelated vendor bundle',({error})=>{error.location.url='https://www.tradingview-widget.com/static/bundles/arbitrary.js';}],
  ['source URL query',({error})=>{error.location.url+='?injected=1';}],
  ['missing native source',({native})=>{delete native.source;}],
  ['console-api error rather than native violation',({native})=>{native.source='console-api';}],
  ['different native level',({native})=>{native.level='warning';}],
  ['other blocked policy',({error,native})=>{error.text=native.text='Permissions policy violation: geolocation is not allowed in this document.';}],
  ['other message from the same widget',({error,native})=>{error.text=native.text='Widget failed to initialize';}],
  ['near-match unload message',({error,native})=>{error.text=native.text=BLOCKED_UNLOAD_MESSAGE+' extra';}],
  ['pageerror is always fatal',({error})=>{error.kind='pageerror';}],
  ['missing argument count',({error})=>{delete error.argumentCount;}],
  ['native and console text differ',({native})=>{native.text+=' extra';}],
  ['native and console source differ',({native})=>{native.url=native.url.replace('51676.','51677.');}],
  ['native and console line differ',({native})=>{native.lineNumber=10;}],
  ['outside correlation window',({native})=>{native.at=1251;}],
  ['missing receipt time',({error})=>{delete error.at;}],
  ['missing native timestamp',({native})=>{delete native.timestamp;}],
  ['missing verified iframe owner',({native})=>{delete native.frameOwner;}],
  ['unverified iframe owner',({native})=>{native.frameOwner.verified=false;}],
  ['different widget owner',({native})=>{native.frameOwner.hostId='other-market-widget';}],
  ['different provider',({native})=>{native.frameOwner.provider='other';}],
  ['missing display-only usage',({native})=>{delete native.frameOwner.usage;}],
  ['non-iframe owner',({native})=>{native.frameOwner.elementTag='DIV';}],
  ['missing iframe source',({native})=>{delete native.frameOwner.iframeSrc;}],
  ['unapproved owned frame URL',({native})=>{native.frameOwner.frameURL='https://example.com/';}],
  ['owner changed after native event',({native})=>{native.frameOwner.frameURL=frame+'-navigated';}],
  ['missing native stack',({native})=>{delete native.stackTrace;}],
  ['stack includes first-party code',({native})=>{native.stackTrace.callFrames.push({url:'http://127.0.0.1:1234/assets/app.mjs',lineNumber:9});}],
  ['stack has no matching source line',({native})=>{native.stackTrace.callFrames[0].lineNumber=10;}]
];
for(const [name,mutate] of negativeCases)test('fatal: '+name,()=>{
  const values=fixture();mutate(values);
  assert.equal(isMarketDisplayWidgetUnloadAdvisory(values.error,values.native),false);
  const result=correlateFirstPaintConsoleErrors([values.error],[values.native]);
  assert.equal(result.advisories.length,0);assert.deepEqual(result.fatal,[values.error]);
});

test('same-text error with no native evidence fails',()=>{
  const {error}=fixture();assert.deepEqual(correlateFirstPaintConsoleErrors([error],[]).fatal,[error]);
});
test('a native entry can excuse only one console error',()=>{
  const {error,native}=fixture();const other={...error};
  const result=correlateFirstPaintConsoleErrors([error,other],[native]);
  assert.equal(result.advisories.length,1);assert.deepEqual(result.fatal,[other]);
});
test('duplicate protocol delivery cannot excuse an extra error',()=>{
  const {error,native}=fixture();const other={...error};
  const result=correlateFirstPaintConsoleErrors([error,other],[native,{...native,at:1002}]);
  assert.equal(result.advisories.length,1);assert.deepEqual(result.fatal,[other]);
});
test('consumed evidence cannot excuse a later error',()=>{
  const {error,native}=fixture();native.consumed=true;
  assert.deepEqual(correlateFirstPaintConsoleErrors([error],[native]).fatal,[error]);
});
test('ambiguous native matches across iframe targets fail',()=>{
  const {error,native}=fixture();const other={...native,frameToken:'frame-3'};
  const result=correlateFirstPaintConsoleErrors([error],[native,other]);
  assert.deepEqual(result.fatal,[error]);assert.equal(result.advisories.length,0);
});
test('two separately observed native stacks excuse exactly two errors',()=>{
  const {error,native}=fixture();const other=structuredClone(native);other.stackTrace.callFrames[1].columnNumber=409;
  const result=correlateFirstPaintConsoleErrors([error,{...error}],[native,other]);
  assert.equal(result.advisories.length,2);assert.equal(result.fatal.length,0);
});

function collectorFixture(){
  const page=new EventEmitter(),main={url:()=>page.url()},sessions=new Map();
  let childURL='about:blank',childDetached=false,failLookup=false;
  const host={id:'v6-market-tradingview',dataset:{externalProvider:null,usage:null},contains:()=>true};
  const node={tagName:'IFRAME',src:'about:blank',closest:()=>host};
  const child={url:()=>childURL,isDetached:()=>childDetached,frameElement:async()=>{if(failLookup)throw new Error('frame.frameElement: Frame has been detached.');return{evaluate:async fn=>fn(node),dispose:async()=>{}};}};
  page.frames=()=>[main,child];page.mainFrame=()=>main;page.url=()=> 'http://127.0.0.1:1234/#/market';page.locator=()=>({evaluateAll:async()=>[]});
  const context={newCDPSession:async target=>{const session=new EventEmitter();session.send=async()=>({});session.detach=async()=>{};sessions.set(target,session);return session;}};
  const makeOwned=()=>{childURL=frame;node.src=frame;host.dataset.externalProvider='tradingview';host.dataset.usage='display-only';};
  const emitError=(text=BLOCKED_UNLOAD_MESSAGE,url=bundle)=>page.emit('console',{type:()=> 'error',text:()=>text,args:()=>[],location:()=>({url,lineNumber:9})});
  const emitNative=()=>{const {native}=fixture();sessions.get(child).emit('Log.entryAdded',{entry:{...native,timestamp:Date.now()}});};
  return {page,context,child,host,sessions,makeOwned,emitError,emitNative,failLookup:()=>{failLookup=true;},detachChild:()=>{childDetached=true;page.emit('framedetached',child);}};
}
test('collector retains raw evidence and never reuses a native event across flushes',async()=>{
  const f=collectorFixture(),errors=[];const collector=await attachFirstPaintConsoleProvenance(f.page,f.context,errors);
  f.makeOwned();f.page.emit('frameattached',f.child);await collector.flush();
  f.emitError();f.emitNative();const first=await collector.flush();
  assert.equal(first.rawConsoleErrors.length,1);assert.equal(first.nativeEntries.length,1);assert.equal(first.advisories.length,1);assert.equal(errors.length,0);
  f.emitError();const second=await collector.flush();
  assert.equal(second.rawConsoleErrors.length,2);assert.equal(second.advisories.length,1);assert.deepEqual(errors,[BLOCKED_UNLOAD_MESSAGE]);
  await collector.dispose();
});
test('collector verifies the event-time owner after successful about:blank attachment',async()=>{
  const f=collectorFixture(),errors=[];const collector=await attachFirstPaintConsoleProvenance(f.page,f.context,errors);
  f.page.emit('frameattached',f.child);await collector.flush();
  f.makeOwned();f.page.emit('framenavigated',f.child);f.emitError();f.emitNative();
  const evidence=await collector.flush();assert.equal(evidence.advisories.length,1);assert.deepEqual(errors,[]);
  assert.equal(evidence.advisories[0].nativeEntry.frameOwner.frameURL,frame);
  await collector.dispose();
});
test('a previously verified owner does not excuse a later unowned frame event',async()=>{
  const f=collectorFixture(),errors=[];const collector=await attachFirstPaintConsoleProvenance(f.page,f.context,errors);
  f.makeOwned();f.page.emit('frameattached',f.child);await collector.flush();
  f.emitError();f.emitNative();await collector.flush();
  f.host.id='unrelated-widget';f.emitError();f.emitNative();const evidence=await collector.flush();
  assert.equal(evidence.advisories.length,1);assert.deepEqual(errors,[BLOCKED_UNLOAD_MESSAGE]);
  await collector.dispose();
});
test('first-party and uncorrelated errors are fatal synchronously before any flush',async()=>{
  const f=collectorFixture(),errors=[];const collector=await attachFirstPaintConsoleProvenance(f.page,f.context,errors);
  f.emitError('first-party failure','http://127.0.0.1:1234/app.mjs');f.emitError();
  assert.deepEqual(errors,['first-party failure',BLOCKED_UNLOAD_MESSAGE]);
  const evidence=await collector.flush();assert.equal(evidence.rawConsoleErrors.length,2);assert.equal(evidence.advisories.length,0);
  await collector.dispose();
});
test('an error emitted during the final widget-state read is retained and fatal',async()=>{
  const f=collectorFixture(),errors=[];const collector=await attachFirstPaintConsoleProvenance(f.page,f.context,errors);
  f.page.locator=()=>({evaluateAll:async()=>{f.emitError('late widget-read error','http://127.0.0.1:1234/app.mjs');return[];}});
  const evidence=await collector.flush();
  assert.deepEqual(errors,['late widget-read error']);assert.equal(evidence.rawConsoleErrors.length,1);assert.equal(evidence.advisories.length,0);
  await collector.dispose();
});
test('late disposal errors remain fatal and update the retained raw evidence until page close',async()=>{
  const f=collectorFixture(),errors=[];const collector=await attachFirstPaintConsoleProvenance(f.page,f.context,errors);
  const evidence=await collector.flush();
  f.sessions.get(f.page).detach=async()=>{f.emitError('late disposal error','http://127.0.0.1:1234/app.mjs');};
  await collector.dispose();
  f.emitError();
  assert.deepEqual(errors,['late disposal error',BLOCKED_UNLOAD_MESSAGE]);assert.equal(evidence.rawConsoleErrors.length,2);assert.equal(evidence.advisories.length,0);
  f.page.emit('close');f.emitError('after page close');assert.equal(errors.length,2);
});

// Retiring-frame sequence is source-bound to lifecycle run42984854557:
// live physical owner check -> controlled reload -> native event -> detach ->
// exact failed owner lookup. No historical owner is reused outside that window.
const retiringFixture=()=>{
 const f=fixture();f.native.timestamp=1000;f.native.frameOwner=null;
 f.native.ownerLookup={owner:null,startedAt:1001,completedAt:1020,detachedBefore:false,detachedAfter:true,error:'frame.frameElement: Frame has been detached.'};
 f.native.retiringNavigationProof={schema:'qelly.first-paint.retiring-navigation/1.0',operation:'reload',navigationToken:'reload-1',succeeded:true,mainNavigations:1,ownerSnapshot:fixture().native.frameOwner,ownerVerifiedAt:990,navigationStartedAt:995,navigationCompletedAt:1030,pageURLBefore:'http://127.0.0.1:1234/#/market',pageURLAfter:'http://127.0.0.1:1234/#/market',frameToken:'frame-2',frameURL:frame,generationBefore:1,generationAtEvent:1,generationAfter:1,attachedAtEvent:true,frameDetachedAt:1015,mainNavigatedAt:1016};
 return f;
};
test('retiring owned frame retains its null live lookup and a bounded reload proof',()=>{
 const {error,native}=retiringFixture();assert.equal(isMarketDisplayWidgetUnloadAdvisory(error,native),true);assert.equal(native.frameOwner,null);
 assert.equal(correlateFirstPaintConsoleErrors([error],[native]).advisories.length,1);
});
const retiringNegatives=[
 ['missing proof',n=>delete n.retiringNavigationProof],['wrong schema',n=>n.retiringNavigationProof.schema='unknown'],
 ['not a reload',n=>n.retiringNavigationProof.operation='navigate'],['reload failed',n=>n.retiringNavigationProof.succeeded=false],
 ['no main navigation',n=>n.retiringNavigationProof.mainNavigations=0],['multiple main navigations',n=>n.retiringNavigationProof.mainNavigations=2],
 ['missing navigation token',n=>delete n.retiringNavigationProof.navigationToken],['changed top URL',n=>n.retiringNavigationProof.pageURLAfter+='-other'],
 ['missing both page URLs',n=>{delete n.retiringNavigationProof.pageURLBefore;delete n.retiringNavigationProof.pageURLAfter;}],['wrong page route',n=>{n.retiringNavigationProof.pageURLBefore=n.retiringNavigationProof.pageURLAfter='http://127.0.0.1:1234/#/decision-provenance';}],['negative generation',n=>{n.retiringNavigationProof.generationBefore=n.retiringNavigationProof.generationAtEvent=n.retiringNavigationProof.generationAfter=-1;}],['malformed navigation token',n=>n.retiringNavigationProof.navigationToken='not-a-reload'],
 ['wrong frame token',n=>n.retiringNavigationProof.frameToken='frame-3'],['wrong frame URL',n=>n.retiringNavigationProof.frameURL+='-other'],
 ['unowned snapshot',n=>n.retiringNavigationProof.ownerSnapshot.verified=false],['unrelated host',n=>n.retiringNavigationProof.ownerSnapshot.hostId='other'],
 ['wrong usage',n=>n.retiringNavigationProof.ownerSnapshot.usage='execution'],['not attached at event',n=>n.retiringNavigationProof.attachedAtEvent=false],
 ['child navigated before event',n=>n.retiringNavigationProof.generationAtEvent++],['child navigated after event',n=>n.retiringNavigationProof.generationAfter++],
 ['missing generation',n=>delete n.retiringNavigationProof.generationBefore],['missing detach time',n=>n.retiringNavigationProof.frameDetachedAt=null],
 ['stale owner',n=>n.retiringNavigationProof.ownerVerifiedAt=700],['event before reload',n=>n.retiringNavigationProof.navigationStartedAt=1002],
 ['delayed event',n=>n.retiringNavigationProof.navigationStartedAt=700],['event after detach',n=>n.retiringNavigationProof.frameDetachedAt=1000],
 ['delayed detach',n=>{n.retiringNavigationProof.frameDetachedAt=1300;n.retiringNavigationProof.navigationCompletedAt=1400;n.ownerLookup.completedAt=1310;}],
 ['unrelated main navigation',n=>n.retiringNavigationProof.mainNavigatedAt=700],['unfinished reload',n=>n.retiringNavigationProof.navigationCompletedAt=null],
 ['reload completed before detach',n=>n.retiringNavigationProof.navigationCompletedAt=1010],['different lookup error',n=>n.ownerLookup.error='Owner unavailable'],
 ['already detached at lookup',n=>n.ownerLookup.detachedBefore=true],['not detached after lookup',n=>n.ownerLookup.detachedAfter=false],
 ['missing lookup',n=>delete n.ownerLookup],['lookup preceded event',n=>n.ownerLookup.startedAt=999],
 ['lookup not complete after detach',n=>n.ownerLookup.completedAt=1010],['unbounded lookup',n=>n.ownerLookup.completedAt=1400],
 ['non-null unowned live lookup',n=>n.frameOwner={verified:false}],['future native timestamp',n=>n.timestamp=1002]
];
for(const[name,mutate]of retiringNegatives)test('retiring proof fails closed: '+name,()=>{
 const {error,native}=retiringFixture();mutate(native);assert.equal(isMarketDisplayWidgetUnloadAdvisory(error,native),false);
 assert.deepEqual(correlateFirstPaintConsoleErrors([error],[native]).fatal,[error]);
});
test('retiring native proof is still consumed exactly once',()=>{
 const {error,native}=retiringFixture();const result=correlateFirstPaintConsoleErrors([error,{...error}],[native]);
 assert.equal(result.advisories.length,1);assert.equal(result.fatal.length,1);
});
test('collector captures a current physical owner immediately before a controlled reload',async()=>{
 const f=collectorFixture(),errors=[],collector=await attachFirstPaintConsoleProvenance(f.page,f.context,errors);
 f.makeOwned();f.page.emit('frameattached',f.child);await collector.flush();
 await collector.observeReload(async()=>{f.failLookup();f.emitError();f.emitNative();f.detachChild();f.page.emit('framenavigated',f.page.mainFrame());});
 const evidence=await collector.flush();assert.deepEqual(errors,[]);assert.equal(evidence.advisories.length,1);
 assert.equal(evidence.nativeEntries[0].frameOwner,null);assert.equal(evidence.nativeEntries[0].retiringNavigationProof.operation,'reload');
 await collector.dispose();
});
test('collector never treats an unobserved detach as an owned reload',async()=>{
 const f=collectorFixture(),errors=[],collector=await attachFirstPaintConsoleProvenance(f.page,f.context,errors);
 f.makeOwned();f.page.emit('frameattached',f.child);await collector.flush();f.failLookup();f.emitError();f.emitNative();f.detachChild();
 const evidence=await collector.flush();assert.deepEqual(errors,[BLOCKED_UNLOAD_MESSAGE]);assert.equal(evidence.advisories.length,0);await collector.dispose();
});
test('collector rejects a previously owned frame when its pre-reload owner is unrelated',async()=>{
 const f=collectorFixture(),errors=[],collector=await attachFirstPaintConsoleProvenance(f.page,f.context,errors);
 f.makeOwned();f.page.emit('frameattached',f.child);await collector.flush();f.host.id='unrelated-widget';
 await collector.observeReload(async()=>{f.failLookup();f.emitError();f.emitNative();f.detachChild();f.page.emit('framenavigated',f.page.mainFrame());});
 const evidence=await collector.flush();assert.deepEqual(errors,[BLOCKED_UNLOAD_MESSAGE]);assert.equal(evidence.advisories.length,0);await collector.dispose();
});
test('collector rejects a child navigation inside a controlled reload window',async()=>{
 const f=collectorFixture(),errors=[],collector=await attachFirstPaintConsoleProvenance(f.page,f.context,errors);
 f.makeOwned();f.page.emit('frameattached',f.child);await collector.flush();
 await collector.observeReload(async()=>{f.page.emit('framenavigated',f.child);f.failLookup();f.emitError();f.emitNative();f.detachChild();f.page.emit('framenavigated',f.page.mainFrame());});
 const evidence=await collector.flush();assert.deepEqual(errors,[BLOCKED_UNLOAD_MESSAGE]);assert.equal(evidence.advisories.length,0);await collector.dispose();
});
test('a rejected reload never grants a retiring-frame advisory',async()=>{
 const f=collectorFixture(),errors=[],collector=await attachFirstPaintConsoleProvenance(f.page,f.context,errors);
 f.makeOwned();f.page.emit('frameattached',f.child);await collector.flush();
 await assert.rejects(collector.observeReload(async()=>{f.failLookup();f.emitError();f.emitNative();f.detachChild();f.page.emit('framenavigated',f.page.mainFrame());throw new Error('reload failed');}));
 const evidence=await collector.flush();assert.deepEqual(errors,[BLOCKED_UNLOAD_MESSAGE]);assert.equal(evidence.advisories.length,0);await collector.dispose();
});
