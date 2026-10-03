import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const file=new URL('../.github/workflows/release-evidence-handoff.yml',import.meta.url);
test('unrelated check completions cannot start or cancel screenshot evidence handoff',async()=>{
 const yaml=await readFile(file,'utf8');
 const group=/^  group: (.+)$/m.exec(yaml)?.[1]||'';
 assert.match(group,/^qelly-browser-evidence-handoff-\$\{\{ github\.event\.workflow_run\.id \}\}$/);
 assert.match(yaml,/on:\n  workflow_run:/);
 assert.doesNotMatch(yaml,/^  check_run:|^  issue_comment:/m);
 assert.match(yaml,/cancel-in-progress: true/);
 assert.match(yaml,/github\.event\.workflow_run\.event == 'pull_request'/);
 assert.match(yaml,/github\.event\.workflow_run\.name == 'Browser E2E'/);
});
