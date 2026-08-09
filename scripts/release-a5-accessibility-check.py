import json, mimetypes, pathlib, subprocess, tempfile, time, shutil, urllib.request, urllib.error
from urllib.parse import unquote, urlsplit
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUBLIC_ROOT = (ROOT / 'dist/frontend').resolve()
INDEX_PATH = PUBLIC_ROOT / 'index.html'
if not INDEX_PATH.is_file():
    raise RuntimeError('Built frontend is missing; run the frontend build before accessibility validation')
INDEX = INDEX_PATH.read_text().replace('<head>', '<head><base href="https://qelly.test/">', 1)
SESSION_ID='sess-local-primary'
CRITICAL_RESOURCE_TYPES={'document','script','stylesheet','font','image'}
MIME_OVERRIDES={'.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.html':'text/html; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2'}

def local_public_file(request_path):
    relative=unquote(request_path).lstrip('/')
    if not relative: return None
    candidate=(PUBLIC_ROOT/relative).resolve()
    try: candidate.relative_to(PUBLIC_ROOT)
    except ValueError: return None
    return candidate if candidate.is_file() else None

def content_type(path):
    return MIME_OVERRIDES.get(path.suffix.lower()) or mimetypes.guess_type(path.name)[0] or 'application/octet-stream'

def request_json(base,path,authenticated=False):
    headers={'Accept':'application/json'}
    if authenticated: headers['X-Qelly-Session-Id']=SESSION_ID
    request=urllib.request.Request(base+path,headers=headers)
    with urllib.request.urlopen(request,timeout=20) as response:
        return json.loads(response.read().decode('utf-8'))

route_json=subprocess.check_output(['node','--input-type=module','-e',"import {routeDefinitions} from './dist/frontend/assets/route-registry.mjs'; console.log(JSON.stringify(routeDefinitions));"],cwd=ROOT,text=True)
route_labels={item['route']:item['label'] for item in json.loads(route_json)}
runtime=tempfile.mkdtemp(prefix='qelly-a5-a11y-')
launcher=r'''
import { startServer } from './src/server/server.mjs';
const fixtureSeed=['release','a5','accessibility','fixture','0000001'].join('-');
const environment={...process.env,NODE_ENV:'test',QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'false',QELLY_DEVELOPMENT_IDENTITY_ENABLED:'true',QELLY_DEVELOPMENT_IDENTITY_EXPLICIT_HEADER_ONLY:'true',QELLY_DATABASE_MODE:'sqlite',QELLY_JOB_QUEUE_MODE:'database',QELLY_SESSION_SECRET:fixtureSeed+'-session',QELLY_PASSWORD_PEPPER:fixtureSeed+'-pepper',QELLY_EXPOSE_RECOVERY_CODE_IN_DEVELOPMENT:'false',QELLY_LIVE_MARKET_ENABLED:'false',QELLY_EXTERNAL_PROVIDERS_ENABLED:'false',QELLY_SECRET_KEYRING_JSON:JSON.stringify({old:fixtureSeed+'-old-key-material',active:fixtureSeed+'-active-key-material'}),QELLY_SECRET_ACTIVE_KEY_ID:'active'};
const x=await startServer({port:0,runtimePath:process.argv[1],environment});
console.log(JSON.stringify({host:x.host,port:x.port}));
process.on('SIGTERM',()=>x.server.close(()=>process.exit(0)));setInterval(()=>{},1000);
'''
EVALUATE=r'''() => {
 const visible=el=>!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length);
 const controls=[...document.querySelectorAll('button,input,select,textarea,a[href]')].filter(visible);
 const named=el=>Boolean((el.getAttribute('aria-label')||el.getAttribute('title')||(el.textContent||'').trim()||(el.labels&&[...el.labels].some(l=>(l.textContent||'').trim()))));
 const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);
 return {lang:document.documentElement.lang,title:document.title,skipLink:!!document.querySelector('a.skip-link[href="#main"]'),mainCount:document.querySelectorAll('main#main').length,h1Count:document.querySelectorAll('main#main h1').length,unlabeled:controls.filter(x=>!named(x)).map(x=>({tag:x.tagName,id:x.id||null})).slice(0,10),missingAlt:[...document.querySelectorAll('img:not([alt])')].length,positiveTabindex:[...document.querySelectorAll('[tabindex]')].filter(x=>Number(x.getAttribute('tabindex'))>0).length,duplicateIds:[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))],overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,controls:controls.length,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,fontStatus:document.fonts.status};
}'''
SAVED_SEED={'schemaVersion':2,'items':[{'id':'prompt2b-review-saved','name':'Prompt 2B Review Present Value','savedAt':'2026-07-30T00:00:00.000Z','updatedAt':'2026-07-30T00:05:00.000Z','schemaVersion':2,'version':2,'formulaVersion':'2.0.0','indicatorVersion':None,'indiaRuleVersion':None,'effectiveDate':'2026-07-30','result':{'status':'success','formulaId':'fresh-present-value','formulaVersion':'2.0.0','outputs':{'value':100},'truthState':'FRESH_REIMPLEMENTATION_2026'},'notes':'Accessibility review seed','tags':['prompt2b','a11y'],'favorite':True,'revisions':[{'revisionId':'a11y-r1','version':1,'createdAt':'2026-07-30T00:00:00.000Z','restoredFrom':None,'name':'Prompt 2B Review Present Value','result':{'status':'success','formulaId':'fresh-present-value','formulaVersion':'2.0.0','outputs':{'value':100}},'notes':'Baseline','tags':['prompt2b'],'favorite':False,'formulaVersion':'2.0.0','indicatorVersion':None,'indiaRuleVersion':None,'effectiveDate':'2026-07-30'},{'revisionId':'a11y-r2','version':2,'createdAt':'2026-07-30T00:05:00.000Z','restoredFrom':None,'name':'Prompt 2B Review Present Value','result':{'status':'success','formulaId':'fresh-present-value','formulaVersion':'2.0.0','outputs':{'value':100}},'notes':'Accessibility review seed','tags':['prompt2b','a11y'],'favorite':True,'formulaVersion':'2.0.0','indicatorVersion':None,'indiaRuleVersion':None,'effectiveDate':'2026-07-30'}]}]}

proc=subprocess.Popen(['node','--input-type=module','-e',launcher,runtime],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
    line=proc.stdout.readline().strip()
    if not line: raise RuntimeError(proc.stderr.read())
    info=json.loads(line); base=f"http://127.0.0.1:{info['port']}"; print('a11y server',base,flush=True)
    anonymous_config=request_json(base,'/api/v1/config')
    authenticated_config=request_json(base,'/api/v1/config',authenticated=True)
    authenticated_status=request_json(base,'/api/v1/auth/status',authenticated=True)
    if anonymous_config.get('auth',{}).get('authenticated') is not False: raise RuntimeError('anonymous accessibility preflight did not remain anonymous')
    if authenticated_config.get('auth',{}).get('authenticated') is not True: raise RuntimeError('authenticated accessibility preflight failed /api/v1/config')
    if authenticated_status.get('authenticated') is not True: raise RuntimeError('authenticated accessibility preflight failed /api/v1/auth/status')
    routes=[
        ('auth-login','auth-login',False),('auth-register','auth-register',False),('auth-recovery','auth-recovery',False),
        ('account-session','account-session',True),('onboarding','onboarding',True),('discovery-hub','discovery-hub',True),
        ('live-markets','live-markets',True),('identity-access','identity-access',True),('security-evidence','security-evidence',True),
        ('security-setup','security-setup',True),('secure-import-vault','secure-import-vault',True),('passkey-center','passkey-center',True),
        ('account-recovery','account-recovery',True),('delivery-operations','delivery-operations',True),('platform-readiness','platform-readiness',True),
        ('secret-rotation','secret-rotation',True),('quarantine-review','quarantine-review',True),('staging-assurance','staging-assurance',True),
        ('calculator-center','calculator-center',False),('india-finance','india-finance',False),('indicator-library','indicator-library',False),
        ('formula-library','formula-library',False),('saved-calculations','saved-calculations',False),
        ('formula-detail','formula-detail/fresh-present-value',False),('indicator-detail','indicator-detail/fresh-price-momentum',False),
        ('calculator-detail','calculator-detail/fresh-present-value',False),('saved-calculation-detail','saved-calculation-detail/prompt2b-review-saved',False)
    ]
    if len(routes)!=27: raise RuntimeError(f'Expected 27 unique routes, received {len(routes)}')
    missing_labels=[route_key for route_key,_,_ in routes if route_key not in route_labels]
    if missing_labels: raise RuntimeError(f'Missing governed route labels: {missing_labels}')
    viewports=[('desktop',{'width':1440,'height':1000}),('mobile',{'width':390,'height':844})]; results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        for vname,viewport in viewports:
            for route_key,route_path,auth in routes:
                context=browser.new_context(viewport=viewport,reduced_motion='reduce' if vname=='mobile' else 'no-preference')
                context.add_init_script("sessionStorage.setItem('qelly.brand.opening.v1','seen');localStorage.setItem('qelly.calculations.v1',"+json.dumps(json.dumps(SAVED_SEED))+');')
                page=context.new_page(); errors=[]; observations=[]
                def on_console(message):
                    if message.type!='error': return
                    item={'type':'console','text':message.text}
                    if message.text.startswith('Failed to load resource:'): observations.append(item)
                    else: errors.append(item)
                def on_request_failed(request):
                    item={'type':'requestfailed','resourceType':request.resource_type,'url':request.url,'failure':request.failure}
                    if request.resource_type in CRITICAL_RESOURCE_TYPES: errors.append(item)
                    else: observations.append(item)
                def on_response(response):
                    if response.status<400: return
                    item={'type':'http','resourceType':response.request.resource_type,'status':response.status,'url':response.url}
                    if response.request.resource_type in CRITICAL_RESOURCE_TYPES: errors.append(item)
                    else: observations.append(item)
                page.on('console',on_console)
                page.on('pageerror',lambda exc,target=errors: target.append({'type':'pageerror','text':str(exc)}))
                page.on('response',on_response)
                page.on('requestfailed',on_request_failed)
                is_authenticated=auth
                current_route=route_key
                def proxy(route_obj):
                    parsed=urlsplit(route_obj.request.url)
                    if parsed.netloc=='qelly.test' and parsed.path in ('/','/index.html') and route_obj.request.resource_type=='document':
                        route_obj.fulfill(status=200,headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body=INDEX); return
                    if parsed.netloc=='qelly.test':
                        asset=local_public_file(parsed.path)
                        if asset is not None:
                            route_obj.fulfill(status=200,headers={'Content-Type':content_type(asset),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body=asset.read_bytes()); return
                    if not is_authenticated and parsed.path=='/api/v1/config':
                        public_config=dict(anonymous_config); public_config['auth']={**public_config.get('auth',{}),'authenticated':False}; public_config['defaultRoute']=current_route
                        route_obj.fulfill(status=200,headers={'Content-Type':'application/json; charset=utf-8'},body=json.dumps(public_config)); return
                    if not is_authenticated and parsed.path=='/api/v1/auth/status':
                        route_obj.fulfill(status=200,headers={'Content-Type':'application/json; charset=utf-8'},body=json.dumps({'authenticated':False,'mode':'anonymous-test-runtime','productionFoundation':{'developmentIdentityEnabled':True}})); return
                    if parsed.netloc=='unpkg.com': route_obj.fulfill(status=200,headers={'Content-Type':'application/javascript'},body='window.LightweightCharts=window.LightweightCharts||undefined;'); return
                    if parsed.path.startswith('/api/v1/stream/'): route_obj.fulfill(status=200,headers={'Content-Type':'text/event-stream'},body='event: stream.heartbeat.v1\ndata: {"status":"a11y"}\n\n'); return
                    target=base+parsed.path+('?' + parsed.query if parsed.query else ''); data=route_obj.request.post_data.encode() if route_obj.request.post_data else None
                    headers={k:v for k,v in route_obj.request.headers.items() if k.lower() not in {'host','content-length','accept-encoding','connection','origin','referer','cookie','x-qelly-session-id'}}
                    if is_authenticated: headers['X-Qelly-Session-Id']=SESSION_ID
                    request=urllib.request.Request(target,data=data,headers=headers,method=route_obj.request.method)
                    try:
                        with urllib.request.urlopen(request,timeout=20) as proxied: route_obj.fulfill(status=proxied.status,headers={k:v for k,v in proxied.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length','set-cookie'}},body=proxied.read())
                    except urllib.error.HTTPError as exc: route_obj.fulfill(status=exc.code,headers={k:v for k,v in exc.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length','set-cookie'}},body=exc.read())
                page.route('**/*',proxy); failures=[]; checks={}; focus=None
                expected_title=f"{route_labels[route_key]} · Qelly Intelligence"; expected_hash=f'#/{route_path}'
                try:
                    page.goto(f'https://qelly.test/#/{route_path}',wait_until='domcontentloaded',timeout=30000)
                    page.wait_for_selector('main#main h1',timeout=20000)
                    page.wait_for_function("([expectedTitle,expectedHash])=>document.title===expectedTitle&&location.hash.split('?')[0]===expectedHash&&document.querySelector('main#main')?.getAttribute('aria-busy')!=='true'",arg=[expected_title,expected_hash],timeout=20000)
                    page.evaluate('document.fonts?.ready'); page.wait_for_timeout(180); checks=page.evaluate(EVALUATE); page.keyboard.press('Tab'); focus=page.evaluate("({tag:document.activeElement?.tagName,id:document.activeElement?.id||null})")
                    if checks['lang']!='en': failures.append('html-lang')
                    if checks['title']!=expected_title: failures.append('title')
                    if not checks['skipLink']: failures.append('skip-link')
                    if checks['mainCount']!=1: failures.append('single-main')
                    if checks['h1Count']<1: failures.append('h1')
                    if checks['unlabeled']: failures.append('control-name')
                    if checks['missingAlt']: failures.append('image-alt')
                    if checks['positiveTabindex']: failures.append('positive-tabindex')
                    if checks['duplicateIds']: failures.append('duplicate-id')
                    if checks['overflow']>2: failures.append('overflow')
                    if checks['fontStatus']!='loaded': failures.append('font')
                    if focus['tag'] in (None,'BODY','HTML'): failures.append('keyboard-entry')
                    if errors: failures.append('console-errors')
                except Exception as exc:
                    failures=['render-failure']; errors.append({'type':'render','text':str(exc),'title':page.title(),'hash':page.evaluate("location.hash.split('?')[0]"),'ariaBusy':page.locator('main#main').get_attribute('aria-busy')})
                results.append({'route':route_key,'path':route_path,'viewport':vname,'dimensions':viewport,'authenticated':auth,'expectedTitle':expected_title,'expectedHash':expected_hash,'checks':checks,'firstTabFocus':focus,'consoleErrors':errors,'networkObservations':observations,'criticalFailures':failures,'status':'passed' if not failures else 'failed'}); context.close()
        browser.close()
    failed=[item for item in results if item['status']=='failed']; expected_checks=54
    if len(results)!=expected_checks: failed.append({'route':'denominator','criticalFailures':[f'{len(results)}/{expected_checks}'],'status':'failed'})
    failed_result_count=len([item for item in results if item['status']=='failed'])
    log={'release':'Prompt 2B final','generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'method':'automated semantic, keyboard-entry, exact-font and responsive regression; not an independent WCAG certification','routeCount':len(routes),'viewportCount':len(viewports),'expectedChecks':expected_checks,'checks':len(results),'passed':len(results)-failed_result_count,'failed':len(failed),'results':results,'status':'passed' if not failed else 'failed'}
    (ROOT/'validation'/'RELEASE_A5_ACCESSIBILITY_REGRESSION.json').write_text(json.dumps(log,indent=2)+'\n'); print(json.dumps({'release':log['release'],'checks':log['checks'],'expectedChecks':expected_checks,'passed':log['passed'],'failed':log['failed'],'failures':failed},indent=2))
    if failed: raise SystemExit(1)
finally:
    proc.terminate()
    try: proc.wait(timeout=5)
    except subprocess.TimeoutExpired: proc.kill()
    shutil.rmtree(runtime,ignore_errors=True)
