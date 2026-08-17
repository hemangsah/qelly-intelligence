import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {migrateThemeConfig} from '../apps/web/public/assets/theme-intelligence.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('legacy porcelain preset resolves to the canonical light Porcelain Signal family',()=>{
  const config=migrateThemeConfig({theme:'porcelain-burgundy'});
  assert.equal(config.appearance,'light');
  assert.equal(config.themeFamily,'porcelain-signal');
  assert.equal(config.persona,'investor-compound');
});

test('browser theme bridge preserves full legacy preset semantics and persists appearance through canonical preferences',async()=>{
  const source=await read('apps/web/public/assets/theme-intelligence-bootstrap.mjs');
  assert.match(source,/'porcelain-burgundy':\{themeFamily:'porcelain-signal',persona:'investor-compound',appearance:'light'\}/);
  assert.match(source,/async function applyAndPersistTheme/);
  assert.match(source,/themeIntelligence\.apply\(complete\)/);
  assert.match(source,/themeIntelligence\.commit\(\)/);
  assert.match(source,/await persistPreference\(preference\)/);
  assert.match(source,/method:'PUT'/);
  assert.match(source,/\/api\/v1\/preferences\/layout/);
  assert.match(source,/toggleAppearance/);
  assert.match(source,/qelly:appearance-changed/);
});

test('visible production Appearance control toggles the canonical theme engine instead of merely opening Theme Studio',async()=>{
  const source=await read('apps/web/public/assets/qelly-production-v8.mjs');
  assert.match(source,/data\.v8Appearance='true'/);
  assert.match(source,/window\.QellyThemeStudio\?\.toggleAppearance/);
  assert.match(source,/Switch to \$\{next\.toLowerCase\(\)\} appearance/);
  assert.match(source,/document\.addEventListener\('qelly:appearance-changed'/);
  assert.doesNotMatch(source,/data\.v8Appearance='true'[\s\S]{0,800}button\.addEventListener\('click',\(\)=>\{location\.hash='#\/theme-lab';\}\)/);
});

test('login registration and recovery use a compact shell without duplicate search/account controls',async()=>{
  const source=await read('apps/web/public/assets/qelly-production-v8.mjs');
  assert.match(source,/ACCESS_ROUTES=new Set\(\['auth-login','auth-register','auth-recovery'\]\)/);
  assert.match(source,/header\.dataset\.accessShell='compact'/);
  assert.match(source,/grid-template-columns','auto minmax\(0,1fr\) auto','important'/);
  assert.match(source,/search\?\.style\.setProperty\('display','none','important'\)/);
  assert.match(source,/account\?\.style\.setProperty\('display','none','important'\)/);
  assert.match(source,/root\.dataset\.productionAccess=String\(access\)/);
});
