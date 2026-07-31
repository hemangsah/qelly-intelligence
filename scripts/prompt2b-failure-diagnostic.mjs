import { readFile, writeFile } from 'node:fs/promises';

const canonicalPath = new URL('./prompt2b-final-review.mjs', import.meta.url);
const instrumentedPath = new URL('./.prompt2b-final-review.instrumented.mjs', import.meta.url);
let source = await readFile(canonicalPath, 'utf8');

const replaceExactlyOnce = (needle, replacement, label) => {
  const matches = source.split(needle).length - 1;
  if (matches !== 1) throw new Error(`${label}: expected exactly one source match, received ${matches}`);
  source = source.replace(needle, replacement);
};

replaceExactlyOnce(
  "import { mkdir, readFile, writeFile } from 'node:fs/promises';",
  "import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';",
  'fs import instrumentation'
);
replaceExactlyOnce(
  "const progressPath=path.join(output,'PROGRESS.json');\n",
  "const progressPath=path.join(output,'PROGRESS.json');\nconst diagnosticRecordsPath=path.join(output,'DIAGNOSTIC_RECORDS.ndjson');\nconst diagnosticFailuresPath=path.join(output,'DIAGNOSTIC_FAILURES.ndjson');\nawait writeFile(diagnosticRecordsPath,'');\nawait writeFile(diagnosticFailuresPath,'');\n",
  'diagnostic output initialization'
);
replaceExactlyOnce(
  "records.push(record);if(reasons.length)failures.push({...record,reasons});if(shouldCapture",
  "records.push(record);if(reasons.length)failures.push({...record,reasons});await appendFile(diagnosticRecordsPath,JSON.stringify({...record,reasons})+'\\n');if(reasons.length)await appendFile(diagnosticFailuresPath,JSON.stringify({...record,reasons})+'\\n');if(shouldCapture",
  'record persistence instrumentation'
);

await writeFile(instrumentedPath, source);
await import(`${instrumentedPath.href}?audit=${Date.now()}`);
