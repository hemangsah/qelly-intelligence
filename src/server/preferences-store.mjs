import path from 'node:path';
import { AtomicJsonStore } from '../platform/json-store.mjs';

export const THEME_FAMILIES=['sovereign-obsidian','porcelain-command','graphite-terminal','midnight-research','kinetic-burgundy','arctic-signal','copper-ledger','deep-space','jade-quant','ultraviolet-lab','solarized-evidence','high-contrast','aggressive-alpha'];
export const THEME_PERSONAS=['scalper-velocity','investor-compound','aggressive-alpha','quant-operator','research-oracle','signal-access'];
export const ALPHA_INTENSITIES=['Focused Edge','Tactical Surge','Conviction Strike','Redline Apex'];
export const ALPHA_PACKS=['crimson-vector','obsidian-strike','white-heat','ember-protocol','apex-monochrome','scarlet-circuit'];
const APPEARANCES=['dark','light','oled','high-contrast','system','scheduled'];
const LEGACY_THEMES=['burgundy-command','burgundy-night','porcelain-burgundy','graphite-terminal','midnight-research','high-contrast'];
const PERSONA_MINDSETS={
  'scalper-velocity':['Tape Scan','Liquidation Hunt','Breakout Watch','Risk Reset'],
  'investor-compound':['Quality Moat','Value Dislocation','Portfolio Health','Macro Patience'],
  'aggressive-alpha':ALPHA_INTENSITIES,
  'quant-operator':['Factor Lab','Regime Diagnostics','Signal QA','Execution Hygiene'],
  'research-oracle':['Evidence Map','Contradiction Scan','Catalyst Dossier','Thesis Review'],
  'signal-access':['Essential Signals','Risk First','Calm Navigation','Readable Focus']
};
const LEGACY_MAP={
  'burgundy-command':{themeFamily:'sovereign-obsidian',persona:'scalper-velocity'},
  'porcelain-burgundy':{themeFamily:'porcelain-command',persona:'investor-compound',appearance:'light'},
  'burgundy-night':{themeFamily:'aggressive-alpha',persona:'aggressive-alpha'},
  'graphite-terminal':{themeFamily:'graphite-terminal',persona:'quant-operator'},
  'midnight-research':{themeFamily:'midnight-research',persona:'research-oracle'},
  'high-contrast':{themeFamily:'high-contrast',persona:'signal-access',appearance:'high-contrast'}
};

export const defaultPreferences = {
  version:2,
  theme:'burgundy-command',
  appearance:'dark',
  themeFamily:'sovereign-obsidian',
  persona:'quant-operator',
  mindset:'Factor Lab',
  alphaIntensity:'Focused Edge',
  alphaPack:'crimson-vector',
  density:'comfortable',
  tableDensity:'compact',
  dataEmphasis:'balanced',
  marketPalette:'semantic',
  borderVisibility:'subtle',
  selectedStrength:'medium',
  focusStyle:'ring',
  accentIntensity:70,
  motion:'subtle',
  fontScale:100,
  radiusPx:10,
  customAccent:null,
  schedule:{enabled:false,lightAt:'07:00',darkAt:'19:00',timezone:'local',useSun:false,latitude:null,longitude:null},
  route:'market',
  panels:[{id:'market-kpis',visible:true,order:0,width:null},{id:'market-chart',visible:true,order:1,width:null},{id:'market-grid',visible:true,order:2,width:null}]
};

const seed = () => ({ version:3, updatedAt:new Date(0).toISOString(), records:{} });
const scopeKey = ({ userId='user-local-primary', tenantId='org-qelly-labs', workspaceId='workspace-research' } = {}) => `${tenantId}:${workspaceId}:${userId}`;

export class PreferenceStore {
  constructor(runtimeDir) {
    this.runtimeDir = runtimeDir;
    this.file = path.join(runtimeDir, 'layout-preferences.json');
    this.store = new AtomicJsonStore(this.file, seed);
  }
  async init() { await this.store.read(); }
  async read(scope = {}) {
    let data;
    try{data=await this.store.read();}catch{data=seed();await this.store.replace(data);}
    if (!data?.records || ![2,3].includes(Number(data.version))) {
      const legacy = validatePreference(data);
      const migrated = seed(); migrated.records[scopeKey(scope)] = { ...legacy, revision:1, updatedAt:new Date().toISOString() };
      await this.store.replace(migrated); return legacy;
    }
    const record = data.records[scopeKey(scope)];
    if(!record)return structuredClone(defaultPreferences);
    const normalized=validatePreference(record);
    return structuredClone({...normalized,revision:record.revision,updatedAt:record.updatedAt,scope:record.scope});
  }
  async write(value, scope = {}, expectedRevision = null) {
    const normalized = validatePreference(value); let saved;
    await this.store.update((data) => {
      if(!data?.records)data=seed();
      data.version=3;
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
    return {storageVersion:data.version??1,themePreferenceVersion:record?.version??2,scopeKey:key,scoped:true,revision:record?.revision??0,updatedAt:record?.updatedAt??null};
  }
}

const stripMetadata = ({revision,updatedAt,scope,...preference}) => preference;
const oneOf=(value,values,fallback)=>values.includes(value)?value:fallback;
const finiteOrNull=(value,min,max)=>value==null||value===''?null:Math.max(min,Math.min(max,Number(value)));
function safeTime(value,fallback){return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value??''))?String(value):fallback;}
function validateAccent(value){if(value==null||value==='')return null;const accent=String(value).toUpperCase();if(!/^#[0-9A-F]{6}$/.test(accent))throw Object.assign(new TypeError('customAccent must be a six-digit hexadecimal color'),{status:400,code:'request_invalid'});if(['#35C98C','#FF6678','#F4B860'].includes(accent))throw Object.assign(new TypeError('customAccent cannot replace protected market semantics'),{status:400,code:'request_invalid'});return accent;}

export function validatePreference(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new TypeError('Preference body must be an object'),{status:400,code:'request_invalid'});
  const legacy=LEGACY_MAP[value.theme]??{};
  const theme=oneOf(value.theme,LEGACY_THEMES,defaultPreferences.theme);
  const appearance=oneOf(value.appearance??legacy.appearance,APPEARANCES,defaultPreferences.appearance);
  const themeFamily=oneOf(value.themeFamily??legacy.themeFamily,THEME_FAMILIES,defaultPreferences.themeFamily);
  const persona=oneOf(value.persona??legacy.persona,THEME_PERSONAS,defaultPreferences.persona);
  const mindset=oneOf(value.mindset,PERSONA_MINDSETS[persona],PERSONA_MINDSETS[persona][0]);
  const alphaIntensity=oneOf(value.alphaIntensity,ALPHA_INTENSITIES,defaultPreferences.alphaIntensity);
  const alphaPack=oneOf(value.alphaPack,ALPHA_PACKS,defaultPreferences.alphaPack);
  const densityValue=oneOf(value.density,['comfortable','compact','terminal'],defaultPreferences.density);
  const tableDensity=oneOf(value.tableDensity,['comfortable','compact','terminal'],defaultPreferences.tableDensity);
  const dataEmphasis=oneOf(value.dataEmphasis,['balanced','numbers','labels'],defaultPreferences.dataEmphasis);
  const marketPalette=oneOf(value.marketPalette,['semantic','color-blind'],defaultPreferences.marketPalette);
  const borderVisibility=oneOf(value.borderVisibility,['minimal','subtle','strong'],defaultPreferences.borderVisibility);
  const selectedStrength=oneOf(value.selectedStrength,['subtle','medium','strong'],defaultPreferences.selectedStrength);
  const focusStyle=oneOf(value.focusStyle,['ring','underline','high-visibility'],defaultPreferences.focusStyle);
  const motionValue=oneOf(value.motion,['full','subtle','reduced'],defaultPreferences.motion);
  const fontScale=[90,100,110,120].includes(Number(value.fontScale))?Number(value.fontScale):100;
  const radiusPx=Math.max(0,Math.min(20,Number.isFinite(Number(value.radiusPx))?Math.round(Number(value.radiusPx)):10));
  const accentIntensity=Math.max(20,Math.min(100,Number.isFinite(Number(value.accentIntensity))?Math.round(Number(value.accentIntensity)):70));
  const customAccent=validateAccent(value.customAccent);
  const scheduleInput=value.schedule&&typeof value.schedule==='object'&&!Array.isArray(value.schedule)?value.schedule:{};
  const schedule={enabled:Boolean(scheduleInput.enabled),lightAt:safeTime(scheduleInput.lightAt,defaultPreferences.schedule.lightAt),darkAt:safeTime(scheduleInput.darkAt,defaultPreferences.schedule.darkAt),timezone:typeof scheduleInput.timezone==='string'?scheduleInput.timezone.slice(0,64):'local',useSun:Boolean(scheduleInput.useSun),latitude:finiteOrNull(scheduleInput.latitude,-90,90),longitude:finiteOrNull(scheduleInput.longitude,-180,180)};
  const panels=Array.isArray(value.panels)?value.panels.filter((panel)=>panel&&typeof panel.id==='string').map((panel,index)=>({id:panel.id,visible:panel.visible!==false,order:Number.isInteger(panel.order)?panel.order:index,width:panel.width==null?null:Math.max(240,Math.min(1200,Number(panel.width)))})):structuredClone(defaultPreferences.panels);
  return {version:2,theme,appearance,themeFamily,persona,mindset,alphaIntensity,alphaPack,density:densityValue,tableDensity,dataEmphasis,marketPalette,borderVisibility,selectedStrength,focusStyle,accentIntensity,motion:motionValue,fontScale,radiusPx,customAccent,schedule,route:typeof value.route==='string'?value.route:'market',panels};
}
