import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__profileRouteTest} from '../functions/api/v1/profile.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('only authenticated provider metadata is surfaced; never identities or OAuth secrets',()=>{
 const {sanitizedLinkedIdentities,profilePayload}=__profileRouteTest;
 const list=sanitizedLinkedIdentities([
  {provider:'google',created_at:'2026-09-01T00:00:00Z',last_sign_in_at:'2026-09-03T00:00:00Z',identity_data:{access_token:'NEVER',email:'sensitive@example.test'},provider_id:'PRIVATE',id:'SECRET'},
  {provider:'linkedin_oidc',created_at:'2026-09-02T00:00:00Z',identity_data:{contacts:['PRIVATE']}},
  {provider:'evil-provider',identity_data:{access_token:'NEVER'}}
 ]);
 assert.deepEqual(list.items.map(x=>x.provider),['google','linkedin_oidc']);
 assert.deepEqual(Object.keys(list.items[0]),['provider','label','linkedAt','lastSignInAt']);
 assert.equal(list.state,'available');assert.equal(list.readOnly,true);assert.equal(list.linkingEnabled,false);assert.equal(list.unlinkingEnabled,false);
 assert.doesNotMatch(JSON.stringify(list),/SECRET|PRIVATE|NEVER|sensitive@example/);
 assert.equal(sanitizedLinkedIdentities(undefined).state,'unavailable');
 assert.equal(sanitizedLinkedIdentities([]).state,'available');
 const profile=profilePayload({user:{userId:'user',email:'user@example.test'},profile:{},workspace:{workspaceId:'workspace',name:'Private'},session:{}},{capabilities:{cloudSync:false}},[{provider:'apple',identity_data:{secret:'NO'}}]);
 assert.deepEqual(profile.linkedIdentities.items.map(x=>x.label),['Apple']);
 assert.doesNotMatch(JSON.stringify(profile),/NO/);
});
test('provider identity visibility remains authenticated-only and never writes raw provider payloads',async()=>{
 const src=await read('functions/api/v1/profile.js');
 assert.match(src,/resolveSession\(request,env,\{required:true\}\)/);
 assert.match(src,/profilePayload\(qelly,runtime,session\.user\?\.identities\)/);
 assert.match(src,/cache:'private, no-store'/);
 assert.doesNotMatch(src,/\.provider_token|\.identity_data|SUPABASE_SERVICE_ROLE_KEY/);
});
test('account page presents truthful read-only inventory and gates actual MFA and passkey links',async()=>{
 const [source,css]=await Promise.all([read('apps/web/public/assets/routes/account-session.mjs'),read('apps/web/public/assets/routes/account-session-v6.css')]);
 assert.match(source,/data-identity-inventory-state/);
 assert.match(source,/linked\.items\.map\(item/);
 assert.match(source,/Linking or unlinking additional providers is not enabled/);
 assert.match(source,/api\('\/api\/v1\/auth\/mfa\/status'\)\.catch\(\(\)=>null\)/);
 assert.doesNotMatch(source,/api\('\/api\/v1\/auth\/passkeys'/);
 assert.match(source,/const passkeysReady=false/);
 assert.match(source,/mfaReady\?'<a class="q-v6-security-action"/);
 assert.match(source,/passkeysReady\?'<a class="q-v6-security-action"/);
 assert.doesNotMatch(source,/api\('\/api\/v1\/auth\/identities\/link'/);
 assert.match(css,/\.q-v6-linked-identities/);assert.match(css,/min-height:44px/);
 assert.match(css,/:focus-visible/);
});
