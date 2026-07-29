import { readFile, readdir, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root=process.cwd();
const state=path.join(root,'project-state');
const out=path.join(root,'.prompt2a-final','13-tests');
await mkdir(out,{recursive:true});
const required=[
'PROMPT2A_LIVE_STARTING_STATE.json','QELLY_PROJECT_STATE.md','QELLY_CURRENT_HANDOFF.md','QELLY_DECISION_LOG.md','QELLY_PROGRESS_LEDGER.md','QELLY_RELEASE_MATRIX.md','QELLY_PROMPT2A_AUDIT_REPORT.md','QELLY_MASTER_FEATURE_UNIVERSE.csv','QELLY_FEATURE_GAP_MATRIX.csv','QELLY_FEATURE_STATUS.csv','QELLY_ROUTE_STATUS.csv','QELLY_SCREEN_INVENTORY.csv','QELLY_FRONTEND_ACTION_INVENTORY.csv','QELLY_COMPONENT_INVENTORY.csv','QELLY_BACKEND_SERVICE_INVENTORY.csv','QELLY_API_INVENTORY.csv','QELLY_DATABASE_ENTITY_INVENTORY.csv','QELLY_EVENT_WORKER_INVENTORY.csv','QELLY_PROVIDER_REGISTRY.csv','QELLY_PUBLIC_API_CONFORMANCE.csv','QELLY_EMBED_REGISTRY.csv','QELLY_REDIRECT_REGISTRY.csv','QELLY_DATA_LICENSE_REGISTER.csv','QELLY_EXTERNAL_DEPENDENCY_REGISTER.csv','QELLY_FORMULA_CATALOG.csv','QELLY_TEST_COVERAGE_MATRIX.csv','QELLY_SECURITY_RISK_REGISTER.csv','QELLY_DEPENDENCY_GRAPH.json','QELLY_IMPLEMENTATION_WAVES.md','QELLY_RELEASE_BLOCKERS.md','QELLY_RELEASE_BLOCKERS.csv','QELLY_KNOWN_LIMITATIONS.md','QELLY_PROMPT2B_STARTING_STATE.md','QELLY_NEXT_PROMPT_2B.md','QELLY_IMPLEMENTATION_MANIFEST.json','QELLY_REQUESTED_FEATURE_STATUS.csv','QELLY_PROVIDER_EVIDENCE.md','QELLY_DATA_SOURCE_REGISTRY.md','QELLY_YAHOO_UNOFFICIAL_API_AUDIT.md','QELLY_REPOSITORY_INVENTORY.csv','QELLY_VALIDATION_HISTORY.md'];
const canonical=new Set(['IMPLEMENTED_CONNECTED','IMPLEMENTED_DETERMINISTIC_LOCAL','IMPLEMENTED_EMBEDDED','PARTIAL','PROTOTYPE','MOCK','SIMULATED','ESTIMATED','DELAYED','CACHED','STALE','UNAVAILABLE','REQUIRES_AUTHORIZATION','REQUIRES_LICENSE','BLOCKED_INFRASTRUCTURE','BLOCKED_SECURITY','BLOCKED_REGULATION','BLOCKED_PROVIDER_TERMS','PLANNED','DEFERRED','DEPRECATED']);
const routeStatuses=new Set(['WORKING_CONNECTED','WORKING_LOCAL','WORKING_EMBED','PARTIAL','MOCK','STATIC_DEMO','BROKEN','UNREACHABLE','EMPTY','DUPLICATE','DEPRECATED','PLANNED']);
function parseCsv(text){const rows=[];let row=[],field='',quote=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(quote){if(c==='"'&&n==='"'){field+='"';i++;}else if(c==='"')quote=false;else field+=c;}else if(c==='"')quote=true;else if(c===','){row.push(field);field='';}else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}else field+=c;}if(field||row.length){row.push(field);rows.push(row);}const headers=rows.shift()||[];return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));}
const sha=b=>createHash('sha256').update(b).digest('hex');
const failures=[],warnings=[],metrics={},files=[];
for(const name of required){const p=path.join(state,name);try{const b=await readFile(p);files.push({path:`project-state/${name}`,bytes:b.length,sha256:sha(b)});}catch{failures.push(`missing:${name}`);}}
async function csv(name,idColumn,statusColumn,allowed,expected){const rows=parseCsv(await readFile(path.join(state,name),'utf8'));metrics[name]=rows.length;const ids=new Set();for(const r of rows){const id=(r[idColumn]||'').trim();if(!id)failures.push(`${name}:blank-${idColumn}`);else if(ids.has(id))failures.push(`${name}:duplicate:${id}`);else ids.add(id);if(statusColumn&&r[statusColumn]&&!allowed.has(r[statusColumn]))failures.push(`${name}:invalid-${statusColumn}:${r[statusColumn]}:${id}`);}if(expected!==undefined&&rows.length!==expected)failures.push(`${name}:count:${rows.length}:expected:${expected}`);return rows;}
const master=await csv('QELLY_MASTER_FEATURE_UNIVERSE.csv','feature_id','status',canonical,545);
const features=await csv('QELLY_FEATURE_STATUS.csv','feature_id','status',canonical,41);
const routes=await csv('QELLY_ROUTE_STATUS.csv','route_id','status',routeStatuses,61);
const providers=await csv('QELLY_PROVIDER_REGISTRY.csv','provider_id','implementation_status',canonical,28);
const apis=await csv('QELLY_API_INVENTORY.csv','api_id',null,canonical,187);
await csv('QELLY_EMBED_REGISTRY.csv','embed_id','status',canonical,1);
await csv('QELLY_FORMULA_CATALOG.csv','formula_id',null,canonical,188);
await csv('QELLY_SCREEN_INVENTORY.csv','screen_id','status',routeStatuses,61);
await csv('QELLY_FRONTEND_ACTION_INVENTORY.csv','action_id',null,canonical,433);
await csv('QELLY_COMPONENT_INVENTORY.csv','component_id','status',new Set(['COMPLETE','PARTIAL','CONTRACT_ONLY','MOCK_ONLY','DISABLED','BROKEN','UNTESTED','DEPRECATED']),40);
await csv('QELLY_BACKEND_SERVICE_INVENTORY.csv','service_id','status',new Set(['COMPLETE','PARTIAL','CONTRACT_ONLY','MOCK_ONLY','DISABLED','BROKEN','UNTESTED','INFRASTRUCTURE_BLOCKED','PROVIDER_BLOCKED','DEPRECATED']),73);
await csv('QELLY_DATABASE_ENTITY_INVENTORY.csv','entity_id',null,canonical,28);
await csv('QELLY_EVENT_WORKER_INVENTORY.csv','event_worker_id','status',canonical,22);
await csv('QELLY_TEST_COVERAGE_MATRIX.csv','subject_id','status',canonical,69);
await csv('QELLY_SECURITY_RISK_REGISTER.csv','risk_id',null,canonical,11);
const requested=await csv('QELLY_REQUESTED_FEATURE_STATUS.csv','feature_id','status',canonical,21);
await csv('QELLY_REDIRECT_REGISTRY.csv','redirect_id',null,canonical,2);
for(const f of ['PROMPT2A_LIVE_STARTING_STATE.json','QELLY_DEPENDENCY_GRAPH.json','QELLY_IMPLEMENTATION_MANIFEST.json']){try{JSON.parse(await readFile(path.join(state,f),'utf8'));}catch(e){failures.push(`${f}:invalid-json:${e.message}`);}}
const knownFeatureIds=new Set([...master,...requested].map(row=>row.feature_id));if(!features.every(f=>knownFeatureIds.has(f.feature_id)))failures.push('feature-summary-id-not-reconciled');
const incompleteProviders=providers.filter(p=>!p.documentation_url||!p.terms_url||!p.recommended_action).map(p=>p.provider_id);if(incompleteProviders.length)warnings.push(`provider-registry-incomplete-fields:${incompleteProviders.length}:${incompleteProviders.join('|')}`);
const nextPrompt=await readFile(path.join(state,'QELLY_NEXT_PROMPT_2B.md'),'utf8');if(!nextPrompt.includes('feature/calculator-and-indicator-foundation'))failures.push('prompt2b-branch-mismatch');
for(const temp of ['audit-input','.github/workflows/prompt2a-persist-generated-audit.yml']){try{await access(path.join(root,temp));failures.push(`temporary-installer-remains:${temp}`);}catch{}}
const sourceFiles=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){if(['.git','node_modules','dist','.prompt2a-final','.prompt2a-bootstrap'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile())sourceFiles.push(p);}}for(const dir of ['apps','src','packages','config']){try{await walk(path.join(root,dir));}catch{}}sourceFiles.push(path.join(root,'package.json'),path.join(root,'package-lock.json'));
const yahooPatterns=[/query1\.finance\.yahoo\.com/i,/query2\.finance\.yahoo\.com/i,/"yahoo-finance(?:2)?"/i,/crumb[^\n]{0,80}cookie/i];for(const p of sourceFiles){let t;try{t=await readFile(p,'utf8');}catch{continue;}for(const re of yahooPatterns)if(re.test(t))failures.push(`unofficial-yahoo-dependency:${path.relative(root,p)}`);}
const flags=JSON.parse(await readFile(path.join(root,'config','public-beta.feature-flags.json'),'utf8'));for(const k of ['realMoneyTrading','custody','depositsWithdrawals'])if(flags.flags?.[k]?.state!=='hard-disabled')failures.push(`safety-flag-not-hard-disabled:${k}`);
const runtime=await readFile(path.join(root,'src','public-beta','runtime-config.mjs'),'utf8');for(const k of ['privateKeyStorage','seedPhraseCollection','autonomousExecution'])if(!runtime.includes(k)||!new RegExp(`${k}: false`).test(runtime))failures.push(`runtime-safety-invariant-missing:${k}`);
const report={schemaVersion:1,generatedAt:new Date().toISOString(),head:process.env.QELLY_AUDIT_HEAD||'local',result:failures.length?'failed':'passed',metrics:{...metrics,masterFeatures:master.length,summaryFeatures:features.length,requestedFeatureAggregates:requested.length,routes:routes.length,providers:providers.length,providersWithIncompleteFields:incompleteProviders.length,apis:apis.length},failures,warnings,files};await writeFile(path.join(out,'AUDIT_OUTPUT_VALIDATION.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(failures.length)process.exit(1);
