import hashlib
import json
import os
import pathlib
import shutil
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXACT_HEAD = os.environ.get('QELLY_REVIEW_HEAD') or os.environ.get('GITHUB_SHA') or 'unknown'
INPUT_ROOT = pathlib.Path(os.environ.get('QELLY_A11Y_INPUT', '.prompt2b-a11y-shards')).resolve()
OUTPUT_FILE = ROOT / 'validation' / 'RELEASE_A5_ACCESSIBILITY_REGRESSION.json'
OUTPUT_ROOT = pathlib.Path(os.environ.get('QELLY_A11Y_AGGREGATE_OUTPUT', '.prompt2b-a11y-review')).resolve()
MODE_FILE = pathlib.Path(os.environ.get('QELLY_FAST_TRACK_MODE_FILE', 'project-state/QELLY_PROMPT2B_FAST_TRACK_MODE.json'))
MODE_CONFIG = json.loads(MODE_FILE.read_text())
MODE = os.environ.get('QELLY_FAST_TRACK_MODE', MODE_CONFIG['mode'])
ALL_ROUTES = [
    'auth-login','auth-register','auth-recovery','account-session','onboarding','discovery-hub','live-markets','identity-access','security-evidence',
    'security-setup','secure-import-vault','passkey-center','account-recovery','delivery-operations','platform-readiness','secret-rotation','quarantine-review','staging-assurance',
    'calculator-center','india-finance','indicator-library','formula-library','saved-calculations','formula-detail','indicator-detail','calculator-detail','saved-calculation-detail'
]
if MODE not in ('focused','acceptance'):
    raise RuntimeError(f'Unsupported fast-track mode: {MODE}')
selected_routes = ALL_ROUTES if MODE == 'acceptance' else MODE_CONFIG['focus']['a11yRoutes']
expected_checks = len(selected_routes) * 2
local_head = subprocess.check_output(['git','rev-parse','HEAD'], cwd=ROOT, text=True).strip()
if local_head != EXACT_HEAD:
    raise RuntimeError(f'Exact-head guard failed before a11y aggregate: {local_head} != {EXACT_HEAD}')
OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
(OUTPUT_ROOT / 'screenshots').mkdir(exist_ok=True)
(OUTPUT_ROOT / 'traces').mkdir(exist_ok=True)

def sha256_bytes(body):
    return hashlib.sha256(body).hexdigest()

def find_files(name):
    return list(INPUT_ROOT.rglob(name))

summaries = {}
for summary_path in find_files('SHARD_SUMMARY.json'):
    document = json.loads(summary_path.read_text())
    if document.get('route') in selected_routes:
        summaries[document['route']] = (summary_path, document)
missing_shards = [route for route in selected_routes if route not in summaries]
results = []
shard_diagnostics = []
checksum_failures = []
screenshot_manifest = []
trace_manifest = []
for route in selected_routes:
    found = summaries.get(route)
    if not found:
        continue
    summary_path, summary = found
    shard_dir = summary_path.parent
    lines = [line for line in (shard_dir / 'CHECKS.jsonl').read_text().splitlines() if line.strip()]
    shard_results = [json.loads(line) for line in lines]
    results.extend(shard_results)
    checksums = json.loads((shard_dir / 'CHECKSUMS.json').read_text())
    missing = []
    mismatches = []
    for item in checksums['files']:
        file_path = shard_dir / item['path']
        if not file_path.is_file():
            missing.append(item['path'])
            continue
        body = file_path.read_bytes()
        if len(body) != item['bytes'] or sha256_bytes(body) != item['sha256']:
            mismatches.append(item['path'])
    if missing or mismatches:
        checksum_failures.append({'route':route,'missing':missing,'mismatches':mismatches})
    shard_diagnostics.append({'route':route,'summary':summary,'jsonlRecords':len(shard_results),'checksumCount':checksums['fileCount'],'checksumMissing':missing,'checksumMismatches':mismatches})
    for manifest_name, target_dir, target_manifest in [('SCREENSHOT_MANIFEST.json','screenshots',screenshot_manifest),('TRACE_MANIFEST.json','traces',trace_manifest)]:
        manifest_path = shard_dir / manifest_name
        if not manifest_path.is_file():
            continue
        document = json.loads(manifest_path.read_text())
        for item in document['files']:
            source = shard_dir / item['path']
            target_name = f"{route}--{source.name}"
            target = OUTPUT_ROOT / target_dir / target_name
            shutil.copyfile(source, target)
            body = target.read_bytes()
            target_manifest.append({**item,'sourceShard':route,'path':f'{target_dir}/{target_name}','bytes':len(body),'sha256':sha256_bytes(body)})

expected_case_ids = [f'{route}|{viewport}' for route in selected_routes for viewport in ('desktop','mobile')]
actual_ids = [item['caseId'] for item in results]
actual_set = set(actual_ids)
missing_cases = [case_id for case_id in expected_case_ids if case_id not in actual_set]
unexpected_cases = sorted(actual_set - set(expected_case_ids))
duplicate_cases = sorted({case_id for case_id in actual_ids if actual_ids.count(case_id) > 1})
failed = [item for item in results if item['status'] != 'passed']
counter = {
    'schemaVersion':1,'head':EXACT_HEAD,'mode':MODE,'expectedShards':len(selected_routes),'foundShards':len(summaries),'missingShards':missing_shards,
    'expectedChecks':expected_checks,'checks':len(results),'uniqueCaseIds':len(actual_set),'duplicateCases':duplicate_cases,'missingCases':missing_cases,'unexpectedCases':unexpected_cases,
    'passed':len(results)-len(failed),'failed':len(failed),'retries':sum(int(item.get('retries',0)) for item in results),'forcedClicks':sum(int(item.get('forcedClicks',0)) for item in results),
    'checksumFailures':checksum_failures,
    'denominatorMatched':not missing_shards and len(results)==expected_checks and len(actual_set)==expected_checks and not duplicate_cases and not missing_cases and not unexpected_cases
}
log = {
    'release':'Prompt 2B final' if MODE == 'acceptance' else 'Prompt 2B focused fast-track',
    'head':EXACT_HEAD,'mode':MODE,'generatedAt':__import__('time').strftime('%Y-%m-%dT%H:%M:%SZ',__import__('time').gmtime()),
    'method':'automated semantic, keyboard-entry, exact-font and responsive regression; not an independent WCAG certification',
    'routeCount':len(selected_routes),'viewportCount':2,'expectedChecks':expected_checks,'checks':len(results),'passed':len(results)-len(failed),'failed':len(failed),
    'results':results,'counterReconciliation':counter,'status':'passed' if counter['denominatorMatched'] and not failed and not checksum_failures else 'failed'
}
OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
OUTPUT_FILE.write_text(json.dumps(log, indent=2) + '\n')
(OUTPUT_ROOT / 'SUMMARY.json').write_text(json.dumps(log, indent=2) + '\n')
(OUTPUT_ROOT / 'COUNTER_RECONCILIATION.json').write_text(json.dumps(counter, indent=2) + '\n')
(OUTPUT_ROOT / 'SHARD_RECONCILIATION.json').write_text(json.dumps({'schemaVersion':1,'head':EXACT_HEAD,'mode':MODE,'selectedRoutes':selected_routes,'diagnostics':shard_diagnostics,'missingShards':missing_shards,'checksumFailures':checksum_failures}, indent=2) + '\n')
(OUTPUT_ROOT / 'FAILURE_SIGNATURES.json').write_text(json.dumps({'schemaVersion':1,'head':EXACT_HEAD,'mode':MODE,'count':len(failed),'failures':[{'caseId':x['caseId'],'signature':x.get('failureSignature'),'failures':x.get('criticalFailures',[])} for x in failed]}, indent=2) + '\n')
(OUTPUT_ROOT / 'SCREENSHOT_MANIFEST.json').write_text(json.dumps({'schemaVersion':1,'head':EXACT_HEAD,'files':screenshot_manifest}, indent=2) + '\n')
(OUTPUT_ROOT / 'TRACE_MANIFEST.json').write_text(json.dumps({'schemaVersion':1,'head':EXACT_HEAD,'files':trace_manifest}, indent=2) + '\n')
checksum_items = []
for file_path in sorted(OUTPUT_ROOT.rglob('*')):
    if file_path.is_file() and file_path.name != 'CHECKSUMS.json':
        body = file_path.read_bytes()
        checksum_items.append({'path':file_path.relative_to(OUTPUT_ROOT).as_posix(),'bytes':len(body),'sha256':sha256_bytes(body)})
(OUTPUT_ROOT / 'CHECKSUMS.json').write_text(json.dumps({'schemaVersion':1,'head':EXACT_HEAD,'mode':MODE,'fileCount':len(checksum_items),'files':checksum_items}, indent=2) + '\n')
end_head = subprocess.check_output(['git','rev-parse','HEAD'], cwd=ROOT, text=True).strip()
if end_head != EXACT_HEAD:
    raise RuntimeError(f'Exact-head guard failed after a11y aggregate: {end_head} != {EXACT_HEAD}')
print(json.dumps({'head':EXACT_HEAD,'mode':MODE,'checks':len(results),'expected':expected_checks,'failed':len(failed),'missingShards':missing_shards,'missingCases':len(missing_cases),'checksumFailures':len(checksum_failures)}, indent=2))
if not counter['denominatorMatched'] or failed or checksum_failures:
    raise SystemExit(1)
