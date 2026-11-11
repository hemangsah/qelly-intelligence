import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const BASE_SHA='172eb87d5cd229a11eb751578fb26dfbe344b0db';
export const BASE_SHELL_SHA256='a4548e535a59fda0d20095ce0867ee812f4d0e2b1a284faf81c5096cb2c8153f';
export const hash=b=>createHash('sha256').update(b).digest('hex');
const once=(text,value)=>assert.equal(text.split(value).length,2,'Unique source fragment '+value.slice(0,70));
export function extractClosedDetailsFragments(baseline,candidate,edits){
 assert.equal(hash(baseline),BASE_SHELL_SHA256);let reverse=candidate;for(const {before,after} of edits.slice().reverse()){once(reverse,after);reverse=reverse.replace(after,before);}assert.equal(reverse,baseline);
 const end='\nfunction annotateRoute(){',start='function applyAccessibilityFloor(){',candidateStart='function applyAccessibilityFloor(scope=main){';for(const [text,needle] of [[baseline,start],[baseline,end],[candidate,candidateStart],[candidate,end]])once(text,needle);
 const baselineFloor=baseline.slice(baseline.indexOf(start),baseline.indexOf(end)),candidateFloor=candidate.slice(candidate.indexOf(candidateStart),candidate.indexOf(end));
 const helperStart='function isInsideClosedNativeDetailBody(element){';once(candidate,helperStart);const helper=candidate.slice(candidate.indexOf(helperStart),candidate.indexOf(candidateStart));
 const listenerStart="if(main)main.addEventListener('toggle',(event)=>{";once(candidate,listenerStart);const listener=candidate.slice(candidate.indexOf(listenerStart),candidate.indexOf('if(main)new MutationObserver',candidate.indexOf(listenerStart)));
 const inject=floor=>{const open=floor.indexOf('{')+1,close=floor.lastIndexOf('}'),a='/*CLOSED_DETAILS_MEASURE_BEGIN*/const __p=window.__QELLY_CLOSED_DETAILS_PROBE__;const __c=__p.enterFloor(arguments[0]||main);try{/*CLOSED_DETAILS_MEASURE_BODY*/',b='/*CLOSED_DETAILS_MEASURE_FINISH*/}finally{__p.exitFloor(__c);}/*CLOSED_DETAILS_MEASURE_END*/';const value=floor.slice(0,open)+a+floor.slice(open,close)+b+floor.slice(close);assert.equal(value.replace(a,'').replace(b,''),floor);return{code:value,originalSha256:hash(floor),instrumentedSha256:hash(value),reversalExact:true};};
 const old=inject(baselineFloor),next=inject(candidateFloor);
 return{baseline:{program:old.code+';\nreturn applyAccessibilityFloor;',floor:old},candidate:{program:helper+next.code+'\n'+listener+'\nreturn applyAccessibilityFloor;',floor:next},source:{baselineSha256:hash(baseline),candidateSha256:hash(candidate),reverseSha256:hash(reverse),sourceReversalExact:true,helperSha256:hash(helper),listenerSha256:hash(listener)}};
}
