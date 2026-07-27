import { createServer } from 'node:http';
import { cp,mkdir,readFile,readdir,rm,stat,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'.font-review');
const fontOut=path.join(out,'fonts');
const origin='http://127.0.0.1:4184';
const candidates=[
  {id:'plex',label:'IBM Plex Sans Variable',family:'IBM Plex Sans Candidate',pkg:'@fontsource-variable/ibm-plex-sans',slug:'ibm-plex-sans'},
  {id:'manrope',label:'Manrope Variable',family:'Manrope Candidate',pkg:'@fontsource-variable/manrope',slug:'manrope'},
  {id:'jakarta',label:'Plus Jakarta Sans Variable',family:'Jakarta Candidate',pkg:'@fontsource-variable/plus-jakarta-sans',slug:'plus-jakarta-sans'}
];
const types={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.woff2':'font/woff2'};
const esc=(value)=>String(value).replace(/[&<>"']/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

async function localFont(candidate){
  const directory=path.join(root,'node_modules',candidate.pkg,'files');
  const files=await readdir(directory);
  const exact=`${candidate.slug}-latin-wght-normal.woff2`;
  const name=files.includes(exact)?exact:files.find((file)=>file.endsWith('latin-wght-normal.woff2')&&!file.includes('latin-ext'));
  if(!name)throw new Error(`Latin variable WOFF2 missing for ${candidate.pkg}`);
  const target=path.join(fontOut,`${candidate.id}.woff2`);
  await cp(path.join(directory,name),target);
  return {...candidate,file:name,bytes:(await stat(target)).size};
}

function specimen(item,{current=false,selected=false,licensed=false}={}){
  const fontClass=current?'font-current':licensed?'font-licensed':`font-${item.id}`;
  const status=current?'Rejected unbundled stack':licensed?'Commercial reference · not rendered':selected?'Final legal production system':'OFL variable candidate';
  return `<article class="candidate ${fontClass} ${selected?'is-selected':''} ${licensed?'is-licensed':''}"><header><p>${status}</p><h2>${esc(item.label)}</h2><span>${esc(current?'Inter → Geist → platform fallback':licensed?'GT Eesti web licence and licensed WOFF2 files required':item.pkg+' 5.2.8')}</span></header><div class="roles"><section><small>Page title</small><h3>Global Market Intelligence</h3></section><section><small>Section title</small><h4>Asset rankings</h4></section><section><small>Metric</small><strong>$2.41T</strong><em>Market capitalization · +1.84%</em></section><section><small>Body</small><p>Evidence-backed market discovery with deterministic observations, visible provenance and explicit freshness.</p></section><section><small>Button and tab</small><div class="controls"><button>Open research</button><button>Derivatives</button></div></section><section><small>Table header and row</small><div class="thead"><span>Asset</span><span>Price</span><span>24h</span></div><div class="trow"><b>Bitcoin <i>BTC</i></b><span>$64,466.72</span><em>+1.84%</em></div></section><section><small>Command result</small><div class="command"><span>⌘</span><div><b>Open Asset Rankings</b><i>Markets · navigation</i></div><kbd>⌥2</kbd></div></section><section><small>Mobile title</small><h5>Markets, ranked clearly.</h5></section></div></article>`;
}

function page(fonts,{selected=false}={}){
  const faces=fonts.map((font)=>`@font-face{font-family:"${font.family}";src:url('./fonts/${font.id}.woff2') format('woff2-variations');font-style:normal;font-weight:100 700;font-display:block}`).join('');
  const current={label:'Current rejected fallback'};
  const licensed={label:'GT Eesti Pro Display + Text'};
  const cards=[specimen(current,{current:true}),specimen(licensed,{licensed:true}),...fonts.map((font)=>specimen(font)),...(selected?[specimen(fonts[0],{selected:true})]:[])];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Qelly typography comparison</title><style>${faces}
:root{color-scheme:dark;--c:#070507;--s:#0f0d10;--p:#141116;--i:#1a171d;--t:#f6f2f4;--m:#8c8388;--b:#c8c0c4;--l:rgba(255,255,255,.065);--g:#52d1a1;--a:#8e1d4b}*{box-sizing:border-box}body{margin:0;background:var(--c);color:var(--t);font-family:system-ui,sans-serif}main{padding:32px;max-width:2500px;margin:auto}.head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:22px}.head p{margin:0 0 6px;color:var(--m);font-size:12px}.head h1{margin:0;font-size:42px;letter-spacing:-.04em;line-height:1.03;font-weight:620}.head aside{max-width:820px;color:var(--b);font-size:14px;line-height:1.55}.grid{display:grid;grid-template-columns:repeat(${selected?6:5},minmax(0,1fr));gap:12px}.candidate{min-width:0;border-radius:20px;overflow:hidden;background:var(--s);box-shadow:inset 0 0 0 1px var(--l);font-synthesis:none}.font-current{font-family:Inter,Geist,system-ui,sans-serif}.font-licensed{font-family:Arial,"Helvetica Neue",sans-serif;opacity:.72}.font-plex{font-family:"IBM Plex Sans Candidate",Arial,"Helvetica Neue",sans-serif}.font-manrope{font-family:"Manrope Candidate",system-ui,sans-serif}.font-jakarta{font-family:"Jakarta Candidate",system-ui,sans-serif}.candidate.is-selected{box-shadow:inset 0 0 0 1px rgba(142,29,75,.65),0 0 0 3px rgba(142,29,75,.12)}.candidate.is-licensed{background:repeating-linear-gradient(135deg,var(--s),var(--s) 14px,#121014 14px,#121014 28px)}.candidate header{padding:18px;background:var(--p);min-height:100px}.candidate header p{margin:0 0 6px;color:var(--m);font-size:11px}.candidate header h2{margin:0;font-size:20px;letter-spacing:-.02em;font-weight:600}.candidate header span{display:block;margin-top:7px;color:var(--m);font:10px ui-monospace,monospace}.roles section{padding:14px 17px;border-top:1px solid rgba(255,255,255,.045);min-height:82px}.roles small{display:block;margin-bottom:8px;color:var(--m);font-size:10px;font-weight:510}.roles h3,.roles h4,.roles h5,.roles p{margin:0}.roles h3{font-size:30px;line-height:1.04;letter-spacing:-.038em;font-weight:610}.roles h4{font-size:23px;letter-spacing:-.024em;font-weight:590}.roles strong{display:block;font-size:32px;line-height:1;font-weight:620;letter-spacing:-.028em;font-variant-numeric:tabular-nums}.roles>section>em{display:block;margin-top:7px;color:var(--g);font-size:12px;font-style:normal}.roles p{color:var(--b);font-size:14.5px;line-height:1.52;font-weight:420}.controls{display:flex;gap:8px}.controls button{height:36px;border:0;border-radius:10px;padding:0 12px;background:var(--i);color:var(--t);font:540 12px inherit}.controls button+button{background:transparent;color:var(--b)}.thead,.trow{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center}.thead{color:var(--m);font-size:12px;font-weight:570}.trow{margin-top:8px;color:var(--b);font-size:13.5px;font-variant-numeric:tabular-nums}.trow b{color:var(--t);font-weight:520}.trow i{color:var(--m);font-size:10px;font-style:normal}.trow em{color:var(--g);font-style:normal}.command{display:grid;grid-template-columns:31px minmax(0,1fr) auto;align-items:center;gap:9px;padding:9px;border-radius:10px;background:var(--i)}.command>span{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.05)}.command div{display:grid;gap:2px}.command b{font-size:13px;font-weight:560}.command i{color:var(--m);font-size:10.5px;font-style:normal}.command kbd{padding:4px 6px;border-radius:7px;background:rgba(255,255,255,.055);color:var(--m);font:10px inherit}.roles h5{font-size:26px;line-height:1.07;letter-spacing:-.032em;font-weight:600}@media(max-width:1700px){.grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:900px){main{padding:16px}.head{display:block}.head aside{margin-top:12px}.grid{grid-template-columns:1fr}}</style></head><body><main><header class="head"><div><p>PR #11 · source-informed typography correction</p><h1>${selected?'Final legal selection after comparison':'Font references and variable candidates before selection'}</h1></div><aside>${selected?'IBM Plex Sans Variable is selected for every Qelly text role. GT Eesti remains a clearly labelled commercial reference and is not loaded, copied or simulated. Semantic SVG icons remain the Qelly icon system.':'The GT Eesti card is a licence gate, not a rendered specimen. All actual candidates use identical semantic roles and local OFL WOFF2 files.'}</aside></header><section class="grid">${cards.join('')}</section></main></body></html>`;
}

function server(){
  return new Promise((resolve,reject)=>{
    const instance=createServer(async(request,response)=>{
      try{
        const url=new URL(request.url??'/',origin);
        let relative=url.pathname.replace(/^\//,'');if(!relative||relative.endsWith('/'))relative+='candidate-board.html';
        const file=path.resolve(out,decodeURIComponent(relative));if(file!==out&&!file.startsWith(`${out}${path.sep}`))throw new Error('unsafe');
        const body=await readFile(file);response.writeHead(200,{'Cache-Control':'no-store','Content-Type':types[path.extname(file)]??'application/octet-stream'});response.end(body);
      }catch{response.writeHead(404);response.end('Not found');}
    });
    instance.once('error',reject);instance.listen(4184,'127.0.0.1',()=>resolve(instance));
  });
}

await rm(out,{recursive:true,force:true});await mkdir(fontOut,{recursive:true});
const fonts=[];for(const candidate of candidates)fonts.push(await localFont(candidate));
await writeFile(path.join(out,'candidate-board.html'),page(fonts),'utf8');
await writeFile(path.join(out,'selected-board.html'),page(fonts,{selected:true}),'utf8');
const instance=await server();let browser;
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:2300,height:1080},colorScheme:'dark'});
  const candidatePage=await context.newPage();await candidatePage.goto(`${origin}/candidate-board.html`,{waitUntil:'networkidle'});await candidatePage.evaluate(()=>document.fonts.ready);
  await candidatePage.screenshot({path:path.join(out,'font-candidate-board-before-selection.png'),fullPage:true,animations:'disabled'});
  const selectedPage=await context.newPage();await selectedPage.goto(`${origin}/selected-board.html`,{waitUntil:'networkidle'});await selectedPage.evaluate(()=>document.fonts.ready);
  const loaded=await selectedPage.evaluate(()=>[...document.fonts].map((font)=>({family:font.family.replaceAll('"',''),weight:font.weight,status:font.status})));
  const checks=Object.fromEntries(candidates.map((candidate)=>[candidate.id,loaded.some((font)=>font.family===candidate.family&&font.status==='loaded')]));
  if(!Object.values(checks).every(Boolean))throw new Error(`Candidate font check failed ${JSON.stringify({checks,loaded})}`);
  await selectedPage.screenshot({path:path.join(out,'font-final-selection-board.png'),fullPage:true,animations:'disabled'});
  await writeFile(path.join(out,'FONT_BOARD_LOAD_RESULT.json'),`${JSON.stringify({result:'passed',sequence:['candidate-board-before-selection','final-selection-after-comparison'],checks,loaded,candidates:fonts.map(({id,label,pkg,file,bytes})=>({id,label,pkg,file,bytes})),selected:{ui:'IBM Plex Sans Variable',evidence:'IBM Plex Sans Variable',license:'OFL-1.1'},commercialReference:{family:'GT Eesti Pro Display + Text',active:false,reason:'Qelly web licence and licensed WOFF2 files required'},icons:'semantic-inline-svg'},null,2)}\n`,'utf8');
  await context.close();
  console.log(JSON.stringify({status:'font-comparison-board-passed',checks,candidates:fonts.map(({label,bytes})=>({label,bytes})),selected:'IBM Plex Sans Variable',commercialReferenceActive:false},null,2));
}finally{
  if(browser)await browser.close();
  await new Promise((resolve,reject)=>instance.close((error)=>error?reject(error):resolve()));
}
