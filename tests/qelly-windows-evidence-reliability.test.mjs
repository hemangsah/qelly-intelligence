import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const WORKFLOW='.github/workflows/qelly-all-screens-windows.yml';

test('Windows evidence retries only proven transient filesystem and loopback failures',async()=>{
  const source=await read(WORKFLOW);

  assert.match(source,/function Invoke-QellyNpmValidation/);
  assert.match(source,/\$PSNativeCommandUseErrorActionPreference = \$false/);
  assert.match(source,/\$maxAttempts = if \(\$AllowFsRetry\) \{ 3 \} else \{ 1 \}/);
  assert.ok(source.includes("$text -match '(?i)\\b(?:EACCES|EPERM)\\b'"));
  assert.match(source,/@\{ script = 'typecheck'; retryFs = \$true; isTest = \$false \}/);
  assert.match(source,/@\{ script = 'build:frontend'; retryFs = \$true; isTest = \$false \}/);
  for(const script of ['env:check','lint','validate:design','security:scan']){
    assert.match(source,new RegExp(`@\\{ script = '${script.replace(':','\\:')}'; retryFs = \\$false; isTest = \\$false \\}`));
  }
  assert.match(source,/@\{ script = 'test'; retryFs = \$false; isTest = \$true \}/);
  assert.match(source,/\$output = & npm\.cmd test 2>&1/);
  assert.match(source,/\$output = & npm\.cmd run \$Script 2>&1/);
  assert.doesNotMatch(source,/cmd\.exe \/d \/s \/c/);

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
  const validationBlock=source.slice(source.indexOf('function Invoke-QellyNpmValidation'),source.indexOf('      - name: Capture every registered route'));
  assert.match(validationBlock,/\$retryable = \$AllowFsRetry -and \(\$text -match/);
  assert.match(validationBlock,/if \(-not \$retryable -or \$attempt -ge \$maxAttempts\)/);
  assert.match(validationBlock,/throw "Validation command failed \(\$code\): \$label"/);
  assert.doesNotMatch(validationBlock,/script = 'test'; retryFs = \$true/);
});

test('Windows validation diagnostics survive pre-capture failure',async()=>{
  const source=await read(WORKFLOW);
  assert.match(source,/\$validationLogDir = Join-Path \$PWD 'preview\/windows-validation'/);
  assert.match(source,/Tee-Object -FilePath \$logPath -Append/);
  assert.match(source,/preview\/windows-validation/);
  assert.match(source,/if: always\(\)/);
  assert.match(source,/if-no-files-found: warn/);
});

test('Windows screen retry preserves complete archive acceptance',async()=>{
  const source=await read(WORKFLOW);
  const captureBlock=source.slice(source.indexOf('function Invoke-QellyScreenBatch'),source.indexOf('      - name: Verify exact screenshot archive'));
  assert.match(captureBlock,/if \(-not \$retryable -or \$attempt -ge \$maxAttempts\)/);
  assert.match(captureBlock,/throw "Screen batch \$Start\.\.\$End failed"/);
  assert.doesNotMatch(captureBlock,/ERR_CONNECTION|ERR_ABORTED|timeout|HTTP 5/);
});
