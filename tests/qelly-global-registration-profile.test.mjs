import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=()=>readFile(new URL('../apps/web/public/assets/routes/auth-register.mjs',import.meta.url),'utf8');

test('registration does not hard-code one global timezone',async()=>{
  const code=await source();
  assert.match(code,/Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/);
  assert.match(code,/form\.elements\.timezone\.value=browserTimezone\(\)/);
  assert.doesNotMatch(code,/name="timezone" type="hidden" value="Asia\/Kolkata"/);
});

test('registration lets the user select a base display currency',async()=>{
  const code=await source();
  assert.match(code,/select name="baseCurrency" required/);
  for(const currency of ['USD','INR','EUR','GBP','SGD','AED','JPY'])assert.match(code,new RegExp(`option value="${currency}"`));
  assert.match(code,/does not enable trading, custody or currency conversion/);
});
