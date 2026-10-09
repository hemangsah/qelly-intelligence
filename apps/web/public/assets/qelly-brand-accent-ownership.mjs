// The compatibility writer must not erase the canonical theme engine's accent.
export function applyLegacyAccentPreference(root,customAccent,palettes=globalThis.__QELLY_BRAND_TOKENS__){
  if(customAccent){root.style.setProperty('--q-accent',customAccent);return 'custom';}
  const appearance=root.dataset.resolvedAppearance||root.dataset.appearance;
  const accent=palettes?.[appearance]?.accent;
  if(accent){root.style.setProperty('--q-accent',accent);return 'canonical';}
  // High-contrast/OLED/system states belong to the engine when brand prepaint is active.
  if(root.dataset.brandReady==='true')return 'engine-preserved';
  root.style.removeProperty('--q-accent');return 'legacy-fallback';
}
