from pathlib import Path
import json
import os
import shutil
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'scripts'/'release-a5-screen-batch-v2.py'
GENERATED=ROOT/'scripts'/'.release-v53-production-shell-generated.py'
OUT=ROOT/'preview'/'v53-production-shell-evidence'
TARGET_ROUTES=['live-markets','research-workspace','decision-provenance','theme-lab','search']
EXPECTED_SHELL_HEIGHT={'desktop':94,'mobile':98}
HEIGHT_TOLERANCE=2


def route_definitions():
    raw=subprocess.check_output([
        'node','--input-type=module','-e',
        "import {routeDefinitions} from './dist/frontend/assets/route-registry.mjs'; console.log(JSON.stringify(routeDefinitions));"
    ],cwd=ROOT,text=True)
    return json.loads(raw)


def generated_runner():
    source=SOURCE.read_text(encoding='utf-8')
    old_out="OUT = ROOT / 'preview' / 'release-a5-all-screens'"
    new_out="OUT = ROOT / 'preview' / 'v53-production-shell-evidence'"
    if old_out not in source:
        raise SystemExit('production shell evidence source anchor missing: output')
    source=source.replace(old_out,new_out,1)

    init_anchor="                page_height = None\n                status = 'passed'"
    init_replacement="                page_height = None\n                shell_probe = None\n                status = 'passed'"
    if init_anchor not in source:
        raise SystemExit('production shell evidence source anchor missing: probe init')
    source=source.replace(init_anchor,init_replacement,1)

    probe_anchor="                    if not heading or heading.strip() in RENDER_FAILURE_HEADINGS:"
    probe_code="""                    shell_probe = page.evaluate(\"\"\"() => {
                      const sample=(selector)=>{
                        const node=document.querySelector(selector);
                        if(!node)return null;
                        const box=node.getBoundingClientRect();
                        const style=getComputedStyle(node);
                        return {
                          selector,
                          width:Math.round(box.width),
                          height:Math.round(box.height),
                          display:style.display,
                          visibility:style.visibility,
                          position:style.position,
                          gridTemplateRows:style.gridTemplateRows,
                          gridTemplateColumns:style.gridTemplateColumns,
                          visible:box.width>0&&box.height>0&&style.display!=='none'&&style.visibility!=='hidden'
                        };
                      };
                      return {
                        productSurface:document.documentElement.dataset.productSurface||null,
                        uiLockV53:document.documentElement.dataset.uiLockV53||null,
                        activeShell:document.documentElement.dataset.v53ActiveShell||null,
                        productHeader:sample('.q-product-header'),
                        search:sample('.q-product-search'),
                        navigation:sample('.q-product-nav'),
                        account:sample('.q-product-account'),
                        legacyCommand:sample('.q-command-bar')
                      };
                    }\"\"\")
                    if not heading or heading.strip() in RENDER_FAILURE_HEADINGS:"""
    if probe_anchor not in source:
        raise SystemExit('production shell evidence source anchor missing: probe')
    source=source.replace(probe_anchor,probe_code,1)

    result_anchor="                    'pageHeightPx': page_height,\n                    'heading': heading,"
    result_replacement="                    'pageHeightPx': page_height,\n                    'shellProbe': shell_probe,\n                    'heading': heading,"
    if result_anchor not in source:
        raise SystemExit('production shell evidence source anchor missing: result')
    source=source.replace(result_anchor,result_replacement,1)
    GENERATED.write_text(source,encoding='utf-8')


def main():
    build_info=ROOT/'dist/frontend/BUILD_INFO.json'
    if not build_info.is_file():
        raise SystemExit('built frontend missing; run the Prompt2C production-mode build first')
    info=json.loads(build_info.read_text(encoding='utf-8'))
    if info.get('staticVisualPreview') is not False or info.get('prompt2cPublicBeta') is not True:
        raise SystemExit('production shell evidence requires staticVisualPreview=false and prompt2cPublicBeta=true')

    definitions=route_definitions()
    index={item['route']:position for position,item in enumerate(definitions)}
    missing=[route for route in TARGET_ROUTES if route not in index]
    if missing:
        raise SystemExit(f'production shell routes missing from canonical registry: {missing}')
    if OUT.exists(): shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    generated_runner()
    try:
        for route in TARGET_ROUTES:
            position=index[route]
            subprocess.run([sys.executable,str(GENERATED),str(position),str(position+1)],cwd=ROOT,check=True)
    finally:
        GENERATED.unlink(missing_ok=True)

    results=[]
    for part in sorted(OUT.glob('batch-*.json')):
        results.extend(json.loads(part.read_text(encoding='utf-8'))['results'])
    failures=[]
    for item in results:
        probe=item.get('shellProbe') or {}
        header=probe.get('productHeader') or {}
        expected=EXPECTED_SHELL_HEIGHT.get(item.get('viewport'))
        required=[probe.get('search'),probe.get('navigation'),probe.get('account')]
        ok=(
            item.get('status')=='passed'
            and probe.get('productSurface')=='production'
            and probe.get('uiLockV53')=='active'
            and probe.get('activeShell')=='wave1'
            and header.get('visible') is True
            and expected is not None
            and abs((header.get('height') or 0)-expected)<=HEIGHT_TOLERANCE
            and all((entry or {}).get('visible') is True for entry in required)
        )
        if not ok: failures.append(item)
    expected_count=len(TARGET_ROUTES)*2
    manifest={
        'schemaVersion':1,
        'evidenceHead':os.getenv('QELLY_V53_EVIDENCE_SHA','local'),
        'boundary':'governed local production-mode frontend; Prompt2C product shell; providers remain local/fail-closed',
        'canonicalRouteCount':len(definitions),
        'routes':TARGET_ROUTES,
        'renderCount':len(results),
        'expectedRenderCount':expected_count,
        'failureCount':len(failures),
        'expectedShellHeightPx':EXPECTED_SHELL_HEIGHT,
        'shellHeightTolerancePx':HEIGHT_TOLERANCE,
        'status':'passed' if len(results)==expected_count and not failures else 'failed',
        'renders':results
    }
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({key:manifest[key] for key in ('canonicalRouteCount','renderCount','expectedRenderCount','failureCount','status')},indent=2))
    if manifest['status']!='passed': raise SystemExit(1)


if __name__=='__main__': main()
