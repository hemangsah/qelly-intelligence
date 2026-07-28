const paths=Object.freeze({
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  sun:'<circle cx="12" cy="12" r="3.25"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  bell:'<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8.5h18C21 16 18 16 18 9Z"/><path d="M10 21h4"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  chevronLeft:'<path d="m14.5 5-7 7 7 7"/>',
  home:'<path d="m3 11 9-7 9 7"/><path d="M5.5 10v10h13V10M9.5 20v-6h5v6"/>',
  markets:'<path d="M4 18V9M9 18V5M14 18v-7M19 18V3"/><path d="M3 18h18"/>',
  assets:'<circle cx="12" cy="12" r="8"/><path d="M9 8.5h4.25a2.25 2.25 0 0 1 0 4.5H9m0 0h4.75a2.25 2.25 0 0 1 0 4.5H9M11 6v12M14 6v2.5M14 17.5V20"/>',
  derivatives:'<path d="M4 18 9 6l3 8 3-5 5 9"/><path d="M3 18h18"/>',
  research:'<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M8 8h7M8 12h7M8 16h4"/>',
  portfolio:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M8 6V4h8v2M3 11h18M10 11v3h4v-3"/>',
  evidence:'<circle cx="9" cy="9" r="4"/><circle cx="16.5" cy="15.5" r="3.5"/><path d="m12 12 2 2M6 13l-2 5M19 12l2-4"/>',
  operations:'<path d="M5 7h14M5 12h14M5 17h14"/><circle cx="9" cy="7" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><circle cx="11" cy="17" r="1.5" fill="currentColor"/>',
  trust:'<path d="M12 3 5 6v5c0 4.8 2.8 8.2 7 10 4.2-1.8 7-5.2 7-10V6l-7-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
  explain:'<path d="M12 3.5a7 7 0 0 0-4.3 12.5c.8.6 1.3 1.5 1.3 2.5h6c0-1 .5-1.9 1.3-2.5A7 7 0 0 0 12 3.5Z"/><path d="M9 21h6M9.5 18.5h5M12 7v5l3 1.5"/>',
  command:'<path d="M8 9V6.5a2.5 2.5 0 1 0-5 0A2.5 2.5 0 0 0 5.5 9H8Zm0 0v6H5.5A2.5 2.5 0 1 0 8 17.5V15h8v2.5a2.5 2.5 0 1 0 2.5-2.5H16V9h2.5A2.5 2.5 0 1 0 16 6.5V9H8Z"/>',
  star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
  starFilled:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" fill="currentColor"/>',
  columns:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
  filter:'<path d="M4 5h16l-6.5 7v5.5l-3 1.5v-7L4 5Z"/>',
  download:'<path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 19h16"/>',
  compare:'<path d="M8 5H4v15h11v-4M16 4h4v15H9v-4"/><path d="M13 8h6M16 5l3 3-3 3"/>',
  alert:'<path d="M12 3v2M5.6 5.6 7 7M18.4 5.6 17 7M4 12H2M22 12h-2"/><path d="M6 18h12l-2-3v-3a4 4 0 0 0-8 0v3l-2 3Z"/>',
  candlestick:'<path d="M6 4v16M4 8h4v6H4V8ZM12 3v18M10 6h4v9h-4V6ZM18 5v14M16 10h4v5h-4v-5Z"/>',
  line:'<path d="m3 17 5-6 4 3 4-7 5 4"/>',
  table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 4v16"/>',
  discovery:'<circle cx="12" cy="12" r="8"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  terminal:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
  arrowUp:'<path d="m7 14 5-5 5 5"/>',
  arrowDown:'<path d="m7 10 5 5 5-5"/>',
  more:'<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>'
});

export function icon(name,{size=18,label='',className=''}={}){
  const path=paths[name]??paths.assets;
  const aria=label?`role="img" aria-label="${String(label).replaceAll('"','&quot;')}"`:'aria-hidden="true"';
  return `<svg class="q-icon ${className}" ${aria} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

export const iconNames=Object.freeze(Object.keys(paths));
