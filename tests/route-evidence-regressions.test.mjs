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

test('registered indicator detail preserves route identity without inventing a selection',async()=>{
  const route=await read('apps/web/public/assets/routes/indicator-detail.mjs');
  assert.match(route,/if\(!id\)\{renderSelectionRequired/);
  assert.match(route,/catch\{renderSelectionRequired/);
  assert.match(route,/SELECTION REQUIRED/);
  assert.match(route,/Qelly does not invent an indicator selection or redirect silently/);
  assert.match(route,/Open indicator library/);
  assert.doesNotMatch(route,/catch\{navigate\('indicator-library'\)/);
});

test('registered calculator detail preserves route identity without inventing a formula',async()=>{
  const route=await read('apps/web/public/assets/routes/calculator-detail.mjs');
  assert.match(route,/if\(!id\)\{renderSelectionRequired/);
  assert.match(route,/catch\{renderSelectionRequired/);
  assert.match(route,/Calculator Detail/);
  assert.match(route,/Qelly does not invent a calculator selection or redirect silently/);
  assert.match(route,/Open calculator center/);
  assert.doesNotMatch(route,/catch\{navigate\('calculator-center'\)/);
});

test('saved calculation detail preserves bare route identity and valid shared-state restoration',async()=>{
  const route=await read('apps/web/public/assets/routes/saved-calculation-detail.mjs');
  assert.match(route,/if\(!encoded\)\{renderSelectionRequired/);
  assert.match(route,/Saved Calculation Detail/);
  assert.match(route,/Qelly does not invent a saved record selection or redirect silently/);
  assert.match(route,/Open saved calculations/);
  assert.match(route,/decodeShareState\(encoded\)/);
  assert.match(route,/sharedMode=true/);
  assert.doesNotMatch(route,/if\(!encoded\)\{navigate\('saved-calculations'\)/);
});

test('discovery KPI helper is owned by the shared escaped UI primitive contract',async()=>{
  const [primitives,app]=await Promise.all([
    read('packages/ui-primitives/primitives.mjs'),
    read('apps/web/public/assets/app.js')
  ]);
  assert.match(primitives,/export function kpiCard\(label, value\)/);
  assert.match(primitives,/q-kpi-label.*escapeHtml\(label\)/s);
  assert.match(primitives,/q-kpi-value.*escapeHtml\(value\?\?'—'\)/s);
  assert.match(primitives,/globalThis\.kpiCard \?\?= kpiCard/);
  assert.match(app,/data\.kpis\.map\(\(item\)=>kpiCard\(item\.label,item\.value\)\)/);
});

test('accessibility evidence validates the built frontend and exact route identity before sampling',async()=>{
  const harness=await read('scripts/release-a5-accessibility-check.py');
  assert.match(harness,/PUBLIC_ROOT = \(ROOT \/ 'dist\/frontend'\)\.resolve\(\)/);
  assert.match(harness,/INDEX_PATH = PUBLIC_ROOT \/ 'index\.html'/);
  assert.doesNotMatch(harness,/apps\/web\/public\/index\.html/);
  assert.doesNotMatch(harness,/COMPILED_FONT/);
  assert.match(harness,/dist\/frontend\/assets\/route-registry\.mjs/);
  assert.match(harness,/asset=local_public_file\(parsed\.path\)/);
  assert.match(harness,/expected_title=f"\{route_labels\[route_key\]\} · Qelly Intelligence"/);
  assert.match(harness,/expected_hash=f'#\/\{route_path\}'/);
  assert.match(harness,/page\.wait_for_function/);
  assert.match(harness,/document\.title===expectedTitle/);
  assert.match(harness,/location\.hash\.split\('\?'\)\[0\]===expectedHash/);
  assert.match(harness,/document\.fonts\?\.ready/);
});
