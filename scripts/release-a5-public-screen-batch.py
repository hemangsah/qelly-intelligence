import json,pathlib,subprocess,tempfile,time,shutil,urllib.request,urllib.error
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1];INDEX=(ROOT/'apps/web/public/index.html').read_text().replace('<head>','<head><base href="https://qelly.test/">');OUT=ROOT/'preview'/'release-a5-all-screens';OUT.mkdir(parents=True,exist_ok=True);runtime=tempfile.mkdtemp(prefix='qelly-a5-public-')
defs=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {routeDefinitions} from './apps/web/public/assets/route-registry.mjs'; console.log(JSON.stringify(routeDefinitions.filter(x=>x.public)));"],cwd=ROOT,text=True))
launcher=r"""import {startServer} from './src/server/server.mjs';const environment={...process.env,NODE_ENV:'test',QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'true',QELLY_DEVELOPMENT_IDENTITY_ENABLED:'false',QELLY_DATABASE_MODE:'sqlite',QELLY_JOB_QUEUE_MODE:'database',QELLY_SESSION_SECRET:'release-a5-public-session-secret-00000000001',QELLY_PASSWORD_PEPPER:'release-a5-public-pepper'};const x=await startServer({port:0,runtimePath:process.argv[1],environment});console.log(JSON.stringify({port:x.port}));process.on('SIGTERM',()=>x.server.close(()=>process.exit(0)));setInterval(()=>{},1000);"""
proc=subprocess.Popen(['node','--input-type=module','-e',launcher,runtime],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
 info=json.loads(proc.stdout.readline());base=f"http://127.0.0.1:{info['port']}";results=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  for vname,viewport in [('desktop',{'width':1440,'height':1000}),('mobile',{'width':390,'height':844})]:
   context=browser.new_context(viewport=viewport,reduced_motion='reduce')
   for d in defs:
    route=d['route'];page=context.new_page();errors=[];page.on('console',lambda m,e=errors:e.append({'type':'console','text':m.text}) if m.type=='error' else None);page.on('pageerror',lambda e,es=errors:es.append({'type':'pageerror','text':str(e)}))
    def proxy(ro):
     current=route
     parsed=urlsplit(ro.request.url)
     if parsed.netloc=='unpkg.com':ro.fulfill(status=200,body='window.LightweightCharts=undefined;');return
     if parsed.path=='/api/v1/config':
      with urllib.request.urlopen(base+parsed.path,timeout=15) as x:data=json.loads(x.read())
      data['auth']['authenticated']=False;data['defaultRoute']=current;ro.fulfill(status=200,headers={'Content-Type':'application/json'},body=json.dumps(data));return
     if parsed.path=='/api/v1/auth/status':ro.fulfill(status=200,headers={'Content-Type':'application/json'},body=json.dumps({'authenticated':False,'mode':'production-cookie','productionFoundation':{'developmentIdentityEnabled':False}}));return
     target=base+parsed.path+('?' + parsed.query if parsed.query else '')
     try:
      with urllib.request.urlopen(target,timeout=15) as x:ro.fulfill(status=x.status,headers={k:v for k,v in x.headers.items() if k.lower() not in {'content-length','content-encoding','transfer-encoding','connection','set-cookie'}},body=x.read())
     except urllib.error.HTTPError as e:ro.fulfill(status=e.code,body=e.read())
    page.route('**/*',proxy);started=time.time();target=OUT/f'{route}__{vname}.png';heading=None;overflow=None;status='passed'
    try:
     page.goto(f'about:blank#/{route}');page.set_content(INDEX,wait_until='domcontentloaded');page.wait_for_selector('main#main h1',timeout=15000);page.wait_for_timeout(220);heading=page.locator('main#main h1').first.text_content();overflow=page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth');status='failed' if overflow>2 or errors else 'passed';page.screenshot(path=str(target),full_page=False,animations='disabled')
    except Exception as e:errors.append({'type':'render','text':str(e)});status='failed'
    results.append({'route':route,'label':d['label'],'section':d['section'],'viewport':vname,'dimensions':viewport,'heading':heading,'overflowPx':overflow,'consoleErrors':errors,'status':status,'elapsedMs':round((time.time()-started)*1000),'file':str(target.relative_to(ROOT))});print(route,vname,heading,status);page.close()
   context.close()
  browser.close()
 (OUT/'batch-000-003.json').write_text(json.dumps({'start':0,'end':3,'routeCount':3,'renderCount':len(results),'results':results},indent=2)+'\n')
 if any(x['status']!='passed' for x in results):raise SystemExit(1)
finally:
 proc.terminate();shutil.rmtree(runtime,ignore_errors=True)
