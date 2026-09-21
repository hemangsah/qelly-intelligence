import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_ASSETS,CHAT_MODES,CHAT_TIMEFRAMES,
  normalizeChatAsset,normalizeChatMode,normalizeChatTimeframe,
  buildCalculatorToolReceipt,buildEventCalendarToolReceipt,buildFormulaScreenerToolReceipt,buildIndiaToolReceipt,buildMarketToolReceipt,buildPublicResearchToolReceipt,buildSearchToolReceipt,buildVerifyToolReceipt
} from '../functions/_lib/qelly-chat-tools.js';

test('chat controls normalize to bounded public values',()=>{
  assert.deepEqual(CHAT_MODES,['ask','research','compare','explain','calculate','decision','asset','india']);
  assert.deepEqual(CHAT_ASSETS,['BTC','ETH','SOL','HYPE','XRP','DOGE']);
  assert.ok(CHAT_TIMEFRAMES.includes('1m')&&CHAT_TIMEFRAMES.includes('1d'));
  assert.equal(normalizeChatMode('unknown'),'ask');
  assert.equal(normalizeChatAsset('eth'),'ETH');
  assert.equal(normalizeChatAsset('INVALID'),'BTC');
  assert.equal(normalizeChatTimeframe('4h'),'4h');
  assert.equal(normalizeChatTimeframe('2m'),'15m');
});

test('calculator receipt fails closed until registered inputs are supplied',()=>{
  const empty=buildCalculatorToolReceipt({formulaId:'cagr'});
  assert.equal(empty.truthState,'input_required');
  assert.equal(empty.data.definition.formulaId,'cagr');
  assert.deepEqual(empty.data.definition.example,{startValue:100,endValue:125,years:3});

  const result=buildCalculatorToolReceipt({formulaId:'cagr',inputs:{startValue:100,endValue:121,years:2}});
  assert.equal(result.truthState,'deterministic');
  assert.equal(result.data.outputs.cagrPercent,10);
  assert.equal(result.data.formulaId,'cagr');
  assert.match(result.source,/QELLY formula engine/);

  const invalid=buildCalculatorToolReceipt({formulaId:'cagr',inputs:{startValue:0,endValue:121,years:2}});
  assert.equal(invalid.truthState,'invalid_input');
  assert.match(invalid.limitations.join(' '),/no substitute result/i);
});

test('India receipt separates delayed evidence from display-only market widgets',()=>{
  const receipt=buildIndiaToolReceipt({
    observations:{
      worldBank:{observations:[{countryId:'IND',country:'India',indicator:'GDP growth',value:6.4,unit:'%',year:'2025'}]},
      ecb:{base:'EUR',rates:{INR:91},observedAt:'2026-09-19'}
    },
    citations:[
      {id:'world-bank',title:'World Bank Indicators API',truthState:'delayed_reference',observedAt:'2025'},
      {id:'ecb-reference',title:'European Central Bank',truthState:'delayed',observedAt:'2026-09-19'}
    ]
  });
  assert.equal(receipt.id,'india-finance');
  assert.equal(receipt.truthState,'delayed');
  assert.deepEqual(receipt.data.displayOnlyCoverage,['Nifty 50','Sensex','Bank Nifty','USD/INR','Gold']);
  assert.match(receipt.limitations.join(' '),/display-only/i);
  assert.match(receipt.limitations.join(' '),/FII\/DII/i);
});

test('public search receipt remains governed catalog search, not web or private search',()=>{
  const receipt=buildSearchToolReceipt('CAGR',{});
  assert.equal(receipt.id,'qelly-search');
  assert.equal(receipt.truthState,'catalog');
  assert.ok(receipt.data.items.some(item=>item.id==='cagr'));
  assert.match(receipt.limitations.join(' '),/not a web search/i);
  assert.match(receipt.limitations.join(' '),/private workspace/i);
});


test('tool receipts expose explicit freshness, timestamps and limitations',()=>{
  const market=buildMarketToolReceipt({hyperliquid:{truthState:'live',observedAt:'2026-09-21T00:00:00Z',data:[{symbol:'BTC',mid:80000}]}},'BTC');
  assert.equal(market.truthState,'live');
  assert.equal(market.freshness,'live');
  assert.equal(market.observedAt,'2026-09-21T00:00:00Z');
  assert.ok(Number.isFinite(Date.parse(market.generatedAt)));
  assert.ok(market.limitations.length>0);

  const research=buildPublicResearchToolReceipt({generatedAt:'2026-09-21T00:00:00Z',citations:[{id:'world-bank',title:'World Bank',truthState:'delayed',observedAt:'2025-01-01',url:'https://example.com'}]});
  assert.equal(research.freshness,'mixed-source');
  assert.equal(research.data.sources[0].truthState,'delayed');
});

test('Formula Screener receipt runs the registered bounded metric on provider-derived candles',async()=>{
  const now=Date.now();
  const candles=Array.from({length:140},(_,index)=>{
    const close=100+index*.2+Math.sin(index/5);
    return {t:now-(140-index)*3_600_000,o:String(close-.1),h:String(close+.6),l:String(close-.6),c:String(close),v:String(1000+index),n:10+index};
  });
  const receipt=await buildFormulaScreenerToolReceipt({__fetch:async()=>new Response(JSON.stringify(candles),{status:200,headers:{'content-type':'application/json'}})},{message:'screen BTC with RSI impulse',asset:'BTC'});
  assert.equal(receipt.id,'formula-screener');
  assert.match(receipt.truthState,/live|partial/);
  assert.ok(receipt.data.rows.some(row=>row.asset==='BTC'));
  assert.equal(receipt.data.formula.id,'rsi_impulse');
  assert.ok(receipt.freshness);
  assert.match(receipt.limitations.join(' '),/custom expressions/i);
});

test('Event Calendar and Qelly Verify fail closed when live or user evidence is absent',()=>{
  const event=buildEventCalendarToolReceipt('show catalysts','BTC');
  assert.equal(event.id,'event-calendar');
  assert.equal(event.truthState,'planning-only');
  assert.equal(event.data.coverage.liveFeed,false);
  assert.equal(event.data.coverage.connectedEvents,0);
  assert.match(event.limitations.join(' '),/no approved production event feed/i);

  const unsupported=buildEventCalendarToolReceipt('show catalysts','ETH');
  assert.equal(unsupported.truthState,'unavailable');
  assert.match(unsupported.limitations.join(' '),/not silently mapped/i);

  const verify=buildVerifyToolReceipt();
  assert.equal(verify.truthState,'input_required');
  assert.equal(verify.freshness,'not-applicable');
  assert.equal(verify.data.minimumValidTrades,5);
  assert.match(verify.limitations.join(' '),/user-supplied/i);
});
