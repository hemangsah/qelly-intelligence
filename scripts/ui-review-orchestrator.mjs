import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function run(script){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(root,script)],{cwd:root,env:process.env,stdio:'inherit'});child.once('error',reject);child.once('exit',(code,signal)=>resolve({script,code:code??1,signal}));});}

const authoritativePasses=['scripts/ui-review-current.mjs'];
const retiredLegacyPasses=[
  'scripts/ui-review.mjs','scripts/ui-review-complete.mjs','scripts/ui-review-premium.mjs',
  'scripts/ui-review-premium-evidence.mjs','scripts/ui-review-persona-clean.mjs',
  'scripts/ui-review-font-surface-stable.mjs','scripts/font-comparison-board-local.mjs'
];
const current=await run(authoritativePasses[0]);
if(current.code!==0){
  console.error(JSON.stringify({status:'qelly-current-ui-review-failed',authoritativePasses,retiredLegacyPasses,current},null,2));
  process.exitCode=current.code;
}else{
  console.log(JSON.stringify({status:'qelly-current-ui-review-passed',authoritativePasses,retiredLegacyPasses,current,detail:'Current route screenshots and UI/UX gates are authoritative. Retired prototype comparison passes remain historical evidence only.'},null,2));
}
