import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {shouldReuseEcbDailyCache} from '../supabase/functions/qelly-provider-ingestion/cache-freshness.mjs';
const cached={ingestion_time:'2026-09-30T17:15:02.439Z',expires_at:'2026-10-02T05:15:01.955Z'};
test('daily reference cron never reuses yesterday’s unexpired 36-hour cache',()=>{
 assert.equal(shouldReuseEcbDailyCache(cached,new Date('2026-10-01T17:15:01.650Z')),false);
 assert.equal(shouldReuseEcbDailyCache(cached,new Date('2026-09-30T20:00:00Z')),true);
 assert.equal(shouldReuseEcbDailyCache(cached,new Date('2026-10-02T17:15:00Z')),false);
});
test('bad cache and invalid clock fail closed, UTC date controls freshness',()=>{
 assert.equal(shouldReuseEcbDailyCache(null,new Date()),false);
 assert.equal(shouldReuseEcbDailyCache({...cached,ingestion_time:'invalid'},new Date('2026-09-30T20:00:00Z')),false);
 assert.equal(shouldReuseEcbDailyCache(cached,new Date('2026-09-30T17:15:00Z')),false);
 assert.equal(shouldReuseEcbDailyCache(cached,new Date(NaN)),false);
 assert.equal(shouldReuseEcbDailyCache(cached,new Date('2026-10-02T05:15:02Z')),false);
});
test('edge function imports tested policy and preserves rights and stale-fallback paths',async()=>{
 const source=await readFile(new URL('../supabase/functions/qelly-provider-ingestion/index.ts',import.meta.url),'utf8');
 assert.match(source,/import \{shouldReuseEcbDailyCache\} from "\.\/cache-freshness\.mjs"/);
 assert.match(source,/if\(shouldReuseEcbDailyCache\(cached,now\)\)/);
 assert.match(source,/provider\.commercial_rights_status!==\"allowed\"/);
 assert.match(source,/provider\.redistribution_rights_status!==\"allowed\"/);
 assert.match(source,/staleUntil>now\.getTime\(\)/);
 assert.match(source,/UPSTREAM_PROVIDER_FAILURE/);
});
