import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PUBLIC_BETA_TRUTH_STATES, createEvidenceEnvelope, isConnectedState } from '../src/public-beta/truth-state.mjs';
import { PublicBetaProviderAdapter, ProviderAdapterError } from '../src/public-beta/provider-adapter.mjs';
import { validatePublicBetaRuntimeConfig } from '../src/public-beta/runtime-config.mjs';
import { createObservabilityEvent } from '../src/public-beta/observability.mjs';

const source = (relative) => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');

test('public-beta truth-state universe is complete and non-ambiguous', () => {
  assert.deepEqual(PUBLIC_BETA_TRUTH_STATES, [
    'LIVE','DELAYED','CACHED','DETERMINISTIC_LOCAL','SIMULATED','ESTIMATED','EMBEDDED',
    'UNAVAILABLE','STALE','PARTIAL','REQUIRES_AUTHORIZATION','REQUIRES_LICENSE','DEMO'
  ]);
  assert.equal(isConnectedState('LIVE'), true);
  assert.equal(isConnectedState('SIMULATED'), false);
});

test('evidence envelopes require source, lineage, entitlement and valid timing', () => {
  const evidence = createEvidenceEnvelope({
    state: 'DETERMINISTIC_LOCAL',
    source: 'Qelly formula engine',
    observedAt: '2026-07-29T00:00:00.000Z',
    retrievedAt: '2026-07-29T00:00:05.000Z',
    confidence: 1,
    entitlement: 'local',
    lineageId: 'test-vector-1'
  });
  assert.equal(evidence.freshnessSeconds, 5);
  assert.throws(() => createEvidenceEnvelope({ state: 'LIVE' }), /source/);
});

test('provider adapter exposes timeout, kill switch and health boundaries', async () => {
  const adapter = new PublicBetaProviderAdapter({ id: 'test-provider', timeoutMs: 100 });
  assert.equal(await adapter.request(async () => 7), 7);
  assert.ok(adapter.health().lastSuccessAt);
  adapter.setKillSwitch(true);
  await assert.rejects(adapter.request(async () => 1), (error) => error instanceof ProviderAdapterError && error.code === 'PROVIDER_DISABLED');
});

test('runtime config hard-disables trading, custody and secret material', () => {
  const config = validatePublicBetaRuntimeConfig({
    environment: 'preview',
    publicBasePath: '/qelly-intelligence/',
    flags: { publicBetaTruthLabels: true }
  });
  assert.equal(config.realMoneyTrading, false);
  assert.equal(config.custody, false);
  assert.throws(() => validatePublicBetaRuntimeConfig({ environment: 'production', flags: { realMoneyTrading: true } }), /safety boundary/);
});

test('observability redacts secret-like fields recursively', () => {
  const event = createObservabilityEvent({
    type: 'test',
    message: 'redaction',
    context: { token: 'unsafe', nested: { privateKey: 'unsafe', safe: 3 } }
  });
  assert.equal(event.context.token, '[REDACTED]');
  assert.equal(event.context.nested.privateKey, '[REDACTED]');
  assert.equal(event.context.nested.safe, 3);
});

test('public-beta schemas and feature gates remain committed', async () => {
  const truth = JSON.parse(await source('packages/schemas/public-beta-truth-state.schema.json'));
  const evidence = JSON.parse(await source('packages/schemas/public-beta-evidence-metadata.schema.json'));
  const flags = JSON.parse(await source('config/public-beta.feature-flags.json'));
  const environments = JSON.parse(await source('config/public-beta.environments.json'));
  assert.equal(truth.enum.length, 13);
  assert.ok(evidence.required.includes('lineageId'));
  assert.equal(flags.flags.realMoneyTrading.state, 'hard-disabled');
  assert.equal(environments.invariants.seedPhraseCollection, false);
});
