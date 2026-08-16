import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('mobile record stacks contain and wrap long governed state labels',async()=>{
  const css=await readFile(new URL('../apps/web/public/assets/app.css',import.meta.url),'utf8');
  const mobile=css.match(/@media\(max-width:560px\)\{\.q-runtime-result[\s\S]*?\}\}/)?.[0]??'';
  assert.match(mobile,/\.q-record-stack\{grid-template-columns:minmax\(0,1fr\);min-width:0\}/);
  assert.match(mobile,/\.q-choice-row,\.q-record-row\{[^}]*min-width:0;max-width:100%/);
  assert.match(mobile,/\.q-record-row>\.q-status\{max-width:100%;white-space:normal;overflow-wrap:anywhere\}/);
});

test('every India finance option has a valid default and selection clears stale evidence',async()=>{
  const route=await readFile(new URL('../apps/web/public/assets/routes/india-finance-center.mjs',import.meta.url),'utf8');
  assert.match(route,/'fresh-india-tax-gross-up':\{netAmount:900,taxRate:0\.1\}/);
  assert.match(route,/const clearResult=\(\)=>\{result=null;[^}]*#india-primary[^}]*#india-summary[^}]*#india-results[^}]*No result yet[^}]*#india-evidence[^}]*No evidence yet\./);
  assert.match(route,/const reset=\(\)=>\{[\s\S]*?clearResult\(\);\}/);
  assert.match(route,/const run=\(\)=>\{clearResult\(\);let input/);
});
