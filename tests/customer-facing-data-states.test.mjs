import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {providerAvailability,providerPolicyMessage,humanizeOperationalState} from '../apps/web/public/assets/customer-copy.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('provider policy codes remain machine-readable in APIs but are translated for customers',()=>{
  assert.equal(providerPolicyMessage({termsState:'blocked_pending_redistribution_rights'}),'Market data display is awaiting redistribution approval.');
  assert.equal(providerPolicyMessage({termsState:'blocked_pending_written_end_user_display_permission'}),'End-user display is awaiting written provider approval.');
  assert.equal(providerPolicyMessage({termsState:'conditionally_approved_attributed_reference_data'}),'Approved for attributed reference use.');
  assert.deepEqual(providerAvailability({id:'ecb',enabled:true}),{label:'Approved reference',tone:'delayed'});
  assert.deepEqual(providerAvailability({id:'binance',enabled:false}),{label:'Awaiting approval',tone:'cached'});
  assert.equal(humanizeOperationalState('UNAVAILABLE_PENDING_PRIMARY_SOURCE_REVERIFICATION'),'Primary source review in progress.');
});

test('signed-in account presentation omits implementation identifiers and policy clutter',async()=>{
  const source=await read('apps/web/public/assets/routes/account-session.mjs');
  for(const visibleCopy of ['Signed in securely','Secure cloud','Workspace protected','Security tools','Coming soon'])assert.match(source,new RegExp(visibleCopy));
  assert.doesNotMatch(source,/Workspace ID|User ID|Privacy version|Terms version|engineering debt|supabase-email-password|Technical identifiers/i);
  assert.doesNotMatch(source,/api\('\/api\/v1\/platform\/capabilities'\)/);
});

test('event calendar uses the public monitoring-plan contract without fixture or protected event data',async()=>{
  const source=await read('apps/web/public/assets/routes/event-calendar.mjs');
  assert.doesNotMatch(source,/api\/v1\/asset-intelligence|Object\.groupBy|fixture/i);
  assert.match(source,/api\/v1\/discovery\/event-calendar/);
  assert.match(source,/Turn uncertainty into an event plan/);
  assert.match(source,/No connected calendar feed/);
  assert.match(source,/does not fetch the source, verify its contents, create an alert or invent a date/);
});

test('customer routes use the shared presentation boundary instead of raw provider codes',async()=>{
  const paths=[
    'apps/web/public/assets/routes/market-v6.mjs',
    'apps/web/public/assets/routes/governed-discovery.mjs',
    'apps/web/public/assets/routes/governed-utility-v2.mjs',
    'apps/web/public/assets/routes/asset-rankings-premium.mjs',
    'apps/web/public/assets/routes/platform-readiness.mjs',
    'apps/web/public/assets/routes/provider-runtime-v6.mjs',
    'apps/web/public/assets/routes/intelligence-terminal.mjs',
    'apps/web/public/assets/qelly-canonical-route-rescue.mjs'
  ];
  const sources=await Promise.all(paths.map(read));
  for(const source of sources)assert.match(source,/customer-copy\.mjs/);
  for(const source of sources)assert.doesNotMatch(source,/escapeHtml\(provider\.(?:termsState|reason)|esc\(provider\.(?:termsState|reason)/);
});
