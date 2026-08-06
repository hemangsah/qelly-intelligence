import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Windows screenshot workflow forces UTF-8 and fails on the first external command error',async()=>{
  const workflow=await read('.github/workflows/qelly-all-screens-windows.yml');
  assert.match(workflow,/PYTHONUTF8: '1'/);
  assert.match(workflow,/PYTHONIOENCODING: 'utf-8'/);
  assert.match(workflow,/python -X utf8 scripts\/release-a5-screen-batch\.py/);
  assert.match(workflow,/if \(\$LASTEXITCODE -ne 0\) \{ throw "Screen batch \$start\.\.\$end failed" \}/);
  assert.match(workflow,/windows-capture\.log/);
  assert.match(workflow,/Get-Content 'preview\/release-a5-all-screens\/manifest\.json' -Raw -Encoding utf8/);
});

test('Windows screenshot workflow preserves diagnostics even when capture fails',async()=>{
  const workflow=await read('.github/workflows/qelly-all-screens-windows.yml');
  assert.match(workflow,/if: always\(\)/);
  assert.match(workflow,/preview\/release-a5-all-screens/);
  assert.match(workflow,/if-no-files-found: warn/);
});
