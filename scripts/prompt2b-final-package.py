import hashlib,json,os,pathlib,shutil,zipfile
root=pathlib.Path('.prompt2b-review');preview=root/'compiled-preview';evidence=root/'evidence'
preview.mkdir(parents=True,exist_ok=True);evidence.mkdir(parents=True,exist_ok=True)
source=pathlib.Path('dist/frontend')
for item in source.rglob('*'):
    target=preview/item.relative_to(source)
    if item.is_dir(): target.mkdir(parents=True,exist_ok=True)
    elif item.suffix.lower() not in {'.woff','.woff2','.ttf','.otf'}: target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(item,target)
(preview/'README.md').write_text('# Qelly Prompt 2B final compiled preview\n\nExact disconnected branch-local static build covering the 70-route contract. Font binaries are excluded. Backend, external providers, trading, custody and cloud persistence are unavailable.\n')
for name in ['QELLY_PROMPT2B_SOURCE_MANIFEST.json','QELLY_PROMPT2B_FRESH_SOURCE_PROVENANCE.json','QELLY_PROMPT2B_FRESH_FORMULA_REGISTRY.csv','QELLY_PROMPT2B_FRESH_INDICATOR_REGISTRY.csv','QELLY_PROMPT2B_FIGMA_STATUS.json','QELLY_PROMPT2B_FIGMA_ROUTE_FRAME_MAP.csv','QELLY_PROMPT2B_COMPLETION_SCORECARD.md','QELLY_NEXT_PROMPT_2C.md','QELLY_PROMPT2B_HISTORICAL_EVIDENCE_CLASSIFICATION.json','QELLY_PROMPT2B_FAST_TRACK_MODE.json']:
    shutil.copy2(pathlib.Path('project-state')/name,evidence/name)
for name in ['PRODUCT_VALIDATION.json','SMOKE_LOG.json','RELEASE_A5_ACCESSIBILITY_REGRESSION.json']:
    shutil.copy2(pathlib.Path('validation')/name,evidence/name)
prohibited=[p.as_posix() for p in root.rglob('*') if p.is_file() and p.suffix.lower() in {'.woff','.woff2','.ttf','.otf'}]
if prohibited: raise SystemExit(f'font binaries prohibited: {prohibited}')
checks=[]
for file in sorted(p for p in root.rglob('*') if p.is_file() and p.name!='CHECKSUMS.json'):
    body=file.read_bytes();checks.append({'path':file.relative_to(root).as_posix(),'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()})
(root/'CHECKSUMS.json').write_text(json.dumps({'schemaVersion':3,'head':os.environ['QELLY_REVIEW_HEAD'],'fileCount':len(checks),'files':checks},indent=2)+'\n')
target=pathlib.Path('qelly-prompt2b-final-18-section-review.zip')
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for file in sorted(p for p in root.rglob('*') if p.is_file()): archive.write(file,file.relative_to(root.parent).as_posix())
with zipfile.ZipFile(target) as archive:
    bad=archive.testzip();entries=len(archive.infolist())
    if bad: raise SystemExit(f'CRC failed: {bad}')
summary=json.loads((root/'SUMMARY.json').read_text());a11y=json.loads(pathlib.Path('validation/RELEASE_A5_ACCESSIBILITY_REGRESSION.json').read_text());index=json.loads((root/'FINAL_18_SECTION_INDEX.json').read_text())
meta={'schemaVersion':3,'artifactIdentity':'qelly-prompt2b-final-18-section-review','head':os.environ['QELLY_REVIEW_HEAD'],'filename':target.name,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'entryCount':entries,'crcVerified':True,'internalChecksumCount':len(checks),'missingChecksumTargets':[],'checksumMismatches':[],'browserShards':summary['browserMatrix']['shards'],'browserRecords':summary['browserMatrix']['records'],'browserFailures':summary['browserMatrix']['failed'],'accessibilityChecks':a11y['checks'],'accessibilityFailures':a11y['failed'],'sectionCount':index['sectionCount'],'prohibitedFontBinaries':0}
pathlib.Path('qelly-prompt2b-final-18-section-review.metadata.json').write_text(json.dumps(meta,indent=2)+'\n');pathlib.Path('qelly-prompt2b-final-18-section-review.zip.sha256').write_text(meta['sha256']+'  '+target.name+'\n');print(json.dumps(meta,indent=2))
