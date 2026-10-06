import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAuth,__authTest} from '../functions/_lib/auth.js';
import {authenticationEvidence,sessionAuthenticationMethod,requireRecentLinkSession,assertLinkSession,validatedIdentityConsentUrl,identityLinkAuthorizePath} from '../functions/_lib/qelly-identity-linking.js';
import {__profileRouteTest} from '../functions/api/v1/profile.js';
import {bootstrapContext} from '../functions/_lib/runtime.js';

const userId='933c72c3-852e-4c30-97ea-9b3e21bd9e87',sessionId='933c72c3-852e-4c30-97ea-9b3e21bd9e88',otherId='933c72c3-852e-4c30-97ea-9b3e21bd9e89';
const site='https://qelly.test',supabaseUrl='https://project.supabase.co';
const claims=()=>({iss:supabaseUrl+'/auth/v1',aud:'authenticated',sub:userId,session_id:sessionId,exp:Math.floor(Date.now()/1000)+3600,amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}]});
const token=values=>`header.${Buffer.from(JSON.stringify(values)).toString('base64url')}.signature`;
const json=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
const consent=(provider='google')=>{
  const base={google:'https://accounts.google.com/o/oauth2/v2/auth',apple:'https://appleid.apple.com/auth/authorize',linkedin:'https://www.linkedin.com/oauth/v2/authorization',facebook:'https://www.facebook.com/v23.0/dialog/oauth'};
  const scopes={google:'openid email profile',apple:'email name',linkedin:'openid email profile',facebook:'email public_profile'};
  const url=new URL(base[provider]);url.search=new URLSearchParams({scope:scopes[provider],redirect_uri:supabaseUrl+'/auth/v1/callback',client_id:'test-client',state:'provider-state'}).toString();return url;
};
const makeEnv=(fetch)=>({QELLY_PUBLIC_SITE_URL:site,QELLY_PUBLIC_SUPABASE_URL:supabaseUrl,QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_TEST_ONLY_not_a_real_credential',QELLY_OAUTH_GOOGLE_VERIFIED:'true',QELLY_MANUAL_IDENTITY_LINKING_VERIFIED:'true',QELLY_RATE_LIMITER:{limit:async()=>({success:true})},__fetch:fetch});
const request=(path,body,{access=token(claims()),csrf=true,origin=site,transactionCookie=''}={})=>new Request(site+'/api/v1/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{}),cookie:`qelly_sb_access=${access}; qelly_csrf=test-csrf; ${transactionCookie}`,...(csrf?{'X-Qelly-CSRF':'test-csrf'}:{})},body:JSON.stringify(body)});
const user={id:userId,is_anonymous:false,identities:[{provider:'email'}],user_metadata:{provider:'google'}};

test('session method uses verified AMR and never refreshed iat, email or linked provider metadata',async()=>{
  for(const [method,expected] of [['password','supabase-email-password'],['oauth','supabase-oauth'],['otp','supabase-otp'],['magiclink','supabase-magiclink']])assert.equal(sessionAuthenticationMethod({amr:[{method,timestamp:1}]}),expected);
  assert.equal(sessionAuthenticationMethod({iat:Date.now()/1000,user_metadata:{provider:'password'},app_metadata:{provider:'google'}}),null);
  assert.equal(authenticationEvidence({amr:[{method:'token_refresh',timestamp:Date.now()/1000}]}),null);
  assert.equal(authenticationEvidence({amr:[{method:'oauth',timestamp:'1'}]}),null);
  const values=claims();values.amr=[{method:'oauth',timestamp:1},{method:'token_refresh',timestamp:Date.now()/1000}];
  const env=makeEnv(async url=>json(url.includes('qelly_profiles')?[{display_name:'Example'}]:[{id:otherId,name:'Example'}]));
  const context=await bootstrapContext(env,{user,claims:values,accessToken:token(values)});
  assert.equal(context.session.authenticationMethod,'supabase-oauth');assert.equal(context.session.authenticatedAt,'1970-01-01T00:00:01.000Z');assert.equal(context.session.assurance,'aal1');
});

test('manual linking requires independent provider flags, inventory and absent selected identity',()=>{
  const sanitize=__profileRouteTest.sanitizedLinkedIdentities;
  assert.equal(sanitize([],{}).linkingEnabled,false);
  assert.equal(sanitize([],{QELLY_MANUAL_IDENTITY_LINKING_VERIFIED:'true'}).linkingEnabled,false);
  assert.equal(sanitize(undefined,makeEnv()).linkingEnabled,false);
  assert.deepEqual(sanitize([{provider:'email'}],makeEnv()).availableProviders,[{id:'google',label:'Google'}]);
  assert.equal(sanitize([{provider:'google',identity_data:{private:'never return'}}],makeEnv()).linkingEnabled,false);
  assert.doesNotMatch(JSON.stringify(sanitize([{provider:'email'}],makeEnv())),/userId|sessionId|access_token|refresh_token/);
});

test('recent link session rejects recovery, anonymous, stale, future, refresh and missing-session evidence',()=>{
  const valid={user,claims:claims()};assert.deepEqual(requireRecentLinkSession(valid),{userId,sessionId});
  for(const values of [{...claims(),session_id:null},{...claims(),sub:otherId},{...claims(),is_anonymous:true},{...claims(),amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)-601}]},{...claims(),amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)+60}]},{...claims(),amr:[{method:'recovery',timestamp:Math.floor(Date.now()/1000)}]},{...claims(),amr:[{method:'token_refresh',timestamp:Math.floor(Date.now()/1000)}]}])assert.throws(()=>requireRecentLinkSession({user,claims:values}),error=>error.code==='identity_link_reauthentication_required');
  const transaction={flow:'oauth-link',userId,sessionId,provider:'google',issuedAt:Date.now()};assert.doesNotThrow(()=>assertLinkSession(transaction,valid));
  for(const patch of [{userId:otherId},{sessionId:otherId},{issuedAt:Date.now()-600001},{provider:'__proto__'}])assert.throws(()=>assertLinkSession({...transaction,...patch},valid),error=>error.code==='identity_link_session_mismatch');
});

test('provider consent accepts identity-only approved endpoints and rejects scope, origin or callback expansion',()=>{
  for(const provider of ['google','apple','linkedin','facebook'])assert.equal(validatedIdentityConsentUrl(consent(provider).toString(),provider,{supabaseUrl}),consent(provider).toString());
  for(const mutate of [url=>url.searchParams.set('scope','openid email profile gmail.readonly'),url=>url.hostname='accounts.google.com.evil.example',url=>url.searchParams.set('redirect_uri','https://evil.example/callback'),url=>url.hash='token',url=>url.searchParams.append('scope','contacts'),url=>url.pathname='/logout',url=>url.username='user']){
    const url=consent();mutate(url);assert.throws(()=>validatedIdentityConsentUrl(url.toString(),'google',{supabaseUrl}),error=>error.code==='identity_link_consent_invalid');
  }
  const path=identityLinkAuthorizePath({supabaseUrl,publicSiteUrl:site},{state:'a'.repeat(64),nonce:'b'.repeat(64),challenge:'c'.repeat(43)},'google');
  const url=new URL(path,supabaseUrl);assert.equal(url.pathname,'/auth/v1/user/identities/authorize');assert.equal(url.searchParams.get('skip_http_redirect'),'true');assert.equal(new URL(url.searchParams.get('redirect_to')).searchParams.get('flow'),'oauth-link');
});

test('link initiation enforces Origin, authentication, CSRF and no provider/session/redirect overrides',async()=>{
  let calls=[];
  const env=makeEnv(async(url,options)=>{calls.push({url,options});return json(url.includes('/user/identities/authorize')?{url:consent().toString()}:user);});
  for(const config of [{origin:'https://evil.example'},{origin:null},{csrf:false}])await assert.rejects(()=>handleAuth({request:request('auth/oauth/link',{provider:'google'},config),env},'auth/oauth/link','POST'),error=>error.status===403);
  assert.equal(calls.filter(call=>call.url.includes('/identities/authorize')).length,0);
  await assert.rejects(()=>handleAuth({request:request('auth/oauth/link',{provider:'google'}),env:{...env,QELLY_MANUAL_IDENTITY_LINKING_VERIFIED:'false'}},'auth/oauth/link','POST'),error=>error.code==='identity_link_not_verified');
  const initiatingAccess=token(claims());
  const response=await handleAuth({request:request('auth/oauth/link',{provider:'google',userId:otherId,scope:'gmail.modify',redirect:'https://evil.example'},{access:initiatingAccess}),env},'auth/oauth/link','POST');
  assert.equal(response.status,200);const payload=await response.json();assert.equal(payload.grantedScopes,'openid email profile');
  const call=calls.find(call=>call.url.includes('/identities/authorize'));assert.equal(call.options.headers.Authorization,'Bearer '+initiatingAccess);assert.equal(new URL(call.url).searchParams.get('scopes'),'openid email profile');
  const cookies=response.headers.get('set-cookie');assert.match(cookies,/HttpOnly/);assert.match(cookies,/Max-Age=600/);assert.doesNotMatch(JSON.stringify(payload),/userId|sessionId|verifier|access_token|refresh_token/);
});

test('link callback prevents account/session swaps before exchange and rejects wrong returned identities without issuing token cookies',async()=>{
  const transaction=await __authTest.issueAuthTransaction('oauth-link',{userId,sessionId,provider:'google'});
  const transactionCookie=transaction.cookie.split(';')[0];const body={flow:'oauth-link',code:'single-use-test',state:transaction.state,nonce:transaction.nonce};
  let exchanges=0;
  const currentToken=token(claims()),newToken=token({...claims(),sub:otherId});
  const env=makeEnv(async(url,options)=>{
    if(url.includes('/token?')){exchanges++;assert.equal(JSON.parse(options.body).code_verifier,transaction.verifier);return json({access_token:newToken,refresh_token:'new-test-refresh'});}
    return json(options.headers.Authorization==='Bearer '+newToken?{id:otherId,identities:[{provider:'google'}]}:user);
  });
  await assert.rejects(()=>handleAuth({request:request('auth/callback',body,{access:token({...claims(),session_id:otherId}),transactionCookie}),env},'auth/callback','POST'),error=>error.code==='identity_link_session_mismatch');assert.equal(exchanges,0);
  await assert.rejects(()=>handleAuth({request:request('auth/callback',body,{access:currentToken,transactionCookie}),env},'auth/callback','POST'),error=>error.code==='identity_link_result_mismatch');assert.equal(exchanges,1);
});

test('successful link callback verifies selected provider on initiating account before issuing new browser session',async()=>{
  const transaction=await __authTest.issueAuthTransaction('oauth-link',{userId,sessionId,provider:'google'}),newToken=token({...claims(),session_id:otherId});
  const env=makeEnv(async(url,options)=>{
    if(url.includes('/token?'))return json({access_token:newToken,refresh_token:'new-test-refresh'});
    if(url.includes('/auth/v1/user'))return json(options.headers.Authorization==='Bearer '+newToken?{...user,identities:[...user.identities,{provider:'google'}]}:user);
    return json(url.includes('qelly_profiles')?[{display_name:'Test'}]:[{id:otherId,name:'Test'}]);
  });
  const response=await handleAuth({request:request('auth/callback',{flow:'oauth-link',code:'test',state:transaction.state,nonce:transaction.nonce},{transactionCookie:transaction.cookie.split(';')[0]}),env},'auth/callback','POST');
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.flow,'oauth-link');assert.equal(body.context.user.userId,userId);assert.match(response.headers.get('set-cookie'),/qelly_sb_access=/);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);assert.doesNotMatch(JSON.stringify(body),/provider_token|provider_refresh_token|identity_data/);
});
