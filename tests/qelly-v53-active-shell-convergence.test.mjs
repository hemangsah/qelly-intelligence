import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtimePath=new URL('../apps/web/public/assets/qelly-ui-lock-v5-3.mjs',import.meta.url);
const cssPath=new URL('../apps/web/public/assets/qelly-v53-active-shell-convergence.css',import.meta.url);

const read=(url)=>readFile(url,'utf8');
const executableCss=(source)=>source.replace(/\/\*[\s\S]*?\*\//g,'');

test('active V5.3 shell binds only the current runtime attribute and never activates the dormant legacy contract',async()=>{
  const [runtime,css]=await Promise.all([read(runtimePath),read(cssPath)]);
  const activeCss=executableCss(css);
  assert.match(runtime,/root\.dataset\.uiLockV53='active'/);
  assert.match(runtime,/root\.dataset\.v53ActiveShell='wave1'/);
  assert.match(runtime,/qelly-v53-active-shell-convergence\.css/);
  assert.match(runtime,/data-qelly-v53-active-shell="wave1"/);
  assert.match(activeCss,/html\[data-ui-lock-v53="active"\]\[data-v53-active-shell="wave1"\]/);
  assert.doesNotMatch(activeCss,/data-ui-lock-v5-3/);
  assert.doesNotMatch(runtime,/dataset\.uiLockV5_3|setAttribute\(['"]data-ui-lock-v5-3/);
});

test('active shell implements the approved 24 + 40 + 30 institutional chrome without removing evidence',async()=>{
  const css=await read(cssPath);
  assert.match(css,/--q-v53a-system-h:24px/);
  assert.match(css,/--q-v53a-command-h:40px/);
  assert.match(css,/--q-v53a-context-h:30px/);
  assert.match(css,/--q-v53a-shell-top:94px/);
  assert.match(css,/--q-v53a-rail-w:64px/);
  assert.match(css,/--q-v53a-radius-panel:8px/);
  for(const selector of ['.q-global-strip','.q-command-bar','.q-context-shelf','.q-edge-dock','#main','.q-panel','.q-data-grid','.q-context-drawer','.q-compare-tray']){
    assert.ok(css.includes(selector),`missing active shell owner ${selector}`);
  }
  assert.doesNotMatch(executableCss(css),/display\s*:\s*none/);
  assert.doesNotMatch(executableCss(css),/visibility\s*:\s*hidden/);
  assert.doesNotMatch(executableCss(css),/content\s*:/);
});

test('operating-mode context is reparented into command chrome without deleting or replacing its governed renderer',async()=>{
  const runtime=await read(runtimePath);
  assert.match(runtime,/const personaRibbon=document\.getElementById\('persona-ribbon'\)/);
  assert.match(runtime,/commandBar\.insertBefore\(personaRibbon/);
  assert.match(runtime,/personaRibbon\.dataset\.v53ShellPlacement='command-context'/);
  assert.doesNotMatch(runtime,/personaRibbon\.remove\(|innerHTML\s*=.*persona-ribbon/);
});

test('mobile shell remains compact without slicing analytical evidence',async()=>{
  const css=await read(cssPath);
  assert.match(css,/@media\(max-width:920px\)/);
  assert.match(css,/@media\(max-width:620px\)/);
  assert.match(css,/overflow-x:auto/);
  assert.match(css,/overscroll-behavior-inline:contain/);
  assert.doesNotMatch(executableCss(css),/nth-child\([^)]*n\s*\+/);
  assert.doesNotMatch(executableCss(css),/\.slice\(|filter\(/);
});
