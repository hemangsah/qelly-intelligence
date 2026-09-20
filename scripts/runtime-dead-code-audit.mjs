import {readdir,readFile,stat,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ignored=new Set(['.git','node_modules','dist','preview','coverage','.wrangler','.cache']);
const textExtensions=new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.json','.html','.css','.scss','.md','.txt','.yml','.yaml','.py','.sh','.toml','.xml','.webmanifest']);
const executableRoots=['apps/','src/','functions/','packages/','scripts/','tests/','.github/'];
const candidatePattern=/(?:^|[-_.])(v5(?:3|4)?|v6|v7|v8|v9|legacy|rescue|recovery|repair|convergence|final(?:izer|[-_.]fixes?)?|prompt2b)(?:[-_.]|$)/i;

async function walk(directory,files=[]){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(ignored.has(entry.name))continue;
    const absolute=path.join(directory,entry.name);
    if(entry.isDirectory())await walk(absolute,files);
    else if(textExtensions.has(path.extname(entry.name).toLowerCase()))files.push(absolute);
  }
  return files;
}

const relative=(absolute)=>path.relative(root,absolute).replaceAll(path.sep,'/');
const categoryFor=(file)=>{
  if(file.startsWith('tests/'))return'test';
  if(file.startsWith('.github/'))return'workflow';
  if(file.startsWith('scripts/'))return'build';
  if(file.startsWith('apps/')||file.startsWith('src/')||file.startsWith('functions/')||file.startsWith('packages/'))return'runtime';
  return'documentation';
};

export async function buildRuntimeDeadCodeAudit(){
  const absoluteFiles=await walk(root);
  const sources=new Map();
  for(const absolute of absoluteFiles){
    const file=relative(absolute);
    try{sources.set(file,await readFile(absolute,'utf8'));}catch{}
  }

  const candidates=[...sources.keys()].filter((file)=>{
    if(!candidatePattern.test(path.basename(file)))return false;
    return file.startsWith('apps/web/public/assets/')||file.startsWith('scripts/');
  }).sort();

  const records=[];
  for(const file of candidates){
    const basename=path.basename(file);
    const refs=[];
    for(const [other,content] of sources){
      if(other===file)continue;
      if(!content.includes(basename))continue;
      refs.push({file:other,category:categoryFor(other)});
    }
    const counts={runtime:0,build:0,test:0,workflow:0,documentation:0};
    for(const ref of refs)counts[ref.category]+=1;
    const executableReferences=counts.runtime+counts.build+counts.test+counts.workflow;
    records.push({
      file,
      basename,
      references:refs,
      referenceCounts:counts,
      executableReferences,
      deletable:executableReferences===0
    });
  }

  const deletable=records.filter((item)=>item.deletable);
  const retained=records.filter((item)=>!item.deletable);
  return {
    schemaVersion:1,
    generatedAt:new Date().toISOString(),
    candidateCount:records.length,
    deletableCount:deletable.length,
    retainedCount:retained.length,
    deletable:deletable.map(({file,basename,referenceCounts,references})=>({file,basename,referenceCounts,documentationReferences:references.filter(r=>r.category==='documentation').map(r=>r.file)})),
    retained:retained.map(({file,basename,referenceCounts,references})=>({file,basename,referenceCounts,references:references.slice(0,40)}))
  };
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=await buildRuntimeDeadCodeAudit();
  const target=path.join(root,'validation','RUNTIME_DEAD_CODE_AUDIT.json');
  await mkdir(path.dirname(target),{recursive:true});
  await writeFile(target,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({
    status:'runtime-dead-code-audit-complete',
    candidateCount:report.candidateCount,
    deletableCount:report.deletableCount,
    retainedCount:report.retainedCount,
    deletable:report.deletable.map(item=>item.file)
  },null,2));
}
