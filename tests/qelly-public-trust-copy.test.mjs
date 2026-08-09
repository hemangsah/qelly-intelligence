import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('public legal pages identify Cloudflare as the canonical deployment',async()=>{
  const paths=['apps/web/public/support.html','apps/web/public/legal/privacy.html','apps/web/public/legal/terms.html','apps/web/public/legal/beta.html','apps/web/public/legal/risk.html'];
  for(const path of paths){
    const html=await read(path);
    assert.match(html,/rel="canonical" href="https:\/\/qelly-intelligence\.pages\.dev\//,path);
    assert.doesNotMatch(html,/hemangsah\.github\.io\/qelly-intelligence/,path);
  }
});

test('support and privacy copy do not overstate authenticated cloud readiness',async()=>{
  const support=await read('apps/web/public/support.html');
  const privacy=await read('apps/web/public/legal/privacy.html');
  assert.match(support,/protected account feedback is not yet production-proven/i);
  assert.match(support,/Registration and recovery remain fail-closed/i);
  assert.doesNotMatch(support,/protected cloud API active/i);
  assert.match(privacy,/authenticated production lifecycle remains fail-closed/i);
  assert.match(privacy,/Configuration does not by itself prove end-to-end availability/i);
  assert.doesNotMatch(privacy,/Public-beta cloud providers are active/i);
});
