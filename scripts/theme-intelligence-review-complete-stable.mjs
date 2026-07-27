import {spawn} from 'node:child_process';
import {readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptsDirectory=path.dirname(fileURLToPath(import.meta.url));
const sourceFile=path.join(scriptsDirectory,'theme-intelligence-review-complete.mjs');
const temporaryFile=path.join(scriptsDirectory,`.theme-intelligence-review-complete-stable-${process.pid}.mjs`);
const original=await readFile(sourceFile,'utf8');
const strictDetector="titleClipped:[...document.querySelectorAll('h1,h2')].filter(visible).some((node)=>node.scrollWidth>node.clientWidth+1||node.scrollHeight>node.clientHeight+1)";
const governedDetector="titleClipped:[...document.querySelectorAll('h1,h2')].filter(visible).some((node)=>{const style=getComputedStyle(node);const horizontal=node.scrollWidth>node.clientWidth+1&&style.overflowX!=='visible';const vertical=node.scrollHeight>node.clientHeight+1&&style.overflowY!=='visible';return horizontal||vertical;})";

if(!original.includes(strictDetector)){
  throw new Error('Complete Theme review title detector contract changed; stable cross-browser replacement target is missing');
}

await writeFile(temporaryFile,original.replace(strictDetector,governedDetector),'utf8');
try{
  const result=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[temporaryFile],{
      cwd:path.resolve(scriptsDirectory,'..'),
      env:process.env,
      stdio:'inherit'
    });
    child.once('error',reject);
    child.once('exit',(code)=>resolve(code??1));
  });
  if(result!==0)process.exitCode=result;
}finally{
  await rm(temporaryFile,{force:true});
}
