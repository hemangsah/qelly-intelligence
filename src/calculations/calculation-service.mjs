import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { withLocalFileLock } from '../platform/local-file-lock.mjs';
import { calculateFormula, calculateBatch, listFormulaDefinitions, getFormulaDefinition, formulaEngineMetadata } from '../../apps/web/public/assets/calculation/formula-engine-extended.mjs';
import { calculateIndicator, listIndicatorDefinitions, getIndicatorDefinition, indicatorEngineMetadata } from '../../apps/web/public/assets/calculation/indicator-engine-extended.mjs';
import { INDIA_RULE_REGISTRY, selectIndiaRule, calculateCustomIndiaCharges } from '../../apps/web/public/assets/calculation/india-rules.mjs';

const MAX_BODY_BYTES=1_000_000;
const MAX_BATCH=100;
const MAX_SERIES=100_000;
const MAX_SAVED=5_000;
const MAX_REVISIONS=100;
const forbidden=new Set(['__proto__','prototype','constructor']);
const clean=(value,depth=0)=>{if(depth>30)throw Object.assign(new Error('Input nesting exceeds the supported depth'),{status:400,code:'calculation_input_too_deep'});if(Array.isArray(value)){if(value.length>MAX_SERIES)throw Object.assign(new Error(`Arrays may contain no more than ${MAX_SERIES} items`),{status:413,code:'calculation_series_too_large'});return value.map(item=>clean(item,depth+1));}if(value&&typeof value==='object'){const output={};for(const [key,item] of Object.entries(value)){if(forbidden.has(key))throw Object.assign(new Error(`Unsafe input key rejected: ${key}`),{status:400,code:'calculation_unsafe_key'});output[key]=clean(item,depth+1);}return output;}if(typeof value==='string'&&value.length>100_000)throw Object.assign(new Error('Input string exceeds the supported size'),{status:413,code:'calculation_string_too_large'});return value;};
const text=(value,max)=>String(value??'').slice(0,max);
const tags=value=>[...new Set((Array.isArray(value)?value:[]).map(item=>text(item,40).trim()).filter(Boolean))].slice(0,20);
const notFound=()=>Object.assign(new Error('Saved calculation was not found in this workspace'),{status:404,code:'saved_calculation_not_found'});
const unsafeInputForEngine=error=>{const key=[...forbidden].find(candidate=>String(error?.message??'').includes(candidate))??'__proto__';const input={};Object.defineProperty(input,key,{value:null,enumerable:true,configurable:false,writable:false});return input;};

export class CalculationService{
  metadata(){return {schemaVersion:2,formulaEngine:formulaEngineMetadata,indicatorEngine:indicatorEngineMetadata,deterministic:true,externalProviderRequired:false,maxBatch:MAX_BATCH,maxSeries:MAX_SERIES,truthState:'DETERMINISTIC LOCAL',freshProvenance:'FRESH_REIMPLEMENTATION_2026'};}
  formulas({domain=null}={}){return {items:listFormulaDefinitions({domain}),metadata:this.metadata()};}
  formula(id){return getFormulaDefinition(id);}
  calculate(request){try{const body=clean(request??{});return calculateFormula(body.formulaId,body.inputs??{},{assumptions:body.assumptions??[],effectiveDate:body.effectiveDate,sourceReferences:body.sourceReferences??[]});}catch(error){if(error?.code==='calculation_unsafe_key')return calculateFormula(typeof request?.formulaId==='string'?request.formulaId:'',unsafeInputForEngine(error));throw error;}}
  batch(request){const body=clean(request??{}),requests=body.requests??[];if(!Array.isArray(requests)||requests.length<1||requests.length>MAX_BATCH)throw Object.assign(new Error(`requests must contain 1–${MAX_BATCH} calculations`),{status:400,code:'calculation_batch_invalid'});return {items:calculateBatch(requests),count:requests.length,truthState:'DETERMINISTIC LOCAL'};}
  indicators({category=null}={}){return {items:listIndicatorDefinitions({category}),metadata:this.metadata()};}
  indicator(id){return getIndicatorDefinition(id);}
  calculateIndicator(request){try{const body=clean(request??{});return calculateIndicator(body.indicatorId,body.inputs??{});}catch(error){if(error?.code==='calculation_unsafe_key')return calculateIndicator(typeof request?.indicatorId==='string'?request.indicatorId:'',unsafeInputForEngine(error));throw error;}}
  indiaRules({ruleId=null,effectiveDate=null}={}){return ruleId?selectIndiaRule(ruleId,effectiveDate??new Date().toISOString().slice(0,10)):INDIA_RULE_REGISTRY;}
  indiaCharges(request){return calculateCustomIndiaCharges(clean(request??{}));}
}

const revisionFrom=(item,{revisionId=randomUUID(),createdAt=new Date().toISOString(),restoredFrom=null}={})=>({revisionId,version:item.version,createdAt,restoredFrom,name:item.name,result:clean(item.result),notes:item.notes,tags:[...item.tags],favorite:item.favorite,formulaVersion:item.formulaVersion,indicatorVersion:item.indicatorVersion,indiaRuleVersion:item.indiaRuleVersion,effectiveDate:item.effectiveDate});
const publicListItem=item=>({id:item.id,name:item.name,savedAt:item.savedAt,updatedAt:item.updatedAt,schemaVersion:item.schemaVersion,version:item.version,revisionCount:item.revisions.length,formulaVersion:item.formulaVersion,indicatorVersion:item.indicatorVersion,indiaRuleVersion:item.indiaRuleVersion,effectiveDate:item.effectiveDate,result:item.result,notes:item.notes,tags:[...item.tags],favorite:item.favorite});
const publicDetail=item=>({...publicListItem(item),revisions:item.revisions.map(clean)});

export class SavedCalculationStore{
  constructor({filePath,auditLedger}){this.filePath=filePath;this.auditLedger=auditLedger;}
  async #read(){
    try{
      const parsed=JSON.parse(await readFile(this.filePath,'utf8'));
      if(!Array.isArray(parsed?.items))return {schemaVersion:2,items:[]};
      const migrated=parsed.items.map(raw=>{
        const savedAt=raw.savedAt??new Date().toISOString();
        const item={...raw,schemaVersion:2,version:Number.isInteger(raw.version)&&raw.version>0?raw.version:1,tags:tags(raw.tags),favorite:Boolean(raw.favorite),indiaRuleVersion:raw.indiaRuleVersion??raw.result?.evidence?.indiaRuleVersion??null};
        item.revisions=Array.isArray(raw.revisions)&&raw.revisions.length?raw.revisions.map(clean):[revisionFrom({...item,revisions:[]},{revisionId:`migrated-${raw.id??randomUUID()}`,createdAt:savedAt})];
        return item;
      });
      return {schemaVersion:2,items:migrated};
    }catch(error){if(error.code==='ENOENT')return {schemaVersion:2,items:[]};throw error;}
  }
  async #write(store){
    await mkdir(path.dirname(this.filePath),{recursive:true});
    const temp=`${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    try{
      await writeFile(temp,JSON.stringify({...store,schemaVersion:2},null,2)+'\n',{encoding:'utf8',mode:0o600,flush:true});
      await rename(temp,this.filePath);
    }catch(error){
      await rm(temp,{force:true}).catch(()=>{});
      throw error;
    }
  }
  async #mutate(mutator){
    await mkdir(path.dirname(this.filePath),{recursive:true});
    return withLocalFileLock(this.filePath,async()=>{
      const store=await this.#read();
      const result=await mutator(store);
      await this.#write(store);
      return result;
    });
  }
  #index(store,{userId,tenantId,workspaceId,id}){const index=store.items.findIndex(item=>item.id===id&&item.userId===userId&&item.tenantId===tenantId&&item.workspaceId===workspaceId);if(index<0)throw notFound();return index;}
  async #audit(eventType,{userId,tenantId,workspaceId,correlationId,id,details={}}){await this.auditLedger?.append({eventType,correlationId,actor:{type:'user',id:userId},tenantId,workspaceId,outcome:'success',details:{savedCalculationId:id,...details}});}
  async list({userId,tenantId,workspaceId,query='',tag=null,favorite=null,sort='updated-desc'}){
    const store=await this.#read(),needle=text(query,200).trim().toLowerCase();
    let items=store.items.filter(item=>item.userId===userId&&item.tenantId===tenantId&&item.workspaceId===workspaceId);
    if(needle)items=items.filter(item=>[item.name,item.notes,...item.tags,item.result?.formulaId,item.result?.indicatorId].some(value=>String(value??'').toLowerCase().includes(needle)));
    if(tag)items=items.filter(item=>item.tags.includes(text(tag,40)));
    if(favorite!==null&&favorite!==undefined)items=items.filter(item=>item.favorite===Boolean(favorite));
    const directions={'updated-desc':(a,b)=>b.updatedAt.localeCompare(a.updatedAt),'updated-asc':(a,b)=>a.updatedAt.localeCompare(b.updatedAt),'name-asc':(a,b)=>a.name.localeCompare(b.name),'name-desc':(a,b)=>b.name.localeCompare(a.name)};
    return items.sort(directions[sort]??directions['updated-desc']).map(publicListItem);
  }
  async get(scope){const store=await this.#read();return publicDetail(store.items[this.#index(store,scope)]);}
  async save({userId,tenantId,workspaceId,name,result,notes='',tags:inputTags=[],favorite=false,correlationId}){
    const item=await this.#mutate(async store=>{const savedAt=new Date().toISOString(),next={id:randomUUID(),userId,tenantId,workspaceId,name:text(name||result?.formulaId||result?.indicatorId||'Calculation',120),savedAt,updatedAt:savedAt,schemaVersion:2,version:1,formulaVersion:result?.formulaVersion??null,indicatorVersion:result?.indicatorVersion??null,indiaRuleVersion:result?.evidence?.indiaRuleVersion??null,effectiveDate:result?.effectiveDate??null,result:clean(result),notes:text(notes,2000),tags:tags(inputTags),favorite:Boolean(favorite),revisions:[]};next.revisions=[revisionFrom(next,{createdAt:savedAt})];store.items.unshift(next);store.items=store.items.slice(0,MAX_SAVED);return next;});
    await this.#audit('calculation.saved.v2',{userId,tenantId,workspaceId,correlationId,id:item.id,details:{formulaId:result?.formulaId??null,indicatorId:result?.indicatorId??null,version:1}});return publicDetail(item);
  }
  async update({userId,tenantId,workspaceId,id,name,result,notes,tags:inputTags,favorite,correlationId}){
    const next=await this.#mutate(async store=>{const index=this.#index(store,{userId,tenantId,workspaceId,id}),current=store.items[index],updatedAt=new Date().toISOString();const updated={...current,name:name===undefined?current.name:text(name,120),result:result===undefined?current.result:clean(result),notes:notes===undefined?current.notes:text(notes,2000),tags:inputTags===undefined?current.tags:tags(inputTags),favorite:favorite===undefined?current.favorite:Boolean(favorite),updatedAt,version:current.version+1};updated.formulaVersion=updated.result?.formulaVersion??current.formulaVersion;updated.indicatorVersion=updated.result?.indicatorVersion??current.indicatorVersion;updated.indiaRuleVersion=updated.result?.evidence?.indiaRuleVersion??current.indiaRuleVersion;updated.effectiveDate=updated.result?.effectiveDate??current.effectiveDate;updated.revisions=[...current.revisions,revisionFrom(updated,{createdAt:updatedAt})].slice(-MAX_REVISIONS);store.items[index]=updated;return updated;});
    await this.#audit('calculation.updated.v2',{userId,tenantId,workspaceId,correlationId,id,details:{version:next.version}});return publicDetail(next);
  }
  async duplicate({userId,tenantId,workspaceId,id,name,correlationId}){const source=await this.get({userId,tenantId,workspaceId,id});return this.save({userId,tenantId,workspaceId,name:name??`${source.name} Copy`,result:source.result,notes:source.notes,tags:source.tags,favorite:false,correlationId});}
  async revisions(scope){const detail=await this.get(scope);return {id:detail.id,currentVersion:detail.version,items:[...detail.revisions].sort((a,b)=>b.version-a.version)};}
  async restore({userId,tenantId,workspaceId,id,revisionId,correlationId}){
    const next=await this.#mutate(async store=>{const index=this.#index(store,{userId,tenantId,workspaceId,id}),current=store.items[index],selected=current.revisions.find(revision=>revision.revisionId===revisionId);if(!selected)throw Object.assign(new Error('Saved calculation revision was not found'),{status:404,code:'saved_calculation_revision_not_found'});const updatedAt=new Date().toISOString(),updated={...current,name:selected.name,result:clean(selected.result),notes:selected.notes,tags:tags(selected.tags),favorite:Boolean(selected.favorite),formulaVersion:selected.formulaVersion,indicatorVersion:selected.indicatorVersion,indiaRuleVersion:selected.indiaRuleVersion,effectiveDate:selected.effectiveDate,updatedAt,version:current.version+1};updated.revisions=[...current.revisions,revisionFrom(updated,{createdAt:updatedAt,restoredFrom:revisionId})].slice(-MAX_REVISIONS);store.items[index]=updated;return updated;});
    await this.#audit('calculation.revision.restored.v2',{userId,tenantId,workspaceId,correlationId,id,details:{version:next.version,restoredFrom:revisionId}});return publicDetail(next);
  }
  async remove({userId,tenantId,workspaceId,id,correlationId}){await this.#mutate(async store=>{const index=this.#index(store,{userId,tenantId,workspaceId,id});store.items.splice(index,1);});await this.#audit('calculation.deleted.v2',{userId,tenantId,workspaceId,correlationId,id});return {deleted:true,id};}
}
export const calculationLimits=Object.freeze({maxBodyBytes:MAX_BODY_BYTES,maxBatch:MAX_BATCH,maxSeries:MAX_SERIES,maxSaved:MAX_SAVED,maxRevisions:MAX_REVISIONS});
