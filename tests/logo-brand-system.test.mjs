import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('official Qelly logo vectors are safe and governed',async()=>{
 const files=['qelly-logo-primary.svg','qelly-logo-dark.svg','qelly-logo-light.svg','qelly-symbol.svg','qelly-symbol-small.svg'];
 for(const name of files){
  const source=await readFile(new URL(`../apps/web/public/assets/brand/${name}`,import.meta.url),'utf8');
  assert.match(source,/<svg/);assert.match(source,/viewBox=/);assert.doesNotMatch(source,/<script|on\w+\s*=|(?:href|src)\s*=\s*[\"']https?:\/\/|foreignObject/i);
  assert.match(source,/Qelly/i);
 }
});
test('brand runtime is session-aware and reduced-motion safe',async()=>{
 const source=await readFile(new URL('../apps/web/public/assets/qelly-brand.mjs',import.meta.url),'utf8');
 assert.match(source,/sessionStorage/);assert.match(source,/prefers-reduced-motion/);assert.match(source,/qelly\.brand\.opening\.v1/);assert.match(source,/data-qelly-brand-hero/);
});
test('PWA assets and IBM Plex lock are preserved',async()=>{
 const index=await readFile(new URL('../apps/web/public/index.html',import.meta.url),'utf8');
 const manifest=JSON.parse(await readFile(new URL('../apps/web/public/manifest.webmanifest',import.meta.url),'utf8'));
 assert.match(index,/ibm-plex-sans-variable\.woff2/);assert.match(index,/qelly-brand\.css/);assert.match(index,/qelly-brand\.mjs/);
 assert.ok(manifest.icons.some((item)=>item.purpose==='maskable'));
});
