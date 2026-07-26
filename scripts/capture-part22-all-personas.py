import json, pathlib, subprocess, tempfile, time, urllib.request, urllib.error, shutil, os
from urllib.parse import urlsplit
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'all-personas-gallery'; SHOTS=OUT/'screens'
SHOTS.mkdir(parents=True,exist_ok=True)
ROUTES=json.loads(subprocess.check_output(['node','-e',"import('./apps/web/public/assets/route-registry.mjs').then(m=>process.stdout.write(JSON.stringify(m.routeDefinitions)))"],cwd=ROOT,text=True))
INDEX=(ROOT/'apps/web/public/index.html').read_text().replace('<head>','<head><base href="https://qelly.test/">')
THEMES=[('burgundy-command','Scalper Velocity','Fast decoding · live tape · alerts'),('porcelain-burgundy','Investor Compound','Fundamentals · portfolios · reports'),('burgundy-night','Aggressive Alpha','Momentum · catalysts · volatility'),('graphite-terminal','Quant Operator','Data grids · formulas · operations'),('midnight-research','Research Oracle','Filings · evidence · comparisons'),('high-contrast','Signal Access','Maximum legibility · reduced motion')]
PARAMS={'category-detail':'smart-contract-platforms','venue-detail':'venue-binance-fixture','research-article':'research-provider-truth','asset':'QI-CRYPTO-BTC'}
runtime=tempfile.mkdtemp(prefix='qelly-part22-gallery-')
launcher="""import { startServer } from './src/server/server.mjs';const x=await startServer({port:0,runtimePath:process.argv[1]});console.log(JSON.stringify({host:x.host,port:x.port}));process.on('SIGTERM',()=>x.server.close(()=>process.exit(0)));setInterval(()=>{},1000);"""
proc=subprocess.Popen(['node','--input-type=module','-e',launcher,runtime],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env={**os.environ,'QELLY_LIVE_MARKET_ENABLED':'false'})
try:
  info=json.loads(proc.stdout.readline().strip()); base=f"http://127.0.0.1:{info['port']}"
  for _ in range(80):
    try: urllib.request.urlopen(base+'/api/health',timeout=1).read(); break
    except Exception: time.sleep(.1)
  results=[]
  with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
    context=browser.new_context(viewport={'width':1280,'height':900},device_scale_factor=1,reduced_motion='reduce')
    def proxy(route_obj):
      parsed=urlsplit(route_obj.request.url)
      if parsed.netloc not in {'qelly.test',''}: route_obj.abort(); return
      if parsed.path.startswith('/api/v1/stream/'):
        route_obj.fulfill(status=200,headers={'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache'},body='event: stream.snapshot.v1\ndata: {"sequence":1,"resumeToken":"part22-gallery"}\n\n'); return
      target=base+parsed.path+('?' + parsed.query if parsed.query else '')
      data=route_obj.request.post_data.encode() if route_obj.request.post_data else None
      headers={k:v for k,v in route_obj.request.headers.items() if k.lower() not in {'host','content-length','accept-encoding','connection','origin','referer'}}
      req=urllib.request.Request(target,data=data,headers=headers,method=route_obj.request.method)
      try:
        with urllib.request.urlopen(req,timeout=12) as resp:
          body=resp.read(); hs={k:v for k,v in resp.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length'}}; route_obj.fulfill(status=resp.status,headers=hs,body=body)
      except urllib.error.HTTPError as exc: route_obj.fulfill(status=exc.code,headers={k:v for k,v in exc.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length'}},body=exc.read())
      except Exception: route_obj.abort()
    context.route('**/*',proxy)
    page=context.new_page(); errors=[]
    page.on('console',lambda msg: errors.append(msg.text) if msg.type=='error' else None)
    page.on('pageerror',lambda exc: errors.append(str(exc)))
    first=ROUTES[0]['route']; page.goto('about:blank#/'+first); page.set_content(INDEX,wait_until='load',timeout=30000); page.wait_for_selector('main#main .q-page',timeout=25000); page.wait_for_timeout(450)
    for idx,route in enumerate(ROUTES,1):
      name=route['route']; param=PARAMS.get(name); hash_route=f"#/{name}"+(f"/{param}" if param else '')
      existing=[SHOTS/t[0]/f'{name}.jpg' for t in THEMES]
      if all(x.exists() for x in existing):
        details={'title':route['label'],'eyebrow':route['meta'],'description':'Captured from the working Qelly Part 22 application.','panels':[],'controls':[],'interactiveCount':0}
        for theme_id,theme_label,intent in THEMES:
          target=SHOTS/theme_id/f'{name}.jpg'; results.append({'route':name,'routeLabel':route['label'],'section':route['section'],'meta':route['meta'],'hidden':bool(route.get('hidden')),'theme':theme_id,'themeLabel':theme_label,'themeIntent':intent,'screenshot':str(target.relative_to(ROOT)),'details':details,'errors':[]})
        print(f'{idx}/{len(ROUTES)} {name} cached',flush=True); continue
      errors.clear(); page.evaluate("h=>{location.hash=h}",hash_route); page.wait_for_timeout(520 if name in {'live-markets','stream-operations'} else 280)
      page.wait_for_selector('main#main .q-page',timeout=15000)
      details=page.evaluate("""() => ({title:document.querySelector('main h1')?.textContent?.trim()||'',eyebrow:document.querySelector('main .q-eyebrow')?.textContent?.trim()||'',description:document.querySelector('main .q-page-head p:not(.q-eyebrow)')?.textContent?.trim()||'',panels:[...document.querySelectorAll('main h2')].map(x=>x.textContent.trim()).filter(Boolean).slice(0,10),controls:[...document.querySelectorAll('main button,main select,main input,main textarea')].filter(x=>x.offsetParent!==null).map(x=>x.getAttribute('aria-label')||x.textContent.trim()||x.name||x.id||x.type).filter(Boolean).slice(0,14),interactiveCount:[...document.querySelectorAll('main button,main select,main input,main textarea,main a[href]')].filter(x=>x.offsetParent!==null).length})""")
      for theme_id,theme_label,intent in THEMES:
        page.evaluate("theme=>{document.documentElement.dataset.theme=theme;document.documentElement.dataset.motion='reduced';document.documentElement.style.removeProperty('--q-accent');const s=document.getElementById('global-theme-selector');if(s)s.value=theme;}",theme_id); page.wait_for_timeout(25)
        target=SHOTS/theme_id/f'{name}.jpg'; target.parent.mkdir(parents=True,exist_ok=True); page.screenshot(path=str(target),full_page=False,type='jpeg',quality=64)
        results.append({'route':name,'routeLabel':route['label'],'section':route['section'],'meta':route['meta'],'hidden':bool(route.get('hidden')),'theme':theme_id,'themeLabel':theme_label,'themeIntent':intent,'screenshot':str(target.relative_to(ROOT)),'details':details,'errors':list(errors)})
      print(f'{idx}/{len(ROUTES)} {name}',flush=True)
    page.close(); context.close(); browser.close()
  manifest={'release':'22.0.0','routeCount':len(ROUTES),'themeCount':len(THEMES),'screenThemeCount':len(results),'routes':ROUTES,'themes':[{'id':i,'label':l,'intent':n} for i,l,n in THEMES],'items':results,'consoleErrorCombinations':sum(bool(x['errors']) for x in results)}
  (OUT/'gallery-manifest.json').write_text(json.dumps(manifest,indent=2))
  try: font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',17)
  except: font=None
  for theme_id,theme_label,intent in THEMES:
    cards=[]
    for route in ROUTES:
      img=Image.open(SHOTS/theme_id/f"{route['route']}.jpg").convert('RGB'); img.thumbnail((300,211)); card=Image.new('RGB',(320,250),'white'); card.paste(img,((320-img.width)//2,29+(211-img.height)//2)); ImageDraw.Draw(card).text((10,7),route['label'],fill='black',font=font); cards.append(card)
    cols=4; rows=(len(cards)+cols-1)//cols; sheet=Image.new('RGB',(cols*320,rows*250),'white')
    for i,c in enumerate(cards): sheet.paste(c,((i%cols)*320,(i//cols)*250))
    sheet.save(OUT/f'QELLY_{theme_id.upper().replace("-","_")}_47_SCREEN_CONTACT_SHEET.jpg',quality=88)
  manifest_js=json.dumps(manifest,ensure_ascii=False)
  options_theme=''.join(f'<option value="{i}">{l}</option>' for i,l,_ in THEMES); options_section=''.join(f'<option>{x}</option>' for x in sorted(set(r['section'] for r in ROUTES)))
  gallery='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Qelly Part 22 · 282 Screen Persona Gallery</title><style>:root{--ink:#170008;--accent:#7c1239;--soft:#f5e9ed}*{box-sizing:border-box}body{margin:0;font:14px Inter,system-ui,sans-serif;color:#251218;background:#fbf7f8}header{position:sticky;top:0;z-index:4;background:linear-gradient(132deg,#080003,#180008 24%,#310011 52%,#5b0828 76%,#8e1d4b);color:white;padding:24px 28px;box-shadow:0 18px 50px #31001133}h1{margin:4px 0;font-size:32px;letter-spacing:-.04em}header p{margin:0;color:#e8c6d2}.controls{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}input,select{border:1px solid #ffffff44;background:#ffffff18;color:white;border-radius:14px;padding:10px 12px}select option{color:#251218}main{padding:24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:18px}article{background:white;border:1px solid #e6d4db;border-radius:28px 28px 28px 10px;overflow:hidden;box-shadow:0 14px 40px #31001112;transition:.28s}article:hover{transform:translateY(-6px);box-shadow:0 30px 70px #31001126}img{display:block;width:100%;aspect-ratio:1280/900;object-fit:cover;object-position:top}.meta{padding:15px 17px}.meta b{display:block;font-size:16px}.meta small{display:block;color:#806b74;margin-top:4px}.tag{display:inline-flex;background:#f3e7eb;color:#6d1233;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:800;margin:0 5px 8px 0}.empty{grid-column:1/-1;text-align:center;padding:80px}</style></head><body><header><small>QELLY INTELLIGENCE · LOCKED SOVEREIGN BURGUNDY</small><h1>47 screens × 6 market personas</h1><p>282 actual application captures. Search routes, sections, controls and persona intent.</p><div class="controls"><input id="q" placeholder="Search screens…"><select id="theme"><option value="">All personas</option>'''+options_theme+'''</select><select id="section"><option value="">All sections</option>'''+options_section+'''</select></div></header><main id="grid"></main><script>const M='''+manifest_js+''';const q=document.querySelector('#q'),theme=document.querySelector('#theme'),section=document.querySelector('#section'),grid=document.querySelector('#grid');function draw(){const query=q.value.toLowerCase();const items=M.items.filter(x=>(!theme.value||x.theme===theme.value)&&(!section.value||x.section===section.value)&&(!query||JSON.stringify(x).toLowerCase().includes(query)));grid.innerHTML=items.length?items.map(x=>`<article><img loading="lazy" src="${x.screenshot.replace('all-personas-gallery/','')}" alt="${x.routeLabel} in ${x.themeLabel}"><div class="meta"><span class="tag">${x.themeLabel}</span><span class="tag">${x.section}</span><b>${x.routeLabel}</b><small>${x.themeIntent} · ${x.details.interactiveCount} visible controls</small></div></article>`).join(''):'<div class="empty">No matching screens.</div>'}q.oninput=theme.onchange=section.onchange=draw;draw()</script></body></html>'''
  (OUT/'index.html').write_text(gallery)
  print(json.dumps({'routes':len(ROUTES),'themes':len(THEMES),'screens':len(results),'consoleErrorCombinations':manifest['consoleErrorCombinations']},indent=2))
finally:
  proc.terminate()
  try: proc.wait(timeout=5)
  except subprocess.TimeoutExpired: proc.kill()
  shutil.rmtree(runtime,ignore_errors=True)
