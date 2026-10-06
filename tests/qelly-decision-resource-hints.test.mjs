import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../apps/web/public/assets/qelly-prepaint-bootstrap.js',import.meta.url),'utf8');
const run=(hash,{appearance='dark',existing=[]}={})=>{
  const links=[...existing],root={dataset:{},style:{}};
  const doc={documentElement:root,title:'Initial',head:{append:l=>links.push(l)},querySelector:s=>links.find(l=>s.includes('"'+l.marker+'"')),createElement:()=>({setAttribute(_name,value){this.marker=value;}})};
  const sandbox={document:doc,window:{__QELLY_PREPAINT_ROUTE_TITLES__:{'decision-provenance':'Decision Intelligence'}},location:{hash},localStorage:{getItem:()=>JSON.stringify({appearance})},matchMedia:()=>({matches:false})};
  runInNewContext(source,sandbox);return {links,root,doc,repeat:()=>runInNewContext(source,sandbox)};
};
test('Decision prepaint hints only local CSS and route module without applying styles',()=>{
  const f=run('#/decision-provenance');assert.equal(f.links.length,2);
  assert.deepEqual(f.links.map(l=>[l.rel,l.as,l.href]),[['preload','style','./assets/qelly-decision-proven-graph.css'],['modulepreload','script','./assets/routes/decision-provenance.mjs']]);
  assert.equal(f.doc.title,'Decision Intelligence');assert.equal(f.root.dataset.prepaintRoute,'decision-provenance');
  assert.ok(f.links.every(l=>l.rel!=='stylesheet'));
});
test('all other route identities and hostile hash parameters cannot request arbitrary resources',()=>{
  for(const hash of ['#/market','#/mt5-report-analyzer','#/auth-login','#/decision-provenance-foreign','#/https://foreign.example/track','#/decision-provenance?next=https://foreign.example']){
    const f=run(hash);assert.equal(f.links.length,hash.startsWith('#/decision-provenance?')?2:0);assert.ok(f.links.every(l=>l.href.startsWith('./assets/')));
  }
});
test('repeated bootstrap creates no duplicate hints and preserves both appearances',()=>{
  for(const appearance of ['dark','light']){const f=run('#/decision-provenance',{appearance});f.repeat();assert.equal(f.links.length,2);assert.equal(f.root.dataset.appearance,appearance);}
});
