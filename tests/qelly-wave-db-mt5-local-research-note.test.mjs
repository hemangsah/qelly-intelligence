import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {analyzeMt5ClosedDeals} from '../apps/web/public/assets/qelly-mt5-advanced-metrics.mjs';
import {buildMt5ShareSafePackage} from '../apps/web/public/assets/qelly-mt5-share-safe.mjs';
import {buildMt5LocalResearchNote} from '../apps/web/public/assets/qelly-mt5-research-note.mjs';

const valid={mt5:{format:'mt5-html',closingDealsWithMissingCosts:0}};
const report=(n,shift=0)=>analyzeMt5ClosedDeals(Array.from({length:n},(_,i)=>({
 pnl:(i+shift)%3===0?-9:3,symbol:i%2?'EURUSD':'GBPUSD',side:i%2?'buy':'sell',
 closedAt:'2026.09.'+String(1+i%28).padStart(2,'0')+' 09:30',
 commission:-.2,fee:0,swap:0
})),valid);

test('single-report Markdown uses only allowlisted realized evidence, linked diagnostics and explicit currency/equity limits',()=>{
 const a=report(36);
 const note=buildMt5LocalResearchNote(a);
 assert.match(note,/^# QELLY MT5 Research Note/m);
 assert.match(note,/## Report A/);
 assert.doesNotMatch(note,/## Report B/);
 assert.match(note,/36 realized closing deals/);
 assert.match(note,/Observed metric/);
 assert.match(note,/Net closed-deal P&L/);
 assert.match(note,/Maximum closed-deal sequence drawdown/);
 assert.match(note,/not.*verified broker account-equity drawdown/i);
 assert.match(note,/### Evidence-linked observations/);
 assert.match(note,/Gross profit/);
 assert.match(note,/entry-side charges have not been reconciled/);
 assert.match(note,/Original reports are not uploaded/);
 assert.match(note,/separate local file/);
 assert.doesNotMatch(note,/future performance is certain|expected annual return/i);
 assert.ok(note.length<20000);
});
test('dual-report Markdown includes two observed samples while withholding unverified monetary differences',()=>{
 const a=report(35),b=report(36,1);
 const pack=buildMt5ShareSafePackage(a,b),note=buildMt5LocalResearchNote(a,b);
 assert.equal(pack.schema,'qelly.mt5.share-safe-local/1.1');
 assert.equal(pack.reportB.sample.deals,36);
 assert.equal(pack.reportB.metrics.netPnl,b.metrics.netPnl);
 assert.equal(pack.privacy.sourceRowsIncluded,false);
 assert.match(note,/## Report A/);
 assert.match(note,/## Report B/);
 assert.match(note,/## Descriptive report comparison/);
 assert.match(note,/All monetary differences and strategy rankings are withheld/);
 assert.match(note,/Win rate/);
 assert.match(note,/No causal attribution or matched-position equivalence is implied/);
 assert.ok(note.indexOf('## Report A')<note.indexOf('## Report B'));
 assert.ok(note.indexOf('## Report B')<note.indexOf('## Descriptive report comparison'));
});
test('short sample is explicitly governed, with no unsupported numeric comparison deltas',()=>{
 const a=report(6),b=report(7,1),note=buildMt5LocalResearchNote(a,b);
 assert.match(note,/6 realized closing deals · LIMITED SAMPLE/);
 assert.match(note,/7 realized closing deals · LIMITED SAMPLE/);
 assert.match(note,/Insufficient sample/);
 assert.match(note,/fewer than 30 closing deals/);
 assert.match(note,/No causal attribution/);
});
test('metadata, rows, arbitrary metrics and hostile group keys cannot contaminate exported Markdown or second report JSON',()=>{
 const a=report(35),b=report(36,1);
 a.account={login:'PRIVATE_ACCOUNT',password:'PRIVATE_PASSWORD'};
 b.account={login:'PRIVATE_B_ACCOUNT'};
 a.sourceFileName='USER_REPORT_ACCOUNT_ABC.html';
 b.sourceFileName='USER_REPORT_B_ABC.xlsx';
 a.rawRows=[{ticket:'PRIVATE_TICKET'}];
 b.rawRows=[{ticket:'PRIVATE_TICKET_B'}];
 a.metrics.private='PRIVATE_METRIC_A';
 b.metrics.private='PRIVATE_METRIC_B';
 a.groups.symbol=[{key:'# PRIVATE_GROUP_INJECTION',count:16,net:-900,winRatePct:0}];
 b.groups.symbol=[{key:'<script>PRIVATE_XSS</script>',count:18,net:-900,winRatePct:0}];
 const note=buildMt5LocalResearchNote(a,b);
 const json=JSON.stringify(buildMt5ShareSafePackage(a,b));
 for(const secret of ['PRIVATE_ACCOUNT','PRIVATE_PASSWORD','PRIVATE_B_ACCOUNT','USER_REPORT_ACCOUNT_ABC',
  'USER_REPORT_B_ABC','PRIVATE_TICKET','PRIVATE_TICKET_B','PRIVATE_METRIC_A','PRIVATE_METRIC_B',
  'PRIVATE_GROUP_INJECTION','PRIVATE_XSS']){
  assert.ok(!note.includes(secret),'note leaked '+secret);
  assert.ok(!json.includes(secret),'JSON leaked '+secret);
 }
 assert.match(note,/reported bucket label withheld/);
 assert.match(json,/withheld label/);
 assert.doesNotMatch(note,/<script>|# PRIVATE_GROUP_INJECTION/);
});
test('rejects missing, forged or inconsistent normalized report evidence',()=>{
 assert.throws(()=>buildMt5LocalResearchNote({}),/Validated normalized/);
 assert.throws(()=>buildMt5LocalResearchNote(report(36),{}),/Validated normalized|Two locally validated/);
});
test('standalone tool exposes explicit, browser-only Markdown download without auto-Chat submission',async()=>{
 const [route,browser]=await Promise.all([
  readFile(new URL('../apps/web/public/assets/qelly-mt5-analyzer-route.mjs',import.meta.url),'utf8'),
  readFile(new URL('../scripts/qelly-mt5-upload-e2e.mjs',import.meta.url),'utf8')
 ]);
 assert.match(route,/data-mt5-route-note/);
 assert.match(route,/buildMt5LocalResearchNote\(reports\.A\.report,reports\.B\?\.report\?\?null\)/);
 assert.match(route,/downloadMarkdown\('qelly-mt5-research-note\.md'/);
 assert.match(route,/text\/markdown;charset=utf-8/);
 assert.match(route,/Review downloaded notes before sharing/);
 assert.doesNotMatch(route,/fetch\(['"]\/api\/v1\/profile\/avatar/);
 assert.match(browser,/qelly-mt5-research-note\.md/);
 assert.match(browser,/data-mt5-route-note/);
});
