import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {apiRoutes} from '../src/server/route-manifest.mjs';
import {
  classifyApiContractAccess,
  isPublicApiContractRoute,
  isPublicApiRequestPath,
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
  '/api/v1/search',
  '/api/v1/discovery/categories',
  '/api/v1/discovery/venues',
  '/api/v1/discovery/dex',
  '/api/v1/discovery/global-charts',
  '/api/v1/discovery/converter',
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

test('canonical request matcher resolves exact and template public paths while failing closed',()=>{
  for(const pathname of PUBLIC_V1_API_PATHS)assert.equal(isPublicApiRequestPath(pathname),true,pathname);
  for(const pathname of [
    '/api/v1/public/markets/assets/btc',
    '/api/v1/public/markets/assets/btc/candles',
    '/api/v1/calculations/formulas/black-scholes',
    '/api/v1/indicators/rsi',
    '/api/v1/platform/capabilities',
    '/api/v1/providers/status',
    '/api/v1/providers/ecb'
  ])assert.equal(isPublicApiRequestPath(pathname),true,pathname);

  for(const pathname of [
    '/api/v1/calculations/saved',
    '/api/v1/calculations/saved/calc-1',
    '/api/v1/providers/execute',
    '/api/v1/unknown',
    '/api/v1/public/markets/assets/btc/candles/extra'
  ])assert.equal(isPublicApiRequestPath(pathname),false,`must fail closed: ${pathname}`);

  assert.deepEqual(PUBLIC_V1_TEMPLATE_ROUTES,[
    '/api/v1/public/markets/assets/:id',
    '/api/v1/public/markets/assets/:id/candles',
    '/api/v1/calculations/formulas/:id',
    '/api/v1/indicators/:id'
  ]);
});

test('server authentication gate consumes the canonical request matcher instead of duplicating policy',async()=>{
  const source=await readFile(new URL('../src/server/server.mjs',import.meta.url),'utf8');
  assert.match(source,/import \{ isPublicApiRequestPath \} from '\.\/api-access-policy\.mjs';/);
  assert.match(source,/!isPublicApiRequestPath\(url\.pathname\)/);
  assert.doesNotMatch(source,/const publicApiPaths = new Set/);
  assert.doesNotMatch(source,/function isPublicApiPath\(/);
});

test('product inventory generator uses the canonical API access classifier',async()=>{
  const source=await readFile(new URL('../scripts/build-product-inventory.mjs',import.meta.url),'utf8');
  assert.match(source,/import \{classifyApiContractAccess\} from '\.\.\/src\/server\/api-access-policy\.mjs';/);
  assert.match(source,/access:classifyApiContractAccess\(route\)/);
  assert.doesNotMatch(source,/route\.startsWith\('\/api\/v1\/public\/'\)/);
});
