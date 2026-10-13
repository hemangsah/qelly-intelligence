import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanUiPreferences,uiPreferencesEnvelope,DEFAULT_UI_PREFERENCES} from '../functions/_lib/ui-preferences.js';
import {createThemePreferenceStore} from '../apps/web/public/assets/theme-preference-store.mjs';
import {migrateThemeConfig,preferencePatch,resolveAppearance} from '../apps/web/public/assets/theme-intelligence-core.mjs';

test('header appearance survives the existing cloud preference serialization and next bootstrap',async()=>{
 let row={preferences:{...DEFAULT_UI_PREFERENCES},revision:7,schema_version:3},writes=[];
 const store=createThemePreferenceStore({apiBase:'https://qelly.invalid',fetcher:async(url,init={})=>{
  const path=new URL(url).pathname;
  if(path==='/api/v1/config')return Response.json({auth:{authenticated:true},csrf:{token:'fixture-csrf'}});
  assert.equal(path,'/api/v1/preferences/layout');
  if(init.method==='PUT'){
   assert.equal(init.headers['X-Qelly-CSRF'],'fixture-csrf');
   assert.equal(init.headers['If-Match-Revision'],String(row.revision));
   const incoming=cleanUiPreferences(JSON.parse(init.body));
   writes.push(incoming);row={...row,preferences:{...row.preferences,...incoming},revision:row.revision+1};
  }
  return Response.json(uiPreferencesEnvelope(row));
 }});
 const first=await store.hydrate();assert.equal(resolveAppearance(migrateThemeConfig(first)),'dark');
 await store.persist(preferencePatch(migrateThemeConfig({...first,appearance:'light'})));
 const reloaded=await store.hydrate();assert.equal(resolveAppearance(migrateThemeConfig(reloaded)),'light');
 assert.equal(reloaded.theme,'burgundy-command');assert.equal(reloaded.storage,'cloud-rls');assert.equal(reloaded.persisted,true);
 await store.persist({...preferencePatch(migrateThemeConfig({...reloaded,appearance:'dark'})),walletSigning:true,authRole:'admin'});
 assert.equal(resolveAppearance(migrateThemeConfig(await store.hydrate())),'dark');
 assert.equal(writes.length,2);assert.ok(writes.every(x=>!Object.hasOwn(x,'walletSigning')&&!Object.hasOwn(x,'authRole')));
});

test('appearance accepts existing modes and rejects malformed or unrecognized settings',()=>{
 for(const mode of ['dark','light','oled','high-contrast','system','scheduled'])assert.equal(cleanUiPreferences({appearance:mode}).appearance,mode);
 for(const value of [null,{},['light'],true,1,'LIGHT','unknown','javascript:alert(1)'])assert.deepEqual(cleanUiPreferences({appearance:value,unknown:true}),{});
});

test('absence of appearance preserves the existing legacy light preset',()=>{
 const old=uiPreferencesEnvelope({preferences:{theme:'porcelain-burgundy'},revision:2});
 assert.equal(Object.hasOwn(DEFAULT_UI_PREFERENCES,'appearance'),false);
 assert.equal(resolveAppearance(migrateThemeConfig(old)),'light');
});
