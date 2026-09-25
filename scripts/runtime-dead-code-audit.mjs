import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ignored=new Set(['.git','node_modules','dist','preview','coverage','.wrangler','.cache']);
const textExtensions=new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.json','.html','.css','.scss','.md','.txt','.yml','.yaml','.py','.sh','.toml','.xml','.webmanifest']);
const candidatePattern=/(?:^|[-_.])(v5(?:3|4)?|v6|v7|v8|v9|legacy|compat(?:ibility)?|rescue|recovery|repair|convergence|final(?:izer|[-_.]fixes?)?|prompt2b|font[-_.]surface|worldquant[-_.]arkham)(?:[-_.]|$)/i;
const executablePrefixes=['apps/','src/','functions/','packages/','scripts/','tests/','.github/'];
const dependencyMetadataFiles=new Set(['package.json','package-lock.json']);

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
  if(file.startsWith('tests/'))return'TEST';
  if(file.startsWith('.github/'))return'WORKFLOW';
  if(file.startsWith('scripts/'))return'BUILD';
  if(file.startsWith('apps/')||file.startsWith('src/')||file.startsWith('functions/')||file.startsWith('packages/'))return'RUNTIME';
  if(file.startsWith('validation/')||file.startsWith('artifacts/')||file.startsWith('project-state/'))return'GENERATED';
  if(file.startsWith('docs/archive/'))return'DEPRECATED';
  return'DOCUMENTATION';
};
const executableCategory=(category)=>['RUNTIME','BUILD','TEST','WORKFLOW'].includes(category);
const compatibilityName=(file)=>/(?:^|[-_.])(legacy|compat(?:ibility)?|recovery|rescue|alias)(?:[-_.]|$)/i.test(path.basename(file));

const escapeRegex=(value)=>String(value).replace(/[.*+?^$()|[\]\\]/g,'\\$&');
const dependencyReferenceKind=(source,name)=>{
  const escaped=escapeRegex(name);
  const direct=new RegExp("(?:from\\s*['\"]"+escaped+"(?:['\"/])|require\\(\\s*['\"]"+escaped+"(?:['\"/])|import\\(\\s*['\"]"+escaped+"(?:['\"/]))");
  if(direct.test(source))return'DIRECT_IMPORT';
  if(source.includes('node_modules')&&source.includes(name))return'NODE_MODULES_ACCESS';
  return null;
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
    for(const [other,source] of sources){
      if(other===file)continue;
      if(!source.includes(basename))continue;
      refs.push({file:other,category:categoryFor(other)});
    }
    const counts={RUNTIME:0,BUILD:0,TEST:0,WORKFLOW:0,GENERATED:0,DEPRECATED:0,DOCUMENTATION:0};
    for(const ref of refs)counts[ref.category]=(counts[ref.category]??0)+1;
    const executableReferences=refs.filter(ref=>executableCategory(ref.category)).length;
    const classification=executableReferences===0?'DEAD':compatibilityName(file)?'COMPATIBILITY':'ACTIVE';
    records.push({
      file,
      basename,
      classification,
      references:refs,
      referenceCounts:counts,
      executableReferences,
      deletable:classification==='DEAD'
    });
  }

  const deadFiles=new Set(records.filter(item=>item.classification==='DEAD').map(item=>item.file));
  const classificationForFile=(file)=>{
    if(deadFiles.has(file))return'DEAD';
    const category=categoryFor(file);
    if(category==='TEST')return'TEST';
    if(category==='GENERATED')return'GENERATED';
    if(category==='DEPRECATED')return'DEPRECATED';
    if(compatibilityName(file)&&executablePrefixes.some(prefix=>file.startsWith(prefix)))return'COMPATIBILITY';
    return'ACTIVE';
  };
  const classificationCounts={ACTIVE:0,COMPATIBILITY:0,GENERATED:0,TEST:0,DEPRECATED:0,DEAD:0};
  for(const file of sources.keys())classificationCounts[classificationForFile(file)]+=1;

  const packageJson=JSON.parse(sources.get('package.json')||'{}');
  const dependencies={...(packageJson.dependencies||{}),...(packageJson.devDependencies||{})};
  const dependencyRecords=[];
  for(const [name,version] of Object.entries(dependencies).sort(([a],[b])=>a.localeCompare(b))){
    const references=[];
    for(const [file,source] of sources){
      if(dependencyMetadataFiles.has(file))continue;
      const kind=dependencyReferenceKind(source,name);
      if(!kind)continue;
      references.push({file,category:categoryFor(file),kind});
    }
    const executableReferences=references.filter(ref=>executableCategory(ref.category));
    dependencyRecords.push({
      name,
      version,
      scope:Object.hasOwn(packageJson.dependencies||{},name)?'runtime':'development',
      classification:executableReferences.length?'ACTIVE':'DEAD',
      executableReferenceCount:executableReferences.length,
      executableReferences:executableReferences.slice(0,40),
      documentationReferenceCount:references.filter(ref=>!executableCategory(ref.category)).length
    });
  }

  const deletable=records.filter(item=>item.deletable);
  const retained=records.filter(item=>!item.deletable);
  return {
    schemaVersion:2,
    generatedAt:new Date().toISOString(),
    taxonomy:['ACTIVE','COMPATIBILITY','GENERATED','TEST','DEPRECATED','DEAD'],
    classificationCounts,
    candidateCount:records.length,
    deletableCount:deletable.length,
    retainedCount:retained.length,
    deletable:deletable.map(({file,basename,classification,referenceCounts,references})=>({
      file,basename,classification,referenceCounts,
      documentationReferences:references.filter(ref=>!executableCategory(ref.category)).map(ref=>ref.file)
    })),
    retained:retained.map(({file,basename,classification,referenceCounts,references})=>({
      file,basename,classification,referenceCounts,references:references.slice(0,40)
    })),
    dependencies:dependencyRecords,
    dependencySummary:{
      total:dependencyRecords.length,
      active:dependencyRecords.filter(item=>item.classification==='ACTIVE').length,
      dead:dependencyRecords.filter(item=>item.classification==='DEAD').length
    },
    deletionRule:'Only DEAD items with zero executable references are deletion candidates. Filename age/version alone is never deletion proof.'
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
    classificationCounts:report.classificationCounts,
    dependencySummary:report.dependencySummary,
    deletable:report.deletable.map(item=>item.file),
    deadDependencies:report.dependencies.filter(item=>item.classification==='DEAD').map(item=>item.name)
  },null,2));
}
