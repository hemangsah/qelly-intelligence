import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const WORKFLOW='.github/workflows/qelly-all-screens-windows.yml';

test('Windows evidence retries only proven transient filesystem and loopback failures',async()=>{
  const source=await read(WORKFLOW);

  assert.match(source,/function Invoke-QellyValidationCommand/);
  assert.match(source,/\$maxAttempts = if \(\$AllowFsRetry\) \{ 3 \} else \{ 1 \}/);
  assert.match(source,/\(\?i\)\\b\(\?:EACCES\|EPERM\)\\b/);
  assert.match(source,/@\{ command = 'npm run typecheck'; retryFs = \$true \}/);
  assert.match(source,/@\{ command = 'npm run build:frontend'; retryFs = \$true \}/);
  for(const command of ['env:check','lint','validate:design','security:scan']){
    assert.match(source,new RegExp(`@\\{ command = 'npm run ${command.replace(':','\\:')}'; retryFs = \\$false \\}`));
  }
  assert.match(source,/@\{ command = 'npm test'; retryFs = \$false \}/);

  assert.match(source,/function Invoke-QellyScreenBatch/);
  assert.match(source,/\$maxAttempts = 3/);
  assert.match(source,/\$retryable = \$text -match 'net::ERR_FAILED'/);
  assert.match(source,/Invoke-QellyScreenBatch -Start \$start -End \$end -LogPath \$captureLog/);

  assert.doesNotMatch(source,/continue-on-error\s*:\s*true/);
  assert.doesNotMatch(source,/exit\s+0/);
  assert.match(source,/if \(\[int\]\$manifest\.routeCount -ne 71\)/);
  assert.match(source,/\[int\]\$manifest\.renderCount -ne 142/);
  assert.match(source,/\$pngCount -ne 142/);
  assert.match(source,/\$manifest\.failed -ne 0/);
  assert.match(source,/\$manifest\.missing\.Count -ne 0/);
});

test('Windows retry policy does not retry deterministic validation failures',async()=>{
  const source=await read(WORKFLOW);
  const validationBlock=source.slice(source.indexOf('function Invoke-QellyValidationCommand'),source.indexOf('      - name: Capture every registered route'));
  assert.match(validationBlock,/\$retryable = \$AllowFsRetry -and \(\$text -match/);
  assert.match(validationBlock,/if \(-not \$retryable -or \$attempt -ge \$maxAttempts\)/);
  assert.match(validationBlock,/throw "Validation command failed \(\$code\): \$Command"/);
  assert.doesNotMatch(validationBlock,/npm test'; retryFs = \$true/);
});

test('Windows screen retry preserves complete archive acceptance',async()=>{
  const source=await read(WORKFLOW);
  const captureBlock=source.slice(source.indexOf('function Invoke-QellyScreenBatch'),source.indexOf('      - name: Verify exact screenshot archive'));
  assert.match(captureBlock,/if \(-not \$retryable -or \$attempt -ge \$maxAttempts\)/);
  assert.match(captureBlock,/throw "Screen batch \$Start\.\.\$End failed"/);
  assert.doesNotMatch(captureBlock,/ERR_CONNECTION|ERR_ABORTED|timeout|HTTP 5/);
});