import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {validateComparisonReport,comparisonExpectedImages,comparisonInvalidReports,validateComparisonPair} from './qelly-dex-source-comparison-report.mjs';
import {validateDexTypographyPng} from './qelly-dex-typography-png.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const [root,expected,source]=process.argv.slice(2);
if(expected==='pair'){
 const baseline=JSON.parse(await readFile(root+'/baseline/report.json','utf8')),candidate=JSON.parse(await readFile(root+'/candidate/report.json','utf8')),receipt=validateComparisonPair(baseline,candidate,source),negativePairs=[];
 const variations=[
  ['governed source note changed with consistent hash',r=>{r.initialSnapshots[0].payload.sources[0].note+=' changed';r.initialSnapshots[0].payloadHash=hash(JSON.stringify(r.initialSnapshots[0].payload));}],
  ['unselected governed source name changed with consistent hash',r=>{const selected=new Set(r.sourceComparisonResults[0].observed.map(row=>row.id));r.initialSnapshots[0].payload.sources.find(row=>!selected.has(String(row.id))).name+=' changed';r.initialSnapshots[0].payloadHash=hash(JSON.stringify(r.initialSnapshots[0].payload));}],
  ['existing form value changed',r=>r.initialSnapshots[0].legacy.form[0].value='changed'],
  ['existing source official destination changed',r=>r.initialSnapshots[0].legacy.sources.find(row=>row.official).official.href='https://example.invalid/changed']
 ];
 for(const[name,mutate]of variations){const bad=structuredClone(candidate);mutate(bad);validateComparisonReport(bad,source,'candidate');assert.throws(()=>validateComparisonPair(baseline,bad,source),name);negativePairs.push(name);}
 await writeFile(root+'/pair-receipt.json',JSON.stringify({...receipt,negativePairs},null,2)+'\n');console.log(JSON.stringify({paired:true,contextsPerArm:8,legacyAndGovernedEquality:true,negativePairs:negativePairs.length,productionAccepted:false}));process.exit(0);
}
assert.ok(['baseline','candidate'].includes(expected));assert.match(source,/^[a-f0-9]{40}$/);
const bytes=await readFile(root+'/report.json'),report=JSON.parse(bytes),validation=validateComparisonReport(report,source,expected),negativeVariants=[];
for(const[name,mutate]of comparisonInvalidReports(expected)){const bad=structuredClone(report);mutate(bad);assert.throws(()=>validateComparisonReport(bad,source,expected),name);negativeVariants.push(name);}
const expectedNames=comparisonExpectedImages(report),names=(await readdir(root)).filter(file=>/\.png$/i.test(file)).sort(),verifyNames=actual=>assert.deepEqual(actual.toSorted(),expectedNames);verifyNames(names);
const imageNegativeVariants=[];for(const[name,actual]of [['missing image',names.slice(1)],['unexpected image',[...names,'unexpected.png']]]){assert.throws(()=>verifyNames(actual),name);imageNegativeVariants.push(name);}
const screenshots=[];for(const image of report.captures){const bytes=await readFile(root+'/'+image.file),shape={width:image.widthPx,height:image.heightPx},decoded=validateDexTypographyPng(bytes,shape);assert.equal(hash(bytes),image.sha256);assert.equal(bytes.length,image.bytes);screenshots.push({file:image.file,sha256:hash(bytes),bytes:bytes.length,...decoded});if(screenshots.length===1){const corrupt=Buffer.from(bytes);corrupt[20]^=1;for(const[name,bad,dimensions]of [['truncated PNG',bytes.subarray(0,bytes.length-1),shape],['header without image',bytes.subarray(0,24),shape],['CRC damaged PNG',corrupt,shape],['wrong decoded dimensions',bytes,{...shape,width:shape.width+1}],['trailing PNG bytes',Buffer.concat([bytes,Buffer.from([0])]),shape]]){assert.throws(()=>validateDexTypographyPng(bad,dimensions),name);imageNegativeVariants.push(name);}}}
assert.equal(imageNegativeVariants.length,7);const receipt={schema:'qelly.dex.source-comparison-published/1.0',...validation,reportSha256:hash(bytes),negativeVariants,imageNegativeVariants,screenshots,productionAccepted:false,fullDexWaveAccepted:false};
if(process.argv.includes('--verify'))assert.deepEqual(JSON.parse(await readFile(root+'/independent-gate-receipt.json','utf8')),receipt);else await writeFile(root+'/independent-gate-receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({source,expected,contexts:8,images:screenshots.length,negativeReports:negativeVariants.length,negativeImages:imageNegativeVariants.length,independentPublishedVerification:process.argv.includes('--verify'),productionAccepted:false}));
