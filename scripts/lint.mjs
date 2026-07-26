import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const scanRoots=['apps','src','packages','scripts','.github'];
const excluded=new Set(['node_modules','runtime','dist','.git','preview','__pycache__']);
async function walk(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(excluded.has(entry.name))continue;const full=path.join(dir,entry.name);if(entry.isDirectory())out.push(...await walk(full));else if(/\.(mjs|js|json|html|css|md|ya?ml)$/.test(entry.name))out.push(full);}return out;}
const files=[];for(const rel of scanRoots)files.push(...await walk(path.join(root,rel)));
const findings=[];
for(const file of files){
 const text=await readFile(file,'utf8'),rel=path.relative(root,file).replaceAll('\\','/');
 if(/^(<{7}|={7}|>{7})/m.test(text))findings.push({rel,rule:'merge-marker'});
 if(/\beval\s*\(|new\s+Function\s*\(/.test(text))findings.push({rel,rule:'unsafe-dynamic-code'});
 if(rel.startsWith('apps/web/public/')&&/Release A[1-9]/i.test(text))findings.push({rel,rule:'stale-release-branding'});
 if(rel==='apps/web/public/index.html'&&/<script[^>]+src=["']https?:\/\//i.test(text))findings.push({rel,rule:'remote-script'});
}
const index=await readFile(path.join(root,'apps/web/public/index.html'),'utf8');
if(!index.includes('aria-keyshortcuts="Control+K Meta+K"'))findings.push({rel:'apps/web/public/index.html',rule:'command-shortcut-semantics'});
if(findings.length){console.error(JSON.stringify({status:'lint-failed',findings},null,2));process.exit(1);}
console.log(JSON.stringify({status:'lint-passed',files:files.length},null,2));
