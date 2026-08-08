from pathlib import Path
import json
import os
import re
import shutil
import subprocess
import sys
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'scripts'/'release-a5-screen-batch-v2.py'
GENERATED=ROOT/'scripts'/'.release-v53-responsive-generated.py'
OUT=ROOT/'preview'/'v53-responsive-evidence'

REPRESENTATIVE_ROUTES=[
    'market','advanced-chart','discovery-hub','research-workspace','portfolio-analytics',
    'screener-lab','theme-lab','theme-personas','identity-access','import-center',
    'data-mesh','observability','decision-provenance','formula-library','trust-center'
]
VIEWPORTS=[
    ('phone-360',360,800),('phone-390',390,844),('phone-430',430,932),
    ('tablet-768',768,1024),('tablet-1024',1024,768),
    ('desktop-1280',1280,800),('desktop-1440',1440,1000),
    ('desktop-1728',1728,1080),('desktop-1920',1920,1080),
]


def route_definitions():
    raw=subprocess.check_output([
        'node','--input-type=module','-e',
        "import {routeDefinitions} from './dist/frontend/assets/route-registry.mjs'; console.log(JSON.stringify(routeDefinitions));"
    ],cwd=ROOT,text=True)
    return json.loads(raw)


def generated_runner():
    source=SOURCE.read_text(encoding='utf-8')
    old_out="OUT = ROOT / 'preview' / 'release-a5-all-screens'"
    new_out="OUT = ROOT / 'preview' / 'v53-responsive-evidence'"
    if old_out not in source:
        raise SystemExit('responsive evidence source anchor missing: output directory')
    source=source.replace(old_out,new_out,1)
    pattern=re.compile(
        r"    viewports = \[\n"
        r"        \('desktop', \{'width': 1440, 'height': 1000\}\),\n"
        r"        \('mobile', \{'width': 390, 'height': 844\}\),\n"
        r"    \]"
    )
    replacement='    viewports = [\n'+''.join(
        f"        ('{name}', {{'width': {width}, 'height': {height}}}),\n"
        for name,width,height in VIEWPORTS
    )+'    ]'
    source,count=pattern.subn(replacement,source,count=1)
    if count!=1:
        raise SystemExit('responsive evidence source anchor missing: viewport list')
    GENERATED.write_text(source,encoding='utf-8')


def contact_sheet(viewport,items):
    cards=[]
    for item in items:
        image=Image.open(ROOT/item['file']).convert('RGB')
        image.thumbnail((330,220))
        card=Image.new('RGB',(360,270),'white')
        card.paste(image,((360-image.width)//2,34+(220-image.height)//2))
        draw=ImageDraw.Draw(card)
        draw.text((10,9),f"{item['route']} — {viewport}",fill='#170B10')
        draw.text((10,250),f"{item['dimensions']['width']}×{item['dimensions']['height']} · page {item.get('pageHeightPx') or '?'}px",fill='#5E4A52')
        cards.append(card)
    columns=3
    rows=(len(cards)+columns-1)//columns
    sheet=Image.new('RGB',(columns*360,max(rows,1)*270),'white')
    for index,card in enumerate(cards):
        sheet.paste(card,((index%columns)*360,(index//columns)*270))
    path=OUT/f'contact-sheet-{viewport}.jpg'
    sheet.save(path,quality=90,optimize=True)
    return str(path.relative_to(ROOT))


def main():
    if not (ROOT/'dist/frontend/index.html').is_file():
        raise SystemExit('built frontend missing; run npm run build:frontend first')
    definitions=route_definitions()
    index={item['route']:position for position,item in enumerate(definitions)}
    missing=[route for route in REPRESENTATIVE_ROUTES if route not in index]
    if missing:
        raise SystemExit(f'representative routes missing from canonical registry: {missing}')
    if OUT.exists(): shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    generated_runner()
    try:
        for route in REPRESENTATIVE_ROUTES:
            position=index[route]
            subprocess.run([sys.executable,str(GENERATED),str(position),str(position+1)],cwd=ROOT,check=True)
    finally:
        GENERATED.unlink(missing_ok=True)

    parts=sorted(OUT.glob('batch-*.json'))
    results=[]
    for part in parts:
        results.extend(json.loads(part.read_text(encoding='utf-8'))['results'])
    by={(item['route'],item['viewport']):item for item in results}
    expected=[(route,name) for route in REPRESENTATIVE_ROUTES for name,_,_ in VIEWPORTS]
    missing_pairs=[{'route':route,'viewport':viewport} for route,viewport in expected if (route,viewport) not in by]
    failures=[]
    for route,viewport in expected:
        item=by.get((route,viewport))
        if not item: continue
        if item.get('status')!='passed' or (item.get('overflowPx') or 0)>2 or not (ROOT/item['file']).is_file():
            failures.append(item)
    sheets={}
    for viewport,_,_ in VIEWPORTS:
        items=[by[(route,viewport)] for route in REPRESENTATIVE_ROUTES if (route,viewport) in by]
        sheets[viewport]=contact_sheet(viewport,items)
    manifest={
        'schemaVersion':1,
        'evidenceHead':os.getenv('QELLY_V53_EVIDENCE_SHA','local'),
        'boundary':'governed local test runtime; exact compiled frontend; no production user data',
        'canonicalRouteCount':len(definitions),
        'representativeRouteCount':len(REPRESENTATIVE_ROUTES),
        'viewportCount':len(VIEWPORTS),
        'renderCount':len(results),
        'expectedRenderCount':len(expected),
        'routes':REPRESENTATIVE_ROUTES,
        'viewports':[{'name':name,'width':width,'height':height} for name,width,height in VIEWPORTS],
        'missing':missing_pairs,
        'failureCount':len(failures),
        'contactSheets':sheets,
        'status':'passed' if len(results)==len(expected) and not missing_pairs and not failures else 'failed',
        'renders':[by[pair] for pair in expected if pair in by]
    }
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({key:manifest[key] for key in ('canonicalRouteCount','representativeRouteCount','viewportCount','renderCount','expectedRenderCount','failureCount','status')},indent=2))
    if manifest['status']!='passed':
        raise SystemExit(1)


if __name__=='__main__': main()
