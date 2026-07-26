import json, pathlib, subprocess, tempfile, time, shutil, urllib.request, urllib.error
from urllib.parse import urlsplit
from http.cookies import SimpleCookie
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
INDEX=(ROOT/'apps/web/public/index.html').read_text().replace('<head>','<head><base href="https://qelly.test/">')
runtime=tempfile.mkdtemp(prefix='qelly-a1-a11y-')
launcher=r'''
import { startServer } from './src/server/server.mjs';
const environment={...process.env,NODE_ENV:'test',QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'true',QELLY_DEVELOPMENT_IDENTITY_ENABLED:'false',QELLY_DATABASE_MODE:'sqlite',QELLY_JOB_QUEUE_MODE:'database',QELLY_SESSION_SECRET:'release-a4-a11y-session-secret-0000000000001',QELLY_PASSWORD_PEPPER:'release-a4-a11y-pepper'};
const x=await startServer({port:0,runtimePath:process.argv[1],environment});
console.log(JSON.stringify({host:x.host,port:x.port}));
process.on('SIGTERM',()=>x.server.close(()=>process.exit(0)));setInterval(()=>{},1000);
'''
EVALUATE=r'''() => {
 const visible=el=>!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length);
 const controls=[...document.querySelectorAll('button,input,select,textarea,a[href]')].filter(visible);
 const named=el=>Boolean((el.getAttribute('aria-label')||el.getAttribute('title')||(el.textContent||'').trim()||(el.labels&&[...el.labels].some(l=>(l.textContent||'').trim()))));
 const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);
 return {lang:document.documentElement.lang,title:document.title,skipLink:!!document.querySelector('a.skip-link[href="#main"]'),mainCount:document.querySelectorAll('main#main').length,h1Count:document.querySelectorAll('main#main h1').length,unlabeled:controls.filter(x=>!named(x)).map(x=>({tag:x.tagName,id:x.id||null})).slice(0,10),missingAlt:[...document.querySelectorAll('img:not([alt])')].length,positiveTabindex:[...document.querySelectorAll('[tabindex]')].filter(x=>Number(x.getAttribute('tabindex'))>0).length,duplicateIds:[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))],overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,controls:controls.length,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};
}'''
proc=subprocess.Popen(['node','--input-type=module','-e',launcher,runtime],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
    line=proc.stdout.readline().strip();
    if not line: raise RuntimeError(proc.stderr.read())
    info=json.loads(line);base=f"http://127.0.0.1:{info['port']}"
    routes=[('auth-login',False),('auth-register',False),('auth-recovery',False),('account-session',True),('onboarding',True),('discovery-hub',True),('live-markets',True),('identity-access',True),('security-evidence',True),('security-setup',True),('secure-import-vault',True),('passkey-center',True),('account-recovery',True),('delivery-operations',True),('platform-readiness',True)]
    viewports=[('desktop',{'width':1440,'height':1000}),('mobile',{'width':390,'height':844})]
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        for vname,viewport in viewports:
            for idx,(route,auth) in enumerate(routes):
                context=browser.new_context(viewport=viewport,reduced_motion='reduce' if vname=='mobile' else 'no-preference')
                cookie_header=None
                if auth:
                    payload=json.dumps({'email':f'a11y-{vname}-{idx}-{int(time.time()*1000)}@qelly.local','password':'Qelly-A11y-Foundation-2026!','displayName':'Accessibility Validator','organizationName':f'Accessibility Org {vname} {idx} {int(time.time()*1000)}','workspaceName':'Accessible Workspace','locale':'en-US','timezone':'UTC','baseCurrency':'USD'}).encode()
                    req=urllib.request.Request(base+'/api/v1/auth/register',data=payload,headers={'Content-Type':'application/json'},method='POST')
                    with urllib.request.urlopen(req,timeout=15) as resp:
                        if resp.status!=201: raise RuntimeError(f'registration failed: {resp.status}')
                        raw_cookie=resp.headers.get('Set-Cookie')
                    cookie_header=raw_cookie.split(';',1)[0]
                    parsed=SimpleCookie();parsed.load(raw_cookie)
                    for morsel in parsed.values(): context.add_cookies([{'name':morsel.key,'value':morsel.value,'domain':'qelly.test','path':'/'}])
                page=context.new_page();errors=[]
                page.on('console',lambda msg,e=errors:e.append(msg.text) if msg.type=='error' else None);page.on('pageerror',lambda exc,e=errors:e.append(str(exc)))
                try:
                    def proxy(route_obj):
                        parsed=urlsplit(route_obj.request.url)
                        if parsed.netloc=='unpkg.com': route_obj.fulfill(status=200,headers={'Content-Type':'application/javascript'},body='window.LightweightCharts=window.LightweightCharts||undefined;');return
                        if parsed.path.startswith('/api/v1/stream/'): route_obj.fulfill(status=200,headers={'Content-Type':'text/event-stream'},body='event: stream.heartbeat.v1\ndata: {"status":"a11y"}\n\n');return
                        target=base+parsed.path+('?' + parsed.query if parsed.query else '')
                        data=route_obj.request.post_data.encode() if route_obj.request.post_data else None
                        headers={k:v for k,v in route_obj.request.headers.items() if k.lower() not in {'host','content-length','accept-encoding','connection','origin','referer'}}
                        if cookie_header: headers['Cookie']=cookie_header
                        req=urllib.request.Request(target,data=data,headers=headers,method=route_obj.request.method)
                        try:
                            with urllib.request.urlopen(req,timeout=20) as proxied: route_obj.fulfill(status=proxied.status,headers={k:v for k,v in proxied.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length','set-cookie'}},body=proxied.read())
                        except urllib.error.HTTPError as exc: route_obj.fulfill(status=exc.code,headers={k:v for k,v in exc.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length','set-cookie'}},body=exc.read())
                    page.route('**/*',proxy)
                    page.goto(f'about:blank#/{route}');page.set_content(INDEX,wait_until='load',timeout=30000);page.wait_for_selector('main#main h1',timeout=15000);page.wait_for_timeout(250)
                    checks=page.evaluate(EVALUATE);page.keyboard.press('Tab');focus=page.evaluate("({tag:document.activeElement?.tagName,id:document.activeElement?.id||null})")
                    failures=[]
                    if checks['lang']!='en':failures.append('html-lang')
                    if not checks['title']:failures.append('title')
                    if not checks['skipLink']:failures.append('skip-link')
                    if checks['mainCount']!=1:failures.append('single-main')
                    if checks['h1Count']<1:failures.append('h1')
                    if checks['unlabeled']:failures.append('control-name')
                    if checks['missingAlt']:failures.append('image-alt')
                    if checks['positiveTabindex']:failures.append('positive-tabindex')
                    if checks['duplicateIds']:failures.append('duplicate-id')
                    if checks['overflow']>2:failures.append('overflow')
                    if focus['tag'] in (None,'BODY','HTML'):failures.append('keyboard-entry')
                    if errors:failures.append('console-errors')
                except Exception as exc:
                    checks={};focus=None;failures=['render-failure'];errors.append(str(exc))
                results.append({'route':route,'viewport':vname,'dimensions':viewport,'authenticated':auth,'checks':checks,'firstTabFocus':focus,'consoleErrors':errors,'criticalFailures':failures,'status':'passed' if not failures else 'failed'})
                context.close()
        browser.close()
    failed=[x for x in results if x['status']=='failed']
    log={'release':'26.0.0','generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'method':'automated semantic, keyboard-entry and responsive regression; not an independent WCAG certification','routeCount':len(routes),'viewportCount':len(viewports),'checks':len(results),'passed':len(results)-len(failed),'failed':len(failed),'results':results,'status':'passed' if not failed else 'failed'}
    (ROOT/'validation'/'RELEASE_A4_ACCESSIBILITY_REGRESSION.json').write_text(json.dumps(log,indent=2)+'\n')
    print(json.dumps({'release':log['release'],'checks':log['checks'],'passed':log['passed'],'failed':log['failed'],'failures':failed},indent=2))
    if failed: raise SystemExit(1)
finally:
    proc.terminate()
    try: proc.wait(timeout=5)
    except subprocess.TimeoutExpired: proc.kill()
    shutil.rmtree(runtime,ignore_errors=True)
