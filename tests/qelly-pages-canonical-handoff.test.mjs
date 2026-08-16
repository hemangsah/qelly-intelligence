import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const workflow=await readFile(new URL('../.github/workflows/pages-preview.yml',import.meta.url),'utf8');
const mirror=await readFile(new URL('../apps/web/public/assets/qelly-github-pages-mirror.mjs',import.meta.url),'utf8');
const finalizer=await readFile(new URL('../scripts/finalize-github-pages-mirror.mjs',import.meta.url),'utf8');

test('GitHub Pages follows the canonical release line and deploys a public read-only terminal mirror',()=>{
  assert.match(workflow,/branches:\s*\[release\/qelly-global-public-beta\]/);
  assert.match(workflow,/QELLY_GITHUB_PAGES_MIRROR:\s*'true'/);
  assert.match(workflow,/QELLY_STATIC_VISUAL_PREVIEW:\s*'false'/);
  assert.match(workflow,/QELLY_ENABLE_AUTH:\s*'false'/);
  assert.match(workflow,/QELLY_ENABLE_CLOUD_SYNC:\s*'false'/);
  assert.match(workflow,/QELLY_ENABLE_FEEDBACK_WRITES:\s*'false'/);
  assert.match(workflow,/path:\s*dist\/frontend/);
  assert.doesNotMatch(workflow,/dist\/pages-canonical|build-pages-canonical-handoff/);
});

test('public mirror keeps Cloudflare as canonical authority for private routes and SEO',()=>{
  assert.match(mirror,/canonicalSiteUrl/);
  assert.match(mirror,/github-pages-public/);
  assert.match(mirror,/LOCAL_PUBLIC_ROUTES/);
  assert.match(mirror,/CANONICAL_ONLY_ROUTES/);
  assert.match(mirror,/auth-login/);
  assert.match(mirror,/account-session/);
  assert.match(mirror,/location\.replace\(target\)/);
  assert.match(finalizer,/CANONICAL_URL='https:\/\/qelly-intelligence\.pages\.dev'/);
  assert.match(finalizer,/noindex,follow,noarchive/);
  assert.match(finalizer,/qelly-github-pages-mirror\.mjs/);
});
