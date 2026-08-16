import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assetsRoot=path.join(root,'apps/web/public/assets');

async function browserSources(directory){
  const output=[];
  for(const entry of await readdir(directory)){
    const full=path.join(directory,entry);
    const info=await stat(full);
    if(info.isDirectory())output.push(...await browserSources(full));
    else if(/\.(?:mjs|js)$/i.test(entry))output.push(full);
  }
  return output;
}

test('browser asset runtime does not load JavaScript from general-purpose third-party CDNs',async()=>{
  const files=await browserSources(assetsRoot);
  const forbiddenHost=/https?:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|esm\.sh|skypack\.dev)\//i;
  const externalScriptAssignment=/(?:createElement\(['"]script['"]\)[\s\S]{0,800}|\bscript\b[\s\S]{0,300})\.src\s*=\s*['"]https?:\/\//i;
  const failures=[];
  for(const file of files){
    const source=await readFile(file,'utf8');
    if(forbiddenHost.test(source)||externalScriptAssignment.test(source))failures.push(path.relative(root,file));
  }
  assert.deepEqual(failures,[],`Unapproved browser runtime script loaders found: ${failures.join(', ')}`);
});

test('production CSP keeps first-party JavaScript as the default execution boundary',async()=>{
  const headers=await readFile(path.join(root,'apps/web/public/_headers'),'utf8');
  const csp=headers.match(/Content-Security-Policy:\s*([^\n]+)/)?.[1]||'';
  const scriptDirective=csp.split(';').map((value)=>value.trim()).find((value)=>value.startsWith('script-src '));
  assert.equal(scriptDirective,"script-src 'self'");
  assert.doesNotMatch(scriptDirective,/'unsafe-inline'|'unsafe-eval'/);
});
