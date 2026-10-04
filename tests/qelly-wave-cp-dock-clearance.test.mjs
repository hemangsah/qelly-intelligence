import test from 'node:test';
import assert from 'node:assert/strict';
import {dockOverlapsControls} from '../apps/web/public/assets/ai/qelly-chat.mjs';
const dock={left:10,right:380,top:776,bottom:834};
test('dock yields to intersecting upload controls, but not offscreen or zero-size controls',()=>{
 assert.equal(dockOverlapsControls(dock,[{left:30,right:360,top:650,bottom:900,width:330,height:250}]),true);
 for(const box of [
  {left:30,right:360,top:850,bottom:950,width:330,height:100},
  {left:30,right:360,top:650,bottom:776,width:330,height:126},
  {left:400,right:600,top:780,bottom:820,width:200,height:40},
  {left:30,right:360,top:780,bottom:820,width:0,height:0}
 ])assert.equal(dockOverlapsControls(dock,[box]),false);
});
