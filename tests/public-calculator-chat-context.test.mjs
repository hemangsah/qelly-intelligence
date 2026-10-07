import test from 'node:test';
import assert from 'node:assert/strict';
import {__qellyChatTest} from '../apps/web/public/assets/ai/qelly-chat.mjs';
test('public calculator context ignores shared-input fragments and keeps terminal routes intact',t=>{
  const prior=globalThis.location;t.after(()=>{if(prior===undefined)delete globalThis.location;else globalThis.location=prior;});
  for(const pathname of ['/calculators/','/calculators/index.html','/calculators/kelly-criterion-calculator/index.html']){
    globalThis.location={pathname,hash:'#q=%7B%22winProbability%22%3A17.25%7D'};
    assert.equal(__qellyChatTest.currentRoute(),'calculator-center');
    const context=__qellyChatTest.normalizeDockContext({route:'calculator-center',contextType:'calculator',meta:'Kelly Criterion Calculator',mode:'explain'});
    assert.equal(context.contextType,'calculator');assert.equal(context.meta,'Kelly Criterion Calculator');
  }
  globalThis.location={pathname:'/',hash:'#/decision-provenance'};assert.equal(__qellyChatTest.currentRoute(),'decision-provenance');
  globalThis.location={pathname:'/unrelated/',hash:'#/market'};assert.equal(__qellyChatTest.currentRoute(),'market');
});
