import path from 'node:path';
import { AtomicJsonStore } from '../platform/json-store.mjs';

export const defaultPreferences = {
  version:1, theme:'burgundy-command', density:'comfortable', motion:'full', fontScale:100, radiusPx:10, customAccent:null, route:'market',
  panels:[{id:'market-kpis',visible:true,order:0,width:null},{id:'market-chart',visible:true,order:1,width:null},{id:'market-grid',visible:true,order:2,width:null}]
};

const seed = () => ({ version:2, updatedAt:new Date(0).toISOString(), records:{} });
const scopeKey = ({ userId='user-local-primary', tenantId='org-qelly-labs', workspaceId='workspace-research' } = {}) => `${tenantId}:${workspaceId}:${userId}`;

export class PreferenceStore {
  constructor(runtimeDir) {
    this.runtimeDir = runtimeDir;
    this.file = path.join(runtimeDir, 'layout-preferences.json');
    this.store = new AtomicJsonStore(this.file, seed);
  }
  async init() { await this.store.read(); }
  async read(scope = {}) {
    const data = await this.store.read();
    if (data?.version !== 2 || !data.records) {
      const legacy = validatePreference(data);
      const migrated = seed(); migrated.records[scopeKey(scope)] = { ...legacy, revision:1, updatedAt:new Date().toISOString() };
      await this.store.replace(migrated); return legacy;
    }
    const record = data.records[scopeKey(scope)];
    return record ? structuredClone(record) : structuredClone(defaultPreferences);
  }
  async write(value, scope = {}, expectedRevision = null) {
    const normalized = validatePreference(value); let saved;
    await this.store.update((data) => {
      const key = scopeKey(scope); const current = data.records[key] ?? null;
      if (expectedRevision != null && Number(expectedRevision) !== Number(current?.revision ?? 0)) {
        throw Object.assign(new Error('Preference revision conflict'), { status:409, code:'preference_revision_conflict', details:{expected:Number(expectedRevision),actual:Number(current?.revision??0)} });
      }
      saved = { ...normalized, revision:Number(current?.revision??0)+1, updatedAt:new Date().toISOString(), scope:{userId:scope.userId,tenantId:scope.tenantId,workspaceId:scope.workspaceId} };
      data.records[key]=saved; data.updatedAt=saved.updatedAt; return data;
    });
    return { ...stripMetadata(saved), revision:saved.revision, updatedAt:saved.updatedAt, scope:saved.scope };
  }
  async inventory(scope = {}) {
    const data=await this.store.read(); const key=scopeKey(scope); const record=data.records?.[key]??null;
    return {storageVersion:data.version??1,scopeKey:key,scoped:true,revision:record?.revision??0,updatedAt:record?.updatedAt??null};
  }
}

const stripMetadata = ({revision,updatedAt,scope,...preference}) => preference;

export function validatePreference(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new TypeError('Preference body must be an object'),{status:400,code:'request_invalid'});
  const themes=['burgundy-command','burgundy-night','porcelain-burgundy','graphite-terminal','midnight-research','high-contrast'];
  const density=['comfortable','compact','terminal']; const motion=['full','subtle','reduced'];
  const theme=themes.includes(value.theme)?value.theme:defaultPreferences.theme;
  const densityValue=density.includes(value.density)?value.density:defaultPreferences.density;
  const motionValue=motion.includes(value.motion)?value.motion:defaultPreferences.motion;
  const fontScale=[90,100,110,120].includes(Number(value.fontScale))?Number(value.fontScale):100;
  const radiusPx=Math.max(0,Math.min(20,Number.isFinite(Number(value.radiusPx))?Math.round(Number(value.radiusPx)):10));
  const customAccent=value.customAccent==null?null:String(value.customAccent);
  if (customAccent && !/^#[0-9a-f]{6}$/i.test(customAccent)) throw Object.assign(new TypeError('customAccent must be a six-digit hexadecimal color'),{status:400,code:'request_invalid'});
  const panels=Array.isArray(value.panels)?value.panels.filter((panel)=>panel&&typeof panel.id==='string').map((panel,index)=>({id:panel.id,visible:panel.visible!==false,order:Number.isInteger(panel.order)?panel.order:index,width:panel.width==null?null:Math.max(240,Math.min(1200,Number(panel.width)))})):structuredClone(defaultPreferences.panels);
  return { version:1, theme, density:densityValue, motion:motionValue, fontScale, radiusPx, customAccent, route:typeof value.route==='string'?value.route:'market', panels };
}
