import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('post-BP public-runtime verifier distinguishes executable inline JS from JSON-LD',async()=>{
  const workflow=await read('.github/workflows/public-runtime.yml');
  assert.match(workflow,/executableInlineScriptCount/);
  assert.match(workflow,/structuredDataScriptCount/);
  assert.match(workflow,/application\/ld\+json/);
  assert.match(workflow,/application\/json/);
  assert.match(workflow,/dom\.executableInlineScriptCount !== 0/);
  assert.doesNotMatch(workflow,/dom\.inlineScriptCount !== 0/);
});

test('post-BP verifier still fails executable inline scripts and startup failures',async()=>{
  const workflow=await read('.github/workflows/public-runtime.yml');
  assert.match(workflow,/startupFailure: Boolean\(document\.querySelector\('\.q-startup-failure'\)\)/);
  assert.match(workflow,/startup_or_csp_failure/);
  assert.match(workflow,/content security policy\|refused to execute inline\|violates\.\*script-src/i);
});

test('post-BP chaos summary emits request counts only from authoritative requestCounts',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  const scannerKeys=source.match(/decisionChaosScannerRequests:/g)||[];
  const decisionKeys=source.match(/decisionChaosDecisionRequests:/g)||[];
  assert.equal(scannerKeys.length,1);
  assert.equal(decisionKeys.length,1);
  assert.match(source,/decisionChaosDecisionRequests:report\.decisionChaosStability\?\.requestCounts\?\.decision\?\?0/);
  assert.match(source,/decisionChaosScannerRequests:report\.decisionChaosStability\?\.requestCounts\?\.scanner\?\?0/);
  assert.doesNotMatch(source,/decisionChaosStability\?\.scannerRequests/);
  assert.doesNotMatch(source,/decisionChaosStability\?\.decisionRecomputes/);
});
