import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cloudflareOnlyControlFiles, sanitizePagesArtifact } from '../scripts/sanitize-pages-artifact.mjs';

async function missing(file){
  try{await access(file);return false;}catch(error){if(error?.code==='ENOENT')return true;throw error;}
}

test('GitHub Pages artifact removes only Cloudflare deployment controls',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'qelly-pages-artifact-'));
  try{
    await writeFile(path.join(directory,'index.html'),'<h1>Qelly</h1>');
    await writeFile(path.join(directory,'_headers'),'/*\n  X-Frame-Options: DENY\n');
    await writeFile(path.join(directory,'_routes.json'),'{"version":1}');
    await writeFile(path.join(directory,'governed.json'),'{"safe":true}');

    const result=await sanitizePagesArtifact(directory);
    assert.deepEqual([...result.removed].sort(),[...cloudflareOnlyControlFiles].sort());
    assert.equal(await missing(path.join(directory,'_headers')),true);
    assert.equal(await missing(path.join(directory,'_routes.json')),true);
    assert.equal(await readFile(path.join(directory,'index.html'),'utf8'),'<h1>Qelly</h1>');
    assert.equal(await readFile(path.join(directory,'governed.json'),'utf8'),'{"safe":true}');

    const repeated=await sanitizePagesArtifact(directory);
    assert.deepEqual(repeated.removed,[]);
  }finally{
    await rm(directory,{recursive:true,force:true});
  }
});

test('Pages artifact sanitizer rejects symbolic control paths',async(t)=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'qelly-pages-artifact-link-'));
  try{
    await writeFile(path.join(directory,'outside.txt'),'not a control file');
    try{
      await symlink(path.join(directory,'outside.txt'),path.join(directory,'_headers'));
    }catch(error){
      if(process.platform==='win32'&&['EPERM','EACCES','UNKNOWN'].includes(error?.code)){
        t.skip('Windows symbolic-link creation is unavailable without Developer Mode or elevated privilege.');
        return;
      }
      throw error;
    }
    await assert.rejects(()=>sanitizePagesArtifact(directory),/refuses non-file control path/);
    assert.equal(await readFile(path.join(directory,'outside.txt'),'utf8'),'not a control file');
  }finally{
    await rm(directory,{recursive:true,force:true});
  }
});
