import test from 'node:test';import assert from 'node:assert/strict';import {routeIdentityFor} from '../apps/web/public/assets/route-registry.mjs';
const previous=globalThis.window;globalThis.window={__QELLY_CONFIG__:{staticVisualPreview:false}};
const recovery=await import('../apps/web/public/assets/qelly-public-recovery.mjs');
if(previous===undefined)delete globalThis.window;else globalThis.window=previous;
test('all eight public failure states keep canonical product names and an escaped, scoped retry',()=>{
 assert.equal(recovery.PUBLIC_RECOVERY_ROUTES.length,8);
 for(const route of recovery.PUBLIC_RECOVERY_ROUTES){const label=routeIdentityFor(route).label,html=recovery.publicRecoveryMarkup(route,'<img src=x onerror=alert(1)>'),expected=['market','asset-rankings'].includes(route)?label+' unavailable':label;
  assert.equal(html.match(/<h1>(.*?)<\/h1>/)[1],expected);assert.doesNotMatch(html,/Market Command|Decision Provenance/);assert.equal((html.match(/data-qelly-recovery-retry/g)||[]).length,1);assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('No substitute'));assert.ok(html.includes('Read-only decision support'));assert.ok(recovery.publicRecoveryMarkup(route,'',{preview:true}).includes('Static visual preview'));
  let callback,prevented=0,retries=0;recovery.bindPublicRecoveryActions({querySelector:selector=>{assert.equal(selector,'[data-qelly-recovery-retry]');return{addEventListener:(type,cb)=>{assert.equal(type,'click');callback=cb;}};}},{route,retry:()=>retries++});assert.equal(typeof callback,'function');callback({preventDefault:()=>prevented++});assert.equal(prevented,1);assert.equal(retries,1);
 }
 let queried=false;recovery.bindPublicRecoveryActions({querySelector:()=>{queried=true;}},{route:'unsupported-ui-audit'});assert.equal(queried,false);
});
