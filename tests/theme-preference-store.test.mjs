import test from 'node:test';
import assert from 'node:assert/strict';
import {createThemePreferenceStore} from '../apps/web/public/assets/theme-preference-store.mjs';
import {preferencePatch} from '../apps/web/public/assets/theme-intelligence-core.mjs';
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});

test('anonymous and static public calculators do not read or write private preferences',async()=>{
  const requests=[];
  const store=createThemePreferenceStore({fetcher:async(url,options)=>{requests.push({url,options});return response({auth:{authenticated:false}});}});
  assert.equal(await store.hydrate(),null);assert.equal(store.authenticated,false);
  assert.deepEqual(await store.persist({appearance:'light'}),{appearance:'light'});
  assert.deepEqual(requests.map(item=>item.url),['/api/v1/config']);
  const preview=createThemePreferenceStore({staticVisualPreview:true,fetcher:()=>{throw Error('Static preview must not call a live API');}});
  assert.equal(await preview.hydrate(),null);await preview.persist({appearance:'dark'});
});

test('shared theme writes retain CSRF, revision concurrency and exclude calculator context',async()=>{
  const requests=[];
  const store=createThemePreferenceStore({fetcher:async(url,options)=>{
    requests.push({url,options});
    if(url.endsWith('/config'))return response({auth:{authenticated:true},csrf:{token:'synthetic-csrf'}});
    if(!options.method)return response({appearance:'dark',revision:7});
    return response({...JSON.parse(options.body),revision:8});
  }});
  assert.equal((await store.hydrate()).appearance,'dark');
  const patch=preferencePatch({appearance:'light',calculator:{inputs:{accountBalance:12345}},locationHash:'#private'});
  await store.persist(patch);await store.persist({appearance:'dark'});
  const writes=requests.filter(item=>item.options.method==='PUT');assert.equal(writes.length,2);
  assert.equal(writes[0].options.headers['X-Qelly-CSRF'],'synthetic-csrf');assert.equal(writes[0].options.headers['If-Match-Revision'],'7');assert.equal(writes[1].options.headers['If-Match-Revision'],'8');
  assert.equal(writes[0].options.credentials,'include');assert.equal(writes[0].url,'/api/v1/preferences/layout');
  assert.doesNotMatch(writes[0].options.body,/accountBalance|calculator|locationHash|private/);
});

test('failed authentication and preference writes remain explicit failures',async()=>{
  const denied=createThemePreferenceStore({fetcher:async()=>response({},401)});
  assert.equal(await denied.hydrate(),null);assert.equal(denied.authenticated,false);
  const store=createThemePreferenceStore({fetcher:async(url,options)=>url.endsWith('/config')?response({auth:{authenticated:true},csrf:{token:'synthetic-csrf'}}):options.method?response({error:{message:'Revision conflict'}},409):response({appearance:'dark',revision:2})});
  await store.hydrate();await assert.rejects(store.persist({appearance:'light'}),/Revision conflict/);
});
