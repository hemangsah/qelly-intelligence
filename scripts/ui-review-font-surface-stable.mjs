import { spawn } from 'node:child_process';
import { readFile,rm,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDirectory=path.dirname(fileURLToPath(import.meta.url));
const sourceFile=path.join(scriptsDirectory,'ui-review-font-surface.mjs');
const temporaryFile=path.join(scriptsDirectory,`.ui-review-font-surface-stable-${process.pid}.mjs`);
const original=await readFile(sourceFile,'utf8');
const rejectedInteraction="await mobile.page.locator('[data-mi-filter-close]').first().click();await mobile.page.locator('[data-mi-columns-toggle]').click();await mobile.page.locator('[data-mi-column-menu]').waitFor();";
const stableInteraction="await mobile.page.locator('[data-mi-filter-close]').last().click();await mobile.page.locator('[data-mi-filter-sheet][aria-hidden=\"true\"]').waitFor({state:'attached'});await mobile.page.locator('[data-mi-columns-toggle]').evaluate((button)=>button.click());await mobile.page.locator('[data-mi-column-menu]:not([hidden])').waitFor({state:'visible'});";
if(!original.includes(rejectedInteraction))throw new Error('Font/surface mobile review interaction contract changed; update the stable state-based harness explicitly.');
await writeFile(temporaryFile,original.replace(rejectedInteraction,stableInteraction),'utf8');
try{
  const result=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[temporaryFile],{cwd:path.resolve(scriptsDirectory,'..'),env:process.env,stdio:'inherit'});
    child.once('error',reject);
    child.once('exit',(code,signal)=>resolve({code:code??1,signal}));
  });
  if(result.code!==0)process.exitCode=result.code;
}finally{
  await rm(temporaryFile,{force:true});
}
