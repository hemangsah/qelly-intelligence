import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / 'scripts' / 'release-a5-accessibility-check.py'
HEAD = os.environ.get('QELLY_REVIEW_HEAD') or os.environ.get('GITHUB_SHA') or subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
CHECKED_OUT = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
if CHECKED_OUT != HEAD:
    raise RuntimeError(f'STALE_HEAD:{CHECKED_OUT}:{HEAD}')
SHARD_INDEX = int(os.environ['QELLY_A11Y_SHARD_INDEX'])
if SHARD_INDEX < 0 or SHARD_INDEX > 8:
    raise RuntimeError(f'Invalid accessibility shard index: {SHARD_INDEX}')
SHARD_ID = os.environ.get('QELLY_A11Y_SHARD_ID', f'a11y-{SHARD_INDEX:02d}')
OUTPUT_ROOT = ROOT / os.environ.get('QELLY_A11Y_OUTPUT_ROOT', f'.prompt2b-fasttrack/a11y/{SHARD_ID}')
SCREENSHOT_DIR = OUTPUT_ROOT / 'screenshots'
OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
CANONICAL_OUTPUT = OUTPUT_ROOT / 'canonical-results.json'
SOURCE = SOURCE_PATH.read_text()
SOURCE_SHA256 = hashlib.sha256(SOURCE.encode()).hexdigest()
COMPILED_FONT = ROOT / 'dist/frontend/assets/fonts/ibm-plex-sans-variable.woff2'
if not COMPILED_FONT.is_file():
    raise RuntimeError('Compiled IBM Plex font missing before accessibility shard')
FONT_SHA256 = hashlib.sha256(COMPILED_FONT.read_bytes()).hexdigest()

route_marker = "if len(routes) != 27: raise RuntimeError(f'Expected 27 unique routes, received {len(routes)}')"
if SOURCE.count(route_marker) != 1:
    raise RuntimeError('Canonical accessibility route marker changed')
SOURCE = SOURCE.replace(
    route_marker,
    route_marker + "\n    routes = routes[SHARD_INDEX*3:(SHARD_INDEX+1)*3]\n    if len(routes) != 3: raise RuntimeError(f'Expected 3 routes in shard {SHARD_INDEX}, received {len(routes)}')",
)
if SOURCE.count('expected_checks=54') != 1:
    raise RuntimeError('Canonical accessibility denominator marker changed')
SOURCE = SOURCE.replace('expected_checks=54', 'expected_checks=len(routes)*len(viewports)')
output_marker = "(ROOT/'validation'/'RELEASE_A5_ACCESSIBILITY_REGRESSION.json').write_text(json.dumps(log,indent=2)+'\\n')"
if SOURCE.count(output_marker) != 1:
    raise RuntimeError('Canonical accessibility output marker changed')
SOURCE = SOURCE.replace(output_marker, "CANONICAL_OUTPUT.write_text(json.dumps(log,indent=2)+'\\n')")
append_marker = "results.append({'route':route_key,'path':route_path,'viewport':vname,'dimensions':viewport,'authenticated':auth,'checks':checks,'firstTabFocus':focus,'consoleErrors':errors,'criticalFailures':failures,'status':'passed' if not failures else 'failed'}); context.close()"
if SOURCE.count(append_marker) != 1:
    raise RuntimeError('Canonical accessibility result marker changed')
append_replacement = """screenshot_file=SCREENSHOT_DIR/f'{route_key}-{vname}.png'; page.screenshot(path=str(screenshot_file),full_page=False); screenshot_body=screenshot_file.read_bytes(); results.append({'route':route_key,'path':route_path,'viewport':vname,'dimensions':viewport,'authenticated':auth,'checks':checks,'firstTabFocus':focus,'consoleErrors':errors,'criticalFailures':failures,'status':'passed' if not failures else 'failed','screenshotPath':str(screenshot_file.relative_to(OUTPUT_ROOT)).replace('\\\\','/'),'screenshotSha256':hashlib.sha256(screenshot_body).hexdigest(),'origin':'https://qelly.test','compiledFontSha256':FONT_SHA256}); context.close()"""
SOURCE = SOURCE.replace(append_marker, append_replacement)
browser_marker = "browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])"
if SOURCE.count(browser_marker) != 1:
    raise RuntimeError('Canonical accessibility browser marker changed')
SOURCE = SOURCE.replace(browser_marker, "browser = p.chromium.launch(headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])")

SOURCE = SOURCE.replace(
    'import json, pathlib, subprocess, tempfile, time, shutil, urllib.request, urllib.error',
    'import json, pathlib, subprocess, tempfile, time, shutil, urllib.request, urllib.error, hashlib',
    1,
)

namespace = {
    '__name__': '__main__',
    '__file__': str(SOURCE_PATH),
    'SHARD_INDEX': SHARD_INDEX,
    'SCREENSHOT_DIR': SCREENSHOT_DIR,
    'OUTPUT_ROOT': OUTPUT_ROOT,
    'CANONICAL_OUTPUT': CANONICAL_OUTPUT,
    'FONT_SHA256': FONT_SHA256,
}
exit_code = 0
try:
    exec(compile(SOURCE, str(SOURCE_PATH), 'exec'), namespace)
except SystemExit as exc:
    exit_code = int(exc.code or 0)
except Exception as exc:
    exit_code = 1
    (OUTPUT_ROOT / 'WRAPPER_EXCEPTION.json').write_text(json.dumps({'type': type(exc).__name__, 'message': str(exc)}, indent=2) + '\n')

if CANONICAL_OUTPUT.is_file():
    canonical = json.loads(CANONICAL_OUTPUT.read_text())
    results = canonical.get('results', [])
else:
    results = []

payload = {
    'schemaVersion': 1,
    'repository': 'hemangsah/qelly-intelligence',
    'exactHead': HEAD,
    'checkedOut': CHECKED_OUT,
    'runIdentity': f"{os.environ.get('GITHUB_RUN_ID', 'local')}:{os.environ.get('GITHUB_RUN_ATTEMPT', '1')}",
    'shardId': SHARD_ID,
    'shardIndex': SHARD_INDEX,
    'canonicalSourcePath': 'scripts/release-a5-accessibility-check.py',
    'canonicalSourceSha256': SOURCE_SHA256,
    'compiledFontPath': 'dist/frontend/assets/fonts/ibm-plex-sans-variable.woff2',
    'compiledFontSha256': FONT_SHA256,
    'origin': 'https://qelly.test',
    'expectedRoutes': 3,
    'expectedChecks': 6,
    'routes': sorted({item.get('route') for item in results}),
    'checks': len(results),
    'passed': sum(item.get('status') == 'passed' for item in results),
    'failed': sum(item.get('status') != 'passed' for item in results),
    'results': results,
    'automatedAccessibilityTruthBoundary': 'Automated semantic, keyboard-entry, exact-font and responsive regression only; not an independent WCAG certification and not a complete manual assistive-technology audit.',
}
(OUTPUT_ROOT / 'A11Y_SHARD_RESULTS.json').write_text(json.dumps(payload, indent=2) + '\n')
(OUTPUT_ROOT / 'A11Y_SHARD_IDENTITY.json').write_text(json.dumps({key: payload[key] for key in ['schemaVersion','repository','exactHead','checkedOut','runIdentity','shardId','shardIndex','canonicalSourcePath','canonicalSourceSha256','compiledFontPath','compiledFontSha256','origin','expectedRoutes','expectedChecks']}, indent=2) + '\n')

checksum_lines = []
for file in sorted(OUTPUT_ROOT.rglob('*')):
    if file.is_file() and file.name != 'A11Y_SHARD_SHA256SUMS.txt':
        checksum_lines.append(f"{hashlib.sha256(file.read_bytes()).hexdigest()}  {file.relative_to(OUTPUT_ROOT).as_posix()}")
(OUTPUT_ROOT / 'A11Y_SHARD_SHA256SUMS.txt').write_text('\n'.join(checksum_lines) + '\n')
print(json.dumps({'shardId': SHARD_ID, 'checks': len(results), 'passed': payload['passed'], 'failed': payload['failed'], 'canonicalSourceSha256': SOURCE_SHA256, 'compiledFontSha256': FONT_SHA256}, indent=2))
if len(results) != 6 or payload['failed'] or exit_code:
    raise SystemExit(1)
