import json, pathlib, subprocess, tempfile, time, shutil, urllib.request, urllib.error, sys, mimetypes
from urllib.parse import urlsplit, unquote
from http.cookies import SimpleCookie
from playwright.sync_api import sync_playwright

ROOT=pathlib.Path(__file__).resolve().parents[1]
PUBLIC_ROOT=(ROOT/'apps/web/public').resolve()
INDEX=(PUBLIC_ROOT/'index.html').read_text().replace('<head>','<head><base href="https://qelly.test/">')
OUT=ROOT/'preview'/'release-a5-all-screens'; OUT.mkdir(parents=True,exist_ok=True)
start=int(sys.argv[1]); end=int(sys.argv[2])
if start<0 or end<=start: raise SystemExit(f'invalid screen range {start}:{end}')
runtime=tempfile.mkdtemp(prefix=f'qelly-a5-screens-{start}-{end}-')
route_json=subprocess.check_output(['node','--input-type=module','-e',"import {routeDefinitions} from './apps/web/public/assets/route-registry.mjs'; console.log(JSON.stringify(routeDefinitions));"],cwd=ROOT,text=True)
defs_all=json.loads(route_json)
if end>len(defs_all): raise SystemExit(f'screen range {start}:{end} exceeds route registry size {len(defs_all)}')
defs=defs_all[start:end]

MIME_OVERRIDES={
    '.css':'text/css; charset=utf-8',
    '.js':'application/javascript; charset=utf-8',
    '.mjs':'application/javascript; charset=utf-8',
    '.json':'application/json; charset=utf-8',
    '.webmanifest':'application/manifest+json; charset=utf-8',
    '.html':'text/html; charset=utf-8',
    '.svg':'image/svg+xml',
    '.png':'image/png',
    '.jpg':'image/jpeg',
    '.jpeg':'image/jpeg',
    '.webp':'image/webp',
    '.ico':'image/x-icon',
    '.woff':'font/woff',
    '.woff2':'font/woff2'
}

def local_public_file(request_path):
    relative=unquote(request_path).lstrip('/')
    if not relative:
        return None
    candidate=(PUBLIC_ROOT/relative).resolve()
    try:
        candidate.relative_to(PUBLIC_ROOT)
    except ValueError:
        return None
    return candidate if candidate.is_file() else None

def content_type(path):
    return MIME_OVERRIDES.get(path.suffix.lower()) or mimetypes.guess_type(path.name)[0] or 'application/octet-stream'

launcher=r"""
import { startServer } from './src/server/server.mjs';
const environment={...process.env,NODE_ENV:'test',QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'true',QELLY_DEVELOPMENT_IDENTITY_ENABLED:'false',QELLY_DATABASE_MODE:'sqlite',QELLY_JOB_QUEUE_MODE:'database',QELLY_SESSION_SECRET:'release-a5-screen-batch-session-secret-0000001',QELLY_PASSWORD_PEPPER:'release-a5-screen-batch-pepper',QELLY_EXPOSE_RECOVERY_CODE_IN_DEVELOPMENT:'true',QELLY_LIVE_MARKET_ENABLED:'false',QELLY_EXTERNAL_PROVIDERS_ENABLED:'false',QELLY_SECRET_KEYRING_JSON:JSON.stringify({old:'old-secret-material-abcdefghijklmnopqrstuvwxyz',active:'active-secret-material-abcdefghijklmnopqrstuvwxyz'}),QELLY_SECRET_ACTIVE_KEY_ID:'active'};
const x=await startServer({port:0,runtimePath:process.argv[1],environment});console.log(JSON.stringify({host:x.host,port:x.port}));process.on('SIGTERM',()=>x.server.close(()=>process.exit(0)));setInterval(()=>{},1000);
"""
proc=subprocess.Popen(['node','--input-type=module','-e',launcher,runtime],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
    line=proc.stdout.readline().strip()
    if not line: raise RuntimeError(proc.stderr.read())
    info=json.loads(line); base=f"http://127.0.0.1:{info['port']}"
    payload=json.dumps({'email':f'screen-batch-{start}-{int(time.time())}@qelly.local','password':'Qelly-Screen-Batch-2026!','displayName':'Screen Validator','organizationName':f'Screen Batch Org {start}','workspaceName':'Screen Batch Workspace','locale':'en-US','timezone':'UTC','baseCurrency':'USD'}).encode()
    req=urllib.request.Request(base+'/api/v1/auth/register',data=payload,headers={'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(req,timeout=15) as resp: raw_cookie=resp.headers.get('Set-Cookie')
    cookie_header=raw_cookie.split(';',1)[0]; parsed_cookie=SimpleCookie(); parsed_cookie.load(raw_cookie)
    public_routes={d['route'] for d in defs_all if d.get('public')}
    viewports=[('desktop',{'width':1440,'height':1000}),('mobile',{'width':390,'height':844})]
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
        for vname,viewport in viewports:
            contexts={}
            for auth_mode in (False,True):
                context=browser.new_context(viewport=viewport,device_scale_factor=1,reduced_motion='reduce')
                if auth_mode:
                    for morsel in parsed_cookie.values(): context.add_cookies([{'name':morsel.key,'value':morsel.value,'domain':'qelly.test','path':'/','secure':True,'sameSite':'Lax'}])
                contexts[auth_mode]=context
            for d in defs:
                route=d['route']; authenticated=route not in public_routes; context=contexts[authenticated]
                page=context.new_page(); errors=[]
                page.on('console',lambda msg,e=errors:e.append({'type':'console','text':msg.text}) if msg.type=='error' else None)
                page.on('pageerror',lambda exc,e=errors:e.append({'type':'pageerror','text':str(exc)}))
                page.on('requestfailed',lambda request,e=errors:e.append({'type':'requestfailed','url':request.url,'method':request.method,'failure':request.failure}))
                page.on('response',lambda response,e=errors:e.append({'type':'http','status':response.status,'url':response.url}) if response.status>=400 else None)
                def proxy(route_obj):
                    auth=authenticated
                    current_route=route
                    parsed=urlsplit(route_obj.request.url)
                    if parsed.netloc=='qelly.test' and parsed.path in ('/','/index.html'):
                        route_obj.fulfill(status=200,headers={
                            'Content-Type':'text/html; charset=utf-8',
                            'Cache-Control':'no-store',
                            'X-Content-Type-Options':'nosniff'
                        },body=INDEX);return
                    if parsed.netloc=='qelly.test':
                        asset=local_public_file(parsed.path)
                        if asset is not None:
                            route_obj.fulfill(status=200,headers={
                                'Content-Type':content_type(asset),
                                'Cache-Control':'no-store',
                                'X-Content-Type-Options':'nosniff'
                            },body=asset.read_bytes());return
                    if not auth and parsed.path=='/api/v1/config':
                        with urllib.request.urlopen(base+'/api/v1/config',timeout=20) as config_response:
                            public_config=json.loads(config_response.read().decode('utf-8'))
                        public_config.setdefault('auth',{})['authenticated']=False
                        public_config['defaultRoute']=current_route
                        route_obj.fulfill(status=200,headers={'Content-Type':'application/json; charset=utf-8'},body=json.dumps(public_config));return
                    if not auth and parsed.path=='/api/v1/auth/status':
                        route_obj.fulfill(status=200,headers={'Content-Type':'application/json; charset=utf-8'},body=json.dumps({'authenticated':False,'mode':'production-cookie','productionFoundation':{'developmentIdentityEnabled':False}}));return
                    if parsed.netloc=='unpkg.com':
                        route_obj.fulfill(status=200,headers={'Content-Type':'application/javascript; charset=utf-8'},body='window.LightweightCharts=window.LightweightCharts||undefined;');return
                    if parsed.path.startswith('/api/v1/stream/'):
                        route_obj.fulfill(status=200,headers={'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache'},body='event: stream.heartbeat.v1\ndata: {"status":"release-a5-screens"}\n\n');return
                    target=base+parsed.path+('?' + parsed.query if parsed.query else '')
                    data=route_obj.request.post_data.encode() if route_obj.request.post_data else None
                    headers={k:v for k,v in route_obj.request.headers.items() if k.lower() not in {'host','content-length','accept-encoding','connection','origin','referer','cookie'}}
                    if auth: headers['Cookie']=cookie_header
                    req=urllib.request.Request(target,data=data,headers=headers,method=route_obj.request.method)
                    try:
                        with urllib.request.urlopen(req,timeout=12) as proxied:
                            rh={k:v for k,v in proxied.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length','set-cookie'}}
                            route_obj.fulfill(status=proxied.status,headers=rh,body=proxied.read())
                    except urllib.error.HTTPError as exc:
                        rh={k:v for k,v in exc.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length','set-cookie'}}
                        route_obj.fulfill(status=exc.code,headers=rh,body=exc.read())
                    except Exception as exc:
                        route_obj.fulfill(status=502,headers={'Content-Type':'application/json'},body=json.dumps({'error':'proxy_failed','target':target,'message':str(exc)}))
                page.route('**/*',proxy)
                started=time.time(); heading=None; overflow=None; page_height=None; status='passed'; target=OUT/f'{route}__{vname}.png'
                try:
                    page.goto(f'https://qelly.test/#/{route}',wait_until='domcontentloaded',timeout=20000)
                    page.wait_for_selector('main#main h1',timeout=15000); page.wait_for_timeout(500)
                    heading=page.locator('main#main h1').first.text_content(); overflow=page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
                    page_height=page.evaluate('document.documentElement.scrollHeight')
                    if overflow>2 or errors: status='failed'
                    page.screenshot(path=str(target),full_page=True,animations='disabled')
                except Exception as exc:
                    errors.append({'type':'render','text':str(exc)}); status='failed'
                    try: page.screenshot(path=str(target),full_page=True,animations='disabled')
                    except: pass
                result={'route':route,'label':d['label'],'section':d['section'],'public':route in public_routes,'authenticatedFixture':authenticated,'evidenceBoundary':'governed-local-test-runtime','viewport':vname,'dimensions':viewport,'pageHeightPx':page_height,'heading':heading,'overflowPx':overflow,'consoleErrors':errors,'status':status,'elapsedMs':round((time.time()-started)*1000),'file':str(target.relative_to(ROOT))}
                results.append(result)
                print(json.dumps({'route':route,'viewport':vname,'status':status,'pageHeightPx':page_height,'overflowPx':overflow,'errors':errors,'elapsedMs':result['elapsedMs']}),flush=True)
                page.close()
            for c in contexts.values(): c.close()
        browser.close()
    batch={'start':start,'end':end,'routeCount':len(defs),'registryRouteCount':len(defs_all),'renderCount':len(results),'results':results}
    (OUT/f'batch-{start:03d}-{end:03d}.json').write_text(json.dumps(batch,indent=2)+'\n')
    if any(x['status']!='passed' for x in results): raise SystemExit(1)
finally:
    proc.terminate()
    try: proc.wait(timeout=5)
    except: proc.kill()
    shutil.rmtree(runtime,ignore_errors=True)
