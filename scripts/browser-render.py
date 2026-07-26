import json, pathlib, subprocess, tempfile, time, urllib.request, urllib.error, shutil
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'preview'/'screenshots'
if OUT.exists(): shutil.rmtree(OUT)
OUT.mkdir(parents=True,exist_ok=True)
INDEX=(ROOT/'apps/web/public/index.html').read_text().replace('<head>','<head><base href="https://qelly.test/">')
runtime=tempfile.mkdtemp(prefix='qelly-part21-browser-')
launcher="""
import { startServer } from './src/server/server.mjs';
const x=await startServer({port:0,runtimePath:process.argv[1]});
console.log(JSON.stringify({host:x.host,port:x.port}));
process.on('SIGTERM',()=>x.server.close(()=>process.exit(0)));
setInterval(()=>{},1000);
"""
proc=subprocess.Popen(['node','--input-type=module','-e',launcher,runtime],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
    info=json.loads(proc.stdout.readline().strip())
    base=f"http://127.0.0.1:{info['port']}"
    for _ in range(60):
        try: urllib.request.urlopen(base+'/api/health',timeout=1).read(); break
        except Exception: time.sleep(.1)
    cases=[
      ('onboarding-desktop','onboarding',{'width':1440,'height':1000}),
      ('onboarding-mobile','onboarding',{'width':390,'height':844}),
      ('notification-schedules-desktop','notification-schedules',{'width':1440,'height':1000}),
      ('notification-schedules-mobile','notification-schedules',{'width':390,'height':844}),
      ('formula-screener-desktop','formula-screener',{'width':1440,'height':1000}),
      ('formula-screener-mobile','formula-screener',{'width':390,'height':844}),
      ('portfolio-attribution-desktop','portfolio-attribution',{'width':1440,'height':1000}),
      ('portfolio-attribution-mobile','portfolio-attribution',{'width':390,'height':844}),
      ('import-center-desktop','import-center',{'width':1440,'height':1000}),
      ('import-center-mobile','import-center',{'width':390,'height':844}),
      ('research-history-desktop','research-history',{'width':1440,'height':1000}),
      ('research-history-mobile','research-history',{'width':390,'height':844}),
      ('migration-center-desktop','migration-center',{'width':1440,'height':1000}),
      ('migration-center-mobile','migration-center',{'width':390,'height':844}),
      ('watchlist-desktop','watchlist',{'width':1440,'height':1000}),
      ('alert-center-mobile','alert-center',{'width':390,'height':844}),
      ('screener-lab-desktop','screener-lab',{'width':1440,'height':1000}),
      ('portfolio-analytics-desktop','portfolio-analytics',{'width':1440,'height':1000}),
      ('research-workspace-desktop','research-workspace',{'width':1440,'height':1000}),
      ('advanced-chart-desktop','advanced-chart/QI-EQUITY-AAPL',{'width':1440,'height':1000}),
      ('discovery-hub-desktop','discovery-hub',{'width':1440,'height':1000}),
      ('security-evidence-mobile','security-evidence',{'width':390,'height':844}),
    ]
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        for name,route,viewport in cases:
            context=browser.new_context(viewport=viewport,device_scale_factor=1,reduced_motion='reduce' if viewport['width']<500 else 'no-preference')
            page=context.new_page(); errors=[]
            page.on('console',lambda msg,e=errors: e.append({'type':'console','text':msg.text}) if msg.type=='error' else None)
            page.on('pageerror',lambda exc,e=errors: e.append({'type':'pageerror','text':str(exc)}))
            def proxy(route_obj):
                parsed=urlsplit(route_obj.request.url)
                if parsed.path.startswith('/api/v1/stream/'):
                    route_obj.fulfill(status=200,headers={'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache'},body='event: stream.heartbeat.v1\ndata: {"status":"browser-fixture"}\n\n')
                    return
                target=base+parsed.path+('?' + parsed.query if parsed.query else '')
                data=route_obj.request.post_data.encode() if route_obj.request.post_data else None
                headers={k:v for k,v in route_obj.request.headers.items() if k.lower() not in {'host','content-length','accept-encoding','connection'}}
                req=urllib.request.Request(target,data=data,headers=headers,method=route_obj.request.method)
                try:
                    with urllib.request.urlopen(req,timeout=15) as proxied:
                        body=proxied.read(); response_headers={k:v for k,v in proxied.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length'}}
                        route_obj.fulfill(status=proxied.status,headers=response_headers,body=body)
                except urllib.error.HTTPError as exc:
                    body=exc.read(); response_headers={k:v for k,v in exc.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length'}}
                    route_obj.fulfill(status=exc.code,headers=response_headers,body=body)
            page.route('**/*',proxy)
            page.goto(f'about:blank#/{route}')
            page.set_content(INDEX,wait_until='load',timeout=30000)
            page.wait_for_selector('main#main .q-page',timeout=15000)
            page.wait_for_timeout(900)
            target=OUT/f'{name}.png'
            page.screenshot(path=str(target),full_page=True)
            overflow=page.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")
            h1=page.locator('main#main h1').first.text_content() if page.locator('main#main h1').count() else None
            results.append({'name':name,'route':route,'viewport':viewport,'status':200,'title':page.title(),'heading':h1,'horizontalOverflowPx':overflow,'screenshot':str(target.relative_to(ROOT)),'consoleErrors':errors})
            context.close()
        browser.close()
    thumbs=[]
    for item in results:
        img=Image.open(ROOT/item['screenshot']).convert('RGB'); img.thumbnail((560,420))
        card=Image.new('RGB',(600,480),'white'); x=(600-img.width)//2; y=40+(420-img.height)//2
        card.paste(img,(x,y)); ImageDraw.Draw(card).text((18,14),item['name'],fill='black'); thumbs.append(card)
    rows=(len(thumbs)+1)//2
    sheet=Image.new('RGB',(1200,rows*480),'white')
    for i,card in enumerate(thumbs): sheet.paste(card,((i%2)*600,(i//2)*480))
    sheet_path=ROOT/'preview'/'QELLY_PART21_CONTACT_SHEET.jpg'; sheet.save(sheet_path,quality=90)
    error_count=sum(len(item['consoleErrors']) for item in results)
    status='passed' if all(item['status']==200 and not item['consoleErrors'] and item['heading'] and item['horizontalOverflowPx']<=2 for item in results) else 'failed'
    log={'release':'21.0.0','generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'browser':'system Chromium via Python Playwright','renders':results,'renderCount':len(results),'consoleErrorCount':error_count,'contactSheet':str(sheet_path.relative_to(ROOT)),'status':status}
    (ROOT/'preview'/'BROWSER_RENDER_LOG.json').write_text(json.dumps(log,indent=2)+'\n')
    print(json.dumps({'release':log['release'],'renderCount':log['renderCount'],'consoleErrorCount':log['consoleErrorCount'],'status':status,'failed':[x for x in results if x['consoleErrors'] or x['horizontalOverflowPx']>2 or not x['heading']]},indent=2))
    if status!='passed': raise SystemExit(1)
finally:
    proc.terminate()
    try: proc.wait(timeout=5)
    except subprocess.TimeoutExpired: proc.kill()
    shutil.rmtree(runtime,ignore_errors=True)
