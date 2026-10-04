import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__profileRouteTest as profile} from '../functions/api/v1/profile.js';

const context={
 user:{userId:'00000000-0000-4000-8000-000000000001',email:'account@example.invalid',emailConfirmedAt:null,displayName:'Test'},
 profile:{display_name:'Test',base_currency:'USD',timezone:'UTC'},
 workspace:{workspaceId:'00000000-0000-4000-8000-000000000002',name:'Test Workspace'},
 session:{}
};
test('GoTrue identity-only dates are normalized and absent values remain unavailable',()=>{
 const observed=profile.verifiedIdentityDates({
  created_at:'2026-10-01T03:04:05.123456+00:00',
  last_sign_in_at:'2026-10-03T06:07:08Z',
  user_metadata:{made_up_date:'2024-01-01T00:00:00Z'}
 });
 assert.deepEqual(observed,{accountCreatedAt:'2026-10-01T03:04:05.123Z',lastSignInAt:'2026-10-03T06:07:08.000Z'});
 assert.deepEqual(profile.verifiedIdentityDates({}),{accountCreatedAt:null,lastSignInAt:null});
 assert.equal(profile.identityDate('2026-10-03'),null);
 assert.equal(profile.identityDate('the best person to sign in'),null);
 assert.equal(profile.identityDate('2026-13-32T01:02:03Z'),null);
 assert.equal(profile.identityDate('2026-02-31T01:02:03Z'),null);
 assert.equal(profile.identityDate('<script>alert(1)</script>'),null);
});
test('profile user payload reveals only bounded authenticated dates and never provider subjects',()=>{
 const provided=profile.verifiedIdentityDates({created_at:'2026-10-01T03:04:05Z',last_sign_in_at:'2026-10-03T06:07:08Z'});
 const payload=profile.profilePayload(context,{capabilities:{cloudSync:true}},[],provided);
 assert.equal(payload.user.accountCreatedAt,'2026-10-01T03:04:05.000Z');
 assert.equal(payload.user.lastSignInAt,'2026-10-03T06:07:08.000Z');
 assert.equal(payload.linkedIdentities.linkingEnabled,false);
 const unavailable=profile.profilePayload(context);
 assert.equal(unavailable.user.accountCreatedAt,null);
 assert.equal(unavailable.user.lastSignInAt,null);
 assert.doesNotMatch(JSON.stringify(payload),/access_token|refresh_token|identity_data|raw_user_meta_data/);
});
test('GET and PATCH use the same current authenticated GoTrue user as the timestamp source',async()=>{
 const api=await readFile(new URL('../functions/api/v1/profile.js',import.meta.url),'utf8');
 assert.equal(api.split('verifiedIdentityDates(session.user)').length-1,2);
 assert.match(api,/resolveSession\(request,env,\{required:true\}\)/);
 assert.match(api,/requireCsrf\(request\)/);
 assert.doesNotMatch(api,/SUPABASE_SERVICE_ROLE_KEY|service_role/i);
});
test('account panel shows verified timeline as optional fields with honest missing-state labels',async()=>{
 const ui=await readFile(new URL('../apps/web/public/assets/routes/account-session.mjs',import.meta.url),'utf8');
 for(const marker of ['Account created','Last sign-in','date(user.accountCreatedAt)','date(user.lastSignInAt)'])assert.ok(ui.includes(marker),marker);
 assert.match(ui,/Not supplied/);
 assert.doesNotMatch(ui,/Date\.now\(\).*lastSignInAt|new Date\(\).*accountCreatedAt/);
});
