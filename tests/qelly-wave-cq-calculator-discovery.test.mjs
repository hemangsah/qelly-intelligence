import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('Wave CQ exposes immediate calculator discovery without changing executable method definitions',async()=>{
  const route=await load('apps/web/public/assets/routes/calculator-center.mjs');
  for(const marker of ['listFormulaDefinitions()','const featured=FEATURED_IDS.map','id="calculator-quick-search"','id="calculator-domain-chip-list"','aria-pressed="true"','aria-controls="calculator-complete-library"','disclosure.open=true','quickSearch.addEventListener(\'input\'','domainChips','domain.value=chip.dataset.domain','quickSearch.value=search.value','catalog.innerHTML=filtered.map','Browse all ${definitions.length} calculators']){
    assert.ok(route.includes(marker),marker);
  }
  assert.ok(!route.includes('fetch('),'calculator discovery must not fetch pricing or provider data');
});
test('Wave CQ supports both full-library progressive disclosure and accessible filtering',async()=>{
  const [route,css]=await Promise.all([load('apps/web/public/assets/routes/calculator-center.mjs'),load('apps/web/public/assets/qelly-wave-cq-calculator-experience.css')]);
  assert.match(route,/let catalogMaterialized=false/);
  assert.match(route,/if\(!catalogMaterialized&&!disclosure\.open\)return/);
  assert.match(route,/disclosure\.addEventListener\('toggle'/);
  assert.match(css,/\.q-cq-domain-chip\.is-active/);
  assert.match(css,/min-height:44px/);
  assert.match(css,/font-size:16px/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/--q-cq-card:var\(--surface-elevated/);
  assert.match(route,/data-qelly-wave-cq-calculator-experience="active"/);
  assert.doesNotMatch(route,/Math\.random\(/);
});
