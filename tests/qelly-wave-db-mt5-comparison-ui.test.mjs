import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeMt5ClosedDeals} from '../apps/web/public/assets/qelly-mt5-advanced-metrics.mjs';
import {compareMt5ClosedDealReports} from '../apps/web/public/assets/qelly-mt5-comparison.mjs';
import {renderMt5Comparison} from '../apps/web/public/assets/qelly-mt5-comparison-ui.mjs';
const sample=n=>analyzeMt5ClosedDeals(Array.from({length:n},(_,i)=>({pnl:i%3?-2:5,side:'buy',symbol:'EURUSD'})),{mt5:{format:'mt5-html'}});
test('comparison renderer exposes a source-safe side-by-side view with no invented P&L winner',()=>{
 const report=compareMt5ClosedDealReports(sample(40),sample(45));
 const html=renderMt5Comparison(report,{nameA:'<script>alert(1)</script>.html',nameB:'alpha.xlsx'});
 assert.match(html,/Report A versus Report B/);
 assert.match(html,/Withheld \(currency unverified\)/);
 assert.match(html,/OBSERVED SAMPLES|LIMITED SAMPLE/);
 assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
 assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.match(html,/role="note"/);
 assert.match(html,/No currency-converted P&amp;L difference/);
 assert.doesNotMatch(html,/best strategy|outperforms|guaranteed/i);
});
test('invalid comparison objects and small samples fail without fake deltas',()=>{
 assert.throws(()=>renderMt5Comparison({schema:'wrong'}),/Validated local/);
 const report=compareMt5ClosedDealReports(sample(2),sample(4));
 const html=renderMt5Comparison(report);
 assert.match(html,/LIMITED SAMPLE/);
 assert.match(html,/Withheld/);
});
