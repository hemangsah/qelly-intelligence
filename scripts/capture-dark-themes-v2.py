import json, pathlib, subprocess, tempfile, time, urllib.request, shutil, sys
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont

ROOT=pathlib.Path('/mnt/data/QELLY_INTELLIGENCE_SOVEREIGN_DESIGN_REBUILD')
OUT=ROOT/'all-themes-gallery'
SHOTS=OUT/'screens'
SHOTS.mkdir(parents=True,exist_ok=True)
ROUTES=[
 ('market','Market Intelligence'),('rankings','Rankings'),('search','Universal Search'),('asset','Asset Overview'),('watchlist','Watchlist'),
 ('discovery-hub','Discovery Overview'),('asset-rankings','Cross-Asset Rankings'),('categories','Categories'),('category-detail','Category Detail'),('venues','Venues'),('venue-detail','Venue Detail'),('dex-discovery','DEX Discovery'),('global-charts','Global Charts'),('converter','Converter'),('news-research','News and Research'),('research-article','Research Article'),('trust-center','Trust Center'),
 ('asset-intelligence','Asset Intelligence'),('advanced-chart','Advanced Chart Studio'),('fundamentals-estimates','Fundamentals and Estimates'),('filing-workspace','Filing Workspace'),('event-calendar','Event Calendar'),('comparison-lab','Comparison Lab'),
 ('watchlist','Editable Watchlists'),('alert-center','Alert Center'),('notification-center','Notification Center'),('screener-lab','Screener Lab'),('portfolio-analytics','Portfolio Analytics'),('research-workspace','Research Workspace'),
 ('onboarding','Guided Onboarding'),('notification-schedules','Notification Schedules'),('formula-screener','Formula Screener'),('portfolio-attribution','Portfolio Attribution'),('import-center','Import Center'),('research-history','Research History'),
 ('theme-lab','Theme Laboratory'),('identity-access','Identity and Access'),('data-mesh','Provider Runtime'),('instrument-master','Instrument Master'),('timeseries-lab','Time Series Lab'),('stream-operations','Stream Operations'),('observability','Observability Center'),('security-evidence','Security Evidence'),('migration-center','Migration Center')
]
# remove duplicate route watchlist but keep route count consistent with actual definitions by unique route
seen=set(); ROUTES=[x for x in ROUTES if not (x[0] in seen or seen.add(x[0]))]
THEMES=[
 ('burgundy-night','Burgundy Nocturne'),('graphite-terminal','Graphite Reserve'),('midnight-research','Midnight Merlot')
]
INDEX=(ROOT/'apps/web/public/index.html').read_text().replace('<head>','<head><base href="https://qelly.test/">')
runtime=tempfile.mkdtemp(prefix='qelly-complete-theme-gallery-')
launcher="""
import { startServer } from './src/server/server.mjs';
const x=await startServer({port:0,runtimePath:process.argv[1]});
console.log(JSON.stringify({host:x.host,port:x.port}));
process.on('SIGTERM',()=>x.server.close(()=>process.exit(0)));
setInterval(()=>{},1000);
"""
proc=subprocess.Popen(['node','--input-type=module','-e',launcher,runtime],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
    line=proc.stdout.readline().strip()
    if not line:
        raise RuntimeError(proc.stderr.read())
    info=json.loads(line); base=f"http://127.0.0.1:{info['port']}"
    for _ in range(80):
        try: urllib.request.urlopen(base+'/api/health',timeout=1).read(); break
        except Exception: time.sleep(.1)
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(viewport={'width':1280,'height':900},device_scale_factor=1,reduced_motion='reduce')
        errors=[]
        def proxy(route_obj):
            parsed=urlsplit(route_obj.request.url)
            if parsed.path.startswith('/api/v1/stream/'):
                route_obj.fulfill(status=200,headers={'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache'},body='event: stream.snapshot.v1\ndata: {"sequence":1,"resumeToken":"offline-gallery"}\n\n')
                return
            target=base+parsed.path+('?' + parsed.query if parsed.query else '')
            data=route_obj.request.post_data.encode() if route_obj.request.post_data else None
            headers={k:v for k,v in route_obj.request.headers.items() if k.lower() not in {'host','content-length','accept-encoding','connection'}}
            req=urllib.request.Request(target,data=data,headers=headers,method=route_obj.request.method)
            try:
                with urllib.request.urlopen(req,timeout=20) as resp:
                    body=resp.read(); hs={k:v for k,v in resp.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length'}}
                    route_obj.fulfill(status=resp.status,headers=hs,body=body)
            except urllib.error.HTTPError as exc:
                body=exc.read(); hs={k:v for k,v in exc.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length'}}
                route_obj.fulfill(status=exc.code,headers=hs,body=body)
        context.route('**/*',proxy)
        for idx,(route,label) in enumerate(ROUTES,1):
            expected=[SHOTS/tid/f'{route}.jpg' for tid,_ in THEMES]
            if all(x.exists() for x in expected):
                print(f'{idx}/{len(ROUTES)} {route} already captured',flush=True)
                continue
            errors.clear()
            page=context.new_page()
            page.on('console',lambda msg: errors.append(msg.text) if msg.type=='error' else None)
            page.on('pageerror',lambda exc: errors.append(str(exc)))
            page.goto(f'about:blank#/{route}')
            page.set_content(INDEX,wait_until='load',timeout=30000)
            page.wait_for_selector('main#main .q-page',timeout=20000)
            page.wait_for_timeout(220)
            details=page.evaluate("""() => ({
              title: document.querySelector('main h1')?.textContent?.trim() || '',
              eyebrow: document.querySelector('main .q-eyebrow')?.textContent?.trim() || '',
              description: document.querySelector('main .q-page-head p:not(.q-eyebrow)')?.textContent?.trim() || '',
              panels: [...document.querySelectorAll('main h2')].map(x=>x.textContent.trim()).filter(Boolean).slice(0,8),
              controls: [...document.querySelectorAll('main button,main select,main input')].filter(x=>x.offsetParent!==null).map(x=>x.getAttribute('aria-label')||x.textContent.trim()||x.name||x.id||x.type).filter(Boolean).slice(0,12),
              interactiveCount: [...document.querySelectorAll('main button,main select,main input,main textarea,main a[href]')].filter(x=>x.offsetParent!==null).length
            })""")
            for theme_id,theme_label in THEMES:
                page.evaluate("theme => { document.documentElement.dataset.theme=theme; document.documentElement.style.removeProperty('--q-accent'); const s=document.getElementById('global-theme-selector'); if(s)s.value=theme; }",theme_id)
                page.wait_for_timeout(30)
                target=SHOTS/theme_id/f'{route}.jpg'; target.parent.mkdir(parents=True,exist_ok=True)
                page.screenshot(path=str(target),full_page=False,type='jpeg',quality=58)
                results.append({'route':route,'routeLabel':label,'theme':theme_id,'themeLabel':theme_label,'screenshot':str(target.relative_to(ROOT)),'details':details,'errors':list(errors)})
            page.close()
            print(f'{idx}/{len(ROUTES)} {route}',flush=True)
        context.close(); browser.close()
    manifest={'routeCount':len(ROUTES),'themeCount':len(THEMES),'screenThemeCount':len(results),'routes':[{'route':r,'label':l} for r,l in ROUTES],'themes':[{'id':i,'label':l} for i,l in THEMES],'items':results}
    (OUT/'gallery-manifest.json').write_text(json.dumps(manifest,indent=2))
    # theme contact sheets, 4 columns
    try: font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
    except: font=None
    for theme_id,theme_label in THEMES:
        cards=[]
        for route,label in ROUTES:
            img=Image.open(SHOTS/theme_id/f'{route}.jpg').convert('RGB'); img.thumbnail((300,210))
            card=Image.new('RGB',(320,250),'white'); card.paste(img,((320-img.width)//2,28+(210-img.height)//2))
            d=ImageDraw.Draw(card); d.text((10,7),label,fill='black',font=font)
            cards.append(card)
        cols=4; rows=(len(cards)+cols-1)//cols
        sheet=Image.new('RGB',(cols*320,rows*250),'white')
        for i,c in enumerate(cards): sheet.paste(c,((i%cols)*320,(i//cols)*250))
        sheet.save(OUT/f'QELLY_{theme_id.upper().replace("-","_")}_ALL_SCREENS_CONTACT_SHEET.jpg',quality=85)
    print(json.dumps({'routes':len(ROUTES),'themes':len(THEMES),'screens':len(results),'errors':sum(bool(x['errors']) for x in results)},indent=2))
finally:
    proc.terminate()
    try: proc.wait(timeout=5)
    except subprocess.TimeoutExpired: proc.kill()
    shutil.rmtree(runtime,ignore_errors=True)
