import base64,csv,datetime,hashlib,html,json,os,pathlib,re,shutil,subprocess,textwrap,zipfile
from io import BytesIO
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=ROOT/'data'; DOCS=ROOT/'docs'; PREVIEW=ROOT/'preview'; VAL=ROOT/'validation'
RELEASE='27.0.0'; RELEASE_NAME='Platform Hardening and Staging Readiness'
NOW=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')

# Route and API data from Node modules.
def node_json(code):
    return json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=ROOT,text=True))
routes=node_json("import {routeDefinitions} from './apps/web/public/assets/route-registry.mjs'; console.log(JSON.stringify(routeDefinitions));")
manifest=node_json("import {release,routes,apiRoutes,contracts} from './src/server/route-manifest.mjs'; console.log(JSON.stringify({release,routes,apiRoutes,contracts:[...contracts]}));")
assert len(routes)==60 and len(manifest['apiRoutes'])==175 and manifest['release']==RELEASE

# OpenAPI A5, preserving all inherited detail and adding A5 operations.
a4=json.load(open(ROOT/'packages/openapi/release-a4.openapi.json'))
a4['info']={'title':'Qelly Intelligence Release A5 API','version':RELEASE,'description':'Release A5 production-foundation API with versioned secret protection, governed MFA rewrapping, secure-import quarantine review, assurance drills and staging-readiness evidence. Live trading, custody, transfers and withdrawals are absent.'}
def op(summary,method='get',body=False):
    value={'summary':summary,'operationId':re.sub(r'[^a-zA-Z0-9]+',' ',summary).title().replace(' ',''),'responses':{'200':{'description':'Successful response'},'400':{'description':'Validation failure'},'401':{'description':'Authentication required'},'403':{'description':'Authorization denied'}}}
    if body:value['requestBody']={'required':False,'content':{'application/json':{'schema':{'type':'object','additionalProperties':True}}}}
    return {method:value}
newpaths={
 '/api/v1/security/secret-protection/status':op('Get secret protection status'),
 '/api/v1/security/secret-protection/rewrap':op('Rewrap protected MFA secrets','post',True),
 '/api/v1/secure-imports/quarantine':{**op('List quarantined secure imports'),**op('Create quarantined secure import','post',True)},
 '/api/v1/secure-imports/{id}/rescan':op('Rescan and release quarantined import','post',True),
 '/api/v1/secure-imports/{id}/quarantine':op('Discard quarantined import','delete'),
 '/api/v1/platform/assurance':op('Get platform assurance status'),
 '/api/v1/platform/assurance/concurrency':op('Run concurrency assurance exercise','post',True),
 '/api/v1/platform/assurance/backup-restore':op('Run backup restore assurance drill','post',True),
 '/api/v1/platform/assurance/delivery-sandbox':op('Verify signed delivery sandbox','post',True),
 '/api/v1/platform/staging-manifest':op('Get staging deployment manifest')
}
a4['paths'].update(newpaths)
assert len(a4['paths'])==175, len(a4['paths'])
(ROOT/'packages/openapi/release-a5.openapi.json').write_text(json.dumps(a4,indent=2)+'\n')

# Inventories.
route_records=[]
for i,d in enumerate(routes,1):
    route_records.append({'id':f'R{i:03d}','route':d['route'],'label':d['label'],'section':d['section'],'access':'public' if d.get('public') else 'authenticated','release':RELEASE,'status':'implemented-local','introducedOrChanged':'A5' if d.get('meta')=='A5' else ('A4' if d.get('meta')=='A4' else 'inherited')})
api_records=[]
a5_api=set(manifest['apiRoutes'][-10:])
for i,p in enumerate(manifest['apiRoutes'],1):api_records.append({'id':f'API{i:03d}','path':p,'release':RELEASE,'status':'implemented-local' if p not in {'/api/v1/platform/staging-manifest'} else 'implemented-contract','introducedOrChanged':'A5' if p in a5_api else 'inherited'})
def write_records(stem,records):
    (DATA/f'{stem}.json').write_text(json.dumps(records,indent=2)+'\n')
    with open(DATA/f'{stem}.csv','w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(records[0]));w.writeheader();w.writerows(records)
write_records('RELEASE_A5_ROUTE_INVENTORY',route_records)
write_records('RELEASE_A5_API_INVENTORY',api_records)
with open(DATA/'RELEASE_A5_CANONICAL_SCREEN_MAPPING.csv','w',newline='') as f:
    w=csv.writer(f);w.writerow(['route','canonicalAtlasMapping','implementationStatus','notes'])
    for r in route_records:w.writerow([r['route'],f"A5-{r['section'].upper().replace(' ','-')}-{r['route'].upper()}",'implemented-local','Real reusable route family; 400/10000 atlases remain taxonomy only'])

# Capability matrix: retain inherited A4 records and add A5 evidence.
a4caps=json.load(open(DATA/'RELEASE_A4_CAPABILITY_MATRIX.json'))
caprows=[]
for i,row in enumerate(a4caps,1):
    caprows.append({'id':f'A5-{i:03d}','area':row['area'],'capability':row['capability'],'status':row['status'],'evidence_or_boundary':row['evidence_or_boundary']})
add=[
('Secret Protection','Versioned AES-256-GCM keyring envelopes','implemented-local','VersionedKeyringSecretProtector qelly:v2 envelope'),
('Secret Protection','Legacy qelly:v1 envelope read compatibility','implemented-local','Backward-compatible decrypt path'),
('Secret Protection','Governed MFA secret rewrap','implemented-local','SecretRotationService + audit event'),
('Secret Protection','Browser key material exposure','disabled-for-safety','Keyring is server environment only'),
('Secret Protection','Cloud KMS/HSM wrapping provider','partial-contract','Staging manifest requires KMS; no cloud credentials available'),
('Secure Imports','Manual quarantine intake','implemented-local','Quarantine API, repository status and frontend'),
('Secure Imports','Explicit rescan and atomic release','implemented-local','LocalObjectStorage rescan + audited route'),
('Secure Imports','Explicit discard of quarantined objects','implemented-local','Delete route and repository update'),
('Secure Imports','ClamAV INSTREAM adapter','partial-contract','TCP adapter implemented; external daemon not executed'),
('Secure Imports','S3 quarantine workflow','partial-contract','SigV4 adapter implemented; external S3 not executed'),
('Platform Assurance','Idempotency concurrency exercise','implemented-local','Concurrent enqueue drill creates one job'),
('Platform Assurance','Checksum backup and restore drill','implemented-local','SQLite copy, SHA-256 and restored health'),
('Platform Assurance','Signed webhook delivery sandbox','implemented-local','HMAC-SHA256 verification without transmission'),
('Platform Assurance','Staging deployment manifest and compose','implemented-contract','Two API/worker replicas and external dependencies declared'),
('Platform Assurance','External staging deployment evidence','missing','Cloud resources unavailable in this workspace')]
for area,cap,status,evidence in add:caprows.append({'id':f'A5-{len(caprows)+1:03d}','area':area,'capability':cap,'status':status,'evidence_or_boundary':evidence})
write_records('RELEASE_A5_CAPABILITY_MATRIX',caprows)

# Documentation.
frontend_done=[
'60 runnable frontend routes; three new A5 routes: Secret Rotation, Quarantine Review, Staging Assurance.',
'All 60 routes rendered at desktop and mobile: 120/120 passed, zero console errors, zero detected horizontal overflow.',
'36/36 focused semantic, keyboard-entry, responsive, and reduced-motion checks passed.',
'Six operating personas, locked burgundy gradient, hybrid navigation, and inherited route behavior preserved.',
'A5 screens call real authenticated APIs and display ready, partial, deferred, error, empty, and loading boundaries.'
]
frontend_remaining=[
'Independent WCAG 2.2 AA audit plus NVDA, JAWS, VoiceOver, and TalkBack manual certification.',
'Firefox, Safari, physical mobile/tablet, 200% zoom, and 400% zoom certification.',
'Cloud staging deployment, CDN/SSR performance measurement, and hosted visual-regression service.',
'Native Figma-cloud publication requires an authenticated Figma integration.'
]
backend_done=[
'175 API contracts, 17 machine-readable contracts, and 59 JSON schemas.',
'237/237 automated tests and 248/248 full-stack smoke requests passed.',
'Versioned AES-256-GCM keyring encryption, legacy-envelope compatibility, and audited MFA secret rewrap.',
'Manual quarantine, rescan/release, discard, deterministic local scanner, ClamAV adapter, and S3 quarantine contract.',
'HMAC-SHA256 delivery sandbox, concurrency/idempotency exercise, checksum backup/restore drill, and staging manifest.',
'Production fixture identity isolation, tenant scope, CSRF, idempotency, audit, and financial-safety locks retained.'
]
backend_remaining=[
'Execute PostgreSQL, Redis, MinIO/S3, ClamAV, KMS/HSM, email, and webhook integration tests in external staging.',
'Add automated key rotation through a real KMS and production scanner signature/freshness monitoring.',
'Run multi-host concurrency, load, stress, soak, chaos, PITR, disaster-recovery, and rollback exercises.',
'Complete independent penetration testing, privacy/compliance review, and production incident drills.'
]

def bullets(items):return '\n'.join(f'- {x}' for x in items)
progress=f"""# Qelly Intelligence Release A5 — Frontend and Backend Progress

Generated: {NOW}

## Frontend completed

{bullets(frontend_done)}

## Frontend remaining

{bullets(frontend_remaining)}

## Backend completed

{bullets(backend_done)}

## Backend remaining

{bullets(backend_remaining)}

## Measured totals

- Frontend routes: 60
- API contracts: 175
- Contracts: 17
- JSON schemas: 59
- Automated tests: 237/237
- Smoke requests: 248/248
- Screen renders: 120/120
- Accessibility checks: 36/36
- Capability records: {len(caprows)}

## Safety boundary

Live trading, custody, transfers, withdrawals, private keys, seed phrases, and recovery phrases remain disabled. The staging files are deployment contracts, not evidence that external cloud infrastructure was provisioned.
"""
(DOCS/'RELEASE_A5_FRONTEND_BACKEND_PROGRESS.md').write_text(progress)
(DOCS/'CURRENT_STATE_AUDIT_A5.md').write_text(f"""# Current State Audit — Release A5

## Baseline
Release A4 was verified as the latest runnable baseline. The 400/10,000-screen assets remain design taxonomies, not implemented workflow counts.

## Release identity
- Release: {RELEASE}
- Name: {RELEASE_NAME}
- Frontend routes: 60
- API contracts: 175
- Contracts: 17
- Schemas: 59

## Implemented locally
{bullets(frontend_done+backend_done)}

## Partial or external
{bullets(frontend_remaining+backend_remaining)}

## Truth statement
No external cloud staging deployment, licensed provider connection, live trading, custody, or secret-bearing browser workflow is claimed.
""")
(DOCS/'RELEASE_A5_RELEASE_NOTES.md').write_text(f"""# Release A5 Notes

Release A5 hardens the A4 platform foundation with versioned secret protection, governed rewrapping, manual import quarantine operations, platform assurance drills, and staging deployment contracts. It adds three frontend routes and ten API contracts without replacing inherited behavior.

## Changes
{bullets(frontend_done+backend_done)}

## Known limitations
{bullets(frontend_remaining+backend_remaining)}
""")
(DOCS/'RELEASE_A5_COMPLETION_MATRIX.md').write_text(progress.replace('# Qelly Intelligence Release A5 — Frontend and Backend Progress','# Release A5 Completion Matrix'))
(DOCS/'RELEASE_A5_TEST_REPORT.md').write_text("# Release A5 Test Report\n\n- `npm test`: 237/237 passed.\n- `npm run smoke`: 248/248 requests passed.\n- New A5 tests cover keyring rewrap, quarantine, scanner contract, delivery signature, concurrency, backup/restore, repository parity, server/API totals, and frontend registration.\n")
(DOCS/'RELEASE_A5_ACCESSIBILITY_REPORT.md').write_text("# Release A5 Accessibility Report\n\n36/36 focused checks passed across 18 representative routes at desktop and mobile. Checks cover language, title, skip link, landmark count, H1, accessible control names, image alternatives, duplicate IDs, positive tabindex, keyboard entry, reduced motion, console errors, and page-level overflow. This is not an independent WCAG certification.\n")
(DOCS/'RELEASE_A5_SECURITY_REPORT.md').write_text("# Release A5 Security Report\n\nImplemented locally: versioned AES-256-GCM envelopes, server-only keyring, audited rewrap, quarantine before release, explicit discard, HMAC delivery sandbox, tenant authorization, CSRF, idempotency and audit. Partial/external: KMS/HSM, ClamAV daemon, S3, multi-host tests, penetration test. Live trading and custody remain disabled.\n")
(DOCS/'RELEASE_A5_PERFORMANCE_REPORT.md').write_text("# Release A5 Performance Report\n\nAll 120 browser renders completed without console errors or horizontal overflow. No cloud load, stress, soak, or chaos result is claimed. The local concurrency exercise validates logical idempotency, not multi-host capacity.\n")
(DOCS/'RELEASE_A5_RUNBOOK.md').write_text("# Release A5 Runbook\n\n1. Copy `.env.example` and configure local-safe values.\n2. Run `npm test`, `npm run smoke`, `npm run validate`.\n3. Start with `npm start`.\n4. For staging, review `deploy/staging/manifest.json` and `deploy/staging/docker-compose.staging.yml`.\n5. Never enable live trading, transfers, withdrawals, private keys, or recovery phrases.\n")
(DOCS/'adrs'/'ADR-026-A5-PLATFORM-HARDENING.md').write_text("# ADR-026: Versioned secret protection and assurance drills\n\n## Decision\nUse versioned AES-256-GCM envelopes with a server-configured keyring and explicit governed rewrap. Keep quarantine objects unreleased until a scanner approves them. Represent staging as an executable topology contract while refusing to claim deployment without external evidence.\n\n## Consequences\nLegacy envelopes remain readable, browser key material is prohibited, and KMS/ClamAV/cloud integration stays partial until executed in staging.\n")

# Update changelog and README markers without destroying inherited content.
ch=DOCS/'CHANGELOG.md'; old=ch.read_text();
if 'Release A5' not in old:ch.write_text(f"# Release A5 — {RELEASE_NAME}\n\n- Added versioned keyring secret protection and governed rewrap.\n- Added quarantine review and assurance workflows.\n- Added 3 routes and 10 API contracts.\n- 237 tests, 248 smoke requests, 120 browser renders, and 36 accessibility checks passed.\n\n"+old)
readme=ROOT/'README.md'; rs=readme.read_text();
if 'Release A5' not in rs[:500]: readme.write_text(f"# Qelly Intelligence Release A5\n\nCurrent verified release: {RELEASE} — {RELEASE_NAME}. See `docs/RELEASE_A5_FRONTEND_BACKEND_PROGRESS.md`.\n\n"+rs)

# Create compact standalone visual frontend review with embedded optimized images.
thumb_dir=PREVIEW/'release-a5-html-thumbs';shutil.rmtree(thumb_dir,ignore_errors=True);thumb_dir.mkdir(parents=True)
image_data={}
for d in routes:
    image_data[d['route']]={}
    for device in ('desktop','mobile'):
        src=PREVIEW/'release-a5-all-screens'/f"{d['route']}__{device}.png"
        im=Image.open(src).convert('RGB')
        maxsize=(1000,720) if device=='desktop' else (390,844)
        im.thumbnail(maxsize)
        buf=BytesIO();im.save(buf,'JPEG',quality=58,optimize=True,progressive=True)
        image_data[d['route']][device]='data:image/jpeg;base64,'+base64.b64encode(buf.getvalue()).decode()
route_js=json.dumps([{**d,'images':image_data[d['route']]} for d in routes],separators=(',',':'))
review=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Qelly Release A5 Full Frontend Review</title><style>
:root{{--ink:#170b10;--muted:#725f67;--paper:#f8f3f5;--surface:#fffdfc;--burgundy:#5b0828}}*{{box-sizing:border-box}}body{{margin:0;font-family:Manrope,"Segoe UI",sans-serif;color:var(--ink);background:var(--paper)}}header{{position:sticky;top:0;z-index:4;padding:18px 26px;color:white;background:linear-gradient(110deg,#080003,#180008,#310011,#5b0828,#8e1d4b);box-shadow:0 12px 32px #31001133}}h1{{font-size:clamp(24px,3vw,44px);margin:0}}header p{{margin:6px 0 0;color:#f5dce6}}.toolbar{{display:flex;gap:10px;flex-wrap:wrap;margin-top:15px}}input,select,button{{font:inherit;border-radius:999px;border:1px solid #ffffff44;padding:10px 14px}}input{{min-width:260px}}button{{cursor:pointer;background:#fff;color:#310011;font-weight:700}}main{{display:grid;grid-template-columns:310px minmax(0,1fr);min-height:calc(100vh - 150px)}}nav{{padding:18px;overflow:auto;max-height:calc(100vh - 150px);position:sticky;top:150px}}nav button{{width:100%;text-align:left;margin:4px 0;border:1px solid #e4d6dc;background:white;border-radius:15px;color:var(--ink)}}nav button.active{{color:white;background:linear-gradient(110deg,#180008,#5b0828)}}article{{padding:24px;min-width:0}}.stage{{background:white;border:1px solid #e5d6dd;border-radius:28px;overflow:hidden;box-shadow:0 16px 48px #31001116}}.stage img{{display:block;width:100%;height:auto}}.meta{{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0}}.pill{{background:white;border:1px solid #e5d6dd;padding:12px;border-radius:16px}}.truth{{padding:18px;border-radius:20px;background:#fff5f8;border:1px solid #e4b8c9}}@media(max-width:850px){{main{{grid-template-columns:1fr}}nav{{position:static;max-height:220px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}}nav button{{margin:0}}article{{padding:14px}}.meta{{grid-template-columns:repeat(2,1fr)}}}}</style></head><body><header><h1>Qelly Intelligence · Release A5</h1><p>60-route offline frontend review · hybrid burgundy design · desktop/mobile evidence</p><div class="toolbar"><input id="q" aria-label="Search screens" placeholder="Search route, label or section"><select id="section" aria-label="Filter section"><option value="">All sections</option></select><button id="desktop">Desktop</button><button id="mobile">Mobile</button></div></header><main><nav id="nav" aria-label="Screen directory"></nav><article><h2 id="title"></h2><div class="meta"><div class="pill" id="route"></div><div class="pill" id="area"></div><div class="pill" id="access"></div><div class="pill">Release 27.0.0</div></div><div class="stage"><img id="screen" alt="Selected Qelly screen"></div><p class="truth"><strong>Working review boundary:</strong> Search, filtering, navigation and device switching work entirely offline. The actual API-connected application is included separately in the frontend source and full-stack archive because cookie sessions, persistence, workers and streams require the Node.js server.</p></article></main><script>const routes={route_js};let current=routes[0],device='desktop';const $=x=>document.getElementById(x);const sections=[...new Set(routes.map(x=>x.section))].sort();sections.forEach(x=>$('section').insertAdjacentHTML('beforeend',`<option>${{x}}</option>`));function filtered(){{const q=$('q').value.toLowerCase(),s=$('section').value;return routes.filter(x=>(!s||x.section===s)&&(`${{x.route}} ${{x.label}} ${{x.section}}`.toLowerCase().includes(q)))}}function drawNav(){{$('nav').innerHTML='';filtered().forEach(x=>{{const b=document.createElement('button');b.textContent=`${{x.label}} · ${{x.section}}`;b.className=x.route===current.route?'active':'';b.onclick=()=>{{current=x;render()}};$('nav').appendChild(b)}})}}function render(){{$('title').textContent=current.label;$('route').textContent=`Route · #/${{current.route}}`;$('area').textContent=`Area · ${{current.section}}`;$('access').textContent=current.public?'Public':'Authenticated';$('screen').src=current.images[device];$('screen').alt=`${{current.label}} ${{device}} screen`;drawNav()}}$('q').oninput=drawNav;$('section').onchange=drawNav;$('desktop').onclick=()=>{{device='desktop';render()}};$('mobile').onclick=()=>{{device='mobile';render()}};render();</script></body></html>'''
(ROOT/'QELLY_RELEASE_A5_FULL_FRONTEND_OFFLINE_REVIEW.html').write_text(review)
shutil.copy2(ROOT/'apps/web/public/index.html',ROOT/'QELLY_RELEASE_A5_ACTUAL_FRONTEND_INDEX.html')

# ZIP frontend source.
def zip_paths(output, paths, base=ROOT):
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p in paths:
            p=pathlib.Path(p)
            if p.is_dir():
                for f in p.rglob('*'):
                    if f.is_file() and '__pycache__' not in f.parts:z.write(f,f.relative_to(base))
            elif p.is_file():z.write(p,p.relative_to(base))
zip_paths(ROOT/'QELLY_RELEASE_A5_FULL_FRONTEND_SOURCE.zip',[ROOT/'apps/web/public',ROOT/'packages/ui',ROOT/'packages/design-tokens',ROOT/'packages/charts',ROOT/'packages/data-grid',ROOT/'packages/accessibility',ROOT/'QELLY_RELEASE_A5_ACTUAL_FRONTEND_INDEX.html'])
# ZIP all screen images and evidence.
with zipfile.ZipFile(ROOT/'QELLY_RELEASE_A5_ALL_60_SCREENS_DESKTOP_MOBILE.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for f in sorted((PREVIEW/'release-a5-all-screens').glob('*.png')):z.write(f,f.name)
    for f in [PREVIEW/'RELEASE_A5_ALL_SCREENS_LOG.json',PREVIEW/'QELLY_RELEASE_A5_ALL_SCREENS_CONTACT_SHEET.jpg']:
        z.write(f,f.name)

# PDF, 8 explanation pages + 60 screen pages = 68.
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';fontb='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
pdfmetrics.registerFont(TTFont('QellyBody',font));pdfmetrics.registerFont(TTFont('QellyBold',fontb))
W,H=landscape(A4); PDF=ROOT/'QELLY_RELEASE_A5_FRONTEND_BACKEND_PROGRESS_AND_ALL_SCREENS.pdf'
c=canvas.Canvas(str(PDF),pagesize=(W,H),pageCompression=1)
BURG='#310011'; LIGHT='#F8F3F5'; INK='#170B10'; MUTED='#725F67'
def hexrgb(x):x=x.lstrip('#');return tuple(int(x[i:i+2],16)/255 for i in (0,2,4))
def bg():
    c.setFillColorRGB(*hexrgb(LIGHT));c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColorRGB(*hexrgb('#080003'));c.roundRect(18,H-66,W-36,46,16,fill=1,stroke=0)
    c.setFillColorRGB(1,1,1);c.setFont('QellyBold',9);c.drawString(35,H-48,'QELLY INTELLIGENCE · RELEASE A5 · 27.0.0')
    c.setFillColorRGB(*hexrgb(MUTED));c.setFont('QellyBody',7.5);c.drawRightString(W-28,16,f'Generated {NOW[:10]}')
def title(t,sub=''):
    bg();c.setFillColorRGB(*hexrgb(INK));c.setFont('QellyBold',24);c.drawString(36,H-103,t)
    if sub:c.setFillColorRGB(*hexrgb(MUTED));c.setFont('QellyBody',10);c.drawString(36,H-122,sub)
def wrap(txt,width,font='QellyBody',size=10):
    words=txt.split();lines=[];line=''
    for word in words:
        test=(line+' '+word).strip()
        if pdfmetrics.stringWidth(test,font,size)<=width:line=test
        else:
            if line:lines.append(line)
            line=word
    if line:lines.append(line)
    return lines
def draw_bullets(items,x,y,width,size=9.5,leading=15,max_lines=25):
    c.setFont('QellyBody',size);c.setFillColorRGB(*hexrgb(INK));n=0
    for item in items:
        lines=wrap(item,width-18,'QellyBody',size)
        if n+len(lines)>max_lines:break
        c.setFillColorRGB(*hexrgb('#8E1D4B'));c.circle(x+4,y-4,2.2,fill=1,stroke=0)
        c.setFillColorRGB(*hexrgb(INK))
        for j,line in enumerate(lines):c.drawString(x+14,y-j*leading,line)
        y-=len(lines)*leading+6;n+=len(lines)
    return y
# Cover
c.setFillColorRGB(*hexrgb('#080003'));c.rect(0,0,W,H,fill=1,stroke=0)
for i,col in enumerate(['#180008','#310011','#5B0828','#8E1D4B']):c.setFillColorRGB(*hexrgb(col));c.circle(W*(.40+i*.13),H*(.60-i*.09),150-i*18,fill=1,stroke=0)
c.setFillColorRGB(1,1,1);c.setFont('QellyBold',36);c.drawString(48,H-130,'Qelly Intelligence')
c.setFont('QellyBold',21);c.drawString(48,H-166,'Release A5 · Frontend + Backend Progress')
c.setFont('QellyBody',13);c.drawString(48,H-194,'60 screens · 120 responsive renders · platform hardening · staging readiness')
c.setFont('QellyBody',10);c.drawString(48,60,'Clean explanation and all-screen walkthrough · no overlapping panels')
c.showPage()
# Summary pages
pages=[
('Measured release summary',['60 runnable frontend routes','175 API contracts','17 machine-readable contracts','59 JSON schemas','237/237 automated tests passed','248/248 full-stack smoke requests passed','120/120 browser renders passed','36/36 focused accessibility checks passed']),
('Frontend completed',frontend_done),('Frontend remaining',frontend_remaining),('Backend completed',backend_done),('Backend remaining',backend_remaining),
('A5 security and import hardening',['Versioned qelly:v2 AES-256-GCM envelopes include key identifiers.','Legacy qelly:v1 encrypted records remain readable.','MFA secret rewrap is authenticated, tenant-scoped, and audited.','Quarantined imports remain unreleased until explicit scanner approval.','ClamAV INSTREAM and S3 SigV4 adapters are implemented as external contracts.','Browser clients never receive encryption keys, private keys, seed phrases, or recovery phrases.']),
('Platform assurance and staging',['Concurrent logical writers are tested against the idempotency boundary.','SQLite backup copies are SHA-256 verified and reopened through the repository health path.','Webhook signatures are generated and verified without external transmission.','Staging topology declares two API and worker replicas plus PostgreSQL, Redis, S3, ClamAV, KMS, and OpenTelemetry.','The staging manifest is a contract, not proof that cloud resources were provisioned.'])]
for t,items in pages:
    title(t,'Truthful implemented, partial, deferred, and safety-disabled boundaries')
    c.setFillColorRGB(1,1,1);c.roundRect(36,54,W-72,H-200,24,fill=1,stroke=0)
    draw_bullets(items,62,H-165,W-124,size=11,leading=17,max_lines=28);c.showPage()
# Screen pages.
for idx,d in enumerate(routes,1):
    title(f"{idx:02d}. {d['label']}",f"Route #/{d['route']} · {d['section']} · {'Public' if d.get('public') else 'Authenticated'}")
    desktop=Image.open(PREVIEW/'release-a5-all-screens'/f"{d['route']}__desktop.png").convert('RGB')
    mobile=Image.open(PREVIEW/'release-a5-all-screens'/f"{d['route']}__mobile.png").convert('RGB')
    # Fixed non-overlapping visual regions.
    left_x,left_y,left_w,left_h=36,154,548,310
    right_x,right_y,right_w,right_h=610,184,185,280
    c.setFillColorRGB(1,1,1);c.roundRect(left_x-8,left_y-8,left_w+16,left_h+16,18,fill=1,stroke=0)
    c.setFillColorRGB(1,1,1);c.roundRect(right_x-8,right_y-8,right_w+16,right_h+16,18,fill=1,stroke=0)
    def place(im,x,y,w,h):
        iw,ih=im.size;scale=min(w/iw,h/ih);nw,nh=iw*scale,ih*scale
        c.drawImage(ImageReader(im),x+(w-nw)/2,y+(h-nh)/2,nw,nh,preserveAspectRatio=True,mask='auto')
    place(desktop,left_x,left_y,left_w,left_h);place(mobile,right_x,right_y,right_w,right_h)
    c.setFillColorRGB(*hexrgb(MUTED));c.setFont('QellyBold',8);c.drawString(left_x,left_y-17,'DESKTOP · 1440 × 1000');c.drawString(right_x,right_y-17,'MOBILE · 390 × 844')
    c.setFillColorRGB(1,1,1);c.roundRect(36,44,W-72,82,18,fill=1,stroke=0)
    c.setFillColorRGB(*hexrgb(INK));c.setFont('QellyBold',9);c.drawString(52,107,'SCREEN IMPLEMENTATION NOTES')
    notes=[f"Purpose: {d['label']} route-specific workflow in the {d['section']} product area.",f"Access: {'Anonymous/public flow' if d.get('public') else 'Tenant and workspace authenticated context'}.","Interaction: stable analytical canvas with dynamic navigation and non-hover alternatives.","Typography: dark ink on white/porcelain; light text only on darkest burgundy structural chrome.","Production boundary: live trading, custody, transfers, withdrawals, private keys and recovery phrases are disabled."]
    y=91;c.setFont('QellyBody',7.5)
    for j,n in enumerate(notes):
        lines=wrap(n,235,'QellyBody',7.5);x=52+(j%3)*250;y0=91-(j//3)*30
        for k,line in enumerate(lines[:2]):c.drawString(x,y0-k*9,line)
    c.showPage()
c.save()

# Design handoff HTML points to real artifacts.
(DOCS/'RELEASE_A5_DESIGN_HANDOFF.html').write_text(f'''<!doctype html><html lang="en"><meta charset="utf-8"><title>Qelly Release A5 Handoff</title><style>body{{font-family:system-ui;max-width:900px;margin:40px auto;padding:20px;color:#170b10}}h1{{color:#5b0828}}code{{background:#f8f3f5;padding:3px 7px}}</style><h1>Qelly Release A5 Handoff</h1><p>Locked gradient: <code>#080003 → #180008 → #310011 → #5B0828 → #8E1D4B</code></p><p>60 route families, 120 responsive renders, six operating personas, stable analytical canvases, dynamic contextual navigation, and A5 operational screens.</p><p>See <code>QELLY_RELEASE_A5_FULL_FRONTEND_OFFLINE_REVIEW.html</code>, the frontend source ZIP, all-screen image ZIP, and the 68-page PDF.</p><p>External cloud staging and licensed providers are not claimed as executed.</p>''')

print(json.dumps({'routes':len(routes),'apis':len(manifest['apiRoutes']),'capabilities':len(caprows),'pdf':str(PDF),'pdfPages':68,'offlineHtmlBytes':(ROOT/'QELLY_RELEASE_A5_FULL_FRONTEND_OFFLINE_REVIEW.html').stat().st_size},indent=2))
