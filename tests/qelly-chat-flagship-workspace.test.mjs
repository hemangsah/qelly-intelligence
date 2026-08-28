import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__qellyChatWorkspaceTest} from '../apps/web/public/assets/routes/qelly-chat-workspace.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Qelly Chat is a dedicated flagship route with four governed modes',async()=>{
  const [app,registry,runtime,route]=await Promise.all([
    read('apps/web/public/assets/app.js'),read('apps/web/public/assets/route-registry.mjs'),read('apps/web/public/assets/qelly-public-runtime.mjs'),read('apps/web/public/assets/routes/qelly-chat-workspace.mjs')
  ]);
  assert.deepEqual(__qellyChatWorkspaceTest.MODES.map((mode)=>mode.id),['research','compare','explain','decision']);
  assert.match(app,/case 'news-research': await renderQellyChatWorkspace/);
  assert.match(registry,/route:'news-research'.*label:'Qelly Chat & Research'.*public:true/);
  assert.match(runtime,/\['Qelly Chat','news-research'\]/);
  for(const phrase of ['Ask → Ground → Verify → Decide','without fabricated fallback','Decision Provenance','human in control'])assert.match(route,new RegExp(phrase));
});

test('flagship chat requests expanded mode and preserves decision handoff',async()=>{
  const assistant=await read('apps/web/public/assets/ai/qelly-chat.mjs');
  assert.match(assistant,/event\.detail\?\.expand===true/);
  assert.match(assistant,/DECISION_DRAFT_KEY/);
  assert.match(assistant,/navigate\?\.\('decision-provenance'\)/);
});
