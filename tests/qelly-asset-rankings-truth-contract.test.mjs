import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {demonstrationRows,deterministicRows} from '../apps/web/public/assets/routes/asset-rankings-data.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Asset Rankings never blends provider fields into deterministic scenario rows',()=>{
  const provider=[{symbol:'BTC',price:1,marketCap:2,openInterest:3,source:{provider:'live-provider'}}];
  const rows=deterministicRows(provider);
  assert.equal(rows.length,16);
  assert.notEqual(rows[0].price,1);
  assert.equal(rows[0].source,'Qelly deterministic demonstration');
  assert.equal(rows[0].evidenceState,'DEMONSTRATION');
  assert.deepEqual(rows,demonstrationRows());
});

test('Asset Rankings visibly discloses unassessed provider agreement and demonstration metrics',async()=>{
  const source=await read('apps/web/public/assets/routes/asset-rankings-premium.mjs');
  assert.match(source,/Deterministic demonstration/);
  assert.match(source,/no live provider blending/i);
  assert.match(source,/Provider agreement<\/h2><\/div><span>Not assessed/);
  assert.match(source,/Values are not live market observations/);
  assert.doesNotMatch(source,/4 sources/);
  assert.doesNotMatch(source(/High agreement/));
});

test('Asset Rankings restores deep-link search and functional evidence controls',async()=>{
  const source=await read('apps/web/public/assets/routes/asset-rankings-premium.mjs');
  assert.match(source,/parameters\.get\('query'\)/);
  assert.match(source,/data-mi-export-evidence/);
  assert.match(source,/URL\.createObjectURL/);
  assert.match(source,/data-mi-open-provenance/);
  assert.match(source,/navigate\('decision-provenance'\)/);
  assert.match(source,/returnFocus\?\.focus/);
  assert.match(source,/event\.key==='Escape'/);
});
