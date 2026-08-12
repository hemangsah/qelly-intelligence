import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { withLocalFileLock } from '../src/platform/local-file-lock.mjs';

const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));

test('same-process contenders queue fairly before the external filesystem timeout window starts',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'qelly-local-lock-fairness-'));
  const target=path.join(directory,'state.json');
  const order=[];
  try{
    await Promise.all([0,1,2].map((index)=>withLocalFileLock(target,async()=>{
      order.push(`start-${index}`);
      await sleep(60);
      order.push(`end-${index}`);
    },{timeoutMs:20,staleMs:5000})));
    assert.deepEqual(order,['start-0','end-0','start-1','end-1','start-2','end-2']);
  }finally{
    await rm(directory,{recursive:true,force:true});
  }
});

test('different lock paths remain independently concurrent',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'qelly-local-lock-parallel-'));
  const active=new Set();
  let peak=0;
  try{
    await Promise.all(['left','right'].map((name)=>withLocalFileLock(path.join(directory,`${name}.json`),async()=>{
      active.add(name);
      peak=Math.max(peak,active.size);
      await sleep(35);
      active.delete(name);
    },{timeoutMs:20,staleMs:5000})));
    assert.equal(peak,2,'different lock paths must not share a process-local queue');
  }finally{
    await rm(directory,{recursive:true,force:true});
  }
});