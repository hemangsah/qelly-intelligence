import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateIndicator, listIndicatorDefinitions } from '../apps/web/public/assets/calculation/indicator-engine.mjs';

const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const constant=Array(40).fill(100);
const bars={open:constant,high:Array(40).fill(101),low:Array(40).fill(99),close:constant,volume:Array.from({length:40},(_,i)=>1000+i)};

test('indicator registry has unique governed IDs',()=>{const definitions=listIndicatorDefinitions();assert.ok(definitions.length>=20);assert.equal(new Set(definitions.map(item=>item.indicatorId)).size,definitions.length);for(const item of definitions){assert.equal(item.externalProviderRequired,undefined);assert.equal(item.status,'IMPLEMENTED_DETERMINISTIC_LOCAL');}});

test('SMA and EMA of a constant series equal the constant',()=>{for(const id of ['sma','ema','wma']){const result=calculateIndicator(id,{close:constant,period:10});assert.equal(result.status,'success');close(result.outputs.value.at(-1),100);}});

test('RSI remains within bounds',()=>{const closeSeries=Array.from({length:80},(_,i)=>100+Math.sin(i/4)*5+i*0.05);const result=calculateIndicator('rsi',{close:closeSeries,period:14});for(const value of result.outputs.value.filter(v=>v!=null))assert.ok(value>=0&&value<=100);});

test('Bollinger upper is never below lower',()=>{const result=calculateIndicator('bollinger-bands',{close:Array.from({length:60},(_,i)=>100+Math.sin(i/3)*4),period:20,multiplier:2});for(let i=0;i<60;i++)if(result.outputs.upper[i]!=null)assert.ok(result.outputs.upper[i]>=result.outputs.lower[i]);});

test('ATR and realized volatility are nonnegative',()=>{const atr=calculateIndicator('atr',{...bars,period:14});for(const value of atr.outputs.value.filter(v=>v!=null))assert.ok(value>=0);const rv=calculateIndicator('realized-volatility',{close:Array.from({length:80},(_,i)=>100+i*0.2+Math.sin(i/2)),period:20});for(const value of rv.outputs.value.filter(v=>v!=null))assert.ok(value>=0);});

test('VWAP, OBV and MFI require and use volume',()=>{for(const id of ['vwap','obv','mfi']){const result=calculateIndicator(id,bars);assert.equal(result.status,'success');assert.equal((result.outputs.value??[]).length,40);}const invalid=calculateIndicator('vwap',{...bars,volume:Array(40).fill(0)});assert.equal(invalid.status,'validation_error');});

test('outputs align to input and warm-up is null',()=>{const result=calculateIndicator('macd',{close:Array.from({length:100},(_,i)=>100+i*0.2)});for(const key of ['macd','signal','histogram'])assert.equal(result.outputs[key].length,100);assert.equal(result.outputs.macd[0],null);});

test('invalid OHLC and unsorted semantics are rejected or explicit',()=>{const invalid=calculateIndicator('atr',{open:[10],high:[9],low:[8],close:[10],volume:[1]});assert.equal(invalid.status,'validation_error');const empty=calculateIndicator('sma',{close:[],period:5});assert.equal(empty.status,'success');assert.deepEqual(empty.outputs.value,[]);});

test('repeated runs are deterministic apart from timestamp',()=>{const input={close:Array.from({length:50},(_,i)=>100+i),period:10};const a=calculateIndicator('ema',input),b=calculateIndicator('ema',input);assert.deepEqual(a.outputs,b.outputs);});
