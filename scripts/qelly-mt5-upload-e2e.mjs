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
async function loadFile(page,name,content,mime){
  await page.locator('[data-verify-file]').setInputFiles({name,mimeType:mime,buffer:Buffer.isBuffer(content)?content:Buffer.from(content,'utf8')});
  await page.waitForFunction((filename)=>{
    const status=document.querySelector('[data-verify-status]')?.textContent||'';
    return status.includes(filename)&&!status.includes('Reading')&&document.querySelector('.q-mt5-report');
  },name,{timeout:20000});
  const errors=await page.locator('[data-verify-status].is-error').count();
  assert.equal(errors,0,'upload must not expose an error state');
}
async function scenario(browser,name,viewport){
  const context=await browser.newContext({viewport,reducedMotion:'reduce',acceptDownloads:true});
  const page=await context.newPage(),errors=[],uploads=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',request=>{if(['POST','PUT','PATCH'].includes(request.method())&&/\/api\/v1\/(?:verify|imports|files|storage|analysis)/i.test(new URL(request.url()).pathname))uploads.push({method:request.method(),url:request.url()});});
  const entry={name,viewport,checks:[],errors:[],uploads:[]};
  try{
    await page.goto(origin+'/#/qelly-verify',{waitUntil:'domcontentloaded',timeout:25000});
    await page.locator('[data-verify-file]').waitFor({state:'attached',timeout:30000});
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
    await loadFile(page,'two-deals.html',html(2),'text/html');
    assert.equal(await page.locator('.q-verify-mt5-only').count(),1);
    assert.equal(await page.locator('.q-verify-score-grid .q-verify-score').count(),0);
    assert.match(await page.locator('.q-mt5-report').innerText(),/LIMITED SAMPLE/);
    entry.checks.push('two-deal descriptive-only state without fabricated heuristic scoring');
    await page.locator('[data-verify-sample]').click();
    await page.locator('.q-verify-score-grid .q-verify-score').first().waitFor({state:'visible',timeout:20000});
    assert.equal(await page.locator('.q-mt5-report').count(),0);
    entry.checks.push('existing CSV sample remains unaffected');
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
