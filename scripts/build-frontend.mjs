import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist/frontend');
const apiBaseUrl=String(process.env.QELLY_PUBLIC_API_BASE_URL??'').trim().replace(/\/$/,'');
const staticVisualPreview=process.env.QELLY_STATIC_VISUAL_PREVIEW==='true';
const rawBasePath=String(process.env.QELLY_PUBLIC_BASE_PATH??'/').trim();
const basePath=rawBasePath==='/'?'/':`/${rawBasePath.replace(/^\/+|\/+$/g,'')}/`;
if(!/^\/(?:[A-Za-z0-9._~-]+\/)*$/.test(basePath)||basePath.includes('//')||basePath.includes('\\'))throw new Error('QELLY_PUBLIC_BASE_PATH must be a safe absolute path ending in /');
if(staticVisualPreview&&apiBaseUrl)throw new Error('QELLY_PUBLIC_API_BASE_URL must be empty for the Static visual preview');
if((process.env.VERCEL==='1'||process.env.QELLY_REQUIRE_PUBLIC_API_BASE_URL==='true')&&!apiBaseUrl)throw new Error('QELLY_PUBLIC_API_BASE_URL is required for a standalone frontend deployment');
if(apiBaseUrl&&new URL(apiBaseUrl).protocol!=='https:')throw new Error('QELLY_PUBLIC_API_BASE_URL must use HTTPS');

await rm(output,{recursive:true,force:true});
await mkdir(path.join(output,'packages'),{recursive:true});
await cp(path.join(root,'apps/web/public'),output,{recursive:true});
const runtimeFiles=[
  ['accessibility','accessibility.mjs'],
  ['ui-primitives','primitives.mjs'],
  ['data-grid','data-grid.mjs'],
  ['charting','chart-shell.mjs']
];
for(const [directory,file] of runtimeFiles){
  const target=path.join(output,'packages',directory);
  await mkdir(target,{recursive:true});
  await cp(path.join(root,'packages',directory,file),path.join(target,file));
}

async function findVariableFont(packageName,preferred){
  const filesRoot=path.join(root,'node_modules',packageName,'files');
  const entries=await readdir(filesRoot);
  const exact=entries.find((name)=>name===preferred);
  const fallback=entries.find((name)=>name.endsWith('-latin-wght-normal.woff2'))??entries.find((name)=>name.endsWith('-wght-normal.woff2'));
  if(!exact&&!fallback)throw new Error(`Variable WOFF2 missing for ${packageName}`);
  return path.join(filesRoot,exact??fallback);
}
const fontOutput=path.join(output,'assets/fonts');
await mkdir(fontOutput,{recursive:true});
const fontCopies=[
  ['@fontsource-variable/geist','geist-latin-wght-normal.woff2','geist-variable.woff2'],
  ['@fontsource-variable/geist-mono','geist-mono-latin-wght-normal.woff2','geist-mono-variable.woff2']
];
for(const [packageName,preferred,target] of fontCopies){
  await cp(await findVariableFont(packageName,preferred),path.join(fontOutput,target));
  await cp(path.join(root,'node_modules',packageName,'LICENSE'),path.join(fontOutput,`${target}.LICENSE.txt`));
}

if(basePath!=='/'){
  const indexPath=path.join(output,'index.html');
  const index=await readFile(indexPath,'utf8');
  await writeFile(indexPath,index.replace('<head>',`<head>\n  <base href="${basePath}">`));
}

const runtimeConfig=staticVisualPreview
  ? {
      apiBaseUrl:'',
      deploymentStage:'github-pages',
      basePath,
      staticVisualPreview:true,
      previewLabel:'Static visual preview',
      dataMode:'deterministic-demo',
      backendAvailable:false
    }
  : {
      apiBaseUrl,
      deploymentStage:process.env.VERCEL_ENV??process.env.QELLY_DEPLOYMENT_ENVIRONMENT??'same-origin',
      basePath,
      staticVisualPreview:false
    };
await writeFile(path.join(output,'qelly-config.js'),`window.__QELLY_CONFIG__=Object.freeze(${JSON.stringify(runtimeConfig)});\n`);

if(staticVisualPreview){
  const redirect=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Qelly Intelligence · Static visual preview</title></head>
<body><p>Opening the Qelly Intelligence Static visual preview…</p>
<script>
(() => {
  const base=${JSON.stringify(basePath)};
  const relative=location.pathname.startsWith(base)?location.pathname.slice(base.length):'';
  const route=relative.replace(/^\\/+|\\/+$/g,'');
  const target=base+location.search+(route?'#/'+route:'');
  location.replace(target);
})();
</script></body></html>
`;
  await writeFile(path.join(output,'404.html'),redirect);
}

await writeFile(path.join(output,'BUILD_INFO.json'),`${JSON.stringify({
  product:'Qelly Intelligence',
  version:'0.9.0-preview.1',
  artifact:'static-frontend',
  apiBaseConfigured:Boolean(apiBaseUrl),
  basePath,
  staticVisualPreview,
  previewLabel:staticVisualPreview?'Static visual preview':null,
  fonts:{ui:'Geist Variable',mono:'Geist Mono Variable',selfHosted:true,format:'woff2'},
  builtAt:new Date().toISOString()
},null,2)}\n`);
console.log(JSON.stringify({status:'frontend-build-passed',output:path.relative(root,output),apiBaseConfigured:Boolean(apiBaseUrl),basePath,staticVisualPreview,fonts:['geist-variable.woff2','geist-mono-variable.woff2']},null,2));
