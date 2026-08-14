import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const loginSource=()=>readFile(new URL('../apps/web/public/assets/routes/auth-login.mjs',import.meta.url),'utf8');
const registerSource=()=>readFile(new URL('../apps/web/public/assets/routes/auth-register.mjs',import.meta.url),'utf8');
const recoverySource=()=>readFile(new URL('../apps/web/public/assets/routes/auth-recovery.mjs',import.meta.url),'utf8');

test('login renders even when session status cannot be fetched',async()=>{
  const code=await loginSource();
  assert.match(code,/try\{status=await api\('\/api\/v1\/auth\/status'\);\}/);
  assert.match(code,/Session verification unavailable/);
  assert.match(code,/Existing users may still attempt to sign in/);
});

test('signup and recovery CTAs use live server email-delivery truth instead of static build capability',async()=>{
  const [login,register,recovery]=await Promise.all([loginSource(),registerSource(),recoverySource()]);
  assert.match(login,/state\?\.config\?\.auth\?\.emailDeliveryAvailable===true/);
  assert.match(register,/api\('\/api\/v1\/config'\)/);
  assert.match(register,/auth\?\.emailDeliveryAvailable===true/);
  assert.match(recovery,/api\('\/api\/v1\/config'\)/);
  assert.match(recovery,/auth\?\.emailDeliveryAvailable===true/);
  for(const code of [login,register,recovery])assert.doesNotMatch(code,/__QELLY_CONFIG__\?\.capabilities\?\.emailDelivery/);
  assert.match(login,/Password recovery temporarily unavailable/);
  assert.match(login,/Registration temporarily unavailable/);
  assert.match(login,/Signup and recovery remain fail-closed/);
});

test('existing-password sign in is not blocked by the new-password strength policy',async()=>{
  const [login,register]=await Promise.all([loginSource(),registerSource()]);
  assert.match(login,/autocomplete="current-password" required placeholder="Your password"/);
  assert.doesNotMatch(login,/autocomplete="current-password"[^>]*minlength=/);
  assert.match(register,/name="password" type="password" required minlength="12" autocomplete="new-password"/);
});
