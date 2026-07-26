import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist/frontend');
const expectedBasePath='/qelly-intelligence/';
const requiredFiles=[
  'index.html',
  '404.html',
  'qelly-config.js',
  'BUILD_INFO.json',
  'assets/app.js',
  'assets/static-preview-api.mjs',
  'assets/persona-profiles.mjs',
  'assets/shell-foundations.mjs',
  'assets/qelly-foundations.css',
  'assets/tokens.css',
  'assets/tokens.json',
  'packages/accessibility/accessibility.mjs',
  'packages/ui-primitives/primitives.mjs',
  'packages/data-grid/data-grid.mjs',
  'packages/charting/chart-shell.mjs'
];
const allowedExtensions=new Set(['.html','.css','.js','.mjs','.json']);
const forbiddenFilePattern=/(^|\/)(?:\.env(?:\.|$)|runtime(?:\/|$)|uploads?(?:\/|$))|(?:^|\/).+\.(?:zip|tar|tgz|gz|7z|rar|db|sqlite|sqlite3|wal|shm|pem|key|p12|pfx)$/i;
const forbiddenTextPatterns=[
  ['private-key',/-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/],
  ['credential-bearing-url',/\b(?:postgres(?:ql)?|redis(?:s)?|mysql|mongodb(?:\+srv)?|https?):\/\/[^/\s:@]+:[^/\s@]+@/i],
  ['github-token',/\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['aws-access-key',/\bAKIA[0-9A-Z]{16}\b/],
  ['slack-token',/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['stripe-live-secret',/\bsk_live_[A-Za-z0-9]{16,}\b/],
  ['google-api-key',/\bAIza[0-9A-Za-z_-]{30,}\b/],
  ['npm-token',/\bnpm_[A-Za-z0-9]{30,}\b/]
];

async function walk(directory){
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const absolute=path.join(directory,entry.name);
    const info=await lstat(absolute);
    if(info.isSymbolicLink())throw new Error(`Symbolic links are not allowed in the Pages artifact: ${path.relative(output,absolute)}`);
    if(info.isDirectory())files.push(...await walk(absolute));
    else if(info.isFile())files.push(absolute);
  }
  return files;
}

function relative(file){
  return path.relative(output,file).replaceAll('\\','/');
}

function parseRuntimeConfig(text){
  const match=text.match(/^window\.__QELLY_CONFIG__=Object\.freeze\((\{.*\})\);\s*$/s);
  if(!match)throw new Error('qelly-config.js must contain one frozen JSON object');
  return JSON.parse(match[1]);
}

function assert(condition,message){
  if(!condition)throw new Error(message);
}

const files=await walk(output);
const names=files.map(relative).sort();
const nameSet=new Set(names);

for(const required of requiredFiles)assert(nameSet.has(required),`Missing required Pages artifact file: ${required}`);
for(const name of names){
  assert(allowedExtensions.has(path.extname(name).toLowerCase()),`Unexpected file type in Pages artifact: ${name}`);
  assert(!forbiddenFilePattern.test(name),`Forbidden file in Pages artifact: ${name}`);
}

for(const file of files){
  const text=await readFile(file,'utf8');
  for(const [rule,pattern] of forbiddenTextPatterns){
    assert(!pattern.test(text),`Potential ${rule} in Pages artifact: ${relative(file)}`);
  }
}

const configText=await readFile(path.join(output,'qelly-config.js'),'utf8');
const config=parseRuntimeConfig(configText);
assert(JSON.stringify(Object.keys(config).sort())===JSON.stringify([
  'apiBaseUrl',
  'backendAvailable',
  'basePath',
  'dataMode',
  'deploymentStage',
  'previewLabel',
  'staticVisualPreview'
].sort()),'qelly-config.js contains unexpected fields');
assert(config.apiBaseUrl==='','Static visual preview must not configure an API URL');
assert(config.deploymentStage==='github-pages','Static visual preview must use the github-pages stage');
assert(config.basePath===expectedBasePath,`Expected Pages base path ${expectedBasePath}`);
assert(config.staticVisualPreview===true,'Static visual preview flag must be enabled');
assert(config.previewLabel==='Static visual preview','Static visual preview label is missing');
assert(config.dataMode==='deterministic-demo','Pages data must be explicitly deterministic demo data');
assert(config.backendAvailable===false,'Pages backend must be explicitly unavailable');
assert(!/(?:secret|password|credential|token|database|postgres|redis|signing|private|endpoint)/i.test(Object.keys(config).join(' ')),'qelly-config.js contains a sensitive configuration key');

const index=await readFile(path.join(output,'index.html'),'utf8');
assert(index.includes(`<base href="${expectedBasePath}">`),'index.html is missing the repository base path');
assert(!/(?:src|href)=["']\/(?!\/)/i.test(index.replace(`<base href="${expectedBasePath}">`,'')),'index.html contains root-relative asset references');
assert(!/q-status--live[^>]*>READ ONLY/.test(index),'Static preview read-only state must not use a live-data tone');
assert(!/Live data control/i.test(index),'Static preview must not claim a live data control');
assert(index.includes('Data mode control'),'Static preview is missing the neutral data-mode control label');
for(const match of index.matchAll(/(?:src|href)=["']\.\/([^"'?#]+)["']/g)){
  assert(nameSet.has(match[1]),`index.html references a missing asset: ${match[1]}`);
}

const app=await readFile(path.join(output,'assets/app.js'),'utf8');
assert(!/from\s+["']\/packages\//.test(app),'app.js contains root-relative package imports');
assert(!/fetch\(["']\/assets\//.test(app),'app.js contains root-relative asset fetches');
assert(app.includes("new URL('./tokens.json',import.meta.url)"),'app.js must resolve tokens relative to its module');
assert(app.includes("import('./static-preview-api.mjs')"),'app.js is missing the local static preview adapter');

const redirect=await readFile(path.join(output,'404.html'),'utf8');
assert(redirect.includes(JSON.stringify(expectedBasePath)),'404.html is missing the repository-path redirect');
assert(redirect.includes("'#/'+route"),'404.html must preserve direct route navigation through the hash router');

for(const file of files.filter((candidate)=>/\.(?:mjs|js)$/.test(candidate))){
  const text=await readFile(file,'utf8');
  for(const match of text.matchAll(/(?:from\s*|import\s*\()\s*["'](\.[^"']+)["']/g)){
    const target=path.resolve(path.dirname(file),match[1]);
    assert(target.startsWith(`${output}${path.sep}`),`Module import escapes the Pages artifact: ${relative(file)} -> ${match[1]}`);
    assert(nameSet.has(relative(target)),`Module import target is missing: ${relative(file)} -> ${match[1]}`);
  }
}

const buildInfo=JSON.parse(await readFile(path.join(output,'BUILD_INFO.json'),'utf8'));
assert(buildInfo.artifact==='static-frontend','BUILD_INFO.json has the wrong artifact type');
assert(buildInfo.staticVisualPreview===true,'BUILD_INFO.json is not labelled as a static visual preview');
assert(buildInfo.apiBaseConfigured===false,'BUILD_INFO.json indicates an API URL was configured');
assert(buildInfo.basePath===expectedBasePath,'BUILD_INFO.json has the wrong base path');

console.log(JSON.stringify({
  status:'pages-preview-validation-passed',
  label:'Static visual preview',
  output:path.relative(root,output),
  basePath:expectedBasePath,
  files:names.length,
  secretFindings:0,
  routes:['market','asset-rankings','asset/QI-CRYPTO-BTC','decision-provenance','feature-universe','about-qelly','theme-personas','auth-login']
},null,2));
