import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist/frontend');
const apiBaseUrl=String(process.env.QELLY_PUBLIC_API_BASE_URL??'').trim().replace(/\/$/,'');
if((process.env.VERCEL==='1'||process.env.QELLY_REQUIRE_PUBLIC_API_BASE_URL==='true')&&!apiBaseUrl)throw new Error('QELLY_PUBLIC_API_BASE_URL is required for a standalone frontend deployment');
if(apiBaseUrl&&new URL(apiBaseUrl).protocol!=='https:')throw new Error('QELLY_PUBLIC_API_BASE_URL must use HTTPS');

await rm(output,{recursive:true,force:true});
await mkdir(path.join(output,'packages'),{recursive:true});
await cp(path.join(root,'apps/web/public'),output,{recursive:true});
for(const name of ['accessibility','ui-primitives','data-grid','charting'])await cp(path.join(root,'packages',name),path.join(output,'packages',name),{recursive:true});
await writeFile(path.join(output,'qelly-config.js'),`window.__QELLY_CONFIG__=Object.freeze(${JSON.stringify({apiBaseUrl,deploymentStage:process.env.VERCEL_ENV??process.env.QELLY_DEPLOYMENT_ENVIRONMENT??'same-origin'})});\n`);
await writeFile(path.join(output,'BUILD_INFO.json'),`${JSON.stringify({product:'Qelly Intelligence',version:'0.9.0-preview.1',artifact:'static-frontend',apiBaseConfigured:Boolean(apiBaseUrl),builtAt:new Date().toISOString()},null,2)}\n`);
console.log(JSON.stringify({status:'frontend-build-passed',output:path.relative(root,output),apiBaseConfigured:Boolean(apiBaseUrl)},null,2));
