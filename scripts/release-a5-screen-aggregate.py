import json, pathlib, time, subprocess
from PIL import Image, ImageDraw

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'preview'/'release-a5-all-screens'
parts=sorted(OUT.glob('batch-*.json'))
results=[]
for part in parts: results.extend(json.loads(part.read_text())['results'])
by={(item['route'],item['viewport']):item for item in results}
route_json=subprocess.check_output(['node','--input-type=module','-e',"import {routeDefinitions} from './apps/web/public/assets/route-registry.mjs'; console.log(JSON.stringify(routeDefinitions));"],cwd=ROOT,text=True)
defs=json.loads(route_json)
missing=[(definition['route'],viewport) for definition in defs for viewport in ('desktop','mobile') if (definition['route'],viewport) not in by or not (ROOT/by[(definition['route'],viewport)]['file']).exists()]
ordered=[by[(definition['route'],viewport)] for viewport in ('desktop','mobile') for definition in defs if (definition['route'],viewport) in by]

def contact_sheet(viewport):
    items=[by[(definition['route'],viewport)] for definition in defs if (definition['route'],viewport) in by]
    cards=[]
    for item in items:
        image=Image.open(ROOT/item['file']).convert('RGB')
        image.thumbnail((360,240))
        card=Image.new('RGB',(390,292),'white')
        card.paste(image,((390-image.width)//2,36+(240-image.height)//2))
        draw=ImageDraw.Draw(card)
        draw.text((12,10),f"{item['route']} — {item['heading'] or item['label']}",fill='#170B10')
        draw.text((12,273),f"{item['dimensions']['width']}px · full page {item.get('pageHeightPx') or '?'}px",fill='#5E4A52')
        cards.append(card)
    columns=3
    rows=(len(cards)+columns-1)//columns
    sheet=Image.new('RGB',(columns*390,max(rows,1)*292),'white')
    for index,card in enumerate(cards): sheet.paste(card,((index%columns)*390,(index//columns)*292))
    path=OUT/f'contact-sheet-{viewport}.jpg'
    sheet.save(path,quality=90,optimize=True)
    return str(path.relative_to(ROOT))

failures=[item for item in ordered if item['status']!='passed']
log={
    'schemaVersion':2,
    'generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
    'evidenceBoundary':'governed local test runtime; authenticated routes use an isolated test identity and no production user data',
    'routeCount':len(defs),
    'viewportCount':2,
    'renderCount':len(ordered),
    'expectedRenderCount':len(defs)*2,
    'passed':len(ordered)-len(failures),
    'failed':len(failures),
    'missing':[{'route':route,'viewport':viewport} for route,viewport in missing],
    'consoleErrorCount':sum(len(item['consoleErrors']) for item in ordered),
    'contactSheets':{'desktop':contact_sheet('desktop'),'mobile':contact_sheet('mobile')},
    'renders':ordered,
    'status':'passed' if not failures and not missing and len(ordered)==len(defs)*2 else 'failed'
}
(OUT/'manifest.json').write_text(json.dumps(log,indent=2)+'\n')
(ROOT/'preview'/'RELEASE_A5_ALL_SCREENS_LOG.json').write_text(json.dumps(log,indent=2)+'\n')
print(json.dumps({key:log[key] for key in ('routeCount','renderCount','expectedRenderCount','passed','failed','consoleErrorCount','status')},indent=2))
print('missing',missing)
if log['status']!='passed': raise SystemExit(1)
