import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {convergePublicRuntimeHtml,prepaintRouteTitles,prepaintRouteContexts} from '../scripts/public-shell-convergence.mjs';
import * as registry from '../apps/web/public/assets/route-registry.mjs';
const {routeDefinitions}=registry;

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave CO builds one CSP-safe registry-derived external route identity script ahead of prepaint',async()=>{
  const index=convergePublicRuntimeHtml(await read('apps/web/public/index.html'));
  const marker='<script src="./assets/qelly-prepaint-route-identities.js"></script>';
  const prepaint='<script src="./assets/qelly-prepaint-bootstrap.js"></script>';
  assert.ok(index.indexOf(marker)>0&&index.indexOf(marker)<index.indexOf(prepaint));
  assert.equal(index.split(marker).length,2,'one authoritative external map owner');
  if(Array.isArray(registry.productCategories)&&registry.productCategories.length){
    assert.equal((index.match(/data-product-category="/g)||[]).length,registry.productCategories.length);
    assert.ok(index.includes('data-q-product-page-title>Qelly</strong>'));
    assert.match(index,/aria-label="Primary product categories"/);
  }

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

test('Wave CO synchronously initializes canonical header context after the static header and before route hydration',async()=>{
  const index=convergePublicRuntimeHtml(await read('apps/web/public/index.html'));
  const headTag='<script src="./assets/qelly-prepaint-header.js"></script>';
  const headerClose=index.indexOf('</header>',index.indexOf('data-qelly-current-shell="true"'));
  const scriptAt=index.indexOf(headTag);
  const hiddenAt=index.indexOf('data-qelly-legacy-bindings="true"');
  const appReadyAt=index.indexOf('qelly-app-ready.mjs');
  assert.ok(headerClose>0&&scriptAt>headerClose&&hiddenAt>scriptAt&&appReadyAt>scriptAt);
  assert.equal(index.split(headTag).length-1,1);
  const contexts=prepaintRouteContexts();
  assert.deepEqual(Object.keys(contexts).sort(),routeDefinitions.map(route=>route.route).sort());
  for(const route of ['market','news-research','decision-provenance','calculator-center']){
    const def=routeDefinitions.find(item=>item.route===route);
    assert.equal(contexts[route].shortTitle,def.shortTitle??def.label);
    assert.equal(contexts[route].categoryLabel,def.categoryLabel??'Qelly');
  }
  const build=await read('scripts/build-frontend.mjs');
  assert.match(build,/__QELLY_PREPAINT_ROUTE_CONTEXTS__/);
  assert.match(build,/prepaintRouteContexts/);
  const bootstrap=await read('apps/web/public/assets/qelly-prepaint-header.js');
  assert.doesNotMatch(bootstrap,/innerHTML|insertAdjacentHTML|eval\(/);
  for(const [route,def] of [['market',contexts.market],['news-research',contexts['news-research']]]){
    const title={textContent:'Qelly'},category={textContent:'Qelly'};
    const root={dataset:{prepaintRoute:route}};
    const header={querySelector(selector){return selector==='[data-q-product-page-title]'?title:selector==='[data-q-product-category-label]'?category:null;}};
    const document={documentElement:root,querySelector(selector){return selector==='.q-product-header[data-qelly-current-shell="true"]'?header:null;}};
    const context={window:{__QELLY_PREPAINT_ROUTE_CONTEXTS__:contexts},document};
    vm.runInNewContext(bootstrap,context,{timeout:1000,contextCodeGeneration:{strings:false,wasm:false}});
    assert.equal(title.textContent,def.shortTitle);
    assert.equal(category.textContent,def.categoryLabel);
    assert.equal(root.dataset.prepaintHeader,'canonical');
    vm.runInNewContext(bootstrap,context,{timeout:1000,contextCodeGeneration:{strings:false,wasm:false}});
    assert.equal(title.textContent,def.shortTitle,'idempotent');
  }
});

test('Wave CO header initialization fails closed for malformed identity and unknown routes',async()=>{
  const bootstrap=await read('apps/web/public/assets/qelly-prepaint-header.js');
  for(const [route,map] of [['unknown',{market:{shortTitle:'Market Pulse',categoryLabel:'Discover'}}],['market',{market:{shortTitle:'x'.repeat(400),categoryLabel:'Discover'}}]]){
    const title={textContent:'Qelly'},category={textContent:'Qelly'};
    const root={dataset:{prepaintRoute:route}};
    const header={querySelector(selector){return selector==='[data-q-product-page-title]'?title:category;}};
    vm.runInNewContext(bootstrap,{window:{__QELLY_PREPAINT_ROUTE_CONTEXTS__:map},document:{documentElement:root,querySelector:()=>header}},{timeout:1000});
    assert.equal(title.textContent,'Qelly');
    assert.equal(category.textContent,'Qelly');
    assert.equal(root.dataset.prepaintHeader,undefined);
  }
});
