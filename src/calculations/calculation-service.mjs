import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { calculateFormula, calculateBatch, listFormulaDefinitions, getFormulaDefinition, formulaEngineMetadata } from '../../apps/web/public/assets/calculation/formula-engine.mjs';
import { calculateIndicator, listIndicatorDefinitions, getIndicatorDefinition, indicatorEngineMetadata } from '../../apps/web/public/assets/calculation/indicator-engine.mjs';
import { INDIA_RULE_REGISTRY, selectIndiaRule, calculateCustomIndiaCharges } from '../../apps/web/public/assets/calculation/india-rules.mjs';

const MAX_BODY_BYTES=1_000_000;
const MAX_BATCH=100;
const MAX_SERIES=100_000;
const forbidden=new Set(['__proto__','prototype','constructor']);
const clean=(value,depth=0)=>{if(depth>30)throw Object.assign(new Error('Input nesting exceeds the supported depth'),{status:400,code:'calculation_input_too_deep'});if(Array.isArray(value)){if(value.length>MAX_SERIES)throw Object.assign(new Error(`Arrays may contain no more than ${MAX_SERIES} items`),{status:413,code:'calculation_series_too_large'});return value.map(item=>clean(item,depth+1));}if(value&&typeof value==='object'){const output={};for(const [key,item] of Object.entries(value)){if(forbidden.has(key))throw Object.assign(new Error(`Unsafe input key rejected: ${key}`),{status:400,code:'calculation_unsafe_key'});output[key]=clean(item,depth+1);}return output;}if(typeof value==='string'&&value.length>100_000)throw Object.assign(new Error('Input string exceeds the supported size'),{status:413,code:'calculation_string_too_large'});return value;};

export class CalculationService{
  metadata(){return {schemaVersion:1,formulaEngine:formulaEngineMetadata,indicatorEngine:indicatorEngineMetadata,deterministic:true,externalProviderRequired:false,maxBatch:MAX_BATCH,maxSeries:MAX_SERIES,truthState:'IMPLEMENTED_DETERMINISTIC_LOCAL'};}
  formulas({domain=null}={}){return {items:listFormulaDefinitions({domain}),metadata:this.metadata()};}
  formula(id){return getFormulaDefinition(id);}
  calculate(request){const body=clean(request??{});return calculateFormula(body.formulaId,body.inputs??{},{assumptions:body.assumptions??[],effectiveDate:body.effectiveDate,sourceReferences:body.sourceReferences??[]});}
  batch(request){const body=clean(request??{}),requests=body.requests??[];if(!Array.isArray(requests)||requests.length<1||requests.length>MAX_BATCH)throw Object.assign(new Error(`requests must contain 1–${MAX_BATCH} calculations`),{status:400,code:'calculation_batch_invalid'});return {items:calculateBatch(requests),count:requests.length,truthState:'IMPLEMENTED_DETERMINISTIC_LOCAL'};}
  indicators({category=null}={}){return {items:listIndicatorDefinitions({category}),metadata:this.metadata()};}
  indicator(id){return getIndicatorDefinition(id);}
  calculateIndicator(request){const body=clean(request??{});return calculateIndicator(body.indicatorId,body.inputs??{});}
  indiaRules({ruleId=null,effectiveDate=null}={}){return ruleId?selectIndiaRule(ruleId,effectiveDate??new Date().toISOString().slice(0,10)):INDIA_RULE_REGISTRY;}
  indiaCharges(request){return calculateCustomIndiaCharges(clean(request??{}));}
}

export class SavedCalculationStore{
  constructor({filePath,auditLedger}){this.filePath=filePath;this.auditLedger=auditLedger;}
  async #read(){try{const parsed=JSON.parse(await readFile(this.filePath,'utf8'));return parsed?.schemaVersion===1&&Array.isArray(parsed.items)?parsed:{schemaVersion:1,items:[]};}catch(error){if(error.code==='ENOENT')return {schemaVersion:1,items:[]};throw error;}}
  async #write(store){await mkdir(path.dirname(this.filePath),{recursive:true});await writeFile(this.filePath,JSON.stringify(store,null,2)+'\n',{mode:0o600});}
  async list({userId,tenantId,workspaceId}){const store=await this.#read();return store.items.filter(item=>item.userId===userId&&item.tenantId===tenantId&&item.workspaceId===workspaceId).map(({userId:_u,tenantId:_t,workspaceId:_w,...item})=>item);}
  async save({userId,tenantId,workspaceId,name,result,notes='',correlationId}){const store=await this.#read(),savedAt=new Date().toISOString(),item={id:randomUUID(),userId,tenantId,workspaceId,name:String(name||result?.formulaId||result?.indicatorId||'Calculation').slice(0,120),savedAt,updatedAt:savedAt,schemaVersion:1,formulaVersion:result?.formulaVersion??null,indicatorVersion:result?.indicatorVersion??null,effectiveDate:result?.effectiveDate??null,result:clean(result),notes:String(notes).slice(0,2000)};store.items.unshift(item);store.items=store.items.slice(0,5000);await this.#write(store);await this.auditLedger?.append({eventType:'calculation.saved.v1',correlationId,actor:{type:'user',id:userId},tenantId,workspaceId,outcome:'success',details:{savedCalculationId:item.id,formulaId:result?.formulaId??null,indicatorId:result?.indicatorId??null}});const {userId:_u,tenantId:_t,workspaceId:_w,...publicItem}=item;return publicItem;}
  async remove({userId,tenantId,workspaceId,id,correlationId}){const store=await this.#read(),before=store.items.length;store.items=store.items.filter(item=>!(item.id===id&&item.userId===userId&&item.tenantId===tenantId&&item.workspaceId===workspaceId));if(store.items.length===before)throw Object.assign(new Error('Saved calculation was not found in this workspace'),{status:404,code:'saved_calculation_not_found'});await this.#write(store);await this.auditLedger?.append({eventType:'calculation.deleted.v1',correlationId,actor:{type:'user',id:userId},tenantId,workspaceId,outcome:'success',details:{savedCalculationId:id}});return {deleted:true,id};}
}
export const calculationLimits=Object.freeze({maxBodyBytes:MAX_BODY_BYTES,maxBatch:MAX_BATCH,maxSeries:MAX_SERIES});
