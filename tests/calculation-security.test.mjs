import test from 'node:test';
import assert from 'node:assert/strict';
import { safeCsvCell, migrate, decodeShareState } from '../apps/web/public/assets/calculation/persistence.mjs';
import { CalculationService } from '../src/calculations/calculation-service.mjs';

test('CSV cells neutralize spreadsheet formula injection',()=>{assert.equal(safeCsvCell('=SUM(A1:A2)'),"\"'=SUM(A1:A2)\"");assert.equal(safeCsvCell('@cmd'),"\"'@cmd\"");});
test('saved schema migration rejects prototype pollution',()=>{const input=JSON.parse('{"schemaVersion":1,"items":[],"__proto__":{"polluted":true}}');assert.throws(()=>migrate(input),/Unsafe key/);assert.equal({}.polluted,undefined);});
test('malformed share state is rejected',()=>assert.throws(()=>decodeShareState('not-valid-json'),Error));
test('calculation service limits batch size and unsafe keys',()=>{const service=new CalculationService();assert.throws(()=>service.batch({requests:Array(101).fill({formulaId:'cagr',inputs:{startValue:1,endValue:2,years:1}})}),/1–100/);const polluted=JSON.parse('{"formulaId":"cagr","inputs":{"__proto__":{"x":1}}}');assert.throws(()=>service.calculate(polluted),/Unsafe input key/);});
