import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync('apps/web/public/assets/app.js','utf8');
const css=fs.readFileSync('apps/web/public/assets/qelly-ui-lock-v5-3.css','utf8');
const worldclass=fs.readFileSync('apps/web/public/assets/qelly-worldclass-uiux.css','utf8');

test('Time Series preserves the governed 120-point default and complete returned row set',()=>{
  assert.match(app,/id="series-limit"[\s\S]*?<option value="120" selected>120<\/option>/);
  assert.match(app,/id="series-grid"/);
  assert.match(app,/const rows=result\.points\.slice\(\)\.reverse\(\)\.map/);
  assert.match(app,/new QellyDataGrid\(document\.getElementById\('series-grid'\),\{columns,rows/);
  assert.match(app,/`\$\{result\.points\.length\} \/ \$\{result\.page\.total\} points`/);
});

test('World-class mobile layer is the known global expansion source',()=>{
  assert.match(worldclass,/@media\(max-width:680px\)[\s\S]*?\.q-grid-scroll\{max-height:none;overflow:auto\}/);
});

test('V5.3 restores a bounded mobile viewport only for Time Series evidence',()=>{
  assert.match(css,/@media\(max-width:720px\)[\s\S]*?html\[data-ui-lock-v5-3="active"\] #series-grid \.q-grid-scroll\{/);
  assert.match(css,/#series-grid \.q-grid-scroll\{[\s\S]*?max-height:clamp\(320px,56dvh,520px\)/);
  assert.match(css,/#series-grid \.q-grid-scroll\{[\s\S]*?overflow:auto/);
  assert.match(css,/#series-grid \.q-grid-scroll\{[\s\S]*?overscroll-behavior:contain/);
  assert.doesNotMatch(css,/html\[data-ui-lock-v5-3="active"\] \.q-grid-scroll\{[\s\S]{0,160}max-height:clamp\(320px,56dvh,520px\)/);
});
