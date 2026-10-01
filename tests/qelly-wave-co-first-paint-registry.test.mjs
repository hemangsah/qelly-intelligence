import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {convergePublicRuntimeHtml,prepaintRouteTitles} from '../scripts/public-shell-convergence.mjs';
import {routeDefinitions} from '../apps/web/public/assets/route-registry.mjs';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave CO builds one CSP-safe registry-derived external route identity script ahead of prepaint',async()=>{
  const index=convergePublicRuntimeHtml(await read('apps/web/public/index.html'));
  const marker='<script src="./assets/qelly-prepaint-route-identities.js"></script>';
  const prepaint='<script src="./assets/qelly-prepaint-bootstrap.js"></script>';
  assert.ok(index.indexOf(marker)>0&&index.indexOf(marker)<index.indexOf(prepaint));
  assert.equal(index.split(marker).length,2,'one authoritative external map owner');
  assert.doesNotMatch(index,/script id="qelly-prepaint-route-identities"/);
  const map=prepaintRouteTitles();
  assert.deepEqual(Object.keys(map).sort(),routeDefinitions.map(item=>item.route).sort());
  for(const definition of routeDefinitions)assert.equal(map[definition.route],definition.seoTitle??definition.label+' · Qelly Intelligence');
  const convergence=await read('scripts/public-shell-convergence.mjs');
  assert.match(convergence,/if\(!html\.includes\(routeMapScript\)\)/);
  const build=await read('scripts/build-frontend.mjs');
  assert.match(build,/qelly-prepaint-route-identities\.js/);
  assert.match(build,/prepaintRouteTitles/);
  assert.match(build,/writeFile\(path\.join\(output,'assets\/qelly-prepaint-route-identities\.js'\)/);
});

test('Wave CO resolves initial title, route and light appearance synchronously',async()=>{
  const bootstrap=await read('apps/web/public/assets/qelly-prepaint-bootstrap.js');
  const map=prepaintRouteTitles();
  for(const [hash,route] of [['#/market','market'],['#/news-research','news-research'],['#/calculator-center/position-size','calculator-center'],['#/theme-personas','theme-personas']]){
    const root={dataset:{},style:{}};
    const document={documentElement:root,title:'Qelly Intelligence · Verifiable Market Intelligence'};
    const context={document,window:{__QELLY_PREPAINT_ROUTE_TITLES__:map},location:{hash},matchMedia:()=>({matches:false}),localStorage:{getItem:()=>JSON.stringify({appearance:'light'})}};
    vm.runInNewContext(bootstrap,context,{timeout:1000});
    assert.equal(document.title,map[route],route);
    assert.equal(root.dataset.prepaintRoute,route);
    assert.equal(root.dataset.appearance,'light');
    assert.equal(root.style.colorScheme,'light');
    assert.equal(root.dataset.themeReady,'true');
  }
});

test('Wave CO fails safely for missing or malformed route metadata and removes legacy market copy',async()=>{
  const bootstrap=await read('apps/web/public/assets/qelly-prepaint-bootstrap.js');
  for(const map of [null,{market:'x'.repeat(250)}]){
    const root={dataset:{},style:{}};
    const document={documentElement:root,title:'Static fallback title'};
    vm.runInNewContext(bootstrap,{document,window:{__QELLY_PREPAINT_ROUTE_TITLES__:map},location:{hash:'#/market'},matchMedia:()=>({matches:true}),localStorage:{getItem:()=>null}},{timeout:1000});
    assert.equal(document.title,'Static fallback title');
  }
  const market=await read('apps/web/public/assets/routes/market-v6.mjs');
  assert.doesNotMatch(market,/Qelly Intelligence · Market Command/);
  assert.match(market,/Qelly Intelligence · Market Pulse/);
});
