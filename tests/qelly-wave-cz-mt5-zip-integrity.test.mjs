import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMt5Xlsx,MT5_REPORT_LIMITS} from '../apps/web/public/assets/qelly-mt5-report-parser.mjs';
import {zipFixture,sheet,sheetName,endOffset,centralOffset} from './fixtures/mt5-zip-builder.mjs';
const reject=(data,code='mt5_xlsx_invalid')=>assert.rejects(()=>parseMt5Xlsx(data),e=>e.code===code);
test('static stored/deflated workbooks with signed and unsigned streaming descriptors retain exact P&L',async()=>{
 for(const deflate of [false,true])for(const descriptor of [false,true])for(const signed of [false,true]){
  const parsed=await parseMt5Xlsx(zipFixture(undefined,{deflate,descriptor,signed}));
  assert.equal(parsed.trades.length,1);assert.equal(parsed.trades[0].pnl,10);
 }
});
test('ZIP comments are bounded and a false EOCD signature inside a comment cannot hide the directory',async()=>{
 const comment='PK\u0005\u0006'+'x'.repeat(30);
 assert.equal((await parseMt5Xlsx(zipFixture(undefined,{comment}))).trades[0].pnl,10);
 const malformed=zipFixture();malformed.writeUInt16LE(1,endOffset(malformed)+20);await reject(malformed);
 await reject(Buffer.concat([zipFixture(),Buffer.from('trailing') ]));
});
test('same-length profit tampering and matching forged header CRCs cannot bypass consumed-data checksums',async()=>{
 const tampered=zipFixture();const at=tampered.indexOf(Buffer.from('<v>10</v>'));tampered[at+3]='9'.charCodeAt(0);
 await reject(tampered,'mt5_xlsx_checksum_invalid');
 const forged=zipFixture();forged.writeUInt32LE(0,14);forged.writeUInt32LE(0,centralOffset(forged)+16);
 await reject(forged,'mt5_xlsx_checksum_invalid');
 const strings=zipFixture([['xl/sharedStrings.xml','<sst><si><t>Deal</t></si></sst>'],[sheetName,sheet]]);
 strings[strings.indexOf(Buffer.from('Deal'))]='X'.charCodeAt(0);await reject(strings,'mt5_xlsx_checksum_invalid');
});
test('local names, flags, compression method, CRC and sizes must reconcile with central metadata',async()=>{
 for(const change of [b=>{b[30]='z'.charCodeAt(0);},b=>b.writeUInt16LE(8,6),b=>b.writeUInt16LE(8,8),b=>b.writeUInt32LE(1,14),b=>b.writeUInt32LE(1,18),b=>b.writeUInt32LE(1,22)]){
  const b=zipFixture();change(b);await reject(b);
 }
});
test('descriptors require matching CRC/size with or without signature',async()=>{
 for(const signed of [false,true]){
  const b=zipFixture(undefined,{descriptor:true,signed});const descriptor=centralOffset(b)-(signed?16:12);
  b.writeUInt32LE(0,descriptor+(signed?4:0));await reject(b);
 }
});
test('all entry names and local records are audited, including otherwise ignored workbook parts',async()=>{
 await reject(zipFixture([['docProps/core.xml','x'],['docProps/core.xml','x'],[sheetName,sheet]]));
 await reject(zipFixture([[sheetName,sheet],[sheetName.toUpperCase(),sheet]]));
 const b=zipFixture([['docProps/core.xml','x'],[sheetName,sheet]]);b[30]='z'.charCodeAt(0);await reject(b);
 for(const path of ['../evil.xml','/evil.xml','C:/evil.xml','xl/./sheet.xml','xl//sheet.xml','xl/evil\u0000.xml'])await reject(zipFixture([[path,'x'],[sheetName,sheet]]),'mt5_xlsx_invalid_path');
});
test('central directory count/bounds, split archives, ZIP64 and unsupported flags fail closed',async()=>{
 const count=zipFixture();count.writeUInt16LE(0,endOffset(count)+8);count.writeUInt16LE(0,endOffset(count)+10);await reject(count);
 const size=zipFixture();size.writeUInt32LE(1,endOffset(size)+12);await reject(size);
 const split=zipFixture();split.writeUInt16LE(1,endOffset(split)+4);await reject(split,'mt5_xlsx_unsupported');
 const zip64=zipFixture();zip64.writeUInt32LE(0xffffffff,endOffset(zip64)+16);await reject(zip64,'mt5_xlsx_unsupported');
 for(const flags of [1,0x40,0x2000,0x8000]){const b=zipFixture();b.writeUInt16LE(flags,centralOffset(b)+8);await reject(b,'mt5_xlsx_unsupported');}
 const version=zipFixture();version.writeUInt16LE(45,centralOffset(version)+6);await reject(version,'mt5_xlsx_unsupported');
});
test('entry data cannot cross into the directory or share another entry range',async()=>{
 const b=zipFixture();const size=centralOffset(b);b.writeUInt32LE(size,18);b.writeUInt32LE(size,centralOffset(b)+20);await reject(b);
 const overlap=zipFixture([[sheetName,sheet],['xl/worksheets/sheet2.xml',sheet]]),central=centralOffset(overlap);
 const second=central+46+Buffer.byteLength(sheetName);overlap.writeUInt32LE(0,second+42);await reject(overlap);
});
test('lying inflated sizes, archive entry counts and total bytes remain bounded',async()=>{
 const b=zipFixture(undefined,{deflate:true});b.writeUInt32LE(1,22);b.writeUInt32LE(1,centralOffset(b)+24);await reject(b,'mt5_xlsx_limit');
 await reject(zipFixture(Array.from({length:97},(_,i)=>['xl/worksheets/sheet'+i+'.xml',sheet])),'mt5_xlsx_limit');
 await reject(new Uint8Array(MT5_REPORT_LIMITS.fileBytes+1),'mt5_file_too_large');
});
test('prefixed/shared formula cells and entity definitions cannot supply cached realized profits',async()=>{
 for(const formula of ['<x:f>1+9</x:f>','<f/>','<f t="shared" si="0"/>'])await reject(zipFixture([[sheetName,sheet.replace('<v>10</v>',formula+'<v>10</v>')]]),'mt5_xlsx_unsupported');
 await reject(zipFixture([[sheetName,'<!DOCTYPE worksheet [<!ENTITY amount "10">]>'+sheet]]),'mt5_xlsx_unsupported');
});
