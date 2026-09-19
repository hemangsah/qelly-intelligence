import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('public legal pages identify the terminal custom domain as canonical',async()=>{
  const paths=['apps/web/public/support.html','apps/web/public/legal/privacy.html','apps/web/public/legal/terms.html','apps/web/public/legal/beta.html','apps/web/public/legal/risk.html'];
  for(const path of paths){
    const html=await read(path);
    assert.match(html,/rel="canonical" href="https:\/\/terminal\.qellyintelligence\.com\//,path);
    assert.doesNotMatch(html,/hemangsah\.github\.io\/qelly-intelligence/,path);
  }
});

test('support and privacy copy stay readiness-gated without stale outage claims',async()=>{
  const support=await read('apps/web/public/support.html');
  const privacy=await read('apps/web/public/legal/privacy.html');
  assert.match(support,/protected account capabilities are readiness-gated/i);
  assert.match(support,/fail closed if required evidence degrades/i);
  assert.doesNotMatch(support,/protected account feedback is not yet production-proven/i);
  assert.match(privacy,/authenticated production lifecycle remains fail-closed until delivery and isolation canaries pass/i);
  assert.match(privacy,/Configuration does not by itself prove end-to-end availability/i);
  assert.match(privacy,/governed by live readiness checks and fail closed/i);
  assert.doesNotMatch(privacy,/authenticated cloud lifecycle not production-proven/i);
});
