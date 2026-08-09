from pathlib import Path
import json
import mimetypes
import os
import shutil
import subprocess
import tempfile
import urllib.error
import urllib.request
from urllib.parse import unquote, urlsplit
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PUBLIC_ROOT=(ROOT/'dist/frontend').resolve()
INDEX_PATH=PUBLIC_ROOT/'index.html'
OUT=ROOT/'preview'/'v53-accessibility-focus'
SESSION_ID='sess-local-primary'
EXPECTED_ORIGIN='https://qelly.test'
CRITICAL_RESOURCE_TYPES={'document','script','stylesheet','font','image'}
MIME_OVERRIDES={'.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.html':'text/html; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2'}
ZOOM_ROUTES=['market','research-workspace','portfolio-analytics','theme-lab','decision-provenance','formula-library']

if not INDEX_PATH.is_file():
    raise SystemExit('built frontend missing; run npm run build:frontend first')
INDEX=INDEX_PATH.read_text(encoding='utf-8').replace('<head>','<head><base href="https://qelly.test/">',1)


def local_public_file(request_path):
    relative=unquote(request_path).lstrip('/')
    if not relative:return None
    candidate=(PUBLIC_ROOT/relative).resolve()
    try:candidate.relative_to(PUBLIC_ROOT)
    except ValueError:return None
    return candidate if candidate.is_file() else None


def content_type(path):
    return MIME_OVERRIDES.get(path.suffix.lower()) or mimetypes.guess_type(path.name)[0] or 'application/octet-stream'


def request_json(base,path,authenticated=True):
    headers={'Accept':'application/json'}
    if authenticated:headers['X-Qelly-Session-Id']=SESSION_ID
    request=urllib.request.Request(base+path,headers=headers)
    with urllib.request.urlopen(request,timeout=20) as response:
        return json.loads(response.read().decode('utf-8'))


def start_runtime():
    runtime=tempfile.mkdtemp(prefix='qelly-v53-a11y-focus-')
    launcher=r'''
import { startServer } from './src/server/server.mjs';
const seed=['qelly','v53','a11y','focus','fixture','0000001'].join('-');
const environment={...process.env,NODE_ENV:'test',QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'false',QELLY_DEVELOPMENT_IDENTITY_ENABLED:'true',QELLY_DEVELOPMENT_IDENTITY_EXPLICIT_HEADER_ONLY:'true',QELLY_DATABASE_MODE:'sqlite',QELLY_JOB_QUEUE_MODE:'database',QELLY_SESSION_SECRET:seed+'-session',QELLY_PASSWORD_PEPPER:seed+'-pepper',QELLY_EXPOSE_RECOVERY_CODE_IN_DEVELOPMENT:'false',QELLY_LIVE_MARKET_ENABLED:'false',QELLY_EXTERNAL_PROVIDERS_ENABLED:'false',QELLY_SECRET_KEYRING_JSON:JSON.stringify({old:seed+'-old-key-material',active:seed+'-active-key-material'}),QELLY_SECRET_ACTIVE_KEY_ID:'active'};
const instance=await startServer({port:0,runtimePath:process.argv[1],environment});
console.log(JSON.stringify({host:instance.host,port:instance.port}));
process.on('SIGTERM',()=>instance.server.close(()=>process.exit(0)));setInterval(()=>{},1000);
'''
    proc=subprocess.Popen(['node','--input-type=module','-e',launcher,runtime],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    line=proc.stdout.readline().strip()
    if not line:raise RuntimeError(proc.stderr.read())
    info=json.loads(line)
    return runtime,proc,f"http://127.0.0.1:{info['port']}"


def install_proxy(page,base):
    errors=[];observations=[]
    def on_console(message):
        if message.type!='error':return
        item={'type':'console','text':message.text}
        if message.text.startswith('Failed to load resource:'):observations.append(item)
        else:errors.append(item)
    def on_request_failed(request):
        item={'type':'requestfailed','resourceType':request.resource_type,'url':request.url,'failure':request.failure}
        (errors if request.resource_type in CRITICAL_RESOURCE_TYPES else observations).append(item)
    def on_response(response):
        if response.status<400:return
        item={'type':'http','resourceType':response.request.resource_type,'status':response.status,'url':response.url}
        (errors if response.request.resource_type in CRITICAL_RESOURCE_TYPES else observations).append(item)
    page.on('console',on_console);page.on('requestfailed',on_request_failed);page.on('response',on_response)
    page.on('pageerror',lambda exc:errors.append({'type':'pageerror','text':str(exc)}))
    def proxy(route_obj):
        parsed=urlsplit(route_obj.request.url)
        if parsed.netloc=='qelly.test' and parsed.path in ('/','/index.html') and route_obj.request.resource_type=='document':
            route_obj.fulfill(status=200,headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body=INDEX);return
        if parsed.netloc=='qelly.test':
            asset=local_public_file(parsed.path)
            if asset is not None:
                route_obj.fulfill(status=200,headers={'Content-Type':content_type(asset),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body=asset.read_bytes());return
        if parsed.netloc=='unpkg.com':
            route_obj.fulfill(status=200,headers={'Content-Type':'application/javascript; charset=utf-8'},body='window.LightweightCharts=window.LightweightCharts||undefined;');return
        if parsed.path.startswith('/api/v1/stream/'):
            route_obj.fulfill(status=200,headers={'Content-Type':'text/event-stream; charset=utf-8'},body='event: stream.heartbeat.v1\ndata: {"status":"v53-a11y-focus"}\n\n');return
        target=base+parsed.path+('?' + parsed.query if parsed.query else '')
        data=route_obj.request.post_data.encode() if route_obj.request.post_data else None
        headers={k:v for k,v in route_obj.request.headers.items() if k.lower() not in {'host','content-length','accept-encoding','connection','origin','referer','cookie','x-qelly-session-id'}}
        headers['X-Qelly-Session-Id']=SESSION_ID
        request=urllib.request.Request(target,data=data,headers=headers,method=route_obj.request.method)
        try:
            with urllib.request.urlopen(request,timeout=20) as proxied:
                route_obj.fulfill(status=proxied.status,headers={k:v for k,v in proxied.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length','set-cookie'}},body=proxied.read())
        except urllib.error.HTTPError as exc:
            route_obj.fulfill(status=exc.code,headers={k:v for k,v in exc.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length','set-cookie'}},body=exc.read())
        except Exception as exc:
            route_obj.fulfill(status=502,headers={'Content-Type':'application/json'},body=json.dumps({'error':'proxy_failed','message':str(exc)}))
    page.route('**/*',proxy)
    return errors,observations


def wait_route(page,label,route):
    expected_title=f'{label} · Qelly Intelligence';expected_hash=f'#/{route}'
    page.goto(f'{EXPECTED_ORIGIN}/#/{route}',wait_until='domcontentloaded',timeout=30000)
    page.wait_for_selector('main#main h1',timeout=20000)
    page.wait_for_function("([title,hash])=>document.title===title&&location.hash.split('?')[0]===hash&&document.querySelector('main#main')?.getAttribute('aria-busy')!=='true'",arg=[expected_title,expected_hash],timeout=20000)
    page.evaluate('document.fonts?.ready');page.wait_for_timeout(250)


def focus_sequence(page,count=8):
    sequence=[]
    for _ in range(count):
        page.keyboard.press('Tab')
        sequence.append(page.evaluate("() => {const e=document.activeElement;return {tag:e?.tagName||null,id:e?.id||null,label:e?.getAttribute?.('aria-label')||e?.getAttribute?.('title')||(e?.textContent||'').trim().slice(0,80)||null}}"))
    return sequence


def main():
    if OUT.exists():shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    route_json=subprocess.check_output(['node','--input-type=module','-e',"import {routeDefinitions} from './dist/frontend/assets/route-registry.mjs'; console.log(JSON.stringify(routeDefinitions));"],cwd=ROOT,text=True)
    definitions=json.loads(route_json);labels={item['route']:item['label'] for item in definitions}
    missing=[route for route in ZOOM_ROUTES if route not in labels]
    if missing:raise SystemExit(f'missing governed zoom routes: {missing}')
    foundation=(PUBLIC_ROOT/'assets'/'theme-intelligence-foundations.css').read_text(encoding='utf-8')
    static_colorblind={'paletteRule':'data-market-palette="color-blind"' in foundation,'downDashCue':'stroke-dasharray:2 1' in foundation,'upSolidCue':'stroke-dasharray:none' in foundation}
    runtime,proc,base=start_runtime()
    try:
        config=request_json(base,'/api/v1/config',True);status=request_json(base,'/api/v1/auth/status',True)
        if config.get('auth',{}).get('authenticated') is not True or status.get('authenticated') is not True:raise RuntimeError('authenticated accessibility-focus preflight failed')
        zoom_results=[];colorblind_result={}
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            for route in ZOOM_ROUTES:
                context=browser.new_context(viewport={'width':720,'height':450},device_scale_factor=2,reduced_motion='reduce',color_scheme='dark')
                context.add_init_script("sessionStorage.setItem('qelly.brand.opening.v1','seen');")
                page=context.new_page();errors,observations=install_proxy(page,base);failure=[]
                try:
                    wait_route(page,labels[route],route)
                    checks=page.evaluate(r"""() => {
                      const visible=(el)=>Boolean(el.offsetWidth||el.offsetHeight||el.getClientRects().length);
                      const named=(el)=>Boolean(el.getAttribute('aria-label')||el.getAttribute('title')||(el.textContent||'').trim()||(el.labels&&[...el.labels].some((label)=>(label.textContent||'').trim())));
                      const controls=[...document.querySelectorAll('button,input,select,textarea,a[href]')].filter(visible);
                      return {
                        cssViewport:{width:innerWidth,height:innerHeight},dpr:devicePixelRatio,
                        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
                        mainCount:document.querySelectorAll('main#main').length,h1Count:document.querySelectorAll('main#main h1').length,
                        hiddenMotion:[...document.querySelectorAll('.q-motion-item:not(.is-inview)')].length,
                        reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
                        reducedReveal:document.documentElement.dataset.v53ReducedMotionReveal||null,
                        unlabeled:controls.filter((el)=>!named(el)).length
                      };
                    }""")
                    focus=focus_sequence(page)
                    focusable=[item for item in focus if item['tag'] not in (None,'BODY','HTML')]
                    focus_signatures={(item.get('tag'),item.get('id'),item.get('label')) for item in focusable}
                    if checks['cssViewport']!={'width':720,'height':450}:failure.append('zoom-css-viewport')
                    if checks['dpr']!=2:failure.append('zoom-dpr')
                    if checks['overflow']>2:failure.append('horizontal-overflow')
                    if checks['mainCount']!=1 or checks['h1Count']<1:failure.append('semantic-landmarks')
                    if checks['hiddenMotion']!=0 or checks['reduced'] is not True or checks['reducedReveal']!='immediate':failure.append('reduced-motion-visibility')
                    if checks['unlabeled']!=0:failure.append('accessible-name')
                    if len(focusable)<4 or len(focus_signatures)<2:failure.append('keyboard-sequence')
                    if errors:failure.append('critical-browser-error')
                    screenshot=OUT/f'{route}__zoom200.png';page.screenshot(path=str(screenshot),full_page=True,animations='disabled')
                    zoom_results.append({'route':route,'label':labels[route],'physicalTarget':{'width':1440,'height':900},'effectiveCssViewport':checks['cssViewport'],'deviceScaleFactor':checks['dpr'],'checks':checks,'focusSequence':focus,'browserErrors':errors,'networkObservations':observations,'status':'passed' if not failure else 'failed','failures':failure,'file':str(screenshot.relative_to(ROOT))})
                except Exception as exc:
                    zoom_results.append({'route':route,'label':labels[route],'status':'failed','failures':['render-failure'],'browserErrors':errors+[{'type':'render','text':str(exc)}]})
                context.close()

            context=browser.new_context(viewport={'width':1280,'height':800},device_scale_factor=1,reduced_motion='reduce',color_scheme='dark')
            context.add_init_script("sessionStorage.setItem('qelly.brand.opening.v1','seen');")
            page=context.new_page();errors,observations=install_proxy(page,base);failure=[]
            try:
                wait_route(page,labels['market'],'market')
                page.evaluate(r"""async () => {const module=await import('./assets/theme-intelligence.mjs');module.themeIntelligence.preview({marketPalette:'color-blind'});}""")
                page.wait_for_timeout(120)
                checks=page.evaluate(r"""() => {
                  const style=getComputedStyle(document.documentElement);const text=(document.querySelector('#main')?.innerText||'');
                  return {palette:document.documentElement.dataset.marketPalette,positive:style.getPropertyValue('--q-positive').trim().toUpperCase(),negative:style.getPropertyValue('--q-negative').trim().toUpperCase(),warning:style.getPropertyValue('--q-warning').trim().toUpperCase(),hasSignedPositive:/\+\s*\d/.test(text),hasSignedNegative:/[-−]\s*\d/.test(text),hiddenMotion:[...document.querySelectorAll('.q-motion-item:not(.is-inview)')].length,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
                }""")
                if checks['palette']!='color-blind':failure.append('palette-activation')
                if checks['positive']!='#168AAD' or checks['negative']!='#D1495B' or checks['warning']!='#F3A712':failure.append('palette-token')
                if not static_colorblind['paletteRule'] or not static_colorblind['downDashCue'] or not static_colorblind['upSolidCue']:failure.append('non-color-css-cue')
                if not (checks['hasSignedPositive'] and checks['hasSignedNegative']):failure.append('non-color-text-cue')
                if checks['hiddenMotion']!=0:failure.append('reduced-motion-visibility')
                if checks['overflow']>2:failure.append('horizontal-overflow')
                if errors:failure.append('critical-browser-error')
                screenshot=OUT/'market__color-blind.png';page.screenshot(path=str(screenshot),full_page=True,animations='disabled')
                colorblind_result={'route':'market','checks':checks,'staticContract':static_colorblind,'browserErrors':errors,'networkObservations':observations,'status':'passed' if not failure else 'failed','failures':failure,'file':str(screenshot.relative_to(ROOT))}
            except Exception as exc:
                colorblind_result={'route':'market','status':'failed','failures':['render-failure'],'browserErrors':errors+[{'type':'render','text':str(exc)}],'staticContract':static_colorblind}
            context.close();browser.close()
        failed=[item for item in zoom_results if item['status']!='passed'];passed=not failed and colorblind_result.get('status')=='passed'
        manifest={'schemaVersion':2,'evidenceHead':os.getenv('QELLY_V53_EVIDENCE_SHA','local'),'boundary':'governed local test runtime; exact compiled frontend; no production user data','canonicalRouteCount':len(definitions),'zoomModel':'1440x900 physical target represented by 720x450 CSS viewport at deviceScaleFactor 2','zoomRouteCount':len(ZOOM_ROUTES),'zoomResults':zoom_results,'colorBlind':colorblind_result,'failureCount':len(failed)+(0 if colorblind_result.get('status')=='passed' else 1),'status':'passed' if passed else 'failed'}
        (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
        print(json.dumps({'canonicalRouteCount':manifest['canonicalRouteCount'],'zoomRouteCount':manifest['zoomRouteCount'],'failureCount':manifest['failureCount'],'colorBlindStatus':colorblind_result.get('status'),'status':manifest['status']},indent=2))
        if not passed:raise SystemExit(1)
    finally:
        proc.terminate()
        try:proc.wait(timeout=5)
        except Exception:proc.kill()
        shutil.rmtree(runtime,ignore_errors=True)

if __name__=='__main__':main()
