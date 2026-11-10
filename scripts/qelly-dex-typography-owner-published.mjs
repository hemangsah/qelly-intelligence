import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {validateDexTypographyOwnerReport,dexTypographyInvalidReports,dexTypographyExpectedCss,dexTypographyRendererSha,dexTypographyExpectedScreenshots} from './qelly-dex-typography-owner-report.mjs';
import {validateDexTypographyPng} from './qelly-dex-typography-png.mjs';

const [root,arm,sha]=process.argv.slice(2);assert.ok(['red','green'].includes(arm));assert.match(sha,/^[a-f0-9]{40}$/);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),bytes=await readFile(root+'/report.json'),r=JSON.parse(bytes);assert.equal(r.expected,arm);
const validation=validateDexTypographyOwnerReport(r,sha,dexTypographyExpectedCss[arm],dexTypographyRendererSha),negativeVariants=[];
for(const[name,mutate]of dexTypographyInvalidReports()){const bad=structuredClone(r);mutate(bad);assert.throws(()=>validateDexTypographyOwnerReport(bad,sha,dexTypographyExpectedCss[arm],dexTypographyRendererSha),name);negativeVariants.push(name);}
const expected=dexTypographyExpectedScreenshots(r),expectedNames=expected.map(x=>x.file).sort(),names=(await readdir(root)).filter(file=>/\.png$/i.test(file)).sort();
const verifyNames=actual=>assert.deepEqual(actual.toSorted(),expectedNames);verifyNames(names);assert.equal(names.length,64);
const imageNegativeVariants=[];for(const[name,actual]of[['missing screenshot',names.slice(1)],['unexpected screenshot',[...names,'unexpected.png']]]){assert.throws(()=>verifyNames(actual),name);imageNegativeVariants.push(name);}
const screenshots=[];
for(const spec of expected){
 const png=await readFile(root+'/'+spec.file),decoded=validateDexTypographyPng(png,spec);screenshots.push({file:spec.file,sha256:hash(png),...decoded});
 if(screenshots.length===1){
  const damaged=Buffer.from(png);damaged[20]^=1;
  for(const[name,bad,shape]of[['truncated PNG',png.subarray(0,png.length-1),spec],['false PNG header',png.subarray(0,24),spec],['PNG CRC damage',damaged,spec],['wrong PNG dimensions',png,{...spec,width:spec.width+1}],['trailing PNG bytes',Buffer.concat([png,Buffer.from([0])]),spec]]){assert.throws(()=>validateDexTypographyPng(bad,shape),name);imageNegativeVariants.push(name);}
 }
}
const receipt={...validation,arm,negativeVariants,imageNegativeVariants,reportSha256:hash(bytes),screenshots,productionAccepted:false,fullDexWaveAccepted:false};
if(process.argv.includes('--verify'))assert.deepEqual(JSON.parse(await readFile(root+'/independent-gate-receipt.json','utf8')),receipt);
else await writeFile(root+'/independent-gate-receipt.json',JSON.stringify(receipt)+'\n');
console.log({sourceSha:sha,arm,contexts:8,labels:validation.measuredLabels,controls:validation.controlMeasurements,sourceDisclosureCases:validation.sourceDisclosureCases,disclosureTextMeasurements:validation.disclosureTextMeasurements,minimumFont:validation.minimumFont,negativeVariants:negativeVariants.length,imageNegativeVariants:imageNegativeVariants.length,images:screenshots.length,independentlyPublishedVerification:process.argv.includes('--verify')});
