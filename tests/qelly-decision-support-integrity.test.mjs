import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateDecision} from '../apps/web/public/assets/qelly-decision-engine.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('decision support is deterministic and separates evidence from inference',()=>{
  const input={assetId:'QI-CRYPTO-BTC',horizon:'30d',risk:'balanced',evidenceConfidence:75,scenarioMove:-12,thesis:'Liquidity remains resilient.',invalidationCondition:'Provider agreement falls below the governed threshold.'};
  const first=evaluateDecision(input);
  const second=evaluateDecision(input);
  assert.deepEqual(first,second);
  assert.equal(first.execution,false);
  assert.equal(first.decisionRecord.status,'considered-not-executed');
  assert.equal(first.decisionRecord.humanOverrideRequired,true);
  assert.equal(first.observedFacts.length,0);
  assert.ok(first.scenarioObservations.length>0);
  assert.ok(first.derivedMetrics.length>0);
  assert.ok(first.inferences.length>0);
  assert.ok(first.assumptions.some((value)=>value.includes('Human thesis')));
  assert.ok(first.contradictions.length>0);
  assert.ok(first.uncertainty.length>0);
  assert.ok(first.missingInformation.length>0);
  assert.equal(first.sourceQuality.dimensions.freshness,0);
  assert.equal(first.sourceQuality.dimensions.providerAgreement,0);
  assert.match(first.sourceQuality.interpretation,/not current market truth/i);
  assert.equal(first.methodology.version,'2.0.0');
  assert.match(first.boundary,/No live provider observations/i);
});

test('decision support UI names assumptions, source quality, invalidation and execution boundaries',async()=>{
  const [route,engine,brandCorrection,index,fontGovernance]=await Promise.all([
    read('apps/web/public/assets/routes/decision-provenance.mjs'),
    read('apps/web/public/assets/qelly-decision-engine.mjs'),
    read('apps/web/public/assets/qelly-brand-visual-correction.mjs'),
    read('apps/web/public/index.html'),
    read('apps/web/public/assets/qelly-font-governance.css')
  ]);
  for(const phrase of ['User-assessed evidence confidence','Invalidation condition','Observed facts','Scenario observations','Missing information','Source quality','Methodology','considered-not-executed'])assert.match(route,new RegExp(phrase));
  for(const field of ['sourceQuality','sourceRecords','observedFacts','derivedMetrics','inferences','assumptions','uncertainty','missingInformation','methodology','decisionRecord'])assert.match(engine,new RegExp(field));
  assert.match(brandCorrection,/qelly-symbol\.svg/);
  assert.match(brandCorrection,/correctWorkspaceSwitcherBrand/);
  assert.match(index,/qelly-font-governance\.css/);
  assert.match(index,/ibm-plex-sans-variable\.woff2/);
  assert.match(fontGovernance,/IBM Plex Sans Variable/);
});
