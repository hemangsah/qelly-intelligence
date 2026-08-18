import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canonicalTimezone,recognizedTimezone} from '../functions/_lib/timezone.js';
import {__profileRouteTest} from '../functions/api/v1/profile.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('legacy India timezone alias canonicalizes to Asia/Kolkata',()=>{
  assert.equal(canonicalTimezone('Asia/Calcutta'),'Asia/Kolkata');
  assert.equal(canonicalTimezone('Asia/Kolkata'),'Asia/Kolkata');
  assert.equal(canonicalTimezone(' UTC '),'UTC');
  assert.equal(recognizedTimezone('Asia/Calcutta'),true);
  assert.equal(recognizedTimezone('Asia/Kolkata'),true);
  assert.equal(recognizedTimezone('not a timezone'),false);
  assert.equal(__profileRouteTest.safeTimezone('Asia/Calcutta'),'Asia/Kolkata');
});

test('registration and persistence layers enforce canonical timezone writes',async()=>{
  const [auth,migration]=await Promise.all([
    read('functions/_lib/auth.js'),
    read('supabase/migrations/20260818100000_qelly_timezone_canonicalization_v1.sql')
  ]);
  assert.match(auth,/canonicalTimezone\(body\.timezone\|\|'Asia\/Kolkata'\)/);
  assert.match(auth,/recognizedTimezone\(timezone\)/);
  assert.doesNotMatch(auth,/timezone:cleanText\(body\.timezone/);
  assert.match(migration,/update public\.qelly_profiles[\s\S]*Asia\/Calcutta[\s\S]*Asia\/Kolkata/);
  assert.match(migration,/update auth\.users[\s\S]*raw_user_meta_data/);
  assert.match(migration,/qelly_profiles_timezone_canonical/);
  assert.match(migration,/qelly_theme_schedules_timezone_canonical/);
});
