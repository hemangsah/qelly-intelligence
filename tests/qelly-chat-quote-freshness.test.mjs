import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFinanceContext,groundedFallbackAnswer,runGroundedFinanceInference,suggestedRoutes} from '../functions/_lib/finance-intelligence.js';
import {__qellyChatTest as chat} from '../apps/web/public/assets/ai/qelly-chat.mjs';

const observedAt='2026-10-05T10:00:00Z';
const contextFor=(truthState)=>({observations:{hyperliquid:[{symbol:'BTC',mid:80000}]},citations:[{id:'hyperliquid-public',truthState,observedAt}],tools:[]});

test('new and restored Chat route actions use current public route identities',()=>{
  assert.deepEqual(suggestedRoutes('What is BTC?'),[{route:'market',label:'Open Market Pulse'},{route:'news-research',label:'Open QELLY Chat'}]);
  assert.equal(chat.routeActionLabel({route:'market',label:'Market Command'}),'Open Market Pulse');
  assert.equal(chat.routeActionLabel({route:'news-research',label:'Qelly Chat & Research'}),'Open QELLY Chat');
  assert.equal(chat.routeActionLabel({route:'decision-provenance',label:'Verify this decision'}),'Verify this decision');
});

test('fallback quotes retain live, cached or delayed provenance and observation time',()=>{
  for(const truthState of ['live','cached','delayed']){
    const answer=groundedFallbackAnswer('What is BTC?',contextFor(truthState));
    assert.ok(answer.includes(`${truthState[0].toUpperCase()}${truthState.slice(1)} crypto reference: BTC 80,000`));
    assert.ok(answer.includes(`observed ${observedAt} [hyperliquid-public]`));
    if(truthState!=='live')assert.doesNotMatch(answer,/Live crypto reference/);
  }
});

test('unknown or unavailable provenance withholds positive stale quotes, including model failure',async()=>{
  for(const truthState of [undefined,'unavailable','invented']){
    const financeContext=contextFor(truthState);
    const answer=groundedFallbackAnswer('What is BTC?',financeContext);
    assert.match(answer,/Crypto reference data is currently unavailable/);
    assert.doesNotMatch(answer,/80,000/);
    const result=await runGroundedFinanceInference({AI:{async run(){throw Error('Workers AI busy');}}},{message:'What is BTC?',history:[],financeContext});
    assert.equal(result.state,'model_unavailable_fallback');
    assert.doesNotMatch(result.answer,/80,000/);
  }
});

test('finance context withholds source payloads whose quote provenance is unusable',async()=>{
  for(const truthState of ['live','cached','delayed',undefined,'unavailable','invented']){
    const context=await buildFinanceContext({env:{}},'What is BTC?',{
      networkLoader:async()=>({sources:{hyperliquid:{truthState,observedAt,data:[{symbol:'BTC',mid:80000}]}}}),
      providerLoader:async()=>null,
      worldBankLoader:async()=>({truthState:'unavailable',observations:[]})
    });
    assert.equal(context.observations.hyperliquid.length,['live','cached','delayed'].includes(truthState)?1:0);
    assert.equal(context.citations.find(item=>item.id==='hyperliquid-public').observedAt,observedAt);
  }
});
