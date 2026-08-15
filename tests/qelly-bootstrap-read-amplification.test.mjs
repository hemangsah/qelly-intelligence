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

test('browser-local layout preferences do not bootstrap profile or workspace rows',async()=>{
  const source=await read('functions/api/v1/preferences/layout.js');
  assert.match(source,/resolveSession\(request,env,\{required:true\}\)/);
  assert.match(source,/enforceRateLimit/);
  assert.match(source,/persisted:false/);
  assert.match(source,/storage:'browser-local'/);
  assert.doesNotMatch(source,/bootstrapContext/);
});

test('full bootstrap remains reserved for session context and data handlers',async()=>{
  const source=await read('functions/api/v1/[[path]].js');
  assert.match(source,/const qelly=await bootstrapContext\(env,session\)/);
  assert.match(source,/path==='session\/context'/);
  assert.match(source,/handleData\(context,path,segments,method,session,qelly\)/);
});
