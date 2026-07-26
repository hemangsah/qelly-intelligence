import json, pathlib, subprocess, tempfile, time, shutil, urllib.request, urllib.error
from urllib.parse import urlsplit
from http.cookies import SimpleCookie
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

ROOT=pathlib.Path(__file__).resolve().parents[1]
INDEX=(ROOT/'apps/web/public/index.html').read_text().replace('<head>','<head><base href="https://qelly.test/">')
OUT=ROOT/'preview'/'release-a4-all-screens'
if OUT.exists(): shutil.rmtree(OUT)
OUT.mkdir(parents=True,exist_ok=True)
runtime=tempfile.mkdtemp(prefix='qelly-a4-all-screens-')
route_json=subprocess.check_output(['node','--input-type=module','-e',"import {routeDefinitions} from './apps/web/public/assets/route-registry.mjs'; console.log(JSON.stringify(routeDefinitions));"],cwd=ROOT,text=True)
defs=json.loads(route_json)
launcher=r"""
import { startServer } from './src/server/server.mjs';
const environment={...process.env,NODE_ENV:'test',QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'true',QELLY_DEVELOPMENT_IDENTITY_ENABLED:'false',QELLY_DATABASE_MODE:'sqlite',QELLY_JOB_QUEUE_MODE:'database',QELLY_SESSION_SECRET:'release-a4-screenshot-session-secret-000000000001',QELLY_PASSWORD_PEPPER:'release-a4-screenshot-pepper',QELLY_EXPOSE_RECOVERY_CODE_IN_DEVELOPMENT:'true',QELLY_LIVE_MARKET_ENABLED:'false',QELLY_EXTERNAL_PROVIDERS_ENABLED:'false'};
const x=await startServer({port:0,runtimePath:process.argv[1],environment});console.log(JSON.stringify({host:x.host,port:x.port}));process.on('SIGTERM',()=>x.server.close(()=>process.exit(0)));setInterval(()=>{},1000);
"""
proc=subprocess.Popen(['node','--input-type=module','-e',launcher,runtime],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
    line=proc.stdout.readline().strip()
    if not line: raise RuntimeError(proc.stderr.read())
    info=json.loads(line);base=f"http://127.0.0.1:{info['port']}"
    payload=json.dumps({'email':f'all-screens-{int(time.time())}@qelly.local','password':'Qelly-All-Screens-2026!','displayName':'Screen Validator','organizationName':f'All Screens Org {int(time.time())}','workspaceName':'All Screens Workspace','locale':'en-US','timezone':'UTC','baseCurrency':'USD'}).encode()
    req=urllib.request.Request(base+'/api/v1/auth/register',data=payload,headers={'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(req,timeout=15) as resp: raw_cookie=resp.headers.get('Set-Cookie')
    cookie_header=raw_cookie.split(';',1)[0]
    parsed_cookie=SimpleCookie();parsed_cookie.load(raw_cookie)
    public_routes={d['route'] for d in defs if d.get('public')}
    viewports=[('desktop',{'width':1440,'height':1000}),('mobile',{'width':390,'height':844})]
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
        for vname,viewport in viewports:
            contexts={}
            for auth_mode in (False,True):
                context=browser.new_context(viewport=viewport,device_scale_factor=1,reduced_motion='reduce')
                if auth_mode:
                    for morsel in parsed_cookie.values(): context.add_cookies([{'name':morsel.key,'value':morsel.value,'domain':'qelly.test','path':'/'}])
                contexts[auth_mode]=context
            for d in defs:
                route=d['route'];authenticated=route not in public_routes
                context=contexts[authenticated]
                page=context.new_page();errors=[]
                page.on('console',lambda msg,e=errors:e.append({'type':'console','text':msg.text}) if msg.type=='error' else None)
                page.on('pageerror',lambda exc,e=errors:e.append({'type':'pageerror','text':str(exc)}))
                def proxy(route_obj, auth=authenticated):
                    parsed=urlsplit(route_obj.request.url)
                    if parsed.netloc=='unpkg.com':
                        route_obj.fulfill(status=200,headers={'Content-Type':'application/javascript; charset=utf-8'},body='window.LightweightCharts=window.LightweightCharts||undefined;');return
                    if parsed.path.startswith('/api/v1/stream/'):
                        route_obj.fulfill(status=200,headers={'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache'},body='event: stream.heartbeat.v1\ndata: {"status":"release-a4-all-screens"}\n\n');return
                    target=base+parsed.path+('?' + parsed.query if parsed.query else '')
                    data=route_obj.request.post_data.encode() if route_obj.request.post_data else None
                    headers={k:v for k,v in route_obj.request.headers.items() if k.lower() not in {'host','content-length','accept-encoding','connection','origin','referer','cookie'}}
                    if auth: headers['Cookie']=cookie_header
                    req=urllib.request.Request(target,data=data,headers=headers,method=route_obj.request.method)
                    try:
                        with urllib.request.urlopen(req,timeout=20) as proxied:
                            response_headers={k:v for k,v in proxied.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length','set-cookie'}}
                            route_obj.fulfill(status=proxied.status,headers=response_headers,body=proxied.read())
                    except urllib.error.HTTPError as exc:
                        response_headers={k:v for k,v in exc.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length','set-cookie'}}
                        route_obj.fulfill(status=exc.code,headers=response_headers,body=exc.read())
                    except Exception as exc:
                        route_obj.fulfill(status=502,headers={'Content-Type':'application/json'},body=json.dumps({'error':'proxy_failed','message':str(exc)}))
                page.route('**/*',proxy)
                started=time.time();heading=None;overflow=None;status='passed';target=OUT/f'{route}__{vname}.png'
                try:
                    page.goto(f'about:blank#/{route}')
                    page.set_content(INDEX,wait_until='domcontentloaded',timeout=20000)
                    page.wait_for_selector('main#main h1',timeout=15000)
                    page.wait_for_timeout(180)
                    heading=page.locator('main#main h1').first.text_content()
                    overflow=page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
                    if overflow>2 or errors: status='failed'
                    page.screenshot(path=str(target),full_page=False,animations='disabled')
                except Exception as exc:
                    errors.append({'type':'render','text':str(exc)});status='failed'
                    try: page.screenshot(path=str(target),full_page=False,animations='disabled')
                    except: pass
                results.append({'route':route,'label':d['label'],'section':d['section'],'viewport':vname,'dimensions':viewport,'heading':heading,'overflowPx':overflow,'consoleErrors':errors,'status':status,'elapsedMs':round((time.time()-started)*1000),'file':str(target.relative_to(ROOT))})
                page.close()
            for context in contexts.values(): context.close()
        browser.close()
    desktop=[x for x in results if x['viewport']=='desktop' and pathlib.Path(ROOT/x['file']).exists()]
    cards=[]
    for item in desktop:
        img=Image.open(ROOT/item['file']).convert('RGB');img.thumbnail((360,240))
        card=Image.new('RGB',(390,290),'white');card.paste(img,((390-img.width)//2,35+(240-img.height)//2));draw=ImageDraw.Draw(card);draw.text((12,10),f"{item['route']} - {item['heading'] or item['label']}",fill='#170B10');cards.append(card)
    cols=3;rows=(len(cards)+cols-1)//cols;sheet=Image.new('RGB',(cols*390,rows*290),'white')
    for i,card in enumerate(cards):sheet.paste(card,((i%cols)*390,(i//cols)*290))
    sheet_path=ROOT/'preview'/'QELLY_RELEASE_A4_ALL_SCREENS_CONTACT_SHEET.jpg';sheet.save(sheet_path,quality=90)
    failures=[x for x in results if x['status']!='passed']
    log={'release':'26.0.0','generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'routeCount':len(defs),'viewportCount':2,'renderCount':len(results),'passed':len(results)-len(failures),'failed':len(failures),'consoleErrorCount':sum(len(x['consoleErrors']) for x in results),'contactSheet':str(sheet_path.relative_to(ROOT)),'renders':results,'status':'passed' if not failures else 'failed'}
    (ROOT/'preview'/'RELEASE_A4_ALL_SCREENS_LOG.json').write_text(json.dumps(log,indent=2)+'\n')
    print(json.dumps({'routes':len(defs),'renders':len(results),'passed':log['passed'],'failed':log['failed'],'consoleErrors':log['consoleErrorCount']},indent=2))
    if failures:
        print(json.dumps(failures[:12],indent=2));raise SystemExit(1)
finally:
    proc.terminate()
    try:proc.wait(timeout=5)
    except:proc.kill()
    shutil.rmtree(runtime,ignore_errors=True)
