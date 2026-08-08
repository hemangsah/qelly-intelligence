import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {safeBaseCurrency,safeTimezone,SUPPORTED_BASE_CURRENCIES} from '../functions/_lib/profile-preferences.js';

const read=(relative)=>readFile(new URL(`../${relative}`,import.meta.url),'utf8');
const migration=()=>read('packages/migrations/20260808090000_qelly_profile_locale_preferences.sql');

test('profile preference helpers validate supported currencies and IANA timezones',()=>{
  assert.deepEqual(SUPPORTED_BASE_CURRENCIES,['USD','INR','EUR','GBP','SGD','AED','JPY']);
  assert.equal(safeBaseCurrency('inr'),'INR');
  assert.equal(safeTimezone('Asia/Kolkata'),'Asia/Kolkata');
  assert.equal(safeTimezone('America/New_York'),'America/New_York');
  assert.throws(()=>safeBaseCurrency('XYZ'),/Base currency is not supported/);
  assert.throws(()=>safeTimezone('Not/A_Real_Zone'),/valid IANA timezone/);
});

test('profile locale migration persists registration metadata with safe defaults',async()=>{
  const sql=await migration();
  assert.match(sql,/add column if not exists base_currency text not null default 'USD'/i);
  assert.match(sql,/add column if not exists timezone text not null default 'UTC'/i);
  assert.match(sql,/qelly_profiles_base_currency_check/i);
  assert.match(sql,/qelly_profiles_timezone_check/i);
  assert.match(sql,/new\.raw_user_meta_data->>'base_currency'/i);
  assert.match(sql,/new\.raw_user_meta_data->>'timezone'/i);
  assert.match(sql,/new\.raw_user_meta_data->>'workspace_name'/i);
  assert.match(sql,/on conflict\(user_id\) do update/i);
});

test('profile locale migration preserves the Auth trigger security boundary',async()=>{
  const sql=await migration();
  assert.match(sql,/create or replace function qelly_private\.bootstrap_user\(\)/i);
  assert.match(sql,/security definer/i);
  assert.match(sql,/set search_path = ''/i);
  assert.match(sql,/notify pgrst, 'reload schema'/i);
});

test('registration already forwards the governed preference metadata to Supabase Auth',async()=>{
  const auth=await read('functions/_lib/auth.js');
  assert.match(auth,/base_currency:cleanText\(body\.baseCurrency\|\|'USD',8\)/);
  assert.match(auth,/timezone:cleanText\(body\.timezone\|\|'Asia\/Kolkata',64\)/);
  assert.match(auth,/workspace_name:cleanText\(body\.workspaceName\|\|body\.organizationName\|\|'My Qelly Workspace',100\)/);
});
