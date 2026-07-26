import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist/frontend');
const basePath='/qelly-intelligence/';
const mime={
  '.css':'text/css',
  '.html':'text/html',
  '.js':'text/javascript',
  '.json':'application/json',
  '.mjs':'text/javascript'
};

const server=createServer(async(request,response)=>{
  try{
    const pathname=decodeURIComponent(new URL(request.url,'http://preview.test').pathname);
    if(!pathname.startsWith(basePath))throw Object.assign(new Error('not found'),{status:404});
    const relative=pathname.slice(basePath.length);
    const requested=path.resolve(output,relative||'index.html');
    if(!requested.startsWith(`${output}${path.sep}`))throw Object.assign(new Error('not found'),{status:404});
    const body=await readFile(requested);
    response.writeHead(200,{'Content-Type':mime[path.extname(requested)]??'application/octet-stream'});
    response.end(body);
  }catch(error){
    const body=await readFile(path.join(output,'404.html'));
    response.writeHead(error.status??404,{'Content-Type':'text/html'});
    response.end(body);
  }
});

await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',resolve);
});

try{
  const address=server.address();
  const origin=`http://127.0.0.1:${address.port}`;
  const expected=[
    ['',200,'text/html'],
    ['qelly-config.js',200,'text/javascript'],
    ['assets/tokens.css',200,'text/css'],
    ['assets/app.css',200,'text/css'],
    ['assets/app.js',200,'text/javascript'],
    ['assets/static-preview-api.mjs',200,'text/javascript'],
    ['assets/persona-profiles.mjs',200,'text/javascript'],
    ['assets/shell-foundations.mjs',200,'text/javascript'],
    ['assets/qelly-foundations.css',200,'text/css'],
    ['assets/tokens.json',200,'application/json'],
    ['packages/accessibility/accessibility.mjs',200,'text/javascript'],
    ['packages/ui-primitives/primitives.mjs',200,'text/javascript'],
    ['packages/data-grid/data-grid.mjs',200,'text/javascript'],
    ['packages/charting/chart-shell.mjs',200,'text/javascript']
  ];
  for(const [relative,status,contentType] of expected){
    const response=await fetch(`${origin}${basePath}${relative}`);
    if(response.status!==status)throw new Error(`${relative||'index.html'} returned ${response.status}`);
    if(!response.headers.get('content-type')?.includes(contentType))throw new Error(`${relative||'index.html'} returned the wrong content type`);
  }

  const direct=await fetch(`${origin}${basePath}asset/QI-CRYPTO-BTC`);
  const directBody=await direct.text();
  if(direct.status!==404||!directBody.includes("'#/'+route"))throw new Error('Direct navigation fallback is not available');

  const index=await fetch(`${origin}${basePath}`).then((response)=>response.text());
  if(!index.includes(`<base href="${basePath}">`))throw new Error('Repository base path is missing from index.html');
  const config=await fetch(`${origin}${basePath}qelly-config.js`).then((response)=>response.text());
  if(!config.includes('"previewLabel":"Static visual preview"')||!config.includes('"backendAvailable":false'))throw new Error('Static preview truth labels are missing');

  console.log(JSON.stringify({
    status:'pages-preview-smoke-passed',
    label:'Static visual preview',
    basePath,
    assets:expected.length,
    directNavigationFallback:true,
    routes:['market','asset-rankings','asset/QI-CRYPTO-BTC','decision-provenance','feature-universe','about-qelly','theme-personas','auth-login']
  },null,2));
}finally{
  await new Promise((resolve,reject)=>server.close((error)=>error?reject(error):resolve()));
}
