import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sourcePath=new URL('../scripts/release-a5-screen-package.py',import.meta.url);

test('all-screen package states its authentication evidence boundary without stale blockers',async()=>{
  const source=await readFile(sourcePath,'utf8');
  assert.match(source,/disposable local test identity and contain no production user data/);
  assert.match(source,/does not itself prove transactional-email delivery, production authentication readiness, tenant isolation or provider availability/);
  assert.match(source,/dedicated runtime and canary evidence/);
  assert.doesNotMatch(source,/production Auth remains deliberately fail-closed/);
  assert.doesNotMatch(source,/SMTP delivery and two-user RLS canaries pass/);
});
