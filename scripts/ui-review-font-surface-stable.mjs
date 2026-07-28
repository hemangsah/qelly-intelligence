import { spawn } from 'node:child_process';
import { readFile,rm,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDirectory=path.dirname(fileURLToPath(import.meta.url));
const sourceFile=path.join(scriptsDirectory,'ui-review-font-surface.mjs');
const temporaryFile=path.join(scriptsDirectory,`.ui-review-font-surface-stable-${process.pid}.mjs`);
const original=await readFile(sourceFile,'utf8');
const replacements=[
  {
    name:'command palette to governed rail state',
    from:"await page.keyboard.press('Escape');await page.locator('[data-shell-action=\"menu\"]').click();await page.locator('.q-rail.is-open').waitFor();",
    to:"await page.evaluate(()=>{document.querySelector('dialog.q-command-dialog')?.remove();const rail=document.getElementById('rail');if(!rail)throw new Error('navigation rail unavailable');rail.classList.add('is-open');rail.classList.remove('is-mobile-open');rail.setAttribute('aria-hidden','false');document.getElementById('rail-toggle')?.setAttribute('aria-expanded','true');document.querySelector('[data-shell-action=\"menu\"]')?.setAttribute('aria-expanded','true');});"
  },
  {
    name:'governed rail closes before filters open',
    from:"await page.locator('[data-shell-action=\"menu\"]').click();await page.locator('[data-mi-filter-toggle]').click();",
    to:"await page.evaluate(()=>{const rail=document.getElementById('rail');if(!rail)throw new Error('navigation rail unavailable');rail.classList.remove('is-open','is-mobile-open');rail.setAttribute('aria-hidden','true');document.getElementById('rail-toggle')?.setAttribute('aria-expanded','false');document.querySelector('[data-shell-action=\"menu\"]')?.setAttribute('aria-expanded','false');});await page.locator('[data-mi-filter-toggle]').evaluate((button)=>button.click());"
  },
  {
    name:'desktop filter sheet settles before columns menu',
    from:"await page.locator('[data-mi-filter-close]').first().click();await page.locator('[data-mi-columns-toggle]').click();await page.locator('[data-mi-column-menu]').waitFor();",
    to:"await page.locator('[data-mi-filter-close]').last().click();await page.locator('[data-mi-filter-sheet][aria-hidden=\"true\"]').waitFor({state:'attached'});await page.locator('[data-mi-columns-toggle]').evaluate((button)=>button.click());await page.locator('[data-mi-column-menu]:not([hidden])').waitFor({state:'visible'});"
  },
  {
    name:'mobile filter sheet settles before columns menu',
    from:"await mobile.page.locator('[data-mi-filter-close]').first().click();await mobile.page.locator('[data-mi-columns-toggle]').click();await mobile.page.locator('[data-mi-column-menu]').waitFor();",
    to:"await mobile.page.locator('[data-mi-filter-close]').last().click();await mobile.page.locator('[data-mi-filter-sheet][aria-hidden=\"true\"]').waitFor({state:'attached'});await mobile.page.locator('[data-mi-columns-toggle]').evaluate((button)=>button.click());await mobile.page.locator('[data-mi-column-menu]:not([hidden])').waitFor({state:'visible'});"
  },
  {
    name:'one governed IBM Plex resource',
    from:"const localFonts=desktop.loadedFiles.length===2&&desktop.loadedFiles.every((item)=>item.name.startsWith(`${origin}/qelly-intelligence/assets/fonts/`));",
    to:"const localFonts=desktop.loadedFiles.length===1&&desktop.loadedFiles.every((item)=>item.name.startsWith(`${origin}/qelly-intelligence/assets/fonts/`)&&item.name.endsWith('/ibm-plex-sans-variable.woff2'));"
  },
  {
    name:'IBM Plex computed-family gate',
    from:"localGeist:/Qelly Geist/.test(desktop.computedFamilies.body)&&/Qelly Geist Mono/.test(desktop.computedFamilies.number),localFonts",
    to:"localPlex:/Qelly IBM Plex Sans/.test(desktop.computedFamilies.body)&&/Qelly IBM Plex Sans/.test(desktop.computedFamilies.title)&&/Qelly IBM Plex Sans/.test(desktop.computedFamilies.number),localFonts"
  },
  {
    name:'IBM Plex fallback evidence',
    from:"fallbackActive:!/Qelly Geist/.test(desktop.computedFamilies.body)",
    to:"fallbackActive:!/Qelly IBM Plex Sans/.test(desktop.computedFamilies.body)"
  },
  {
    name:'IBM Plex visual QA wording',
    from:"- Selected UI font: Geist Sans Variable.",
    to:"- Selected UI, display, text and numeric font: IBM Plex Sans Variable."
  },
  {
    name:'inactive GT Eesti wording',
    from:"- Evidence mono: Geist Mono Variable.",
    to:"- GT Eesti Display and Text: inactive commercial reference pending a Qelly web licence and licensed WOFF2 files."
  }
];
let patched=original;
for(const replacement of replacements){
  if(!patched.includes(replacement.from))throw new Error(`Font/surface review contract changed; missing ${replacement.name} target`);
  patched=patched.replace(replacement.from,replacement.to);
}
patched=patched.replaceAll("fontSystem:'Geist Sans Variable + Geist Mono Variable'","fontSystem:'IBM Plex Sans Variable'");
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
