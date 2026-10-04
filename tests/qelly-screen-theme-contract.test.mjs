import test from 'node:test';
import assert from 'node:assert/strict';
import {validateScreenThemeMatrix} from '../scripts/qelly-screen-theme-contract.mjs';
const definitions=[{route:'market'},{route:'qelly-verify'}];
const complete=()=>({status:'passed',themeCount:2,viewportCount:2,duplicateCount:0,routeCount:2,renderCount:8,expectedRenderCount:8,renders:definitions.flatMap(({route})=>['desktop','mobile'].flatMap(viewport=>['dark','light'].map(appearance=>({route,viewport,appearance,resolvedAppearance:appearance,status:'passed'}))))});
test('complete route and viewport matrix passes only with both resolved themes',()=>assert.equal(validateScreenThemeMatrix(complete(),definitions).passed,true));
for(const [name,change] of [
 ['one theme only',m=>{m.renders=m.renders.filter(r=>r.appearance==='dark');}],
 ['duplicated image replacing a missing render',m=>{m.renders[7]={...m.renders[0]};}],
 ['light capture resolved dark',m=>{m.renders[1].resolvedAppearance='dark';}],
 ['unregistered route at matching cardinality',m=>{m.renders[0].route='phantom';}],
 ['unsupported viewport at matching cardinality',m=>{m.renders[0].viewport='tablet';}],
 ['failed render in passing manifest',m=>{m.renders[0].status='failed';}],
 ['old viewport-only manifest',m=>{delete m.themeCount;}],
])test(`theme gate rejects ${name}`,()=>{const manifest=complete();change(manifest);assert.equal(validateScreenThemeMatrix(manifest,definitions).passed,false);});
