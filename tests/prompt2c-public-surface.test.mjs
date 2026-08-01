import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../apps/edge/prompt2c-worker.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('public-beta configuration preserves deterministic fallback and disables unverified cloud claims',async()=>{
  const config=await read('apps/web/public/qelly-config.js');
  assert.match(config,/QELLY GLOBAL PUBLIC BETA/);
  assert.match(config,/deterministicLocal:true/);
  assert.match(config,/authentication:false/);
  assert.match(config,/cloudSync:false/);
  assert.match(config,/liveProviders:false/);
});

test('offline shell excludes API and private account state',async()=>{
  const serviceWorker=await read('apps/web/public/prompt2c-sw.js');
  assert.match(serviceWorker,/\/api\//);
  assert.match(serviceWorker,/auth\|account\|saved-calculations/);
  assert.doesNotMatch(serviceWorker,/SHELL=.*\/api\//s);
});

test('public policy pages disclose beta, privacy and financial risk boundaries',async()=>{
  const pages=await Promise.all(['beta','risk','privacy','terms'].map((name)=>read(`apps/web/public/legal/${name}.html`)));
  assert.equal(pages.every((page)=>page.includes('QELLY GLOBAL PUBLIC BETA')),true);
  assert.match(pages[1],/does not provide personalized investment/);
  assert.match(pages[2],/Cloud synchronization is off/);
  assert.match(pages[3],/No advice, warranty or guaranteed availability/);
});

test('robots and sitemap keep private paths out of discovery',async()=>{
  const robots=await read('apps/web/public/robots.txt');
  const sitemap=await read('apps/web/public/sitemap.xml');
  assert.match(robots,/Disallow: \/api\//);
  assert.match(robots,/Disallow: \/account\//);
  assert.doesNotMatch(sitemap,/account|saved-calculations|auth/);
});

test('edge health endpoint is truthful without external authorization',async()=>{
  const response=await worker.fetch(new Request('https://example.test/api/health'),{});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.deterministicLocal,true);
  assert.equal(body.authentication,false);
  assert.equal(body.cloudSync,false);
  assert.equal(body.trading,false);
});

test('protected feedback fails closed when Turnstile is not authorized',async()=>{
  const request=new Request('https://example.test/api/v1/feedback',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://qelly.example'},body:JSON.stringify({category:'bug',message:'A sufficiently detailed public beta defect report.'})});
  const response=await worker.fetch(request,{QELLY_ALLOWED_ORIGINS:'https://qelly.example'});
  assert.equal(response.status,503);
  assert.equal((await response.json()).error,'external_authorization_required');
});
