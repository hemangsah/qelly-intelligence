import {calculateIndicator as calculateFoundationIndicator,listIndicatorDefinitions as listFoundationIndicatorDefinitions,getIndicatorDefinition as getFoundationIndicatorDefinition,indicatorEngineMetadata as foundationMetadata} from './indicator-engine.mjs';
import {calculateFreshIndicator,listFreshIndicatorDefinitions,getFreshIndicatorDefinition,isFreshIndicator,freshIndicatorEngineMetadata} from './fresh-indicator-catalog.mjs';

export function listIndicatorDefinitions({category=null}={}){
  return [...listFoundationIndicatorDefinitions(),...listFreshIndicatorDefinitions()].filter(definition=>!category||definition.category===category).map(definition=>({...definition}));
}
export function getIndicatorDefinition(indicatorId){return isFreshIndicator(indicatorId)?getFreshIndicatorDefinition(indicatorId):getFoundationIndicatorDefinition(indicatorId);}
export function calculateIndicator(indicatorId,inputs={},options={}){return isFreshIndicator(indicatorId)?calculateFreshIndicator(indicatorId,inputs,options):calculateFoundationIndicator(indicatorId,inputs);}
export const indicatorEngineMetadata=Object.freeze({
  version:'extended-2.0.0',
  definitionCount:foundationMetadata.definitionCount+freshIndicatorEngineMetadata.definitionCount,
  foundationDefinitionCount:foundationMetadata.definitionCount,
  freshDefinitionCount:freshIndicatorEngineMetadata.definitionCount,
  deterministic:true,
  externalProviderRequired:false,
  freshProvenance:'FRESH_REIMPLEMENTATION_2026',
  historicalHashContinuity:false
});
