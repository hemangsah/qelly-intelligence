import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('decision-provenance remains a thin compatibility route to the authoritative live workspace',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-provenance.mjs');
  assert.match(route,/renderDecisionProvenGraph/);
  assert.match(route,/Compatibility route/);
  assert.doesNotMatch(route,/AI Decision Maker|buildLocalDecisionGraph|evaluateDecision|fixed scenario|qelly-v54-decision-provenance/);
});

test('authoritative Decision Intelligence retains research safety and core workflows',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const phrase of [
    'QELLY Decision Intelligence',
    'QELLY VIEW',
    'Find Trade Now',
    'Risk / reward',
    '1:1',
    '1:2',
    '1:3',
    '1:4',
    'Auto',
    'Open QELLY Chat',
    'Methodology / Sources',
    'DECISION TRACE · EVIDENCE GRAPH',
    'WHAT CHANGED?'
  ])assert.match(route,new RegExp(phrase.replace(/[?]/g,'\\?')));
  assert.match(route,/Public research · no sign-in required · no trade execution/);
  assert.match(route,/NO TRADE/);
});

test('superseded Decision demo bundle is absent and global shell no longer annotates deleted controls',async()=>{
  await assert.rejects(read('apps/web/public/assets/qelly-decision-engine.mjs'));
  await assert.rejects(read('apps/web/public/assets/qelly-v54-decision-provenance.css'));
  const shell=await read('apps/web/public/assets/qelly-ui-lock-v5-3.mjs');
  assert.doesNotMatch(shell,/annotateDecisionProvenanceControls|evidenceConfidence|scenarioMove/);
});

test('brand and self-hosted font governance remain intact after Decision cleanup',async()=>{
  const [brandCorrection,index,fontGovernance,build]=await Promise.all([
    read('apps/web/public/assets/qelly-brand-visual-correction.mjs'),
    read('apps/web/public/index.html'),
    read('apps/web/public/assets/qelly-font-governance.css'),
    read('scripts/build-frontend.mjs')
  ]);
  assert.match(brandCorrection,/qelly-symbol\.svg/);
  assert.match(brandCorrection,/correctWorkspaceSwitcherBrand/);
  assert.match(index,/qelly-font-governance\.css/);
  assert.doesNotMatch(index,/rel=["']preload["'][^>]*ibm-plex-sans-variable\.woff2/i);
  assert.match(fontGovernance,/ibm-plex-sans-variable\.woff2/);
  assert.match(fontGovernance,/IBM Plex Sans Variable/);
  assert.match(build,/ibm-plex-sans-variable\.woff2/);
});
