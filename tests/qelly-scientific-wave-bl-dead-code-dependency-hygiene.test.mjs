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

test('Wave BL retains imported font layers as compatibility instead of deleting by age',async()=>{
  const reset=await readFile(path.join(root,'apps/web/public/assets/qelly-premium-reset.css'),'utf8');
  const retained=[
    'premium-font-surface.css',
    'premium-font-surface-polish.css',
    'premium-font-worldquant-arkham.css'
  ];
  for(const basename of retained){
    const source=await readFile(path.join(root,'apps/web/public/assets',basename),'utf8');
    assert.ok(source.length>0,basename);
    assert.ok(reset.includes(basename),basename);
  }
  const report=await buildRuntimeDeadCodeAudit();
  for(const basename of retained){
    const item=report.retained.find(record=>record.basename===basename);
    assert.ok(item,basename);
    assert.equal(item.classification,'COMPATIBILITY',JSON.stringify(item));
    const counts=item.referenceCounts||{};
    assert.ok((counts.RUNTIME||0)+(counts.BUILD||0)+(counts.TEST||0)+(counts.WORKFLOW||0)>0,JSON.stringify(item));
  }
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
  const versioned=report.retained.filter(item=>item.file.includes('-v2.')||item.file.includes('-v6.')||item.file.includes('-v7.'));
  assert.ok(versioned.length>0);
  for(const item of versioned){
    const counts=item.referenceCounts||{};
    const executable=(counts.RUNTIME||0)+(counts.BUILD||0)+(counts.TEST||0)+(counts.WORKFLOW||0);
    assert.ok(executable>0,JSON.stringify(item));
  }
  assert.match(report.deletionRule,/Filename age\/version alone is never deletion proof/);
});
