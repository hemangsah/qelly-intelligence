import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'dist');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
const entries=['apps','src','packages','deploy','scripts','package.json','package-lock.json','.env.example','.env.preview.example','.env.production.example','vercel.json','README.md','LICENSE','NOTICE.md','SECURITY.md','Dockerfile','Dockerfile.worker','Dockerfile.ops'];
for(const rel of entries)await cp(path.join(root,rel),path.join(out,rel),{recursive:true});
await mkdir(path.join(out,'runtime'),{recursive:true});await writeFile(path.join(out,'runtime','.gitkeep'),'');
const buildInfo={product:'Qelly Intelligence',version:'0.9.0-preview.1',builtAt:new Date().toISOString(),artifact:'portable-node-runtime',entries};
await writeFile(path.join(out,'BUILD_INFO.json'),JSON.stringify(buildInfo,null,2)+'\n');
const runtimeDir=await mkdtemp(path.join(os.tmpdir(),'qelly-build-smoke-'));
const {startServer}=await import(pathToFileURL(path.join(out,'src/server/server.mjs')).href+`?build=${Date.now()}`);
const started=await startServer({port:0,runtimePath:runtimeDir,environment:{...process.env,NODE_ENV:'test',QELLY_PUBLIC_MARKET_DATA_ENABLED:'false'}});
try{
 const health=await fetch(`http://${started.host}:${started.port}/api/health`);if(!health.ok)throw new Error(`built health failed ${health.status}`);
 const market=await fetch(`http://${started.host}:${started.port}/api/v1/public/markets/overview`);if(!market.ok)throw new Error(`built public market failed ${market.status}`);
 const body=await market.json();if(body.mode!=='simulated-fallback')throw new Error(`unexpected deterministic build mode ${body.mode}`);
}finally{await new Promise(resolve=>started.server.close(resolve));started.runtime.productionRepository?.close?.();await rm(runtimeDir,{recursive:true,force:true});}
console.log(JSON.stringify({status:'build-passed',output:path.relative(root,out),coldStart:true,publicMarketFallbackVerified:true},null,2));
