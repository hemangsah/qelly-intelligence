import test from 'node:test';
import assert from 'node:assert/strict';
import { publicRuntimeConfig } from '../functions/_lib/runtime.js';
import { onRequest } from '../functions/api/v1/[[path]].js';

const environment=(overrides={})=>({
  QELLY_PUBLIC_SITE_URL:'https://qelly.example',
  QELLY_PUBLIC_SUPABASE_URL:'https://project.supabase.co',
  QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_abcdefghijklmnopqrstuvwxyz123456',
  QELLY_ALLOWED_ORIGINS:'https://qelly.example',
  QELLY_ENABLE_AUTH:'true',
  ...overrides
});

test('transactional email delivery is fail-closed unless explicitly enabled',()=>{
  assert.equal(publicRuntimeConfig(environment()).capabilities.authentication,true);
  assert.equal(publicRuntimeConfig(environment()).capabilities.emailDelivery,false);
  assert.equal(publicRuntimeConfig(environment({QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true'})).capabilities.emailDelivery,true);
});

for(const [path,body] of [
  ['auth/register',{displayName:'Test User',email:'test@example.com',password:'StrongPassword!123'}],
  ['auth/recovery/request',{email:'test@example.com'}]
]){
  test(`${path} rejects before any Supabase email request when delivery is unproven`,async()=>{
    let upstreamCalls=0;
    const env=environment({__fetch:async()=>{upstreamCalls+=1;throw new Error('upstream must not be called');}});
    const request=new Request(`https://qelly.example/api/v1/${path}`,{method:'POST',headers:{Origin:'https://qelly.example','Content-Type':'application/json'},body:JSON.stringify(body)});
    const response=await onRequest({request,env,params:{path:path.split('/')}});
    assert.equal(response.status,503);
    const payload=await response.json();
    assert.equal(payload.error.code,'auth_email_delivery_unavailable');
    assert.equal(payload.error.retryable,false);
    assert.equal(upstreamCalls,0);
  });
}
