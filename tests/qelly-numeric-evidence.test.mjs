import test from 'node:test';
import assert from 'node:assert/strict';
import {finiteEvidenceValue} from '../functions/_lib/numeric-evidence.js';
import {buildMarketToolReceipt} from '../functions/_lib/qelly-chat-tools.js';
import {groundedFallbackAnswer,worldBankQuestionContext,__financeIntelligenceTest as finance} from '../functions/_lib/finance-intelligence.js';
import {__test as market} from '../functions/_lib/market-network.js';

const missing=[null,undefined,'',' \t ',false,true,[],[0],{},NaN,Infinity,'Infinity','bad'];
const json=(value)=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});

test('missing and untyped evidence stays absent; real zero and signed numeric statistics survive',()=>{
  for(const value of missing){
    assert.equal(finiteEvidenceValue(value),null);
    assert.equal(finance.displayNumber(value),'unavailable');
    assert.equal(finance.displayPercent(value,{probability:true}),'unavailable');
    assert.equal(market.finiteOrNull(value),null);
  }
  for(const [value,expected] of [[0,0],['0',0],[-2.5,-2.5],[' -2.5 ',-2.5],['1e2',100]])assert.equal(finiteEvidenceValue(value),expected);
  assert.equal(finance.displayPercent(0,{probability:true}),'0.0%');
  assert.equal(finance.displayNumber(0),'0');
});

test('Chat quotes require a positive price and explicit usable provenance',()=>{
  for(const mid of [...missing,0,-1]){
    const tool=buildMarketToolReceipt({hyperliquid:{truthState:'live',data:[{symbol:'BTC',mid}]}},'BTC');
    assert.equal(tool.data.mid,null);assert.equal(tool.truthState,'unavailable');
  }
  for(const truthState of ['live','cached','delayed']){
    const tool=buildMarketToolReceipt({hyperliquid:{truthState,observedAt:'2026-10-05T10:00:00Z',data:[{symbol:'BTC',mid:'80000'}]}},'BTC');
    assert.equal(tool.data.mid,80000);assert.equal(tool.truthState,truthState);assert.equal(tool.observedAt,'2026-10-05T10:00:00Z');
  }
  for(const truthState of [undefined,'unavailable','invented']){
    const tool=buildMarketToolReceipt({hyperliquid:{truthState,data:[{symbol:'BTC',mid:80000}]}},'BTC');
    assert.equal(tool.truthState,'unavailable');assert.equal(tool.data.mid,null);
  }
});

test('Decision Chat fallback never invents zero confidence, entries or stops',()=>{
  const context={tools:[{id:'decision-intelligence',freshness:'cached',data:{asset:'BTC',confidence:null,tradeResearch:{entry:{preferred:''},stop:{price:null}}}}]};
  const answer=finance.decisionFallbackAnswer('Explain entry and stop',context);
  assert.match(answer,/evidence confidence unavailable/);assert.match(answer,/preferred unavailable/);assert.match(answer,/Stop: unavailable/);
  assert.match(finance.toolFallbackLines(context).join('\n'),/evidence confidence unavailable/);
  context.tools[0].data.confidence=0;
  assert.match(finance.decisionFallbackAnswer('Explain entry and stop',context),/evidence confidence 0\.0%/);
});

test('generic Chat fallback excludes malformed quotes and macro rows without losing a real zero',()=>{
  const answer=groundedFallbackAnswer('Compare evidence',{observations:{hyperliquid:[{symbol:'BTC',mid:''},{symbol:'ETH',mid:-1},{symbol:'SOL',mid:100}],worldBank:{observations:[{country:'India',indicator:'GDP growth',value:null},{country:'United States',indicator:'GDP growth',value:0,unit:'%',year:'2025'}]}}});
  assert.match(answer,/SOL 100/);assert.doesNotMatch(answer,/BTC 0|ETH -1|India GDP growth/);assert.match(answer,/United States GDP growth 0%/);
});

test('World Bank question observations skip missing values and retain measured zero',async()=>{
  const records=[null,'',false,0,-1.5].map((value)=>({countryiso3code:'IND',country:{value:'India'},date:'2025',value}));
  const result=await worldBankQuestionContext('India GDP growth',{fetchImpl:async()=>json([{},records])});
  assert.deepEqual(result.observations.map((row)=>row.value),[0,-1.5]);assert.equal(result.truthState,'delayed');
  const absent=await worldBankQuestionContext('India GDP growth',{fetchImpl:async()=>json([{},records.slice(0,3)])});
  assert.equal(absent.truthState,'unavailable');assert.deepEqual(absent.observations,[]);
});

test('provider ingestion rejects empty quotes and selects actual macro periods rather than missing zeroes',async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=async()=>json({BTC:null,ETH:'',SOL:false,HYPE:0,XRP:-1});
    assert.equal((await market.hyperliquidMids()).state,'unavailable');
    globalThis.fetch=async()=>json({BTC:'80000',ETH:''});
    assert.deepEqual((await market.hyperliquidMids()).data,[{symbol:'BTC',mid:80000}]);
    globalThis.fetch=async()=>json([{},[{countryiso3code:'IND',value:null},{countryiso3code:'USA',value:0}]]);
    assert.deepEqual((await market.worldBankMacro()).data.map((row)=>row.gdpGrowthPct),[0]);
    globalThis.fetch=async()=>json([{},[{countryiso3code:'IND',value:null}]]);
    assert.equal((await market.worldBankMacro()).state,'unavailable');
    const year=new Date().getUTCFullYear();
    globalThis.fetch=async()=>json({values:{NGDP_RPCH:{IND:{[year]:null,[year-1]:0,[year-2]:-1}}}});
    const imf=await market.imfGrowthReference();
    assert.equal(imf.data[0].year,String(year-1));assert.equal(imf.data[0].growthPct,0);
  }finally{globalThis.fetch=original;}
});
