import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist/frontend');
const RELEASE_PLACEHOLDER="const RELEASE_KEY='__QELLY_RELEASE_KEY__';";
const SHELL_PATTERN=/const SHELL=Object\.freeze\(\[[\s\S]*?\]\);/;

const normalizeLocalAsset=(value)=>{
  const raw=String(value||'').trim();
  if(!raw||raw.startsWith('#')||raw.startsWith('data:')||raw.startsWith('blob:')||raw.startsWith('//'))return null;
  if(/^[a-z][a-z0-9+.-]*:/i.test(raw))return null;
  const clean=raw.split('#')[0].split('?')[0];
  if(!clean)return null;
  if(clean.startsWith('/'))return '.'+clean;
  if(clean.startsWith('./'))return clean;
  if(clean.startsWith('../'))return null;
  return './'+clean;
};

export function collectFinalShell(indexHtml){
  const assets=new Set(['./','./index.html','./qelly-config.js','./qelly-release.json','./manifest.webmanifest','./favicon.svg']);
  const source=String(indexHtml||'');
  const pattern=/(?:src|href)=["']([^"']+)["']/gi;
  let match;
  while((match=pattern.exec(source))){
    const asset=normalizeLocalAsset(match[1]);
    if(asset)assets.add(asset);
  }
  return [...assets].sort((a,b)=>{
    const priority=new Map([['./',0],['./index.html',1],['./qelly-config.js',2],['./qelly-release.json',3],['./manifest.webmanifest',4],['./favicon.svg',5]]);
    return (priority.get(a)??100)-(priority.get(b)??100)||a.localeCompare(b);
  });
}

export function serviceWorkerReleaseKey(releaseSha,buildTimestamp='',strict=false){
  const sha=String(releaseSha||'').trim().toLowerCase();
  if(/^[0-9a-f]{40}$/.test(sha))return sha;
  if(strict)throw new Error('Production service worker release SHA must be a full 40-character commit SHA');
  const digest=createHash('sha256').update(sha+'|'+String(buildTimestamp||'local')).digest('hex').slice(0,24);
  return 'local-'+digest;
}

export function stampServiceWorker(source,{releaseSha,buildTimestamp,shell,strict=false}){
  const sha=serviceWorkerReleaseKey(releaseSha,buildTimestamp,strict);
  if(!String(source).includes(RELEASE_PLACEHOLDER))throw new Error('Service worker release placeholder is missing');
  if(!SHELL_PATTERN.test(String(source)))throw new Error('Service worker shell declaration is missing');
  const normalizedShell=[...new Set(shell||[])].filter(Boolean);
  if(!normalizedShell.includes('./')||!normalizedShell.includes('./index.html'))throw new Error('Service worker shell must include navigation fallbacks');
  return String(source)
    .replace(RELEASE_PLACEHOLDER,`const RELEASE_KEY='${sha}';`)
    .replace(SHELL_PATTERN,`const SHELL=Object.freeze(${JSON.stringify(normalizedShell)});`);
}

export async function finalizeReleaseCache({outputDir=output}={}){
  const [releaseText,indexHtml,workerSource]=await Promise.all([
    readFile(path.join(outputDir,'qelly-release.json'),'utf8'),
    readFile(path.join(outputDir,'index.html'),'utf8'),
    readFile(path.join(outputDir,'qelly-service-worker.js'),'utf8')
  ]);
  const release=JSON.parse(releaseText);
  const shell=collectFinalShell(indexHtml);
  const stamped=stampServiceWorker(workerSource,{releaseSha:release.releaseSha,buildTimestamp:release.buildTimestamp,shell,strict:process.env.QELLY_REQUIRE_PUBLIC_RUNTIME==='true'});
  await writeFile(path.join(outputDir,'qelly-service-worker.js'),stamped);
  return {status:'release-cache-finalized',releaseSha:release.releaseSha,shellEntries:shell.length};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  console.log(JSON.stringify(await finalizeReleaseCache(),null,2));
}
