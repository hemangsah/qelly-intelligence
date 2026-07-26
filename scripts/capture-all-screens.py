import json, pathlib, subprocess, tempfile, time, shutil, urllib.request
from http.cookies import SimpleCookie
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'preview'/'qelly-all-screens'
if OUT.exists(): shutil.rmtree(OUT)
OUT.mkdir(parents=True,exist_ok=True)
runtime=tempfile.mkdtemp(prefix='qelly-screen-evidence-')
defs=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {routeDefinitions} from './apps/web/public/assets/route-registry.mjs'; console.log(JSON.stringify(routeDefinitions));"],cwd=ROOT,text=True))
launcher=r"""
import {startServer} from './src/server/server.mjs';
const environment={...process.env,NODE_ENV:'test',QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'true',QELLY_DEVELOPMENT_IDENTITY_ENABLED:'false',QELLY_DATABASE_MODE:'sqlite',QELLY_JOB_QUEUE_MODE:'database',QELLY_SESSION_SECRET:'qelly-browser-evidence-session-secret-000000001',QELLY_PASSWORD_PEPPER:'qelly-browser-evidence-pepper',QELLY_EXPOSE_RECOVERY_CODE_IN_DEVELOPMENT:'true',QELLY_PUBLIC_MARKET_DATA_ENABLED:'false',QELLY_LIVE_MARKET_ENABLED:'false',QELLY_EXTERNAL_PROVIDERS_ENABLED:'false',QELLY_SECRET_KEYRING_JSON:JSON.stringify({old:'old-secret-material-abcdefghijklmnopqrstuvwxyz',active:'active-secret-material-abcdefghijklmnopqrstuvwxyz'}),QELLY_SECRET_ACTIVE_KEY_ID:'active'};
const x=await startServer({port:0,runtimePath:process.argv[1],environment});console.log(JSON.stringify({host:x.host,port:x.port}));process.on('SIGTERM',()=>x.server.close(()=>process.exit(0)));setInterval(()=>{},1000);
"""
proc=subprocess.Popen(['node','--input-type=module','-e',launcher,runtime],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
    line=proc.stdout.readline().strip()
    if not line: raise RuntimeError(proc.stderr.read())
    info=json.loads(line); base=f"http://127.0.0.1:{info['port']}"
    payload=json.dumps({'email':f'evidence-{int(time.time())}@qelly.local','password':'Qelly-Evidence-2026!','displayName':'Evidence Validator','organizationName':'Qelly Evidence Org','workspaceName':'Evidence Workspace','locale':'en-US','timezone':'UTC','baseCurrency':'USD'}).encode()
    req=urllib.request.Request(base+'/api/v1/auth/register',data=payload,headers={'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(req,timeout=15) as resp: raw_cookie=resp.headers.get('Set-Cookie')
    parsed=SimpleCookie();parsed.load(raw_cookie)
    public={d['route'] for d in defs if d.get('public')}
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
        for device,viewport in [('desktop',{'width':1440,'height':1000}),('mobile',{'width':390,'height':844})]:
            contexts={}
            for auth in (False,True):
                ctx=browser.new_context(viewport=viewport,device_scale_factor=1,reduced_motion='reduce')
                if auth:
                    cookies=[]
                    for morsel in parsed.values(): cookies.append({'name':morsel.key,'value':morsel.value,'url':base})
                    ctx.add_cookies(cookies)
                contexts[auth]=ctx
            for item in defs:
                route=item['route']; auth=route not in public; page=contexts[auth].new_page(); errors=[]
                page.on('console',lambda msg,e=errors:e.append({'type':'console','text':msg.text}) if msg.type=='error' else None)
                page.on('pageerror',lambda exc,e=errors:e.append({'type':'pageerror','text':str(exc)}))
                page.route('**/*',lambda r: r.continue_() if r.request.url.startswith(base) else r.abort())
                target=OUT/f'{route}__{device}.png'; started=time.time();heading=None;overflow=None;status='passed'
                try:
                    page.goto(f'{base}/#/{route}',wait_until='domcontentloaded',timeout=20000)
                    page.wait_for_selector('main#main h1',timeout=15000)
                    page.wait_for_timeout(250)
                    heading=page.locator('main#main h1').first.text_content()
                    overflow=page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
                    if overflow>2 or errors: status='failed'
                    page.screenshot(path=str(target),full_page=False,animations='disabled')
                except Exception as exc:
                    errors.append({'type':'render','text':str(exc)});status='failed'
                    try: page.screenshot(path=str(target),full_page=False,animations='disabled')
                    except Exception: pass
                results.append({'route':route,'label':item['label'],'section':item['section'],'public':route in public,'viewport':device,'dimensions':viewport,'heading':heading,'overflowPx':overflow,'consoleErrors':errors,'status':status,'elapsedMs':round((time.time()-started)*1000),'file':str(target.relative_to(ROOT))})
                print(json.dumps({'route':route,'viewport':device,'status':status}),flush=True)
                page.close()
            for ctx in contexts.values(): ctx.close()
        browser.close()
    # contact sheet from desktop renders
    cards=[]
    for item in [x for x in results if x['viewport']=='desktop']:
        image=Image.open(ROOT/item['file']).convert('RGB');image.thumbnail((360,240))
        card=Image.new('RGB',(390,290),'white');card.paste(image,((390-image.width)//2,35+(240-image.height)//2));draw=ImageDraw.Draw(card);draw.text((12,10),f"{item['route']} · {item['heading'] or item['label']}",fill='#170B10');cards.append(card)
    cols=3;rows=(len(cards)+cols-1)//cols;sheet=Image.new('RGB',(cols*390,rows*290),'white')
    for i,card in enumerate(cards):sheet.paste(card,((i%cols)*390,(i//cols)*290))
    contact=ROOT/'preview'/'QELLY_ALL_IMPLEMENTED_SCREENS_CONTACT_SHEET.jpg';sheet.save(contact,quality=88)
    failures=[x for x in results if x['status']!='passed']
    log={'productVersion':'0.9.0-preview.1','generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'routeCount':len(defs),'viewportCount':2,'renderCount':len(results),'passed':len(results)-len(failures),'failed':len(failures),'consoleErrorCount':sum(len(x['consoleErrors']) for x in results),'horizontalOverflowFailures':sum(1 for x in results if (x['overflowPx'] or 0)>2),'contactSheet':str(contact.relative_to(ROOT)),'renders':results,'status':'passed' if not failures else 'failed'}
    (ROOT/'preview'/'QELLY_ALL_SCREENS_LOG.json').write_text(json.dumps(log,indent=2)+'\n')
    print(json.dumps({k:log[k] for k in ['routeCount','renderCount','passed','failed','consoleErrorCount','horizontalOverflowFailures','status']},indent=2))
    if failures: raise SystemExit(1)
finally:
    proc.terminate()
    try: proc.wait(timeout=5)
    except Exception: proc.kill()
    shutil.rmtree(runtime,ignore_errors=True)
