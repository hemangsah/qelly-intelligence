import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('canonical app renderer owns protected-route access gating',async()=>{
  const app=await read('apps/web/public/assets/app.js');
  assert.match(app,/if\(!staticVisualPreview&&!state\.authenticated&&definition&&definition\.public!==true&&!definition\.anonymousOnly\)/);
  assert.match(app,/main\.innerHTML=protectedRouteGate\(definition\)/);
  assert.match(app,/sessionStorage\.setItem\('qelly\.returnTo',state\.route\)/);
  assert.match(app,/function protectedRouteGate\(definition\)/);
});

test('world-class framing is a decorator and the retired route guard is absent',async()=>{
  const [world,index]=await Promise.all([
    read('apps/web/public/assets/qelly-worldclass-uiux.mjs'),
    read('apps/web/public/index.html')
  ]);
  assert.match(world,/q-worldclass-context/);
  assert.match(world,/main\.prepend\(context\)/);
  assert.doesNotMatch(world,/main\.replaceChildren/);
  assert.doesNotMatch(index,/qelly-product-route-guard\.mjs/);
  await assert.rejects(access(new URL('../apps/web/public/assets/qelly-product-route-guard.mjs',import.meta.url)));
});
