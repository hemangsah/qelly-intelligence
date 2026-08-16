from pathlib import Path
import runpy
import tempfile

source_path = Path(__file__).with_name('release-a5-accessibility-check.py')
source = source_path.read_text()
legacy_import = "import { startServer } from './src/server/server.mjs';"
evidence_import = "import { startServer } from './scripts/release-a5-evidence-server.mjs';"
external_marker = "                    if parsed.netloc=='unpkg.com': route_obj.fulfill(status=200,headers={'Content-Type':'application/javascript'},body='window.LightweightCharts=window.LightweightCharts||undefined;'); return\n"
tradingview_hook = """                    if parsed.netloc=='s3.tradingview.com':
                        route_obj.fulfill(
                            status=200,
                            headers={
                                'Content-Type':'application/javascript; charset=utf-8',
                                'Cache-Control':'no-store',
                            },
                            body='/* Accessibility evidence runtime: external TradingView display script intentionally isolated. */',
                        )
                        return
"""

if legacy_import not in source:
    raise SystemExit('accessibility evidence launcher import changed; update the contract adapter hook')
if external_marker not in source:
    raise SystemExit('accessibility evidence external-resource hook changed; update TradingView isolation')

patched_source = source.replace(legacy_import, evidence_import, 1)
patched_source = patched_source.replace(external_marker, tradingview_hook + external_marker, 1)

with tempfile.NamedTemporaryFile(
    mode='w',
    suffix='.py',
    prefix='.release-a5-accessibility-evidence-',
    dir=source_path.parent,
    delete=False,
) as patched:
    patched.write(patched_source)
    patched_path = Path(patched.name)

try:
    runpy.run_path(str(patched_path), run_name='__main__')
finally:
    patched_path.unlink(missing_ok=True)
