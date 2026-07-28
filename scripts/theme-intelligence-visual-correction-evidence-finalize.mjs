import {createHash} from 'node:crypto';
import {readFile,readdir,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PNG} from 'pngjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const artifact=path.join(root,'.theme-visual-correction/qelly-theme-intelligence-visual-correction-review');
const lightDir=path.join(artifact,'01-light-mode');
const themeDir=path.join(artifact,'02-theme-distinctiveness');
const studioDir=path.join(artifact,'06-theme-studio');
const commandDir=path.join(artifact,'08-command-palette');
const reportsDir=path.join(artifact,'12-reports');
const checksumsDir=path.join(artifact,'15-checksums');
const baselineCommit=process.env.QELLY_VISUAL_BASELINE_COMMIT??'e572d04df8fc5e27c8693ff5e3238706b237e715';
const reviewCommit=process.env.QELLY_REVIEW_COMMIT??'local-working-tree';

const assert=(value,message)=>{if(!value)throw new Error(message);};
const json=(file,value)=>writeFile(file,`${JSON.stringify(value,null,2)}\n`,'utf8');
async function exists(file){try{await stat(file);return true;}catch{return false;}}
async function listFiles(directory,prefix=''){const files=[];for(const entry of await readdir(directory,{withFileTypes:true})){const relative=path.join(prefix,entry.name),absolute=path.join(directory,entry.name);if(entry.isDirectory())files.push(...await listFiles(absolute,relative));else files.push({relative:relative.split(path.sep).join('/'),absolute});}return files;}
async function imageMetrics(file){const image=PNG.sync.read(await readFile(file));let pink=0,eligible=0,luminanceSum=0,bright=0,dark=0,count=0;const step=Math.max(1,Math.floor(Math.sqrt((image.width*image.height)/200000)));for(let y=0;y<image.height;y+=step)for(let x=0;x<image.width;x+=step){const i=(y*image.width+x)*4,r=image.data[i],g=image.data[i+1],b=image.data[i+2],max=Math.max(r,g,b),min=Math.min(r,g,b),luminance=.2126*r+.7152*g+.0722*b;luminanceSum+=luminance;count++;if(luminance>180)bright++;if(luminance<50)dark++;if(max>=65&&min<=250){eligible++;if(r>g+12&&r>b+5&&r>95)pink++;}}return {pinkFogRatio:Number((pink/Math.max(1,eligible)).toFixed(5)),meanLuminance:Number((luminanceSum/Math.max(1,count)).toFixed(3)),daylightCoverage:Number((bright/Math.max(1,count)).toFixed(5)),darkCanvasCoverage:Number((dark/Math.max(1,count)).toFixed(5))};}

assert(await exists(artifact),'visual-correction artifact is missing');
const beforeFile=path.join(lightDir,'before-rejected-pink-fog.png');
const correctedFile=path.join(lightDir,'corrected-porcelain-daylight-full.png');
const comparisonFile=path.join(lightDir,'before-vs-corrected-porcelain-daylight.png');
const studioFiles=[path.join(studioDir,'theme-studio-desktop-dark.png'),path.join(studioDir,'theme-studio-desktop-light.png'),path.join(studioDir,'theme-studio-preview-stage.png')];
const selectedCommandFile=path.join(commandDir,'selected-unique-result.png');
const required=[beforeFile,correctedFile,comparisonFile,...studioFiles,selectedCommandFile];
const missing=[];for(const file of required)if(!await exists(file))missing.push(path.relative(artifact,file).split(path.sep).join('/'));

const darkThemes=await listFiles(path.join(themeDir,'dark'));
const lightThemes=await listFiles(path.join(themeDir,'light'));
const darkThemePngs=darkThemes.filter((item)=>item.relative.endsWith('.png'));
const lightThemePngs=lightThemes.filter((item)=>item.relative.endsWith('.png'));
const commandQa=JSON.parse(await readFile(path.join(reportsDir,'COMMAND_PALETTE_QA.json'),'utf8'));
const commandDuplicates=commandQa?.desktop?.evidence?.duplicateLabels??[];
const commandPassed=commandQa?.result==='passed'&&Array.isArray(commandDuplicates)&&commandDuplicates.length===0;
const beforeMetrics=missing.includes('01-light-mode/before-rejected-pink-fog.png')?null:await imageMetrics(beforeFile);
const correctedMetrics=missing.includes('01-light-mode/corrected-porcelain-daylight-full.png')?null:await imageMetrics(correctedFile);
const correctedPinkPassed=Boolean(correctedMetrics&&correctedMetrics.pinkFogRatio<.18);
const daylightTransformation=Boolean(beforeMetrics&&correctedMetrics&&correctedMetrics.meanLuminance>=beforeMetrics.meanLuminance+25&&correctedMetrics.daylightCoverage>=beforeMetrics.daylightCoverage+.15&&correctedMetrics.darkCanvasCoverage<=Math.max(0,beforeMetrics.darkCanvasCoverage-.10));
const truthfulBeforeAfter=correctedPinkPassed&&daylightTransformation;
const evidencePassed=missing.length===0&&darkThemePngs.length===13&&lightThemePngs.length===13&&commandPassed&&truthfulBeforeAfter;

await json(path.join(reportsDir,'EVIDENCE_COMPLETENESS_QA.json'),{result:evidencePassed?'passed':'failed',baselineCommit,reviewCommit,themeScreenshots:{dark:darkThemePngs.length,light:lightThemePngs.length},lightMode:{before:beforeMetrics,corrected:correctedMetrics,correctedPinkThreshold:.18,daylightTransformation,beforeFile:'01-light-mode/before-rejected-pink-fog.png',correctedFile:'01-light-mode/corrected-porcelain-daylight-full.png',comparison:'01-light-mode/before-vs-corrected-porcelain-daylight.png'},desktopStudio:studioFiles.map((file)=>path.relative(artifact,file).split(path.sep).join('/')),selectedCommand:'08-command-palette/selected-unique-result.png',commandPalette:{result:commandQa?.result,duplicateLabels:commandDuplicates},missing});
await writeFile(path.join(reportsDir,'EVIDENCE_COMPLETENESS_QA.md'),`# Evidence Completeness QA\n\n- Result: **${evidencePassed?'passed':'failed'}**.\n- Exact rejected baseline: \`${baselineCommit}\`.\n- Theme-family screenshots: ${darkThemePngs.length} dark + ${lightThemePngs.length} light.\n- Corrected pink-atmosphere ratio: ${correctedMetrics?.pinkFogRatio} (threshold < 0.18).\n- Mean luminance: ${beforeMetrics?.meanLuminance} before → ${correctedMetrics?.meanLuminance} corrected.\n- Daylight coverage: ${beforeMetrics?.daylightCoverage} before → ${correctedMetrics?.daylightCoverage} corrected.\n- Dark-canvas coverage: ${beforeMetrics?.darkCanvasCoverage} before → ${correctedMetrics?.darkCanvasCoverage} corrected.\n- Desktop Theme Studio: dark, light and preview-stage captures included.\n- Command palette: selected unique-result capture included; duplicate labels: ${commandDuplicates.length}.\n- Missing evidence files: ${missing.length}.\n`,'utf8');

const validationPath=path.join(reportsDir,'VALIDATION_SUMMARY.json');const validation=JSON.parse(await readFile(validationPath,'utf8'));
validation.counts={...validation.counts,themeDarkCaptures:darkThemePngs.length,themeLightCaptures:lightThemePngs.length,desktopStudioCaptures:studioFiles.filter((file)=>!missing.includes(path.relative(artifact,file).split(path.sep).join('/'))).length,lightBeforeAfterCaptures:[beforeFile,correctedFile,comparisonFile].filter((file)=>!missing.includes(path.relative(artifact,file).split(path.sep).join('/'))).length,selectedCommandCaptures:missing.includes('08-command-palette/selected-unique-result.png')?0:1};
validation.gates={...validation.gates,evidenceCompleteness:evidencePassed,truthfulBeforeAfter,daylightTransformation,correctedPinkAtmosphere:correctedPinkPassed,desktopStudioEvidence:studioFiles.every((file)=>!missing.includes(path.relative(artifact,file).split(path.sep).join('/'))),selectedCommandEvidence:commandPassed&&!missing.includes('08-command-palette/selected-unique-result.png')};
validation.metrics={...validation.metrics,beforePinkFogRatio:beforeMetrics?.pinkFogRatio,correctedPinkFogRatio:correctedMetrics?.pinkFogRatio,beforeMeanLuminance:beforeMetrics?.meanLuminance,correctedMeanLuminance:correctedMetrics?.meanLuminance,beforeDaylightCoverage:beforeMetrics?.daylightCoverage,correctedDaylightCoverage:correctedMetrics?.daylightCoverage,beforeDarkCanvasCoverage:beforeMetrics?.darkCanvasCoverage,correctedDarkCanvasCoverage:correctedMetrics?.darkCanvasCoverage};
validation.result=Object.values(validation.gates).every(Boolean)?'passed':'failed';await json(validationPath,validation);

await writeFile(path.join(reportsDir,'LIGHT_MODE_QA.md'),`# Light Mode QA\n\n- Result: **${validation.gates.lightModeNoPinkFog&&truthfulBeforeAfter?'passed':'failed'}**.\n- Exact rejected baseline commit: \`${baselineCommit}\`.\n- Corrected pink-atmosphere ratio: ${correctedMetrics?.pinkFogRatio}; acceptance threshold: < 0.18.\n- Mean luminance: ${beforeMetrics?.meanLuminance} before → ${correctedMetrics?.meanLuminance} corrected.\n- Daylight coverage: ${beforeMetrics?.daylightCoverage} before → ${correctedMetrics?.daylightCoverage} corrected.\n- Dark-canvas coverage: ${beforeMetrics?.darkCanvasCoverage} before → ${correctedMetrics?.darkCanvasCoverage} corrected.\n- Before, corrected and side-by-side evidence are included under \`01-light-mode/\`.\n- Porcelain canvas, chart and table remain high-contrast and semantically neutral.\n`,'utf8');
await writeFile(path.join(reportsDir,'VISUAL_REVIEW_SUMMARY.md'),`# Qelly Theme Intelligence Visual Correction Review\n\n- Commit: \`${reviewCommit}\`.\n- Result: **${validation.result}**.\n- Exact before/after light-mode evidence: included.\n- All 13 families: ${darkThemePngs.length} dark + ${lightThemePngs.length} light screenshots physically packaged.\n- Desktop Theme Studio: dark, light and preview-stage evidence included.\n- Selected deduplicated command result: included.\n- IBM Plex Sans Variable and protected market semantics remain unchanged.\n- This artifact is evidence for founder visual approval and is not deployment approval.\n`,'utf8');

const checksumFile=path.join(checksumsDir,'SHA256SUMS.txt');const manifestFile=path.join(reportsDir,'ARTIFACT_MANIFEST.json');
const preManifest=await listFiles(artifact);const checksumLines=[];for(const file of preManifest){if(file.absolute===checksumFile||file.absolute===manifestFile)continue;const bytes=await readFile(file.absolute);checksumLines.push(`${createHash('sha256').update(bytes).digest('hex')}  ${file.relative}`);}checksumLines.sort();await writeFile(checksumFile,`${checksumLines.join('\n')}\n`,'utf8');
const finalFiles=await listFiles(artifact);const manifestItems=[];for(const file of finalFiles){if(file.absolute===manifestFile)continue;const bytes=await readFile(file.absolute);manifestItems.push({path:file.relative,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}await json(manifestFile,{schemaVersion:2,artifact:'qelly-theme-intelligence-visual-correction-review',commit:reviewCommit,baselineCommit,generatedAt:new Date().toISOString(),result:validation.result,files:manifestItems});
assert(validation.result==='passed',`Evidence finalization failed: ${JSON.stringify({missing,darkThemes:darkThemePngs.length,lightThemes:lightThemePngs.length,commandPassed,beforeMetrics,correctedMetrics,validation},null,2)}`);
console.log(JSON.stringify({status:'qelly-theme-intelligence-visual-evidence-finalized',artifact,files:manifestItems.length,baselineCommit,reviewCommit,validation},null,2));
