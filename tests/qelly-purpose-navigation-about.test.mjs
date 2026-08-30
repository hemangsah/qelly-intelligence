import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {routeDefinitions,productDomains} from '../apps/web/public/assets/route-registry.mjs';

const read=(path)=>readFile(new URL(path,import.meta.url),'utf8');

test('every visible navigation feature has a distinct purpose and concrete use case',()=>{
  const visible=routeDefinitions.filter((route)=>!route.hidden);
  assert.equal(visible.length,64);
  for(const route of visible){
    assert.ok(route.purpose?.length>=28,`${route.route} needs a useful purpose`);
    assert.match(route.useCase??'',/^Use (when|before|for|during)/,`${route.route} needs a concrete use case`);
  }
  assert.equal(new Set(visible.map((route)=>route.purpose)).size,visible.length);
});

test('purpose-led navigation searches metadata and filters by domain',async()=>{
  const [runtime,css,index,worker]=await Promise.all([
    read('../apps/web/public/assets/qelly-production-shell.mjs'),
    read('../apps/web/public/assets/qelly-navigation-v2.css'),
    read('../apps/web/public/index.html'),
    read('../apps/web/public/qelly-service-worker.js')
  ]);
  assert.match(runtime,/Choose the job to be done/);
  assert.match(runtime,/Every destination has a distinct purpose and outcome/);
  assert.match(runtime,/data-feature-domain-filter/);
  assert.match(runtime,/route\.purpose/);
  assert.match(runtime,/route\.useCase/);
  assert.match(runtime,/activeDomain==='all'/);
  assert.match(css,/grid-template-areas:"brand nav search actions"/);
  assert.match(css,/q-feature-navigation__use/);
  assert.match(css,/@media\(min-width:1241px\)/);
  assert.match(index,/qelly-navigation-v2\.css\?v=20260829-navigation1/);
  assert.match(worker,/qelly-navigation-v2\.css/);
  assert.equal(productDomains.length,10);
});

test('About Qelly explains purpose, audience, workflow and live capability boundaries',async()=>{
  const [route,css]=await Promise.all([
    read('../apps/web/public/assets/routes/about-qelly.mjs'),
    read('../apps/web/public/assets/about-qelly-v2.css')
  ]);
  for(const phrase of ['Purpose before feature count','The operating journey','Purpose map','Built for different analytical jobs','What Qelly does','What Qelly will not do'])assert.match(route,new RegExp(phrase));
  for(const stage of ['Discover','Understand','Research','Decide','Verify'])assert.match(route,new RegExp(`name:'${stage}'`));
  assert.match(route,/config\.capabilityTruth\?\.research/);
  assert.match(route,/capabilities\.cloudSync/);
  assert.match(route,/data-route-target/);
  assert.match(css,/\.q-about-v2-hero/);
  assert.match(css,/\.q-about-v2-journey/);
  assert.match(css,/@media\(max-width:620px\)/);
});
