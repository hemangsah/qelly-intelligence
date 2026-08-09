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
OUT=ROOT/'preview'/'v53-verify-subview-evidence'
VIEWPORTS=[
    ('phone-360',360,800),('phone-390',390,844),('phone-430',430,932),
    ('tablet-768',768,1024),('tablet-1024',1024,768),
    ('desktop-1280',1280,800),('desktop-1440',1440,1000),
    ('desktop-1728',1728,1080),('desktop-1920',1920,1080),
]
SCENARIOS=[
    {
        'id':'qelly-verify',
        'inputHash':'#/qelly-verify',
        'canonicalHash':'#/market?view=qelly-verify',
        'title':'Qelly Verify · Strategy Evidence Report',
        'selector':'[data-qelly-verify-surface]',
        'owner':'true',
        'requiredText':['Local-only prototype evidence workflow','Data transfer','Execution','Disabled'],
    },
    {
        'id':'evidence-methodology',
        'inputHash':'#/evidence-methodology',
        'canonicalHash':'#/market?view=evidence-methodology',
        'title':'Qelly Evidence Methodology',
        'selector':'[data-qelly-methodology-surface]',
        'owner':'methodology',
        'requiredText':['Evidence · Public methodology','Personalized advice','Execution','Disabled'],
    },
]


def route_definitions():
    raw=subprocess.check_output([
        'node','--input-type=module','-e',
        "import {routeDefinitions} from './dist/frontend/assets/route-registry.mjs'; console.log(JSON.stringify(routeDefinitions));"
    ],cwd=ROOT,text=True)
    return json.loads(raw)


def replace_once(source,old,new,label):
    if old not in source:
        raise SystemExit(f'verify subview evidence source anchor missing: {label}')
    return source.replace(old,new,1)


def generated_runner(scenario):
    source=SOURCE.read_text(encoding='utf-8')
    scenario_id=scenario['id']
    generated=ROOT/'scripts'/f'.release-v53-{scenario_id}-generated.py'
    source=replace_once(
        source,
        "OUT = ROOT / 'preview' / 'release-a5-all-screens'",
        f"OUT = ROOT / 'preview' / 'v53-verify-subview-evidence' / '{scenario_id}'",
        'output directory'
    )
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
        raise SystemExit('verify subview evidence source anchor missing: viewport list')

    source=replace_once(
        source,
        "                page_height = None\n                status = 'passed'",
        "                page_height = None\n                subview_probe = None\n                status = 'passed'",
        'probe init'
    )
    source=replace_once(
        source,
        "                screenshot = OUT / f'{route_name}__{viewport_name}.png'",
        f"                screenshot = OUT / f'{scenario_id}__{{viewport_name}}.png'",
        'screenshot name'
    )
    source=replace_once(
        source,
        '                expected_title = f"{definition[\'label\']} · Qelly Intelligence"',
        f"                expected_title = {scenario['title']!r}",
        'expected title'
    )
    source=replace_once(
        source,
        "                expected_hash = f'#/{route_name}'",
        f"                expected_hash = {scenario['canonicalHash']!r}",
        'expected hash'
    )
    source=replace_once(
        source,
        "                        f'{EXPECTED_ORIGIN}/#/{route_name}',",
        f"                        f'{{EXPECTED_ORIGIN}}{scenario['inputHash']}',",
        'navigation hash'
    )
    source=replace_once(
        source,
        "                    resolved_hash = page.evaluate('location.hash.split(\"?\")[0]')",
        "                    resolved_hash = page.evaluate('location.hash')",
        'resolved hash'
    )

    selector=scenario['selector']
    owner=scenario['owner']
    required=json.dumps(scenario['requiredText'])
    probe_anchor="                    if not heading or heading.strip() in RENDER_FAILURE_HEADINGS:"
    probe_code=f'''                    subview_probe = page.evaluate("""() => {{
                      const bounds=(node)=>{{
                        if(!node)return null;
                        const box=node.getBoundingClientRect();
                        const style=getComputedStyle(node);
                        return {{
                          left:Math.round(box.left),right:Math.round(box.right),
                          top:Math.round(box.top),bottom:Math.round(box.bottom),
                          width:Math.round(box.width),height:Math.round(box.height),
                          viewportWidth:Math.round(innerWidth),
                          visible:box.width>0&&box.height>0&&style.display!=='none'&&style.visibility!=='hidden'
                        }};
                      }};
                      const main=document.getElementById('main');
                      const shelf=document.querySelector('#context-shelf .q-category-shelf');
                      const shelfVerify=document.querySelector('#context-shelf [data-qelly-verify-link]');
                      const shelfMethodology=document.querySelector('#context-shelf [data-qelly-methodology-link]');
                      return {{
                        owner:main?.dataset.qellyVerifyOwner??null,
                        surface:Boolean(document.querySelector({selector!r})),
                        mainText:main?.innerText??'',
                        primaryVerify:Boolean(document.querySelector('#primary-nav [data-qelly-verify-link]')),
                        primaryMethodology:Boolean(document.querySelector('#primary-nav [data-qelly-methodology-link]')),
                        shelfVerify:Boolean(shelfVerify),
                        shelfMethodology:Boolean(shelfMethodology),
                        shelfBounds:bounds(shelf),
                        shelfVerifyBounds:bounds(shelfVerify),
                        shelfMethodologyBounds:bounds(shelfMethodology),
                        hero:bounds(document.querySelector('.q-verify-hero')),
                        heroCopy:bounds(document.querySelector('.q-verify-hero__copy')),
                        boundary:bounds(document.querySelector('.q-verify-boundary'))
                      }};
                    }}""")
                    if not subview_probe.get('surface'):
                        errors.append({{'type':'subview-contract','text':'Expected governed subview surface was not rendered'}})
                    if subview_probe.get('owner') != {owner!r}:
                        errors.append({{'type':'subview-contract','text':f"Expected Qelly Verify owner {owner!r}, received {{subview_probe.get('owner')!r}}"}})
                    for required_text in {required}:
                        if required_text not in (subview_probe.get('mainText') or ''):
                            errors.append({{'type':'subview-boundary','text':f"Required boundary text missing: {{required_text}}"}})
                    for key in ('primaryVerify','primaryMethodology','shelfVerify','shelfMethodology'):
                        if not subview_probe.get(key):
                            errors.append({{'type':'subview-discoverability','text':f"Missing governed shell discoverability marker: {{key}}"}})
                    shelf_bounds=subview_probe.get('shelfBounds')
                    for key in ('shelfVerifyBounds','shelfMethodologyBounds'):
                        control_bounds=subview_probe.get(key)
                        if not control_bounds or not control_bounds.get('visible'):
                            errors.append({{'type':'subview-discoverability','text':f"Governed shelf control is not visible: {{key}}"}})
                        elif shelf_bounds and shelf_bounds.get('visible') and (control_bounds.get('left',0)<shelf_bounds.get('left',0)-2 or control_bounds.get('right',0)>shelf_bounds.get('right',0)+2):
                            errors.append({{'type':'subview-discoverability','text':f"Governed shelf control is outside the visible shelf viewport: {{key}} {{control_bounds}} shelf={{shelf_bounds}}"}})
                    for key in ('heroCopy','boundary'):
                        bounds=subview_probe.get(key)
                        if bounds and bounds.get('visible') and (bounds.get('left',0)<-2 or bounds.get('right',0)>bounds.get('viewportWidth',0)+2):
                            errors.append({{'type':'subview-horizontal-bounds','text':f"{{key}} crossed viewport boundary: {{bounds}}"}})
                    if not heading or heading.strip() in RENDER_FAILURE_HEADINGS:'''
    source=replace_once(source,probe_anchor,probe_code,'subview contract probe')
    source=replace_once(
        source,
        "                    'route': route_name,",
        f"                    'route': {scenario_id!r},\n                    'canonicalRoute': route_name,",
        'result route identity'
    )
    source=replace_once(
        source,
        "                    'heading': heading,",
        "                    'heading': heading,\n                    'subviewProbe': subview_probe,",
        'result subview probe'
    )
    generated.write_text(source,encoding='utf-8')
    return generated


def contact_sheet(viewport,items):
    cards=[]
    for item in items:
        image=Image.open(ROOT/item['file']).convert('RGB')
        image.thumbnail((520,330))
        card=Image.new('RGB',(560,390),'white')
        card.paste(image,((560-image.width)//2,36+(330-image.height)//2))
        draw=ImageDraw.Draw(card)
        draw.text((12,10),f"{item['route']} — {viewport}",fill='#170B10')
        draw.text((12,370),f"{item['dimensions']['width']}×{item['dimensions']['height']} · {item['resolvedHash']}",fill='#5E4A52')
        cards.append(card)
    sheet=Image.new('RGB',(1120,390),'white')
    for index,card in enumerate(cards):
        sheet.paste(card,(index*560,0))
    path=OUT/f'contact-sheet-{viewport}.jpg'
    sheet.save(path,quality=90,optimize=True)
    return str(path.relative_to(ROOT))


def main():
    if not (ROOT/'dist/frontend/index.html').is_file():
        raise SystemExit('built frontend missing; run npm run build:frontend first')
    definitions=route_definitions()
    if len(definitions)!=70:
        raise SystemExit(f'canonical route count changed unexpectedly: {len(definitions)}')
    index={item['route']:position for position,item in enumerate(definitions)}
    if 'market' not in index:
        raise SystemExit('canonical Market route missing')
    forbidden={scenario['id'] for scenario in SCENARIOS}
    canonical={item['route'] for item in definitions}
    if canonical & forbidden:
        raise SystemExit(f'Qelly Verify subviews must not become canonical routes: {sorted(canonical & forbidden)}')

    if OUT.exists(): shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    results=[]
    market_index=index['market']
    for scenario in SCENARIOS:
        scenario_out=OUT/scenario['id']
        scenario_out.mkdir(parents=True,exist_ok=True)
        generated=generated_runner(scenario)
        try:
            subprocess.run([sys.executable,str(generated),str(market_index),str(market_index+1)],cwd=ROOT,check=True)
        finally:
            generated.unlink(missing_ok=True)
        parts=sorted(scenario_out.glob('batch-*.json'))
        if len(parts)!=1:
            raise SystemExit(f"expected one evidence batch for {scenario['id']}, found {len(parts)}")
        results.extend(json.loads(parts[0].read_text(encoding='utf-8'))['results'])

    by={(item['route'],item['viewport']):item for item in results}
    expected=[(scenario['id'],name) for scenario in SCENARIOS for name,_,_ in VIEWPORTS]
    missing=[{'subview':subview,'viewport':viewport} for subview,viewport in expected if (subview,viewport) not in by]
    failures=[]
    for pair in expected:
        item=by.get(pair)
        if not item: continue
        if item.get('status')!='passed' or (item.get('overflowPx') or 0)>2 or not (ROOT/item['file']).is_file():
            failures.append(item)

    sheets={}
    for viewport,_,_ in VIEWPORTS:
        items=[by[(scenario['id'],viewport)] for scenario in SCENARIOS if (scenario['id'],viewport) in by]
        sheets[viewport]=contact_sheet(viewport,items)
    alias_normalized=all(by[pair].get('resolvedHash')==next(item['canonicalHash'] for item in SCENARIOS if item['id']==pair[0]) for pair in expected if pair in by)
    passed=len(results)==len(expected) and not missing and not failures and alias_normalized
    manifest={
        'schemaVersion':1,
        'evidenceHead':os.getenv('QELLY_V53_VERIFY_EVIDENCE_SHA','local'),
        'boundary':'governed local browser evidence; no production user data; no execution',
        'canonicalRouteCount':len(definitions),
        'canonicalRoute':'market',
        'subviewCount':len(SCENARIOS),
        'viewportCount':len(VIEWPORTS),
        'renderCount':len(results),
        'expectedRenderCount':len(expected),
        'failureCount':len(failures),
        'missing':missing,
        'aliasNormalized':alias_normalized,
        'subviews':[{key:value for key,value in item.items() if key!='requiredText'} for item in SCENARIOS],
        'viewports':[{'name':name,'width':width,'height':height} for name,width,height in VIEWPORTS],
        'contactSheets':sheets,
        'status':'passed' if passed else 'failed',
        'renders':[by[pair] for pair in expected if pair in by]
    }
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({key:manifest[key] for key in ('canonicalRouteCount','canonicalRoute','subviewCount','viewportCount','renderCount','expectedRenderCount','failureCount','aliasNormalized','status')},indent=2))
    if manifest['status']!='passed':
        raise SystemExit(1)


if __name__=='__main__': main()
