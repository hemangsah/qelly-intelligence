import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_ASSETS,CHAT_MODES,CHAT_TIMEFRAMES,
  normalizeChatAsset,normalizeChatMode,normalizeChatTimeframe,
  buildCalculatorToolReceipt,buildIndiaToolReceipt,buildSearchToolReceipt
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
