import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionProvenGraph,buildDecisionWalkForwardCalibration} from '../functions/_lib/decision-proven-graph.js';

function candles(count=520){
  const rows=[];
  let close=100;
  const start=1_760_000_000_000;
  for(let i=0;i<count;i++){
    const cycle=Math.sin(i/9)*.0018+Math.sin(i/27)*.0011;
    const drift=i%140<90?.00055:-.00045;
    const ret=drift+cycle+(((i*17)%11)-5)*.00015;
    const open=close;
    close=Math.max(1,open*Math.exp(ret));
    const width=.0022+Math.abs(Math.sin(i/13))*.0016;
    rows.push({
      time:start+i*900_000,
      open,
      high:Math.max(open,close)*(1+width),
      low:Math.min(open,close)*(1-width*.9),
      close,
      volume:900+(i%29)*23,
      trades:100+i%60
    });
  }
  return rows;
}

test('Decision graph honors an explicit bounded bootstrap budget without changing probability safety',()=>{
  const input=candles(220);
  const now=input.at(-1).time+900_000;
  const graph=buildDecisionProvenGraph(input,{asset:'BTC',interval:'15m',horizonBars:16,now,bootstrapPaths:48});
  assert.equal(graph.forecast.paths,48);
  assert.equal(graph.provenance.model.paths,48);
  const probabilities=Object.values(graph.forecast.probabilities);
  assert.ok(probabilities.every(value=>value>=0&&value<=1));
  assert.ok(Math.abs(probabilities.reduce((sum,value)=>sum+value,0)-1)<.0001);
});

test('walk-forward calibration exposes the bounded bootstrap budget and remains deterministic',()=>{
  const input=candles();
  const first=buildDecisionWalkForwardCalibration(input,{interval:'15m',horizonBars:16,bootstrapPaths:64});
  const second=buildDecisionWalkForwardCalibration(input,{interval:'15m',horizonBars:16,bootstrapPaths:64});
  assert.deepEqual(first,second);
  assert.equal(first.bootstrapPaths,64);
  assert.match(first.method,/bounded 64-path bootstrap/i);
  assert.match(first.leakageGuard,/Future candles are used only to score/i);
  assert.ok(first.sampleSize>=36);
});

test('public Decision route pins distinct primary, MTF and calibration Worker budgets',async()=>{
  const endpoint=await readFile(new URL('../functions/api/v1/decision-proven-graph.js',import.meta.url),'utf8');
  assert.match(endpoint,/PRIMARY_BOOTSTRAP_PATHS=192/);
  assert.match(endpoint,/MTF_BOOTSTRAP_PATHS=64/);
  assert.match(endpoint,/CALIBRATION_BOOTSTRAP_PATHS=64/);
  assert.match(endpoint,/cloudflare-worker-bounded-v1/);
  assert.match(endpoint,/without changing evidence, calibration eligibility or NO TRADE gates/);
});
