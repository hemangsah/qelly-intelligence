import test from 'node:test';
import assert from 'node:assert/strict';
import { productionFoundationHealth } from '../src/production/production-foundation.mjs';

test('strict production readiness rejects local or unavailable delivery and scanner dependencies',async()=>{
  const runtime={
    productionFoundation:{strictProductionDependencies:true,requiredMigration:'106_deployment_runtime_state.sql',productionIdentityEnabled:true},
    productionRepository:{health:async()=>({ok:true,driver:'postgres',latestMigration:'106_deployment_runtime_state.sql'})},
    jobQueue:{health:async()=>({ok:true,driver:'redis',tls:false,queue:{activeWorkers:0}})},
    objectStorage:{health:async()=>({ok:true,driver:'s3-compatible-sigv4',private:false,anonymousListingDenied:false,scannerStatus:{ok:false,mode:'local-signature-foundation'}})},
    deliveryService:{providers:()=>({email:{configured:false,external:false},webhook:{configured:false,external:false}}),health:async()=>({ok:false,driver:'delivery-adapters'})},
    secretRotationService:{status:async()=>({protector:{mode:'aes-256-gcm-keyring-configured'}})},
    auditLedger:{verify:async()=>({valid:false})}
  };
  const health=await productionFoundationHealth(runtime);
  assert.equal(health.ready,false);
  assert.equal(health.productionPolicy.scannerReady,false);
  assert.equal(health.productionPolicy.externalEmail,false);
  assert.equal(health.productionPolicy.externalWebhook,false);
});

test('strict production readiness accepts external dependencies and configured keyring',async()=>{
  const runtime={
    productionFoundation:{strictProductionDependencies:true,requiredMigration:'106_deployment_runtime_state.sql',productionIdentityEnabled:true,developmentIdentityEnabled:false,requireActiveWorker:true},
    productionRepository:{health:async()=>({ok:true,driver:'postgres',latestMigration:'106_deployment_runtime_state.sql'})},
    jobQueue:{health:async()=>({ok:true,driver:'redis',tls:true,queue:{activeWorkers:1}})},
    objectStorage:{health:async()=>({ok:true,driver:'s3-compatible-sigv4',private:true,anonymousListingDenied:true,scannerStatus:{ok:true,mode:'clamav-tcp-instream'}})},
    deliveryService:{providers:()=>({email:{configured:true,external:true},webhook:{configured:true,external:true}}),health:async()=>({ok:true,driver:'delivery-adapters'})},
    secretRotationService:{status:async()=>({protector:{mode:'aes-256-gcm-keyring-configured'}})},
    auditLedger:{verify:async()=>({valid:true,persistence:'postgresql'})}
  };
  const health=await productionFoundationHealth(runtime);
  assert.equal(health.ready,true);
});
