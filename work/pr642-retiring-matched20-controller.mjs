import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const base='172eb87d5cd229a11eb751578fb26dfbe344b0db',candidate='8bd628bc22572c4c3a85f62c8bdbc8450d8013ed';
const source=path.resolve(process.env.QELLY_FIRST_PAINT_SOURCE_ROOT),runner=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=body=>createHash('sha256').update(body).digest('hex');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(),candidate);
const sourceHashes={
  'scripts/first-paint-console-provenance.mjs':'5c4d7636a2bb8680de54c21ee7fa1c8b6ad362be5cb45ff9e2009a15496d0420',
  'scripts/qelly-first-paint-stability.mjs':'ebf6e241d594e7ce7458cbf64b60a4bb0c777d2ebbec625b465ebb80e1398bb9',
  'tests/first-paint-console-provenance.test.mjs':'1b689b2b6b32f75c4f67a0d465b55095add99864e9f8cda75f07ed281def1145',
  'tests/qelly-scientific-wave-bp-route-chaos-stability.test.mjs':'eee2abd811bb38ace45cada22e8acee81a9b3eb97c86245e8c66696eb0b1b69a',
  'tests/qelly-scientific-wave-bp-route-chaos.test.mjs':'cabb26a5c1147f1b17a7ea7e5401e70d31c07709ba783fcc274a2eb6aaa0e37b'
};
for(const [file,sha] of Object.entries(sourceHashes))assert.equal(hash(await readFile(path.join(source,file))),sha);
const diff=execFileSync('git',['diff','--name-only',base,candidate],{cwd:source,encoding:'utf8'}).trim().split('\n').sort();
assert.deepEqual(diff,Object.keys(sourceHashes).sort(),'exact five test-harness files, with every product/runtime path unchanged');
const childEnv={...process.env,QELLY_SCREEN_EVIDENCE_SHA:candidate};
const unit=spawnSync(process.execPath,['--test','--test-reporter=tap','tests/first-paint-console-provenance.test.mjs'],{cwd:source,env:childEnv,encoding:'utf8'});
const output=path.join(source,'preview/first-paint-stability');await mkdir(output,{recursive:true});
assert.equal(unit.status,0,unit.stdout+unit.stderr);
assert.match(unit.stdout,/^# tests 102$/m);assert.match(unit.stdout,/^# fail 0$/m);
const bp=spawnSync(process.execPath,['--test','--test-reporter=tap','--test-name-pattern=Wave BP measures heap|Wave BP monitors forced-GC','tests/qelly-scientific-wave-bp-route-chaos-stability.test.mjs','tests/qelly-scientific-wave-bp-route-chaos.test.mjs'],{cwd:source,env:childEnv,encoding:'utf8'});
assert.equal(bp.status,0,bp.stdout+bp.stderr);assert.match(bp.stdout,/^# pass 2$/m);
const browserVersion=execFileSync('/usr/bin/chromium',['--version'],{encoding:'utf8'}).trim();
assert.match(browserVersion,/158\.0\.8127\.18/,'exact actual failing browser is required');
const child=spawnSync(process.execPath,['scripts/qelly-first-paint-stability.mjs'],{cwd:source,env:childEnv,encoding:'utf8',maxBuffer:10000000});
if(child.error)throw child.error;
await writeFile(path.join(output,'focused-unit.tap'),unit.stdout);
await writeFile(path.join(output,'bp-reconciliation-unit.tap'),bp.stdout);
await writeFile(path.join(output,'strict-child-console.log'),(child.stdout||'')+(child.stderr||''));
const bytes=await readFile(path.join(output,'first-paint-stability.json')),report=JSON.parse(bytes);
assert.equal(report.releaseSha,candidate);assert.equal(report.browserVersion,'158.0.8127.18');assert.equal(report.scenarios.length,20);assert.deepEqual(report.samples,[0,100,250,500,1000,2000,4000,7000]);
for(const route of ['market','decision','calculator','india','asset'])for(const viewport of ['desktop','mobile'])for(const mode of ['cold','warm']){
  const rows=report.scenarios.filter(row=>row.route===route&&row.viewport===viewport&&row.mode===mode);assert.equal(rows.length,1);assert.equal(rows[0].frames.length,8);
  const evidence=rows[0].consoleProvenance;assert.equal(evidence.schema,'qelly.first-paint.console-provenance/1.0');assert.equal(evidence.rawErrorsRetained,true);assert.equal(evidence.policyChanged,false);assert.equal(evidence.browserFlagsChanged,false);
}
assert.equal(child.status===0,report.status==='passed');
const independentFailures=[];let independentAdvisories=0;
const require=(condition,label)=>{if(!condition)independentFailures.push(label);};
const exactText='Permissions policy violation: unload is not allowed in this document.';
const parsed=value=>{try{return new URL(value);}catch{return null;}};
const chart=value=>{const url=parsed(value);return Boolean(url&&url.protocol==='https:'&&url.hostname==='www.tradingview-widget.com'&&url.port===''&&!url.username&&!url.password&&url.pathname==='/embed-widget/advanced-chart/');};
const bundle=value=>{const url=parsed(value);return Boolean(url&&url.origin==='https://www.tradingview-widget.com'&&!url.username&&!url.password&&!url.search&&!url.hash&&/^\/static\/bundles\/embed\/\d+\.[a-f0-9]+\.js$/.test(url.pathname));};
const retiringProofValid=n=>{
 const p=n.retiringNavigationProof,l=n.ownerLookup;
 if(!p||!l||n.frameOwner!==null||p.schema!=='qelly.first-paint.retiring-navigation/1.0'||p.operation!=='reload'||p.succeeded!==true||p.mainNavigations!==1||!/^reload-[1-9][0-9]*$/.test(p.navigationToken||''))return false;
 const u=parsed(p.pageURLBefore),o=p.ownerSnapshot;
 if(!u||!['http:','https:'].includes(u.protocol)||u.username||u.password||u.hash!=='#/market'||p.pageURLBefore!==p.pageURLAfter)return false;
 if(!o?.verified||o.hostId!=='v6-market-tradingview'||o.provider!=='tradingview'||o.usage!=='display-only'||o.elementTag!=='IFRAME'||!chart(o.iframeSrc)||o.frameURL!==n.sessionFrameURL)return false;
 if(p.frameToken!==n.frameToken||p.frameURL!==n.sessionFrameURL||p.attachedAtEvent!==true||!Number.isInteger(p.generationBefore)||p.generationBefore<0||p.generationBefore!==p.generationAtEvent||p.generationBefore!==p.generationAfter)return false;
 if(l.error!=='frame.frameElement: Frame has been detached.'||l.detachedBefore!==false||l.detachedAfter!==true)return false;
 const t=[p.ownerVerifiedAt,p.navigationStartedAt,n.timestamp,n.at,p.frameDetachedAt,p.mainNavigatedAt,p.navigationCompletedAt,l.startedAt,l.completedAt];if(t.some(x=>!Number.isFinite(x)))return false;
 const [v,s,nt,a,d,m,e,ls,le]=t;
 return v<=s&&s<=nt&&nt<=a&&a<=d&&d<=e&&s-v<=250&&a-s<=250&&d-a<=250&&Math.abs(m-d)<=250&&s<=m&&m<=e&&a<=ls&&d<=le&&le-ls<=250;
};
const nativeKey=n=>JSON.stringify([n.frameToken,n.timestamp,n.url,n.lineNumber,n.stackTrace]);
for(const [label,row] of [...report.scenarios.map(row=>[row.route+'/'+row.viewport+'/'+row.mode,row]),['routeCycle',report.routeCycleStability],['decisionChaos',report.decisionChaosStability]]){
  const evidence=row.consoleProvenance;require(Boolean(evidence),label+': evidence');if(!evidence)continue;
  const raw=evidence.rawConsoleErrors.filter(error=>!/^Failed to load resource:/i.test(error.text)),usedConsole=new Set(),usedNative=new Set();
  for(const advisory of evidence.advisories){
    const c=advisory.consoleError,n=advisory.nativeEntry,owner=n.frameOwner;
    require(advisory.classification==='external_display_widget_blocked_unload',label+': classification');
    require(c.kind==='console'&&c.type==='error'&&c.text===exactText&&c.argumentCount===0&&bundle(c.location?.url),label+': exact native console');
    require(c.owningFrameURL===null||chart(c.owningFrameURL),label+': console execution frame');
    require(n.source==='violation'&&n.level==='error'&&n.text===exactText&&n.sessionIsMainFrame===false&&Boolean(n.frameToken)&&chart(n.sessionFrameURL),label+': non-main native origin');
    require(n.url===c.location.url&&n.lineNumber===(c.location.lineNumber??c.location.line)&&Math.abs(n.at-c.at)<=250&&Number.isFinite(n.timestamp),label+': exact bounded correlation');
    require((owner?.verified===true&&owner.hostId==='v6-market-tradingview'&&owner.provider==='tradingview'&&owner.usage==='display-only'&&owner.elementTag==='IFRAME'&&chart(owner.iframeSrc)&&owner.frameURL===n.sessionFrameURL)||retiringProofValid(n),label+': actual owned iframe or strictly proven retiring reload');
    const stack=n.stackTrace?.callFrames||[];require(stack.length>0&&stack.every(call=>bundle(call.url))&&stack.some(call=>call.url===n.url&&call.lineNumber===n.lineNumber),label+': external stack');
    const ci=raw.findIndex((item,index)=>!usedConsole.has(index)&&JSON.stringify(item)===JSON.stringify(c));require(ci>=0,label+': retained one-to-one raw console');usedConsole.add(ci);
    const ni=nativeKey(n);require(!usedNative.has(ni)&&evidence.nativeEntries.some(item=>nativeKey(item)===ni),label+': retained one-to-one native record');usedNative.add(ni);independentAdvisories++;
  }
  require((row.errors||[]).length===0,label+': no fatal error');require(evidence.pageErrors.length===0,label+': no pageerror');require(usedConsole.size===raw.length,label+': no unclassified dropped raw error');
  require(evidence.rawErrorsRetained===true&&evidence.policyChanged===false&&evidence.browserFlagsChanged===false,label+': no policy/flags change');
  if(row.route==='market'){
    require(evidence.advisories.length>0,label+': classifier actually exercised');const widget=evidence.marketWidgetState;
    require(widget.length===1&&widget[0].state==='display-only'&&!widget[0].fallbackVisible&&widget[0].iframeSources.length===1&&chart(widget[0].iframeSources[0]),label+': display widget ready without fallback');
  }else if(row.route)require(evidence.advisories.length===0,label+': no unrelated-route advisory');
}
const retiringEvents=report.scenarios.flatMap(row=>row.consoleProvenance.advisories.map(x=>x.nativeEntry)).filter(n=>n.frameOwner===null);
require(retiringEvents.length>=4,'both warm Market contexts must exercise retiring-frame proof');
const retiringInvalids=[
 ['missing proof',n=>delete n.retiringNavigationProof],['wrong token',n=>n.retiringNavigationProof.frameToken+='x'],['wrong owner',n=>n.retiringNavigationProof.ownerSnapshot.hostId='other'],['missing URL',n=>{delete n.retiringNavigationProof.pageURLBefore;delete n.retiringNavigationProof.pageURLAfter;}],['not a reload',n=>n.retiringNavigationProof.operation='navigate'],['failed reload',n=>n.retiringNavigationProof.succeeded=false],['child navigation',n=>n.retiringNavigationProof.generationAfter++],['already detached',n=>n.retiringNavigationProof.attachedAtEvent=false],['wrong lookup',n=>n.ownerLookup.error='different'],['missing detach',n=>n.retiringNavigationProof.frameDetachedAt=null],['stale owner',n=>n.retiringNavigationProof.ownerVerifiedAt-=1000],['unbounded detach',n=>n.retiringNavigationProof.frameDetachedAt+=1000],['unrelated main navigation',n=>n.retiringNavigationProof.mainNavigatedAt-=1000],['multiple main navigations',n=>n.retiringNavigationProof.mainNavigations++],['changed page URL',n=>n.retiringNavigationProof.pageURLAfter+='other'],['missing lookup',n=>delete n.ownerLookup]
];
let independentlyRejectedRetiringVariants=0;
if(retiringEvents[0])for(const[name,mutate]of retiringInvalids){const bad=structuredClone(retiringEvents[0]);mutate(bad);require(!retiringProofValid(bad),'retiring negative: '+name);independentlyRejectedRetiringVariants++;}
const receipt={schema:'qelly.first-paint.shared-harness-diagnostic/1.0',productionBase:base,candidateHead:candidate,diagnosticHead:process.env.GITHUB_SHA,browserVersion,nodePlaywrightVersion:JSON.parse(await readFile(path.join(source,'node_modules/playwright/package.json'))).version,pythonInstallerVersion:'1.65.0',sourceHashes,fullScenarioCount:20,strictChildExit:child.status,strictReportStatus:report.status,reportSha256:hash(bytes),reportBytes:bytes.length,unitTests:102,unitFailed:0,unitTapSha256:hash(unit.stdout),reconciledBPTestsPassed:2,bpTapSha256:hash(bp.stdout),routeCycleStatus:report.routeCycleStability?.status,decisionChaosStatus:report.decisionChaosStability?.status,retiringEventCount:retiringEvents.length,independentlyRejectedRetiringVariants,modeSpecificConsoleErrors:report.scenarios.reduce((sum,row)=>sum+row.consoleProvenance.rawConsoleErrors.length,0),modeSpecificAdvisories:report.scenarios.reduce((sum,row)=>sum+row.consoleProvenance.advisories.length,0),independentAdvisories,independentFailures,actionableScenarioErrors:report.scenarios.filter(row=>row.errors.length).map(row=>({route:row.route,viewport:row.viewport,mode:row.mode,errors:row.errors})),noProductRuntimeOrPolicyOrFlagsChanges:true,productionAcceptanceGranted:false,boundary:'This isolated cloud diagnostic checks unchanged PR642 exact head8bd and its five test-harness files without an overlay. Full20 scenarios, strict exit and all inherited assertions remain mandatory. Native warnings remain archived, separately attributed advisories. Performance comparisons are not causal claims. Production PR exact-head fullBrowser gates are still required.',recordedAt:new Date().toISOString()};
await writeFile(path.join(output,'shared-harness-diagnostic.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
assert.equal(child.status,0,'strict full20 first-paint child must pass');assert.equal(report.routeCycleStability?.status,'passed');assert.equal(report.decisionChaosStability?.status,'passed');assert.deepEqual(independentFailures,[]);
