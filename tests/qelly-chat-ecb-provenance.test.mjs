import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFinanceContext,groundedFallbackAnswer,__financeIntelligenceTest as finance} from '../functions/_lib/finance-intelligence.js';

const observationTime='2026-10-02T16:00:00.000Z',ingestionTime='2026-10-05T12:00:00.000Z';
const provider=(truthState)=>({truthState,observationTime,ingestionTime,freshness:truthState==='stale_provider'?'stale':'daily-working-day-reference',attribution:'European Central Bank',data:{base:'EUR',rates:{EUR:1,USD:1.1,INR:90}}});

test('Chat retains actual provider observation and ingestion fields with cached/stale state',()=>{
  for(const [input,expected] of [['delayed_provider','delayed'],['cached_provider','cached'],['stale_provider','stale']]){
    const result=finance.normalizeEcb(provider(input));
    assert.equal(result.truthState,expected);
    assert.equal(result.observedAt,observationTime);
    assert.equal(result.fetchedAt,ingestionTime);
    assert.equal(result.rates.INR,90);
    const answer=groundedFallbackAnswer('Explain ECB references',{observations:{ecb:result}});
    assert.match(answer,new RegExp(`ECB reference \\(${expected}\\)`));
    assert.ok(answer.includes(`observed ${observationTime} [ecb-reference]`));
    assert.doesNotMatch(answer,/live ECB/i);
  }
});

test('unavailable/unknown ECB provenance and malformed rates cannot become reference observations',()=>{
  for(const truthState of [undefined,'unavailable','invented','__proto__','constructor','toString']){
    const result=finance.normalizeEcb(provider(truthState));
    assert.equal(result.truthState,'unavailable');assert.equal(result.rates,null);
  }
  const malformed=provider('cached_provider');
  malformed.data.rates={USD:null,INR:'',GBP:false,JPY:0,CHF:-1,AUD:'Infinity'};
  assert.equal(finance.normalizeEcb(malformed).rates,null);
  malformed.data.rates={USD:'1.1',INR:null};
  assert.deepEqual(finance.normalizeEcb(malformed).rates,{USD:1.1});
  malformed.data.base='USD';assert.equal(finance.normalizeEcb(malformed).rates,null);
  assert.equal(finance.normalizeEcb(null).fetchedAt,null);
});

test('ECB provenance flows into source citations and the India reference receipt',async()=>{
  const result=await buildFinanceContext({env:{}},'Explain India FX references',{
    mode:'india',networkLoader:async()=>({sources:{}}),providerLoader:async()=>provider('stale_provider'),
    worldBankLoader:async()=>({truthState:'unavailable',observations:[]})
  });
  const source=result.citations.find(item=>item.id==='ecb-reference');
  assert.equal(source.truthState,'stale');assert.equal(source.observedAt,observationTime);
  const tool=result.tools.find(item=>item.id==='india-finance');
  assert.equal(tool.truthState,'stale');assert.equal(tool.freshness,'stale');
  assert.match(finance.toolFallbackLines(result).join('\n'),/India Finance: stale reference/);
  const reference=tool.data.ecbReference;
  assert.equal(reference.truthState,'stale');assert.equal(reference.freshness,'stale');
  assert.equal(reference.observedAt,observationTime);
});
