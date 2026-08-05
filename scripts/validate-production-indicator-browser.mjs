import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const base=String(process.env.QELLY_RESTORATION_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const width=Number(process.env.QELLY_BROWSER_WIDTH||390);
const height=Number(process.env.QELLY_BROWSER_HEIGHT||844);
const hash=String(process.env.QELLY_BROWSER_HASH||'#/indicator-detail/rsi');
const name='indicator-detail';
const slug=`${name}-${width}x${height}`;
const output=new URL(`../dist/production-restoration-browser/${slug}/`,import.meta.url);
await mkdir(output,{recursive:true});

const delay=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
const screenshotPath=(file)=>fileURLToPath(new URL(file,output));
const stage=(value,extra={})=>writeFile(new URL('stage.json',output),JSON.stringify({stage:value,name,width,height,hash,...extra},null,2));
const hardTimeout=setTimeout(async()=>{await stage('hard-timeout').catch(()=>{});process.exit(124);},90000);
const config={productName:'Qelly Intelligence',productVersion:'0.9.0-preview.1',release:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',defaultRoute:'market',csrf:{header:'X-Qelly-CSRF',token:null,mode:'unavailable-until-authenticated'},auth:{authenticated:false,backendAvailable:true,productionIdentityEnabled:true,mode:'supabase-auth-cloudflare-facade'},cloud:{available:true,syncAvailable:true,providerRuntime:true},runtime:{releaseSha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',publicSiteUrl:base,capabilities:{authentication:true,cloudSync:true,liveProviders:true,protectedWrites:true}},states:[],liveTrading:false};
const responseFor=(url)=>{const path=new URL(url).pathname;if(path==='/api/v1/config')return[200,config];if(path==='/api/v1/auth/status')return[200,{authenticated:false,context:null}];return[401,{error:{code:'authentication_required',message:'Authentication is required'}}];};
const prohibited=['QELLY GLOBAL PUBLIC BETA','VALIDATION STATE','Unable to render this route','Retry foundation route','AUTHENTICATION DEMO','LOCAL DEMONSTRATION IDENTITY BOUNDARY','STATE: DEFAULT','Secure identity foundation','Input JSON'];

const collect=page=>page.evaluate((blocked)=>{
  const bodyText=document.body?.innerText||'';
  const rect=(element)=>{const box=element?.getBoundingClientRect();return box?{x:box.x,y:box.y,width:box.width,height:box.height,right:box.right,bottom:box.bottom}:null;};
  const visible=(element)=>{if(!element)return false;const style=getComputedStyle(element),box=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0&&box.width>0&&box.height>0;};
  const method=document.querySelector('.q-indicator-methodology');
  const sample=document.querySelector('.q-indicator-sample');
  const banner=document.querySelector('.q-indicator-detail-page>.q-state-banner');
  const bannerCopy=banner?.querySelector('p');
  const cards=[...document.querySelectorAll('.q-method-card')].map((card)=>{
    const label=card.querySelector(':scope>span'),strong=card.querySelector(':scope>strong'),copy=card.querySelector(':scope>p');
    const cardBox=rect(card),labelBox=rect(label),strongBox=rect(strong),copyBox=rect(copy);
    return{
      title:label?.textContent?.trim()||'',card:cardBox,label:labelBox,strong:strongBox,copy:copyBox,
      overlap:Boolean(labelBox&&strongBox&&strongBox.y<labelBox.bottom-1)||Boolean(strongBox&&copyBox&&copyBox.y<strongBox.bottom-1),
      narrow:Boolean(copyBox&&copyBox.width<Math.min(150,cardBox.width*.65)),
      verticalWriting:[label,strong,copy].some((node)=>node&&getComputedStyle(node).writingMode!=='horizontal-tb')
    };
  });
  const methodBox=rect(method),sampleBox=rect(sample),bannerCopyBox=rect(bannerCopy);
  return{
    title:document.title,route:location.hash,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
    horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,
    prohibited:blocked.filter((phrase)=>bodyText.includes(phrase)),
    text:bodyText.slice(0,2400),
    layout:{
      method:methodBox,sample:sampleBox,bannerCopy:bannerCopyBox,cards,
      methodVisible:visible(method),sampleVisible:visible(sample),chartVisible:visible(document.querySelector('.q-indicator-chart .q-spark-bars')),
      exactTableVisible:visible(document.querySelector('.q-indicator-exact-table')),
      technicalOpen:Boolean(document.querySelector('.q-technical-details')?.open),
      sampleInViewportWidth:Boolean(sampleBox&&sampleBox.x>=-1&&sampleBox.right<=innerWidth+1),
      mobileSampleAfterMethod:innerWidth>1050||Boolean(methodBox&&sampleBox&&sampleBox.y>=methodBox.bottom-1),
      mobileBannerReadable:innerWidth>620||Boolean(bannerCopyBox&&bannerCopyBox.width>=Math.min(260,innerWidth-64))
    }
  };
},prohibited);

let browser,context,page,result;
const pageErrors=[],consoleErrors=[],requestFailures=[];
try{
  await stage('launching');
  browser=await chromium.launch({headless:true});
  context=await browser.newContext({viewport:{width,height},serviceWorkers:'block',reducedMotion:'reduce'});
  page=await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror',(error)=>pageErrors.push(error.message));
  page.on('console',(message)=>{if(message.type()==='error')consoleErrors.push(message.text());});
  page.on('requestfailed',(request)=>requestFailures.push({url:request.url(),failure:request.failure()?.errorText||'unknown'}));
  await page.route('**/api/v1/**',async(route)=>{const [status,body]=responseFor(route.request().url());await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});});
  await stage('navigating');
  const response=await page.goto(`${base}/${hash}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true',{timeout:15000});
  await page.waitForSelector('.q-indicator-detail-page');
  await page.getByRole('heading',{name:'How this study works'}).waitFor();
  await page.getByRole('heading',{name:'What the result does not prove'}).waitFor();
  await page.waitForSelector('.q-indicator-chart .q-spark-bars');
  await page.waitForSelector('.q-indicator-exact-table tbody tr');
  await stage('asserting');
  const evidence=await collect(page);
  if(response?.status()!==200)throw new Error(`navigation_status_${response?.status()}`);
  if(evidence.horizontalOverflow)throw new Error(`horizontal_overflow_${evidence.scrollWidth}_${evidence.viewport}`);
  if(evidence.prohibited.length)throw new Error(`prohibited_copy_${evidence.prohibited.join('|')}`);
  if(!evidence.layout.methodVisible||!evidence.layout.sampleVisible)throw new Error('indicator_panel_not_visible');
  if(!evidence.layout.chartVisible||!evidence.layout.exactTableVisible)throw new Error('indicator_sample_evidence_not_visible');
  if(evidence.layout.technicalOpen)throw new Error('technical_evidence_open_by_default');
  if(!evidence.layout.sampleInViewportWidth)throw new Error('indicator_sample_off_canvas');
  if(!evidence.layout.mobileSampleAfterMethod)throw new Error('indicator_sample_not_after_methodology');
  if(!evidence.layout.mobileBannerReadable)throw new Error(`indicator_banner_too_narrow_${evidence.layout.bannerCopy?.width??0}`);
  const brokenCards=evidence.layout.cards.filter((card)=>card.overlap||card.narrow||card.verticalWriting);
  if(brokenCards.length)throw new Error(`indicator_method_cards_broken_${brokenCards.map((card)=>card.title).join('|')}`);
  if(pageErrors.length)throw new Error(`page_errors_${pageErrors.join('|')}`);
  if(consoleErrors.length)throw new Error(`console_errors_${consoleErrors.join('|')}`);
  result={status:'passed',name,width,height,hash,evidence,screenshots:[`${slug}-top.png`,`${slug}-methodology.png`,`${slug}-sample.png`],pageErrors,consoleErrors,requestFailures};
  await writeFile(new URL('result.json',output),JSON.stringify(result,null,2));
  await stage('capturing-top');
  await page.screenshot({path:screenshotPath(`${slug}-top.png`),fullPage:false,animations:'disabled',caret:'hide',timeout:12000});
  await page.locator('.q-indicator-methodology').scrollIntoViewIfNeeded({timeout:12000});
  await stage('capturing-methodology');
  await page.screenshot({path:screenshotPath(`${slug}-methodology.png`),fullPage:false,animations:'disabled',caret:'hide',timeout:12000});
  await page.locator('.q-indicator-sample').scrollIntoViewIfNeeded({timeout:12000});
  await stage('capturing-sample');
  await page.screenshot({path:screenshotPath(`${slug}-sample.png`),fullPage:false,animations:'disabled',caret:'hide',timeout:12000});
  await stage('complete');
}catch(error){
  const evidence=page?await collect(page).catch(()=>null):null;
  result={status:'failed',name,width,height,hash,error:error.message,evidence,pageErrors,consoleErrors,requestFailures};
  if(page)await page.screenshot({path:screenshotPath(`${slug}-failure.png`),fullPage:false,animations:'disabled',caret:'hide',timeout:6000}).catch(()=>{});
  await writeFile(new URL('result.json',output),JSON.stringify(result,null,2));
  await stage('failed',{error:error.message});
}finally{
  await Promise.race([context?.close().catch(()=>{}),delay(3000)]);
  await Promise.race([browser?.close().catch(()=>{}),delay(3000)]);
  clearTimeout(hardTimeout);
}
await writeFile(new URL('result.md',output),`# Qelly Indicator Browser Case — ${slug}\n\n- Status: ${result.status}\n- Route: ${hash}\n- Viewport: ${width} × ${height}\n${result.error?`- Error: ${result.error}\n`:''}`);
console.log(JSON.stringify(result,null,2));
if(result.status!=='passed')process.exit(1);
