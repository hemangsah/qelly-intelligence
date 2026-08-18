import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');

test('production shell does not expose a simulated runtime state',()=>{
  const index=read('apps/web/public/index.html');
  assert.equal(index.includes('value="simulated"'),false,'legacy simulated state selector must not ship');
  assert.equal(index.includes('>Simulated<'),false,'customer shell must not label a production state as Simulated');
});

test('deterministic formula detail is not styled as simulated',()=>{
  const formula=read('apps/web/public/assets/routes/formula-detail.mjs');
  assert.equal(formula.includes('is-simulated'),false,'deterministic formula banner must not use simulated semantics');
  assert.equal(formula.includes('q-status--simulated'),false,'deterministic formula badge must not use simulated semantics');
  assert.ok(formula.includes('DETERMINISTIC'),'formula truth label must remain explicit');
});
