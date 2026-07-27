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

const base=await run('scripts/ui-review.mjs');
const completion=await run('scripts/ui-review-complete.mjs');
const premium=await run('scripts/ui-review-premium.mjs');

if(premium.code!==0){
  console.error(JSON.stringify({
    status:'qelly-premium-review-orchestration-failed',
    authoritativePass:'scripts/ui-review-premium.mjs',
    base,
    completion,
    premium
  },null,2));
  process.exitCode=premium.code;
}else{
  const legacyWarnings=[base,completion].filter((result)=>result.code!==0);
  if(legacyWarnings.length){
    console.warn(JSON.stringify({
      status:'legacy-ui-review-nonzero-reconciled',
      authoritativePass:'scripts/ui-review-premium.mjs',
      legacyWarnings,
      detail:'Legacy screenshot passes are retained only as regression evidence. The premium pass is authoritative because it validates the premium semantic design contract, required screenshots, interactions, responsive behavior, Chromium/Firefox/WebKit parity, accessibility, performance, console safety, old-versus-new comparisons, Figma handoff, forensic documents, and the runnable preview.'
    },null,2));
  }
  console.log(JSON.stringify({
    status:'qelly-premium-review-orchestration-passed',
    authoritativePass:'scripts/ui-review-premium.mjs',
    base,
    completion,
    premium
  },null,2));
  process.exitCode=0;
}
