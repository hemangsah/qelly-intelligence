export const MODEL_PROMPT_VERSION='qelly.finance-grounding/1';
export const elapsedMs=started=>Math.max(0,Math.round(performance.now()-started));
export const notAttemptedExecution=reasonCode=>({modelAttempted:false,attemptedModel:null,answerModel:null,modelAttemptDurationMs:null,timeoutMs:null,promptVersion:null,promptDigest:null,reasonCode});
export const inferenceFailure=error=>{
  const message=String(error?.message||'');
  if(/timed?\s*out|timeout/i.test(message))return {reasonCode:'model_timeout',reason:'Workers AI inference timed out'};
  if(/busy|capacity|overload|rate.limit|429/i.test(message))return {reasonCode:'model_busy',reason:'Workers AI is busy; connected evidence remains available'};
  if(/returned no answer/i.test(message))return {reasonCode:'model_empty_answer',reason:'Workers AI returned no answer'};
  return {reasonCode:'model_upstream_error',reason:'Workers AI inference was unavailable'};
};
export const modelTelemetry=(execution)=>({
  modelAttempted:execution?.modelAttempted===true,
  attemptedModel:execution?.attemptedModel??null,
  answerModel:execution?.answerModel??null,
  modelAttemptDurationMs:execution?.modelAttemptDurationMs??null,
  timeoutMs:execution?.timeoutMs??null,
  promptVersion:execution?.promptVersion??null,
  promptDigest:execution?.promptDigest??null,
  reasonCode:execution?.reasonCode??null
});
