import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration=await readFile(new URL('../supabase/migrations/20260816110500_qelly_ui_preferences_authenticated_grants_v1.sql',import.meta.url),'utf8');

test('UI preference persistence is available only through authenticated table privileges plus RLS',()=>{
  assert.match(migration,/revoke all on table public\.qelly_ui_preferences from anon/i);
  assert.match(migration,/grant select, insert, update, delete\s+on table public\.qelly_ui_preferences\s+to authenticated/i);
  assert.doesNotMatch(migration,/grant\s+.*\s+to\s+anon/i);
  assert.doesNotMatch(migration,/disable row level security|row_security\s*=\s*off/i);
});
