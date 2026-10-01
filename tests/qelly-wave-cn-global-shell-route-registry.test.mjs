import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {productCategories,routeDefinitions,routeIdentityFor} from '../apps/web/public/assets/route-registry.mjs';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave CN route identity registry owns complete customer-facing metadata',()=>{
  const required=['route','pageTitle','shortTitle','category','categoryLabel','description','icon','chatContextType','seoTitle','canonical','breadcrumbs','featureFlags'];
  assert.ok(routeDefinitions.length>50);
  assert.equal(new Set(routeDefinitions.map((item)=>item.route)).size,routeDefinitions.length);
  for(const route of routeDefinitions){
    for(const field of required)assert.ok(route[field]!==undefined&&route[field]!==null,`${route.route} missing ${field}`);
    assert.equal(route.label,route.pageTitle);
    assert.match(route.seoTitle,/Qelly Intelligence$/);
    assert.equal(route.canonical,'#/'+route.route);
    assert.ok(Array.isArray(route.breadcrumbs)&&route.breadcrumbs.length===3);
    assert.equal(typeof route.featureFlags,'object');
  }
  assert.equal(routeIdentityFor('market').pageTitle,'Market Pulse');
  assert.equal(routeIdentityFor('news-research').pageTitle,'QELLY Chat');
  assert.equal(routeIdentityFor('decision-provenance').category,'decide');
  assert.equal(routeIdentityFor('calculator-center').category,'tools');
});

test('Wave CN primary product categories are unique and match the customer jobs',()=>{
  assert.deepEqual(productCategories.map((item)=>item.id),['discover','decide','research','tools','account']);
  const routes=productCategories.flatMap((category)=>category.routes.map((route)=>route.route));
  assert.equal(new Set(routes).size,routes.length,'a primary route appears in more than one product category');
  for(const category of productCategories){
    assert.ok(category.routes.length>=3,category.id+' category is too shallow');
    assert.ok(category.routes.some((route)=>route.route===category.defaultRoute),category.id+' default route is missing from the category');
  }
});

test('Wave CN shell consumers use the canonical route registry instead of hard-coded product names',async()=>{
  const [runtime,app,chat,shell,css]=await Promise.all([
    read('apps/web/public/assets/qelly-public-runtime.mjs'),
    read('apps/web/public/assets/app.js'),
    read('apps/web/public/assets/ai/qelly-chat.mjs'),
    read('apps/web/public/assets/qelly-production-shell.mjs'),
    read('apps/web/public/assets/qelly-navigation-v2.css')
  ]);
  assert.match(runtime,/import \{productCategories,routeIdentityFor\} from '.\/route-registry\.mjs'/);
  assert.match(runtime,/data-qelly-route-registry-owner/);
  assert.match(runtime,/data-product-category-toggle/);
  assert.match(runtime,/qelly:route-identity/);
  assert.match(runtime,/data-q-product-page-title/);
  assert.doesNotMatch(runtime,/\['Decision','decision-provenance'\]/);
  assert.match(app,/definition\?\.seoTitle/);
  assert.match(app,/group:item\.categoryLabel/);
  assert.match(chat,/routeIdentityFor\(route\)/);
  assert.match(chat,/identity\?\.chatContextType/);
  assert.doesNotMatch(shell,/replaceChildren\(document\.createTextNode\('Tools'\)\)/);
  assert.match(css,/q-product-category__menu/);
  assert.match(css,/q-product-header\.is-menu-open>\.q-product-nav/);
  assert.match(css,/q-product-context/);
});

test('Wave CN removes known stale route identities from authoritative sources',async()=>{
  const [registry,runtime,shell,app]=await Promise.all([
    read('apps/web/public/assets/route-registry.mjs'),
    read('apps/web/public/assets/qelly-public-runtime.mjs'),
    read('apps/web/public/assets/qelly-production-shell.mjs'),
    read('apps/web/public/assets/app.js')
  ]);
  const combined=[registry,runtime,shell,app].join('\n');
  assert.doesNotMatch(combined,/Qelly Chat & Research|QELLY Chat and Research Letter/);
  assert.doesNotMatch(registry,/label:'Market Command'/);
  assert.match(registry,/label:'Market Pulse'/);
  assert.match(registry,/label:'QELLY Chat'/);
});
