from pathlib import Path
import json, html, asyncio
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
G=ROOT/'all-personas-gallery'
M=json.loads((G/'gallery-manifest.json').read_text())
HTML=ROOT/'QELLY_PART22_SOVEREIGN_DESIGN_HANDOFF.html'
PDF=ROOT/'QELLY_PART22_ALL_47_SCREENS_ALL_6_PERSONAS_DETAILED.pdf'

PURPOSES={
'live-markets':'Read-only live candle command center with provider selection, symbol/interval control, candle and volume visualization, market pulse and safe offline fallback.',
'theme-personas':'Explains and activates the six market-behavior personas while preserving the permanent Qelly burgundy identity.',
'feature-universe':'Maps the complete product surface, feature waves, routes, capabilities and production gates.',
'about-qelly':'Communicates Qelly’s brand story, operating-system vision, design principles, truth boundary and product promise.',
'discovery-hub':'Cross-asset discovery overview combining movers, categories, venues, research and trust evidence.',
'asset-rankings':'Sortable and filterable rankings across supported asset classes with source and freshness context.',
'search':'Federated search across assets, categories, venues and research with suggestions and facets.',
'categories':'Category directory for thematic and asset-class discovery.',
'category-detail':'Deep category page with constituents, methodology, performance and related research.',
'venues':'Venue comparison with quality, coverage, jurisdiction and methodology evidence.',
'venue-detail':'Detailed venue profile with markets, operational evidence and trust boundaries.',
'dex-discovery':'DEX pair discovery, liquidity fixtures and non-tradable market context.',
'global-charts':'Macro and cross-market chart collection with methodology and freshness labels.',
'converter':'Transparent cross-asset conversion calculator with fee and slippage simulation.',
'news-research':'Citation-aware news and research library with filters and related assets.',
'research-article':'Long-form research article with citations, lineage and related instruments.',
'trust-center':'Coverage, methodology, component status, incidents, licensing and safety evidence.',
'asset-intelligence':'Canonical asset workspace combining quote, fundamentals, peers, events and evidence.',
'advanced-chart':'Multi-pane chart studio with candles, volume, indicators and saved layout contracts.',
'fundamentals-estimates':'Financial statements, earnings, estimates, revisions, margins and corporate actions.',
'filing-workspace':'Searchable filing references, sections and stable citation identifiers.',
'event-calendar':'Asset and macro event calendar with date and event-type filtering.',
'comparison-lab':'Normalized cross-asset comparison with snapshots, rebased series and unavailable-field honesty.',
'market':'Legacy market overview preserving the original deterministic source-aware experience.',
'rankings':'Legacy rankings surface retained for migration and parity evidence.',
'asset':'Legacy asset dossier with canonical identity, chart, source inspector and lineage.',
'watchlist':'Editable tenant-scoped watchlists with groups, notes and canonical instruments.',
'alert-center':'Rule-based price, change and volume alert definitions with manual deterministic evaluation.',
'notification-center':'Persistent in-app notification inbox with read state and source context.',
'screener-lab':'Typed cross-asset screener with filters, sorting and reusable saved definitions.',
'portfolio-analytics':'Deterministic model portfolio, holdings, performance, risk, exposure and stress scenarios.',
'research-workspace':'Persistent mixed-evidence research boards for assets, filings, articles and notes.',
'onboarding':'Guided goals, asset classes, regions, experience and workspace-template setup.',
'notification-schedules':'Daily and weekly in-app schedule definitions with deterministic due evaluation.',
'formula-screener':'Safe bounded formula parser for calculated fields, filters and rankings.',
'portfolio-attribution':'Holding, asset-class and sector contribution analysis with exact reconciliation.',
'import-center':'CSV preview, validation and safe local staging for watchlist, portfolio and research imports.',
'research-history':'Version snapshots, stable diffs and idempotent research workspace restoration.',
'migration-center':'Plan-only PostgreSQL migration phases, backup gates, reconciliation and rollback evidence.',
'theme-lab':'Advanced appearance controls for personas, density, motion, font scale, radius and protected semantics.',
'identity-access':'Tenant-aware local identity, roles, sessions, device trust, consent and step-up evidence.',
'data-mesh':'Provider runtime controls, failover, quotas, cache, breaker and entitlement evidence.',
'instrument-master':'Persistent canonical instrument IDs, aliases, history, relationships and resolution.',
'timeseries-lab':'Normalized OHLCV history, aggregation, range queries, cursors and governed append evidence.',
'stream-operations':'Snapshot/delta streams, replay journal, resume tokens, heartbeat and gap recovery.',
'observability':'Local request metrics, traces, logs, dependencies and candidate SLOs.',
'security-evidence':'Audit integrity, schema coverage, safety locks and production-deferred security boundaries.'
}
FEATURES={
'live-markets':['Candlestick + volume + SMA','Binance/CoinDCX public adapters','TradingView-compatible chart adapter','Offline deterministic fallback','No execution or custody'],
'theme-personas':['Six named market personas','Permanent gradient lock','Density and motion profiles','Theme activation','Accessibility persona'],
'about-qelly':['Brand narrative','Founder direction','Platform pillars','Product statistics','Feature and live-market CTAs'],
'feature-universe':['47-route directory','Wave grouping','Capability map','Safety gates','Deep navigation'],
}
def features(route,section):
    if route in FEATURES:return FEATURES[route]
    base={
      'Discover':['Search and filters','Source/freshness evidence','Deep links','Saved discovery state','Responsive cards and grids'],
      'Intelligence':['Canonical asset context','Interactive analysis','Methodology labels','Comparison or indicator controls','Unavailable-field honesty'],
      'Workspace':['Scoped persistent state','Validated forms','Idempotent mutations','Audit trail','Empty/loading/error states'],
      'Control':['Tenant-aware controls','Policy and entitlement evidence','Diagnostics','Guarded mutations','Production gates'],
      'Data Plane':['Normalized data','Cursor/range controls','Replay or persistence','Quality metadata','Operational evidence'],
      'Operations':['Runtime status','Health and evidence','Safe workflows','Recovery gates','No hidden production claims'],
      'Evidence':['Audit and security evidence','Source inspection','Safety locks','Schema coverage','Production boundaries'],
      'Platform':['Persona controls','Typography and radius','Motion settings','Semantic locks','Persistence'],
      'Company':['Brand story','Values and principles','Product promise','Trust boundaries','Navigation'],
      'Experience':['Persona design system','Modular interaction patterns','Brand lock','Motion behavior','User interest framing'],
      'Live':['Public read-only data','Candlestick analysis','Provider selection','Safe fallback','Execution disabled'],
      'Detail':['Deep-link context','Evidence lineage','Related entities','Source states','Return navigation']
    }
    return base.get(section,['Modular layout','Responsive behavior','Source-aware evidence','Working local APIs','Production boundary'])

THEME_COPY={x['id']:(x['label'],x['intent']) for x in M['themes']}

def esc(x):return html.escape(str(x or ''))

def page(content,cls=''):
    return f'<section class="page {cls}">{content}</section>'

pages=[]
pages.append(page('''<div class="cover-gradient"><div class="cover-kicker">QELLY INTELLIGENCE · PART 22</div><h1>Sovereign Experience<br>Design Handoff</h1><p>Permanent deepest-burgundy gradient. 47 application screens. Six market personas. Live read-only market architecture. Complete typography, component, hover, motion and polarity specification.</p><div class="cover-stats"><b>47 screens</b><b>6 personas</b><b>282 captures</b><b>199 tests</b></div></div>''','cover'))
pages.append(page('''<header><span>01 · PERMANENT BRAND LOCK</span><h1>The gradient never changes again.</h1></header><div class="gradient-demo"><b>#080003</b><b>#180008</b><b>#310011</b><b>#5B0828</b><b>#8E1D4B</b></div><div class="two-col"><article><h2>Non-negotiable identity</h2><p>Global chrome, primary heroes, active navigation, major CTAs and branded motion preserve the Qelly signature gradient.</p><ul><li>Darkest burgundy anchors trust and focus.</li><li>Merlot signal introduces energy without neon excess.</li><li>Porcelain white keeps analysis legible and premium.</li><li>Personas tune behavior—not brand identity.</li></ul></article><article><h2>Protected semantics</h2><p>Positive, negative, warning, stale, delayed, cached and simulated meanings are never recolored by a persona. Focus rings and contrast remain visible.</p><div class="semantic-row"><i class="pos">Positive</i><i class="neg">Negative</i><i class="warn">Warning</i><i class="sim">Simulated</i></div></article></div>'''))
# personas pages
persona_cards=''.join(f'''<article class="persona"><div class="persona-swatch p-{tid}"></div><small>{i+1:02d}</small><h2>{esc(label)}</h2><p>{esc(intent)}</p><b>{'Primary default' if i==0 else 'Selectable persona'}</b></article>''' for i,(tid,label,intent) in enumerate([(x['id'],x['label'],x['intent']) for x in M['themes']]))
pages.append(page(f'''<header><span>02 · PERSONA THEME ARCHITECTURE</span><h1>Themes are user mindsets, not color skins.</h1><p>Every persona preserves the gradient and changes information rhythm, density, motion tempo, chart contrast and control emphasis.</p></header><div class="persona-grid">{persona_cards}</div>'''))
pages.append(page('''<header><span>03 · TYPOGRAPHY & POLARITY</span><h1>Smooth geometry. Serious data.</h1></header><div class="type-grid"><article class="dark-sample"><small>LIGHT TEXT ZONE</small><h2>Markets become legible.</h2><p>Use light text only on deepest burgundy, graphite, midnight and approved dark overlays.</p></article><article class="light-sample"><small>DARK TEXT ZONE</small><h2>Evidence stays readable.</h2><p>Use dark text on white, porcelain and soft rose analytical surfaces.</p></article></div><div class="type-rules"><div><b>Display</b><span>Manrope / Avenir Next / SF Pro Display-style rounded geometric stack</span></div><div><b>Body</b><span>Plus Jakarta Sans / Manrope-style readable stack</span></div><div><b>Data</b><span>JetBrains Mono / IBM Plex Mono-style tabular stack</span></div><div><b>Scale</b><span>H1 48–76 · H2 26–38 · body 14–16 · tables 12–13 · labels 9–11</span></div></div>'''))
pages.append(page('''<header><span>04 · BUTTONS, HOVER & STATES</span><h1>Every control has a physical response.</h1></header><div class="button-stage"><button class="primary">Primary action</button><button class="secondary">Secondary action</button><button class="ghost">Ghost action</button><button class="icon">◐</button></div><div class="state-grid"><article><b>Default</b><p>Asymmetric 17px curve, high legibility, visible hierarchy.</p></article><article><b>Hover</b><p>Lift, magnetic offset, border morph, glow and shimmer.</p></article><article><b>Pressed</b><p>Reduced lift, ripple and immediate response.</p></article><article><b>Focus</b><p>High-contrast focus ring independent of hover.</p></article><article><b>Disabled</b><p>Reduced opacity without removing label meaning.</p></article><article><b>Reduced motion</b><p>All transforms collapse to near-zero duration.</p></article></div>'''))
pages.append(page('''<header><span>05 · MOTION LANGUAGE</span><h1>Motion explains hierarchy.</h1></header><div class="motion-list"><div><b>01</b><h2>Route reveal</h2><p>610ms blur-to-sharp transition establishes location.</p></div><div><b>02</b><h2>Panel choreography</h2><p>Staggered 38ms reveal with bounded perspective.</p></div><div><b>03</b><h2>Magnetic controls</h2><p>Pointer-relative movement stays subtle and reversible.</p></div><div><b>04</b><h2>Card tilt</h2><p>Maximum 1.3° perspective response; disabled for data grids.</p></div><div><b>05</b><h2>Chart motion</h2><p>Candle, volume and line updates preserve analytical continuity.</p></div><div><b>06</b><h2>Accessibility</h2><p>System and in-app reduced-motion settings take priority.</p></div></div>'''))
pages.append(page('''<header><span>06 · LIVE CHART ARCHITECTURE</span><h1>Public market data. Read-only by design.</h1></header><div class="architecture"><article><h2>Chart interface</h2><p>TradingView Lightweight Charts-compatible candlestick adapter with candle, volume, crosshair and SMA layers. Qelly SVG candles render when the optional external chart script is unavailable.</p></article><article><h2>Binance public adapter</h2><p>Public REST candles and browser kline stream. No account, balance, order or credential route.</p></article><article><h2>CoinDCX public adapter</h2><p>Public candle endpoint and socket-ready contract with normalized Qelly candle shape.</p></article><article><h2>Investing.com boundary</h2><p>No scraping and no undocumented public-data dependency. Optional widget embedding remains a separate contract.</p></article><article><h2>Offline fallback</h2><p>Deterministic candles guarantee that the full website remains demonstrable without internet access.</p></article><article><h2>Execution lock</h2><p>Trading, transfers, withdrawals, private keys and recovery phrases remain absent.</p></article></div>'''))
pages.append(page('''<header><span>07 · MODULAR SYSTEM</span><h1>One system, hundreds of combinations.</h1></header><div class="module-grid">'''+''.join(f'<article><b>{x}</b><p>{y}</p></article>' for x,y in [('Global chrome','Brand strip, command bar, workspace context and persona switcher.'),('Navigation','Sectioned rail, active pill, command palette and deep links.'),('Heroes','Oversized curved gradients with context, description and actions.'),('Bento panels','White or dark analytical islands with variable span and hierarchy.'),('Data grids','Sortable, resizable, source-aware and density-responsive.'),('Charts','Candles, volume, indicators, fallback rendering and source states.'),('Forms','Validated inputs, revisions, errors and audited mutations.'),('Evidence','Source, freshness, confidence, entitlement and truth boundaries.')])+'''</div>'''))
# route directory 3 pages
routes=M['routes']
for chunk_index in range(0,len(routes),16):
    chunk=routes[chunk_index:chunk_index+16]
    items=''.join(f'''<article class="route-row"><div><small>{esc(r['section'])} · {esc(r['meta'])}</small><h2>{esc(r['label'])}</h2><code>#/{esc(r['route'])}</code></div><p>{esc(PURPOSES.get(r['route'],'Modular Qelly intelligence workflow.'))}</p><ul>{''.join('<li>'+esc(x)+'</li>' for x in features(r['route'],r['section'])[:3])}</ul></article>''' for r in chunk)
    pages.append(page(f'''<header><span>08 · COMPLETE SCREEN DIRECTORY · {chunk_index//16+1}/3</span><h1>Every route has a defined job.</h1></header><div class="route-list">{items}</div>'''))
# screenshot pages
for idx,item in enumerate(M['items'],1):
    route=item['route']; route_def=next(r for r in routes if r['route']==route); fs=features(route,route_def['section'])
    img='./'+item['screenshot']
    notes=' · '.join(fs[:4])
    pages.append(page(f'''<div class="screen-head"><div><small>{idx:03d} / {len(M['items'])} · {esc(item['themeLabel']).upper()}</small><h1>{esc(item['routeLabel'])}</h1></div><div class="screen-meta"><b>{esc(route_def['section'])}</b><code>#/{esc(route)}</code></div></div><div class="screen-image"><img src="{img}" alt="{esc(item['routeLabel'])} in {esc(item['themeLabel'])}"></div><div class="screen-foot"><p>{esc(PURPOSES.get(route,''))}</p><span>{esc(notes)}</span></div>''','screen-page'))

style='''
@page{size:A4 landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:"Avenir Next","Segoe UI Variable",Inter,system-ui,sans-serif;color:#251218;background:#fff}.page{width:297mm;height:210mm;page-break-after:always;overflow:hidden;padding:15mm 18mm;background:#fbf7f8;position:relative}.page:last-child{page-break-after:auto}header span,.cover-kicker{font-size:9pt;letter-spacing:.2em;font-weight:800;color:#8e1d4b}header h1{font-size:31pt;line-height:.98;letter-spacing:-.055em;margin:3mm 0 4mm}header>p{font-size:12pt;line-height:1.5;color:#6f5962;max-width:220mm}.cover{padding:0}.cover-gradient{height:100%;padding:24mm;background:radial-gradient(circle at 82% 18%,#ff99bd33,transparent 31%),linear-gradient(132deg,#080003,#180008 24%,#310011 52%,#5b0828 76%,#8e1d4b);color:#fff;display:flex;flex-direction:column;justify-content:center}.cover-gradient h1{font-size:57pt;line-height:.88;letter-spacing:-.075em;margin:7mm 0}.cover-gradient p{font-size:16pt;line-height:1.5;max-width:225mm;color:#eed5de}.cover-kicker{color:#ffbdd4}.cover-stats{display:flex;gap:5mm;margin-top:13mm}.cover-stats b{border:1px solid #ffffff44;background:#ffffff14;border-radius:7mm 7mm 7mm 2mm;padding:5mm 7mm}.gradient-demo{height:45mm;margin:8mm 0;background:linear-gradient(132deg,#080003,#180008 24%,#310011 52%,#5b0828 76%,#8e1d4b);border-radius:12mm 12mm 12mm 3mm;display:flex;align-items:end;justify-content:space-around;padding:6mm;color:#fff}.two-col,.type-grid{display:grid;grid-template-columns:1fr 1fr;gap:7mm}.two-col article,.type-grid article{background:white;border:1px solid #e5d3da;border-radius:10mm 10mm 10mm 3mm;padding:8mm}.two-col h2{font-size:20pt;margin:0 0 3mm}.two-col p,.two-col li{font-size:11pt;line-height:1.55}.semantic-row{display:flex;gap:3mm;margin-top:8mm}.semantic-row i{font-style:normal;border-radius:999px;padding:2.5mm 4mm;font-weight:800}.pos{background:#e5f7ef;color:#087c53}.neg{background:#ffebee;color:#c93952}.warn{background:#fff3dd;color:#97600c}.sim{background:#efe8fb;color:#7046a8}.persona-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm;margin-top:8mm}.persona{background:white;border:1px solid #e6d4db;border-radius:9mm 9mm 9mm 3mm;padding:5mm;min-height:58mm}.persona-swatch{height:18mm;border-radius:6mm 6mm 6mm 2mm;background:linear-gradient(132deg,#080003,#310011,#8e1d4b)}.persona h2{font-size:19pt;margin:3mm 0 1mm}.persona p{color:#755e68}.persona small{display:block;margin-top:3mm;color:#8e1d4b;font-weight:800}.persona b{font-size:9pt}.p-porcelain-burgundy{box-shadow:inset 0 0 0 8px #fff5f7}.p-burgundy-night{filter:brightness(.72)}.p-graphite-terminal{background:linear-gradient(132deg,#080003,#1c1a1b,#8e1d4b)}.p-midnight-research{background:linear-gradient(132deg,#080003,#26152c,#8e1d4b)}.p-high-contrast{background:linear-gradient(132deg,#000 0 45%,#fff 45% 60%,#74002e 60%)}.dark-sample{background:linear-gradient(132deg,#080003,#310011,#8e1d4b)!important;color:#fff}.dark-sample p{color:#ead1da}.type-grid article h2{font-size:31pt;letter-spacing:-.055em}.type-rules{margin-top:8mm;display:grid;grid-template-columns:1fr 1fr;gap:3mm}.type-rules div{background:#f4e9ed;border-radius:5mm;padding:4mm}.type-rules b,.type-rules span{display:block}.type-rules span{color:#725e66;margin-top:1mm}.button-stage{height:45mm;background:linear-gradient(132deg,#080003,#310011,#8e1d4b);border-radius:10mm 10mm 10mm 3mm;margin:8mm 0;display:flex;align-items:center;justify-content:center;gap:5mm}.button-stage button{border-radius:6mm 6mm 6mm 2mm;padding:4mm 7mm;font-size:12pt;font-weight:800}.primary{background:white;color:#310011;border:0}.secondary{background:#f7e8ee;color:#310011;border:1px solid white}.ghost{background:#ffffff0d;color:white;border:1px solid #ffffff55}.icon{width:14mm;height:14mm;background:#fff;color:#310011;border:0}.state-grid,.architecture,.module-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm}.state-grid article,.architecture article,.module-grid article{background:white;border:1px solid #e6d4db;border-radius:7mm 7mm 7mm 2mm;padding:5mm;min-height:35mm}.state-grid b,.module-grid b{font-size:15pt}.state-grid p,.architecture p,.module-grid p{color:#725e66;line-height:1.45}.motion-list{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-top:8mm}.motion-list>div{display:grid;grid-template-columns:16mm 1fr;column-gap:4mm;background:white;border:1px solid #e6d4db;border-radius:7mm;padding:5mm}.motion-list b{grid-row:1/3;font-size:24pt;color:#8e1d4b}.motion-list h2{margin:0}.motion-list p{margin:1mm 0;color:#725e66}.architecture{margin-top:8mm}.architecture h2{margin:0;font-size:17pt}.route-list{display:grid;grid-template-columns:1fr 1fr;gap:2.7mm 5mm;margin-top:5mm}.route-row{display:grid;grid-template-columns:48mm 1fr 48mm;gap:3mm;align-items:center;border-bottom:1px solid #e5d3da;padding:2mm 0}.route-row h2{font-size:12pt;margin:.5mm 0}.route-row small{font-size:7pt;color:#8e1d4b;font-weight:800;letter-spacing:.12em}.route-row code{font-size:7pt;color:#765f68}.route-row p{font-size:8pt;line-height:1.32;color:#604b54;margin:0}.route-row ul{font-size:7pt;color:#765f68;margin:0;padding-left:4mm}.screen-page{padding:7mm 8mm;background:#f7f1f3}.screen-head{height:18mm;display:flex;align-items:center;justify-content:space-between}.screen-head h1{font-size:20pt;margin:1mm 0;letter-spacing:-.04em}.screen-head small{font-size:7pt;letter-spacing:.16em;color:#8e1d4b;font-weight:800}.screen-meta{text-align:right}.screen-meta b,.screen-meta code{display:block}.screen-meta b{font-size:9pt}.screen-meta code{font-size:7pt;color:#725e66}.screen-image{height:160mm;display:grid;place-items:center;background:white;border:1px solid #ddcbd2;border-radius:5mm;overflow:hidden;box-shadow:0 5mm 16mm #31001118}.screen-image img{width:100%;height:100%;object-fit:contain}.screen-foot{height:18mm;display:grid;grid-template-columns:1.6fr 1fr;gap:6mm;align-items:center;padding:3mm 2mm}.screen-foot p{font-size:8pt;line-height:1.35;margin:0;color:#503d45}.screen-foot span{font-size:7pt;color:#826b74;text-align:right}.page:after{content:"QELLY INTELLIGENCE · SOVEREIGN PART 22";position:absolute;right:6mm;bottom:2.5mm;font-size:5.5pt;letter-spacing:.12em;color:#9b838c}
'''
doc='<!doctype html><html><head><meta charset="utf-8"><title>Qelly Part 22 Sovereign Design Handoff</title><style>'+style+'</style></head><body>'+''.join(pages)+'</body></html>'
HTML.write_text(doc)

async def build():
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        page=await browser.new_page()
        async def local_asset(route):
            from urllib.parse import urlparse, unquote
            parsed=urlparse(route.request.url)
            rel=unquote(parsed.path.lstrip('/'))
            target=(ROOT/rel).resolve()
            try:
                target.relative_to(ROOT.resolve())
            except ValueError:
                await route.abort()
                return
            if not target.exists() or not target.is_file():
                await route.abort()
                return
            suffix=target.suffix.lower()
            ctype={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.css':'text/css','.js':'application/javascript','.json':'application/json'}.get(suffix,'application/octet-stream')
            await route.fulfill(status=200,body=target.read_bytes(),content_type=ctype)
        await page.route('https://qelly-pdf.test/**', local_asset)
        render_doc=HTML.read_text().replace('<head>','<head><base href="https://qelly-pdf.test/">',1)
        await page.set_content(render_doc,wait_until='load',timeout=120000)
        await page.wait_for_timeout(1500)
        await page.emulate_media(media='print')
        await page.pdf(path=str(PDF),format='A4',landscape=True,print_background=True,margin={'top':'0','right':'0','bottom':'0','left':'0'},prefer_css_page_size=True)
        await browser.close()
asyncio.run(build())
print(json.dumps({'html':str(HTML),'pdf':str(PDF),'pages':len(pages),'screens':len(M['items'])},indent=2))
