import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ensureRouteStylesheet} from '../apps/web/public/assets/route-stylesheet-readiness.mjs';
const fixture=()=>{
  let link=null,appends=0;
  const doc={querySelector:()=>link,createElement:()=>{const node=new EventTarget();node.sheet=null;node.setAttribute=()=>{};node.remove=()=>{if(link===node)link=null;};return node;},head:{append:node=>{link=node;appends++;}}};
  const load=()=>{link.sheet={};link.dispatchEvent(new Event('load'));};
  return {doc,load,get link(){return link;},get appends(){return appends;}};
};
const options=f=>({attribute:'data-decision-proven-graph',value:'v2',document:f.doc});
test('slow CSS blocks route readiness until actual load; concurrent renders share one request',async()=>{
  const f=fixture();let rendered=false;const ready=ensureRouteStylesheet('/decision.css',options(f));ready.then(()=>{rendered=true;});
  assert.equal(ensureRouteStylesheet('/decision.css',options(f)),ready);
  await Promise.resolve();assert.equal(rendered,false);assert.equal(f.appends,1);
  f.load();await ready;assert.equal(rendered,true);
  await ensureRouteStylesheet('/decision.css',options(f));assert.equal(f.appends,1);
});
test('failed stylesheet is removed and a later visit can retry successfully',async()=>{
  const f=fixture();const ready=ensureRouteStylesheet('/decision.css',options(f));
  f.link.dispatchEvent(new Event('error'));await assert.rejects(ready,/styles could not load/);assert.equal(f.link,null);
  const retry=ensureRouteStylesheet('/decision.css',options(f));f.load();await retry;assert.equal(f.appends,2);
});
test('missing load event has bounded failure and does not leave an unretryable marker',async()=>{
  const f=fixture();await assert.rejects(ensureRouteStylesheet('/decision.css',{...options(f),timeoutMs:5}),/styles could not load/);assert.equal(f.link,null);
});
test('existing loaded route style needs no new request or timer',async()=>{
  const f=fixture();const ready=ensureRouteStylesheet('/decision.css',options(f));f.load();await ready;
  await ensureRouteStylesheet('/decision.css',options(f));assert.equal(f.appends,1);
});
test('Decision renderer waits for styling before exposing its first content',async()=>{
  const source=await readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8');
  assert.match(source,/export async function renderDecisionProvenGraph\(main,deps\)\{\s*await installStyles\(deps.signal\)/);
});
test('leaving a slow-styled route aborts its wait promptly without cancelling a shared stylesheet',async()=>{
  const f=fixture(),controller=new AbortController();
  const cancelled=ensureRouteStylesheet('/decision.css',{...options(f),signal:controller.signal});
  const shared=ensureRouteStylesheet('/decision.css',options(f));controller.abort();
  await assert.rejects(cancelled,{name:'AbortError'});assert.equal(f.appends,1);f.load();await shared;
});
