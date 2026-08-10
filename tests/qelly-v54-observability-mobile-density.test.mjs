import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const shell=fs.readFileSync('apps/web/public/assets/shell-foundations.mjs','utf8');
const app=fs.readFileSync('apps/web/public/assets/app.js','utf8');

const densityBlock=shell.match(/const OBSERVABILITY_MOBILE_PRESENTATION=\[(.*?)\n\];/s)?.[1]??'';

test('Observability compact density is installed through an already-loaded runtime owner',()=>{
  assert.match(shell,/globalThis\.matchMedia\('\(max-width: 620px\)'\)/);
  assert.match(shell,/new MutationObserver\(\(\)=>applyObservabilityDensity\(\)\)/);
  assert.match(shell,/observabilityDensityObserver\.observe\(main,\{childList:true,subtree:true\}\)/);
  assert.match(shell,/installObservabilityDensity\(\);/);
});

test('Observability mobile density compacts summaries and converts long evidence walls into horizontal rails',()=>{
  assert.match(densityBlock,/\.q-kpi-grid/);
  assert.match(densityBlock,/repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(densityBlock,/\.q-dependency-grid/);
  assert.match(densityBlock,/\.q-observability-slo-rail/);
  assert.match(densityBlock,/\.q-provider-score-grid/);
  assert.match(densityBlock,/overflow-x':'auto'/);
  assert.match(densityBlock,/scroll-snap-type':'x proximity'/);
  assert.match(shell,/const sloRail=page\.querySelector\('\.q-slo-row'\)\?\.parentElement/);
  assert.match(shell,/if\(sloRail\?\.classList\.contains\('q-stack'\)\)sloRail\.classList\.add\('q-observability-slo-rail'\)/);
  assert.doesNotMatch(shell,/q-panel-header h2/);
});

test('Observability density does not hide or truncate operational evidence',()=>{
  assert.doesNotMatch(densityBlock,/display':'none|visibility':'hidden|content-visibility':'hidden|opacity':'0/);
  assert.match(app,/overview\.dependencies\.map\(/);
  assert.match(app,/overview\.slos\.map\(/);
  assert.match(app,/metrics\.providers\.map\(/);
  assert.match(app,/traces\.items\.map\(/);
  assert.match(app,/logs\.items\.map\(/);
});

test('Observability presentation remains responsive and self-identifying',()=>{
  assert.match(shell,/setObservabilityPresentation\(element,styles,active\)/);
  assert.match(shell,/if\(active\)element\.style\.setProperty\(name,value,'important'\)/);
  assert.match(shell,/else element\.style\.removeProperty\(name\)/);
  assert.match(shell,/page\.dataset\.mobileDensity=active\?'active':'desktop'/);
  assert.match(shell,/document\.documentElement\.dataset\.observabilityDensity=active\?'active':'desktop'/);
});
