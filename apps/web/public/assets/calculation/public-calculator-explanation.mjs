import {calculateFormula,getFormulaDefinition} from './formula-engine-extended.mjs';
export const MAX_PUBLIC_CALCULATOR_DRAFT=2200;
export function publicCalculatorExplanationDraft(receipt){
  if(receipt?.status!=='success')throw Error('Calculate valid inputs before preparing a Chat draft.');
  const definition=getFormulaDefinition(receipt.formulaId);
  if(!definition?.inputSchema)throw Error('Only registered local calculations can prepare this draft.');
  const inputs={};
  for(const key of Object.keys(definition.inputSchema?.properties||{}))if(Object.prototype.hasOwnProperty.call(receipt.normalizedInputs||{},key))inputs[key]=receipt.normalizedInputs[key];
  if(JSON.stringify(inputs).length>MAX_PUBLIC_CALCULATOR_DRAFT)throw Error('This receipt is too large for a Chat draft. Reduce the input series or ask about the formula without sharing its values.');
  const verified=calculateFormula(receipt.formulaId,inputs);
  if(verified.evidence?.deterministic!==true||verified.evidence?.externalProviderRequired!==false)throw Error('Only registered local calculations can prepare this draft.');
  if(verified.status!=='success'||receipt.formulaVersion!==definition.version||JSON.stringify(receipt.outputs)!==JSON.stringify(verified.outputs))throw Error('The calculation receipt changed. Calculate again before preparing a draft.');
  const snapshot={kind:'local-deterministic-calculation',formulaId:verified.formulaId,formulaVersion:verified.formulaVersion,engineVersion:verified.engineVersion,inputs:verified.normalizedInputs,outputs:verified.outputs,warnings:verified.warnings,methodology:verified.methodology,truthState:verified.truthState};
  const prompt='Explain this registered local calculator receipt and its assumptions, limits and warnings. These are my declared inputs, not market observations. Do not treat the result as a recommendation.\n'+JSON.stringify(snapshot);
  if(prompt.length>MAX_PUBLIC_CALCULATOR_DRAFT)throw Error('This receipt is too large for a Chat draft. Reduce the input series or ask about the formula without sharing its values.');
  return prompt;
}
