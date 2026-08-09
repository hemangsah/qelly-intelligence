import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const CSS = 'apps/web/public/assets/qelly-v53-visible-refinement.css';
const RUNTIME = 'apps/web/public/assets/qelly-ui-lock-v5-3.mjs';
const FAMILY_CSS = 'apps/web/public/assets/qelly-v53-family-harmonization.css';
const FAMILY_RUNTIME = 'apps/web/public/assets/qelly-v53-family-harmonization.mjs';
const ROUTES = 'apps/web/public/assets/route-registry.mjs';

test('V5.3 refinement is additive and activated by the approved lock runtime', async () => {
  const [css, runtime] = await Promise.all([read(CSS), read(RUNTIME)]);
  assert.match(runtime, /qelly-v53-visible-refinement\.css/);
  assert.match(runtime, /qelly-v53-family-harmonization\.mjs/);
  assert.match(runtime, /dataset\.uiLockV53Refinement='2026-08-09'/);
  assert.match(runtime, /document\.head\.append\(link\)/);
  assert.match(css, /Additive presentation-only polish after UI_LOCK_V5_3/);
});

test('visible refinement strengthens the governed high-value surfaces', async () => {
  const css = await read(CSS);
  for (const selector of [
    '.q-live-command-deck',
    '.q-live-chart-shell',
    '.q-v5-market-metric',
    '.q-v5-evidence-ribbon',
    '.q-context-drawer',
    '.q-ti-preview-shell',
    '.q-ti-theme-card',
    '.q-compare-tray'
  ]) assert.ok(css.includes(selector), `missing visible refinement for ${selector}`);
  assert.match(css, /data-v53-route="market"/);
  assert.match(css, /data-v53-evidence-adjacent="true"/);
});

test('current 71-route registry is covered exactly once by V5.3 semantic families', async () => {
  const [{ ROUTE_FAMILIES, FAMILY_ROUTE_COUNT, routeFamilyFor }, registry] = await Promise.all([
    import(new URL('../apps/web/public/assets/qelly-v53-family-harmonization.mjs', import.meta.url)),
    read(ROUTES)
  ]);
  const registered=[...registry.matchAll(/route:'([^']+)'/g)].map((match)=>match[1]);
  const mapped=Object.values(ROUTE_FAMILIES).flat();
  assert.equal(registered.length,71);
  assert.equal(FAMILY_ROUTE_COUNT,71);
  assert.equal(new Set(mapped).size,71);
  assert.deepEqual([...new Set(mapped)].sort(),[...new Set(registered)].sort());
  for(const route of registered)assert.notEqual(routeFamilyFor(route),'unmapped',`unmapped V5.3 route: ${route}`);
});

test('Qelly Verify is canonical while retaining the existing governed product surface', async () => {
  const [registry, familyRuntime, verifyCss, verifyRuntime] = await Promise.all([
    read(ROUTES), read(FAMILY_RUNTIME), read('apps/web/public/assets/qelly-verify.css'), read('apps/web/public/assets/qelly-verify-product.mjs')
  ]);
  assert.match(registry,/route:'qelly-verify'/);
  assert.match(familyRuntime,/'quant-verify'.*qelly-verify/s);
  assert.match(familyRuntime,/\.q-verify-page/);
  assert.match(familyRuntime,/data.*qelly-verify|qelly-verify/s);
  assert.match(verifyCss,/\.q-verify-page/);
  assert.ok(verifyRuntime.length>500);
});

test('family harmonization is network-free and only decorates existing cloud state hooks', async () => {
  const runtime=await read(FAMILY_RUNTIME);
  assert.match(runtime,/data-cloud-state/);
  assert.match(runtime,/data-sync-state/);
  assert.match(runtime,/v53CloudPresentation='existing-state'/);
  assert.doesNotMatch(runtime,/\bfetch\s*\(/);
  assert.doesNotMatch(runtime,/XMLHttpRequest|WebSocket/);
});

test('IBM Plex remains canonical and normal quantitative UI keeps tabular lining numerals', async () => {
  const [css,familyCss,fontCss]=await Promise.all([read(CSS),read(FAMILY_CSS),read('apps/web/public/assets/qelly-font-governance.css')]);
  const source=`${css}\n${familyCss}\n${fontCss}`;
  assert.match(source,/IBM Plex Sans Variable/);
  assert.match(familyCss,/tabular-nums lining-nums/);
  assert.match(familyCss,/"tnum" 1,"lnum" 1/);
  assert.doesNotMatch(source,/fonts\.googleapis|fonts\.gstatic|\bInter\b|\bGeist\b/);
});

test('responsive contract contains every required evidence width and task-first mobile behavior', async () => {
  const [css,familyRuntime]=await Promise.all([read(FAMILY_CSS),read(FAMILY_RUNTIME)]);
  for(const width of ['360','390','430','768','1024','1280','1440','1728','1920']){
    assert.ok(css.includes(width),`missing responsive width ${width}`);
    assert.ok(familyRuntime.includes(width),`missing viewport mode ${width}`);
  }
  assert.match(css,/q-context-drawer\[aria-hidden="false"\]/);
  assert.match(css,/max-height:min\(72vh,620px\)/);
  assert.match(css,/prefers-contrast:more/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/transition:none!important/);
});

test('refinement preserves responsive, light-theme and reduced-motion contracts', async () => {
  const css = await read(CSS);
  assert.match(css, /data-appearance="light"/);
  assert.match(css, /@media \(max-width:767px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(css, /transition:none!important/);
});

test('V5.3 presentation layers introduce no prohibited account or live-action controls', async () => {
  const sources=await Promise.all([read(CSS),read(RUNTIME),read(FAMILY_CSS),read(FAMILY_RUNTIME)]);
  const source=sources.join('\n').toLowerCase();
  const forbidden=[
    'place order','execute trade','buy now','sell now','connect wallet','private key','recovery phrase','withdraw funds','deposit funds'
  ];
  for(const phrase of forbidden)assert.equal(source.includes(phrase),false,`forbidden control phrase: ${phrase}`);
});