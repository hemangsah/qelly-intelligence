import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {deflateRawSync} from 'node:zlib';
import {parseMt5Html,parseMt5Xlsx,MT5_REPORT_LIMITS,__mt5ParserTest} from '../apps/web/public/assets/qelly-mt5-report-parser.mjs';
import {analyzeTrades} from '../apps/web/public/assets/qelly-verify-engine.mjs';
import {composeStrategyEvidenceReport,fingerprintSource} from '../apps/web/public/assets/qelly-verify-report.mjs';
const header='<tr><th>Time</th><th>Deal</th><th>Symbol</th><th>Type</th><th>Direction</th><th>Commission</th><th>Fee</th><th>Swap</th><th>Profit</th></tr>';
const deal=(id,{type='buy',direction='out',profit='10.50',commission='-0.25',fee='-0.05',swap='-0.20',symbol='EURUSD'}={})=>'<tr>'+['2026.10.01 13:55',id,symbol,type,direction,commission,fee,swap,profit].map(v=>'<td>'+v+'</td>').join('')+'</tr>';
const sample='<html><body><table><tr><th>Strategy Tester Report</th></tr><tr><td>Net Profit</td><td>99999</td></tr>'+header+deal(1)+deal(2,{type:'sell',direction:'out by',profit:'(5.00)'})+deal(3,{direction:'in',profit:'1000'})+deal(4,{direction:'in/out',profit:'15.0'})+deal(5,{direction:'out',profit:'3.00'})+deal(6,{direction:'out',profit:'4.00'})+deal(7,{type:'balance',profit:'10000'})+deal(8,{direction:'out',profit:'6.00'})+'</table><script>throw Error("NEVER EXECUTE HTML")</script></body></html>';
const s16=(buf,at,val)=>buf.writeUInt16LE(val,at);
const s32=(buf,at,val)=>buf.writeUInt32LE(val>>>0,at);
function storedXlsx(entries,{deflate=false}={}){
  const local=[],central=[];let offset=0;
  for(const [name,body] of entries){
    const nameBytes=Buffer.from(name),raw=Buffer.from(body),packed=deflate?deflateRawSync(raw):raw;const a=Buffer.alloc(30);s32(a,0,0x04034b50);s16(a,4,20);s16(a,8,deflate?8:0);s32(a,18,packed.length);s32(a,22,raw.length);s16(a,26,nameBytes.length);
    local.push(a,nameBytes,packed);
    const z=Buffer.alloc(46);s32(z,0,0x02014b50);s16(z,4,20);s16(z,6,20);s16(z,10,deflate?8:0);s32(z,20,packed.length);s32(z,24,raw.length);s16(z,28,nameBytes.length);s32(z,42,offset);
    central.push(z,nameBytes);offset+=a.length+nameBytes.length+packed.length;
  }
  const directory=Buffer.concat(central),tail=Buffer.alloc(22);s32(tail,0,0x06054b50);s16(tail,8,entries.length);s16(tail,10,entries.length);s32(tail,12,directory.length);s32(tail,16,offset);
  return new Uint8Array(Buffer.concat([...local,directory,tail]));
}
const xCell=(col,row,value,type='inlineStr')=>type==='inlineStr'?'<c r="'+col+row+'" t="inlineStr"><is><t>'+value+'</t></is></c>':'<c r="'+col+row+'" t="'+type+'"><v>'+value+'</v></c>';
const xRow=(row,values)=>'<row r="'+row+'">'+values.map((v,i)=>xCell(String.fromCharCode(65+i),row,v)).join('')+'</row>';
test('HTML parser selects real closing MT5 deals and rejects open entries, balance and summary totals',()=>{
  const parsed=parseMt5Html(sample);
  assert.equal(parsed.trades.length,6);
  assert.deepEqual(parsed.trades.map(t=>t.pnl),[10,-5.5,14.5,2.5,3.5,5.5]);
  assert.equal(parsed.validation.mt5.openDealsExcluded,1);
  assert.equal(parsed.validation.mt5.nonTradeRowsExcluded,1);
  assert.equal(parsed.validation.mt5.entrySideCostsReconciled,false);
  assert.equal(parsed.validation.mt5.format,'mt5-html');
  assert.equal(parsed.validation.detectedFields.symbol,'Symbol');
  const result=analyzeTrades(parsed.trades,{sourceName:'mt5.html'});
  assert.equal(result.sample.trades,6);
  assert.equal(result.performance.netProfit,30.5);
});
test('HTML parser strips active content and fails closed without a supported deal direction',()=>{
  assert.throws(()=>parseMt5Html('<script>throw 0</script>'),e=>e.code==='mt5_deals_table_missing');
  assert.throws(()=>parseMt5Html('<table>'+header+deal(1,{direction:'in'})+'</table>'),e=>e.code==='mt5_no_realized_deals');
  assert.throws(()=>parseMt5Html('<table><tr><td>Profit</td><td>12500</td></tr></table>'),e=>e.code==='mt5_deals_table_missing');
});
test('HTML parser rejects unpriced realized closes and reports missing costs rather than silently estimating them',()=>{
  const result=parseMt5Html('<table>'+header+deal(1,{profit:'n/a'})+deal(2,{commission:'n/a',profit:'7'})+'</table>');
  assert.equal(result.validation.invalidRows,1);
  assert.equal(result.validation.mt5.closingDealsWithMissingCosts,1);
  assert.equal(result.validation.invalidExamples[0].row,2);
  assert.equal(result.trades[0].pnl,6.75);
});
test('MT5 numeric parser accepts account-style thousands, local decimals and accounting negatives',()=>{
  const n=__mt5ParserTest.num;
  assert.equal(n('1 234,56'),1234.56);assert.equal(n('(1,250.50)'),-1250.5);assert.equal(n('1.250,50'),1250.5);
  assert.equal(n('—'),null);assert.equal(n('bad<script>'),null);
});
test('XLSX reader processes bounded inline-string worksheet without executing macros or fetching files',async()=>{
  const columns=['Time','Deal','Symbol','Type','Direction','Commission','Fee','Swap','Profit'];
  const values=[['2026.10.01','1','EURUSD','buy','out','-1','0','0','10'],['2026.10.02','2','EURUSD','sell','out by','-1','0','0','-3'],['2026.10.03','3','EURUSD','buy','in','-1','0','0','12'],['2026.10.04','4','EURUSD','buy','out','-1','0','0','13'],['2026.10.05','5','EURUSD','sell','out','-1','0','0','7'],['2026.10.06','6','EURUSD','sell','inout','-1','0','0','9'],['2026.10.07','7','EURUSD','buy','out','-1','0','0','8']];
  const xml='<?xml version="1.0"?><worksheet><sheetData>'+xRow(1,columns)+values.map((row,i)=>xRow(i+2,row)).join('')+'</sheetData></worksheet>';
  const archive=storedXlsx([['xl/worksheets/sheet1.xml',xml]]);
  const parsed=await parseMt5Xlsx(archive);
  assert.equal(parsed.validation.mt5.format,'mt5-xlsx');
  assert.deepEqual(parsed.trades.map(t=>t.pnl),[9,-4,12,6,8,7]);
  assert.equal(parsed.validation.mt5.openDealsExcluded,1);
  assert.equal(analyzeTrades(parsed.trades).sample.trades,6);
});
test('real deflated MT5 XLSX workbook is decoded locally with streaming size enforcement',async()=>{
  const columns=['Time','Deal','Symbol','Type','Direction','Commission','Fee','Swap','Profit'];
  const rows=[columns,...Array.from({length:8},(_,i)=>['2026.10.01',String(i+1),'EURUSD','buy',i===0?'in':'out','-1','0','0',String(i+2)])];
  const xml='<worksheet><sheetData>'+rows.map((row,i)=>xRow(i+1,row)).join('')+'</sheetData></worksheet>';
  const packed=storedXlsx([['xl/worksheets/sheet1.xml',xml]],{deflate:true});
  if(typeof DecompressionStream!=='function'){
    await assert.rejects(parseMt5Xlsx(packed),e=>e.code==='mt5_xlsx_decompression_unavailable');
    return;
  }
  const parsed=await parseMt5Xlsx(packed);
  assert.equal(parsed.trades.length,7);
  assert.equal(parsed.trades[0].pnl,2);
  assert.equal(parsed.validation.mt5.openDealsExcluded,1);
});
test('XLSX ZIP rejects corrupt, unsafe, oversized and unsupported file shapes',async()=>{
  await assert.rejects(parseMt5Xlsx(new Uint8Array([1,2,3])),e=>e.code==='mt5_xlsx_invalid');
  await assert.rejects(parseMt5Xlsx(storedXlsx([['../xl/worksheets/sheet1.xml','x']])),e=>e.code==='mt5_xlsx_invalid_path');
  await assert.rejects(parseMt5Xlsx(storedXlsx([['xl/vbaProject.bin','malicious'],['xl/worksheets/sheet1.xml','<worksheet/>']])),e=>e.code==='mt5_xlsx_unsupported');
  await assert.rejects(parseMt5Xlsx(storedXlsx([['xl/worksheets/sheet1.xml','<worksheet><f>1+2</f></worksheet>']])),e=>e.code==='mt5_xlsx_unsupported');
  assert.equal(MT5_REPORT_LIMITS.fileBytes,5*1024*1024);
});
test('Evidence fingerprints XLSX raw bytes and explicitly discloses incomplete net costs',async()=>{
  const parsed=parseMt5Html(sample),analysis=analyzeTrades(parsed.trades);
  const report=await composeStrategyEvidenceReport({analysis,validation:parsed.validation,sourceText:new Uint8Array([0,255,128,55]),sourceName:'strategy.xlsx'});
  assert.equal(report.source.fingerprint.encoding,'raw-file-bytes');
  assert.match(report.dataQuality.issues.join(' '),/entry-side commission/);
  assert.match(report.warnings.join(' '),/not fully reconciled/);
  const other=await fingerprintSource(new Uint8Array([0,255,128,56]));
  assert.notEqual(report.source.fingerprint.value,other.value);
  assert.equal(report.source.uploaded,false);
  assert.equal(report.source.retained,false);
});
test('Verify file picker supports CSV/MT5 HTML/XLSX but keeps local-only boundary',async()=>{
  const source=await readFile(new URL('../apps/web/public/assets/qelly-verify-product.mjs',import.meta.url),'utf8');
  assert.match(source,/\.htm,\.html,\.xlsx/);
  assert.match(source,/parseMt5Html\(sourceText/);
  assert.match(source,/await parseMt5Xlsx\(sourceText/);
  assert.match(source,/new Uint8Array\(await file\.arrayBuffer\(\)\)/);
  assert.doesNotMatch(source,/fetch\s*\(/);
  assert.doesNotMatch(source,/executeTrade|placeOrder|wallet\.sign/);
});
