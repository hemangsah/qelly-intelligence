import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import time
import traceback
import urllib.error
import urllib.request
from http.cookies import SimpleCookie
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXACT_HEAD = os.environ.get('QELLY_REVIEW_HEAD') or os.environ.get('GITHUB_SHA') or 'unknown'
BRANCH = os.environ.get('QELLY_REVIEW_BRANCH', 'feature/calculator-and-indicator-foundation')
ROUTE_KEY = os.environ.get('QELLY_A11Y_ROUTE')
OUTPUT_ROOT = pathlib.Path(os.environ.get('QELLY_A11Y_OUTPUT', '.prompt2b-a11y-shard')).resolve()
from prompt2b_fasttrack_a11y_contract import ROUTES, VIEWPORTS, EXPECTED_CHECKS, launcher, EVALUATE, SAVED_SEED
if ROUTE_KEY not in ROUTES:
    raise RuntimeError(f'Unsupported QELLY_A11Y_ROUTE: {ROUTE_KEY}')
if len(EXACT_HEAD) != 40:
    raise RuntimeError(f'Invalid QELLY_REVIEW_HEAD: {EXACT_HEAD}')
local_head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
if local_head != EXACT_HEAD:
    raise RuntimeError(f'Exact-head guard failed before a11y shard: {local_head} != {EXACT_HEAD}')

INDEX = (ROOT / 'apps/web/public/index.html').read_text()
COMPILED_FONT = ROOT / 'dist/frontend/assets/fonts/ibm-plex-sans-variable.woff2'
if not COMPILED_FONT.is_file():
    raise RuntimeError('Locked compiled IBM Plex Sans font is missing; run the frontend build before accessibility validation')
shard = ROUTE_KEY
output = OUTPUT_ROOT / shard
screenshots = output / 'screenshots'
traces = output / 'traces'
screenshots.mkdir(parents=True, exist_ok=True)
traces.mkdir(parents=True, exist_ok=True)
jsonl_path = output / 'CHECKS.jsonl'
jsonl = jsonl_path.open('w', encoding='utf-8')
results = []
screenshot_manifest = []
trace_manifest = []
fatal_error = None
started_at = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
runtime = tempfile.mkdtemp(prefix='qelly-prompt2b-a11y-')

def sha256_bytes(body):
    return hashlib.sha256(body).hexdigest()

def safe_name(value):
    return ''.join(ch.lower() if ch.isalnum() or ch in '._-' else '-' for ch in value).strip('-')

def append_record(record):
    jsonl.write(json.dumps(record, separators=(',', ':')) + '\n')
    jsonl.flush()
    os.fsync(jsonl.fileno())
    results.append(record)

def record_file(manifest, kind, file_path, **extra):
    body = file_path.read_bytes()
    manifest.append({'kind': kind, 'path': file_path.relative_to(output).as_posix(), 'bytes': len(body), 'sha256': sha256_bytes(body), **extra})

proc = subprocess.Popen(['node', '--input-type=module', '-e', launcher, runtime], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
try:
    line = proc.stdout.readline().strip()
    if not line:
        raise RuntimeError(proc.stderr.read())
    info = json.loads(line)
    base = f"http://127.0.0.1:{info['port']}"
    route_path, authenticated = ROUTES[ROUTE_KEY]
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])
        for viewport_name, viewport in VIEWPORTS:
            case_started = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            case_id = f'{ROUTE_KEY}|{viewport_name}'
            safe_case = safe_name(case_id)
            failures = []
            errors = []
            checks = {}
            focus = None
            context = None
            page = None
            trace_saved = False
            try:
                cookie_header = None
                parsed_cookie = SimpleCookie()
                if authenticated:
                    stamp = int(time.time() * 1000)
                    payload = json.dumps({'email':f'a11y-{ROUTE_KEY}-{viewport_name}-{stamp}@qelly.local','password':'Qelly-A11y-Foundation-2026!','displayName':'Accessibility Validator','organizationName':f'Accessibility Org {stamp}','workspaceName':'Accessible Workspace','locale':'en-US','timezone':'UTC','baseCurrency':'USD'}).encode()
                    request = urllib.request.Request(base + '/api/v1/auth/register', data=payload, headers={'Content-Type':'application/json'}, method='POST')
                    with urllib.request.urlopen(request, timeout=20) as response:
                        if response.status != 201:
                            raise RuntimeError(f'registration failed: {response.status}')
                        raw_cookie = response.headers.get('Set-Cookie')
                    cookie_header = raw_cookie.split(';',1)[0]
                    parsed_cookie.load(raw_cookie)
                context = browser.new_context(viewport=viewport, reduced_motion='reduce' if viewport_name == 'mobile' else 'no-preference')
                context.add_init_script("sessionStorage.setItem('qelly.brand.opening.v1','seen');localStorage.setItem('qelly.calculations.v1'," + json.dumps(json.dumps(SAVED_SEED)) + ');')
                if authenticated:
                    for morsel in parsed_cookie.values():
                        context.add_cookies([{'name':morsel.key,'value':morsel.value,'domain':'qelly.test','path':'/'}])
                context.tracing.start(screenshots=True, snapshots=True, sources=True)
                page = context.new_page()
                page.on('console', lambda msg, target=errors: target.append(msg.text) if msg.type == 'error' else None)
                page.on('pageerror', lambda exc, target=errors: target.append(str(exc)))
                page.on('response', lambda response, target=errors: target.append(f'HTTP {response.status} {response.url}') if response.status >= 400 else None)
                page.on('requestfailed', lambda request, target=errors: target.append(f'Request failed {request.url}: {request.failure}'))
                def proxy(route_obj, is_auth=authenticated, current_route=ROUTE_KEY, cookie=cookie_header):
                    parsed = urlsplit(route_obj.request.url)
                    if parsed.netloc == 'qelly.test' and parsed.path == '/' and route_obj.request.resource_type == 'document':
                        route_obj.fulfill(status=200, headers={'Content-Type':'text/html; charset=utf-8'}, body=INDEX); return
                    if parsed.netloc == 'qelly.test' and parsed.path == '/assets/fonts/ibm-plex-sans-variable.woff2':
                        route_obj.fulfill(status=200, headers={'Content-Type':'font/woff2','Cache-Control':'no-store'}, path=str(COMPILED_FONT)); return
                    if not is_auth and parsed.path == '/api/v1/config':
                        with urllib.request.urlopen(base + '/api/v1/config', timeout=20) as config_response:
                            public_config = json.loads(config_response.read().decode('utf-8'))
                        public_config.setdefault('auth', {})['authenticated'] = False
                        public_config['defaultRoute'] = current_route
                        route_obj.fulfill(status=200, headers={'Content-Type':'application/json; charset=utf-8'}, body=json.dumps(public_config)); return
                    if not is_auth and parsed.path == '/api/v1/auth/status':
                        route_obj.fulfill(status=200, headers={'Content-Type':'application/json; charset=utf-8'}, body=json.dumps({'authenticated':False,'mode':'production-cookie','productionFoundation':{'developmentIdentityEnabled':False}})); return
                    if parsed.netloc == 'unpkg.com':
                        route_obj.fulfill(status=200, headers={'Content-Type':'application/javascript'}, body='window.LightweightCharts=window.LightweightCharts||undefined;'); return
                    if parsed.path.startswith('/api/v1/stream/'):
                        route_obj.fulfill(status=200, headers={'Content-Type':'text/event-stream'}, body='event: stream.heartbeat.v1\ndata: {"status":"a11y"}\n\n'); return
                    target = base + parsed.path + ('?' + parsed.query if parsed.query else '')
                    data = route_obj.request.post_data.encode() if route_obj.request.post_data else None
                    headers = {k:v for k,v in route_obj.request.headers.items() if k.lower() not in {'host','content-length','accept-encoding','connection','origin','referer'}}
                    if is_auth and cookie:
                        headers['Cookie'] = cookie
                    proxied_request = urllib.request.Request(target, data=data, headers=headers, method=route_obj.request.method)
                    try:
                        with urllib.request.urlopen(proxied_request, timeout=20) as proxied:
                            route_obj.fulfill(status=proxied.status, headers={k:v for k,v in proxied.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length','set-cookie'}}, body=proxied.read())
                    except urllib.error.HTTPError as exc:
                        route_obj.fulfill(status=exc.code, headers={k:v for k,v in exc.headers.items() if k.lower() not in {'content-encoding','transfer-encoding','connection','content-length','set-cookie'}}, body=exc.read())
                page.route('**/*', proxy)
                page.goto(f'https://qelly.test/#/{route_path}', wait_until='load', timeout=30000)
                page.wait_for_selector('main#main h1', timeout=15000)
                page.wait_for_timeout(180)
                checks = page.evaluate(EVALUATE)
                page.keyboard.press('Tab')
                focus = page.evaluate("({tag:document.activeElement?.tagName,id:document.activeElement?.id||null})")
                if checks['lang'] != 'en': failures.append('html-lang')
                if not checks['title']: failures.append('title')
                if not checks['skipLink']: failures.append('skip-link')
                if checks['mainCount'] != 1: failures.append('single-main')
                if checks['h1Count'] < 1: failures.append('h1')
                if checks['unlabeled']: failures.append('control-name')
                if checks['missingAlt']: failures.append('image-alt')
                if checks['positiveTabindex']: failures.append('positive-tabindex')
                if checks['duplicateIds']: failures.append('duplicate-id')
                if checks['overflow'] > 2: failures.append('overflow')
                if checks['fontStatus'] != 'loaded': failures.append('font')
                if focus['tag'] in (None,'BODY','HTML'): failures.append('keyboard-entry')
                if errors: failures.append('console-errors')
            except Exception as exc:
                failures.append('render-failure')
                errors.append(f'{type(exc).__name__}: {exc}')
                errors.append(traceback.format_exc())
            unique_failures = sorted(set(failures))
            signature = sha256_bytes(json.dumps({'route':ROUTE_KEY,'viewport':viewport_name,'failures':unique_failures,'errors':errors}, sort_keys=True).encode()) if unique_failures else None
            if unique_failures and page:
                screenshot_path = screenshots / f'{safe_case}.png'
                try:
                    page.screenshot(path=str(screenshot_path), full_page=False)
                    record_file(screenshot_manifest, 'screenshot', screenshot_path, caseId=case_id, failureSignature=signature)
                except Exception as exc:
                    unique_failures.append('screenshot-capture-failed')
                    errors.append(str(exc))
            if context:
                try:
                    if unique_failures:
                        trace_path = traces / f'{safe_case}.zip'
                        context.tracing.stop(path=str(trace_path))
                        trace_saved = True
                        record_file(trace_manifest, 'trace', trace_path, caseId=case_id, failureSignature=signature)
                    else:
                        context.tracing.stop()
                except Exception as exc:
                    unique_failures.append('trace-capture-failed')
                    errors.append(str(exc))
            record = {
                'schemaVersion': 1, 'repository': 'hemangsah/qelly-intelligence', 'head': EXACT_HEAD, 'branch': BRANCH,
                'shard': shard, 'caseId': case_id, 'attempt': 1, 'retries': 0, 'forcedClicks': 0,
                'route': ROUTE_KEY, 'path': route_path, 'viewport': viewport_name, 'dimensions': viewport,
                'authenticated': authenticated, 'startedAt': case_started, 'completedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'checks': checks, 'firstTabFocus': focus, 'consoleErrors': errors, 'criticalFailures': sorted(set(unique_failures)),
                'failureSignature': signature, 'screenshotCaptured': bool(unique_failures and page), 'traceCaptured': trace_saved,
                'status': 'passed' if not unique_failures else 'failed'
            }
            append_record(record)
            if page:
                page.close()
            if context:
                context.close()
        browser.close()
except Exception as exc:
    fatal_error = {'name': type(exc).__name__, 'message': str(exc), 'traceback': traceback.format_exc()}
finally:
    jsonl.close()
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
    shutil.rmtree(runtime, ignore_errors=True)

failed = [item for item in results if item['status'] == 'failed']
case_ids = [item['caseId'] for item in results]
unique_case_ids = set(case_ids)
counter = {
    'schemaVersion': 1, 'head': EXACT_HEAD, 'shard': shard, 'expected': EXPECTED_CHECKS, 'attempted': len(results),
    'durableJsonlRecords': len(results), 'uniqueCaseIds': len(unique_case_ids), 'duplicates': len(results) - len(unique_case_ids),
    'passed': len(results) - len(failed), 'failed': len(failed), 'retries': 0, 'forcedClicks': 0,
    'denominatorMatched': len(results) == EXPECTED_CHECKS and len(unique_case_ids) == EXPECTED_CHECKS, 'fatalError': fatal_error
}
summary = {
    'schemaVersion': 1, 'repository': 'hemangsah/qelly-intelligence', 'head': EXACT_HEAD, 'branch': BRANCH, 'shard': shard,
    'route': ROUTE_KEY, 'expectedChecks': EXPECTED_CHECKS, 'checks': len(results), 'passed': len(results) - len(failed), 'failed': len(failed),
    'startedAt': started_at, 'completedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'failFast': False,
    'retries': 0, 'forcedClicks': 0, 'fatalError': fatal_error, 'jsonl': 'CHECKS.jsonl',
    'screenshots': len(screenshot_manifest), 'traces': len(trace_manifest), 'denominatorMatched': counter['denominatorMatched']
}
(output / 'SHARD_SUMMARY.json').write_text(json.dumps(summary, indent=2) + '\n')
(output / 'COUNTER_RECONCILIATION.json').write_text(json.dumps(counter, indent=2) + '\n')
(output / 'FAILURE_SIGNATURES.json').write_text(json.dumps({'schemaVersion':1,'head':EXACT_HEAD,'shard':shard,'count':len(failed),'failures':[{'caseId':x['caseId'],'signature':x['failureSignature'],'failures':x['criticalFailures']} for x in failed]}, indent=2) + '\n')
(output / 'SCREENSHOT_MANIFEST.json').write_text(json.dumps({'schemaVersion':1,'head':EXACT_HEAD,'shard':shard,'files':screenshot_manifest}, indent=2) + '\n')
(output / 'TRACE_MANIFEST.json').write_text(json.dumps({'schemaVersion':1,'head':EXACT_HEAD,'shard':shard,'files':trace_manifest}, indent=2) + '\n')
if fatal_error:
    (output / 'SHARD_FATAL.json').write_text(json.dumps({'schemaVersion':1,'head':EXACT_HEAD,'shard':shard,'fatalError':fatal_error}, indent=2) + '\n')
checksum_items = []
for file_path in sorted(output.rglob('*')):
    if file_path.is_file() and file_path.name != 'CHECKSUMS.json':
        body = file_path.read_bytes()
        checksum_items.append({'path':file_path.relative_to(output).as_posix(),'bytes':len(body),'sha256':sha256_bytes(body)})
(output / 'CHECKSUMS.json').write_text(json.dumps({'schemaVersion':1,'head':EXACT_HEAD,'shard':shard,'fileCount':len(checksum_items),'files':checksum_items}, indent=2) + '\n')
end_head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
if end_head != EXACT_HEAD:
    raise RuntimeError(f'Exact-head guard failed after a11y shard: {end_head} != {EXACT_HEAD}')
print(json.dumps(summary, indent=2))
if fatal_error or not counter['denominatorMatched'] or failed:
    raise SystemExit(1)
