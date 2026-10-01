import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {convergePublicRuntimeHtml} from '../scripts/public-shell-convergence.mjs';
import {routeDefinitions} from '../apps/web/public/assets/route-registry.mjs';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave CO embeds one escaped registry-derived route identity map ahead of the blocking prepaint bootstrap',async()=>{
  const index=convergePublicRuntimeHtml(await read('apps/web/public/index.html'));
  const marker='<script id="qelly-prepaint-route-identities" type="application/json">';
  const start=index.indexOf(marker),end=index.indexOf('</script>',start);
  const prepaint=index.indexOf('<script src="./assets/qelly-prepaint-bootstrap.js"></script>');
  assert.ok(start>0&&end>start&&prepaint>end,'canonical route map must precede bootstrap');
  assert.equal(index.split(marker).length,2,'the route map must have only one owner');
  const payload=index.slice(start+marker.length,end);
  assert.equal(payload.includes('<'),false,'JSON script boundary must be escaped');
  const map=JSON.parse(payload);
  assert.deepEqual(Object.keys(map).sort(),routeDefinitions.map(item=>item.route).sort());
  for(const definition of routeDefinitions)assert.equal(map[definition.route],definition.seoTitle??definition.label+' · Qelly Intelligence');
  const rerun=convergePublicRuntimeHtml(index);
  assert.equal(rerun.split(marker).length,2,'convergence must remain idempotent');
});

test('Wave CO establishes correct known route and theme before app modules run',async()=>{
  const [bootstrap,index]=await Promise.all([read('apps/web/public/assets/qelly-prepaint-bootstrap.js'),read('apps/web/public/index.html')]);
  const built=convergePublicRuntimeHtml(index);
  const marker='<script id="qelly-prepaint-route-identities" type="application/json">';
  const map=JSON.parse(built.slice(built.indexOf(marker)+marker.length,built.indexOf('</script>',built.indexOf(marker))));
  for(const [hash,route] of [['#/market','market'],['#/news-research','news-research'],['#/calculator-center/position-size','calculator-center'],['#/theme-personas','theme-personas']]){
    const root={dataset:{},style:{}};
    const document={documentElement:root,title:'Qelly Intelligence · Verifiable Market Intelligence',getElementById:id=>id==='qelly-prepaint-route-identities'?{textContent:JSON.stringify(map)}:null};
    const context={document,location:{hash},matchMedia:()=>({matches:false}),localStorage:{getItem:()=>JSON.stringify({appearance:'light'})}};
    vm.runInNewContext(bootstrap,context,{timeout:1000});
    assert.equal(document.title,map[route],route);
    assert.equal(root.dataset.prepaintRoute,route);
    assert.equal(root.dataset.appearance,'light');
    assert.equal(root.style.colorScheme,'light');
    assert.equal(root.dataset.themeReady,'true');
  }
});

test('Wave CO fails safely for missing or malformed route metadata and removes legacy market first-render copy',async()=>{
  const bootstrap=await read('apps/web/public/assets/qelly-prepaint-bootstrap.js');
  for(const raw of [null,'{']){
    const root={dataset:{},style:{}};
    const document={documentElement:root,title:'Static fallback title',getElementById:()=>raw===null?null:{textContent:raw}};
    vm.runInNewContext(bootstrap,{document,location:{hash:'#/unknown'},matchMedia:()=>({matches:true}),localStorage:{getItem:()=>null}},{timeout:1000});
    assert.equal(document.title,'Static fallback title');
  }
  const market=await read('apps/web/public/assets/routes/market-v6.mjs');
  assert.doesNotMatch(market,/Qelly Intelligence · Market Command/);
  assert.match(market,/Qelly Intelligence · Market Pulse/);
});
