import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist/frontend');
const expected=String(process.env.QELLY_PUBLIC_RELEASE_SHA||process.env.GITHUB_SHA||'');
const readJson=async(name)=>JSON.parse(await readFile(path.join(dist,name),'utf8'));
const release=await readJson('qelly-release.json'),build=await readJson('BUILD_INFO.json'),routes=await readJson('_routes.json');
const configSource=await readFile(path.join(dist,'qelly-config.js'),'utf8');
const callback=await readFile(path.join(dist,'auth/callback.html'),'utf8');
const functionFiles=['functions/api/v1/[[path]].js','functions/_lib/runtime.js','functions/_lib/auth.js','functions/_lib/data.js','functions/_lib/providers.js','functions/_middleware.js'];
const functionSource=(await Promise.all(functionFiles.map(file=>readFile(path.join(root,file),'utf8')))).join('\n');

if(!/^[0-9a-f]{40}$/i.test(expected))throw new Error('QELLY_PUBLIC_RELEASE_SHA must be an exact 40-character SHA');
if(release.releaseSha!==expected)throw new Error('Release identity does not match exact runtime head');
if(release.fallbackReleaseSha!=='603cece3091dc59cfb72680914e7056b40058022')throw new Error('Immutable deterministic fallback identity is missing');
if(release.mode!=='cloudflare-pages-public-runtime'||release.cloudMode!=='supabase-cloudflare-facade')throw new Error('Release mode is not the full public runtime');
for(const capability of ['authentication','cloudSync','liveProviders'])if(release[capability]!==true)throw new Error(`Release capability ${capability} is not enabled`);
if(build.runtimeArchitecture!=='cloudflare-api-facade-supabase-auth-rls'||build.connectedCapabilitiesActivated!==true)throw new Error('Build architecture/capabilities are not accepted');
if(!routes.include?.includes('/api/*'))throw new Error('Pages Functions route manifest does not include API routes');
if(!configSource.includes(expected)||!configSource.includes('supabase')||!configSource.includes('publishableKey'))throw new Error('Browser-safe runtime configuration is incomplete');
if(!callback.includes('qelly-auth-callback.mjs'))throw new Error('Auth callback asset is missing');
for(const marker of ['auth/register','auth/session','sync/push','providers/status'])if(!functionSource.includes(marker))throw new Error(`Pages Functions route missing: ${marker}`);

async function walk(directory){
  const entries=await readdir(directory,{withFileTypes:true}),files=[];
  for(const entry of entries){const full=path.join(directory,entry.name);if(entry.isDirectory())files.push(...await walk(full));else files.push(full);}
  return files;
}
for(const file of await walk(dist)){
  if(!/\.(?:js|mjs|json|html|css|xml|txt|webmanifest)$/i.test(file))continue;
  const text=await readFile(file,'utf8');
  if(/QELLY_SUPABASE_SERVICE_ROLE_KEY|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))throw new Error(`Private secret marker found in compiled asset: ${path.relative(dist,file)}`);
}
console.log(JSON.stringify({status:'qelly-public-runtime-artifact-valid',releaseSha:expected,files:(await walk(dist)).length,functions:functionFiles.length,architecture:build.runtimeArchitecture,capabilities:{authentication:release.authentication,cloudSync:release.cloudSync,liveProviders:release.liveProviders}},null,2));
