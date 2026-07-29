import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../apps/web/public/assets/routes/live-markets.mjs', import.meta.url), 'utf8');

test('static live-market watch cards are explicitly illustrative', () => {
  assert.match(source, /Illustrative watch universe/);
  assert.match(source, /Static demo values for symbol selection; not provider observations/);
  assert.match(source, />Demo<\/strong>/);
  assert.match(source, />illustrative<\/small>/);
});

test('static market tape does not present hard-coded prices or moves as live', () => {
  assert.doesNotMatch(source, /Live watch universe/);
  assert.doesNotMatch(source, /₹65\.1L|₹3\.42L|₹63,100|₹17,450|₹268|₹92/);
  assert.doesNotMatch(source, /\+0\.58%|−0\.42%/);
});
