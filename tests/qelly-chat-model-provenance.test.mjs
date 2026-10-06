import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULT_QELLY_AI_MODEL,runGroundedFinanceInference,__financeIntelligenceTest} from '../functions/_lib/finance-intelligence.js';
import {onRequest} from '../functions/api/v1/intelligence/chat.js';
import {modelTelemetry} from '../functions/_lib/qelly-model-provenance.js';
const financeContext={generatedAt:'2026-10-05T00:00:00Z',observations:{hyperliquid:[{symbol:'BTC',mid:100}],worldBank:{observations:[]},ecb:{rates:null}},citations:[{id:'hyperliquid-public',truthState:'live',observedAt:'2026-10-05T00:00:00Z'}],tools:[],datasetSummary:{connected:1},policy:{fabricatedFallback:false}};
const input={message:'Explain BTC observations',financeContext};

test('accepted inference records attempted/answer model and the exact static grounding prompt digest',async()=>{
 const result=await runGroundedFinanceInference({AI:{async run(){return {response:'BTC is 100 [hyperliquid-public].'};}}},input);
 assert.equal(result.execution.modelAttempted,true);assert.equal(result.execution.attemptedModel,DEFAULT_QELLY_AI_MODEL);assert.equal(result.execution.answerModel,DEFAULT_QELLY_AI_MODEL);
 assert.equal(result.execution.promptDigest,createHash('sha256').update(__financeIntelligenceTest.systemPrompt).digest('hex'));assert.equal(result.execution.promptVersion,'qelly.finance-grounding/1');assert.equal(result.execution.timeoutMs,12000);
 assert.ok(Number.isInteger(result.execution.modelAttemptDurationMs)&&result.execution.modelAttemptDurationMs>=0);
});

test('registry/binding bypass and rejected model output never claim a model authored the returned answer',async()=>{
 const absent=await runGroundedFinanceInference({},input);assert.equal(absent.execution.modelAttempted,false);assert.equal(absent.execution.modelAttemptDurationMs,null);assert.equal(absent.execution.promptDigest,null);
 const registry=await runGroundedFinanceInference({AI:{run(){throw Error('Must not call model');}}},{...input,message:'Which data sources can Qelly access?'});assert.equal(registry.execution.reasonCode,'registry_answer');assert.equal(registry.execution.attemptedModel,null);
 const unsupported=await runGroundedFinanceInference({AI:{async run(){return {response:'BTC is 987654321 [hyperliquid-public].'};}}},input);assert.equal(unsupported.state,'grounding_validation_fallback');assert.equal(unsupported.execution.modelAttempted,true);assert.equal(unsupported.execution.answerModel,null);assert.equal(unsupported.execution.reasonCode,'unsupported_numeric_claims');
});

test('upstream errors become bounded reason codes and never disclose raw private error content',async()=>{
 for(const [message,expected] of [['busy PRIVATE_UPSTREAM_VALUE','model_busy'],['unknown PRIVATE_UPSTREAM_VALUE','model_upstream_error'],['timeout PRIVATE_UPSTREAM_VALUE','model_timeout']]){
  const result=await runGroundedFinanceInference({AI:{async run(){throw Error(message);}}},input);assert.equal(result.execution.reasonCode,expected);assert.equal(result.execution.answerModel,null);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_UPSTREAM_VALUE/);
 }
 const empty=await runGroundedFinanceInference({AI:{async run(){return {};}}},input);assert.equal(empty.execution.reasonCode,'model_empty_answer');assert.equal(empty.execution.answerModel,null);
});

test('actual response deadline returns governed fallback without claiming upstream cancellation',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let started;const modelStarted=new Promise(resolve=>started=resolve);
 const pending=runGroundedFinanceInference({AI:{run(){started();return new Promise(()=>{});}}},input);
 await modelStarted;t.mock.timers.tick(12000);const result=await pending;
 assert.equal(result.execution.reasonCode,'model_timeout');assert.equal(result.execution.timeoutMs,12000);assert.equal(result.execution.modelAttempted,true);assert.equal(result.execution.answerModel,null);assert.equal(result.state,'model_unavailable_fallback');
});

test('runtime logs phase timings and release identity without prompts, history, answers or raw upstream errors',async()=>{
 const lines=[],originalLog=console.log;console.log=value=>lines.push(value);
 let response;
 try{
  response=await onRequest({request:new Request('https://qelly.test/api/v1/intelligence/chat',{method:'POST',headers:{Origin:'https://qelly.test','Content-Type':'application/json'},body:JSON.stringify({message:'PRIVATE_QUESTION_MARKER explain BTC',history:[{role:'user',content:'PRIVATE_HISTORY_MARKER'}]})}),env:{QELLY_PUBLIC_RELEASE_SHA:'a'.repeat(40),__buildFinanceContext:async()=>financeContext,AI:{async run(){throw Error('PRIVATE_UPSTREAM_VALUE');}}}});
 }finally{console.log=originalLog;}
 const body=await response.json();assert.equal(response.status,200);assert.equal(body.inference.execution.releaseSha,'a'.repeat(40));assert.ok(Number.isInteger(body.inference.execution.evidenceBuildDurationMs));assert.equal(body.inference.execution.decisionToolsDurationMs,null);
 const row=JSON.parse(lines.find(line=>JSON.parse(line).event==='qelly_intelligence_chat'));assert.equal(row.modelAttempted,true);assert.equal(row.reasonCode,'model_upstream_error');assert.equal(row.answerModel,null);assert.equal(row.releaseSha,'a'.repeat(40));assert.equal(row.promptLogged,false);assert.equal(row.bodyLogged,false);
 assert.doesNotMatch(JSON.stringify(row),/PRIVATE_QUESTION_MARKER|PRIVATE_HISTORY_MARKER|PRIVATE_UPSTREAM_VALUE|Generative inference/);
 assert.match(body.inference.execution.timingBoundary,/not a latency SLO/);
 assert.doesNotMatch(JSON.stringify(modelTelemetry({...body.inference.execution,prompt:'PRIVATE_QUESTION_MARKER',answer:'PRIVATE_ANSWER_MARKER',rawError:'PRIVATE_UPSTREAM_VALUE'})),/PRIVATE_/);
});
