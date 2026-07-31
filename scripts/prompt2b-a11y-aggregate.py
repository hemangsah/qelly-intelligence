import hashlib, json, os, pathlib, sys, time

ROOT=pathlib.Path(__file__).resolve().parents[1]
HEAD=os.environ.get('QELLY_REVIEW_HEAD') or os.environ.get('GITHUB_SHA') or 'unknown'
EXPECTED_HEAD=os.environ.get('QELLY_EXPECTED_HEAD',HEAD)
if HEAD!=EXPECTED_HEAD: raise RuntimeError(f'Exact-head guard failed: {HEAD} != {EXPECTED_HEAD}')
INPUT=ROOT/'.prompt2b-shards'/'a11y'; VALIDATION=ROOT/'validation'; REVIEW=ROOT/'.prompt2b-review'; VALIDATION.mkdir(exist_ok=True); REVIEW.mkdir(exist_ok=True)
ROUTES=['auth-login','auth-register','auth-recovery','account-session','onboarding','discovery-hub','live-markets','identity-access','security-evidence','security-setup','secure-import-vault','passkey-center','account-recovery','delivery-operations','platform-readiness','secret-rotation','quarantine-review','staging-assurance','calculator-center','india-finance','indicator-library','formula-library','saved-calculations','formula-detail','indicator-detail','calculator-detail','saved-calculation-detail']
EXPECTED_SHARDS=27; EXPECTED_CHECKS=54

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
missing=[]; checksum_failures=[]; summaries=[]; results=[]
for route in ROUTES:
    root=INPUT/route
    if not root.is_dir(): missing.append(route); continue
    summary=json.loads((root/'SUMMARY.json').read_text()); checks=json.loads((root/'CHECKSUMS.json').read_text())
    if summary.get('head')!=HEAD or checks.get('head')!=HEAD: checksum_failures.append({'route':route,'type':'head','summary':summary.get('head'),'checks':checks.get('head'),'expected':HEAD})
    for item in checks.get('files',[]):
        file=root/item['path']
        if not file.is_file(): checksum_failures.append({'route':route,'type':'missing','path':item['path']}); continue
        if file.stat().st_size!=item['bytes'] or digest(file)!=item['sha256']: checksum_failures.append({'route':route,'type':'mismatch','path':item['path']})
    lines=[line for line in (root/'cases.jsonl').read_text().splitlines() if line.strip()]
    shard_results=[json.loads(line) for line in lines]
    if len(shard_results)!=2 or summary.get('checks')!=2: checksum_failures.append({'route':route,'type':'denominator','jsonl':len(shard_results),'summary':summary.get('checks')})
    summaries.append(summary); results.extend(shard_results)
case_counts={}
for item in results: case_counts[item['caseId']]=case_counts.get(item['caseId'],0)+1
duplicates=[{'caseId':k,'count':v} for k,v in case_counts.items() if v!=1]
unexpected=[item['caseId'] for item in results if item.get('head')!=HEAD or item.get('route') not in ROUTES or item.get('viewport') not in ('desktop','mobile')]
failed=[item for item in results if item.get('status')!='passed']
signature_map={}
for item in failed:
    key=item.get('failureSignature') or hashlib.sha256('|'.join(item.get('criticalFailures',[])).encode()).hexdigest()[:20]
    entry=signature_map.setdefault(key,{'signature':key,'count':0,'criticalFailures':item.get('criticalFailures',[]),'routes':set(),'viewports':set(),'firstCase':None,'lastCase':None,'screenshots':[],'traces':[]})
    entry['count']+=1; entry['routes'].add(item['route']); entry['viewports'].add(item['viewport']); entry['firstCase']=min(filter(None,[entry['firstCase'],item['caseId']])); entry['lastCase']=max(filter(None,[entry['lastCase'],item['caseId']]))
    if item.get('evidence',{}).get('screenshot'): entry['screenshots'].append(f"{item['route']}/{item['evidence']['screenshot']}")
    if item.get('evidence',{}).get('trace'): entry['traces'].append(f"{item['route']}/{item['evidence']['trace']}")
signatures=[]
for entry in signature_map.values():
    entry['routes']=sorted(entry['routes']); entry['viewports']=sorted(entry['viewports']); entry['screenshots']=sorted(entry['screenshots']); entry['traces']=sorted(entry['traces']); signatures.append(entry)
signatures.sort(key=lambda x:(-x['count'],x['signature']))
denominator_failures=[]
if missing: denominator_failures.append(f'missing-shards:{len(missing)}')
if len(summaries)!=EXPECTED_SHARDS: denominator_failures.append(f'shard-count:{len(summaries)}/{EXPECTED_SHARDS}')
if len(results)!=EXPECTED_CHECKS: denominator_failures.append(f'check-count:{len(results)}/{EXPECTED_CHECKS}')
if len(case_counts)!=EXPECTED_CHECKS: denominator_failures.append(f'unique-case-count:{len(case_counts)}/{EXPECTED_CHECKS}')
if duplicates: denominator_failures.append(f'duplicate-cases:{len(duplicates)}')
if checksum_failures: denominator_failures.append(f'checksum-failures:{len(checksum_failures)}')
if unexpected: denominator_failures.append(f'unexpected-cases:{len(unexpected)}')
failed_count=len(failed)+len(denominator_failures)
log={'release':'Prompt 2B sharded final','generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'head':HEAD,'method':'automated semantic, keyboard-entry, exact-font and responsive regression; not an independent WCAG certification','routeCount':len(ROUTES),'viewportCount':2,'expectedChecks':EXPECTED_CHECKS,'checks':len(results),'passed':len(results)-len(failed),'failed':failed_count,'results':results,'failureSignatures':signatures,'integrity':{'expectedShards':EXPECTED_SHARDS,'receivedShards':len(summaries),'missingShards':missing,'checksumFailures':checksum_failures,'duplicates':duplicates,'unexpectedCases':unexpected,'denominatorFailures':denominator_failures},'status':'passed' if failed_count==0 else 'failed'}
(VALIDATION/'RELEASE_A5_ACCESSIBILITY_REGRESSION.json').write_text(json.dumps(log,indent=2)+'\n')
(REVIEW/'ACCESSIBILITY_FAILURE_SIGNATURES.json').write_text(json.dumps({'head':HEAD,'failedCases':len(failed),'uniqueSignatures':len(signatures),'signatures':signatures,'integrity':log['integrity']},indent=2)+'\n')
print(json.dumps({'head':HEAD,'checks':len(results),'expectedChecks':EXPECTED_CHECKS,'passed':log['passed'],'failed':failed_count,'uniqueSignatures':len(signatures),'denominatorFailures':denominator_failures},indent=2))
if failed_count: sys.exit(1)
