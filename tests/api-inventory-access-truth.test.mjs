import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {apiRoutes} from '../src/server/route-manifest.mjs';
import {
  classifyApiContractAccess,
  isPublicApiContractRoute,
  PUBLIC_V1_API_PATHS,
  PUBLIC_V1_TEMPLATE_ROUTES
} from '../src/server/api-access-policy.mjs';

const expectedPublic=[
  '/api/health',
  '/api/ready',
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/recovery/request',
  '/api/v1/auth/passkeys/authenticate/options',
  '/api/v1/production-foundation/status',
  '/api/v1/public/providers',
  '/api/v1/public/markets/assets/:id/candles',
  '/api/v1/calculations/metadata',
  '/api/v1/calculations/formulas/:id',
  '/api/v1/calculations/run',
  '/api/v1/indicators',
  '/api/v1/indicators/:id',
  '/api/v1/india/rules',
  '/api/v1/india/charges'
];

const expectedProtected=[
  '/api/v1/auth/logout',
  '/api/v1/auth/refresh',
  '/api/v1/auth/mfa/status',
  '/api/v1/auth/passkeys',
  '/api/v1/auth/passkeys/register/options',
  '/api/v1/calculations/saved',
  '/api/v1/calculations/saved/:id',
  '/api/v1/evidence/graphs',
  '/api/v1/watchlist'
];

test('API access classifier preserves the runtime public/protected boundary',()=>{
  for(const route of expectedPublic){
    assert.equal(apiRoutes.includes(route),true,`documented route missing: ${route}`);
    assert.equal(isPublicApiContractRoute(route),true,`expected public: ${route}`);
    assert.equal(classifyApiContractAccess(route),'public',route);
  }
  for(const route of expectedProtected){
    assert.equal(apiRoutes.includes(route),true,`documented route missing: ${route}`);
    assert.equal(isPublicApiContractRoute(route),false,`expected protected: ${route}`);
    assert.equal(classifyApiContractAccess(route),'authenticated-or-policy-dependent',route);
  }
});

test('inventory public-v1 exact paths stay aligned with the server authentication gate',async()=>{
  const source=await readFile(new URL('../src/server/server.mjs',import.meta.url),'utf8');
  const match=source.match(/const publicApiPaths = new Set\(\[([^\]]*)\]\);/s);
  assert.ok(match,'server publicApiPaths set must remain discoverable');
  const runtimePaths=[...match[1].matchAll(/'([^']+)'/g)].map((entry)=>entry[1]);
  assert.deepEqual([...runtimePaths].sort(),[...PUBLIC_V1_API_PATHS].sort());

  const runtimePatternSource=String.raw`/^\/api\/v1\/public\/markets\/assets\/[^/]+(?:\/candles)?$/.test(pathname)||/^\/api\/v1\/calculations\/formulas\/[^/]+$/.test(pathname)||/^\/api\/v1\/indicators\/[^/]+$/.test(pathname)`;
  assert.ok(source.includes(runtimePatternSource),'server public template patterns must remain aligned');
  assert.deepEqual(PUBLIC_V1_TEMPLATE_ROUTES,[
    '/api/v1/public/markets/assets/:id',
    '/api/v1/public/markets/assets/:id/candles',
    '/api/v1/calculations/formulas/:id',
    '/api/v1/indicators/:id'
  ]);
});

test('product inventory generator uses the canonical API access classifier',async()=>{
  const source=await readFile(new URL('../scripts/build-product-inventory.mjs',import.meta.url),'utf8');
  assert.match(source,/import \{classifyApiContractAccess\} from '\.\.\/src\/server\/api-access-policy\.mjs';/);
  assert.match(source,/access:classifyApiContractAccess\(route\)/);
  assert.doesNotMatch(source,/route\.startsWith\('\/api\/v1\/public\/'\)/);
});
