import json, pathlib, subprocess, tempfile, time, shutil, os, urllib.request, urllib.error
from urllib.parse import urlsplit
from http.cookies import SimpleCookie
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont

ROOT=pathlib.Path(__file__).resolve().parents[1]
INDEX=(ROOT/'apps/web/public/index.html').read_text().replace('<head>','<head><base href="https://qelly.test/">')
OUT=ROOT/'preview'/'release-a1-screenshots'
if OUT.exists(): shutil.rmtree(OUT)
OUT.mkdir(parents=True,exist_ok=True)
runtime=tempfile.mkdtemp(prefix='qelly-a1-browser-')
launcher=r'''
import { startServer } from './src/server/server.mjs';
const runtimePath=process.argv[1];
const environment={...process.env,
 NODE_ENV:'test',QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'true',
 QELLY_DEVELOPMENT_IDENTITY_ENABLED:'false',QELLY_DATABASE_MODE:'sqlite',QELLY_JOB_QUEUE_MODE:'database',
 QELLY_SESSION_SECRET:'release-a1-browser-session-secret-000000000001',QELLY_PASSWORD_PEPPER:'release-a1-browser-pepper'};
const x=await startServer({port:0,runtimePath,environment});
console.log(JSON.stringify({host:x.host,port:x.port}));
process.on('SIGTERM',()=>x.server.close(()=>process.exit(0)));
setInterval(()=>{},1000);
'''
proc=subprocess.Popen(['node','--input-type=module','-e',launcher,runtime],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
    line=proc.stdout.readline().strip()
    if not line: raise RuntimeError(proc.stderr.read())
    info=json.loads(line); base=f"http://127.0.0.1:{info['port']}"
    cases=[
      ('auth-login-desktop','auth-login',{'width':1440,'height':1000},False),
      ('auth-login-mobile','auth-login',{'width':390,'height':844},False),
      ('auth-register-desktop','auth-register',{'width':1440,'height':1000},False),
      ('auth-register-mobile','auth-register',{'width':390,'height':844},False),
      ('account-session-desktop','account-session',{'width':1440,'height':1000},True),
      ('account-session-mobile','account-session',{'width':390,'height':844},True),
      ('onboarding-desktop','onboarding',{'width':1440,'height':1000},True),
      ('onboarding-mobile','onboarding',{'width':390,'height':844},True),
      ('security-setup-desktop','security-setup',{'width':1440,'height':1000},True),
      ('security-setup-mobile','security-setup',{'width':390,'height':844},True),
      ('secure-import-vault-desktop','secure-import-vault',{'width':1440,'height':1000},True),
      ('secure-import-vault-mobile','secure-import-vault',{'width':390,'height':844},True),
    ]
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        for index,(name,route,viewport,authenticated) in enumerate(cases):
            context=browser.new_context(viewport=viewport,device_scale_factor=1,reduced_motion='reduce' if viewport['width']<500 else 'no-preference')
            cookie_header=None
            if authenticated:
                unique=f"browser-{index}-{int(time.time()*1000)}@qelly.local"
                payload=json.dumps({'email':unique,'password':'Qelly-Browser-Foundation-2026!','displayName':'Browser Validator','organizationName':f'Browser Validation Org {index} {int(time.time()*1000)}','workspaceName':'Release A1 Workspace','locale':'en-US','timezone':'UTC','baseCurrency':'USD'}).encode()
                req=urllib.request.Request(base+'/api/v1/auth/register',data=payload,headers={'Content-Type':'application/json'},method='POST')
                with urllib.request.urlopen(req,timeout=15) as response:
                    if response.status!=201: raise RuntimeError(f"register failed {response.status}")
                    raw_cookie=response.headers.get('Set-Cookie')
                cookie_header=raw_cookie.split(';',1)[0]
                parsed=SimpleCookie(); parsed.load(raw_cookie)
                for morsel in parsed.values(): context.add_cookies([{'name':morsel.key,'value':morsel.value,'domain':'qelly.test','path':'/'}])
            page=context.new_page(); errors=[]
            page.on('console',lambda msg,e=errors: e.append({'type':'console','text':msg.text}) if msg.type=='error' else None)
            page.on('pageerror',lambda exc,e=errors: e.append({'type':'pageerror','text':str(exc)}))
            def proxy(route_obj):
                parsed=urlsplit(route_obj.request.url)
                if parsed.netloc=='unpkg.com':
                    route_obj.fulfill(status=200,headers={'Content-Type':'application/javascript; charset=utf-8'},body='window.LightweightCharts=window.LightweightCharts||undefined;');return
                if parsed.path.startswith('/api/v1/stream/'):
                    route_obj.fulfill(status=200,headers={'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache'},body='event: stream.heartbeat.v1\ndata: {"status":"release-a1-browser"}\n\n');return
                target=base+parsed.path+('?' + parsed.query if parsed.query else '')
                data=route_obj.request.post_data.encode() if route_obj.request.post_data else None
                headers={k:v for k,v in route_obj.request.headers.items() if k.lower() not in {'host','content-length','accept-encoding','connection','origin','referer'}}
                if cookie_header: headers['Cookie']=cookie_header
                req=urllib.request.Request(target,data=data,headers=headers,method=route_obj.request.method)
                try:
                    with urllib.request.urlopen(req,timeout=20) as proxied:
                        response_headers={k:v for k,v in proxied.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length','set-cookie'}}
                        route_obj.fulfill(status=proxied.status,headers=response_headers,body=proxied.read())
                except urllib.error.HTTPError as exc:
                    response_headers={k:v for k,v in exc.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length','set-cookie'}}
                    route_obj.fulfill(status=exc.code,headers=response_headers,body=exc.read())
            page.route('**/*',proxy)
            page.goto(f'about:blank#/{route}')
            page.set_content(INDEX,wait_until='load',timeout=30000)
            page.wait_for_selector('main#main h1',timeout=15000)
            page.wait_for_timeout(600)
            target=OUT/f'{name}.png'; page.screenshot(path=str(target),full_page=True)
            overflow=page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
            h1=page.locator('main#main h1').first.text_content() if page.locator('main#main h1').count() else None
            current_hash=page.evaluate('location.hash')
            results.append({'name':name,'route':route,'viewport':viewport,'authenticated':authenticated,'heading':h1,'hash':current_hash,'horizontalOverflowPx':overflow,'screenshot':str(target.relative_to(ROOT)),'consoleErrors':errors})
            context.close()
        browser.close()
    thumbs=[]
    for item in results:
        img=Image.open(ROOT/item['screenshot']).convert('RGB'); img.thumbnail((650,440))
        card=Image.new('RGB',(700,500),'white'); card.paste(img,((700-img.width)//2,45+(440-img.height)//2))
        draw=ImageDraw.Draw(card); draw.text((18,14),f"{item['name']} - {item['heading'] or ''}",fill='#170B10')
        thumbs.append(card)
    rows=(len(thumbs)+1)//2; sheet=Image.new('RGB',(1400,rows*500),'white')
    for i,card in enumerate(thumbs): sheet.paste(card,((i%2)*700,(i//2)*500))
    sheet_path=ROOT/'preview'/'QELLY_RELEASE_A2_CONTACT_SHEET.jpg'; sheet.save(sheet_path,quality=92)
    failures=[x for x in results if x['consoleErrors'] or not x['heading'] or x['horizontalOverflowPx']>2 or not x['hash'].startswith('#/')]
    log={'release':'24.0.0','generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'browser':'Chromium via Python Playwright','renderCount':len(results),'consoleErrorCount':sum(len(x['consoleErrors']) for x in results),'contactSheet':str(sheet_path.relative_to(ROOT)),'renders':results,'status':'passed' if not failures else 'failed'}
    (ROOT/'preview'/'RELEASE_A1_BROWSER_RENDER_LOG.json').write_text(json.dumps(log,indent=2)+'\n')
    print(json.dumps({'release':log['release'],'renderCount':log['renderCount'],'consoleErrorCount':log['consoleErrorCount'],'status':log['status'],'failures':failures},indent=2))
    if failures: raise SystemExit(1)
finally:
    proc.terminate()
    try: proc.wait(timeout=5)
    except subprocess.TimeoutExpired: proc.kill()
    shutil.rmtree(runtime,ignore_errors=True)
