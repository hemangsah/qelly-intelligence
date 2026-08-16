import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__preferencesLayoutTest} from '../functions/api/v1/preferences/layout.js';

test('layout preference sanitizer keeps only governed V6 fields',()=>{
  const {cleanPreferences}=__preferencesLayoutTest;
  assert.deepEqual(cleanPreferences({
    theme:'terminal-dark',density:'compact',motion:'reduced',fontScale:160,radiusPx:-5,route:'market',unknown:'drop-me'
  }),{
    theme:'terminal-dark',density:'compact',motion:'reduced',fontScale:140,radiusPx:0,route:'market'
  });
});

test('canonical layout route persists through Supabase RLS and never claims browser-local storage',async()=>{
  const source=await readFile(new URL('../functions/api/v1/preferences/layout.js',import.meta.url),'utf8');
  assert.match(source,/qelly_ui_preferences/);
  assert.match(source,/requireCsrf\(request\)/);
  assert.match(source,/storage:'cloud-rls'/);
  assert.match(source,/persisted:true/);
  assert.doesNotMatch(source,/storage:'browser-local'/);
  assert.doesNotMatch(source,/persisted:false/);
});
