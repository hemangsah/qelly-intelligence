import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__decisionQuantRiskTest} from '../functions/_lib/decision-quant-risk.js';
import {__decisionProvenGraphPerfTest} from '../functions/_lib/decision-proven-graph.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const mean=(values)=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const logReturn=(a,b)=>a>0&&b>0?Math.log(b/a):0;

function candles(count=180){
  const rows=[];
  let close=100;
  const start=1_780_000_000_000;
  for(let i=0;i<count;i++){
    const ret=.0003+Math.sin(i/9)*.0011+(((i*17)%11)-5)*.00009;
    const open=close;
    close=Math.max(1,open*Math.exp(ret));
    const width=.0018+Math.abs(Math.cos(i/13))*.0012;
    rows.push({
      time:start+i*900_000,
      open,
      high:Math.max(open,close)*(1+width),
      low:Math.min(open,close)*(1-width*.9),
      close,
      volume:800+(i%19)*23,
      trades:70+i%31
    });
  }
  return rows;
}

function slowRollingRealized(rows,window=20){
  const output=[];
  for(let end=window;end<rows.length;end++){
    const slice=rows.slice(end-window,end+1),returns=[];
    for(let i=1;i<slice.length;i++)returns.push(logReturn(slice[i-1].close,slice[i].close));
    const avg=mean(returns);
    output.push(Math.sqrt(mean(returns.map(value=>(value-avg)**2))));
  }
  return output;
}

function slowAdx(rows,period=14){
  if(rows.length<period*2+1)return null;
  const trs=[],plus=[],minus=[];
  for(let i=1;i<rows.length;i++){
    const current=rows[i],previous=rows[i-1];
    const up=current.high-previous.high,down=previous.low-current.low;
    trs.push(Math.max(current.high-current.low,Math.abs(current.high-previous.close),Math.abs(current.low-previous.close)));
    plus.push(up>down&&up>0?up:0);
    minus.push(down>up&&down>0?down:0);
  }
  const dx=[];
  for(let i=period-1;i<trs.length;i++){
    const tr=mean(trs.slice(i-period+1,i+1));
    if(!(tr>0))continue;
    const p=100*mean(plus.slice(i-period+1,i+1))/tr;
    const m=100*mean(minus.slice(i-period+1,i+1))/tr;
    const denom=p+m;
    if(denom>0)dx.push(100*Math.abs(p-m)/denom);
  }
  return dx.length?mean(dx.slice(-period)):null;
}

test('linear rolling realized volatility is numerically equivalent to the previous window formula',()=>{
  const input=candles();
  const expected=slowRollingRealized(input,20);
  const actual=__decisionQuantRiskTest.rollingRealized(input,20);
  assert.equal(actual.length,expected.length);
  actual.forEach((value,index)=>assert.ok(Math.abs(value-expected[index])<1e-12,`rolling value ${index} diverged`));
});

test('linear ADX is numerically equivalent to the previous rolling-slice formula',()=>{
  const input=candles();
  const expected=slowAdx(input,14);
  const actual=__decisionQuantRiskTest.adx(input,14);
  assert.ok(Math.abs(actual-expected)<1e-10);
});

test('calibration uses the exact same log-return series without computing unused metric families',()=>{
  const input=candles(220);
  const returns=__decisionProvenGraphPerfTest.logReturns(input);
  const metricReturns=__decisionProvenGraphPerfTest.metricSet(input,900_000).returns;
  assert.deepEqual(returns,metricReturns);
});

test('production Decision source keeps quality budgets while removing redundant calibration work and provider burst contention',async()=>{
  const source=await read('functions/api/v1/decision-proven-graph.js');
  const lib=await read('functions/_lib/decision-proven-graph.js');
  assert.match(source,/scenarioPaths:256/);
  assert.match(source,/scenarioPaths:48/);
  assert.match(lib,/bootstrapPaths:64/);
  assert.match(lib,/const returns=logReturns\(history\)/);
  assert.doesNotMatch(lib,/const \{returns\}=metricSet\(history,intervalMs\)/);
  const mandatory=source.indexOf('const payload=await fetchCandles(fetchImpl,resolvedAsset,resolvedInterval,endTime)');
  const optional=source.indexOf('const [timeframeSupport,derivativesCurrent,liquidity,fundingRows,benchmarkPayload]=await Promise.all');
  assert.ok(mandatory>=0&&optional>mandatory);
  assert.match(source,/optional evidence calls[\s\S]*core Decision input/);
});
