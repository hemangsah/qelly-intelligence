import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Windows screenshot workflow forces UTF-8 and fails non-retryable capture errors',async()=>{
  const workflow=await read('.github/workflows/browser-e2e-windows.yml');
  assert.match(workflow,/PYTHONUTF8: '1'/);
  assert.match(workflow,/PYTHONIOENCODING: 'utf-8'/);
  assert.match(workflow,/python -X utf8 scripts\/release-a5-screen-batch\.py/);
  assert.match(workflow,/\$retryable = \$text -match 'net::ERR_FAILED'/);
  assert.match(workflow,/if \(-not \$retryable -or \$attempt -ge \$maxAttempts\) \{\s*throw "Screen batch \$Start\.\.\$End failed"/);
  assert.match(workflow,/\$maxAttempts = 3/);
  assert.doesNotMatch(workflow,/continue-on-error:\s*true/);
  assert.match(workflow,/windows-capture\.log/);
  assert.match(workflow,/Get-Content 'preview\/release-a5-all-screens\/manifest\.json' -Raw -Encoding utf8/);
});

test('Windows screenshot workflow preserves diagnostics even when capture fails',async()=>{
  const workflow=await read('.github/workflows/browser-e2e-windows.yml');
  assert.match(workflow,/if: always\(\)/);
  assert.match(workflow,/preview\/release-a5-all-screens/);
  assert.match(workflow,/if-no-files-found: warn/);
});
