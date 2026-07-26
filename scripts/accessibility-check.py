import asyncio, json, pathlib, subprocess, tempfile, time, urllib.request, shutil
from urllib.parse import urlsplit
from playwright.async_api import async_playwright

ROOT=pathlib.Path(__file__).resolve().parents[1]
INDEX=(ROOT/'apps/web/public/index.html').read_text().replace('<head>','<head><base href="https://qelly.test/">')
ROUTES=['live-markets','theme-personas','feature-universe','about-qelly','market','rankings','search','asset','watchlist','theme-lab','identity-access','data-mesh','instrument-master','timeseries-lab','stream-operations','observability','security-evidence','discovery-hub','asset-rankings','categories','category-detail','venues','venue-detail','dex-discovery','global-charts','converter','news-research','research-article','trust-center','asset-intelligence','advanced-chart','fundamentals-estimates','filing-workspace','event-calendar','comparison-lab','alert-center','notification-center','screener-lab','portfolio-analytics','research-workspace','onboarding','notification-schedules','formula-screener','portfolio-attribution','import-center','research-history','migration-center']
VIEWPORTS=[('desktop',{'width':1440,'height':1000}),('mobile',{'width':390,'height':844})]
EVALUATE="""
() => {
  const visible=el=>!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length);
  const interactive=[...document.querySelectorAll('button,input,select,textarea,a[href]')].filter(visible);
  const named=el=>{const aria=el.getAttribute('aria-label')||el.getAttribute('aria-labelledby')||el.getAttribute('title');if(aria?.trim())return true;if((el.textContent||'').trim())return true;if(el.labels&&[...el.labels].some(label=>(label.textContent||'').trim()))return true;return false;};
  const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);
  return {lang:document.documentElement.lang,title:document.title,skipLink:!!document.querySelector('a.skip-link[href="#main"]'),mainCount:document.querySelectorAll('main#main').length,h1Count:document.querySelectorAll('main#main h1').length,unlabeledInteractive:interactive.filter(el=>!named(el)).map(el=>({tag:el.tagName,id:el.id||null})).slice(0,10),imagesMissingAlt:[...document.querySelectorAll('img')].filter(img=>!img.hasAttribute('alt')).length,positiveTabindex:[...document.querySelectorAll('[tabindex]')].filter(el=>Number(el.getAttribute('tabindex'))>0).length,duplicateIds:[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))],horizontalOverflowPx:document.documentElement.scrollWidth-document.documentElement.clientWidth,interactiveCount:interactive.length};
}
"""
async def main():
    runtime=tempfile.mkdtemp(prefix='qelly-part22-a11y-')
    launcher="""
import { startServer } from './src/server/server.mjs';
const x=await startServer({port:0,runtimePath:process.argv[1]});
console.log(JSON.stringify({host:x.host,port:x.port}));
process.on('SIGTERM',()=>x.server.close(()=>process.exit(0)));
setInterval(()=>{},1000);
"""
    proc=subprocess.Popen(['node','--input-type=module','-e',launcher,runtime],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        info=json.loads(proc.stdout.readline().strip()); backend=f"http://127.0.0.1:{info['port']}"
        for _ in range(60):
            try: urllib.request.urlopen(backend+'/api/health',timeout=1).read(); break
            except Exception: time.sleep(.1)
        results=[]; semaphore=asyncio.Semaphore(6)
        async with async_playwright() as p:
            browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            async def run_case(route_name,viewport_name,viewport):
                async with semaphore:
                    context=await browser.new_context(viewport=viewport,device_scale_factor=1,reduced_motion='reduce' if viewport_name=='mobile' else 'no-preference')
                    page=await context.new_page(); errors=[]
                    async def proxy(route):
                        parsed=urlsplit(route.request.url)
                        if parsed.netloc == 'unpkg.com':
                            await route.fulfill(status=200,headers={'Content-Type':'application/javascript; charset=utf-8'},body='window.LightweightCharts=window.LightweightCharts||undefined;')
                            return
                        if parsed.path.startswith('/api/v1/stream/'):
                            await route.fulfill(status=200,headers={'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache'},body='event: stream.heartbeat.v1\ndata: {"status":"accessibility-fixture"}\n\n')
                            return
                        target=backend+parsed.path+('?' + parsed.query if parsed.query else '')
                        response=await route.fetch(url=target)
                        await route.fulfill(response=response)
                    await page.route('**/*',proxy)
                    page.on('console',lambda msg: errors.append(msg.text) if msg.type=='error' else None)
                    page.on('pageerror',lambda exc: errors.append(str(exc)))
                    try:
                        await page.goto(f'about:blank#/{route_name}')
                        await page.set_content(INDEX,wait_until='load',timeout=30000)
                        await page.wait_for_selector('main#main .q-page',timeout=15000)
                        await page.wait_for_timeout(220)
                        checks=await page.evaluate(EVALUATE)
                        await page.keyboard.press('Tab')
                        focus=await page.evaluate("({tag:document.activeElement?.tagName,id:document.activeElement?.id||null,className:document.activeElement?.className||null})")
                        critical=[]
                        if checks['lang']!='en': critical.append('html-lang')
                        if not checks['title']: critical.append('document-title')
                        if not checks['skipLink']: critical.append('skip-link')
                        if checks['mainCount']!=1: critical.append('single-main')
                        if checks['h1Count']<1: critical.append('page-h1')
                        if checks['unlabeledInteractive']: critical.append('interactive-accessible-name')
                        if checks['imagesMissingAlt']>0: critical.append('image-alt')
                        if checks['positiveTabindex']>0: critical.append('positive-tabindex')
                        if checks['duplicateIds']: critical.append('duplicate-id')
                        if checks['horizontalOverflowPx']>2: critical.append('horizontal-overflow')
                        if focus['tag'] in [None,'BODY','HTML']: critical.append('keyboard-focus-entry')
                        if errors: critical.append('console-errors')
                        result={'route':route_name,'viewport':viewport_name,'dimensions':viewport,'checks':checks,'firstTabFocus':focus,'consoleErrors':errors,'criticalFailures':critical,'status':'passed' if not critical else 'failed'}
                    except Exception as exc:
                        result={'route':route_name,'viewport':viewport_name,'dimensions':viewport,'checks':{},'firstTabFocus':None,'consoleErrors':errors+[str(exc)],'criticalFailures':['render-failure'],'status':'failed'}
                    results.append(result); await page.unroute_all(behavior='ignoreErrors'); await context.close()
            await asyncio.gather(*(run_case(route_name,viewport_name,viewport) for viewport_name,viewport in VIEWPORTS for route_name in ROUTES))
            await browser.close()
        results.sort(key=lambda x:(0 if x['viewport']=='desktop' else 1,ROUTES.index(x['route'])))
        failures=[item for item in results if item['status']=='failed']
        log={'release':'22.0.0','generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'method':'automated semantic and responsive regression; not independent WCAG certification','routeCount':len(ROUTES),'viewportCount':len(VIEWPORTS),'checks':len(results),'passed':len(results)-len(failures),'failed':len(failures),'results':results,'status':'passed' if not failures else 'failed'}
        (ROOT/'validation'/'ACCESSIBILITY_REGRESSION.json').write_text(json.dumps(log,indent=2)+'\n')
        print(json.dumps({'release':log['release'],'checks':log['checks'],'passed':log['passed'],'failed':log['failed'],'failures':[{'route':x['route'],'viewport':x['viewport'],'criticalFailures':x['criticalFailures'],'consoleErrors':x['consoleErrors'],'checks':x['checks']} for x in failures]},indent=2))
        if failures: raise SystemExit(1)
    finally:
        proc.terminate()
        try: proc.wait(timeout=5)
        except subprocess.TimeoutExpired: proc.kill()
        shutil.rmtree(runtime,ignore_errors=True)
asyncio.run(main())
