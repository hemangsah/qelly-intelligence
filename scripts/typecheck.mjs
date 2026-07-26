import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const roots=['apps','src','packages','scripts','tests'];
const excluded=new Set(['node_modules','runtime','dist','.git','preview','__pycache__']);
async function walk(dir){
  const out=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(excluded.has(entry.name))continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...await walk(full));
    else if(/\.(mjs|js)$/.test(entry.name))out.push(full);
  }
  return out;
}
const files=[];
for(const rel of roots){files.push(...await walk(path.join(root,rel)));}
const failures=[];
for(const file of files){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(result.status!==0)failures.push({file:path.relative(root,file),stderr:result.stderr.trim()});
}
if(failures.length){console.error(JSON.stringify({status:'typecheck-failed',failures},null,2));process.exit(1);}
console.log(JSON.stringify({status:'typecheck-passed',files:files.length},null,2));
