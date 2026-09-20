import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('mobile record stacks contain and wrap long governed state labels',async()=>{
  const css=await readFile(new URL('../apps/web/public/assets/app.css',import.meta.url),'utf8');
  const mobile=css.match(/@media\(max-width:560px\)\{\.q-runtime-result[\s\S]*?\}\}/)?.[0]??'';
  assert.match(mobile,/\.q-record-stack\{grid-template-columns:minmax\(0,1fr\);min-width:0\}/);
  assert.match(mobile,/\.q-choice-row,\.q-record-row\{[^}]*min-width:0;max-width:100%/);
  assert.match(mobile,/\.q-record-row>\.q-status\{max-width:100%;white-space:normal;overflow-wrap:anywhere\}/);
});

test('every India finance option has a valid default and selection clears stale evidence',async()=>{
  const route=await readFile(new URL('../apps/web/public/assets/routes/india-finance-center.mjs',import.meta.url),'utf8');
  assert.match(route,/'fresh-india-tax-gross-up':\{netAmount:900,taxRate:0\.1\}/);
  assert.match(route,/const clearResult=\(\)=>\{result=null;[^}]*#india-primary[^}]*#india-summary[^}]*#india-results[^}]*No result yet[^}]*#india-evidence[^}]*No evidence yet\./);
  assert.match(route,/const reset=\(\)=>\{[\s\S]*?clearResult\(\);\}/);
  assert.match(route,/const run=\(\)=>\{clearResult\(\);let input/);
});


test('India market quotes use the official TradingView symbolsGroups schema and required benchmark universe',async()=>{
  const route=await readFile(new URL('../apps/web/public/assets/routes/india-finance-center.mjs',import.meta.url),'utf8');
  assert.match(route,/kind:'marketQuotes'/);
  assert.match(route,/symbolsGroups:\[\{name:'India'/);
  assert.doesNotMatch(route,/\bsymbolGroups:\[/);
  for(const symbol of ['NSE:NIFTY','BSE:SENSEX','NSE:BANKNIFTY','FX_IDC:USDINR'])assert.match(route,new RegExp(symbol.replace(/[:]/g,'\\:')));
  for(const label of ['Nifty 50','Sensex','Bank Nifty','USD / INR'])assert.match(route,new RegExp(label.replace(/\//g,'\\/')));
  assert.match(route,/<strong>Coverage:<\/strong> Nifty 50 · Sensex · Bank Nifty · USD\/INR · Gold/);
});


test('India market context is lazy and reserved below the finance tools',async()=>{
  const [route,css]=await Promise.all([
    readFile(new URL('../apps/web/public/assets/routes/india-finance-center.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/routes/india-finance-center.css',import.meta.url),'utf8')
  ]);
  assert.match(route,/mountLazyTradingViewWidget/);
  assert.equal((route.match(/mountLazyTradingViewWidget\(/g)||[]).length,3);
  assert.doesNotMatch(route,/mountTradingViewWidget\(/);
  assert.match(route,/rootMargin:'260px 0px'/);
  assert.match(css,/\.q-india-widget\{min-height:420px/);
  assert.match(css,/\.q-india-widget--screener\{min-height:520px\}/);
  assert.match(css,/\.q-india-widget--stories\{min-height:500px\}/);
});
