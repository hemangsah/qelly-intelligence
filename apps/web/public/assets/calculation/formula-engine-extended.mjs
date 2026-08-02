import {FormulaError,calculateFormula as calculateFoundationFormula,listFormulaDefinitions as listFoundationFormulaDefinitions,getFormulaDefinition as getFoundationFormulaDefinition,formulaEngineMetadata as foundationMetadata} from './formula-engine.mjs';
import {calculateFreshFormula,listFreshFormulaDefinitions,getFreshFormulaDefinition,isFreshFormula,freshFormulaEngineMetadata} from './fresh-formula-catalog.mjs';
import {inputContractFor} from './formula-input-contracts.mjs';

export {FormulaError};
const enrichDefinition=(definition)=>{
  const contract=inputContractFor(definition);
  return {
    ...definition,
    inputSchema:contract.schema,
    referenceVector:definition.referenceVector??{inputs:contract.example},
    presentationContractVersion:'1.0.0'
  };
};
export function listFormulaDefinitions({domain=null}={}){
  return [...listFoundationFormulaDefinitions(),...listFreshFormulaDefinitions()].filter(definition=>!domain||definition.domain===domain).map(definition=>enrichDefinition({...definition}));
}
export function getFormulaDefinition(formulaId){return enrichDefinition(isFreshFormula(formulaId)?getFreshFormulaDefinition(formulaId):getFoundationFormulaDefinition(formulaId));}
export function calculateFormula(formulaId,inputs={},options={}){return isFreshFormula(formulaId)?calculateFreshFormula(formulaId,inputs,options):calculateFoundationFormula(formulaId,inputs,options);}
export function calculateBatch(requests=[],options={}){
  if(!Array.isArray(requests)||requests.length<1)throw new FormulaError('invalid_array','requests must contain at least one value','requests');
  return requests.map((request,index)=>calculateFormula(request.formulaId,request.inputs,{...options,calculatedAt:options.calculatedAt??new Date().toISOString(),requestIndex:index}));
}
export const formulaEngineMetadata=Object.freeze({
  engineVersion:'extended-2.0.0',
  definitionCount:foundationMetadata.definitionCount+freshFormulaEngineMetadata.definitionCount,
  foundationDefinitionCount:foundationMetadata.definitionCount,
  freshDefinitionCount:freshFormulaEngineMetadata.definitionCount,
  deterministic:true,
  externalProviderRequired:false,
  calculationPrecision:foundationMetadata.calculationPrecision,
  displayPrecision:foundationMetadata.displayPrecision,
  freshProvenance:'FRESH_REIMPLEMENTATION_2026',
  historicalHashContinuity:false,
  presentationContractVersion:'1.0.0'
});
