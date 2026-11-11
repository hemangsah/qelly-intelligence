import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
const candidate='3011438eb4fc891fdac98e249bebe336ee3307be';
const source=path.resolve(process.env.QELLY_FIRST_PAINT_SOURCE_ROOT),runner=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=value=>createHash('sha256').update(value).digest('hex');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(),candidate);
const expected={
  'scripts/first-paint-console-provenance.mjs':'d1b047678c271649cf8eda71761d1e4c3a1b2acd17bc69557cf57f7af76b0341',
  'scripts/qelly-first-paint-stability.mjs':'3d6f91f8629898d41b387b3a5214d02c3aa5daa3e052fbdf08a4045b7f7b73e7',
  'tests/first-paint-console-provenance.test.mjs':'7ebfc50e2e294681e18791817cfe1791f78ab33833a0ca0a869fcf86c012c6d9',
  'tests/qelly-scientific-wave-bp-route-chaos-stability.test.mjs':'1574c5f7b28fd0230c48daa790ae14338b6e67525757296bb5102d4288af601d',
  'tests/qelly-scientific-wave-bp-route-chaos.test.mjs':'99fca11df914915504bc235aceb6a74dcec636c9b42ac42a3d51f1937adf417b'
};
for(const [file,sha] of Object.entries(expected))assert.equal(hash(await readFile(path.join(source,file))),sha);
for(const [file,sha] of [
  ['pr642-lifecycle-console-provenance.mjs','cf295a5baea5b8479b8adb177bb9294551121b3df61fd7f76d99b2a9bcf212fd'],
  ['pr642-lifecycle-first-paint.mjs','ca304d0c3a31764585bcb48d5e529a12eede387f2111c9b81fbe62235417d798']
]){const local=path.join(runner,'work',file);assert.equal(hash(await readFile(local)),sha);await copyFile(local,path.join(source,'scripts',file));}
const browserVersion=execFileSync('/usr/bin/chromium',['--version'],{encoding:'utf8'}).trim();assert.match(browserVersion,/158\.0\.8127\.18/);
const child=spawnSync(process.execPath,['scripts/pr642-lifecycle-first-paint.mjs'],{cwd:source,env:{...process.env,QELLY_SCREEN_EVIDENCE_SHA:candidate},encoding:'utf8',maxBuffer:10000000});if(child.error)throw child.error;assert.ok([0,1].includes(child.status));
const output=path.join(source,'preview/pr642-frame-lifecycle');await writeFile(path.join(output,'strict-child-console.log'),(child.stdout||'')+(child.stderr||''));
const bytes=await readFile(path.join(output,'first-paint-stability.json')),report=JSON.parse(bytes);assert.equal(report.releaseSha,candidate);assert.equal(report.browserVersion,'158.0.8127.18');assert.equal(report.scenarios.length,4);
for(const viewport of ['desktop','mobile'])for(const mode of ['cold','warm']){
  const rows=report.scenarios.filter(row=>row.route==='market'&&row.viewport===viewport&&row.mode===mode);assert.equal(rows.length,1);assert.equal(rows[0].frames.length,8);
  const lifecycle=rows[0].consoleProvenance.lifecycle;assert.equal(lifecycle.diagnosticOnly,true);assert.equal(lifecycle.historicalOwnershipUsedForClassification,false);
  assert.ok(lifecycle.events.some(event=>event.type==='navigationOwnerCheckpointStart'&&event.label===mode));assert.ok(lifecycle.events.some(event=>event.type==='navigationOwnerCheckpointComplete'&&event.label===mode));
}
assert.equal(child.status===0,report.status==='passed');
for(const [file,sha] of Object.entries(expected))assert.equal(hash(await readFile(path.join(source,file))),sha,'candidate source was never overwritten');
const receipt={schema:'qelly.pr642.frame-lifecycle-attribution/1.0',candidateHead:candidate,diagnosticHead:process.env.GITHUB_SHA,browserVersion,sourceBindings:expected,contexts:4,originalFullSuiteScenarios:20,strictChildExit:child.status,strictReportStatus:report.status,reportSha256:hash(bytes),reportBytes:bytes.length,collectionComplete:true,candidateSourceChanged:false,productionPolicyChanged:false,browserFlagsChanged:false,historicalOwnershipUsedForClassification:false,nullOwnerStillFatal:true,fullSuiteAcceptanceGranted:false,scenarios:report.scenarios.map(row=>({viewport:row.viewport,mode:row.mode,status:row.status,errors:row.errors,rawPolicyEvents:row.consoleProvenance.nativeEntries.filter(entry=>entry.text==='Permissions policy violation: unload is not allowed in this document.').length,advisories:row.consoleProvenance.advisories.length,lifecycleEventCount:row.consoleProvenance.lifecycle.events.length})),boundary:'Read-only lifecycle attribution on explicit diagnostic-only copies of the helper and four-Market-context runner. Candidate301 source and strict null-owner predicate remain unchanged. Prior owner verification is recorded but never used to accept an error. Collection success does not grant first-paint or production acceptance.',recordedAt:new Date().toISOString()};
await writeFile(path.join(output,'collector-status.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
