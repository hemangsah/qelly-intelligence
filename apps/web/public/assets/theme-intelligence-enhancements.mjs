import * as core from './theme-intelligence-core.mjs';
import {DEFAULT_THEME_CONFIG,STORAGE_KEY} from './theme-intelligence-data.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)));
function solarMinutes(now,latitude,longitude,sunrise){
  const start=new Date(now.getFullYear(),0,0),day=Math.floor((now-start)/86400000),lngHour=longitude/15;
  const t=day+((sunrise?6:18)-lngHour)/24,m=.9856*t-3.289;
  const l=(m+1.916*Math.sin(m*Math.PI/180)+.02*Math.sin(2*m*Math.PI/180)+282.634+360)%360;
  const raInitial=(Math.atan(.91764*Math.tan(l*Math.PI/180))*180/Math.PI+360)%360,quadrant=Math.floor(l/90)*90;
  const ra=(raInitial+quadrant-Math.floor(raInitial/90)*90)/15;
  const sinDec=.39782*Math.sin(l*Math.PI/180),cosDec=Math.cos(Math.asin(sinDec));
  const cosH=(Math.cos(90.833*Math.PI/180)-sinDec*Math.sin(latitude*Math.PI/180))/(cosDec*Math.cos(latitude*Math.PI/180));
  if(cosH>1||cosH< -1)return null;
  const h=(sunrise?360-Math.acos(cosH)*180/Math.PI:Math.acos(cosH)*180/Math.PI)/15;
  const utc=(h+ra-.06571*t-6.622-lngHour+24)%24;
  return Math.round((utc*60-now.getTimezoneOffset()+1440)%1440);
}
function scheduledAppearance(schedule,now=new Date()){
  if(!schedule?.enabled)return 'dark';
  const minutes=now.getHours()*60+now.getMinutes();
  const parse=(value,fallback)=>{const match=String(value??'').match(/^(\d{1,2}):(\d{2})$/);return match?clamp(match[1],0,23)*60+clamp(match[2],0,59):fallback;};
  let light=parse(schedule.lightAt,420),dark=parse(schedule.darkAt,1140);
  if(schedule.useSun&&Number.isFinite(Number(schedule.latitude))&&Number.isFinite(Number(schedule.longitude))){
    light=solarMinutes(now,Number(schedule.latitude),Number(schedule.longitude),true)??light;
    dark=solarMinutes(now,Number(schedule.latitude),Number(schedule.longitude),false)??dark;
  }
  return light<=dark?(minutes>=light&&minutes<dark?'light':'dark'):(minutes>=light||minutes<dark?'light':'dark');
}
export function resolveAppearance(config,environment={}){
  if(config.appearance==='scheduled')return scheduledAppearance(config.schedule,environment.now??new Date());
  return core.resolveAppearance(config,environment);
}
export function resolveTokens(rawConfig=DEFAULT_THEME_CONFIG,environment={}){
  const config=core.migrateThemeConfig(rawConfig);
  const appearance=resolveAppearance(config,environment);
  return core.resolveTokens({...config,appearance},environment);
}
export function tokenContrastAudit(rawConfig){
  const tokens=resolveTokens(rawConfig);
  const pairs={primary:[tokens.text,tokens.canvas],surface:[tokens.text,tokens.surface],secondary:[tokens.secondary,tokens.surface],muted:[tokens.muted,tokens.surface],accent:[tokens.accentText,tokens.accent],positive:[tokens.positive,tokens.canvas],negative:[tokens.negative,tokens.canvas],tooltip:[tokens.text,tokens.overlay]};
  const results=Object.fromEntries(Object.entries(pairs).map(([key,[a,b]])=>[key,{foreground:a,background:b,ratio:Number(core.contrastRatio(a,b).toFixed(2)),passed:core.contrastRatio(a,b)>=(key==='muted'?3:4.5)}]));
  return {passed:Object.values(results).every((item)=>item.passed),results,tokens};
}
export function resolveCompleteTokenMap(rawConfig=DEFAULT_THEME_CONFIG,environment={}){
  const config=core.migrateThemeConfig(rawConfig),appearance=resolveAppearance(config,environment),base=core.resolveCompleteTokenMap({...config,appearance},environment),tokens=resolveTokens(config,environment),map={...base};
  for(const [name,value] of Object.entries(map)){
    if(name.includes('positive')||name.includes('success')||name.includes('bid')||name.includes('long'))map[name]=tokens.positive;
    if(name.includes('negative')||name.includes('danger')||name.includes('ask')||name.includes('short'))map[name]=tokens.negative;
  }
  return Object.freeze(map);
}
const controller=core.themeIntelligence;
const originalApply=controller.apply.bind(controller);
controller.snapshot=function(){return {config:structuredClone(this.config),tokens:resolveTokens(this.config),audit:tokenContrastAudit(this.config)};};
controller.schedule=function(){clearTimeout(this.timer);if(this.config.appearance==='scheduled')this.timer=setTimeout(()=>this.apply(this.config),60_000);};
controller.apply=function(input=this.config,{preview=false,persist=false}={}){
  const requested=core.migrateThemeConfig({...this.config,...input}),appearance=resolveAppearance(requested);
  originalApply({...requested,appearance},{preview,persist:false});
  this.config=requested;
  const root=document.documentElement;
  root.dataset.appearance=appearance;root.dataset.motion=requested.motion;root.dataset.fontScale=String(requested.fontScale);
  this.schedule();
  if(persist)this.commit();
  const snapshot=this.snapshot();this.listeners.forEach((listener)=>listener(snapshot));return snapshot;
};
controller.commit=function(){this.committed=structuredClone(this.config);localStorage.setItem(STORAGE_KEY,JSON.stringify(this.committed));document.documentElement.dataset.themePreview='false';return this.snapshot();};
export const themeIntelligence=controller;
