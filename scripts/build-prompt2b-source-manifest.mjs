import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const git=(args,options={})=>execFileSync('git',args,{cwd:root,encoding:options.encoding??'utf8',maxBuffer:64*1024*1024});
const exactHead=git(['rev-parse','HEAD']).trim();
const main='9cb98780893924ad26fbf4baaa9048e80a162b2c';
const changed=git(['diff','--name-only','--diff-filter=ACMR',`${main}...HEAD`]).split(/\r?\n/).filter(Boolean);
const self='project-state/QELLY_PROMPT2B_SOURCE_MANIFEST.json';
const excludedPrefixes=['validation/','dist/','.prompt2b-review/'];
const excludedExact=new Set([self]);
const include=file=>!excludedExact.has(file)&&!excludedPrefixes.some(prefix=>file.startsWith(prefix));
const paths=changed.filter(include).sort();
const classify=file=>file.startsWith('.github/workflows/')?'workflow':file.startsWith('apps/web/public/assets/routes/')?'route':file.startsWith('apps/web/public/assets/calculation/')?'numerical-source':file.startsWith('packages/schemas/')?'schema':file.startsWith('packages/migrations/')?'migration':file.startsWith('tests/')?'test':file.startsWith('scripts/')?'governance-script':file.startsWith('project-state/')?'durable-state':file.startsWith('design/figma/plugins/core/')||file.startsWith('design/')||file.startsWith('QELLY_')?'design-inventory':file.startsWith('src/')?'server-source':'repository-file';
const files=[];const aggregate=createHash('sha256');
for(const file of paths){
  const full=path.join(root,file),body=await readFile(full),info=await stat(full),gitBlobSha=git(['hash-object','-w',file]).trim(),fetched=git(['cat-file','blob',gitBlobSha],{encoding:'buffer'}),introducing=git(['log','--follow','--diff-filter=A','--format=%H','--',file]).trim().split(/\r?\n/).filter(Boolean).at(-1)??'UNAVAILABLE',latest=git(['log','-1','--format=%H','--',file]).trim()||'UNAVAILABLE',hash=createHash('sha256').update(body).digest('hex'),fetchedHash=createHash('sha256').update(fetched).digest('hex');
  const entry={path:file,category:classify(file),bytes:info.size,sha256:hash,gitBlobSha,introducingCommit:introducing,latestModifyingCommit:latest,fetchedBackBytes:fetched.length,fetchedBackSha256:fetchedHash,fetchedBackVerified:Buffer.compare(body,fetched)===0};
  if(!entry.fetchedBackVerified||entry.bytes!==entry.fetchedBackBytes||entry.sha256!==entry.fetchedBackSha256)throw new Error(`Fetched-back verification failed for ${file}`);
  files.push(entry);aggregate.update(file);aggregate.update('\0');aggregate.update(body);aggregate.update('\0');
}
const required=['apps/web/public/assets/calculation/fresh-formula-catalog.mjs','apps/web/public/assets/calculation/fresh-indicator-catalog.mjs','apps/web/public/assets/hash-route-state.mjs','apps/web/public/assets/routes/formula-detail.mjs','apps/web/public/assets/routes/indicator-detail.mjs','apps/web/public/assets/routes/calculator-detail.mjs','apps/web/public/assets/routes/saved-calculation-detail.mjs','packages/migrations/108_saved_calculation_lifecycle.sql','packages/schemas/saved-calculation-update.schema.json','packages/schemas/saved-calculation-restore.schema.json','tests/fresh-formula-catalog.test.mjs','tests/fresh-indicator-catalog.test.mjs','tests/calculation-service-parity.test.mjs','tests/hash-route-state.test.mjs','scripts/prompt2b-final-review.mjs','scripts/prompt2b-saved-action-review.mjs','scripts/build-prompt2b-final-governance.mjs','scripts/build-prompt2b-18-section-review.mjs','scripts/build-prompt2b-durable-closure-state.mjs'];
const missingRequired=required.filter(file=>!files.some(entry=>entry.path===file));if(missingRequired.length)throw new Error(`Manifest missing required files: ${missingRequired.join(', ')}`);
const categories=Object.fromEntries([...new Set(files.map(file=>file.category))].sort().map(category=>[category,files.filter(file=>file.category===category).length]));
const manifest={schemaVersion:3,repository:'hemangsah/qelly-intelligence',baseMain:main,exactHead,generatedAt:new Date().toISOString(),selection:'git diff --name-only --diff-filter=ACMR baseMain...HEAD; excludes generated validation/dist/review outputs and this manifest itself',selfExcluded:true,fileCount:files.length,allFetchedBackVerified:files.every(file=>file.fetchedBackVerified),aggregateSha256:aggregate.digest('hex'),categories,requiredFiles:{count:required.length,missing:missingRequired},files};
await writeFile(path.join(root,self),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({status:'prompt2b-source-manifest-built',exactHead,fileCount:files.length,aggregateSha256:manifest.aggregateSha256,categories,allFetchedBackVerified:manifest.allFetchedBackVerified},null,2));
