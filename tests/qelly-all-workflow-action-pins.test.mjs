import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
const root=new URL('../.github/workflows/',import.meta.url);
test('every remote workflow action is immutable, including optional and dispatch jobs',async()=>{
  const failures=[];
  for(const name of await readdir(root)){
    if(!/\.ya?ml$/.test(name))continue;
    const source=await readFile(new URL(name,root),'utf8');
    for(const match of source.matchAll(/\buses:\s*([\w.-]+\/[\w./-]+)@([^\s#]+)/g))if(!/^[0-9a-f]{40}$/.test(match[2]))failures.push(`${name}: ${match[1]}@${match[2]}`);
  }
  assert.deepEqual(failures,[]);
});
test('CodeQL initialization and analysis consume the same immutable action release',async()=>{
  const source=await readFile(new URL('security.yml',root),'utf8');
  const init=source.match(/github\/codeql-action\/init@([0-9a-f]{40})/);
  const analyze=source.match(/github\/codeql-action\/analyze@([0-9a-f]{40})/);
  assert.ok(init);assert.ok(analyze);assert.equal(init[1],analyze[1]);
});
