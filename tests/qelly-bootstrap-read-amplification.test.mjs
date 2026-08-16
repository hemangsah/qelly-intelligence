import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('runtime config authenticates without loading profile and workspace context',async()=>{
  const source=await read('functions/api/v1/config.js');
  assert.match(source,/resolveSession\(request,env\)/);
  assert.match(source,/const authenticated=Boolean\(session\)/);
  assert.doesNotMatch(source,/bootstrapContext/);
  assert.match(source,/double-submit-cookie/);
});

test('cloud layout preferences use authenticated workspace context and never claim browser-local persistence',async()=>{
  const source=await read('functions/api/v1/preferences/layout.js');
  assert.match(source,/resolveSession\(request,env,\{required:true\}\)/);
  assert.match(source,/enforceRateLimit/);
  assert.match(source,/bootstrapContext\(env,session\)/);
  assert.match(source,/qelly_ui_preferences/);
  assert.match(source,/storage:'cloud-rls'/);
  assert.match(source,/persisted:true/);
  assert.doesNotMatch(source,/storage:'browser-local'/);
  assert.doesNotMatch(source,/persisted:false/);
});

test('full bootstrap remains reserved for authenticated workspace-scoped handlers',async()=>{
  const [catchAll,preferences]=await Promise.all([
    read('functions/api/v1/[[path]].js'),
    read('functions/api/v1/preferences/layout.js')
  ]);
  assert.match(catchAll,/const qelly=await bootstrapContext\(env,session\)/);
  assert.match(catchAll,/path==='session\/context'/);
  assert.match(catchAll,/handleData\(context,path,segments,method,session,qelly\)/);
  assert.match(preferences,/const qelly=await bootstrapContext\(env,session\)/);
});
