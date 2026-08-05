import {readFile} from 'node:fs/promises';
const stage=process.argv[2]??'matrix';
const head=process.env.QELLY_REVIEW_HEAD;
const browser=JSON.parse(await readFile('.prompt2b-review/SUMMARY.json','utf8'));
const a11y=JSON.parse(await readFile('validation/RELEASE_A5_ACCESSIBILITY_REGRESSION.json','utf8'));
const historical=JSON.parse(await readFile('project-state/QELLY_PROMPT2B_HISTORICAL_EVIDENCE_CLASSIFICATION.json','utf8'));
let ok=browser.head===head&&browser.mode==='acceptance'&&browser.browserMatrix.shards===27&&browser.browserMatrix.records===1944&&browser.browserMatrix.failed===0&&browser.performance.failures.length===0&&browser.themeDifferentiation.failures.length===0&&browser.counterReconciliation.denominatorMatched&&a11y.head===head&&a11y.mode==='acceptance'&&a11y.routeCount===27&&a11y.checks===54&&a11y.failed===0&&a11y.counterReconciliation.denominatorMatched&&historical.historicalEvidence.status==='HISTORICAL_AGGREGATE_ONLY';
const result={stage,head,browser:browser.browserMatrix,a11y:{routes:a11y.routeCount,checks:a11y.checks,failed:a11y.failed},historical:historical.historicalEvidence.status};
if(stage==='final'){
 const actions=JSON.parse(await readFile('.prompt2b-review/SAVED_CALCULATION_ACTION_REVIEW.json','utf8'));
 const index=JSON.parse(await readFile('.prompt2b-review/FINAL_18_SECTION_INDEX.json','utf8'));
 ok=ok&&actions.status==='passed'&&index.sectionCount===18&&index.allPrerequisitesPassed;
 Object.assign(result,{actions:actions.status,sections:index.sectionCount,allPrerequisitesPassed:index.allPrerequisitesPassed});
}
console.log(JSON.stringify(result,null,2));
if(!ok)process.exit(1);
