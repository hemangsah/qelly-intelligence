import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(relative)=>readFile(path.join(root,relative),'utf8');

test('staging assurance consumes the governed staging manifest schema without legacy fields',async()=>{
  const [route,manifestText]=await Promise.all([
    read('apps/web/public/assets/routes/staging-assurance.mjs'),
    read('deploy/staging/manifest.json')
  ]);
  const manifest=JSON.parse(manifestText);
  assert.ok(Array.isArray(manifest.workloads));
  assert.ok(Array.isArray(manifest.externalDependencies));
  assert.match(route,/manifest\.workloads/);
  assert.match(route,/manifest\.externalDependencies/);
  assert.doesNotMatch(route,/manifest\.services/);
  assert.doesNotMatch(route,/manifest\.releaseGates/);
});

test('registered formula detail preserves a truthful empty route when no formula is selected',async()=>{
  const route=await read('apps/web/public/assets/routes/formula-detail.mjs');
  assert.match(route,/if\(!id\)/);
  assert.match(route,/SELECTION REQUIRED/);
  assert.match(route,/Qelly does not invent a formula selection/);
  assert.match(route,/Open formula library/);
});

test('unresolved formula context stays on formula detail instead of silently redirecting',async()=>{
  const route=await read('apps/web/public/assets/routes/formula-detail.mjs');
  assert.match(route,/catch\{\s*renderSelectionRequired/);
  assert.match(route,/does not resolve to a governed formula/);
  assert.match(route,/does not substitute another formula or redirect silently/);
});
