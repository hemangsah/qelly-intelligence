import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__qellyChatWorkspaceTest} from '../apps/web/public/assets/routes/qelly-chat-workspace.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Qelly Chat is a dedicated flagship route with eight grounded workflows',async()=>{
  const [app,registry,runtime,route]=await Promise.all([
    read('apps/web/public/assets/app.js'),read('apps/web/public/assets/route-registry.mjs'),read('apps/web/public/assets/qelly-public-runtime.mjs'),read('apps/web/public/assets/routes/qelly-chat-workspace.mjs')
  ]);
  assert.deepEqual(__qellyChatWorkspaceTest.MODES.map((mode)=>mode.id),['ask','research','compare','explain','calculate','decision','asset','india']);
  assert.match(app,/case 'news-research': await renderQellyChatWorkspace/);
  assert.match(registry,/route:'news-research'.*label:'Qelly Chat & Research'.*public:true/);
  assert.match(runtime,/\['Qelly Chat','news-research'\]/);
  for(const phrase of ['Ask → Tool → Ground → Verify → Decide','bounded read-only tools','Decision Intelligence','human in control','Source list updated','Source status','Research engine','Connected sources','Tool modes'])assert.match(route,new RegExp(phrase));
  assert.doesNotMatch(route,/Answer runtime|governed datasets|Connected datasets|Decision Provenance|Evidence registry|Access catalog generated|not provider freshness|Access catalog timestamp|Source-state policy|Decision Command Center/);
});

test('flagship chat requests expanded mode and preserves decision handoff',async()=>{
  const assistant=await read('apps/web/public/assets/ai/qelly-chat.mjs');
  assert.match(assistant,/event\.detail\?\.expand===true/);
  assert.match(assistant,/DECISION_DRAFT_KEY/);
  assert.match(assistant,/navigate\?\.\('decision-provenance'\)/);
});


test('global chat drawer exposes grounded context and reliability controls',async()=>{
  const [assistant,css,endpoint]=await Promise.all([read('apps/web/public/assets/ai/qelly-chat.mjs'),read('apps/web/public/assets/ai/qelly-chat.css'),read('functions/api/v1/intelligence/chat.js')]);
  for(const phrase of ['data-q-ai-asset','data-q-ai-timeframe','data-q-ai-calculator','data-q-ai-copy-sources','data-q-ai-stop','data-q-ai-retry','QELLY tool receipts','unvalidated streaming disabled','qelly.decision.chat-context.v1','freshness'])assert.match(assistant,new RegExp(phrase));
  assert.match(assistant,/new AbortController\(\)/);
  assert.match(assistant,/activeController\?\.abort\(\)/);
  assert.match(assistant,/Generation cancelled\. No partial or unvalidated answer was accepted\./);
  assert.match(css,/\.q-ai-contextbar/);
  assert.match(css,/\.q-ai-message-tools-used/);
  assert.match(css,/\.q-ai-followups/);
  assert.match(endpoint,/unvalidatedStreaming:false/);
  assert.doesNotMatch(assistant,/EventSource|ReadableStream|getReader\(\)/);
});
