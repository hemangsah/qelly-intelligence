import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionHistoricalAnalogs} from '../functions/_lib/decision-historical-analogs.js';
import {buildDecisionIntelligence} from '../functions/api/v1/decision-proven-graph.js';

function candles(count=220){
  const rows=[];
  let close=100;
  const start=1_780_000_000_000;
  for(let i=0;i<count;i++){
    const ret=.00025+Math.sin(i/11)*.0012+(((i*19)%9)-4)*.00012;
    const open=close;
    close=Math.max(1,open*Math.exp(ret));
    const width=.002+Math.abs(Math.sin(i/17))*.0014;
    rows.push({
      time:start+i*900_000,
      open,
      high:Math.max(open,close)*(1+width),
      low:Math.min(open,close)*(1-width*.9),
      close,
      volume:900+(i%23)*17,
      trades:80+i%40
    });
  }
  return rows;
}

test('historical analog work uses a bounded candidate stride',()=>{
  const input=candles(620);
  const result=buildDecisionHistoricalAnalogs(input,{interval:'15m',horizonBars:16,windowBars:100,limit:5});
  assert.equal(result.state,'AVAILABLE');
  assert.ok(result.candidateStepBars>=16);
  assert.ok(result.sampledWindows<=33);
  assert.ok(result.analogs.length<=5);
  assert.equal(result.eligibilityImpact,'none');
  assert.match(result.method,/bounded candidate stride/i);
  assert.match(result.leakageGuard,/No forward return/i);
});

test('Decision runtime reuses the selected timeframe and keeps it unique in MTF',async()=>{
  const input=candles();
  const now=input.at(-1).time+900_000;
  const providerBodies=[];
  const result=await buildDecisionIntelligence({__fetch:async(url,options={})=>{
    if(String(url).includes('api.hyperliquid.xyz')){
      const body=JSON.parse(options.body||'{}');
      providerBodies.push(body);
      if(body.type==='metaAndAssetCtxs'){
        return new Response(JSON.stringify([
          {universe:[{name:'BTC'},{name:'ETH'}]},
          [
            {funding:'0.0001',openInterest:'100',markPx:'100',oraclePx:'100',dayNtlVlm:'1000000',premium:'0'},
            {funding:'0.0001',openInterest:'100',markPx:'100',oraclePx:'100',dayNtlVlm:'1000000',premium:'0'}
          ]
        ]),{status:200,headers:{'content-type':'application/json'}});
      }
      if(body.type==='fundingHistory')return new Response(JSON.stringify([]),{status:200,headers:{'content-type':'application/json'}});
      if(body.type==='l2Book')return new Response(JSON.stringify({error:'unavailable'}),{status:503,headers:{'content-type':'application/json'}});
      if(body.type==='candleSnapshot')return new Response(JSON.stringify(input),{status:200,headers:{'content-type':'application/json'}});
    }
    return new Response(JSON.stringify({articles:[]}),{status:200,headers:{'content-type':'application/json'}});
  }},{
    asset:'BTC',
    interval:'15m',
    horizon:'4h',
    includeNews:false,
    now
  });

  const selectedRequests=providerBodies.filter(body=>body.type==='candleSnapshot'&&body.req?.coin==='BTC'&&body.req?.interval==='15m');
  assert.equal(selectedRequests.length,1);
  const intervals=result.multiTimeframe.views.map(view=>view.interval);
  assert.equal(intervals.filter(interval=>interval==='15m').length,1);
  assert.equal(new Set(intervals).size,intervals.length);
  assert.equal(result.forecast.paths,256);
  assert.equal(result.execution,false);
});

test('public Decision source pins the reduced display-model budgets',async()=>{
  const endpoint=await readFile(new URL('../functions/api/v1/decision-proven-graph.js',import.meta.url),'utf8');
  assert.match(endpoint,/scenarioPaths:48/);
  assert.match(endpoint,/scenarioPaths:256/);
  assert.match(endpoint,/TIMEFRAMES\.filter\(interval=>interval!==selectedInterval\)/);
  assert.match(endpoint,/assembleTimeframes\(graph,timeframeSupport\)/);
});
