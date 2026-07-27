import { spawn } from 'node:child_process';
import { readFile,rm,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDirectory=path.dirname(fileURLToPath(import.meta.url));
const sourceFile=path.join(scriptsDirectory,'ui-review-font-surface.mjs');
const temporaryFile=path.join(scriptsDirectory,`.ui-review-font-surface-stable-${process.pid}.mjs`);
const original=await readFile(sourceFile,'utf8');
const replacements=[
  ["await mobile.page.locator('[data-mi-filter-close]').first().click();await mobile.page.locator('[data-mi-columns-toggle]').click();await mobile.page.locator('[data-mi-column-menu]').waitFor();","await mobile.page.locator('[data-mi-filter-close]').last().click();await mobile.page.locator('[data-mi-filter-sheet][aria-hidden=\"true\"]').waitFor({state:'attached'});await mobile.page.locator('[data-mi-columns-toggle]').evaluate((button)=>button.click());await mobile.page.locator('[data-mi-column-menu]:not([hidden])').waitFor({state:'visible'});"],
  ["const localFonts=desktop.loadedFiles.length===2&&desktop.loadedFiles.every((item)=>item.name.startsWith(`${origin}/qelly-intelligence/assets/fonts/`));","const localFonts=desktop.loadedFiles.length===1&&desktop.loadedFiles.every((item)=>item.name.startsWith(`${origin}/qelly-intelligence/assets/fonts/`)&&item.name.endsWith('/ibm-plex-sans-variable.woff2'));"],
  ["localGeist:/Qelly Geist/.test(desktop.computedFamilies.body)&&/Qelly Geist Mono/.test(desktop.computedFamilies.number),localFonts","localPlex:/Qelly IBM Plex Sans/.test(desktop.computedFamilies.body)&&/Qelly IBM Plex Sans/.test(desktop.computedFamilies.title)&&/Qelly IBM Plex Sans/.test(desktop.computedFamilies.number),localFonts"],
  ["fallbackActive:!/Qelly Geist/.test(desktop.computedFamilies.body)","fallbackActive:!/Qelly IBM Plex Sans/.test(desktop.computedFamilies.body)"],
  ["- Selected UI font: Geist Sans Variable.","- Selected UI, display, text and numeric font: IBM Plex Sans Variable."],
  ["- Evidence mono: Geist Mono Variable.","- GT Eesti Display and Text: inactive commercial reference pending a Qelly web licence and licensed WOFF2 files."],
  ["fontSystem:'Geist Sans Variable + Geist Mono Variable'","fontSystem:'IBM Plex Sans Variable'"],
  ["fontSystem:'Geist Sans Variable + Geist Mono Variable',","fontSystem:'IBM Plex Sans Variable',"]
];
let patched=original;
for(const [from,to] of replacements){
  if(!patched.includes(from)){
    if(from.startsWith("fontSystem:"))continue;
    throw new Error(`Font/surface review contract changed; missing replacement target: ${from.slice(0,80)}`);
  }
  patched=patched.replace(from,to);
}
await writeFile(temporaryFile,patched,'utf8');
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
