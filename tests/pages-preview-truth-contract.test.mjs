import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('governed detail routes expose canonical static-preview truth-state markers',async()=>{
  const [validator,formula,indicator,calculator,saved]=await Promise.all([
    read('scripts/validate-pages-preview.mjs'),
    read('apps/web/public/assets/routes/formula-detail.mjs'),
    read('apps/web/public/assets/routes/indicator-detail.mjs'),
    read('apps/web/public/assets/routes/calculator-detail.mjs'),
    read('apps/web/public/assets/routes/saved-calculation-detail.mjs')
  ]);

  for(const route of [
    'assets/routes/formula-detail.mjs',
    'assets/routes/indicator-detail.mjs',
    'assets/routes/calculator-detail.mjs',
    'assets/routes/saved-calculation-detail.mjs'
  ])assert.match(validator,new RegExp(route.replaceAll('.','\\.')));

  assert.match(formula,/q-status--cached">DETERMINISTIC/);
  assert.doesNotMatch(formula,/q-status--simulated">DETERMINISTIC/);
  assert.match(indicator,/data-truth-state="deterministic">DETERMINISTIC · USER-PROVIDED MARKET HISTORY/);
  assert.doesNotMatch(indicator,/q-status--simulated/);
  assert.match(calculator,/data-truth-state="deterministic">DETERMINISTIC/);
  assert.match(calculator,/data-truth-state="local">LOCAL/);
  assert.doesNotMatch(calculator,/q-status--simulated/);
  assert.match(saved,/SHARED READ-ONLY|DETERMINISTIC LOCAL|UNAVAILABLE/);
});
