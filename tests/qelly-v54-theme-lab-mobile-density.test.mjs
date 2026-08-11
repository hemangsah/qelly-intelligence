import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const CSS='apps/web/public/assets/theme-intelligence.css';
const ROUTE='apps/web/public/assets/routes/theme-intelligence-studio.mjs';
const CORE='apps/web/public/assets/theme-intelligence-core.mjs';
const RESPONSIVE='scripts/release-v53-responsive-evidence.py';

test('Theme Lab phone density compacts preview evidence without hiding it',async()=>{
  const css=await read(CSS);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/\.q-ti-page \.q-ti-side\{display:grid!important;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(css,/\.q-ti-page \.q-ti-audit\{display:grid!important;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(css,/\.q-ti-page \.q-ti-preview-body\{gap:10px!important;padding:10px!important\}/);
  const mobile=css.slice(css.indexOf('/* Theme Studio mobile workstation density'),css.indexOf('/* governed surfaces:'));
  assert.doesNotMatch(mobile,/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0/);
  assert.doesNotMatch(mobile,/--q-positive|--q-negative|--q-warning|--q-focus|--q-accent\s*:/);
});

test('Theme Lab retains all governed preview, contrast and semantic evidence',async()=>{
  const route=await read(ROUTE);
  assert.match(route,/function auditMarkup\(config\)/);
  assert.match(route,/Object\.entries\(audit\.results\)\.map/);
  assert.match(route,/function semanticSwatches\(tokens\)/);
  assert.match(route,/tokens\.positive/);
  assert.match(route,/tokens\.negative/);
  assert.match(route,/tokens\.warning/);
  assert.match(route,/Protected market semantics/);
  assert.match(route,/Portal inheritance/);
  assert.match(route,/tableMarkup\(\)/);
  assert.match(route,/auditMarkup\(config\)/);
  assert.doesNotMatch(route,/audit\.results\.slice\s*\(/);
});

test('Theme Lab protected semantic and accessibility contracts remain engine-owned',async()=>{
  const core=await read(CORE);
  assert.match(core,/Accent cannot replace market or warning semantics/);
  assert.match(core,/tokens\.positive/);
  assert.match(core,/tokens\.negative/);
  assert.match(core,/tokenContrastAudit/);
  assert.match(core,/customCss:false/);
  assert.match(core,/marketSemantics:true/);
});

test('Theme Lab remains in governed nine-width responsive evidence',async()=>{
  const responsive=await read(RESPONSIVE);
  assert.match(responsive,/'theme-lab'/);
  for(const width of [360,390,430,768,1024,1280,1440,1728,1920]){
    assert.ok(responsive.includes(String(width)),`missing governed viewport ${width}`);
  }
});
