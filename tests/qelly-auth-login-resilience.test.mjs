import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=()=>readFile(new URL('../apps/web/public/assets/routes/auth-login.mjs',import.meta.url),'utf8');

test('login renders even when session status cannot be fetched',async()=>{
  const code=await source();
  assert.match(code,/try\{status=await api\('\/api\/v1\/auth\/status'\);\}/);
  assert.match(code,/Session verification unavailable/);
  assert.match(code,/Existing users may still attempt to sign in/);
});

test('signup and recovery CTAs follow the email-delivery capability',async()=>{
  const code=await source();
  assert.match(code,/capabilities\?\.emailDelivery===true/);
  assert.match(code,/Password recovery temporarily unavailable/);
  assert.match(code,/Registration temporarily unavailable/);
  assert.match(code,/Signup and recovery remain fail-closed/);
});
