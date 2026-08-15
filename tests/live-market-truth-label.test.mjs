import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../apps/web/public/assets/routes/live-markets.mjs', import.meta.url), 'utf8');

test('market watch cards are explicitly governed demonstration navigation', () => {
  assert.match(source, /Demonstration watch universe/);
  assert.match(source, /Navigation helpers only; values come from the selected governed feed after selection/);
  assert.match(source, />Load<\/strong>/);
  assert.match(source, />governed demo<\/small>/);
  assert.match(source, /Qelly never labels blocked or simulated observations as live/);
});

test('market tape does not present hard-coded prices or moves as live', () => {
  assert.doesNotMatch(source, /Live watch universe/);
  assert.doesNotMatch(source, /₹65\.1L|₹3\.42L|₹63,100|₹17,450|₹268|₹92/);
  assert.doesNotMatch(source, /\+0\.58%|−0\.42%/);
});
