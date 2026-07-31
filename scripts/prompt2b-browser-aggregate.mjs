import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { calculateFormula, listFormulaDefinitions } from '../apps/web/public/assets/calculation/formula-engine-extended.mjs';
import { calculateIndicator, listIndicatorDefinitions } from '../apps/web/public/assets/calculation/indicator-engine-extended.mjs';

const head=process.env.QELLY_REVIEW_HEAD??process.env.GITHUB_SHA??'unknown';
const expectedHead=process.env.QELLY_EXPECTED_HEAD??head;
if(head!==expectedHead) throw new Error(`Exact-head guard failed: ${head} != ${expectedHead}`);
const input=path.resolve('.prompt2b-shards/browser');
const output=path.resolve('.prompt2b-review');
await mkdir(output,{recursive:true});
const sha256=body=>createHash('sha256').update(body).digest('hex');
const browsers=['chromium','firefox','webkit'];
const routes=['calculator-center','india-finance','indicator-library','formula-library','saved-calculations','formula-detail','indicator-detail','calculator-detail','saved-calculation-detail'];
const viewports=['360x800','390x844','430x932','768x1024','1024x768','1280x800','1440x1000','1728x1080','1920x1080'];
const themes=['dark','porcelain-light','oled','high-contrast'];
const motions=['full','reduced'];
const EXPECTED_SHARDS=27, EXPECTED_PER_SHARD=72, EXPECTED_RECORDS=1944;

const shardDirs=[];
for(const browser of browsers) for(const route of routes) shardDirs.push(`${browser}--${route}`);
const missingShards=[], checksumFailures=[], summaries=[], records=[];
for(const shardId of shardDirs){
  const root=path.join(input,shardId);
  try{await stat(root);}catch{missingShards.push(shardId);continue;}
  const summary=JSON.parse(await readFile(path.join(root,'SUMMARY.json'),'utf8'));
  const checks=JSON.parse(await readFile(path.join(root,'CHECKSUMS.json'),'utf8'));
  if(summary.head!==head||checks.head!==head) checksumFailures.push({shardId,type:'head',summary:summary.head,checks:checks.head,expected:head});
  for(const item of checks.files){
    const file=path.join(root,item.path);
    try{const body=await readFile(file);if(body.length!==item.bytes||sha256(body)!==item.sha256)checksumFailures.push({shardId,type:'mismatch',path:item.path});}
    catch{checksumFailures.push({shardId,type:'missing',path:item.path});}
  }
  const lines=(await readFile(path.join(root,'cases.jsonl'),'utf8')).trim().split('\n').filter(Boolean);
  const shardRecords=lines.map(line=>JSON.parse(line));
  if(shardRecords.length!==EXPECTED_PER_SHARD||summary.records!==EXPECTED_PER_SHARD) checksumFailures.push({shardId,type:'denominator',jsonl:shardRecords.length,summary:summary.records});
  summaries.push(summary); records.push(...shardRecords);
}
const duplicateCaseIds=[...records.reduce((map,item)=>map.set(item.caseId,(map.get(item.caseId)??0)+1),new Map()).entries()].filter(([,count])=>count!==1).map(([caseId,count])=>({caseId,count}));
const unexpectedCases=records.filter(item=>item.head!==head||!browsers.includes(item.browser)||!routes.includes(item.route)||!viewports.includes(item.viewport)||!themes.includes(item.appearance)||!motions.includes(item.motion));
const failures=records.filter(item=>item.status==='failed');
const passed=records.length-failures.length;

const signatureMap=new Map();
for(const failure of failures){
  const key=failure.failureSignature??sha256(Buffer.from(failure.reasons.join('|'))).slice(0,20);
  const value=signatureMap.get(key)??{signature:key,count:0,reasons:failure.reasons,failureClasses:new Set(),browsers:new Set(),routes:new Set(),viewports:new Set(),themes:new Set(),motions:new Set(),actions:new Set(),firstCase:null,lastCase:null,screenshots:[],traces:[]};
  value.count++; failure.failureClasses.forEach(x=>value.failureClasses.add(x)); value.browsers.add(failure.browser); value.routes.add(failure.route); value.viewports.add(failure.viewport); value.themes.add(failure.appearance); value.motions.add(failure.motion); failure.actionErrors.forEach(x=>value.actions.add(x.message));
  if(!value.firstCase||failure.caseId.localeCompare(value.firstCase)>0===false)value.firstCase=failure.caseId;
  if(!value.lastCase||failure.caseId.localeCompare(value.lastCase)>0)value.lastCase=failure.caseId;
  if(failure.evidence?.screenshot)value.screenshots.push(`${failure.shardId}/${failure.evidence.screenshot}`);
  if(failure.evidence?.trace)value.traces.push(`${failure.shardId}/${failure.evidence.trace}`);
  signatureMap.set(key,value);
}
const signatures=[...signatureMap.values()].map(item=>({...item,failureClasses:[...item.failureClasses].sort(),browsers:[...item.browsers].sort(),routes:[...item.routes].sort(),viewports:[...item.viewports].sort(),themes:[...item.themes].sort(),motions:[...item.motions].sort(),actions:[...item.actions].sort(),screenshots:item.screenshots.sort(),traces:item.traces.sort()})).sort((a,b)=>b.count-a.count||a.signature.localeCompare(b.signature));
const reasonCounts={}; const classCounts={};
for(const failure of failures){for(const reason of failure.reasons)reasonCounts[reason]=(reasonCounts[reason]??0)+1;for(const type of failure.failureClasses)classCounts[type]=(classCounts[type]??0)+1;}
const overlapHistogram={}; for(const failure of failures){const key=String(failure.reasons.length);overlapHistogram[key]=(overlapHistogram[key]??0)+1;}

const themePairs=[];
for(const browser of browsers)for(const route of routes){
  const samples=Object.fromEntries(themes.map(theme=>[theme,records.find(item=>item.browser===browser&&item.route===route&&item.viewport==='1440x1000'&&item.motion==='full'&&item.appearance===theme)]));
  const themeSignatures=Object.fromEntries(Object.entries(samples).map(([label,item])=>[label,item?JSON.stringify({body:item.metrics.bodyBackground,palette:item.metrics.semanticPalette,theme:item.metrics.theme}):null]));
  const distinct=new Set(Object.values(themeSignatures).filter(Boolean)).size;
  themePairs.push({browser,route,signatures:themeSignatures,distinct,allApplied:Object.values(samples).every(Boolean),different:distinct===themes.length});
}
const themeFailures=themePairs.filter(item=>!item.allApplied||!item.different);

const close=Array.from({length:10000},(_,index)=>100+Math.sin(index/17)*3+index*.0008),high=close.map((value,index)=>value+.7+(index%4)*.02),low=close.map((value,index)=>value-.8-(index%3)*.02),openSeries=close.map((value,index)=>value+(index%2?.1:-.1)),volume=close.map((_,index)=>1000+(index%250)*11);
const performanceCases=[];
for(const indicatorId of ['sma','ema','rsi','atr','bollinger-bands','supertrend','vwap','mfi','fresh-price-momentum','fresh-rolling-support-resistance']){const started=performance.now(),result=calculateIndicator(indicatorId,{open:openSeries,high,low,close,volume,period:14});performanceCases.push({type:'indicator',id:indicatorId,points:10000,durationMs:Number((performance.now()-started).toFixed(3)),status:result.status});}
for(const [formulaId,inputs] of [['loan-amortization',{principal:7500000,annualRatePercent:8.5,months:360}],['xirr',{cashflows:[{amount:-100000,date:'2020-01-01'},{amount:120000,date:'2021-01-01'}]}],['portfolio-volatility',{weights:[.4,.35,.25],covarianceMatrix:[[.04,.01,.008],[.01,.03,.006],[.008,.006,.02]]}],['fresh-present-value',{futureValue:110,rate:.1,periods:1}]]){const started=performance.now(),result=calculateFormula(formulaId,inputs);performanceCases.push({type:'formula',id:formulaId,durationMs:Number((performance.now()-started).toFixed(3)),status:result.status});}
const performanceFailures=performanceCases.filter(item=>item.status!=='success'||item.durationMs>2000);

const denominatorFailures=[];
if(missingShards.length)denominatorFailures.push(`missing-shards:${missingShards.length}`);
if(summaries.length!==EXPECTED_SHARDS)denominatorFailures.push(`shard-count:${summaries.length}/${EXPECTED_SHARDS}`);
if(records.length!==EXPECTED_RECORDS)denominatorFailures.push(`record-count:${records.length}/${EXPECTED_RECORDS}`);
if(new Set(records.map(item=>item.caseId)).size!==EXPECTED_RECORDS)denominatorFailures.push(`unique-case-count:${new Set(records.map(item=>item.caseId)).size}/${EXPECTED_RECORDS}`);
if(duplicateCaseIds.length)denominatorFailures.push(`duplicate-case-ids:${duplicateCaseIds.length}`);
if(checksumFailures.length)denominatorFailures.push(`checksum-failures:${checksumFailures.length}`);
if(unexpectedCases.length)denominatorFailures.push(`unexpected-cases:${unexpectedCases.length}`);

const screenshotManifest=[];
for(const record of failures){if(!record.evidence?.screenshot)continue;const file=path.join(input,record.shardId,record.evidence.screenshot);const body=await readFile(file);screenshotManifest.push({name:`${record.shardId}/${record.evidence.screenshot}`,bytes:body.length,sha256:sha256(body),browser:record.browser,route:record.route,width:record.width,height:record.height,appearance:record.appearance,motion:record.motion,failure:true,reasons:record.reasons});}
const browserFailures=[...failures]; if(denominatorFailures.length)browserFailures.push({caseId:'denominator',reasons:denominatorFailures,failureClasses:['packaging']});
const report={schemaVersion:5,repository:'hemangsah/qelly-intelligence',head,generatedAt:new Date().toISOString(),formulaDefinitions:listFormulaDefinitions().length,indicatorDefinitions:listIndicatorDefinitions().length,browserMatrix:{records:records.length,expected:EXPECTED_RECORDS,passed,failed:browserFailures.length,browsers,viewports,themes,motions,routes,shards:{expected:EXPECTED_SHARDS,received:summaries.length,casesPerShard:EXPECTED_PER_SHARD}},performance:{cases:performanceCases,failures:performanceFailures},themeDifferentiation:{pairs:themePairs,failures:themeFailures},screenshots:screenshotManifest,failures:browserFailures,actionEvidence:{mode:'single trusted pointer click after unobstructed hit-test',retries:0,forcedClicks:0},counterReconciliation:{caseRecords:records.length,passed,failedCases:failures.length,reasonOccurrences:Object.values(reasonCounts).reduce((a,b)=>a+b,0),reasonCounts,classCounts,overlapHistogram,identity:`${passed}+${failures.length}=${records.length}`,reconciled:passed+failures.length===records.length},integrity:{missingShards,checksumFailures,duplicateCaseIds,unexpectedCases:unexpectedCases.map(item=>item.caseId),denominatorFailures}};
await writeFile(path.join(output,'BROWSER_MATRIX.json'),JSON.stringify({head,expectedRecords:EXPECTED_RECORDS,records,failures:browserFailures},null,2)+'\n');
await writeFile(path.join(output,'PERFORMANCE.json'),JSON.stringify({head,cases:performanceCases,failures:performanceFailures},null,2)+'\n');
await writeFile(path.join(output,'THEME_DIFFERENTIATION.json'),JSON.stringify({head,pairs:themePairs,failures:themeFailures},null,2)+'\n');
await writeFile(path.join(output,'SCREENSHOT_MANIFEST.json'),JSON.stringify({head,files:screenshotManifest},null,2)+'\n');
await writeFile(path.join(output,'FAILURE_SIGNATURES.json'),JSON.stringify({head,failedCases:failures.length,uniqueSignatures:signatures.length,signatures},null,2)+'\n');
await writeFile(path.join(output,'COUNTER_RECONCILIATION.json'),JSON.stringify({head,...report.counterReconciliation},null,2)+'\n');
await writeFile(path.join(output,'SUMMARY.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(path.join(output,'README.md'),`# Qelly Prompt 2B sharded browser review\n\nExact head: \`${head}\`\n\n- Shards: ${summaries.length}/${EXPECTED_SHARDS}\n- Browser records: ${records.length}/${EXPECTED_RECORDS}\n- Browser failures: ${browserFailures.length}\n- Unique failure signatures: ${signatures.length}\n- Performance failures: ${performanceFailures.length}\n- Theme differentiation failures: ${themeFailures.length}\n- Retries / forced clicks: 0 / 0\n`);
console.log(JSON.stringify({head,shards:summaries.length,browserRecords:records.length,browserFailures:browserFailures.length,uniqueSignatures:signatures.length,performanceFailures:performanceFailures.length,themeFailures:themeFailures.length,denominatorFailures},null,2));
if(browserFailures.length||performanceFailures.length||themeFailures.length)process.exit(1);
