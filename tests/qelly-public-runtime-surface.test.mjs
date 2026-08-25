import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../apps/edge/qelly-public-api-worker.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('fallback configuration preserves deterministic tools without exposing production runtime claims',async()=>{
  const config=await read('apps/web/public/qelly-config.js');
  assert.match(config,/productMode:'QELLY'/);
  assert.match(config,/deterministicLocal:true/);
  assert.match(config,/authentication:false/);
  assert.match(config,/cloudSync:false/);
  assert.match(config,/liveProviders:false/);
  assert.doesNotMatch(config,/QELLY GLOBAL PUBLIC BETA/);
  assert.doesNotMatch(config,/hemangsah\.github\.io/);
  assert.doesNotMatch(config,/linkedin/i);
});

test('offline shell excludes API and private account state',async()=>{
  const serviceWorker=await read('apps/web/public/qelly-service-worker.js');
  assert.match(serviceWorker,/\/api\//);
  assert.match(serviceWorker,/auth\|account\|saved-calculations/);
  const shellDeclaration=serviceWorker.match(/const SHELL=(\[[^;]+\]);/)?.[1]||'';
  assert.ok(shellDeclaration,'offline shell declaration is present');
  assert.doesNotMatch(shellDeclaration,/\/api\//);
  assert.doesNotMatch(shellDeclaration,/auth|account|saved-calculations|secure-import|quarantine|delivery-operations/i);
});

test('public policy pages disclose beta, privacy and financial risk boundaries',async()=>{
  const pages=await Promise.all(['beta','risk','privacy','terms'].map((name)=>read(`apps/web/public/legal/${name}.html`)));
  assert.match(pages[0],/PUBLIC BETA/i);
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
