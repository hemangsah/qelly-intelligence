import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('provider cache keeps an explicit browser deny policy and no browser grants',async()=>{
  const migration=await read('packages/migrations/20260805030100_qelly_provider_cache_explicit_deny.sql');
  assert.match(migration,/create policy qelly_provider_cache_browser_deny/i);
  assert.match(migration,/for all\s+to anon, authenticated\s+using \(false\)\s+with check \(false\)/i);
  assert.match(migration,/revoke all on table public\.qelly_provider_cache from anon, authenticated/i);
});
