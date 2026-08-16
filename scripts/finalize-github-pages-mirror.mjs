import {access,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist/frontend');
const MIRROR_URL='https://hemangsah.github.io/qelly-intelligence';
const CANONICAL_URL='https://qelly-intelligence.pages.dev';
const MIRROR_BOOTSTRAP='<script type="module" src="./assets/qelly-github-pages-mirror.mjs"></script>';

const parseConfig=(source)=>{
  const sandbox={window:{},Object};
  vm.runInNewContext(String(source),sandbox,{timeout:1000});
  return sandbox.window.__QELLY_CONFIG__||{};
};
const replaceTag=(html,pattern,replacement)=>pattern.test(html)?html.replace(pattern,replacement):html.replace('</head>',`  ${replacement}\n</head>`);

export function finalizeMirrorIndex(source){
  let html=String(source);
  if(!html.includes(MIRROR_BOOTSTRAP))html=html.replace('<script type="module" src="./assets/theme-intelligence-bootstrap.mjs"></script>',`${MIRROR_BOOTSTRAP}\n  <script type="module" src="./assets/theme-intelligence-bootstrap.mjs"></script>`);
  html=replaceTag(html,/<meta\s+name=["']robots["'][^>]*>/i,'<meta name="robots" content="noindex,follow,noarchive">');
  html=replaceTag(html,/<link\s+rel=["']canonical["'][^>]*>/i,`<link rel="canonical" href="${CANONICAL_URL}/">`);
  html=replaceTag(html,/<meta\s+property=["']og:url["'][^>]*>/i,`<meta property="og:url" content="${CANONICAL_URL}/">`);
  html=html.replaceAll(`${MIRROR_URL}/qelly-intelligence/`,`${MIRROR_URL}/`);
  return html;
}

export async function finalizeGithubPagesMirror({directory=output}={}){
  const configPath=path.join(directory,'qelly-config.js');
  const buildPath=path.join(directory,'BUILD_INFO.json');
  const indexPath=path.join(directory,'index.html');
  const [configSource,buildSource,indexSource]=await Promise.all([readFile(configPath,'utf8'),readFile(buildPath,'utf8'),readFile(indexPath,'utf8')]);
  const config=parseConfig(configSource);
  const build=JSON.parse(buildSource);
  if(config.mirrorMode!=='github-pages-public')throw new Error('GitHub Pages artifact is not in github-pages-public mirror mode');
  if(config.staticVisualPreview!==false)throw new Error('GitHub Pages mirror must not be a static visual preview');
  if(config.apiBaseUrl!==CANONICAL_URL)throw new Error(`GitHub Pages mirror API must be ${CANONICAL_URL}`);
  if(config.canonicalSiteUrl!==CANONICAL_URL)throw new Error(`GitHub Pages canonical site must be ${CANONICAL_URL}`);
  if(config.publicSiteUrl!==MIRROR_URL)throw new Error(`GitHub Pages public site identity must be ${MIRROR_URL}`);
  if(config.basePath!=='/qelly-intelligence/')throw new Error('GitHub Pages mirror base path is invalid');
  for(const key of ['authentication','cloudSync','protectedWrites'])if(config.capabilities?.[key]!==false)throw new Error(`GitHub Pages mirror capability ${key} must be false`);
  if(config.capabilities?.liveProviders!==true)throw new Error('GitHub Pages mirror must expose the canonical public provider facade');
  if(config.supabase?.publishableKey)throw new Error('GitHub Pages mirror must not embed a Supabase publishable key');
  if(build.artifact!=='github-pages-public-mirror'||build.githubPagesMirror!==true)throw new Error('BUILD_INFO does not identify the public mirror artifact');

  const index=finalizeMirrorIndex(indexSource);
  if(!index.includes(MIRROR_BOOTSTRAP))throw new Error('GitHub Pages mirror bootstrap was not injected');
  if(!index.includes(`<link rel="canonical" href="${CANONICAL_URL}/">`))throw new Error('GitHub Pages canonical tag does not point to Cloudflare');
  if(!index.includes('name="robots" content="noindex,follow,noarchive"'))throw new Error('GitHub Pages mirror must be noindex');
  await writeFile(indexPath,index);
  await writeFile(path.join(directory,'robots.txt'),'User-agent: *\nDisallow: /\n');
  await writeFile(path.join(directory,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${CANONICAL_URL}/</loc></url>\n</urlset>\n`);
  await rm(path.join(directory,'_routes.json'),{force:true});
  await access(path.join(directory,'404.html'));
  await access(path.join(directory,'assets/qelly-github-pages-mirror.mjs'));
  return Object.freeze({status:'github-pages-public-mirror-finalized',mirrorUrl:MIRROR_URL,canonicalUrl:CANONICAL_URL,apiBaseUrl:config.apiBaseUrl,basePath:config.basePath,authHandoff:true,indexable:false,artifact:build.artifact});
}

const invoked=process.argv[1]?pathToFileURL(path.resolve(process.argv[1])).href:'';
if(invoked===import.meta.url)console.log(JSON.stringify(await finalizeGithubPagesMirror(),null,2));
