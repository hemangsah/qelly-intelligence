import hashlib, json, os, pathlib, subprocess, zipfile

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'preview'/'release-a5-all-screens'
manifest_path=OUT/'manifest.json'
if not manifest_path.exists(): raise SystemExit('screen manifest is missing')
manifest=json.loads(manifest_path.read_text())
if manifest.get('status')!='passed': raise SystemExit('screen manifest is not passing')
expected=int(manifest.get('expectedRenderCount') or 0)
images=sorted(OUT.glob('*__desktop.png'))+sorted(OUT.glob('*__mobile.png'))
if len(images)!=expected: raise SystemExit(f'expected {expected} screenshots, found {len(images)}')
sha=os.environ.get('QELLY_SCREEN_EVIDENCE_SHA','').strip()
if not sha:
    sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
if len(sha)<7: raise SystemExit('exact evidence SHA is unavailable')
short=sha[:12]
archive=ROOT/'preview'/f'QELLY_ALL_SCREENS_{short}.zip'
readme=OUT/'README.md'
readme.write_text(f'''# Qelly complete screen evidence

Exact source commit: `{sha}`

This package contains {manifest['renderCount']} full-page PNG captures across {manifest['routeCount']} registered product routes at desktop and mobile viewports, plus manifests and contact sheets.

Evidence boundary: {manifest['evidenceBoundary']}.

Public production deployment is verified separately by the Cloudflare release workflow. Authenticated screens in this package use a disposable local test identity and contain no production user data. This visual-evidence package does not itself prove transactional-email delivery, production authentication readiness, tenant isolation or provider availability; those controls require their dedicated runtime and canary evidence.
''')
checksums={}
for path in sorted(OUT.iterdir()):
    if path.is_file(): checksums[path.name]=hashlib.sha256(path.read_bytes()).hexdigest()
(OUT/'checksums.json').write_text(json.dumps({'schemaVersion':1,'commitSha':sha,'files':checksums},indent=2)+'\n')
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as bundle:
    prefix=f'qelly-all-screens-{short}'
    for path in sorted(OUT.iterdir()):
        if path.is_file(): bundle.write(path,f'{prefix}/{path.name}')
print(json.dumps({'archive':str(archive.relative_to(ROOT)),'commitSha':sha,'screenshots':len(images),'bytes':archive.stat().st_size},indent=2))
