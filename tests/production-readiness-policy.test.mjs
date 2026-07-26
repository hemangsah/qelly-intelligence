import test from 'node:test';
import assert from 'node:assert/strict';
import { productionFoundationHealth } from '../src/production/production-foundation.mjs';

test('strict production readiness rejects local or unavailable delivery and scanner dependencies',async()=>{
  const runtime={
    productionFoundation:{strictProductionDependencies:true},
    productionRepository:{health:async()=>({ok:true,driver:'postgres'})},
    jobQueue:{health:async()=>({ok:true,driver:'redis'})},
    objectStorage:{health:async()=>({ok:true,driver:'s3-compatible-sigv4',scanner:'local-signature-foundation'})},
    deliveryService:{providers:()=>({email:{configured:false,external:false},webhook:{configured:false,external:false}})},
    secretRotationService:{status:async()=>({protector:{mode:'aes-256-gcm-keyring-configured'}})}
  };
  const health=await productionFoundationHealth(runtime);
  assert.equal(health.ready,false);
  assert.equal(health.productionPolicy.scannerReady,false);
  assert.equal(health.productionPolicy.externalEmail,false);
  assert.equal(health.productionPolicy.externalWebhook,false);
});

test('strict production readiness accepts external dependencies and configured keyring',async()=>{
  const runtime={
    productionFoundation:{strictProductionDependencies:true},
    productionRepository:{health:async()=>({ok:true,driver:'postgres'})},
    jobQueue:{health:async()=>({ok:true,driver:'redis'})},
    objectStorage:{health:async()=>({ok:true,driver:'s3-compatible-sigv4',scanner:'clamav-tcp-instream'})},
    deliveryService:{providers:()=>({email:{configured:true,external:true},webhook:{configured:true,external:true}})},
    secretRotationService:{status:async()=>({protector:{mode:'aes-256-gcm-keyring-configured'}})}
  };
  const health=await productionFoundationHealth(runtime);
  assert.equal(health.ready,true);
});
