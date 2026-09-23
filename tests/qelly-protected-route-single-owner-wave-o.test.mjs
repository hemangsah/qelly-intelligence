import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import {routeDefinitions} from '../apps/web/public/assets/route-registry.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('canonical app router exclusively owns anonymous protected-route access gates',async()=>{
  const app=await read('apps/web/public/assets/app.js');
  assert.match(app,/if\(!staticVisualPreview&&!state\.authenticated&&definition&&definition\.public!==true&&!definition\.anonymousOnly\)/);
  assert.match(app,/main\.innerHTML=protectedRouteGate\(definition\)/);
  assert.match(app,/sessionStorage\.setItem\('qelly\.returnTo',state\.route\)/);
  assert.match(app,/function protectedRouteGate\(definition\)/);
  for(const route of ['account-session','security-setup','passkey-center','account-recovery','secure-import-vault','delivery-operations','platform-readiness','secret-rotation','quarantine-review','staging-assurance','watchlist','portfolio-analytics','research-workspace']){
    const definition=routeDefinitions.find((item)=>item.route===route);
    assert.ok(definition,`${route} route is missing`);
    assert.notEqual(definition.public,true,`${route} must not become public`);
    assert.notEqual(definition.anonymousOnly,true,`${route} must remain workspace-gated`);
  }
});

test('base HTML does not start a second protected-route owner',async()=>{
  const index=await read('apps/web/public/index.html');
  assert.doesNotMatch(index,/qelly-product-route-guard\.mjs/);
  assert.doesNotMatch(index,/qelly-external-market-surfaces\.mjs/);
});

test('superseded global guard modules are physically retired',async()=>{
  for(const path of [
    '../apps/web/public/assets/qelly-product-route-guard.mjs',
    '../apps/web/public/assets/qelly-external-market-surfaces.mjs'
  ]){
    await assert.rejects(access(new URL(path,import.meta.url)));
  }
  const tree=await read('artifacts/QELLY_SOURCE_TREE.txt');
  assert.doesNotMatch(tree,/qelly-product-route-guard\.mjs|qelly-external-market-surfaces\.mjs/);
});

test('live-markets retains route-local TradingView and governed ECB surfaces',async()=>{
  const route=await read('apps/web/public/assets/routes/market-network.mjs');
  assert.match(route,/mountTradingViewDisplay/);
  assert.match(route,/mountLazyTradingViewWidget/);
  assert.match(route,/q-market-network-chart/);
  assert.match(route,/ECB governed FX reference/);
  assert.match(route,/Forex cross rates/);
  assert.match(route,/chartHandle\?\.destroy\?\.\(\)/);
  assert.match(route,/fxCrossHandle\?\.destroy\?\.\(\)/);
  assert.doesNotMatch(route,/qelly-live-chart|live-symbol|live-interval/);
});
