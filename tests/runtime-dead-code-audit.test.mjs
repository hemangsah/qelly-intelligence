import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {buildRuntimeDeadCodeAudit} from '../scripts/runtime-dead-code-audit.mjs';

test('historical runtime layers have an evidence-based reachability inventory',async()=>{
  const report=await buildRuntimeDeadCodeAudit();
  assert.ok(report.candidateCount>0);
  assert.equal(report.candidateCount,report.deletableCount+report.retainedCount);
  for(const item of report.deletable){
    assert.equal(item.referenceCounts.runtime,0,item.file);
    assert.equal(item.referenceCounts.build,0,item.file);
    assert.equal(item.referenceCounts.test,0,item.file);
    assert.equal(item.referenceCounts.workflow,0,item.file);
  }
  await mkdir(new URL('../validation/',import.meta.url),{recursive:true});
  await writeFile(new URL('../validation/RUNTIME_DEAD_CODE_AUDIT.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({
    audit:'runtime-dead-code',
    candidateCount:report.candidateCount,
    deletableCount:report.deletableCount,
    retainedCount:report.retainedCount,
    deletable:report.deletable.map(item=>item.file)
  }));
});
