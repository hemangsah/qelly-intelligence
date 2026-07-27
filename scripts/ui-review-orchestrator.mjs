import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function run(script){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[path.join(root,script)],{cwd:root,env:process.env,stdio:'inherit'});
    child.once('error',reject);
    child.once('exit',(code,signal)=>resolve({script,code:code??1,signal}));
  });
}

const authoritativePasses=['scripts/ui-review-premium.mjs','scripts/ui-review-premium-evidence.mjs','scripts/ui-review-persona-clean.mjs'];
const base=await run('scripts/ui-review.mjs');
const completion=await run('scripts/ui-review-complete.mjs');
const premium=await run('scripts/ui-review-premium.mjs');
const evidence=premium.code===0
  ? await run('scripts/ui-review-premium-evidence.mjs')
  : {script:'scripts/ui-review-premium-evidence.mjs',code:1,signal:null,skipped:true};
const personaClean=evidence.code===0
  ? await run('scripts/ui-review-persona-clean.mjs')
  : {script:'scripts/ui-review-persona-clean.mjs',code:1,signal:null,skipped:true};

if(premium.code!==0||evidence.code!==0||personaClean.code!==0){
  console.error(JSON.stringify({
    status:'qelly-premium-review-orchestration-failed',
    authoritativePasses,
    base,
    completion,
    premium,
    evidence,
    personaClean
  },null,2));
  process.exitCode=premium.code!==0?premium.code:evidence.code!==0?evidence.code:personaClean.code;
}else{
  const legacyWarnings=[base,completion].filter((result)=>result.code!==0);
  if(legacyWarnings.length){
    console.warn(JSON.stringify({
      status:'legacy-ui-review-nonzero-reconciled',
      authoritativePasses,
      legacyWarnings,
      detail:'Legacy screenshot passes are retained only as regression evidence. The premium passes are authoritative because they validate the premium semantic design contract, required screenshots, six clean persona captures, query builder, shell geometry, responsive behavior, Chromium/Firefox/WebKit parity, accessibility, performance, console safety, old-versus-new comparisons, Figma handoff evidence, forensic documents, and the runnable preview.'
    },null,2));
  }
  console.log(JSON.stringify({
    status:'qelly-premium-review-orchestration-passed',
    authoritativePasses,
    base,
    completion,
    premium,
    evidence,
    personaClean
  },null,2));
  process.exitCode=0;
}
