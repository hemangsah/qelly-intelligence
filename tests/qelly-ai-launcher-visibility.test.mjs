import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Qelly AI launcher is excluded from generic button geometry overrides',async()=>{
  const [polish,chat]=await Promise.all([
    read('apps/web/public/assets/qelly-modern-interaction-polish.css'),
    read('apps/web/public/assets/ai/qelly-chat.css')
  ]);
  assert.match(chat,/\.q-ai-launcher\{position:fixed/);
  assert.match(polish,/button:not\(\.q-product-brand__mark\):not\(\.q-ai-launcher\)/);
  assert.match(polish,/button:not\(:disabled\):not\(\.q-ai-launcher\)/);
});

test('Qelly AI dock is the single visible terminal launcher with a concrete assistant panel target',async()=>{
  const [source,shell,css,publicRuntime,convergence]=await Promise.all([
    read('apps/web/public/assets/ai/qelly-chat.mjs'),
    read('apps/web/public/assets/qelly-production-shell.mjs'),
    read('apps/web/public/assets/qelly-production-shell.css'),
    read('apps/web/public/assets/qelly-public-runtime.mjs'),
    read('scripts/public-shell-convergence.mjs')
  ]);
  assert.match(source,/id="qelly-ai-assistant" data-q-ai-assistant/);
  assert.match(source,/root\.querySelector\('\[data-q-ai-assistant\]'\)/);
  assert.match(source,/launcher\.addEventListener\('click',[\s\S]{0,260}dockContext\.prompt[\s\S]{0,260}dockContext\.decisionContext/);
  assert.doesNotMatch(shell,/data-v8-qelly-ai|q-product-ai|Open Qelly AI assistant/);
  assert.doesNotMatch(css,/\.q-product-ai\s*\{/);
  assert.doesNotMatch(publicRuntime,/q-product-ai|data-v8-qelly-ai|data-qelly-chat-open/);
  assert.doesNotMatch(convergence,/q-product-ai|data-v8-qelly-ai|data-qelly-chat-open/);
  assert.match(source,/document\.addEventListener\('qelly:open-ai'/);
});
