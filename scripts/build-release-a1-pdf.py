from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from PIL import Image
from pathlib import Path
import json, textwrap, datetime

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'QELLY_RELEASE_A1_PRODUCTION_FOUNDATION_WALKTHROUGH.pdf'
W,H=landscape(A4)
BURG0=HexColor('#080003');BURG1=HexColor('#180008');BURG2=HexColor('#310011');BURG3=HexColor('#5B0828');BURG4=HexColor('#8E1D4B')
PAPER=HexColor('#F8F3F5');INK=HexColor('#170B10');MUTED=HexColor('#715F67');LINE=HexColor('#E7D9DF');GOOD=HexColor('#16834F');BAD=HexColor('#C33B50');INFO=HexColor('#4169A1')
c=canvas.Canvas(str(OUT),pagesize=(W,H));c.setTitle('Qelly Release A1 Production Platform Foundation')

def gradient_header(title,subtitle='',eyebrow='QELLY INTELLIGENCE / RELEASE A1'):
    steps=80
    colors=[(8,0,3),(24,0,8),(49,0,17),(91,8,40),(142,29,75)]
    for i in range(steps):
        t=i/(steps-1);seg=min(3,int(t*4));u=t*4-seg
        a=colors[seg];b=colors[seg+1]
        col=HexColor('#%02x%02x%02x'%tuple(int(a[j]+(b[j]-a[j])*u) for j in range(3)))
        c.setFillColor(col);c.rect(i*W/steps,H-110,W/steps+1,110,stroke=0,fill=1)
    c.setFillColor(white);c.setFont('Helvetica-Bold',9);c.drawString(32,H-28,eyebrow)
    c.setFont('Helvetica-Bold',26);c.drawString(32,H-64,title)
    if subtitle:c.setFont('Helvetica',10);c.drawString(32,H-84,subtitle)
    c.setStrokeColor(HexColor('#D96A99'));c.setLineWidth(1);c.line(32,H-100,W-32,H-100)

def footer(page_no):
    c.setFillColor(MUTED);c.setFont('Helvetica',7);c.drawString(32,18,'Qelly Intelligence - Release A1 - Production Platform Foundation')
    c.drawRightString(W-32,18,f'Page {page_no}')

def wrap(text,width,font='Helvetica',size=10):
    avg=max(1,stringWidth('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',font,size)/52)
    return textwrap.wrap(text,max(12,int(width/avg)))

def paragraph(text,x,y,width,size=10,color=INK,leading=None,bold=False,max_lines=None):
    font='Helvetica-Bold' if bold else 'Helvetica';leading=leading or size*1.45
    c.setFillColor(color);c.setFont(font,size)
    lines=wrap(text,width,font,size)
    if max_lines:lines=lines[:max_lines]
    for line in lines:
        c.drawString(x,y,line);y-=leading
    return y

def bullet_list(items,x,y,width,size=10,color=INK,gap=4):
    for item in items:
        c.setFillColor(BURG4);c.circle(x+3,y+3,2,stroke=0,fill=1)
        y=paragraph(item,x+14,y,width-14,size,color,leading=size*1.35)
        y-=gap
    return y

def image_fit(path,x,y,w,h):
    im=Image.open(path);iw,ih=im.size;scale=min(w/iw,h/ih);nw,nh=iw*scale,ih*scale
    c.drawImage(ImageReader(im),x+(w-nw)/2,y+(h-nh)/2,nw,nh,preserveAspectRatio=True,mask='auto')
    c.setStrokeColor(LINE);c.roundRect(x,y,w,h,12,stroke=1,fill=0)

def card(x,y,w,h,title,body='',fill=PAPER):
    c.setFillColor(fill);c.setStrokeColor(LINE);c.roundRect(x,y,w,h,14,stroke=1,fill=1)
    c.setFillColor(BURG3);c.setFont('Helvetica-Bold',9);c.drawString(x+14,y+h-22,title.upper())
    if body: paragraph(body,x+14,y+h-42,w-28,9,INK,leading=12,max_lines=8)

def new_page(title,subtitle='',eyebrow='QELLY INTELLIGENCE / RELEASE A1'):
    nonlocal_placeholder=None
    gradient_header(title,subtitle,eyebrow)

def end(page):footer(page);c.showPage()

page=1
gradient_header('Production Platform Foundation','A truthful continuation from the Part 22 runnable baseline')
c.setFillColor(PAPER);c.roundRect(32,54,W-64,H-190,28,stroke=0,fill=1)
c.setFillColor(INK);c.setFont('Helvetica-Bold',34);c.drawString(64,H-178,'From advanced local prototype')
c.drawString(64,H-220,'to deployable multi-user foundation.')
paragraph('Release A1 introduces database-backed authentication, organization and workspace persistence, secure cookie sessions, persistent jobs, a worker-driven in-app notification path, migrations, health/readiness and production-simulation deployment assets.',64,H-270,W-300,14,INK,leading=20)
card(W-250,H-340,186,142,'Verified baseline','Part 22 full-stack archive\nSHA-256 verified\nDesign atlases treated as taxonomy only',white)
card(64,85,210,102,'50 routes','47 inherited + login, registration and account-session.',white)
card(292,85,210,102,'144 APIs','Existing API surface preserved with production-foundation endpoints.',white)
card(520,85,210,102,'207 tests','Finished source passed the complete automated regression suite.',white)
end(page);page+=1

gradient_header('Current-state audit','What was inherited, what was fixed, and what changed')
card(32,H-250,250,112,'Runnable baseline','Part 22 Sovereign Live Markets Experience is the actual engineering baseline. Later 400/10,000-screen artifacts are design atlases, not production implementations.',white)
card(300,H-250,250,112,'Inherited defect','A fixed fixture session expired over time and caused one live-market regression failure. Local simulated sessions now renew only in explicit development mode.',white)
card(568,H-250,240,112,'Release label','Because Part 22 was historically reused, this unambiguous release is 24.0.0 / Release A1.',white)
c.setFillColor(INK);c.setFont('Helvetica-Bold',18);c.drawString(36,H-300,'Baseline capabilities retained')
bullet_list(['Multi-route sovereign frontend and Node.js backend','RBAC/ABAC, session CSRF, idempotency and recursive audit','Provider runtime, data quality, instrument master, time series and streams','Discovery, asset intelligence, watchlists, alerts, screeners, portfolios and research','Six operating personas and the locked burgundy gradient'],40,H-330,W-80,10)
c.setFillColor(BAD);c.setFont('Helvetica-Bold',11);c.drawString(40,55,'Truth boundary: live trading, custody, transfers, withdrawals, private keys and recovery phrases remain disabled.')
end(page);page+=1

gradient_header('Release A1 architecture','Dependency-complete authentication and job-processing vertical slice')
# architecture boxes
xs=[40,222,404,586];titles=['Browser','API / Identity','Repository','Worker'];bodies=['Login, registration and account session\nHttpOnly cookie\nSession-derived CSRF','Schema validation\nTenant context\nAuthorization\nAudit events','PostgreSQL production target\nSQLite development adapter\nTransactions and revisions','Redis signaling in production\nPersistent database job truth\nRetries / dead-letter\nNotifications']
for x,t,b in zip(xs,titles,bodies):card(x,H-290,164,145,t,b,white)
for x in [204,386,568]:
    c.setStrokeColor(BURG4);c.setLineWidth(2);c.line(x,H-218,x+18,H-218);c.line(x+13,H-223,x+18,H-218);c.line(x+13,H-213,x+18,H-218)
c.setFillColor(INK);c.setFont('Helvetica-Bold',16);c.drawString(40,H-350,'Operational foundation')
bullet_list(['PostgreSQL migration and repository implementation','SQLite adapter blocked in production unless an explicit unsafe test override is set','Redis queue required in production; database queue restricted to development/test','Migration runner, seed runner, Docker Compose, health and readiness endpoints','Production fixture identity isolation'],44,H-380,W-88,10)
end(page);page+=1

screens=ROOT/'preview'/'release-a1-screenshots'
for title,subtitle,fn,notes in [
('Secure Login','Anonymous entry to the production identity foundation','auth-login-desktop.png',['Signed HttpOnly cookie','scrypt password verification','Generic invalid-credential errors','No fixture identity in production']),
('Create Organization','Transactional user, organization, workspace and membership creation','auth-register-desktop.png',['Validated registration payload','Tenant and workspace created together','Session issued after success','Audit event appended']),
('Production Session Center','Authenticated principal, session, jobs and notification evidence','account-session-desktop.png',['Cookie-authenticated context','Organization/workspace scope','Session rotation and logout','Job queue and worker status']),
('Guided Onboarding','Inherited onboarding now operates behind production cookie identity','onboarding-desktop.png',['User/workspace-scoped profile','Persona and market preferences','Existing workflow preserved','Production identity boot path'])]:
    gradient_header(title,subtitle)
    image_fit(screens/fn,32,56,W-300,H-190)
    c.setFillColor(white);c.setStrokeColor(LINE);c.roundRect(W-250,56,218,H-190,18,stroke=1,fill=1)
    c.setFillColor(BURG3);c.setFont('Helvetica-Bold',10);c.drawString(W-230,H-155,'IMPLEMENTED BEHAVIOR')
    bullet_list(notes,W-230,H-190,180,10)
    c.setFillColor(MUTED);c.setFont('Helvetica',8);c.drawString(W-230,75,'Actual Chromium render from Release A1.')
    end(page);page+=1

gradient_header('Responsive authentication','Desktop and mobile use the same governed identity flow')
image_fit(screens/'auth-login-mobile.png',44,68,215,H-210)
image_fit(screens/'auth-register-mobile.png',312,68,215,H-210)
image_fit(screens/'account-session-mobile.png',580,68,215,H-210)
c.setFillColor(INK);c.setFont('Helvetica-Bold',11);c.drawCentredString(151,H-155,'Secure Login');c.drawCentredString(419,H-155,'Registration');c.drawCentredString(687,H-155,'Session Center')
end(page);page+=1

gradient_header('Authentication and tenant security','Controls implemented in the vertical slice')
left=['scrypt password hashing with unique salt','Raw session token never persisted','Signed HttpOnly SameSite cookie','Secure cookie in production mode','Session-derived CSRF','Session rotation revokes prior session','Logout revokes database record','Database membership creates tenant context']
right=['Fixture headers rejected in production','Request schemas reject unknown fields','Generic invalid credential response','Authentication and job audit events','Production mode requires PostgreSQL and Redis','No browser secrets embedded','No live execution or custody endpoints','Financial actions remain deny-by-default']
card(40,72,360,H-220,'Identity and session controls','',white);bullet_list(left,62,H-190,310,10)
card(438,72,360,H-220,'Authorization and safety controls','',white);bullet_list(right,460,H-190,310,10)
end(page);page+=1

gradient_header('Persistent jobs and notifications','Replay-safe background-work foundation')
card(40,H-260,220,120,'1. Enqueue','Authenticated job:write request validates payload and optional idempotency key.',white)
card(310,H-260,220,120,'2. Reserve','Worker reserves a queued job with lock metadata and attempt count.',white)
card(580,H-260,220,120,'3. Complete or retry','Successful notification is stored once; failures retry or become dead letters.',white)
for x in [260,530]:
    c.setStrokeColor(BURG4);c.setLineWidth(2);c.line(x,H-200,x+50,H-200);c.line(x+42,H-206,x+50,H-200);c.line(x+42,H-194,x+50,H-200)
c.setFillColor(INK);c.setFont('Helvetica-Bold',16);c.drawString(40,H-320,'Production boundary')
paragraph('The database remains the source of truth for job state. Redis is used to signal pending work in production. The local test environment uses the database queue and validates idempotence, retries and notification deduplication.',40,H-350,W-80,11,INK,leading=16)
end(page);page+=1

gradient_header('Validation evidence','Actual finished-source results - not projected counts')
metrics=[('207 / 207','Automated tests'),('222 / 222','Smoke requests'),('8 / 8','Browser renders'),('16 / 16','Accessibility checks'),('0','Browser console errors'),('50','Frontend routes'),('144','API contracts'),('49','JSON schemas')]
for i,(v,l) in enumerate(metrics):
    x=40+(i%4)*195;y=H-260-(i//4)*150
    c.setFillColor(white);c.setStrokeColor(LINE);c.roundRect(x,y,172,116,18,stroke=1,fill=1)
    c.setFillColor(BURG3);c.setFont('Helvetica-Bold',24);c.drawString(x+18,y+60,v)
    c.setFillColor(MUTED);c.setFont('Helvetica-Bold',9);c.drawString(x+18,y+30,l.upper())
paragraph('Accessibility checks are automated semantic, keyboard-entry and responsive regressions. They are not an independent WCAG certification. PostgreSQL and Redis integrations remain deployment-dependent because those services were not available in this workspace.',40,70,W-80,9,MUTED,leading=13)
end(page);page+=1

gradient_header('Completed, partial and deferred','Truthful implementation matrix')
card(35,72,245,H-220,'Implemented locally','Registration/login/logout/rotation\nCookie sessions and CSRF\nTenant context\nSQLite transactions\nDatabase jobs and worker\nIn-app notifications\nAuth frontend\nHealth/readiness\nTests and documentation',white)
card(298,72,245,H-220,'Partial contracts','Live PostgreSQL integration\nDedicated app role and RLS verification\nLive Redis integration\nJSON domain-store migration\nPasskeys/MFA/recovery\nSecrets vault/KMS\nObject storage\nProduction load testing',white)
card(561,72,245,H-220,'Disabled or blocked','Live trading and custody\nTransfers and withdrawals\nPrivate keys and recovery phrases\nLicensed feeds\nExternal email/push/webhooks\nCloud deployment\nGitHub push without connector',white)
end(page);page+=1

gradient_header('Next dependency-ordered continuation','Release A2 - complete the production platform foundation')
bullet_list(['Run the PostgreSQL migration and repository integration suite against a real PostgreSQL service.','Run Redis queue, worker restart and multi-instance concurrency tests.','Introduce dedicated least-privilege database roles and validate row-level security.','Migrate the next high-value local JSON domains through adapters and reconciliation.','Add passkey/MFA/recovery architecture and secure invitation/role administration.','Add secure object-storage import pipeline and external notification adapters.','Execute load, stress, soak, backup/restore and rollback tests.'],50,H-170,W-100,12,gap=8)
c.setFillColor(BURG3);c.roundRect(50,56,W-100,66,18,stroke=0,fill=1);c.setFillColor(white);c.setFont('Helvetica-Bold',14);c.drawCentredString(W/2,84,'Preserve the Qelly identity and existing workflows while replacing local foundations incrementally.')
end(page);page+=1

c.save();print(OUT)
