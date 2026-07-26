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
  assert.equal(routeDefinitions.length,61);
  assert.ok(productDomains.length>=8);
  const domains=new Set(productDomains.map((item)=>item.id));
  const kinds=new Set(['public-story','analytical','research','operational','access']);
  assert.ok(routeDefinitions.every((route)=>domains.has(route.domain)));
  assert.ok(routeDefinitions.every((route)=>kinds.has(route.kind)));
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
  await assert.rejects(
    staticPreviewRequest('/api/v1/evidence/explain-move',{method:'POST'}),
    (error)=>error.code==='static_visual_preview_backend_unavailable'
  );
});

test('canonical design tokens cover every mode, typography role, and chart truth requirement',async()=>{
  const [tokens,motion,charts]=await Promise.all([
    json('QELLY_DESIGN_TOKENS.json'),
    json('QELLY_MOTION_TOKENS.json'),
    json('QELLY_CHART_TOKENS.json')
  ]);
  assert.equal(Object.keys(tokens.semanticTokens).length,30);
  for(const token of Object.values(tokens.semanticTokens)){
    assert.ok(token.light&&token.dark&&token.highContrast);
    assert.ok(token.contrastRule&&token.usage);
  }
  assert.equal(Object.keys(tokens.typography.roles).length,24);
  assert.equal(motion.reducedMotion.meaningPreserved,true);
  assert.equal(charts.requirements.textTableAlternative,true);
  assert.equal(charts.requirements.nonColorEncoding,true);
});

test('governed shell has progressive desktop and mobile layers',async()=>{
  const [html,css,shell]=await Promise.all([
    read('apps/web/public/index.html'),
    read('apps/web/public/assets/qelly-foundations.css'),
    read('apps/web/public/assets/shell-foundations.mjs')
  ]);
  for(const id of ['edge-dock','persona-ribbon','context-shelf','compare-tray','mobile-navigation'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(shell,/visibleRoutes\.filter/);
  assert.match(shell,/data-shelf-route/);
  assert.match(css,/@media\(max-width:920px\)/);
  assert.match(css,/prefers-reduced-motion/);
});

test('Figma handoff and CSV matrix agree on 411 meaningful frames',async()=>{
  const [plugin,manifest,matrix]=await Promise.all([
    read('figma-plugin/code.js'),
    json('figma-plugin/manifest.json'),
    read('QELLY_SCREEN_MATRIX.csv')
  ]);
  assert.match(plugin,/EXPECTED_FRAME_COUNT=411/);
  const pluginRoutes=plugin.match(/const ROUTE_ROWS=`([\s\S]*?)`\.trim\(\)\.split/)[1].trim().split('\n').length;
  const pluginPages=plugin.match(/const PAGE_NAMES=\[([\s\S]*?)\];/)[1].match(/'\d+ —/g).length;
  assert.equal(pluginRoutes,61);
  assert.equal(pluginPages,25);
  assert.equal(pluginPages+(pluginRoutes*2)+(6*12*2)+(12*8)+24,411);
  assert.equal(manifest.networkAccess.allowedDomains[0],'none');
  assert.equal(matrix.trim().split('\n').length-1,411);
  for(const header of ['route','purpose','viewport','persona','state','source_requirements','backend_dependencies','interaction_notes','accessibility_notes','responsive_notes'])assert.match(matrix.split('\n')[0],new RegExp(`"${header}"`));
});
