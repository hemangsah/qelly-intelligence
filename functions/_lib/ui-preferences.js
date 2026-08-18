import {restRequest} from './runtime.js';

export const DEFAULT_UI_PREFERENCES=Object.freeze({theme:'burgundy-command',density:'comfortable',motion:'full',fontScale:100,radiusPx:14,customAccent:null,route:'market'});
const ALLOWED_UI_PREFERENCE_KEYS=new Set(['theme','density','motion','fontScale','radiusPx','customAccent','route']);

export const cleanUiPreferences=(value={})=>{
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const next={};
  for(const key of ALLOWED_UI_PREFERENCE_KEYS)if(source[key]!==undefined)next[key]=source[key];
  if(next.theme!==undefined)next.theme=String(next.theme).slice(0,80);
  if(next.density!==undefined&&!['compact','comfortable','spacious'].includes(String(next.density)))delete next.density;
  if(next.motion!==undefined&&!['full','reduced','none'].includes(String(next.motion)))delete next.motion;
  if(next.fontScale!==undefined)next.fontScale=Math.min(140,Math.max(80,Number(next.fontScale)||100));
  if(next.radiusPx!==undefined)next.radiusPx=Math.min(24,Math.max(0,Number(next.radiusPx)||0));
  if(next.customAccent!==undefined&&next.customAccent!==null)next.customAccent=String(next.customAccent).slice(0,32);
  if(next.route!==undefined)next.route=String(next.route).slice(0,120);
  return next;
};

export async function readUiPreferenceRow(env,session,workspaceId){
  const params=new URLSearchParams({
    select:'preferences,schema_version,revision,updated_at',
    owner_id:`eq.${session.user.id}`,
    workspace_id:`eq.${workspaceId}`,
    limit:'1'
  });
  return (await restRequest(env,session.accessToken,`qelly_ui_preferences?${params.toString()}`))?.[0]||null;
}

export const uiPreferencesEnvelope=(row)=>({
  ...DEFAULT_UI_PREFERENCES,
  ...(row?.preferences||{}),
  revision:Number(row?.revision)||0,
  schemaVersion:Number(row?.schema_version)||3,
  persisted:Boolean(row),
  storage:'cloud-rls',
  updatedAt:row?.updated_at||null
});
