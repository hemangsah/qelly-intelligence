import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration=await readFile(new URL('../supabase/migrations/20260816110500_qelly_ui_preferences_authenticated_grants_v1.sql',import.meta.url),'utf8');
const dedicatedRoute=await readFile(new URL('../functions/api/v1/preferences/layout.js',import.meta.url),'utf8');
const genericRoute=await readFile(new URL('../functions/api/v1/[[path]].js',import.meta.url),'utf8');

test('UI preference persistence is available only through authenticated table privileges plus RLS',()=>{
  assert.match(migration,/revoke all on table public\.qelly_ui_preferences from anon/i);
  assert.match(migration,/grant select, insert, update, delete\s+on table public\.qelly_ui_preferences\s+to authenticated/i);
  assert.doesNotMatch(migration,/grant\s+.*\s+to\s+anon/i);
  assert.doesNotMatch(migration,/disable row level security|row_security\s*=\s*off/i);
});

test('dedicated preferences route is the only persistence owner and uses cloud RLS storage',()=>{
  assert.match(dedicatedRoute,/qelly_ui_preferences\?on_conflict=owner_id,workspace_id/);
  assert.match(dedicatedRoute,/storage:'cloud-rls'/);
  assert.match(dedicatedRoute,/persisted:true/);
  assert.doesNotMatch(dedicatedRoute,/storage:'browser-local'|persisted:false/);
});

test('generic API catch-all fails closed instead of returning browser-local preference defaults',()=>{
  assert.match(genericRoute,/preferences_route_owner_mismatch/);
  assert.match(genericRoute,/dedicated \/api\/v1\/preferences\/layout function/);
  assert.doesNotMatch(genericRoute,/preferences\/layout'&&method==='GET'\)return responseJson/);
  assert.doesNotMatch(genericRoute,/storage:'browser-local'|persisted:false/);
});
