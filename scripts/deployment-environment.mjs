import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repositoryRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

function cloudflarePagesBuild(environment){
  return environment.CF_PAGES==='1'||String(environment.QELLY_DEPLOYMENT_ENVIRONMENT||'').includes('cloudflare-pages');
}

function configuredPagesVariables(){
  try{
    const config=JSON.parse(readFileSync(path.join(repositoryRoot,'wrangler.jsonc'),'utf8'));
    return config?.vars&&typeof config.vars==='object'?config.vars:{};
  }catch(error){
    throw new Error(`Unable to read Cloudflare Pages variables from wrangler.jsonc: ${error.message}`);
  }
}

export function effectiveDeploymentEnvironment(environment=process.env){
  if(!cloudflarePagesBuild(environment))return environment;
  return Object.freeze({...configuredPagesVariables(),...environment});
}

