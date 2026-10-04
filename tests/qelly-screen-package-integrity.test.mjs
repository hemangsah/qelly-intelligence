import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,sep,basename} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {verifyScreenPackageIntegrity} from '../scripts/qelly-screen-package-integrity.mjs';
test('repackaging after accessibility updates produces valid hashes without self-reference',async()=>{
  const root=await mkdtemp(join(tmpdir(),'qelly-screen-package-test-'));
  try{
    const scripts=join(root,'scripts'),out=join(root,'preview','release-a5-all-screens');
    await mkdir(scripts,{recursive:true});await mkdir(out,{recursive:true});
    await copyFile(new URL('../scripts/release-a5-screen-package.py',import.meta.url),join(scripts,'release-a5-screen-package.py'));
    await writeFile(join(out,'manifest.json'),JSON.stringify({status:'passed',routeCount:1,renderCount:4,expectedRenderCount:4,themeCount:2,viewportCount:2,duplicateCount:0,evidenceBoundary:'synthetic packaging regression'}));
    for(const viewport of ['desktop','mobile'])for(const theme of ['dark','light'])await writeFile(join(out,`market__${viewport}__${theme}.png`),'synthetic package bytes');
    const invoke=()=>{const r=spawnSync(process.platform==='win32'?'python':'python3',[join(scripts,'release-a5-screen-package.py')],{cwd:root,env:{...process.env,QELLY_SCREEN_EVIDENCE_SHA:'0123456789012345678901234567890123456789'},encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.error?.message);};
    invoke();await writeFile(join(out,'accessibility-regression.json'),JSON.stringify({checks:288,status:'passed'}));invoke();
    const checks=JSON.parse(await readFile(join(out,'checksums.json'),'utf8'));
    assert.equal(checks.files['checksums.json'],undefined);
    assert.deepEqual(checks.excludedFiles,['checksums.json']);
    assert.ok(checks.files['accessibility-regression.json']);
    for(const [name,expected] of Object.entries(checks.files))assert.equal(createHash('sha256').update(await readFile(join(out,name))).digest('hex'),expected,name);
    await verifyScreenPackageIntegrity(out,'0123456789012345678901234567890123456789');
    await assert.rejects(verifyScreenPackageIntegrity(out,'1123456789012345678901234567890123456789'),/commit mismatch/);
    invoke();const repeated=JSON.parse(await readFile(join(out,'checksums.json'),'utf8'));assert.deepEqual(repeated,checks);
    await writeFile(join(out,'market__desktop__dark.png'),'changed synthetic package bytes');
    await assert.rejects(verifyScreenPackageIntegrity(out,'0123456789012345678901234567890123456789'),/checksum mismatch/);
  }finally{
    const absolute=resolve(root);assert.ok(absolute.startsWith(resolve(tmpdir())+sep)&&basename(absolute).startsWith('qelly-screen-package-test-'));
    await rm(absolute,{recursive:true,force:true});
  }
});
