import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {startServer} from './release-a5-evidence-server.mjs';

const out=path.resolve('preview/mt5-upload-e2e');
await mkdir(out,{recursive:true});
const server=await startServer({port:0,host:'127.0.0.1'});
const origin='http://127.0.0.1:'+server.port;
let browser;
const results=[];
const header='<tr><th>Time</th><th>Deal</th><th>Symbol</th><th>Type</th><th>Direction</th><th>Commission</th><th>Fee</th><th>Swap</th><th>Profit</th></tr>';
const deal=(i,profit)=>'<tr>'+['2026.10.'+String(i).padStart(2,'0')+' 11:30',String(i),'EURUSD',i%2?'buy':'sell','out','-0.1','0','0',String(profit)].map(x=>'<td>'+x+'</td>').join('')+'</tr>';
const html=n=>'<html><body><table>'+header+Array.from({length:n},(_,i)=>deal(i+1,i%3?-2:4)).join('')+'</table><script>window.__qellyMt5UploadXss=true</script></body></html>';
const crc32=value=>{let c=0xffffffff;for(const b of value){c^=b;for(let n=0;n<8;n++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}return(c^0xffffffff)>>>0;};
function zip(entries){
  const local=[],central=[];let offset=0;
  for(const [name,body] of entries){
    const file=Buffer.from(body),filename=Buffer.from(name),crc=crc32(file),l=Buffer.alloc(30),c=Buffer.alloc(46);
    l.writeUInt32LE(0x04034b50,0);l.writeUInt16LE(20,4);l.writeUInt32LE(crc,14);l.writeUInt32LE(file.length,18);l.writeUInt32LE(file.length,22);l.writeUInt16LE(filename.length,26);
    local.push(l,filename,file);
    c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(crc,16);c.writeUInt32LE(file.length,20);c.writeUInt32LE(file.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(offset,42);
    central.push(c,filename);offset+=l.length+filename.length+file.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
const sheetRow=(n,cells)=>'<row r="'+n+'">'+cells.map((value,i)=>'<c r="'+String.fromCharCode(65+i)+n+'" t="inlineStr"><is><t>'+String(value)+'</t></is></c>').join('')+'</row>';
const workbook=()=>{
  const headers=['Time','Deal','Symbol','Type','Direction','Commission','Fee','Swap','Profit'];
  const rows=[headers,...Array.from({length:6},(_,i)=>['2026.10.'+String(i+1).padStart(2,'0')+' 11:30',i+1,'EURUSD',i%2?'buy':'sell','out','-0.1',0,0,i%3?-2:4])];
  const xml='<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>'+rows.map((row,i)=>sheetRow(i+1,row)).join('')+'</sheetData></worksheet>';
  return zip([['[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'],['xl/workbook.xml','<workbook><sheets><sheet name="MT5 Deals" sheetId="1" r:id="rId1"/></sheets></workbook>'],['xl/worksheets/sheet1.xml',xml]]);
};
const damagedWorkbook=()=>{const bytes=workbook(),at=bytes.indexOf(Buffer.from('<t>EURUSD</t>'));assert.ok(at>=0);bytes[at+3]='X'.charCodeAt(0);return bytes;};
async function loadFile(page,name,content,mime){
  await page.locator('[data-verify-file]').setInputFiles({name,mimeType:mime,buffer:Buffer.isBuffer(content)?content:Buffer.from(content,'utf8')});
  await page.waitForFunction((filename)=>{
    const status=document.querySelector('[data-verify-status]')?.textContent||'';
    return status.includes(filename)&&!status.includes('Reading')&&document.querySelector('.q-mt5-report');
  },name,{timeout:20000});
  const errors=await page.locator('[data-verify-status].is-error').count();
  assert.equal(errors,0,'upload must not expose an error state');
}
async function verifyThemeSurfaces(page,appearance){
  const switcher=page.getByRole('button',{name:'Switch to '+appearance+' appearance',exact:true});
  if(await page.locator('html').getAttribute('data-resolved-appearance')!==appearance)await switcher.click();
  await page.waitForFunction(value=>document.documentElement.dataset.resolvedAppearance===value,appearance);
  const samples=await page.locator('.q-v53-verify-kpis span,.q-v53-verify-kpis strong,.q-v53-verify-result span,.q-v53-verify-result strong,.q-v53-verify-context-boundary,.q-v53-verify-evidence dt,.q-v53-verify-evidence dd,.q-v53-verify-activity strong,.q-v53-verify-activity span').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length).map(node=>{
    const rgba=value=>value.match(/[\d.]+/g).map(Number);
    const lum=value=>value.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
    const style=getComputedStyle(node);let parent=node,background;
    while(parent){const value=rgba(getComputedStyle(parent).backgroundColor);if((value[3]??1)===1){background=value;break;}parent=parent.parentElement;}
    if(!background)throw new Error('No opaque background for '+node.textContent);
    const fg=lum(rgba(style.color)),bg=lum(background);
    return {text:node.textContent.slice(0,80),ratio:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)};
  }));
  assert.ok(samples.length>=20,'Verify theme test must observe populated formula/evidence surfaces');
  for(const sample of samples)assert.ok(sample.ratio>=4.5,appearance+' '+sample.text+' contrast '+sample.ratio);
  const bounds=await page.locator('.q-v53-verify-primary,.q-v53-verify-columns,.q-v53-verify-inspector').evaluateAll(nodes=>nodes.map(node=>({name:node.className,width:node.clientWidth,overflow:node.scrollWidth-node.clientWidth})));
  for(const item of bounds)assert.ok(item.overflow<=1,item.name+' must not clip content at '+item.width+'px');
  assert.equal(await page.locator('[data-v53-verify-primary] .q-v53-verify-actions a').count(),3);
  await page.screenshot({path:path.join(out,'verify-'+page.viewportSize().width+'-'+appearance+'.png'),fullPage:true});
  return {appearance,minimumContrast:Math.min(...samples.map(x=>x.ratio)),samples:samples.length,bounds};
}

async function scenario(browser,name,viewport){
  const context=await browser.newContext({viewport,reducedMotion:'reduce',acceptDownloads:true});
  const page=await context.newPage(),errors=[],uploads=[],chatPosts=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',request=>{if(['POST','PUT','PATCH'].includes(request.method())&&/\/api\/v1\/(?:verify|imports|files|storage|analysis)/i.test(new URL(request.url()).pathname))uploads.push({method:request.method(),url:request.url()});});
  page.on('request',request=>{if(request.method()==='POST'&&/\/api\/v1\/intelligence\/chat/.test(new URL(request.url()).pathname))chatPosts.push(request.url());});
  const entry={name,viewport,checks:[],errors:[],uploads:[]};
  try{
    await page.goto(origin+'/#/qelly-verify',{waitUntil:'domcontentloaded',timeout:25000});
    await page.locator('[data-verify-file]').waitFor({state:'attached',timeout:30000});
    await page.locator('[data-v53-verify-formula]').waitFor({state:'visible',timeout:30000});
    entry.verifyThemeEvidence=[];
    for(const width of name==='desktop'?[1440,1280]:[390]){
      await page.setViewportSize({width,height:viewport.height});
      for(const appearance of ['light','dark'])entry.verifyThemeEvidence.push({width,...await verifyThemeSurfaces(page,appearance)});
    }
    await page.setViewportSize(viewport);
    if(name==='desktop'){
      const startedWorker=page.waitForEvent('worker',{timeout:10000});
      await page.locator('[data-verify-file]').setInputFiles({name:'verify-background-large.html',mimeType:'text/html',buffer:Buffer.from(html(20000),'utf8')});
      assert.match((await startedWorker).url(),/qelly-verify-analysis-worker.mjs$/);
      const responsive=await page.evaluate(()=>new Promise(resolve=>{
        const started=performance.now();let frames=0,pendingFrames=0;
        const tick=()=>{frames++;if(document.querySelector('#main')?.getAttribute('aria-busy')==='true')pendingFrames++;if(performance.now()-started>=200)resolve({frames,pendingFrames});else requestAnimationFrame(tick);};requestAnimationFrame(tick);
      }));
      assert.ok(responsive.frames>=3,'Verify UI must keep rendering during background processing');
      assert.ok(responsive.pendingFrames>=1,'Verify probe must observe active processing');
      await page.locator('[data-verify-reset]').click();
      await page.waitForTimeout(500);
      assert.equal(await page.locator('.q-verify-report').count(),0);
      assert.equal(await page.locator('[data-verify-export]').count(),0);
      entry.verifyWorkerResponsiveness=responsive;
      entry.checks.push('Verify uses its actual local worker; frame callbacks continue; in-flight clear rejects late report/export');
    }
    await page.locator('[data-v53-verify-formula]').selectOption('compound-interest');
    await page.waitForFunction(()=>document.querySelector('.q-v53-verify-context-list')?.textContent.includes('compound-interest'));
    assert.match(await page.locator('.q-v53-verify-sensitivity').innerText(),/Base/);
    await page.locator('[data-v53-verify-formula]').selectOption('absolute-return');
    await page.waitForFunction(()=>document.querySelector('.q-v53-verify-result strong')?.textContent==='1,800');
    entry.checks.push('Verify formula switching and populated light/dark contrast and unclipped reference/evidence panels at desktop, expanded-navigation width and mobile');
    await loadFile(page,'six-deals.html',html(6),'text/html');
    assert.equal(await page.locator('.q-mt5-chart svg[role="img"]').count(),2);
    assert.equal(await page.locator('.q-verify-score-grid .q-verify-score').count(),3);
    assert.equal(await page.evaluate(()=>window.__qellyMt5UploadXss===true),false);
    assert.equal((await page.locator('.q-mt5-kpi').first().innerText()).includes('Net closed-deal P&L'),true);
    const saved=page.waitForEvent('download',{timeout:15000});
    await page.locator('[data-verify-export]').click();
    const download=await saved,exported=JSON.parse(await readFile(await download.path(),'utf8'));
    assert.equal(exported.mt5ClosedDealAnalysis.sample.deals,6);
    assert.equal(exported.mt5ClosedDealAnalysis.metrics.sharpe,null);
    entry.checks.push('HTML six-deal import, observed charts, general scores, nonexecuted script, safe export');
    await page.screenshot({path:path.join(out,name+'-html.png'),fullPage:true});
    if(name==='desktop'){
      await loadFile(page,'six-deals.xlsx',workbook(),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      assert.equal(await page.locator('.q-mt5-chart svg[role="img"]').count(),2);
      assert.match(await page.locator('.q-verify-report__head').innerText(),/six-deals.xlsx/);
      entry.checks.push('stored XLSX closing-deal import and rendered charts');
      await page.screenshot({path:path.join(out,'desktop-xlsx.png'),fullPage:true});
    }
    await page.locator('[data-verify-file]').setInputFiles({name:'checksum-damaged.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:damagedWorkbook()});
    await page.locator('[data-verify-status].is-error').waitFor({state:'visible',timeout:20000});
    assert.match(await page.locator('[data-verify-status]').innerText(),/checksum does not match/i);
    assert.equal(await page.locator('.q-mt5-report').count(),0);
    await page.screenshot({path:path.join(out,name+'-checksum-rejected.png'),fullPage:true});
    for(const appearance of ['light','dark']){
      const switcher=page.getByRole('button',{name:'Switch to '+appearance+' appearance',exact:true});
      const current=await page.locator('html').getAttribute('data-resolved-appearance');
      if(current!==appearance){
        assert.equal(await switcher.count(),1,'the '+appearance+' appearance control must be available');
        await switcher.click();
      }
      await page.waitForFunction(value=>document.documentElement.dataset.resolvedAppearance===value,appearance);
      const contrast=await page.locator('[data-verify-status].is-error').evaluate(node=>{
        const style=getComputedStyle(node),rgb=value=>value.match(/[\d.]+/g).map(Number);
        const luminance=value=>rgb(value).slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
        const foreground=luminance(style.color),background=luminance(style.backgroundColor);
        return {ratio:(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05),alpha:rgb(style.backgroundColor)[3]??1};
      });
      assert.equal(contrast.alpha,1,'error message must have an opaque theme surface');
      assert.ok(contrast.ratio>=4.5,appearance+' Verify rejection must meet normal-text contrast');
      assert.equal(await page.locator('[data-verify-status].is-error').isVisible(),true);
      await page.screenshot({path:path.join(out,name+'-checksum-rejected-'+appearance+'.png'),fullPage:true});
    }
    entry.checks.push('damaged XLSX checksum is visible and clears previous Verify analysis');
    entry.checks.push('Verify rejection remains visible with >=4.5:1 contrast in light and dark appearance');
    await loadFile(page,'two-deals.html',html(2),'text/html');
    assert.equal(await page.locator('.q-verify-mt5-only').count(),1);
    assert.equal(await page.locator('.q-verify-score-grid .q-verify-score').count(),0);
    assert.match(await page.locator('.q-mt5-report').innerText(),/LIMITED SAMPLE/);
    entry.checks.push('two-deal descriptive-only state without fabricated heuristic scoring');
    await page.locator('[data-mt5-compare-file="A"]').setInputFiles({name:'compare-a.html',mimeType:'text/html',buffer:Buffer.from(html(6),'utf8')});
    await page.waitForFunction(()=>document.querySelector('#q-mt5-compare-status-A')?.textContent?.includes('closing deals'),null,{timeout:20000});
    await page.locator('[data-mt5-compare-file="B"]').setInputFiles({name:'compare-b.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:workbook()});
    await page.locator('[data-mt5-comparison-result]').waitFor({state:'visible',timeout:30000});
    assert.match(await page.locator('[data-mt5-comparison-result]').innerText(),/LIMITED SAMPLE/);
    assert.match(await page.locator('[data-mt5-comparison-result]').innerText(),/Withheld \(currency unverified\)/);
    assert.equal(await page.evaluate(()=>window.__qellyMt5UploadXss===true),false);
    const comparisonSaved=page.waitForEvent('download',{timeout:15000});
    await page.locator('[data-mt5-compare-export]').click();
    const comparisonDownload=await comparisonSaved;
    const comparisonData=JSON.parse(await readFile(await comparisonDownload.path(),'utf8'));
    assert.equal(comparisonData.schema,'qelly.mt5.closed-deal-comparison/1.0');
    assert.equal(comparisonData.comparability.monetaryDeltas,'WITHHELD_UNVERIFIED_CURRENCY');
    assert.equal(comparisonData.privacy.sourceRowsIncluded,false);
    assert.equal(comparisonData.reportA.deals,6);
    assert.equal(comparisonData.reportB.deals,6);
    await page.screenshot({path:path.join(out,name+'-comparison.png'),fullPage:true});
    await page.locator('[data-mt5-compare-reset]').click();
    assert.equal(await page.locator('[data-mt5-comparison-result]').count(),0);
    entry.checks.push('Local HTML+XLSX report comparison, limited-sample suppression, share-safe JSON export, in-memory clear');

    await page.locator('[data-verify-sample]').click();
    await page.locator('.q-verify-score-grid .q-verify-score').first().waitFor({state:'visible',timeout:20000});
    assert.equal(await page.locator('.q-mt5-report').count(),0);
    entry.checks.push('existing CSV sample remains unaffected');
    for(const fixture of [{name:'oversized.html',buffer:Buffer.alloc(5*1024*1024+1),message:/5 MB/},{name:'unsupported.exe',buffer:Buffer.from('unsupported'),message:/Unsupported file type/}]){
      await page.locator('[data-verify-file]').setInputFiles({name:fixture.name,mimeType:'application/octet-stream',buffer:fixture.buffer});
      await page.locator('[data-verify-status].is-error').waitFor({state:'visible',timeout:10000});
      assert.match(await page.locator('[data-verify-status]').innerText(),fixture.message);
      assert.equal(await page.locator('[data-verify-export]').count(),0,'rejected new input clears stale export');
      assert.equal(await page.locator('.q-verify-score-grid').count(),0);
      await page.locator('[data-verify-sample]').click();
      await page.locator('[data-verify-export]').waitFor({state:'visible',timeout:15000});
    }
    // Delay only this synthetic fixture's local File read to reproduce overlap.
    await page.evaluate(()=>{
      const original=File.prototype.text;
      File.prototype.text=async function(){if(this.name==='delayed-deals.html')await new Promise(resolve=>setTimeout(resolve,1200));return original.call(this);};
    });
    await page.locator('[data-verify-file]').setInputFiles({name:'delayed-deals.html',mimeType:'text/html',buffer:Buffer.from(html(6))});
    assert.equal(await page.locator('[data-verify-export]').count(),0,'new read clears previous export immediately');
    await page.locator('[data-verify-file]').setInputFiles({name:'newest-two-deals.html',mimeType:'text/html',buffer:Buffer.from(html(2))});
    await page.locator('.q-verify-mt5-only').waitFor({state:'visible',timeout:15000});
    await page.waitForTimeout(1500);
    assert.match(await page.locator('.q-verify-report__head').innerText(),/newest-two-deals.html/);
    await page.locator('[data-verify-file]').setInputFiles({name:'delayed-deals.html',mimeType:'text/html',buffer:Buffer.from(html(6))});
    await page.locator('[data-verify-reset]').click();
    await page.waitForTimeout(1500);
    assert.equal(await page.locator('[data-verify-export]').count(),0,'clearing an in-flight read invalidates its completion');
    assert.equal(await page.locator('.q-verify-report').count(),0);
    await page.locator('[data-verify-file]').setInputFiles({name:'delayed-deals.html',mimeType:'text/html',buffer:Buffer.from(html(6))});
    await page.evaluate(()=>{location.hash='#/market';});
    await page.locator('[data-v53-verify-primary]').waitFor({state:'detached',timeout:15000});
    await page.waitForTimeout(1500);
    assert.equal(await page.locator('.q-verify-report').count(),0,'late local read must not replace another route');
    await page.evaluate(()=>{location.hash='#/qelly-verify';});
    await page.locator('[data-verify-file]').waitFor({state:'attached',timeout:15000});
    assert.equal(await page.locator('[data-verify-export]').count(),0,'returning to Verify must not restore old local analysis');
    entry.checks.push('oversized/unsupported new input clears stale exports; delayed older read cannot overwrite latest file or another route; route leave clears local report');


    // Wave CZ: exercise the new standalone public tool, its local-only dual
    // import, read-only export, memory cleanup and HTML inertness.
    await page.evaluate(()=>{location.hash='#/mt5-report-analyzer';});
    await page.locator('[data-mt5-route-input="A"]').waitFor({state:'attached',timeout:30000});
    if(name==='desktop'){
      const large=Buffer.from(html(20000));assert.ok(large.length<5*1024*1024);
      const workerStarted=page.waitForEvent('worker',{timeout:15000});
      await page.locator('[data-mt5-route-input="A"]').setInputFiles({name:'large-synthetic.html',mimeType:'text/html',buffer:large});
      const worker=await workerStarted;
      assert.match(worker.url(),/qelly-mt5-analysis-worker.mjs$/);
      const responsiveness=await page.evaluate(()=>new Promise(resolve=>{
        const started=performance.now();let frames=0,readingFrames=0;
        const tick=()=>{frames++;if(document.querySelector('#q-mt5-route-status-A')?.textContent.includes('Parsing'))readingFrames++;if(performance.now()-started>=200)resolve({frames,readingFrames});else requestAnimationFrame(tick);};requestAnimationFrame(tick);
      }));
      assert.ok(responsiveness.frames>=3,'UI frame callbacks must continue during local background analysis');
      assert.ok(responsiveness.readingFrames>=1,'probe must observe analysis still in progress');
      assert.equal(await page.locator('[data-mt5-route-clear="A"]').isEnabled(),true);
      await page.locator('[data-mt5-route-clear="A"]').click();
      await page.waitForTimeout(500);
      assert.equal(await page.locator('.q-mt5-route-primary').count(),0);
      assert.equal(await page.locator('[data-mt5-route-export]').isDisabled(),true);
      entry.checks.push('20,000-deal synthetic file starts local module worker; UI frame callbacks continue; in-flight clear terminates ownership and keeps exports disabled');
      entry.workerResponsiveness=responsiveness;
    }

    await page.locator('[data-mt5-route-input="A"]').setInputFiles({name:'route-a.html',mimeType:'text/html',buffer:Buffer.from(html(6),'utf8')});
    await page.waitForFunction(()=>document.querySelector('#q-mt5-route-status-A')?.textContent?.includes('validated closing deals'),null,{timeout:30000});
    assert.equal(await page.locator('.q-mt5-route-primary .q-mt5-chart svg[role="img"]').count(),2);
    assert.equal(await page.evaluate(()=>window.__qellyMt5UploadXss===true),false);
    await page.locator('[data-mt5-route-input="B"]').setInputFiles({name:'route-b.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:workbook()});
    await page.locator('[data-mt5-comparison-result]').waitFor({state:'visible',timeout:30000});
    const routeSaved=page.waitForEvent('download',{timeout:15000});
    await page.locator('[data-mt5-route-export]').click();
    const routeDownload=await routeSaved;
    const routeData=JSON.parse(await readFile(await routeDownload.path(),'utf8'));
    assert.equal(routeData.schema,'qelly.mt5.share-safe-local/1.1');
    assert.equal(routeData.diagnosticsA.schema,'qelly.mt5.closed-deal-diagnostics/1.0');
    assert.equal(routeData.diagnosticsB.schema,'qelly.mt5.closed-deal-diagnostics/1.0');
    assert.equal(routeData.diagnosticsA.sample.deals,6);
    assert.equal(routeData.diagnosticsB.sample.deals,6);
    assert.equal(routeData.reportA.sample.deals,6);
    assert.equal(routeData.comparison.comparability.monetaryDeltas,'WITHHELD_UNVERIFIED_CURRENCY');
    assert.equal(routeData.privacy.sourceRowsIncluded,false);
    assert.equal(routeData.privacy.accountIdentifiersIncluded,false);
    assert.doesNotMatch(JSON.stringify(routeData),/window.__qellyMt5UploadXss|PRIVATE_PASSWORD/);
    assert.equal(routeData.reportB.sample.deals,6);
    const noteSaved=page.waitForEvent('download',{timeout:15000});
    await page.locator('[data-mt5-route-note]').click();
    const noteDownload=await noteSaved;
    assert.equal(noteDownload.suggestedFilename(),'qelly-mt5-research-note.md');
    const note=await readFile(await noteDownload.path(),'utf8');
    assert.match(note,/^# QELLY MT5 Research Note/m);
    assert.match(note,/## Report A/);
    assert.match(note,/## Report B/);
    assert.match(note,/LIMITED SAMPLE/);
    assert.match(note,/All monetary differences and strategy rankings are withheld/);
    assert.doesNotMatch(note,/route-a\.html|route-b\.xlsx|PRIVATE_PASSWORD/);
    assert.deepEqual(chatPosts,[],'Markdown export must not send a chat request');
    entry.checks.push('local Markdown note is a user-invoked, dual-report, account-redacted download');
    await page.locator('[data-mt5-route-chat]').click();
    await page.locator('[data-q-ai-assistant]:not([hidden])').waitFor({state:'visible',timeout:10000});
    const draft=await page.locator('[data-q-ai-form] textarea').inputValue();
    assert.match(draft,/user-supplied, browser-local MT5 aggregate summary/);
    assert.match(draft,/Report A: 6 realized closing deals/);
    assert.match(draft,/Report B: 6 realized closing deals/);
    assert.equal(draft.length<=2200,true);
    assert.deepEqual(chatPosts,[],'Opening the Chat draft must not send any report data');
    await page.locator('[data-q-ai-close]').click();
    entry.checks.push('explicit aggregate-only MT5 Chat prefill without automatic network submission');
    await page.screenshot({path:path.join(out,name+'-standalone-mt5.png'),fullPage:true});
    await page.locator('[data-mt5-route-input="A"]').setInputFiles({name:'route-checksum-damaged.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:damagedWorkbook()});
    await page.waitForFunction(()=>document.querySelector('#q-mt5-route-status-A')?.textContent?.includes('checksum does not match'),null,{timeout:20000});
    assert.equal(await page.locator('.q-mt5-route-primary').count(),0);
    assert.equal(await page.locator('[data-mt5-comparison-result]').count(),0);
    assert.equal(await page.locator('[data-mt5-route-export]').isDisabled(),true);
    assert.equal(await page.locator('[data-mt5-route-chat]').isDisabled(),true);
    await page.screenshot({path:path.join(out,name+'-standalone-checksum-rejected.png'),fullPage:true});
    entry.checks.push('standalone invalid XLSX clears stale primary/comparison and disables export/Chat');
    await page.locator('[data-mt5-route-reset]').click();
    assert.equal(await page.locator('[data-mt5-route-note]').isDisabled(),true);
    assert.equal(await page.locator('.q-mt5-route-empty').count(),1);
    assert.equal(await page.locator('[data-mt5-comparison-result]').count(),0);
    await page.locator('[data-mt5-route-input="A"]').setInputFiles({name:'route-a.html',mimeType:'text/html',buffer:Buffer.from(html(6),'utf8')});
    await page.waitForFunction(()=>document.querySelector('#q-mt5-route-status-A')?.textContent?.includes('validated closing deals'),null,{timeout:30000});
    await page.evaluate(()=>{location.hash='#/market';});
    await page.locator('[data-mt5-analyzer-route]').waitFor({state:'detached',timeout:30000});
    await page.evaluate(()=>{location.hash='#/mt5-report-analyzer';});
    await page.locator('.q-mt5-route-empty').waitFor({state:'visible',timeout:30000});
    assert.equal(await page.locator('[data-mt5-route-export]').isDisabled(),true);
    assert.equal(await page.locator('[data-mt5-route-note]').isDisabled(),true);
    entry.checks.push('standalone MT5 HTML/XLSX reports, derived export, inert HTML and leave-route data cleanup');
    assert.deepEqual(uploads,[]);
    assert.deepEqual(errors,[]);
    entry.status='passed';
  }catch(e){
    entry.status='failed';entry.errors.push(String(e.stack||e));
    await page.screenshot({path:path.join(out,name+'-failed.png'),fullPage:true}).catch(()=>{});
  }finally{entry.uploads=uploads;entry.errors.push(...errors);results.push(entry);await context.close();}
}
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 await scenario(browser,'desktop',{width:1440,height:1000});
 await scenario(browser,'mobile',{width:390,height:844});
}finally{
 await browser?.close();
 await new Promise(resolve=>server.server.close(resolve));
 await server.evidenceUpstream?.server?.close?.();
}
const report={schema:'qelly.mt5.browser-acceptance/1.0',releaseSha:process.env.QELLY_SCREEN_EVIDENCE_SHA||process.env.GITHUB_SHA||null,fixture:'synthetic-only',results,status:results.length===2&&results.every(x=>x.status==='passed')?'passed':'failed'};
await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.status!=='passed')process.exitCode=1;
