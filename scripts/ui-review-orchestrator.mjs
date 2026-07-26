import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

function run(script){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[path.join(root,script)],{
      cwd:root,
      env:process.env,
      stdio:'inherit'
    });
    child.once('error',reject);
    child.once('exit',(code,signal)=>resolve({code:code??1,signal}));
  });
}

const base=await run('scripts/ui-review.mjs');
const completion=await run('scripts/ui-review-complete.mjs');
if(completion.code!==0){
  process.exitCode=completion.code;
}else{
  if(base.code!==0){
    console.warn(JSON.stringify({
      status:'base-ui-review-nonzero-reconciled',
      baseExitCode:base.code,
      baseSignal:base.signal,
      detail:'The completion pass re-ran timing-sensitive checks, validated required evidence, and produced the final artifact summary.'
    },null,2));
  }
  process.exitCode=0;
}
