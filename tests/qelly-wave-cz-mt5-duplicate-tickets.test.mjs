import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMt5Html,parseMt5Xlsx} from '../apps/web/public/assets/qelly-mt5-report-parser.mjs';
import {analyzeMt5ClosedDeals} from '../apps/web/public/assets/qelly-mt5-advanced-metrics.mjs';
import {zipFixture,sheetName} from './fixtures/mt5-zip-builder.mjs';
const headers=['Time','Deal','Position','Symbol','Type','Direction','Profit'];
const row=(ticket,{profit=10,position='77',time='2026.10.01 10:00',direction='out'}={})=>[time,ticket,position,'EURUSD','buy',direction,profit];
const html=rows=>'<table>'+[headers,...rows].map(cells=>'<tr>'+cells.map(value=>'<td>'+value+'</td>').join('')+'</tr>').join('')+'</table>';
const rejected=error=>error.code==='mt5_duplicate_closing_deal'&&/no totals were calculated/.test(error.message);
test('duplicate closing tickets cannot inflate sample size or realized P&L',()=>{
 const source=html([row('123'),row('123')]);
 assert.throws(()=>parseMt5Html(source),rejected);
 assert.throws(()=>parseMt5Html(html([row('123'),row('123',{profit:-7,time:'2026.10.02 10:00'})])),rejected);
});
test('repeated Deals tables are rejected rather than aggregated as new executions',()=>{
 assert.throws(()=>parseMt5Html(html([row('123')])+html([row('123')])),rejected);
});
test('numeric ticket identity handles leading zeroes without lossy number conversion',()=>{
 assert.throws(()=>parseMt5Html(html([row('000123'),row('123')])),rejected);
 const parsed=parseMt5Html(html([row('9007199254740992'),row('9007199254740993')]));
 assert.equal(parsed.trades.length,2);assert.equal(analyzeMt5ClosedDeals(parsed.trades,parsed.validation).metrics.netPnl,20);
});
test('distinct executions on one position remain eligible partial closes',()=>{
 const parsed=parseMt5Html(html([row('123',{profit:10}),row('124',{profit:-3,direction:'out by'})]));
 assert.deepEqual(parsed.trades.map(value=>value.positionId),['77','77']);
 assert.equal(parsed.trades.length,2);assert.equal(analyzeMt5ClosedDeals(parsed.trades,parsed.validation).metrics.netPnl,7);
});
test('missing tickets preserve observed rows and disclose incomplete duplicate detection',()=>{
 const parsed=parseMt5Html(html([row(''),row('')]));
 assert.equal(parsed.validation.mt5.missingClosingDealIds,2);
 assert.equal(parsed.trades.length,2);
 assert.match(analyzeMt5ClosedDeals(parsed.trades,parsed.validation).warnings.join(' '),/duplicate detection is incomplete/);
});
test('both stored and compressed XLSX duplicate tickets fail before analysis',async()=>{
 const rows=[headers,row('123'),row('123',{profit:-5})];
 const xml='<worksheet><sheetData>'+rows.map(cells=>'<row>'+cells.map(value=>'<c t="inlineStr"><is><t>'+value+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>';
 for(const deflate of [false,true])await assert.rejects(parseMt5Xlsx(new Uint8Array(zipFixture([[sheetName,xml]],{deflate}))),rejected);
});
