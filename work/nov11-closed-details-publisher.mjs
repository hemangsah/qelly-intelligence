import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {hash} from './nov11-closed-details-source-fragments.mjs';
import {validateClosedDetailsPng} from './nov11-closed-details-png.mjs';
import {validateClosedDetailsNative} from './nov11-closed-details-native-validator.mjs';
const root=resolve(process.argv[2]||'.closed-details-evidence'),out=resolve(process.argv[3]||'preview/nov11-closed-details-publication');await mkdir(out,{recursive:true});
const safe=file=>{assert.match(file,/^(?:rows|frames|references)\/[a-z0-9-]+\.(?:json|png)$/);assert.ok(!file.includes('..'));const path=resolve(root,file);assert.ok(path.startsWith(root+sep));return path;};
let receipt;
try{
 const summary=JSON.parse(await readFile(resolve(root,'summary.json'),'utf8')),contract=JSON.parse(await readFile('work/nov11-closed-details-source-contract.json','utf8')),controls=JSON.parse(await readFile('outputs/QELLY_NOV11_CLOSED_DETAILS_VALIDATOR_CONTROLS.json','utf8'));
 assert.equal(controls.status,'local-acceptance-validator-controls-passed-not-browser-proof');assert.equal(controls.negativeVariantsRejected.length,22);assert.equal(controls.partialPositivePrefixCannotPass,true);
 for(const [path,expected] of Object.entries(contract.sourceBindings))assert.equal(hash(await readFile(path)),expected.sha256,'Independent publisher source bytes '+path);
 const expectedRows=summary.measurementStatus==='completed-prefix-rejection'?2:400;assert.equal(summary.rowFiles.length,expectedRows);assert.equal(new Set(summary.rowFiles).size,expectedRows);
 const rows=[];for(const file of summary.rowFiles)rows.push(JSON.parse(await readFile(safe(file),'utf8')));
 const readPng=async meta=>{assert.ok(meta.width<=1440&&meta.height<=900&&meta.width>0&&meta.height>0);const bytes=await readFile(safe(meta.file));assert.ok(bytes.length<=6000000);assert.equal(bytes.length,meta.bytes);return{sha256:hash(bytes),...validateClosedDetailsPng(bytes,{width:meta.width,height:meta.height})};};
 const proof=await validateClosedDetailsNative(summary,rows,{contract,expectedRunnerSha:process.env.EXPECTED_RUNNER_SHA,readPng});
 receipt={recordedAt:new Date().toISOString(),sourceSha:summary.sourceSha,runnerSha:summary.runnerSha,runId:Number(process.env.GITHUB_RUN_ID),publisherSha:process.env.GITHUB_SHA,status:proof.status,nativePolicyAccepted:proof.nativePolicyAccepted,proof,sourceCheckoutIndependentlyRevalidated:true,validatorNegativeControls:controls,fullRendererPhaseAccepted:false,productionAcceptance:false,allBulkFramesRemainInCloud:true,localDownloadsRequired:false};
}catch(error){receipt={recordedAt:new Date().toISOString(),status:'blocked-invalid-or-incomplete-diagnostic',nativePolicyAccepted:false,error:{message:error.message,stack:error.stack},fullRendererPhaseAccepted:false,productionAcceptance:false};}
await writeFile(out+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({status:receipt.status,nativePolicyAccepted:receipt.nativePolicyAccepted,fullRendererPhaseAccepted:false,productionAcceptance:false}));if(!receipt.nativePolicyAccepted)process.exitCode=1;
