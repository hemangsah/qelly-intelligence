from pathlib import Path
import runpy
import urllib.request


ANONYMOUS_EVIDENCE_SESSION = 'anonymous-evidence-context'
_original_request = urllib.request.Request


def _isolated_request(
    url,
    data=None,
    headers=None,
    origin_req_host=None,
    unverifiable=False,
    method=None,
):
    isolated_headers = dict(headers or {})
    has_session = any(
        str(name).lower() == 'x-qelly-session-id'
        for name in isolated_headers
    )
    target = str(url)
    if (
        not has_session
        and target.startswith(('http://127.0.0.1:', 'http://localhost:'))
    ):
        isolated_headers['X-Qelly-Session-Id'] = ANONYMOUS_EVIDENCE_SESSION
    return _original_request(
        url,
        data=data,
        headers=isolated_headers,
        origin_req_host=origin_req_host,
        unverifiable=unverifiable,
        method=method,
    )


urllib.request.Request = _isolated_request
try:
    runpy.run_path(
        str(Path(__file__).with_name('release-a5-screen-batch-v2.py')),
        run_name='__main__',
    )
finally:
    urllib.request.Request = _original_request
