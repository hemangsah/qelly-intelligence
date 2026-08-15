import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const catchAll=await readFile(new URL('../functions/api/v1/[[path]].js',import.meta.url),'utf8');
const middleware=await readFile(new URL('../functions/api/v1/_middleware.js',import.meta.url),'utf8');
const config=await readFile(new URL('../functions/api/v1/config.js',import.meta.url),'utf8');
const health=await readFile(new URL('../functions/api/v1/health.js',import.meta.url),'utf8');
const readiness=await readFile(new URL('../functions/api/v1/readiness.js',import.meta.url),'utf8');

test('dedicated operational endpoints have one source owner',()=>{
  assert.doesNotMatch(catchAll,/path==='config'/);
  assert.doesNotMatch(catchAll,/path==='health'/);
  assert.doesNotMatch(catchAll,/path==='readiness'/);
  assert.doesNotMatch(middleware,/interceptReadiness/);
  assert.doesNotMatch(middleware,/collectReadinessEvidence/);
  assert.doesNotMatch(middleware,/readinessSnapshot/);
  assert.match(config,/effectivePublicRuntimeConfig/);
  assert.match(health,/effectivePublicRuntimeConfig/);
  assert.match(readiness,/collectReadinessEvidence/);
  assert.match(readiness,/readinessSnapshot/);
});

test('obsolete readiness claims cannot return from shadow runtimes',()=>{
  for(const source of [catchAll,middleware]){
    assert.doesNotMatch(source,/smtp_delivery_blocked/);
    assert.doesNotMatch(source,/configured_not_canaried/);
    assert.doesNotMatch(source,/required_not_live_proven/);
  }
});
