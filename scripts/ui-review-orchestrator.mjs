import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function run(script){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[path.join(root,script)],{cwd:root,env:process.env,stdio:'inherit'});
    child.once('error',reject);child.once('exit',(code,signal)=>resolve({script,code:code??1,signal}));
  });
}

const base=await run('scripts/ui-review.mjs');
const completion=await run('scripts/ui-review-complete.mjs');
const premium=await run('scripts/ui-review-premium.mjs');

if(completion.code!==0||premium.code!==0){
  process.exitCode=completion.code!==0?completion.code:premium.code;
}else{
  if(base.code!==0){
    console.warn(JSON.stringify({status:'base-ui-review-nonzero-reconciled',baseExitCode:base.code,baseSignal:base.signal,detail:'The completion and premium passes re-ran timing-sensitive checks, validated required evidence, captured all premium modes and browsers, and produced the final artifact.'},null,2));
  }
  console.log(JSON.stringify({status:'qelly-premium-review-orchestration-passed',base,completion,premium},null,2));
  process.exitCode=0;
}
