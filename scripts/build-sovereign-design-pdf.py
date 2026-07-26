from pathlib import Path
import json, math, textwrap, html
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import stringWidth

ROOT=Path('/mnt/data/QELLY_INTELLIGENCE_SOVEREIGN_DESIGN_REBUILD')
G=ROOT/'all-themes-gallery'
PDF=ROOT/'QELLY_SOVEREIGN_DESIGN_ALL_43_SCREENS_ALL_6_THEMES.pdf'
ROUTES=json.loads(Path('/mnt/data/qelly_routes.json').read_text())
THEMES=[
 ('burgundy-command','Sovereign Burgundy','#160008','#2B000F','#720F32','#F8F2F4','#FFFDFD','#251218','Deepest burgundy chrome with porcelain white content islands. This is the primary identity.'),
 ('burgundy-night','Burgundy Nocturne','#090003','#1B0009','#E05283','#10070A','#1B0F13','#FFF7FA','Low-glare burgundy-black research mode with light typography and rose highlights.'),
 ('porcelain-burgundy','Porcelain Atelier','#310012','#5B0A2A','#8D1F48','#FFFAF9','#FFFFFF','#2A151C','Bright editorial mode with precise dark typography and a stronger burgundy frame.'),
 ('graphite-terminal','Graphite Reserve','#0D0B0C','#1B1518','#C13D6C','#111012','#1C191B','#F8F4F5','Dense graphite terminal mode with burgundy signal accents.'),
 ('midnight-research','Midnight Merlot','#0D0714','#1D0B28','#CE4D82','#120D19','#201727','#FBF5FF','Midnight-plum research mode balancing cool depth and merlot emphasis.'),
 ('high-contrast','High Contrast','#000000','#1A0009','#74002E','#FFFFFF','#FFFFFF','#000000','Accessibility-first black, white and burgundy treatment with minimal ambiguity.')
]
PURPOSE={
'market':'Cross-asset command dashboard with KPIs, market grid, source evidence and risk context.',
'rankings':'Sortable, resizable professional rankings for performance, liquidity and source state.',
'search':'Universal federated search across assets, categories, venues, research and commands.',
'asset':'Single-asset dossier with identity, price, history, events and source lineage.',
'watchlist':'Editable grouped watchlists with notes, persistence and audited instrument actions.',
'theme-lab':'Theme, density, motion, font scale, radius and protected semantic controls.',
'identity-access':'Tenant-aware identity, sessions, devices, roles, consent and step-up evidence.',
'data-mesh':'Provider adapters, failover, cache, quotas, entitlements and data-quality evidence.',
'instrument-master':'Canonical IDs, symbol history, relationships, resolution and revisions.',
'timeseries-lab':'Normalized history, intervals, pagination, append governance and data quality.',
'stream-operations':'Snapshot/delta streams, replay tokens, sequence integrity and heartbeat evidence.',
'observability':'Metrics, latency, traces, logs, dependencies and candidate SLOs.',
'security-evidence':'Audit integrity, security headers, contracts and production safety gates.',
'discovery-hub':'Public discovery landing experience with cross-asset highlights and trusted context.',
'asset-rankings':'Cross-asset normalized rankings with filters, sorting and evidence.',
'categories':'Cross-asset categories, coverage, constituents and methodology.',
'category-detail':'Selected category constituents, ranking, source and freshness evidence.',
'venues':'Centralized and decentralized venue ranking and quality evidence.',
'venue-detail':'Venue metadata, markets, operations and production boundaries.',
'dex-discovery':'DEX pairs, liquidity context and explicitly non-tradable prediction fixtures.',
'global-charts':'Global market-series visualizations with methodology and source context.',
'converter':'Transparent multi-asset conversion with local fee and slippage simulation.',
'news-research':'Citation-bearing news and research with filters and related assets.',
'research-article':'Long-form research, citations, related assets and data lineage.',
'trust-center':'Status, incidents, coverage, licensing, maintenance and trust boundaries.',
'asset-intelligence':'Profile, quote, fundamentals, peers, events, filings and technical evidence.',
'advanced-chart':'Candlesticks, six technical studies, panes and saved chart layouts.',
'fundamentals-estimates':'Statements, earnings, consensus ranges, revisions and corporate actions.',
'filing-workspace':'Filing index, searchable sections, stable citations and source locators.',
'event-calendar':'Earnings, dividends, macro and research events with date/type filters.',
'comparison-lab':'Normalized comparison of up to six cross-asset series and metrics.',
'alert-center':'Price, change and volume alert rules with local deterministic evaluation.',
'notification-center':'Persistent in-app notifications, unread counts and read-state controls.',
'screener-lab':'Typed multi-filter cross-asset screens with sorting and saved definitions.',
'portfolio-analytics':'Model holdings, P&L, performance, exposure, concentration and risk.',
'research-workspace':'Persistent boards with assets, filings, articles, notes and tags.',
'onboarding':'Goals, asset classes, regions, experience, currency and workspace templates.',
'notification-schedules':'Daily/weekly in-app schedule contracts and replay-safe local runs.',
'formula-screener':'Sandboxed calculated fields, formula filters and sorting without arbitrary code.',
'portfolio-attribution':'Holding, asset-class and sector contributions reconciled to total return.',
'import-center':'CSV templates, preview, validation, staging and audited local commits.',
'research-history':'Research snapshots, item-level diffs and idempotent restore.',
'migration-center':'Plan-only PostgreSQL migration phases, gates, backup and rollback requirements.'
}
INTERACTIONS={
'chart':'Hover crosshair, study chips, range controls, save layout, line-draw reveal and panel lift.',
'table':'Sticky header, row hover rail, sortable columns, resize affordance, row action reveal.',
'form':'Field focus ring, validation banner, save shimmer, revision conflict state and completion motion.',
'content':'Citation hover, reading focus, related-card lift, source drawer and section navigation.',
'cards':'Bento-card lift, pointer glow, progressive reveal, contextual actions and source inspection.'
}

def route_type(route):
    if any(x in route for x in ['chart','timeseries','comparison','portfolio','global-charts']): return 'chart'
    if any(x in route for x in ['ranking','screener','watchlist','instrument','data-mesh','observability','security']): return 'table'
    if any(x in route for x in ['onboarding','notification-schedules','import','migration','identity','alert-center']): return 'form'
    if any(x in route for x in ['research','filing','news','article','event-calendar']): return 'content'
    return 'cards'

FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'; FONT_B='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'; FONT_M='/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
pdfmetrics.registerFont(TTFont('QBody',FONT));pdfmetrics.registerFont(TTFont('QBold',FONT_B));pdfmetrics.registerFont(TTFont('QMono',FONT_M))
W,H=landscape(A4)
c=canvas.Canvas(str(PDF),pagesize=(W,H),pageCompression=1)
c.setTitle('Qelly Intelligence Sovereign Design - All Screens and Themes')
c.setAuthor('Qelly Intelligence design rebuild')
BURG=HexColor('#720F32');DARK=HexColor('#160008');WHITE=HexColor('#FFF8FB');CANVAS=HexColor('#F8F2F4');TEXT=HexColor('#251218');MUTED=HexColor('#7B6870');BORDER=HexColor('#E2D2D8');ROSE=HexColor('#E05283')


def wrapped(text,font,size,maxw,max_lines=99):
    words=text.split();lines=[];cur=''
    for word in words:
        trial=(cur+' '+word).strip()
        if stringWidth(trial,font,size)<=maxw:cur=trial
        else:
            if cur:lines.append(cur)
            cur=word
            if len(lines)>=max_lines:break
    if cur and len(lines)<max_lines:lines.append(cur)
    return lines

def draw_para(text,x,y,w,font='QBody',size=8.5,leading=12,color=TEXT,max_lines=20):
    c.setFont(font,size);c.setFillColor(color)
    for line in wrapped(text,font,size,w,max_lines):
        c.drawString(x,y,line);y-=leading
    return y

def rounded(x,y,w,h,fill,stroke=None,r=18):
    c.setFillColor(fill)
    if stroke:c.setStrokeColor(stroke);c.roundRect(x,y,w,h,r,fill=1,stroke=1)
    else:c.roundRect(x,y,w,h,r,fill=1,stroke=0)

def footer(page_no,label='Qelly Intelligence - Sovereign Design System'):
    c.setStrokeColor(BORDER);c.line(26,22,W-26,22);c.setFillColor(MUTED);c.setFont('QBody',6.5);c.drawString(26,10,label);c.drawRightString(W-26,10,str(page_no))

def fit_image(path,x,y,w,h):
    im=Image.open(path);iw,ih=im.size;scale=min(w/iw,h/ih);dw,dh=iw*scale,ih*scale
    c.drawImage(ImageReader(str(path)),x+(w-dw)/2,y+(h-dh)/2,dw,dh,preserveAspectRatio=True,mask='auto')

page=1
# Cover
c.setFillColor(DARK);c.rect(0,0,W,H,fill=1,stroke=0)
c.setFillColor(HexColor('#2B000F'));c.circle(W-50,H-25,220,fill=1,stroke=0);c.setFillColor(HexColor('#4B001B'));c.circle(W-40,H-20,130,fill=1,stroke=0)
c.setFillColor(ROSE);c.setFont('QBold',12);c.drawString(46,H-66,'QELLY INTELLIGENCE')
c.setFillColor(WHITE);c.setFont('QBold',34);c.drawString(46,H-116,'Sovereign Design Rebuild')
c.setFont('QBold',22);c.drawString(46,H-151,'43 screens · 6 themes · 258 designed views')
draw_para('Deepest burgundy and porcelain white. Modular curved geometry. Smooth typography. Purposeful motion. Explicit light/dark text rules. Hover, focus, pressed and disabled states. Full offline API-backed application preserved.',46,H-195,650,'QBody',12,18,HexColor('#E8D4DC'),7)
rounded(46,60,470,170,HexColor('#21000C'),HexColor('#5B1831'),28)
c.setFillColor(ROSE);c.setFont('QBold',10);c.drawString(70,195,'DELIVERABLES')
for i,t in enumerate(['Redesigned offline full-stack website','Editable Figma generator for all screens/themes','Complete visual specification and screen PDF','Design tokens, motion rules and component states']):
    c.setFillColor(WHITE);c.setFont('QBody',10);c.drawString(70,164-i*27,'◆  '+t)
c.setFillColor(HexColor('#CDAFBA'));c.setFont('QMono',8);c.drawString(46,34,'Primary: #160008 / #2B000F / #720F32 / #F8F2F4 / #FFFDFD')
c.showPage();page+=1

# Brand DNA
c.setFillColor(CANVAS);c.rect(0,0,W,H,fill=1,stroke=0)
c.setFillColor(DARK);c.rect(0,H-118,W,118,fill=1,stroke=0);c.setFillColor(WHITE);c.setFont('QBold',25);c.drawString(36,H-66,'Brand DNA: quiet authority, not generic AI')
c.setFillColor(HexColor('#EAB5C8'));c.setFont('QBody',10);c.drawString(36,H-90,'Financial intelligence framed as a premium modular research instrument.')
principles=[('1','Darkest burgundy is structural','Navigation, page heroes, critical context and premium emphasis.'),('2','White is cognitive space','Primary reading, tables, forms and long-form research use porcelain surfaces.'),('3','Curves communicate modularity','Asymmetric 38/14, 28/11 and 20/8 radii create a recognizable system.'),('4','Motion explains change','Reveal, hover, drawer and chart motion reinforce hierarchy, not decoration.'),('5','Truth stays visible','Source, freshness, confidence, entitlement and production boundaries remain explicit.'),('6','Data remains dense but calm','Large type hierarchy, tabular numerals and progressive disclosure prevent visual fatigue.')]
for i,(n,h,b) in enumerate(principles):
    x=36+(i%3)*264;y=H-270-math.floor(i/3)*190
    rounded(x,y,238,155,HexColor('#FFFDFD'),BORDER,26);c.setFillColor(BURG);c.setFont('QBold',20);c.drawString(x+18,y+113,n);c.setFillColor(TEXT);c.setFont('QBold',11);c.drawString(x+55,y+116,h);draw_para(b,x+18,y+82,202,'QBody',8.3,11,MUTED,5)
footer(page);c.showPage();page+=1

# Theme architecture pages
for tid,name,chrome,raised,accent,canvas_col,surface,text_col,note in THEMES:
    c.setFillColor(HexColor(canvas_col));c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(HexColor(chrome));c.rect(0,H-132,W,132,fill=1,stroke=0);c.setFillColor(HexColor('#FFFFFF'));c.setFont('QBold',27);c.drawString(38,H-70,name);c.setFont('QMono',8);c.drawString(38,H-97,tid)
    draw_para(note,38,H-164,720,'QBody',10,14,HexColor(text_col),5)
    palette=[('Chrome',chrome),('Raised',raised),('Accent',accent),('Canvas',canvas_col),('Surface',surface),('Text',text_col)]
    for i,(lab,col) in enumerate(palette):
        x=38+i*126;rounded(x,H-330,108,105,HexColor(col),HexColor('#888888'),18);c.setFillColor(HexColor(text_col));c.setFont('QBold',8);c.drawString(x,H-348,lab);c.setFont('QMono',7);c.drawString(x,H-362,col)
    rounded(38,55,360,150,HexColor(surface),HexColor(accent),28);c.setFillColor(HexColor(text_col));c.setFont('QBold',18);c.drawString(62,157,'Dark text / light surface');draw_para('Use the theme text token on canvas, surface and soft surface. Muted copy uses the muted token; do not use burgundy body text for long passages.',62,128,310,'QBody',8,11,HexColor(text_col),7)
    rounded(426,55,370,150,HexColor(chrome),None,28);c.setFillColor(HexColor('#FFFFFF'));c.setFont('QBold',18);c.drawString(450,157,'Light text / dark chrome');draw_para('Use white or near-white display text on chrome, hero and dark navigation. Secondary copy may use a 72-78% white tint.',450,128,320,'QBody',8,11,HexColor('#FFFFFF'),7)
    footer(page,f'{name} theme specification');c.showPage();page+=1

# Typography
c.setFillColor(CANVAS);c.rect(0,0,W,H,fill=1,stroke=0);c.setFillColor(DARK);c.rect(0,H-100,W,100,fill=1,stroke=0);c.setFillColor(WHITE);c.setFont('QBold',26);c.drawString(38,H-62,'Typography: smooth curves with financial precision')
c.setFillColor(TEXT);c.setFont('QBold',38);c.drawString(38,H-155,'Markets become legible.')
c.setFillColor(BURG);c.setFont('QMono',9);c.drawString(38,H-181,'DISPLAY STACK: Avenir Next / Manrope / Sora / Inter')
rows=[('Hero H1','48-64','ExtraBold','-5.5%','Short, decisive page identity'),('Section H2','20-28','Bold','-3%','Panel hierarchy and narrative sections'),('Body','14-16','Regular','-0.5%','Reading and form guidance'),('Table','12-13','Regular/Medium','0','Dense numerical comparison'),('Eyebrow','9-11','Bold','+18%','Wave, state and section identifiers'),('Mono data','11-32','Regular/Bold','-4%','Prices, percentages, IDs and timestamps')]
y=H-235
for r in rows:
    rounded(38,y-44,758,53,HexColor('#FFFDFD'),BORDER,14);c.setFillColor(TEXT);c.setFont('QBold',9);c.drawString(52,y-15,r[0]);c.setFont('QMono',8);c.drawString(190,y-15,r[1]+' px');c.drawString(282,y-15,r[2]);c.drawString(410,y-15,r[3]);c.setFont('QBody',8);c.drawString(500,y-15,r[4]);y-=62
footer(page);c.showPage();page+=1

# Geometry / spacing
c.setFillColor(CANVAS);c.rect(0,0,W,H,fill=1,stroke=0);c.setFillColor(DARK);c.rect(0,H-100,W,100,fill=1,stroke=0);c.setFillColor(WHITE);c.setFont('QBold',26);c.drawString(38,H-62,'Modular geometry, spacing and elevation')
for i,r in enumerate([9,14,20,28,38]):
    x=45+i*150;rounded(x,H-270,120,105,HexColor('#FFFDFD'),BORDER,r);c.setFillColor(TEXT);c.setFont('QBold',9);c.drawCentredString(x+60,H-292,f'{r}px radius')
spacing=[('4','micro alignment'),('8','chip and icon gap'),('12','compact control'),('16','component rhythm'),('18','default bento gap'),('24','panel padding'),('32','page rhythm'),('48','hero breathing room')]
for i,(v,lab) in enumerate(spacing):
    x=45+(i%4)*190;y=H-390-math.floor(i/4)*105;c.setFillColor(BURG);c.rect(x,y,int(v)*2.3,12,fill=1,stroke=0);c.setFillColor(TEXT);c.setFont('QMono',9);c.drawString(x,y-18,v+'px');c.setFont('QBody',8);c.drawString(x+42,y-18,lab)
rounded(45,52,350,118,HexColor('#FFFDFD'),BORDER,28);c.setFillColor(TEXT);c.setFont('QBold',12);c.drawString(66,133,'Elevation 01 · default module');draw_para('1px soft border + 18px ambient shadow. Used for KPIs, tables, cards and controls.',66,107,300,'QBody',8,11,MUTED,5)
rounded(430,52,366,118,HexColor('#FFFDFD'),HexColor('#CDA8B7'),34);c.setFillColor(TEXT);c.setFont('QBold',12);c.drawString(451,133,'Elevation 02 · hover / active');draw_para('Lift -3 to -8px, stronger shadow, accent-tinted border and subtly changing asymmetric radius.',451,107,315,'QBody',8,11,MUTED,5)
footer(page);c.showPage();page+=1

# Interaction matrix
c.setFillColor(CANVAS);c.rect(0,0,W,H,fill=1,stroke=0);c.setFillColor(DARK);c.rect(0,H-100,W,100,fill=1,stroke=0);c.setFillColor(WHITE);c.setFont('QBold',26);c.drawString(38,H-62,'Hover, focus, pressed and disabled states')
columns=['Component','Default','Hover','Focus','Pressed','Disabled'];widths=[145,125,145,145,125,110];x0=30;y0=H-145
x=x0
for lab,w in zip(columns,widths):c.setFillColor(BURG);c.setFont('QBold',8);c.drawString(x+8,y0,lab.upper());x+=w
matrix=[('Primary button','Burgundy gradient','-3px + shimmer','7px accent ring','scale .985','38% opacity'),('Ghost button','Soft white/rose','Border + lift','Accent ring','surface darkens','38% opacity'),('KPI card','White bento','-8px + glow','No focus unless interactive','none','not applicable'),('Nav item','Transparent','+4px slide','White outline','active fill','muted'),('Table row','White','Accent wash + rail','row action visible','selected wash','muted cells'),('Input','Soft surface','Accent border','Ring + -1px lift','none','muted surface'),('Source link','Dotted underline','Accent color','Focus outline','none','muted'),('Chart chip','Soft pill','-2px + accent','Ring','filled state','muted')]
y=y0-25
for row in matrix:
    c.setStrokeColor(BORDER);c.line(x0,y-7,W-30,y-7);x=x0
    for val,w in zip(row,widths):
        c.setFillColor(TEXT if x==x0 else MUTED);c.setFont('QBold' if x==x0 else 'QBody',7.5);c.drawString(x+8,y,val);x+=w
    y-=43
footer(page);c.showPage();page+=1

# Motion
c.setFillColor(CANVAS);c.rect(0,0,W,H,fill=1,stroke=0);c.setFillColor(DARK);c.rect(0,H-100,W,100,fill=1,stroke=0);c.setFillColor(WHITE);c.setFont('QBold',26);c.drawString(38,H-62,'Motion specification: smooth, purposeful, reducible')
motions=[('Page enter','620-720ms','cubic-bezier(.22,1,.36,1)','opacity 0→1, Y 20→0'),('Card hover','360ms','spring','Y 0→-7, shadow and radius morph'),('Button hover','360ms','spring','magnetic pointer offset + shimmer'),('Drawer','420ms','spring','X slide + backdrop blur'),('Chart line','1500ms','ease-out','stroke dash reveal'),('Candle','620ms','ease-out','scaleY .15→1'),('Status pulse','2300ms','loop','evidence halo'),('Theme switch','280ms','ease','color, surface and shadow interpolation')]
for i,m in enumerate(motions):
    x=38+(i%2)*390;y=H-190-math.floor(i/2)*94;rounded(x,y,362,72,HexColor('#FFFDFD'),BORDER,20);c.setFillColor(TEXT);c.setFont('QBold',11);c.drawString(x+16,y+48,m[0]);c.setFillColor(BURG);c.setFont('QMono',8);c.drawString(x+16,y+29,m[1]+' · '+m[2]);c.setFillColor(MUTED);c.setFont('QBody',7.5);c.drawString(x+16,y+13,m[3])
rounded(38,48,752,70,HexColor('#FFFDFD'),HexColor('#CDA8B7'),22);c.setFillColor(TEXT);c.setFont('QBold',10);c.drawString(58,91,'Reduced motion');draw_para('All animations collapse to near-zero duration under prefers-reduced-motion or the in-product Reduced setting. No information is available only through motion.',58,73,700,'QBody',8,11,MUTED,4)
footer(page);c.showPage();page+=1

# Screen directory
for start in range(0,len(ROUTES),22):
    c.setFillColor(CANVAS);c.rect(0,0,W,H,fill=1,stroke=0);c.setFillColor(DARK);c.rect(0,H-82,W,82,fill=1,stroke=0);c.setFillColor(WHITE);c.setFont('QBold',23);c.drawString(36,H-51,'Complete screen directory')
    y=H-112
    for i,r in enumerate(ROUTES[start:start+22],start+1):
        c.setFillColor(TEXT);c.setFont('QBold',8.5);c.drawString(42,y,f'{i:02d}. {r["label"]}');c.setFillColor(MUTED);c.setFont('QMono',6.8);c.drawRightString(W-38,y,f'#/ {r["route"]} · {r["section"]} · {r["meta"]}');y-=13;draw_para(PURPOSE.get(r['route'],'Qelly Intelligence workspace.'),55,y,W-105,'QBody',6.8,9,MUTED,2);y-=18
    footer(page);c.showPage();page+=1

# screen pages: 258
screen_index=0
theme_lookup={t[0]:t for t in THEMES}
for tid,name,chrome,raised,accent,canvas_col,surface,text_col,note in THEMES:
    for idx,r in enumerate(ROUTES,1):
        screen_index+=1;shot=G/'screens'/tid/f"{r['route']}.jpg"
        if not shot.exists():raise FileNotFoundError(shot)
        c.setFillColor(HexColor(canvas_col));c.rect(0,0,W,H,fill=1,stroke=0)
        c.setFillColor(HexColor(chrome));c.rect(0,H-58,W,58,fill=1,stroke=0);c.setFillColor(HexColor('#FFFFFF'));c.setFont('QBold',14);c.drawString(24,H-35,r['label']);c.setFont('QMono',7);c.drawRightString(W-24,H-34,f'{name} · #/{r["route"]} · {screen_index}/258')
        # screenshot
        image_x=22;image_y=32;image_w=566;image_h=H-108
        rounded(image_x-4,image_y-4,image_w+8,image_h+8,HexColor(chrome),None,15);fit_image(shot,image_x,image_y,image_w,image_h)
        # details
        x=610;right=W-x-22;y=H-86;c.setFillColor(HexColor(text_col));c.setFont('QBold',10);c.drawString(x,y,'SCREEN PURPOSE');y-=15;y=draw_para(PURPOSE.get(r['route'],'Qelly Intelligence application workspace.'),x,y,right,'QBody',7.6,10,HexColor(text_col),7)-8
        c.setFillColor(HexColor(accent));c.setFont('QBold',9);c.drawString(x,y,'THEME POLARITY');y-=14
        polarity='Light typography on chrome and hero; dark typography on porcelain/white surfaces.' if tid in ['burgundy-command','porcelain-burgundy','high-contrast'] else 'Light typography on dark chrome, canvas, cards and data surfaces. White controls retain dark labels.'
        y=draw_para(polarity,x,y,right,'QBody',7.3,10,HexColor(text_col),5)-8
        c.setFillColor(HexColor(accent));c.setFont('QBold',9);c.drawString(x,y,'MODULAR COMPONENTS');y-=14
        comps={'chart':'Hero · KPI bento · chart canvas · study chips · evidence panel','table':'Hero · KPI bento · sticky data grid · filters · row actions','form':'Hero · progress KPIs · curved fields · validation · evidence cards','content':'Hero · narrative surface · citations · related cards · source drawer','cards':'Hero · KPI bento · discovery cards · state chips · context actions'}[route_type(r['route'])]
        y=draw_para(comps,x,y,right,'QBody',7.3,10,HexColor(text_col),5)-8
        c.setFillColor(HexColor(accent));c.setFont('QBold',9);c.drawString(x,y,'HOVER & MOTION');y-=14;y=draw_para(INTERACTIONS[route_type(r['route'])],x,y,right,'QBody',7.3,10,HexColor(text_col),6)-8
        c.setFillColor(HexColor(accent));c.setFont('QBold',9);c.drawString(x,y,'RESPONSIVE RULE');y-=14;y=draw_para('Desktop uses persistent 276px navigation and modular multi-column panels. Tablet collapses major columns. Mobile uses single-column cards, reduced hero scale, contained data overflow and touch-sized controls.',x,y,right,'QBody',7.3,10,HexColor(text_col),8)-8
        c.setFillColor(HexColor(accent));c.setFont('QBold',9);c.drawString(x,y,'TRUTH / API BOUNDARY');y-=14;draw_para('The screen is backed by the packaged local API and deterministic state. Licensed live data, production identity, external delivery, broker execution, transfers, withdrawals, private keys and recovery phrases remain disabled.',x,y,right,'QBody',7.3,10,HexColor(text_col),9)
        c.setFillColor(HexColor(accent));c.circle(W-34,22,6,fill=1,stroke=0);c.setFillColor(HexColor(text_col));c.setFont('QMono',6.5);c.drawRightString(W-46,19,f'{r["section"]} · {r["meta"]}')
        c.showPage();page+=1

c.save()
print(json.dumps({'pdf':str(PDF),'pages':page-1,'screens':screen_index},indent=2))
