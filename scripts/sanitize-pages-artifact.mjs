import { lstat, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const defaultOutput=path.join(repositoryRoot,'dist/frontend');
export const cloudflareOnlyControlFiles=Object.freeze(['_headers','_routes.json']);

export async function sanitizePagesArtifact(output=defaultOutput){
  const artifactRoot=path.resolve(output);
  const removed=[];

  for(const name of cloudflareOnlyControlFiles){
    const target=path.resolve(artifactRoot,name);
    if(!target.startsWith(`${artifactRoot}${path.sep}`))throw new Error(`Pages sanitizer path escaped the artifact: ${name}`);
    try{
      const info=await lstat(target);
      if(info.isSymbolicLink()||!info.isFile())throw new Error(`Pages sanitizer refuses non-file control path: ${name}`);
      await rm(target);
      removed.push(name);
    }catch(error){
      if(error?.code!=='ENOENT')throw error;
    }
  }

  return Object.freeze({status:'pages-artifact-sanitized',output:artifactRoot,removed:Object.freeze(removed)});
}

const invokedPath=process.argv[1]?pathToFileURL(path.resolve(process.argv[1])).href:'';
if(invokedPath===import.meta.url){
  console.log(JSON.stringify(await sanitizePagesArtifact(),null,2));
}
