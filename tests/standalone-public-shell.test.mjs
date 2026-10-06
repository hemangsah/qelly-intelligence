import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {generatePublicAssetResearch} from '../scripts/generate-public-asset-research.mjs';
import {installStandalonePublicShell,STANDALONE_PUBLIC_PAGES} from '../scripts/install-standalone-public-shell.mjs';
import {__qellyChatTest} from '../apps/web/public/assets/ai/qelly-chat.mjs';

test('standalone shell preserves substantive pages, titles and callback isolation and is idempotent',async()=>{
  const output=await mkdtemp(path.join(os.tmpdir(),'qelly-standalone-'));
  try{
    await mkdir(path.join(output,'legal'),{recursive:true});await mkdir(path.join(output,'auth'),{recursive:true});
    await writeFile(path.join(output,'sitemap.xml'),'<urlset></urlset>');
    await generatePublicAssetResearch({output,environment:{}});
    for(const page of STANDALONE_PUBLIC_PAGES.filter(item=>!item.asset))await writeFile(path.join(output,page.path),await readFile(new URL('../apps/web/public/'+page.path,import.meta.url),'utf8'));
    const callback='<!doctype html><head><title>Auth callback</title></head><body>Private callback contract</body>';
    await writeFile(path.join(output,'auth/callback.html'),callback);
    const originals=new Map(await Promise.all(STANDALONE_PUBLIC_PAGES.map(async page=>[page.path,await readFile(path.join(output,page.path),'utf8')])));
    const result=await installStandalonePublicShell({output});assert.equal(result.pages,11);assert.equal(result.changed,11);
    for(const page of STANDALONE_PUBLIC_PAGES){
      const html=await readFile(path.join(output,page.path),'utf8'),original=originals.get(page.path);
      assert.equal(html.match(/<title>([\s\S]*?)<\/title>/)[1],original.match(/<title>([\s\S]*?)<\/title>/)[1]);
      assert.equal((html.match(/src="\/assets\/standalone-public-shell.mjs"/g)||[]).length,1);
      assert.equal((html.match(/<details>/g)||[]).length,5);
      assert.equal((html.match(/id="main"/g)||[]).length,1);
      assert.ok(html.indexOf('qelly-prepaint-bootstrap.js')<html.indexOf('rel="stylesheet"'));
      assert.ok(html.includes('data-qelly-chat-route="'+page.route+'"'));
      const priorMain=original.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];assert.ok(html.includes(priorMain),'Original main content changed: '+page.path);
      assert.ok(!html.includes('class="qar-nav"'));
    }
    assert.equal(await readFile(path.join(output,'auth/callback.html'),'utf8'),callback);
    assert.equal((await installStandalonePublicShell({output})).changed,0);
  }finally{await rm(output,{recursive:true,force:true});}
});

test('declared standalone routes remain stable without interpreting URL parameters or arbitrary metadata',t=>{
  const priorDocument=globalThis.document,priorLocation=globalThis.location;
  t.after(()=>{if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;if(priorLocation===undefined)delete globalThis.location;else globalThis.location=priorLocation;});
  globalThis.location={pathname:'/legal/privacy.html',hash:'#untrusted-private-fragment',search:'?private=synthetic'};
  globalThis.document={body:{dataset:{qellyChatRoute:'trust-center'}}};assert.equal(__qellyChatTest.currentRoute(),'trust-center');
  globalThis.document.body.dataset.qellyChatRoute='asset';assert.equal(__qellyChatTest.currentRoute(),'asset');
  globalThis.document.body.dataset.qellyChatRoute='not-a-route';globalThis.location.hash='#/market';assert.equal(__qellyChatTest.currentRoute(),'market');
});
