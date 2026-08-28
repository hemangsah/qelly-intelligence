import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { PERSONA_PROFILES, personaPreferencePatch } from '../apps/web/public/assets/persona-profiles.mjs';
import { productDomains, routeDefinitions } from '../apps/web/public/assets/route-registry.mjs';
import { staticPreviewRequest } from '../apps/web/public/assets/static-preview-api.mjs';
import { dataStateIndicator, sourceDisclosure } from '../packages/ui-primitives/primitives.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>readFile(path.join(root,file),'utf8');
const json=async(file)=>JSON.parse(await read(file));

test('every executable route has a governed domain and page-shell kind',()=>{
  assert.equal(routeDefinitions.length,71);
  assert.ok(productDomains.length>=8);
  const domains=new Set(productDomains.map((item)=>item.id));
  const kinds=new Set(['public-story','analytical','research','operational','access']);
  assert.ok(routeDefinitions.every((route)=>domains.has(route.domain)));
  assert.ok(routeDefinitions.every((route)=>kinds.has(route.kind)));
});

test('checked-in route inventory matches every authoritative registered route',async()=>{
  const csv=await read('design/inventory/QELLY_ROUTE_INVENTORY.csv');
  const inventoryRoutes=csv.split(/\r?\n/).slice(1).map((line)=>line.match(/^"\d+","#\/([^"]+)"/)?.[1]).filter(Boolean);
  const registeredRoutes=routeDefinitions.map((item)=>item.route);
  assert.equal(inventoryRoutes.length,registeredRoutes.length);
  assert.deepEqual(new Set(inventoryRoutes),new Set(registeredRoutes));
});

test('personas define operating behavior beyond theme color',()=>{
  assert.equal(PERSONA_PROFILES.length,6);
  for(const persona of PERSONA_PROFILES){
    assert.ok(persona.defaultRoute);
    assert.ok(persona.defaultTimeframe);
    assert.ok(persona.alertPosture);
    assert.ok(persona.terminology);
    assert.ok(persona.modulePriority.length>=5);
    assert.ok(['comfortable','compact','terminal'].includes(persona.density));
    assert.ok(['full','subtle','reduced'].includes(persona.motion));
  }
  assert.deepEqual(personaPreferencePatch('high-contrast'),{theme:'high-contrast',density:'comfortable',motion:'reduced',fontScale:120});
});

test('truth-state primitives use text and symbols and never call demo live',()=>{
  const demo=dataStateIndicator({state:'demo'});
  const stale=dataStateIndicator({state:'stale'});
  const source=sourceDisclosure({provider:'Qelly deterministic demo',state:'demo',observedAt:'2025-01-15T12:00:00.000Z',receivedAt:'2025-01-15T12:00:00.000Z',confidence:.5,methodology:'static-preview-v1'});
  assert.match(demo,/Demo · not live/);
  assert.doesNotMatch(demo,/>Live</);
  assert.match(stale,/data-symbol="△"/);
  assert.match(source,/50% confidence/);
  assert.match(source,/static-preview-v1/);
});

test('static preview exposes a deterministic evidence graph and still rejects mutation',async()=>{
  const listing=await staticPreviewRequest('/api/v1/evidence/graphs');
  const graph=await staticPreviewRequest(`/api/v1/evidence/graphs/${listing.items[0].graphId}`);
  const repeated=await staticPreviewRequest(`/api/v1/evidence/graphs/${listing.items[0].graphId}`);
  const routeSource=await read('apps/web/public/assets/routes/decision-provenance.mjs');
  assert.equal(listing.total,1);
  assert.equal(listing.mode,'deterministic-demo');
  assert.equal(listing.persistence,'unavailable');
  assert.match(listing.truthBoundary,/deterministic demo/i);
  assert.equal(graph.integrity.valid,true);
  assert.ok(graph.nodes.length>=7);
  assert.ok(graph.edges.length>=7);
  assert.match(graph.truthBoundary,/not live/i);
  assert.match(routeSource,/demo · not persisted/);
  assert.match(routeSource,/Backend unavailable/);
  assert.deepEqual(graph,repeated);
  await assert.rejects(staticPreviewRequest('/api/v1/evidence/explain-move',{method:'POST'}),(error)=>error.code==='static_visual_preview_backend_unavailable');
});

test('canonical design tokens cover every mode, typography role, and chart truth requirement',async()=>{
  const [tokens,motion,charts]=await Promise.all([json('design/tokens/QELLY_DESIGN_TOKENS.json'),json('design/tokens/QELLY_MOTION_TOKENS.json'),json('design/tokens/QELLY_CHART_TOKENS.json')]);
  assert.equal(Object.keys(tokens.semanticTokens).length,30);
  for(const token of Object.values(tokens.semanticTokens)){assert.ok(token.light&&token.dark&&token.highContrast);assert.ok(token.contrastRule&&token.usage);}
  assert.equal(Object.keys(tokens.typography.roles).length,24);
  assert.equal(motion.reducedMotion.meaningPreserved,true);
  assert.equal(charts.requirements.textTableAlternative,true);
  assert.equal(charts.requirements.nonColorEncoding,true);
});

test('governed shell has progressive desktop and mobile layers',async()=>{
  const [html,css,shell,premiumMobile]=await Promise.all([read('apps/web/public/index.html'),read('apps/web/public/assets/qelly-foundations.css'),read('apps/web/public/assets/shell-foundations.mjs'),read('apps/web/public/assets/premium-mobile.css')]);
  for(const id of ['edge-dock','persona-ribbon','context-shelf','compare-tray','mobile-navigation'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(shell,/visibleRoutes\.filter/);
  assert.match(shell,/data-shelf-route/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(premiumMobile,/@media\(max-width:920px\)/);
  assert.match(premiumMobile,/safe-area-inset-bottom/);
});

test('Figma handoff uses semantic editable masters instead of frame-count theater',async()=>{
  const [plugin,manifest,screenMatrix,componentMatrix,spec]=await Promise.all([
    read('design/figma/plugins/core/code.js'),json('design/figma/plugins/core/manifest.json'),read('design/figma/QELLY_FIGMA_SCREEN_MATRIX.csv'),read('design/figma/QELLY_FIGMA_COMPONENT_MATRIX.csv'),read('design/figma/QELLY_FIGMA_MASTER_SPEC.md')
  ]);
  const pages=plugin.match(/const PAGE_NAMES=\[([\s\S]*?)\];/)[1].match(/'\d{2} [^']+'/g);
  const masterScreens=plugin.match(/const MASTER_SCREENS=\[([\s\S]*?)\];/)[1].match(/\['/g);
  assert.equal(pages.length,31);
  assert.ok(masterScreens.length>=42);
  assert.match(plugin,/createVariableCollection\('Qelly Premium Semantic'\)/);
  assert.match(plugin,/createComponent\(\)/);
  assert.match(plugin,/qellyMasterFrame/);
  assert.doesNotMatch(plugin,/EXPECTED_FRAME_COUNT|Expected 411 frames/);
  assert.equal(manifest.networkAccess.allowedDomains[0],'none');
  assert.ok(screenMatrix.trim().split('\n').length-1>=12);
  assert.ok(componentMatrix.trim().split('\n').length-1>=10);
  assert.match(spec,/opened and visually reviewed/i);
});
