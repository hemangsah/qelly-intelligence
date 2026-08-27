import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('release identity sync accepts only internal scheduler calls and the canonical Cloudflare artifact',async()=>{
  const source=await read('supabase/functions/qelly-release-identity-sync/index.ts');
  assert.match(source,/INTERNAL_SCHEDULER_AUTH_REQUIRED/);
  assert.match(source,/https:\/\/qelly-intelligence\.pages\.dev/);
  assert.match(source,/qelly-release\.json/);
  assert.match(source,/\^\[0-9a-f\]\{40\}\$/);
  assert.match(source,/cloudflare-pages-public-runtime/);
  assert.match(source,/CANONICAL_SITE_IDENTITY_MISMATCH/);
  assert.match(source,/qelly_release_identity/);
  assert.match(source,/searchParams\.set\("verify",crypto\.randomUUID\(\)\)/);
  assert.match(source,/"cache-control":"no-cache"/);
  assert.doesNotMatch(source,/admin\.auth\.getUser/);
  assert.doesNotMatch(source,/authorization.*Bearer/i);
});

test('release synchronization persists a constrained projection rather than arbitrary remote JSON',async()=>{
  const source=await read('supabase/functions/qelly-release-identity-sync/index.ts');
  for(const field of ['workflowRun','deploymentId','buildTimestamp','cloudMode','authentication','emailDelivery','cloudSync','liveProviders','protectedWrites','publicSiteUrl'])assert.match(source,new RegExp(field));
  assert.doesNotMatch(source,/metadata\s*:\s*release/);
  assert.match(source,/environment:"production"/);
  assert.match(source,/source_revision:String\(release\.releaseSha\)/);
});

test('release identity sync pins its Supabase Edge Runtime dependencies exactly',async()=>{
  const source=await read('supabase/functions/qelly-release-identity-sync/index.ts');
  assert.match(source,/jsr:@supabase\/functions-js@2\.112\.4\/edge-runtime\.d\.ts/);
  assert.match(source,/npm:@supabase\/supabase-js@2\.112\.4/);
  assert.doesNotMatch(source,/jsr:@supabase\/functions-js\/edge-runtime\.d\.ts/);
  assert.doesNotMatch(source,/npm:@supabase\/supabase-js@2["']/);
});

test('operator scheduler source uses Vault references only and schedules both provider ingestion and release sync',async()=>{
  const source=await read('supabase/migrations/20260816022000_qelly_internal_scheduler_and_release_identity_v1.sql');
  assert.match(source,/qelly_internal_scheduler_key/);
  assert.match(source,/qelly-ecb-provider-ingestion/);
  assert.match(source,/qelly-release-identity-sync/);
  assert.match(source,/vault\.decrypted_secrets/);
  assert.doesNotMatch(source,/[A-Za-z0-9_-]{56,}/);
  assert.doesNotMatch(source,/vault\.create_secret\('\w{40,}/);
});

test('obsolete provider-specific scheduler alias is explicitly retired',async()=>{
  const source=await read('supabase/migrations/20260816022100_qelly_retire_provider_ingestion_secret_alias_v1.sql');
  assert.match(source,/delete from vault\.secrets where name='qelly_provider_ingestion_key'/);
});
