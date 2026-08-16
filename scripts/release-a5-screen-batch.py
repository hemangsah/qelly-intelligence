from pathlib import Path
import runpy
import tempfile

source_path = Path(__file__).with_name('release-a5-screen-batch-v2.py')
source = source_path.read_text()
legacy_import = "import { startServer } from './src/server/server.mjs';"
evidence_import = "import { startServer } from './scripts/release-a5-evidence-server.mjs';"
external_marker = "                    if parsed.netloc == 'unpkg.com':\n"
tradingview_hook = """                    if parsed.netloc == 's3.tradingview.com':
                        route_object.fulfill(
                            status=200,
                            headers={
                                'Content-Type': 'application/javascript; charset=utf-8',
                                'Cache-Control': 'no-store',
                            },
                            body='/* Evidence runtime: external TradingView display script intentionally isolated. */',
                        )
                        return
"""
console_marker = """                    item = {'type': 'console', 'text': message.text}
                    if message.text.startswith('Failed to load resource:'):
"""
console_diagnostics = """                    location = message.location or {}
                    item = {
                        'type': 'console',
                        'text': message.text,
                        'location': {
                            'url': location.get('url'),
                            'lineNumber': location.get('lineNumber'),
                            'columnNumber': location.get('columnNumber'),
                        },
                    }
                    if message.text.startswith('Failed to load resource:'):
"""
context_marker = """                    reduced_motion='reduce',
                ),
"""
context_isolation = """                    reduced_motion='reduce',
                    service_workers='block',
                ),
"""

if legacy_import not in source:
    raise SystemExit('release evidence launcher import changed; update the contract adapter hook')
if external_marker not in source:
    raise SystemExit('release evidence external-resource hook changed; update TradingView isolation')
if console_marker not in source:
    raise SystemExit('release evidence console hook changed; update diagnostic adapter')
if source.count(context_marker) != 2:
    raise SystemExit('release evidence browser-context contract changed; update service-worker isolation')

patched_source = source.replace(legacy_import, evidence_import, 1)
patched_source = patched_source.replace(external_marker, tradingview_hook + external_marker, 1)
patched_source = patched_source.replace(console_marker, console_diagnostics, 1)
# Playwright page routing does not intercept Service Worker network requests.
# Blocking workers in this isolated screenshot runtime prevents prompt2c-sw.js
# from attempting to resolve the synthetic qelly.test host. Offline-shell
# behavior is validated separately by the public-runtime/browser workflows.
patched_source = patched_source.replace(context_marker, context_isolation, 2)

with tempfile.NamedTemporaryFile(
    mode='w',
    suffix='.py',
    prefix='.release-a5-screen-batch-evidence-',
    dir=source_path.parent,
    delete=False,
) as patched:
    patched.write(patched_source)
    patched_path = Path(patched.name)

try:
    runpy.run_path(str(patched_path), run_name='__main__')
finally:
    patched_path.unlink(missing_ok=True)
