import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publicRoot=path.join(root,'apps/web/public');

async function browserSources(directory){
  const output=[];
  for(const entry of await readdir(directory)){
    const full=path.join(directory,entry);
    const info=await stat(full);
    if(info.isDirectory())output.push(...await browserSources(full));
    else if(/\.(?:mjs|js|html)$/i.test(entry))output.push(full);
  }
  return output;
}

function normalizeApiPath(raw){
  let value=String(raw||'').trim();
  if(!value.startsWith('/api/v1/'))return null;
  value=value.replace(/\$\{[^}]+\}/g,':param');
  value=value.split('?')[0].split('#')[0];
  value=value.replace(/\/+$/,'');
  return value||'/api/v1';
}

function extractApiCalls(source){
  const calls=[];
  const quoted=/(?:\bapi|\bfetch)\s*\(\s*(['"])(\/api\/v1\/[^'"\n]*)\1/g;
  const templated=/(?:\bapi|\bfetch)\s*\(\s*`(\/api\/v1\/[^`]*)`/g;
  for(const match of source.matchAll(quoted))calls.push(match[2]);
  for(const match of source.matchAll(templated))calls.push(match[1]);
  return calls.map(normalizeApiPath).filter(Boolean);
}

const EXACT=new Set([
  '/api/v1/config',
  '/api/v1/health',
  '/api/v1/readiness',
  '/api/v1/platform/readiness',
  '/api/v1/auth/email-capability',
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/callback',
  '/api/v1/auth/session',
  '/api/v1/auth/status',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/api/v1/auth/recovery/request',
  '/api/v1/auth/recovery/status',
  '/api/v1/auth/recovery/reset',
  '/api/v1/cloud/opt-in',
  '/api/v1/cloud/status',
  '/api/v1/account/delete',
  '/api/v1/account/export',
  '/api/v1/providers/status',
  '/api/v1/market/overview',
  '/api/v1/public/markets/overview',
  '/api/v1/public/markets/assets',
  '/api/v1/session/context',
  '/api/v1/preferences/layout',
  '/api/v1/sessions',
  '/api/v1/sync/push',
  '/api/v1/sync/pull',
  '/api/v1/saved-calculations',
  '/api/v1/feedback',
  '/api/v1/live-markets/catalog',
  '/api/v1/live-markets/status',
  '/api/v1/live-markets/candles',
  '/api/v1/live-markets/ticker'
]);

function cloudflareOwns(apiPath){
  if(EXACT.has(apiPath))return true;
  if(/^\/api\/v1\/providers\/(?:binance|coinbase|ecb)$/.test(apiPath))return true;
  if(/^\/api\/v1\/public\/markets\/assets\/:param(?:\/candles)?$/.test(apiPath))return true;
  if(/^\/api\/v1\/saved-calculations\/:param(?:\/(?:restore|revisions|revisions\/restore))?$/.test(apiPath))return true;
  return false;
}

test('every literal browser API dependency is owned by the canonical Cloudflare runtime',async()=>{
  const files=await browserSources(publicRoot);
  const dependencies=new Map();
  for(const file of files){
    const source=await readFile(file,'utf8');
    for(const apiPath of extractApiCalls(source)){
      if(!dependencies.has(apiPath))dependencies.set(apiPath,new Set());
      dependencies.get(apiPath).add(path.relative(root,file));
    }
  }
  const unsupported=[...dependencies.entries()]
    .filter(([apiPath])=>!cloudflareOwns(apiPath))
    .map(([apiPath,filesForPath])=>({apiPath,files:[...filesForPath].sort()}))
    .sort((left,right)=>left.apiPath.localeCompare(right.apiPath));
  assert.deepEqual(unsupported,[],`Browser API paths without canonical Cloudflare ownership:\n${unsupported.map(item=>`- ${item.apiPath} <- ${item.files.join(', ')}`).join('\n')}`);
});

test('coverage predicate is conservative and does not treat arbitrary catch-all paths as implemented',()=>{
  assert.equal(cloudflareOwns('/api/v1/config'),true);
  assert.equal(cloudflareOwns('/api/v1/live-markets/candles'),true);
  assert.equal(cloudflareOwns('/api/v1/saved-calculations/:param/revisions'),true);
  assert.equal(cloudflareOwns('/api/v1/research/workspaces'),false);
  assert.equal(cloudflareOwns('/api/v1/calculators/catalog'),false);
  assert.equal(cloudflareOwns('/api/v1/admin/anything'),false);
});

export const __cloudflareBrowserParityTest=Object.freeze({normalizeApiPath,extractApiCalls,cloudflareOwns});
