import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__test as apiTest} from '../functions/api/v1/[[path]].js';

const env=()=>({
  QELLY_PUBLIC_SITE_URL:'https://qelly-intelligence.pages.dev',
  QELLY_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
  QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_key_long_enough_for_validation',
  QELLY_PUBLIC_RELEASE_SHA:'98a88d76bbba1017a40012aa2790213af6af485a'
});

test('readiness remains not proven until end-to-end canaries exist',async()=>{
  const request=new Request('https://qelly-intelligence.pages.dev/api/v1/readiness');
  const response=await apiTest.route({request,env:env(),params:{path:['readiness']}});
  const body=await response.json();
  assert.equal(response.status,503);
  assert.equal(body.ready,false);
  assert.equal(body.status,'not_proven');
  assert.equal(body.dependencies.auth,'smtp_delivery_blocked');
  assert.equal(body.dependencies.providers,'restricted_by_rights_review');
});

test('placeholder job, notification and foundation-ready routes are absent',async()=>{
  const router=await readFile(new URL('../functions/api/v1/[[path]].js',import.meta.url),'utf8');
  assert.doesNotMatch(router,/path==='jobs'/);
  assert.doesNotMatch(router,/path==='production-notifications'/);
  assert.doesNotMatch(router,/path==='production-foundation\/status'/);
  assert.match(router,/status:response\?\.status\?\?500/);
});

test('account page describes only the current browser session',async()=>{
  const account=await readFile(new URL('../apps/web/public/assets/routes/account-session.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(account,/\/api\/v1\/jobs/);
  assert.doesNotMatch(account,/\/api\/v1\/production-notifications/);
  assert.doesNotMatch(account,/\/api\/v1\/production-foundation\/status/);
  assert.match(account,/Current browser session/);
  assert.match(account,/not a complete multi-device session inventory/);
  assert.match(account,/Sign out this browser/);
});
