import {THEME_FAMILIES as RAW_THEME_FAMILIES} from './theme-intelligence-data.mjs';

export const AUTHORITATIVE_THEME_ORDER=Object.freeze([
  'sovereign-obsidian',
  'porcelain-signal',
  'crimson-vector',
  'obsidian-strike',
  'white-heat',
  'ember-protocol',
  'arctic-quant',
  'emerald-conviction',
  'cobalt-circuit',
  'violet-oracle',
  'gold-dominion',
  'monochrome-ledger',
  'signal-access'
]);

const byId=new Map(RAW_THEME_FAMILIES.map((theme)=>[theme.id,theme]));
const ordered=AUTHORITATIVE_THEME_ORDER.map((id)=>byId.get(id));
if(ordered.some((theme)=>!theme)||byId.size!==AUTHORITATIVE_THEME_ORDER.length){
  throw new Error('Theme Intelligence registry does not match the authoritative 13-theme identity contract');
}
export const THEME_FAMILIES=Object.freeze(ordered);
