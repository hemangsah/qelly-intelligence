import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../apps/web/public/assets/qelly-app-ready.mjs',import.meta.url),'utf8');
function harness({children=1,busy='true',feedback=false}={}){
  const root={dataset:{appReady:'false'}};
  let callback,timeout,disconnected=false;
  const main={childElementCount:children,getAttribute:()=>busy,querySelector:()=>feedback?{}:null};
  const completion=vm.runInNewContext('(async()=>{'+source+'})()',{
    document:{documentElement:root,getElementById:()=>main},window:{addEventListener(){}},
    MutationObserver:class{constructor(fn){callback=fn;}observe(){}disconnect(){disconnected=true;}},
    setTimeout(fn){timeout=fn;},requestAnimationFrame(fn){fn();}
  });
  return {root,completion,main,markFeedback(){feedback=true;callback();},timeout(){timeout();},get disconnected(){return disconnected;}};
}
test('owned pending feedback reveals cold startup without marking the data request complete',async()=>{
  const h=harness();
  await Promise.resolve();assert.equal(h.root.dataset.appReady,'false');
  h.markFeedback();await h.completion;
  assert.equal(h.root.dataset.appReady,'true');assert.equal(h.main.getAttribute('aria-busy'),'true');assert.equal(h.disconnected,true);
});
test('already-rendered owned feedback reveals without the startup timeout',async()=>{
  const h=harness({feedback:true});await h.completion;assert.equal(h.root.dataset.appReady,'true');
});
test('ordinary pending route remains gated until the existing timeout',async()=>{
  const h=harness();await Promise.resolve();assert.equal(h.root.dataset.appReady,'false');
  h.timeout();await h.completion;assert.equal(h.root.dataset.appReady,'true');
});
test('completed ordinary route still reveals immediately',async()=>{
  const h=harness({busy:'false'});await h.completion;assert.equal(h.root.dataset.appReady,'true');
});
