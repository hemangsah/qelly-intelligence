import { createServer } from 'node:http';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist/frontend');
const output=path.join(root,'.font-review');
const fonts=path.join(output,'fonts');
const host='127.0.0.1';
const port=Number(process.env.QELLY_FONT_REVIEW_PORT??4184);
const origin=`http://${host}:${port}`;
const appUrl=`${origin}/qelly-intelligence/#/asset-rankings`;
const boardUrl=`${origin}/font-comparison.html`;

const candidates=[
  {
    id:'geist',label:'Geist Sans Variable',family:'Geist Sans Candidate',source:'@fontsource-variable/geist 5.2.8',
    url:'https://cdn.jsdelivr.net/npm/@fontsource-variable/geist@5.2.8/files/geist-latin-wght-normal.woff2'
  },
  {
    id:'manrope',label:'Manrope Variable',family:'Manrope Candidate',source:'@fontsource-variable/manrope 5.2.8',
    url:'https://cdn.jsdelivr.net/npm/@fontsource-variable/manrope@5.2.8/files/manrope-latin-wght-normal.woff2'
  },
  {
    id:'jakarta',label:'Plus Jakarta Sans Variable',family:'Plus Jakarta Candidate',source:'@fontsource-variable/plus-jakarta-sans 5.2.8',
    url:'https://cdn.jsdelivr.net/npm/@fontsource-variable/plus-jakarta-sans@5.2.8/files/plus-jakarta-sans-latin-wght-normal.woff2'
  }
];

const types={'.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};

async function download(url,file){
  const response=await fetch(url,{redirect:'follow'});
  if(!response.ok)throw new Error(`Font download failed (${response.status}) ${url}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<10_000)throw new Error(`Font payload too small (${bytes.length}) ${url}`);
  await writeFile(file,bytes);
  return bytes.length;
}

function escapeHtml(value){return String(value).replace(/[&<>"']/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));}

function specimenCard({id,label,family,source,current=false}){
  const style=current?'Inter, Geist, "IBM Plex Sans", "Noto Sans Devanagari", system-ui, sans-serif':`"${family}", system-ui, sans-serif`;
  return `<article class="candidate" data-candidate="${id}" style="--candidate-font:${style}">
    <header><div><p>${current?'Current rendered stack':'Legal variable candidate'}</p><h2>${escapeHtml(label)}</h2></div><span>${escapeHtml(source)}</span></header>
    <div class="specimens">
      <section class="role role-title"><small>Page title</small><strong>Global Market Intelligence</strong></section>
      <section class="role role-section"><small>Section title</small><strong>Asset rankings</strong></section>
      <section class="role role-metric"><small>Metric</small><strong>$2.41T</strong><span>Market capitalization · +1.84%</span></section>
      <section class="role role-body"><small>Body</small><p>Evidence-backed market discovery with deterministic observations, visible provenance and explicit freshness.</p></section>
      <section class="role role-controls"><small>Controls</small><div><button>Open research</button><button class="tab">Derivatives</button></div></section>
      <section class="role role-table"><small>Table header and row</small><div class="table-head"><span>Asset</span><span>Price</span><span>24h</span></div><div class="table-row"><b>Bitcoin <i>BTC</i></b><span>$64,466.72</span><em>+1.84%</em></div></section>
      <section class="role role-command"><small>Command result</small><div class="command"><span class="command-icon">⌘</span><span><b>Open Asset Rankings</b><i>Markets · navigation</i></span><kbd>⌥2</kbd></div></section>
      <section class="role role-mobile"><small>Mobile title</small><strong>Markets, ranked clearly.</strong></section>
    </div>
  </article>`;
}

function boardHtml(fontSizes){
  const faces=candidates.map((item)=>`@font-face{font-family:"${item.family}";src:url('./fonts/${item.id}.woff2') format('woff2-variations');font-style:normal;font-weight:100 900;font-display:swap}`).join('\n');
  const cards=[
    specimenCard({id:'current',label:'Current rejected fallback stack',source:'Inter → Geist → IBM Plex Sans → system-ui',current:true}),
    ...candidates.map(specimenCard),
    `<article class="candidate is-selection" data-candidate="pending"><header><div><p>Selection gate</p><h2>Final font pending review</h2></div><span>Choose only after this board is inspected</span></header><div class="selection-copy"><strong>No final font has been applied.</strong><p>The selected family must improve hierarchy, table legibility, command-palette tone and mobile rhythm without adding a third visible family.</p><dl><div><dt>Runtime target</dt><dd>One variable sans</dd></div><div><dt>Metadata target</dt><dd>One variable mono</dd></div><div><dt>Font loading</dt><dd>Self-hosted WOFF2</dd></div></dl></div></article>`
  ];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Qelly font comparison board</title><style>
${faces}
:root{color-scheme:dark;--canvas:#070507;--surface:#0f0d10;--panel:#131116;--interactive:#19161c;--text:#f7f4f6;--secondary:#c1b9bd;--muted:#887f84;--line:rgba(255,255,255,.07);--accent:#8e1d4b;--positive:#55d2a2}*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--text);font-family:system-ui,sans-serif}main{width:min(1880px,100%);margin:0 auto;padding:34px}.board-head{display:flex;align-items:flex-end;justify-content:space-between;gap:30px;margin-bottom:24px}.board-head p{margin:0 0 8px;color:var(--muted);font-size:12px}.board-head h1{margin:0;font-size:40px;line-height:1.05;letter-spacing:-.035em;font-weight:620}.board-head aside{max-width:620px;color:var(--secondary);font-size:14px;line-height:1.55}.grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;align-items:stretch}.candidate{min-width:0;overflow:hidden;border-radius:20px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--line);font-family:var(--candidate-font);font-optical-sizing:auto;font-synthesis:none}.candidate>header{min-height:94px;padding:18px 18px 15px;background:var(--panel)}.candidate>header p{margin:0 0 6px;color:var(--muted);font-size:11px;letter-spacing:.04em}.candidate>header h2{margin:0;font-size:19px;line-height:1.15;letter-spacing:-.018em;font-weight:600}.candidate>header>span{display:block;margin-top:9px;color:var(--muted);font:10px/1.35 ui-monospace,monospace}.specimens{display:grid}.role{min-height:84px;padding:15px 18px;border-top:1px solid rgba(255,255,255,.045)}.role>small{display:block;margin-bottom:9px;color:var(--muted);font-size:10px;font-weight:520}.role-title strong{font-size:29px;line-height:1.05;letter-spacing:-.035em;font-weight:610}.role-section strong{font-size:23px;line-height:1.1;letter-spacing:-.022em;font-weight:590}.role-metric strong{display:block;font-size:31px;line-height:1;font-weight:620;letter-spacing:-.025em;font-variant-numeric:tabular-nums}.role-metric span{display:block;margin-top:7px;color:var(--positive);font-size:12px}.role-body p{margin:0;color:var(--secondary);font-size:14px;line-height:1.52;font-weight:420}.role-controls div{display:flex;gap:8px}.role-controls button{height:35px;padding:0 12px;border:0;border-radius:10px;background:var(--interactive);color:var(--text);font:540 12px var(--candidate-font)}.role-controls .tab{background:transparent;color:var(--secondary)}.table-head,.table-row{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:10px}.table-head{color:var(--muted);font-size:11.5px;font-weight:570}.table-row{margin-top:8px;color:var(--secondary);font-size:13.5px;font-variant-numeric:tabular-nums}.table-row b{color:var(--text);font-weight:520}.table-row i{color:var(--muted);font-size:10px;font-style:normal}.table-row em{color:var(--positive);font-style:normal}.command{display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:10px;padding:9px;border-radius:10px;background:var(--interactive)}.command-icon{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.05);color:var(--secondary)}.command>span:nth-child(2){display:grid;gap:3px}.command b{font-size:13px;font-weight:560}.command i{color:var(--muted);font-size:10.5px;font-style:normal}.command kbd{padding:4px 6px;border-radius:7px;background:rgba(255,255,255,.055);color:var(--muted);font:10px ui-monospace,monospace}.role-mobile strong{font-size:25px;line-height:1.08;letter-spacing:-.03em;font-weight:600}.is-selection{font-family:system-ui,sans-serif;background:#0b090b}.selection-copy{padding:22px}.selection-copy>strong{font-size:22px;line-height:1.15}.selection-copy p{color:var(--secondary);font-size:14px;line-height:1.55}.selection-copy dl{display:grid;gap:8px;margin-top:26px}.selection-copy dl div{display:flex;justify-content:space-between;gap:10px;padding:11px 0;border-top:1px solid var(--line)}.selection-copy dt{color:var(--muted);font-size:11px}.selection-copy dd{margin:0;color:var(--secondary);font-size:12px}@media(max-width:1500px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.is-selection{grid-column:span 2}}@media(max-width:760px){main{padding:18px}.board-head{display:block}.board-head aside{margin-top:14px}.grid{grid-template-columns:1fr}.is-selection{grid-column:auto}}
</style></head><body><main><header class="board-head"><div><p>PR #11 · typography correction · selection evidence</p><h1>Qelly variable-font comparison</h1></div><aside>Every candidate is rendered with the same semantic roles and optical targets. The current stack is intentionally left unresolved to expose its fallback dependence. Candidate payload sizes: ${fontSizes.map((item)=>`${item.label} ${Math.round(item.bytes/1024)} kB`).join(' · ')}.</aside></header><section class="grid">${cards.join('')}</section></main></body></html>`;
}

function safePath(rootDirectory,relative){
  const file=path.resolve(rootDirectory,relative);
  return file===rootDirectory||file.startsWith(`${rootDirectory}${path.sep}`)?file:null;
}

function startServer(){
  const server=createServer(async(request,response)=>{
    try{
      const url=new URL(request.url??'/',origin);
      let sourceRoot;let relative;
      if(url.pathname.startsWith('/qelly-intelligence/')){sourceRoot=dist;relative=url.pathname.slice('/qelly-intelligence/'.length);}
      else{sourceRoot=output;relative=url.pathname.replace(/^\//,'');}
      if(!relative||relative.endsWith('/'))relative+='index.html';
      const file=safePath(sourceRoot,decodeURIComponent(relative));
      if(!file)throw new Error('Unsafe path');
      const body=await readFile(file);
      response.writeHead(200,{'Cache-Control':'no-store','Content-Type':types[path.extname(file)]??'application/octet-stream'});response.end(body);
    }catch{response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});response.end('Not found');}
  });
  return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>resolve(server));});
}

async function currentAudit(browser){
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,colorScheme:'dark'});
  const page=await context.newPage();
  await page.addInitScript(()=>{
    window.__qellyLayoutShifts=[];
    new PerformanceObserver((list)=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)window.__qellyLayoutShifts.push(entry.value);}).observe({type:'layout-shift',buffered:true});
  });
  await page.goto(appUrl,{waitUntil:'networkidle'});
  await page.locator('.q-mi-page').waitFor({state:'visible'});
  await page.evaluate(async()=>{if(document.fonts?.ready)await document.fonts.ready;await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  const computed=await page.evaluate(()=>{
    const sample=(selector)=>{const element=document.querySelector(selector);if(!element)return null;const style=getComputedStyle(element);return {selector,fontFamily:style.fontFamily,fontSize:style.fontSize,fontWeight:style.fontWeight,lineHeight:style.lineHeight,letterSpacing:style.letterSpacing,fontVariantNumeric:style.fontVariantNumeric,borderRadius:style.borderRadius,borderColor:style.borderColor,backgroundColor:style.backgroundColor};};
    const visible=[...document.querySelectorAll('body *')].filter((element)=>{const rect=element.getBoundingClientRect(),style=getComputedStyle(element);return rect.width>1&&rect.height>1&&style.display!=='none'&&style.visibility!=='hidden';});
    const panelLike=visible.filter((element)=>/(card|panel|module|pulse|toolbar|banner|rail|dialog|sheet|drawer)/i.test(String(element.className??'')));
    const bordered=(elements)=>elements.filter((element)=>{const style=getComputedStyle(element);return ['Top','Right','Bottom','Left'].some((side)=>parseFloat(style[`border${side}Width`])>0&&style[`border${side}Style`]!=='none');});
    const radii=visible.map((element)=>getComputedStyle(element).borderRadius).filter((value)=>value&&value!=='0px');
    const weights=visible.map((element)=>getComputedStyle(element).fontWeight).filter(Boolean);
    return {
      generatedAt:new Date().toISOString(),
      declaredStack:getComputedStyle(document.body).fontFamily,
      fontChecks:{Inter:document.fonts.check('16px Inter'),Geist:document.fonts.check('16px Geist'),IBM_Plex_Sans:document.fonts.check('16px "IBM Plex Sans"')},
      loadedFontFaces:[...document.fonts].map((font)=>({family:font.family,style:font.style,weight:font.weight,status:font.status})),
      fontResources:performance.getEntriesByType('resource').filter((entry)=>/\.(?:woff2?|ttf|otf)(?:\?|$)/i.test(entry.name)).map((entry)=>({name:entry.name,transferSize:entry.transferSize,duration:Math.round(entry.duration)})),
      samples:['body','.q-mi-page-head h1','.q-mi-page-head p','.q-mi-market-pulse strong','.q-mi-table-scroll th','.q-mi-table-scroll td','.q-command-trigger'].map(sample),
      visibleElements:visible.length,
      borderedElements:bordered(visible).length,
      panelLikeElements:panelLike.length,
      borderedPanelLikeElements:bordered(panelLike).length,
      radiusFrequency:Object.entries(radii.reduce((map,value)=>(map[value]=(map[value]??0)+1,map),{})).sort((left,right)=>right[1]-left[1]),
      weightFrequency:Object.entries(weights.reduce((map,value)=>(map[value]=(map[value]??0)+1,map),{})).sort((left,right)=>right[1]-left[1]),
      layoutShiftValues:window.__qellyLayoutShifts??[],
      documentOverflow:document.documentElement.scrollWidth>innerWidth+1,
      tableTop:Math.round(document.querySelector('.q-mi-table-card')?.getBoundingClientRect().top??-1),
      tableInFirstViewport:(document.querySelector('.q-mi-table-card')?.getBoundingClientRect().top??Infinity)<innerHeight
    };
  });
  await page.screenshot({path:path.join(output,'current-rejected-desktop.png'),fullPage:false,animations:'disabled'});
  await context.close();
  return computed;
}

await rm(output,{recursive:true,force:true});
await mkdir(fonts,{recursive:true});
const fontSizes=[];
for(const candidate of candidates){fontSizes.push({...candidate,bytes:await download(candidate.url,path.join(fonts,`${candidate.id}.woff2`))});}
await writeFile(path.join(output,'font-comparison.html'),boardHtml(fontSizes),'utf8');
const server=await startServer();
let browser;
try{
  browser=await chromium.launch({headless:true});
  const computed=await currentAudit(browser);
  await writeFile(path.join(output,'CURRENT_TYPOGRAPHY_COMPUTED.json'),`${JSON.stringify({...computed,candidatePayloads:fontSizes.map(({id,label,source,url,bytes})=>({id,label,source,url,bytes}))},null,2)}\n`,'utf8');
  await writeFile(path.join(output,'CURRENT_TYPOGRAPHY_AUDIT.md'),`# Current typography audit\n\nStatus: rejected baseline measured before final font selection.\n\n- Declared body stack: \`${computed.declaredStack}\`.\n- Bundled/loaded font resources: ${computed.fontResources.length}.\n- Inter available: ${computed.fontChecks.Inter}.\n- Geist available: ${computed.fontChecks.Geist}.\n- IBM Plex Sans available: ${computed.fontChecks.IBM_Plex_Sans}.\n- Panel-like elements with visible borders: ${computed.borderedPanelLikeElements}/${computed.panelLikeElements}.\n- Layout-shift total during capture: ${computed.layoutShiftValues.reduce((total,value)=>total+value,0).toFixed(4)}.\n\nThe comparison board is evidence for the next selection step. It does not self-approve a final font.\n`,'utf8');
  const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,colorScheme:'dark'});
  const page=await context.newPage();
  await page.goto(boardUrl,{waitUntil:'networkidle'});
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  const loaded=await page.evaluate(()=>({fonts:[...document.fonts].map((font)=>({family:font.family,weight:font.weight,status:font.status})),checks:{geist:document.fonts.check('16px "Geist Sans Candidate"'),manrope:document.fonts.check('16px "Manrope Candidate"'),jakarta:document.fonts.check('16px "Plus Jakarta Candidate"')}}));
  if(!loaded.checks.geist||!loaded.checks.manrope||!loaded.checks.jakarta)throw new Error(`Candidate font loading failed: ${JSON.stringify(loaded)}`);
  await writeFile(path.join(output,'FONT_BOARD_LOAD_RESULT.json'),`${JSON.stringify(loaded,null,2)}\n`,'utf8');
  await page.screenshot({path:path.join(output,'font-comparison-board.png'),fullPage:true,animations:'disabled'});
  await context.close();
  console.log(JSON.stringify({status:'font-comparison-board-passed',output:path.relative(root,output),candidates:fontSizes.map(({label,bytes})=>({label,bytes})),baseline:computed},null,2));
}finally{
  if(browser)await browser.close();
  await new Promise((resolve,reject)=>server.close((error)=>error?reject(error):resolve()));
}
