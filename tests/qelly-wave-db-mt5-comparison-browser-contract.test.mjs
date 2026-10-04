import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('MT5 A/B browser acceptance exercises local mixed-format reports and explicit clear',async()=>{
 const s=await readFile(new URL('../scripts/qelly-mt5-upload-e2e.mjs',import.meta.url),'utf8');
 for(const marker of ['compare-a.html','compare-b.xlsx','data-mt5-compare-file="A"','data-mt5-compare-file="B"','data-mt5-comparison-result','LIMITED SAMPLE','WITHHELD_UNVERIFIED_CURRENCY','comparisonData.privacy.sourceRowsIncluded','data-mt5-compare-reset','comparison.png'])assert.ok(s.includes(marker),marker);
 assert.match(s,/assert\.deepEqual\(uploads,\[\]\)/);
 assert.match(s,/assert\.deepEqual\(errors,\[\]\)/);
});
