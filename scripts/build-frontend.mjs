import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist/frontend');
const staticVisualPreview=process.env.QELLY_STATIC_VISUAL_PREVIEW==='true';
const prompt2cPublicBeta=process.env.QELLY_PROMPT2C_PUBLIC_BETA==='true';
const requirePublicRuntime=process.env.QELLY_REQUIRE_PUBLIC_RUNTIME==='true';
const rawBasePath=String(process.env.QELLY_PUBLIC_BASE_PATH??'/').trim();
const basePath=rawBasePath==='/'?'/':`/${rawBasePath.replace(/^\/+|\/+$/g,'')}/`;
const cleanUrl=(value,name,{required=false}={})=>{if(!value){if(required)throw new Error(`${name} is required`);return '';}const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw new Error(`${name} must be a safe HTTPS URL`);return url.toString().replace(/\/$/,'');};
const asBool=(value,fallback)=>value==null||value===''?fallback:/^(1|true|yes|on)$/i.test(String(value));
if(!/^\/(?:[A-Za-z0-9._~-]+\/)*$/.test(basePath)||basePath.includes('//')||basePath.includes('\\'))throw new Error('QELLY_PUBLIC_BASE_PATH must be a safe absolute path ending in /');

const apiBaseUrl=cleanUrl(String(process.env.QELLY_PUBLIC_API_BASE_URL??''),'QELLY_PUBLIC_API_BASE_URL');
const publicSiteUrl=cleanUrl(String(process.env.QELLY_PUBLIC_SITE_URL??''),'QELLY_PUBLIC_SITE_URL',{required:requirePublicRuntime});
const supabaseUrl=cleanUrl(String(process.env.QELLY_PUBLIC_SUPABASE_URL??''),'QELLY_PUBLIC_SUPABASE_URL',{required:requirePublicRuntime});
const supabasePublishableKey=String(process.env.QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.QELLY_PUBLIC_SUPABASE_ANON_KEY??'');
if(requirePublicRuntime&&supabasePublishableKey.length<20)throw new Error('QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required');
if(staticVisualPreview&&(apiBaseUrl||requirePublicRuntime))throw new Error('Static visual preview cannot enable the connected public runtime');

const buildTimestamp=new Date().toISOString();
const releaseSha=String(process.env.QELLY_PUBLIC_RELEASE_SHA??process.env.CF_PAGES_COMMIT_SHA??process.env.GITHUB_SHA??'unresolved');
const capabilities={
  deterministicLocal:true,
  authentication:!staticVisualPreview&&asBool(process.env.QELLY_ENABLE_AUTH,requirePublicRuntime),
  cloudSync:!staticVisualPreview&&asBool(process.env.QELLY_ENABLE_CLOUD_SYNC,requirePublicRuntime),
  liveProviders:!staticVisualPreview&&asBool(process.env.QELLY_ENABLE_LIVE_PROVIDERS,requirePublicRuntime),
  protectedWrites:!staticVisualPreview&&asBool(process.env.QELLY_ENABLE_FEEDBACK_WRITES,requirePublicRuntime),
  offlineShell:true
};
if(requirePublicRuntime&&Object.entries(capabilities).some(([name,value])=>['authentication','cloudSync','liveProviders'].includes(name)&&!value))throw new Error('Required public runtime capabilities are disabled');

await rm(output,{recursive:true,force:true});
await mkdir(path.join(output,'packages'),{recursive:true});
await cp(path.join(root,'apps/web/public'),output,{recursive:true});
const runtimeFiles=[['accessibility','accessibility.mjs'],['ui-primitives','primitives.mjs'],['data-grid','data-grid.mjs'],['charting','chart-shell.mjs']];
for(const [directory,file] of runtimeFiles){const target=path.join(output,'packages',directory);await mkdir(target,{recursive:true});await cp(path.join(root,'packages',directory,file),path.join(target,file));}

async function findVariableFont(packageName,preferred){
  const filesRoot=path.join(root,'node_modules',packageName,'files'),entries=await readdir(filesRoot);
  const exact=entries.find(name=>name===preferred),fallback=entries.find(name=>name.endsWith('-latin-wght-normal.woff2'))??entries.find(name=>name.endsWith('-wght-normal.woff2'));
  if(!exact&&!fallback)throw new Error(`Variable WOFF2 missing for ${packageName}`);
  return path.join(filesRoot,exact??fallback);
}
const fontOutput=path.join(output,'assets/fonts');await mkdir(fontOutput,{recursive:true});
for(const [packageName,preferred,target] of [['@fontsource-variable/ibm-plex-sans','ibm-plex-sans-latin-wght-normal.woff2','ibm-plex-sans-variable.woff2']]){
  await cp(await findVariableFont(packageName,preferred),path.join(fontOutput,target));
  await cp(path.join(root,'node_modules',packageName,'LICENSE'),path.join(fontOutput,`${target}.LICENSE.txt`));
}

const indexPath=path.join(output,'index.html');let index=await readFile(indexPath,'utf8');
if(basePath!=='/')index=index.replace('<head>',`<head>\n  <base href="${basePath}">`);
if(prompt2cPublicBeta){
  const productStyles='  <link rel="stylesheet" href="./assets/prompt2c-public-beta.css">\n  <link rel="stylesheet" href="./assets/qelly-production-polish.css">';
  if(!index.includes('prompt2c-public-beta.css'))index=index.replace('</head>',`${productStyles}\n</head>`);
  else if(!index.includes('qelly-production-polish.css'))index=index.replace(/(\s*<link rel="stylesheet" href="\.\/assets\/prompt2c-public-beta\.css">)/,`$1\n  <link rel="stylesheet" href="./assets/qelly-production-polish.css">`);
  if(!index.includes('prompt2c-public-beta.mjs'))index=index.replace('</body>','  <script type="module" src="./assets/prompt2c-public-beta.mjs"></script>\n</body>');
}
await writeFile(indexPath,index);

const runtimeConfig={
  schemaVersion:1,
  productMode:prompt2cPublicBeta?'QELLY GLOBAL PUBLIC BETA':'QELLY',
  deploymentStage:staticVisualPreview?'static-preview':String(process.env.QELLY_DEPLOYMENT_ENVIRONMENT??'cloudflare-pages-production'),
  releaseSha,
  buildTimestamp,
  basePath,
  publicSiteUrl,
  publicBaseUrl:publicSiteUrl,
  apiBaseUrl,
  staticVisualPreview,
  previewLabel:staticVisualPreview?'Static visual preview':null,
  dataMode:staticVisualPreview?'deterministic-demo':'public-runtime',
  backendAvailable:!staticVisualPreview,
  supabase:Object.freeze({url:supabaseUrl,publishableKey:supabasePublishableKey}),
  capabilities:Object.freeze(capabilities),
  supportUrl:publicSiteUrl?`${publicSiteUrl}/support.html`:'./support.html',
  legal:Object.freeze({
    beta:publicSiteUrl?`${publicSiteUrl}/legal/beta.html`:'./legal/beta.html',
    risk:publicSiteUrl?`${publicSiteUrl}/legal/risk.html`:'./legal/risk.html',
    privacy:publicSiteUrl?`${publicSiteUrl}/legal/privacy.html`:'./legal/privacy.html',
    terms:publicSiteUrl?`${publicSiteUrl}/legal/terms.html`:'./legal/terms.html'
  })
};
await writeFile(path.join(output,'qelly-config.js'),`window.__QELLY_CONFIG__=Object.freeze(${JSON.stringify(runtimeConfig)});\n`);

if(staticVisualPreview){
  const redirect=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Qelly Intelligence · Static visual preview</title></head><body><p>Opening the Qelly Intelligence Static visual preview…</p><script>(()=>{const base=${JSON.stringify(basePath)},relative=location.pathname.startsWith(base)?location.pathname.slice(base.length):'',route=relative.replace(/^\\\/+|\\\/+$/g,'');location.replace(base+location.search+(route?'#/'+route:''));})();</script></body></html>`;
  await writeFile(path.join(output,'404.html'),redirect);
}

const releaseIdentity={
  releaseSha,
  workflowRun:process.env.GITHUB_RUN_ID??null,
  deploymentId:process.env.CF_PAGES_DEPLOYMENT_ID??null,
  deployedAt:process.env.QELLY_DEPLOYED_AT??null,
  buildTimestamp,
  mode:staticVisualPreview?'deterministic-local-fallback':'cloudflare-pages-public-runtime',
  cloudMode:staticVisualPreview?'local-only':'supabase-cloudflare-facade',
  authentication:capabilities.authentication,
  cloudSync:capabilities.cloudSync,
  liveProviders:capabilities.liveProviders,
  protectedWrites:capabilities.protectedWrites,
  publicSiteUrl:publicSiteUrl||null,
  fallbackReleaseSha:'603cece3091dc59cfb72680914e7056b40058022'
};
await writeFile(path.join(output,'qelly-release.json'),`${JSON.stringify(releaseIdentity,null,2)}\n`);
await writeFile(path.join(output,'_routes.json'),`${JSON.stringify({version:1,include:['/api/*'],exclude:[]},null,2)}\n`);

await writeFile(path.join(output,'BUILD_INFO.json'),`${JSON.stringify({
  product:'Qelly Intelligence',version:'0.9.0-preview.1',artifact:'static-frontend-with-pages-functions',
  apiBaseConfigured:Boolean(apiBaseUrl),basePath,staticVisualPreview,prompt2cPublicBeta,
  publicBetaMode:prompt2cPublicBeta?'QELLY GLOBAL PUBLIC BETA':null,
  connectedCapabilitiesActivated:capabilities.authentication&&capabilities.cloudSync&&capabilities.liveProviders,
  releaseSha,buildTimestamp,functionsRoot:'functions',runtimeArchitecture:'cloudflare-api-facade-supabase-auth-rls',
  fonts:{ui:'IBM Plex Sans Variable',evidence:'IBM Plex Sans Variable',fallbacks:['Arial','Helvetica Neue','sans-serif'],licensedOptional:['GT Eesti Pro Display','GT Eesti Pro Text'],licensedOptionalActive:false,iconSystem:'semantic-inline-svg',selfHosted:true,format:'woff2'}
},null,2)}\n`);
console.log(JSON.stringify({status:'frontend-build-passed',output:path.relative(root,output),releaseSha,publicSiteUrl,apiBaseConfigured:Boolean(apiBaseUrl),basePath,staticVisualPreview,prompt2cPublicBeta,capabilities,functionsRoot:'functions',fonts:['ibm-plex-sans-variable.woff2']},null,2));
