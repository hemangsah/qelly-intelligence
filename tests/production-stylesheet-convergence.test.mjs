import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const runtimeUrl=new URL('../apps/web/public/assets/qelly-production-shell.mjs',import.meta.url);
const base='https://terminal.qellyintelligence.com/';
async function verifyLinkedStylesheets(transform=links=>links){
  const [source,index]=await Promise.all([readFile(runtimeUrl,'utf8'),readFile(new URL('../apps/web/public/index.html',import.meta.url),'utf8')]);
  const declarations=source.split('\n').filter(line=>/^const .*_STYLESHEET=/.test(line)).join('\n');
  const contract=source.slice(source.indexOf('function verifyCanonicalStylesheetContract()'),source.indexOf('/* This map'));
  const links=transform([...index.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(match=>({href:new URL(match[1],base).href})));
  const root={dataset:{}},warnings=[];
  const result=runInNewContext((declarations+'\n'+contract+'\nverifyCanonicalStylesheetContract()').replaceAll('import.meta.url',JSON.stringify(base+'assets/qelly-production-shell.mjs')),{URL,root,document:{baseURI:base,querySelectorAll:()=>links},console:{warn:(...args)=>warnings.push(args)}});
  return {result,state:root.dataset.productionStylesheets,warnings};
}
test('current build stylesheet cache revisions satisfy the shell identity contract',async()=>{
  const proof=await verifyLinkedStylesheets();assert.equal(proof.result,true);assert.equal(proof.state,'stable');assert.equal(proof.warnings.length,0);
});
test('changed query revisions remain valid but missing, foreign-origin and wrong-path stylesheets remain incomplete',async()=>{
  const revised=await verifyLinkedStylesheets(links=>links.map(link=>({href:link.href+'?release=next'})));assert.equal(revised.result,true);
  for(const alter of [links=>links.filter(link=>!link.href.includes('qelly-navigation-v2.css')),links=>links.map(link=>({href:link.href.includes('qelly-navigation-v2.css')?link.href.replace(base,'https://foreign.example/'):link.href})),links=>links.map(link=>({href:link.href.includes('qelly-navigation-v2.css')?link.href.replace('/assets/','/other/'):link.href}))]){
    const proof=await verifyLinkedStylesheets(alter);assert.equal(proof.result,false);assert.equal(proof.state,'incomplete');assert.ok(proof.warnings[0][1].includes('navigation-v2'));
  }
});

test('production stylesheet convergence validates the build-time order without mutating head',async()=>{
  const source=await readFile(runtimeUrl,'utf8');
  assert.match(source,/function verifyCanonicalStylesheetContract\(\)/);
  assert.match(source,/root\.dataset\.productionStylesheets=missing\.length\?'incomplete':'stable'/);
  assert.doesNotMatch(source,/document\.head\.append\(\.\.\.desiredTail\)/);
  assert.doesNotMatch(source,/document\.head\.append\(repairs\)/);
  assert.doesNotMatch(source,/document\.head\.append\(convergence\)/);
});

test('production shell no longer observes head or the entire app for late visual convergence',async()=>{
  const source=await readFile(runtimeUrl,'utf8');
  assert.doesNotMatch(source,/observe\(document\.head/);
  assert.doesNotMatch(source,/observe\(document\.querySelector\('#app'\)/);
  assert.match(source,/queueMicrotask\(\(\)=>\{queued=false;refresh\(scope\);\}\)/);
  assert.match(source,/root\.dataset\.productionShellReady='true'/);
});
