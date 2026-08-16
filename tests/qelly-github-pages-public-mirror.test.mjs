import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Pages workflow deploys the release-line production mirror instead of static preview handoff',async()=>{
  const workflow=await read('.github/workflows/pages-preview.yml');
  assert.match(workflow,/branches: \[release\/qelly-global-public-beta\]/);
  assert.match(workflow,/QELLY_GITHUB_PAGES_MIRROR: 'true'/);
  assert.match(workflow,/QELLY_STATIC_VISUAL_PREVIEW: 'false'/);
  assert.match(workflow,/QELLY_PUBLIC_API_BASE_URL: https:\/\/qelly-intelligence\.pages\.dev/);
  assert.match(workflow,/path: dist\/frontend/);
  assert.match(workflow,/Verify canonical API permits read-only mirror CORS/);
  assert.doesNotMatch(workflow,/build-pages-canonical-handoff|dist\/pages-canonical|sanitize-pages-artifact/);
});

test('frontend builder has an explicit no-auth GitHub public mirror mode',async()=>{
  const source=await read('scripts/build-frontend.mjs');
  assert.match(source,/githubPagesMirror=process\.env\.QELLY_GITHUB_PAGES_MIRROR==='true'/);
  assert.match(source,/mirrorMode:githubPagesMirror\?'github-pages-public':null/);
  assert.match(source,/authentication:!staticVisualPreview&&!githubPagesMirror/);
  assert.match(source,/cloudSync:!staticVisualPreview&&!githubPagesMirror/);
  assert.match(source,/protectedWrites:!staticVisualPreview&&!githubPagesMirror/);
  assert.match(source,/artifact:staticVisualPreview\?'static-frontend':githubPagesMirror\?'github-pages-public-mirror'/);
});

test('mirror bootstrap keeps public routes local and hands private identity/workspace routes to Cloudflare',async()=>{
  const source=await read('apps/web/public/assets/qelly-github-pages-mirror.mjs');
  assert.match(source,/mirrorMode==='github-pages-public'/);
  assert.match(source,/LOCAL_PUBLIC_ROUTES/);
  assert.match(source,/CANONICAL_ONLY_ROUTES/);
  assert.match(source,/'auth-login'/);
  assert.match(source,/'account-session'/);
  assert.match(source,/'live-markets'/);
  assert.match(source,/location\.replace\(target\)/);
  assert.doesNotMatch(source,/document\.cookie|localStorage.*token|SameSite=None|supabase.*key/i);
});

test('Cloudflare API middleware grants GitHub only safe read CORS, never mutation trust',async()=>{
  const source=await read('functions/api/v1/_middleware.js');
  assert.match(source,/GITHUB_PUBLIC_MIRROR_ORIGIN='https:\/\/hemangsah\.github\.io'/);
  assert.match(source,/mirrorSafeMethod=.*GET.*HEAD.*OPTIONS/);
  assert.match(source,/github_mirror_read_only/);
  assert.match(source,/'Access-Control-Allow-Methods':'GET,HEAD,OPTIONS'/);
  assert.match(source,/'Cross-Origin-Resource-Policy':'cross-origin'/);
  assert.match(source,/requireOrigin\(request,env\)/);
  assert.doesNotMatch(source,/Access-Control-Allow-Methods':'GET,HEAD,POST/);
});

test('mirror finalizer preserves GitHub runtime base but canonicalizes SEO to Cloudflare',async()=>{
  const source=await read('scripts/finalize-github-pages-mirror.mjs');
  assert.match(source,/MIRROR_URL='https:\/\/hemangsah\.github\.io\/qelly-intelligence'/);
  assert.match(source,/CANONICAL_URL='https:\/\/qelly-intelligence\.pages\.dev'/);
  assert.match(source,/noindex,follow,noarchive/);
  assert.match(source,/qelly-github-pages-mirror\.mjs/);
  assert.match(source,/await rm\(path\.join\(directory,'_routes\.json'\),\{force:true\}\)/);
});
