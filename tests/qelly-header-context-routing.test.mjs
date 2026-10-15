import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {runInNewContext} from 'node:vm';
import {routeDefinitions} from '../apps/web/public/assets/route-registry.mjs';
import {parseHashRoute} from '../apps/web/public/assets/hash-route-state.mjs';
const runtimeSource=()=>readFile(new URL('../apps/web/public/assets/qelly-public-runtime.mjs',import.meta.url),'utf8');
const appSource=()=>readFile(new URL('../apps/web/public/assets/app.js',import.meta.url),'utf8');
test('header status targets a registered Service Status renderer',async()=>{
 const code=await runtimeSource(),start=code.indexOf('function productHeaderMarkup(){'),end=code.indexOf('\nfunction syncProductHeaderState(',start);assert.ok(start>=0&&end>start);
 const markup=runInNewContext(code.slice(start,end)+'\nproductHeaderMarkup()',{routeIdentity:()=>null,productNav:()=>[],categoryMarkup:()=>'',escapeHtml:String});
 const target=markup.match(/class="q-product-system"[^>]*data-product-route="([^"]+)"/)?.[1];assert.ok(target);const definition=routeDefinitions.find(x=>x.route===target);assert.ok(definition,'System status cannot target an unregistered fallback');assert.equal(definition.route,'platform-readiness');
});
test('signed-in access-page routing keeps the URL aligned with its actual Profile renderer',async()=>{
 const code=await appSource(),start=code.indexOf('function resolveHash() {'),end=code.indexOf('\nfunction navigate(',start);assert.ok(start>=0&&end>start);
 const resolver=code.slice(start,end);
 for(const authenticated of [false,true])for(const route of ['auth-login','auth-register','auth-recovery','status']){
  const location={hash:'#/'+route},state={authenticated,prefs:{route:'market'}};let navigationRendered=0,routeRendered=0;
  runInNewContext(resolver+'\nresolveHash();',{location,state,parseHashRoute,routeDefinitions,staticVisualPreview:false,staticPreviewRoutes:new Set(),toolDetailRoutes:new Set(),history:{replaceState(_state,_title,url){location.hash=url;}},renderNavigation(){navigationRendered++;},renderRoute(){routeRendered++;}});
  const definition=routeDefinitions.find(x=>x.route===route),expected=route==='status'?'platform-readiness':authenticated&&definition.anonymousOnly?'account-session':route;
  assert.equal(state.route,expected);assert.equal(location.hash,'#/'+expected);assert.equal(navigationRendered,1);assert.equal(routeRendered,1);
 }
});
