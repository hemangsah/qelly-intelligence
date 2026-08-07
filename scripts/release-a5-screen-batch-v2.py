import json
import mimetypes
import pathlib
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from urllib.parse import unquote, urlsplit

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUBLIC_ROOT = (ROOT / 'apps/web/public').resolve()
INDEX = (PUBLIC_ROOT / 'index.html').read_text().replace(
    '<head>', '<head><base href="https://qelly.test/">', 1
)
OUT = ROOT / 'preview' / 'release-a5-all-screens'
OUT.mkdir(parents=True, exist_ok=True)
SESSION_ID = 'sess-local-primary'
EXPECTED_ORIGIN = 'https://qelly.test'
CRITICAL_RESOURCE_TYPES = {'document', 'script', 'stylesheet', 'font', 'image'}
RENDER_FAILURE_HEADINGS = {
    'Unable to render this route.',
    'Route unavailable',
    'Qelly foundation failed to start',
}
MIME_OVERRIDES = {
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
}

start = int(sys.argv[1])
end = int(sys.argv[2])
if start < 0 or end <= start:
    raise SystemExit(f'invalid screen range {start}:{end}')

route_json = subprocess.check_output(
    [
        'node',
        '--input-type=module',
        '-e',
        "import {routeDefinitions} from './apps/web/public/assets/route-registry.mjs'; console.log(JSON.stringify(routeDefinitions));",
    ],
    cwd=ROOT,
    text=True,
)
defs_all = json.loads(route_json)
if end > len(defs_all):
    raise SystemExit(
        f'screen range {start}:{end} exceeds route registry size {len(defs_all)}'
    )
defs = defs_all[start:end]
public_routes = {item['route'] for item in defs_all if item.get('public') is True}
runtime = tempfile.mkdtemp(prefix=f'qelly-a5-screens-{start}-{end}-')


def local_public_file(request_path):
    relative = unquote(request_path).lstrip('/')
    if not relative:
        return None
    candidate = (PUBLIC_ROOT / relative).resolve()
    try:
        candidate.relative_to(PUBLIC_ROOT)
    except ValueError:
        return None
    return candidate if candidate.is_file() else None


def content_type(path):
    return (
        MIME_OVERRIDES.get(path.suffix.lower())
        or mimetypes.guess_type(path.name)[0]
        or 'application/octet-stream'
    )


def request_json(base, path, *, authenticated=False):
    headers = {'Accept': 'application/json'}
    if authenticated:
        headers['X-Qelly-Session-Id'] = SESSION_ID
    request = urllib.request.Request(f'{base}{path}', headers=headers)
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode('utf-8'))


launcher = r"""
import { startServer } from './src/server/server.mjs';
const fixtureSeed=['release','a5','screen','batch','fixture','0000001'].join('-');
const environment={
  ...process.env,
  NODE_ENV:'test',
  QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',
  QELLY_PRODUCTION_IDENTITY_ENABLED:'false',
  QELLY_DEVELOPMENT_IDENTITY_ENABLED:'true',
  QELLY_DEVELOPMENT_IDENTITY_EXPLICIT_HEADER_ONLY:'true',
  QELLY_DATABASE_MODE:'sqlite',
  QELLY_JOB_QUEUE_MODE:'database',
  QELLY_SESSION_SECRET:fixtureSeed+'-session',
  QELLY_PASSWORD_PEPPER:fixtureSeed+'-pepper',
  QELLY_EXPOSE_RECOVERY_CODE_IN_DEVELOPMENT:'false',
  QELLY_LIVE_MARKET_ENABLED:'false',
  QELLY_EXTERNAL_PROVIDERS_ENABLED:'false',
  QELLY_SECRET_KEYRING_JSON:JSON.stringify({old:fixtureSeed+'-old-key-material',active:fixtureSeed+'-active-key-material'}),
  QELLY_SECRET_ACTIVE_KEY_ID:'active'
};
const instance=await startServer({port:0,runtimePath:process.argv[1],environment});
console.log(JSON.stringify({host:instance.host,port:instance.port}));
process.on('SIGTERM',()=>instance.server.close(()=>process.exit(0)));
setInterval(()=>{},1000);
"""

proc = subprocess.Popen(
    ['node', '--input-type=module', '-e', launcher, runtime],
    cwd=ROOT,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
)

try:
    line = proc.stdout.readline().strip()
    if not line:
        raise RuntimeError(proc.stderr.read())
    server = json.loads(line)
    base = f"http://127.0.0.1:{server['port']}"

    anonymous_config = request_json(base, '/api/v1/config')
    authenticated_config = request_json(
        base, '/api/v1/config', authenticated=True
    )
    authenticated_status = request_json(
        base, '/api/v1/auth/status', authenticated=True
    )
    if anonymous_config.get('auth', {}).get('authenticated') is not False:
        raise RuntimeError('anonymous evidence preflight did not remain anonymous')
    if authenticated_config.get('auth', {}).get('authenticated') is not True:
        raise RuntimeError('authenticated evidence preflight failed /api/v1/config')
    if authenticated_status.get('authenticated') is not True:
        raise RuntimeError('authenticated evidence preflight failed /api/v1/auth/status')

    auth_evidence = {
        'anonymousConfigAuthenticated': False,
        'authenticatedConfigAuthenticated': True,
        'authenticatedStatusAuthenticated': True,
        'identityMode': authenticated_config.get('auth', {}).get('mode'),
        'fixtureSession': SESSION_ID,
    }
    viewports = [
        ('desktop', {'width': 1440, 'height': 1000}),
        ('mobile', {'width': 390, 'height': 844}),
    ]
    results = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        )
        for viewport_name, viewport in viewports:
            contexts = {
                False: browser.new_context(
                    viewport=viewport,
                    device_scale_factor=1,
                    reduced_motion='reduce',
                ),
                True: browser.new_context(
                    viewport=viewport,
                    device_scale_factor=1,
                    reduced_motion='reduce',
                ),
            }
            for definition in defs:
                route_name = definition['route']
                authenticated = route_name not in public_routes
                page = contexts[authenticated].new_page()
                errors = []
                observations = []

                def on_console(message):
                    if message.type != 'error':
                        return
                    item = {'type': 'console', 'text': message.text}
                    if message.text.startswith('Failed to load resource:'):
                        observations.append(item)
                    else:
                        errors.append(item)

                def on_request_failed(request):
                    item = {
                        'type': 'requestfailed',
                        'resourceType': request.resource_type,
                        'url': request.url,
                        'method': request.method,
                        'failure': request.failure,
                    }
                    if request.resource_type in CRITICAL_RESOURCE_TYPES:
                        errors.append(item)
                    else:
                        observations.append(item)

                def on_response(response):
                    if response.status < 400:
                        return
                    item = {
                        'type': 'http',
                        'resourceType': response.request.resource_type,
                        'status': response.status,
                        'url': response.url,
                    }
                    if response.request.resource_type in CRITICAL_RESOURCE_TYPES:
                        errors.append(item)
                    else:
                        observations.append(item)

                page.on('console', on_console)
                page.on(
                    'pageerror',
                    lambda exception, target=errors: target.append(
                        {'type': 'pageerror', 'text': str(exception)}
                    ),
                )
                page.on('requestfailed', on_request_failed)
                page.on('response', on_response)

                def proxy(route_object):
                    parsed = urlsplit(route_object.request.url)
                    if parsed.netloc == 'qelly.test' and parsed.path in ('/', '/index.html'):
                        route_object.fulfill(
                            status=200,
                            headers={
                                'Content-Type': 'text/html; charset=utf-8',
                                'Cache-Control': 'no-store',
                                'X-Content-Type-Options': 'nosniff',
                            },
                            body=INDEX,
                        )
                        return
                    if parsed.netloc == 'qelly.test':
                        asset = local_public_file(parsed.path)
                        if asset is not None:
                            route_object.fulfill(
                                status=200,
                                headers={
                                    'Content-Type': content_type(asset),
                                    'Cache-Control': 'no-store',
                                    'X-Content-Type-Options': 'nosniff',
                                },
                                body=asset.read_bytes(),
                            )
                            return
                    if not authenticated and parsed.path == '/api/v1/config':
                        public_config = dict(anonymous_config)
                        public_config['auth'] = {
                            **public_config.get('auth', {}),
                            'authenticated': False,
                        }
                        public_config['defaultRoute'] = route_name
                        route_object.fulfill(
                            status=200,
                            headers={'Content-Type': 'application/json; charset=utf-8'},
                            body=json.dumps(public_config),
                        )
                        return
                    if not authenticated and parsed.path == '/api/v1/auth/status':
                        route_object.fulfill(
                            status=200,
                            headers={'Content-Type': 'application/json; charset=utf-8'},
                            body=json.dumps(
                                {
                                    'authenticated': False,
                                    'mode': 'anonymous-test-runtime',
                                    'productionFoundation': {
                                        'developmentIdentityEnabled': True
                                    },
                                }
                            ),
                        )
                        return
                    if parsed.netloc == 'unpkg.com':
                        route_object.fulfill(
                            status=200,
                            headers={
                                'Content-Type': 'application/javascript; charset=utf-8'
                            },
                            body='window.LightweightCharts=window.LightweightCharts||undefined;',
                        )
                        return
                    if parsed.path.startswith('/api/v1/stream/'):
                        route_object.fulfill(
                            status=200,
                            headers={
                                'Content-Type': 'text/event-stream; charset=utf-8',
                                'Cache-Control': 'no-cache',
                            },
                            body='event: stream.heartbeat.v1\ndata: {"status":"release-a5-screens"}\n\n',
                        )
                        return

                    target = base + parsed.path + (
                        '?' + parsed.query if parsed.query else ''
                    )
                    request_data = (
                        route_object.request.post_data.encode()
                        if route_object.request.post_data
                        else None
                    )
                    headers = {
                        key: value
                        for key, value in route_object.request.headers.items()
                        if key.lower()
                        not in {
                            'host',
                            'content-length',
                            'accept-encoding',
                            'connection',
                            'origin',
                            'referer',
                            'cookie',
                            'x-qelly-session-id',
                        }
                    }
                    if authenticated:
                        headers['X-Qelly-Session-Id'] = SESSION_ID
                    upstream = urllib.request.Request(
                        target,
                        data=request_data,
                        headers=headers,
                        method=route_object.request.method,
                    )
                    try:
                        with urllib.request.urlopen(upstream, timeout=20) as response:
                            response_headers = {
                                key: value
                                for key, value in response.headers.items()
                                if key.lower()
                                not in {
                                    'content-encoding',
                                    'transfer-encoding',
                                    'connection',
                                    'content-length',
                                    'set-cookie',
                                }
                            }
                            route_object.fulfill(
                                status=response.status,
                                headers=response_headers,
                                body=response.read(),
                            )
                    except urllib.error.HTTPError as exception:
                        response_headers = {
                            key: value
                            for key, value in exception.headers.items()
                            if key.lower()
                            not in {
                                'content-encoding',
                                'transfer-encoding',
                                'connection',
                                'content-length',
                                'set-cookie',
                            }
                        }
                        route_object.fulfill(
                            status=exception.code,
                            headers=response_headers,
                            body=exception.read(),
                        )
                    except Exception as exception:
                        route_object.fulfill(
                            status=502,
                            headers={'Content-Type': 'application/json'},
                            body=json.dumps(
                                {
                                    'error': 'proxy_failed',
                                    'target': target,
                                    'message': str(exception),
                                }
                            ),
                        )

                page.route('**/*', proxy)
                started = time.time()
                heading = None
                title = None
                resolved_hash = None
                overflow = None
                page_height = None
                status = 'passed'
                screenshot = OUT / f'{route_name}__{viewport_name}.png'
                expected_title = f"{definition['label']} · Qelly Intelligence"
                expected_hash = f'#/{route_name}'
                try:
                    page.goto(
                        f'{EXPECTED_ORIGIN}/#/{route_name}',
                        wait_until='domcontentloaded',
                        timeout=30000,
                    )
                    page.wait_for_selector('main#main h1', timeout=20000)
                    page.wait_for_function(
                        "document.querySelector('main#main')?.getAttribute('aria-busy') !== 'true'",
                        timeout=20000,
                    )
                    page.evaluate('document.fonts?.ready')
                    page.wait_for_timeout(500)
                    heading = page.locator('main#main h1').first.text_content()
                    title = page.title()
                    resolved_hash = page.evaluate('location.hash.split("?")[0]')
                    overflow = page.evaluate(
                        'document.documentElement.scrollWidth-document.documentElement.clientWidth'
                    )
                    page_height = page.evaluate(
                        'document.documentElement.scrollHeight'
                    )
                    if not heading or heading.strip() in RENDER_FAILURE_HEADINGS:
                        errors.append(
                            {
                                'type': 'semantic',
                                'text': f'Invalid route heading: {heading!r}',
                            }
                        )
                    if title != expected_title:
                        errors.append(
                            {
                                'type': 'route-identity',
                                'text': f'Expected title {expected_title!r}, received {title!r}',
                            }
                        )
                    if resolved_hash != expected_hash:
                        errors.append(
                            {
                                'type': 'route-identity',
                                'text': f'Expected hash {expected_hash!r}, received {resolved_hash!r}',
                            }
                        )
                    if overflow is not None and overflow > 2:
                        errors.append(
                            {
                                'type': 'horizontal-overflow',
                                'text': f'Document overflowed viewport by {overflow}px',
                            }
                        )
                    if errors:
                        status = 'failed'
                    page.screenshot(
                        path=str(screenshot),
                        full_page=True,
                        animations='disabled',
                    )
                except Exception as exception:
                    errors.append({'type': 'render', 'text': str(exception)})
                    status = 'failed'
                    try:
                        page.screenshot(
                            path=str(screenshot),
                            full_page=True,
                            animations='disabled',
                        )
                    except Exception:
                        pass

                result = {
                    'route': route_name,
                    'label': definition['label'],
                    'section': definition['section'],
                    'public': route_name in public_routes,
                    'authenticatedFixture': authenticated,
                    'evidenceBoundary': 'verified-governed-local-test-runtime',
                    'viewport': viewport_name,
                    'dimensions': viewport,
                    'pageHeightPx': page_height,
                    'heading': heading,
                    'title': title,
                    'resolvedHash': resolved_hash,
                    'expectedTitle': expected_title,
                    'expectedHash': expected_hash,
                    'overflowPx': overflow,
                    'consoleErrors': errors,
                    'networkObservations': observations,
                    'status': status,
                    'elapsedMs': round((time.time() - started) * 1000),
                    'file': str(screenshot.relative_to(ROOT)),
                }
                results.append(result)
                print(
                    json.dumps(
                        {
                            'route': route_name,
                            'viewport': viewport_name,
                            'status': status,
                            'heading': heading,
                            'title': title,
                            'resolvedHash': resolved_hash,
                            'pageHeightPx': page_height,
                            'overflowPx': overflow,
                            'errors': errors,
                            'observations': observations,
                            'elapsedMs': result['elapsedMs'],
                        }
                    ),
                    flush=True,
                )
                page.close()
            for context in contexts.values():
                context.close()
        browser.close()

    batch = {
        'start': start,
        'end': end,
        'routeCount': len(defs),
        'registryRouteCount': len(defs_all),
        'renderCount': len(results),
        'authenticationEvidence': auth_evidence,
        'results': results,
    }
    (OUT / f'batch-{start:03d}-{end:03d}.json').write_text(
        json.dumps(batch, indent=2) + '\n'
    )
    if any(item['status'] != 'passed' for item in results):
        raise SystemExit(1)
finally:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except Exception:
        proc.kill()
    shutil.rmtree(runtime, ignore_errors=True)
