import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('accessibility regression uses the Cloudflare evidence contract adapter',async()=>{
  const pkg=JSON.parse(await read('package.json'));
  const wrapper=await read('scripts/release-a5-accessibility-evidence.py');
  assert.equal(pkg.scripts.a11y,'python3 scripts/release-a5-accessibility-evidence.py');
  assert.match(wrapper,/release-a5-accessibility-check\.py/);
  assert.match(wrapper,/release-a5-evidence-server\.mjs/);
  assert.match(wrapper,/run_name='__main__'/);
});

test('accessibility evidence isolates the display-only TradingView script without hiding internal failures',async()=>{
  const wrapper=await read('scripts/release-a5-accessibility-evidence.py');
  assert.match(wrapper,/parsed\.netloc=='s3\.tradingview\.com'/);
  assert.match(wrapper,/Content-Type':'application\/javascript; charset=utf-8'/);
  assert.match(wrapper,/external TradingView display script intentionally isolated/);
  assert.doesNotMatch(wrapper,/console-errors.*ignore|errors\.clear|criticalFailures.*remove/i);
});
