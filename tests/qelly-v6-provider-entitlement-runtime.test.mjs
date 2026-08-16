import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {entitlementContract,evaluateEntitlement} from '../functions/_lib/entitlement-policy.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('entitlement policy remains deny-by-default and constitutionally read-only',()=>{
  const contract=entitlementContract();
  assert.equal(contract.decision,'DENY_BY_DEFAULT');
  assert.equal(contract.rules.execution,'DENY');
  assert.equal(contract.rules.custody,'DENY');
  assert.equal(contract.rules.moneyMovement,'DENY');
  const execution=evaluateEntitlement({providerId:'ecb',capability:'execution',use:'trade'});
  assert.equal(execution.allowed,false);
  const blocked=evaluateEntitlement({providerId:'coinbase',capability:'quote',use:'display'});
  assert.equal(blocked.allowed,false);
  const ecb=evaluateEntitlement({providerId:'ecb',capability:'fx-reference-rates',use:'research'});
  assert.equal(ecb.allowed,true);
  assert.equal(ecb.decision,'ALLOW_WITH_OBLIGATIONS');
  assert.ok(ecb.obligations.includes('ecb-attribution'));
});

test('entitlement endpoints are authenticated and evaluation is CSRF protected',async()=>{
  const [contractRoute,evaluateRoute]=await Promise.all([
    read('functions/api/v1/contracts/entitlements.js'),
    read('functions/api/v1/entitlements/evaluate.js')
  ]);
  assert.match(contractRoute,/resolveSession\(request,env,\{required:true\}\)/);
  assert.match(evaluateRoute,/resolveSession\(request,env,\{required:true\}\)/);
  assert.match(evaluateRoute,/requireCsrf\(request\)/);
  assert.doesNotMatch(contractRoute,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(evaluateRoute,/SUPABASE_SERVICE_ROLE_KEY/);
});

test('provider runtime exports the compatibility item shape without exposing credentials or enabling blocked providers',async()=>{
  const source=await read('functions/api/v1/providers/runtime.js');
  for(const field of ['providerId','displayName','selectionRole','breaker','quality','truthState'])assert.match(source,new RegExp(field));
  assert.match(source,/credentialsExposed:false/);
  assert.match(source,/policyDisabledProvidersAreNotCalled:true/);
  assert.doesNotMatch(source,/apiKey|secretKey|password/i);
});
