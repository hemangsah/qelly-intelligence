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

test('Qelly AI launcher and terminal triggers have a concrete assistant panel target',async()=>{
  const [source,shell,css]=await Promise.all([
    read('apps/web/public/assets/ai/qelly-chat.mjs'),
    read('apps/web/public/assets/qelly-production-shell.mjs'),
    read('apps/web/public/assets/qelly-production-shell.css')
  ]);
  assert.match(source,/id="qelly-ai-assistant" data-q-ai-assistant/);
  assert.match(source,/root\.querySelector\('\[data-q-ai-assistant\]'\)/);
  assert.match(source,/launcher\.addEventListener\('click',\(\)=>open\(\)\)/);
  assert.match(shell,/data-v8-qelly-ai/);
  assert.match(shell,/Open Qelly AI assistant/);
  assert.match(shell,/CustomEvent\('qelly:open-ai'/);
  assert.match(css,/\.q-product-ai\s*\{/);
});
