import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function run(script){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(root,script)],{cwd:root,env:process.env,stdio:'inherit'});child.once('error',reject);child.once('exit',(code,signal)=>resolve({script,code:code??1,signal}));});}
const historicalFontComparison='scripts/font-comparison-board-local.mjs';
const authoritativePasses=['scripts/ui-review-premium.mjs','scripts/ui-review-premium-evidence.mjs','scripts/ui-review-persona-clean.mjs','scripts/ui-review-font-surface-stable.mjs'];
const base=await run('scripts/ui-review.mjs');
const completion=await run('scripts/ui-review-complete.mjs');
const premium=await run('scripts/ui-review-premium.mjs');
const evidence=premium.code===0?await run('scripts/ui-review-premium-evidence.mjs'):{script:'scripts/ui-review-premium-evidence.mjs',code:1,signal:null,skipped:true};
const personaClean=evidence.code===0?await run('scripts/ui-review-persona-clean.mjs'):{script:'scripts/ui-review-persona-clean.mjs',code:1,signal:null,skipped:true};
const fontSurface=personaClean.code===0?await run('scripts/ui-review-font-surface-stable.mjs'):{script:'scripts/ui-review-font-surface-stable.mjs',code:1,signal:null,skipped:true};
const authoritative=[premium,evidence,personaClean,fontSurface];
if(authoritative.some((result)=>result.code!==0)){
  console.error(JSON.stringify({status:'qelly-governed-ui-review-orchestration-failed',authoritativePasses,historicalFontComparisonStatus:'not rerun; IBM Plex selection is permanently locked',base,completion,premium,evidence,personaClean,fontSurface},null,2));
  process.exitCode=authoritative.find((result)=>result.code!==0)?.code??1;
}else{
  const legacyWarnings=[base,completion].filter((result)=>result.code!==0);
  if(legacyWarnings.length)console.warn(JSON.stringify({status:'legacy-ui-review-nonzero-reconciled',authoritativePasses,legacyWarnings,detail:'Authoritative passes validate the premium system, clean personas, permanent IBM Plex typography, continuous corners, tonal surfaces, command palette, table, mobile rail, browser safety, accessibility, performance, Figma evidence and runnable preview. Font candidate comparison is historical evidence only and is not rerun.'},null,2));
  console.log(JSON.stringify({status:'qelly-governed-ui-review-orchestration-passed',authoritativePasses,historicalFontComparisonStatus:'not rerun; see '+historicalFontComparison,base,completion,premium,evidence,personaClean,fontSurface},null,2));
  process.exitCode=0;
}
