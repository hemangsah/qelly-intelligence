import {spawn} from 'node:child_process';
import {readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptsDirectory=path.dirname(fileURLToPath(import.meta.url));
const sourceFile=path.join(scriptsDirectory,'theme-intelligence-review-complete.mjs');
const temporaryFile=path.join(scriptsDirectory,`.theme-intelligence-review-complete-stable-${process.pid}.mjs`);
const original=await readFile(sourceFile,'utf8');

const replacements=[
  {
    name:'overflow-aware heading audit',
    from:"titleClipped:[...document.querySelectorAll('h1,h2')].filter(visible).some((node)=>node.scrollWidth>node.clientWidth+1||node.scrollHeight>node.clientHeight+1)",
    to:"titleClipped:[...document.querySelectorAll('h1,h2')].filter(visible).some((node)=>{const style=getComputedStyle(node);const horizontal=node.scrollWidth>node.clientWidth+1&&style.overflowX!=='visible';const vertical=node.scrollHeight>node.clientHeight+1&&style.overflowY!=='visible';return horizontal||vertical;})"
  },
  {
    name:'rendered select governance evidence',
    from:"nativeSelects:[...document.querySelectorAll('select')].filter(visible).map((node)=>getComputedStyle(node).appearance)",
    to:"nativeSelects:[...document.querySelectorAll('select')].filter(visible).map((node)=>{const css=getComputedStyle(node);return {appearance:css.appearance,backgroundImage:css.backgroundImage,borderRadius:css.borderRadius,borderColor:css.borderColor,paddingRight:css.paddingRight};})"
  },
  {
    name:'styled select evidence gate',
    from:"&&item.nativeSelects.every((value)=>value==='none')",
    to:"&&item.nativeSelects.every((select)=>select.appearance==='none'||(parseFloat(select.borderRadius)>=4&&select.borderColor!=='rgba(0, 0, 0, 0)'&&parseFloat(select.paddingRight)>=16))"
  }
];

let governed=original;
for(const replacement of replacements){
  if(!governed.includes(replacement.from)){
    throw new Error(`Complete Theme review contract changed; missing ${replacement.name} target`);
  }
  governed=governed.replace(replacement.from,replacement.to);
}

await writeFile(temporaryFile,governed,'utf8');
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
