import json, pathlib, time
from PIL import Image, ImageDraw
ROOT=pathlib.Path(__file__).resolve().parents[1]; OUT=ROOT/'preview'/'release-a5-all-screens'
parts=sorted(OUT.glob('batch-*.json')); results=[]
for p in parts: results.extend(json.loads(p.read_text())['results'])
by={(x['route'],x['viewport']):x for x in results}
route_json=__import__('subprocess').check_output(['node','--input-type=module','-e',"import {routeDefinitions} from './apps/web/public/assets/route-registry.mjs'; console.log(JSON.stringify(routeDefinitions));"],cwd=ROOT,text=True)
defs=json.loads(route_json)
missing=[(d['route'],v) for d in defs for v in ('desktop','mobile') if (d['route'],v) not in by or not (ROOT/by[(d['route'],v)]['file']).exists()]
ordered=[by[(d['route'],v)] for v in ('desktop','mobile') for d in defs if (d['route'],v) in by]
desktop=[by[(d['route'],'desktop')] for d in defs if (d['route'],'desktop') in by]
cards=[]
for item in desktop:
    img=Image.open(ROOT/item['file']).convert('RGB');img.thumbnail((360,240))
    card=Image.new('RGB',(390,290),'white');card.paste(img,((390-img.width)//2,35+(240-img.height)//2));draw=ImageDraw.Draw(card);draw.text((12,10),f"{item['route']} - {item['heading'] or item['label']}",fill='#170B10');cards.append(card)
cols=3;rows=(len(cards)+cols-1)//cols;sheet=Image.new('RGB',(cols*390,rows*290),'white')
for i,card in enumerate(cards):sheet.paste(card,((i%cols)*390,(i//cols)*290))
sheet_path=ROOT/'preview'/'QELLY_RELEASE_A5_ALL_SCREENS_CONTACT_SHEET.jpg';sheet.save(sheet_path,quality=90)
failures=[x for x in ordered if x['status']!='passed']
log={'release':'27.0.0','generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'routeCount':len(defs),'viewportCount':2,'renderCount':len(ordered),'passed':len(ordered)-len(failures),'failed':len(failures),'missing':missing,'consoleErrorCount':sum(len(x['consoleErrors']) for x in ordered),'contactSheet':str(sheet_path.relative_to(ROOT)),'renders':ordered,'status':'passed' if not failures and not missing else 'failed'}
(ROOT/'preview'/'RELEASE_A5_ALL_SCREENS_LOG.json').write_text(json.dumps(log,indent=2)+'\n')
print(json.dumps({k:log[k] for k in ('routeCount','renderCount','passed','failed','consoleErrorCount','status')},indent=2));print('missing',missing)
if log['status']!='passed':raise SystemExit(1)
