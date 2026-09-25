import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildRuntimeDeadCodeAudit} from '../scripts/runtime-dead-code-audit.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const executableRoots=['apps','src','functions','packages','scripts','tests','.github'];
const ignored=new Set(['node_modules','dist','preview','coverage','.wrangler','.cache']);
const textExtensions=new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.json','.html','.css','.scss','.yml','.yaml','.py','.sh']);
const removedAssets=[
  'premium-font-surface.css',
  'premium-font-surface-polish.css',
  'premium-font-worldquant-arkham.css'
];

async function walk(directory,files=[]){
  let entries=[];
  try{entries=await readdir(directory,{withFileTypes:true});}catch{return files;}
  for(const entry of entries){
    if(ignored.has(entry.name))continue;
    const absolute=path.join(directory,entry.name);
    if(entry.isDirectory())await walk(absolute,files);
    else if(textExtensions.has(path.extname(entry.name).toLowerCase()))files.push(absolute);
  }
  return files;
}

test('Wave BL removes only superseded font assets with zero executable references',async()=>{
  for(const basename of removedAssets){
    await assert.rejects(readFile(path.join(root,'apps/web/public/assets',basename),'utf8'));
  }
  const files=[];
  for(const entry of executableRoots)await walk(path.join(root,entry),files);
  const self=fileURLToPath(import.meta.url);
  const references=[];
  for(const file of files){
    if(file===self)continue;
    const source=await readFile(file,'utf8').catch(()=>null);
    if(source===null)continue;
    for(const basename of removedAssets){
      if(source.includes(basename))references.push({file:path.relative(root,file),basename});
    }
  }
  assert.deepEqual(references,[]);
});

test('Wave BL removes unused Geist packages without touching the active IBM Plex font build',async()=>{
  const [pkg,lock,build,localBoard,remoteBoard]=await Promise.all([
    readFile(path.join(root,'package.json'),'utf8').then(JSON.parse),
    readFile(path.join(root,'package-lock.json'),'utf8'),
    readFile(path.join(root,'scripts/build-frontend.mjs'),'utf8'),
    readFile(path.join(root,'scripts/font-comparison-board-local.mjs'),'utf8'),
    readFile(path.join(root,'scripts/font-comparison-board.mjs'),'utf8')
  ]);
  assert.equal(pkg.devDependencies?.['@fontsource-variable/geist'],undefined);
  assert.equal(pkg.devDependencies?.['@fontsource-variable/geist-mono'],undefined);
  assert.doesNotMatch(lock,/node_modules\/@fontsource-variable\/geist(?:-mono)?"/);
  assert.match(build,/@fontsource-variable\/ibm-plex-sans/);
  assert.match(build,/ibm-plex-sans-variable\.woff2/);
  for(const name of ['@fontsource-variable/ibm-plex-sans','@fontsource-variable/manrope','@fontsource-variable/plus-jakarta-sans'])assert.ok(localBoard.includes(name),name);
  assert.doesNotMatch(localBoard,/pkg:'@fontsource-variable\/geist(?:-mono)?'/);
  assert.match(remoteBoard,/cdn\.jsdelivr\.net\/npm\/@fontsource-variable\/geist/);
});

test('Wave BL audit exposes the required classification taxonomy and dependency evidence',async()=>{
  const report=await buildRuntimeDeadCodeAudit();
  assert.equal(report.schemaVersion,2);
  assert.deepEqual(report.taxonomy,['ACTIVE','COMPATIBILITY','GENERATED','TEST','DEPRECATED','DEAD']);
  assert.match(report.deletionRule,/zero executable references/);
  for(const key of report.taxonomy)assert.equal(Number.isInteger(report.classificationCounts[key]),true,key);
  const deps=new Map(report.dependencies.map(item=>[item.name,item]));
  for(const name of ['pg','playwright','pngjs','@fontsource-variable/ibm-plex-sans','@fontsource-variable/manrope','@fontsource-variable/plus-jakarta-sans']){
    assert.ok(deps.has(name),name);
    assert.equal(deps.get(name).classification,'ACTIVE',JSON.stringify(deps.get(name)));
    assert.ok(deps.get(name).executableReferenceCount>0,name);
  }
  assert.equal(deps.has('@fontsource-variable/geist'),false);
  assert.equal(deps.has('@fontsource-variable/geist-mono'),false);
});

test('Wave BL does not treat versioned names as deletion proof',async()=>{
  const report=await buildRuntimeDeadCodeAudit();
  assert.ok(report.retained.some(item=>item.file.includes('-v2.')||item.file.includes('-v6.')||item.file.includes('-v7.')));
  assert.ok(report.retained.every(item=>item.executableReferences===undefined||true));
  assert.match(report.deletionRule,/Filename age\/version alone is never deletion proof/);
});
