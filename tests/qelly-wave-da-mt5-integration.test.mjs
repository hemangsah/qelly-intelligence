import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseMt5Html} from '../apps/web/public/assets/qelly-mt5-report-parser.mjs';
import {analyzeMt5ClosedDeals} from '../apps/web/public/assets/qelly-mt5-advanced-metrics.mjs';
import {renderMt5ClosedDealEvidence} from '../apps/web/public/assets/qelly-mt5-visuals.mjs';
import {analyzeTrades} from '../apps/web/public/assets/qelly-verify-engine.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const row=(i,p)=>'<tr><td>2026.10.'+String(i).padStart(2,'0')+' 11:30</td><td>'+i+'</td><td>EURUSD</td><td>buy</td><td>out</td><td>-0.1</td><td>0</td><td>0</td><td>'+p+'</td></tr>';
const doc=n=>'<table><tr><th>Time</th><th>Deal</th><th>Symbol</th><th>Type</th><th>Direction</th><th>Commission</th><th>Fee</th><th>Swap</th><th>Profit</th></tr>'+Array.from({length:n},(_,i)=>row(i+1,i%3===0?-2:4)).join('')+'</table>';
test('real MT5 HTML flows through parsed closing deals, advanced metrics and the accessible renderer',()=>{
 const parsed=parseMt5Html(doc(15)),detail=analyzeMt5ClosedDeals(parsed.trades,parsed.validation),general=analyzeTrades(parsed.trades);
 assert.equal(detail.sample.deals,15);
 assert.equal(detail.metrics.netPnl,general.performance.netProfit);
 assert.equal(parsed.trades[0].commission,-0.1);
 assert.equal(parsed.trades[0].fees,-0.1);
 assert.equal(detail.costs.commission.coveragePct,100);
 const html=renderMt5ClosedDealEvidence(detail);
 assert.match(html,/MT5 Report Analyzer/);assert.match(html,/account currency unverified/);assert.match(html,/not account equity/i);
});
test('small MT5 reports yield descriptive evidence without invoking general heuristic scoring',()=>{
 const parsed=parseMt5Html(doc(2));
 const result=analyzeMt5ClosedDeals(parsed.trades,parsed.validation);
 assert.equal(result.sample.grade,'LIMITED SAMPLE');
 assert.match(renderMt5ClosedDealEvidence(result),/Statistical resampling withheld/);
 assert.throws(()=>analyzeTrades(parsed.trades),/At least five/);
});
test('MT5 integration is conditional; CSV remains unchanged and no upload/network path is added',async()=>{
 const product=await read('apps/web/public/assets/qelly-verify-product.mjs');
 const processor=await read('apps/web/public/assets/qelly-verify-local-analysis.mjs');
 for(const marker of ["parsed.validation.mt5?analyzeMt5ClosedDeals","parsed.trades.length>=5&&parsed.trades.length<=5000"])assert.ok(processor.includes(marker),marker);
 for(const marker of ["createLocalVerifyTask","renderMt5ClosedDealEvidence(mt5Report)","mt5ClosedDealAnalysis:current.mt5Report","new URL('./qelly-mt5-visuals.css'"])assert.ok(product.includes(marker),marker);
 assert.match(processor,/parseTradeCsv\(sourceText\)/);
 assert.doesNotMatch(processor,/fetch\(/);
 assert.doesNotMatch(product,/fetch\(/);
 assert.match(product,/data-qelly-mt5-evidence/);
});
