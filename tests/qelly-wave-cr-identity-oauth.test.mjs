import test from 'node:test';
import assert from 'node:assert/strict';
import {OAUTH_PROVIDERS,approvedOAuthProvider,enabledOAuthProviders,publicOAuthProviders,oauthAuthorizeUrl} from '../functions/_lib/qelly-oauth-providers.js';
import {handleAuth,__authTest} from '../functions/_lib/auth.js';
import {readFile} from 'node:fs/promises';

const env=Object.freeze({
  QELLY_PUBLIC_SITE_URL:'https://terminal.qellyintelligence.com',
  QELLY_PUBLIC_SUPABASE_URL:'https://ssdgfgqnjlwzkgukzeef.supabase.co',
  QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_TEST_ONLY_not_a_real_credential'
});
const transaction=Object.freeze({
  state:'a'.repeat(64),
  nonce:'b'.repeat(64),
  challenge:'c'.repeat(43)
});
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave CR supports exactly four identity-only providers with no elevated permissions',()=>{
  assert.deepEqual(Object.keys(OAUTH_PROVIDERS),['google','apple','linkedin','facebook']);
  for(const provider of Object.values(OAUTH_PROVIDERS)){
    assert.ok(provider.scopes.split(' ').length<=3);
    assert.doesNotMatch(provider.scopes,/(?:gmail|mailbox|contact|posting|feed|calendar|offline_access|w_member_social|r_organization_social|pages_)/i);
    assert.ok(provider.flag.startsWith('QELLY_OAUTH_')&&provider.flag.endsWith('_VERIFIED'));
  }
  assert.equal(OAUTH_PROVIDERS.linkedin.supabaseProvider,'linkedin_oidc');
  assert.equal(approvedOAuthProvider('github'),null);
  assert.equal(approvedOAuthProvider('__proto__'),null);
});

test('Wave CR fails closed before independently verified provider configuration',async()=>{
  assert.deepEqual(enabledOAuthProviders({}),[]);
  assert.deepEqual(publicOAuthProviders(env),[]);
  assert.deepEqual(publicOAuthProviders({...env,QELLY_OAUTH_GOOGLE_VERIFIED:'1'}),[]);
  assert.deepEqual(publicOAuthProviders({...env,QELLY_OAUTH_GOOGLE_VERIFIED:'true'}),[{id:'google',label:'Google'}]);
  const request=new Request('https://terminal.qellyintelligence.com/api/v1/auth/oauth/providers',{method:'GET'});
  const response=await handleAuth({request,env},'auth/oauth/providers','GET');
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.deepEqual(payload.providers,[]);
  assert.match(payload.boundary,/no Gmail, mailbox, contacts, posting or calendar access/);
  assert.ok(__authTest.AUTH_FLOWS.has('oauth'));
});

test('Wave CR never accepts supplied redirect destinations or provider scope overrides',()=>{
  for(const provider of Object.values(OAUTH_PROVIDERS)){
    const url=new URL(oauthAuthorizeUrl({...env,supabaseUrl:env.QELLY_PUBLIC_SUPABASE_URL,publicSiteUrl:env.QELLY_PUBLIC_SITE_URL},transaction,provider.id));
    assert.equal(url.origin,env.QELLY_PUBLIC_SUPABASE_URL);
    assert.equal(url.pathname,'/auth/v1/authorize');
    assert.equal(url.searchParams.get('provider'),provider.supabaseProvider);
    assert.equal(url.searchParams.get('scopes'),provider.scopes);
    assert.equal(url.searchParams.get('code_challenge_method'),'s256');
    assert.equal(url.searchParams.get('code_challenge'),transaction.challenge);
    const redirect=new URL(url.searchParams.get('redirect_to'));
    assert.equal(redirect.origin,env.QELLY_PUBLIC_SITE_URL);
    assert.equal(redirect.pathname,'/auth/callback.html');
    assert.equal(redirect.searchParams.get('flow'),'oauth');
    assert.equal(redirect.searchParams.get('state'),transaction.state);
    assert.equal(redirect.searchParams.get('nonce'),transaction.nonce);
  }
  assert.throws(()=>oauthAuthorizeUrl({supabaseUrl:'http://insecure.example',publicSiteUrl:env.QELLY_PUBLIC_SITE_URL},transaction,'google'),/HTTPS/);
  assert.throws(()=>oauthAuthorizeUrl({supabaseUrl:env.QELLY_PUBLIC_SUPABASE_URL,publicSiteUrl:env.QELLY_PUBLIC_SITE_URL},{...transaction,state:'wrong'},'google'),/PKCE/);
  assert.throws(()=>oauthAuthorizeUrl({supabaseUrl:env.QELLY_PUBLIC_SUPABASE_URL,publicSiteUrl:env.QELLY_PUBLIC_SITE_URL},transaction,'unknown'),/Unsupported/);
});

test('Wave CR frontend renders attested providers only and keeps PKCE tokens server-side',async()=>{
  const [route,callback,backend]=await Promise.all([
    read('apps/web/public/assets/routes/auth-login.mjs'),
    read('apps/web/public/assets/qelly-auth-callback.mjs'),
    read('functions/_lib/auth.js')
  ]);
  assert.match(route,/api\/v1\/auth\/oauth\/providers/);
  assert.match(route,/api\/v1\/auth\/oauth\/start/);
  assert.match(route,/Array\.isArray\(providerResponse\?\.providers\)/);
  assert.match(route,/Object\.hasOwn\(identityLabels/);
  assert.match(route,/redirect\.searchParams\.get\('scopes'\)!==identityScopes\[provider\]/);
  assert.match(route,/No inbox, contacts, posts or calendar permissions/);
  assert.doesNotMatch(route,/provider_token|provider_refresh_token|mail\.google|gmail\.readonly|gmail\.modify/);
  assert.match(callback,/flow==='oauth'/);
  assert.match(callback,/clearSensitiveUrl\(\)/);
  assert.match(backend,/cookie:cookie\(AUTH_TRANSACTION_COOKIE/);
  assert.match(backend,/responseJson\(request,env,\{[\s\S]*callbackMode:'pkce-code'/);
  assert.doesNotMatch(backend,/provider_access_token|provider_refresh_token/);
});
