import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const workflow=await readFile(new URL('../.github/workflows/pages-preview.yml',import.meta.url),'utf8');
const builder=await readFile(new URL('../scripts/build-pages-canonical-handoff.mjs',import.meta.url),'utf8');

test('GitHub Pages uses its environment-approved main control branch and remains a canonical handoff, not a second runtime',()=>{
  assert.match(workflow,/branches:\s*\[main\]/);
  assert.match(workflow,/QELLY_STATIC_VISUAL_PREVIEW:\s*'true'/);
  assert.match(workflow,/npm run validate:pages-preview/);
  assert.match(workflow,/node scripts\/build-pages-canonical-handoff\.mjs/);
  assert.match(workflow,/path:\s*dist\/pages-canonical/);
  assert.doesNotMatch(workflow,/path:\s*dist\/frontend\s*$/m);
});

test('canonical handoff preserves query and hash routes while pointing only to Cloudflare production',()=>{
  assert.match(builder,/https:\/\/qelly-intelligence\.pages\.dev\//);
  assert.match(builder,/window\.location\.search\+window\.location\.hash/);
  assert.match(builder,/window\.location\.replace\(canonical\+suffix\)/);
  assert.match(builder,/404\.html/);
  assert.match(builder,/GitHub Pages is a repository handoff, not a second terminal runtime/);
});
