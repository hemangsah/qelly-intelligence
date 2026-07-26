import crypto from 'node:crypto';
import { AtomicJsonStore } from '../platform/json-store.mjs';

const seed=()=>({version:1,layouts:[],updatedAt:null});
function clean(value,max=80){return String(value??'').trim().slice(0,max);}
export class ChartLayoutStore {
 constructor({filePath,auditLedger}){this.store=new AtomicJsonStore(filePath,seed);this.auditLedger=auditLedger;}
 async list({userId,workspaceId}){const data=await this.store.read();return {items:data.layouts.filter(item=>item.userId===userId&&item.workspaceId===workspaceId),localPersistence:true,cloudSync:false,updatedAt:data.updatedAt};}
 async save({userId,tenantId,workspaceId,name,canonicalId,range='1y',interval='1d',indicators=[],panes=[],correlationId}){let record;await this.store.update(data=>{record={layoutId:`chart-${crypto.randomUUID()}`,userId,tenantId,workspaceId,name:clean(name)||'Untitled chart',canonicalId:clean(canonicalId,64),range:clean(range,12),interval:clean(interval,12),indicators:[...new Set(indicators.map(String))].slice(0,8),panes:Array.isArray(panes)?panes.slice(0,8):[],createdAt:new Date().toISOString(),revision:1};data.layouts.push(record);data.updatedAt=record.createdAt;return data;});await this.auditLedger?.append({eventType:'asset.chart-layout.saved.v1',correlationId,actor:{type:'user',id:userId},tenantId,workspaceId,details:{layoutId:record.layoutId,canonicalId:record.canonicalId,indicatorCount:record.indicators.length}});return record;}
 async remove({userId,tenantId,workspaceId,layoutId,correlationId}){let removed=null;await this.store.update(data=>{const index=data.layouts.findIndex(item=>item.layoutId===layoutId&&item.userId===userId&&item.workspaceId===workspaceId);if(index<0)throw Object.assign(new Error('Chart layout not found'),{status:404,code:'chart_layout_not_found'});removed=data.layouts.splice(index,1)[0];data.updatedAt=new Date().toISOString();return data;});await this.auditLedger?.append({eventType:'asset.chart-layout.deleted.v1',correlationId,actor:{type:'user',id:userId},tenantId,workspaceId,details:{layoutId}});return {deleted:true,layoutId,removedName:removed.name};}
}
