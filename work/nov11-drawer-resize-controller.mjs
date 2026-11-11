import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const sources=['172eb87d5cd229a11eb751578fb26dfbe344b0db','3011438eb4fc891fdac98e249bebe336ee3307be'];
const source=process.env.QELLY_DRAWER_SOURCE_SHA;assert.ok(sources.includes(source));
const root=path.resolve(process.env.QELLY_DRAWER_SOURCE_ROOT),runner=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),hash=value=>createHash('sha256').update(value).digest('hex');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),source);
const sourceOwners={'scripts/qelly-feature-drawer-state-e2e.mjs':'95e44784cf751d067a5a815ef3a13d74c5e379b7','apps/web/public/assets/qelly-production-shell.mjs':'87465e2128d206e2acd053a49db42aeda5fd2cdf','apps/web/public/assets/qelly-production-shell.css':'0b6b4749143834cf5f21677cfe708265bfe796e6'};
for(const [file,blob] of Object.entries(sourceOwners))assert.equal(execFileSync('git',['rev-parse','HEAD:'+file],{cwd:root,encoding:'utf8'}).trim(),blob);
assert.equal(hash(await readFile(path.join(root,'scripts/qelly-feature-drawer-state-e2e.mjs'))),'124e3f30e5aadc623ebc718a6348957749a22d76f09faec126b9285a4ac3b819');
const diagnostic=path.join(runner,'work/nov11-drawer-resize-diagnostic.mjs');assert.equal(hash(await readFile(diagnostic)),'a1bd3630e6c487e06a94bcf65eea29ae92a121895c4bc52c1d4fb265c304c457');await copyFile(diagnostic,path.join(root,'scripts/nov11-drawer-resize-diagnostic.mjs'));
const browser=execFileSync('/usr/bin/chromium',['--version'],{encoding:'utf8'}).trim();assert.match(browser,/158\.0\.8127\.18/);
const nodePlaywrightVersion=JSON.parse(await readFile(path.join(root,'node_modules/playwright/package.json'))).version;assert.equal(nodePlaywrightVersion,'1.63.0');
const out=path.join(root,'preview/pr642-drawer-resize-diagnostic');await mkdir(out,{recursive:true});const executions=[];
for(let repeat=1;repeat<=3;repeat++){
  const child=spawnSync(process.execPath,['scripts/nov11-drawer-resize-diagnostic.mjs'],{cwd:root,env:{...process.env,QELLY_SCREEN_EVIDENCE_SHA:source,QELLY_DRAWER_DIAGNOSTIC_REPEAT:String(repeat)},encoding:'utf8',maxBuffer:4000000});if(child.error)throw child.error;assert.ok([0,1].includes(child.status));
  const directory=path.join(out,'repeat-'+repeat);await writeFile(path.join(directory,'strict-child-console.log'),(child.stdout||'')+(child.stderr||''));
  let report=null,failure=null,trace=null,reportBytes=null,failureBytes=null;
  try{reportBytes=await readFile(path.join(directory,'report.json'));report=JSON.parse(reportBytes);}catch{}
  try{failureBytes=await readFile(path.join(directory,'failure.json'));failure=JSON.parse(failureBytes);trace=JSON.parse(await readFile(path.join(directory,'trace.json')));}catch{}
  if(child.status===0){assert.equal(report.status,'passed');assert.equal(report.sourceSha,source);assert.equal(report.cases,8);assert.equal(report.results.length,8);}else assert.ok(failure&&trace);
  executions.push({repeat,strictExit:child.status,strictStatus:child.status===0?'passed':'failed',completedCases:report?.results.length??null,reportSha256:reportBytes?hash(reportBytes):null,failureSha256:failureBytes?hash(failureBytes):null,failure:failure?.message??null,failureStack:failure?.stack??null,failureWidth:trace?.width??null,firstFailureTimelineEvents:trace?.events?.length??null,originalAssertionsPreserved:true});
}
assert.equal(hash(await readFile(path.join(root,'scripts/qelly-feature-drawer-state-e2e.mjs'))),'124e3f30e5aadc623ebc718a6348957749a22d76f09faec126b9285a4ac3b819');
const receipt={schema:'qelly.nov11.drawer-resize-diagnostic/1.0',source,diagnosticHead:process.env.GITHUB_SHA,browser,nodePlaywrightVersion,sourceOwners,executions,maxExecutions:3,contextsPerExecution:8,strictScriptUnchanged:true,allOriginalAssertionsPreserved:true,readOnlyTimelineInstrumentation:true,productionSourceChanged:false,policyChanged:false,browserFlagsChanged:false,collectionComplete:true,productionAcceptanceGranted:false,boundary:'Bounded172/301 historical-source comparison with identical drawer test and product owners. Each original strict failure is retained separately. Observers only record state; collection success does not certify drawer, first-paint, fullBrowser or production acceptance. Timing instrumentation can perturb scheduling, so causality requires the actual event trace.',recordedAt:new Date().toISOString()};
await writeFile(path.join(out,'collector-status.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
