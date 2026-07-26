import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PERSONA_PROFILES } from '../apps/web/public/assets/persona-profiles.mjs';
import { routeDefinitions } from '../apps/web/public/assets/route-registry.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const quote=(value)=>`"${String(value??'').replaceAll('"','""').replaceAll(/\r?\n/g,' ')}"`;
const csv=(headers,rows)=>`${headers.map(quote).join(',')}\n${rows.map((row)=>headers.map((header)=>quote(row[header])).join(',')).join('\n')}\n`;

const pageNames=[
  '01 — Cover and product principles','02 — Brand foundation','03 — Color tokens','04 — Typography','05 — Spacing and grids',
  '06 — Iconography','07 — Motion system','08 — Accessibility','09 — Navigation architecture','10 — Components',
  '11 — Data tables','12 — Charts and heatmaps','13 — Provenance components','14 — Persona system','15 — Responsive behavior',
  '16 — Public storytelling','17 — Market discovery','18 — Asset intelligence','19 — Derivatives','20 — Research',
  '21 — Portfolio','22 — Operations','23 — Trust and company','24 — States and edge cases','25 — Developer handoff'
];

const pageForRoute=(route)=>{
  if(['feature-universe'].includes(route))return pageNames[15];
  if(['about-qelly','trust-center','security-evidence'].includes(route))return pageNames[22];
  if(['market','rankings','asset-rankings','discovery-hub','search','categories','category-detail','venues','venue-detail','dex-discovery','converter','screener-lab','formula-screener'].includes(route))return pageNames[16];
  if(['asset','asset-intelligence','fundamentals-estimates','comparison-lab'].includes(route))return pageNames[17];
  if(['advanced-chart','global-charts','timeseries-lab'].includes(route))return pageNames[11];
  if(['news-research','research-article','research-workspace','research-history','filing-workspace','event-calendar'].includes(route))return pageNames[19];
  if(['portfolio-analytics','portfolio-attribution','watchlist','alert-center','notification-center'].includes(route))return pageNames[20];
  if(route==='decision-provenance')return pageNames[12];
  if(['theme-personas','theme-lab'].includes(route))return pageNames[13];
  if(['auth-login','auth-register'].includes(route))return pageNames[0];
  if(route==='auth-recovery')return pageNames[23];
  return pageNames[21];
};

const backendForRoute=(route)=>{
  const domain={
    markets:'Market, discovery, instrument, timeseries, or provider service as declared by the route contract.',
    research:'Research, evidence, event, or asset-intelligence service as declared by the route contract.',
    workspaces:'Workspace, portfolio, screener, alert, notification, import, or research service.',
    evidence:'Evidence, audit, methodology, and provider-status services.',
    data:'Provider runtime, instrument, timeseries, stream, and entitlement services.',
    operations:'Identity, storage, scanner, worker, observability, delivery, or readiness services.',
    account:'Identity and session services.',
    experience:'Layout preference service; visual fallback remains local.',
    home:'Public content; optional read-only market service.'
  }[route.domain];
  return domain??'Declared route contract.';
};

const routeRows=routeDefinitions.map((route,index)=>({
  index:index+1,
  route:`#/${route.route}`,
  label:route.label,
  domain:route.domain,
  kind:route.kind,
  section:route.section,
  public:Boolean(route.public),
  purpose:`Executable ${route.label} ${route.kind} route.`,
  data_contract:backendForRoute(route),
  completion_criteria:'Renders; exposes loading, empty, error, stale/fallback truth; keyboard and responsive behavior; source metadata where data appears.',
  current_status:'executable-existing; governed-shell-migration-applied'
}));

const screenRows=[];
const add=(row)=>screenRows.push({frame_id:`QF-${String(screenRows.length+1).padStart(4,'0')}`,...row});
const common={
  source_requirements:'Canonical record; provider/source; observation and ingestion time; freshness; quality; confidence; fallback reason.',
  interaction_notes:'Keyboard, pointer, touch, command search, and progressive disclosure.',
  accessibility_notes:'Landmarks, visible focus, non-color state encoding, accessible names, text alternative, 200% zoom.',
  responsive_notes:'Preserve source and confidence; prioritise content rather than shrinking desktop.'
};

pageNames.forEach((page)=>add({
  page,
  frame_name:`${page} · Foundation`,
  route:'design-system',
  purpose:`Editable foundation for ${page.replace(/^\d+ — /,'')}.`,
  viewport:'desktop-1440',
  persona:'All personas',
  state:'governed-foundation',
  ...common,
  backend_dependencies:'None for design foundation.'
}));

routeDefinitions.forEach((route)=>{
  for(const viewport of ['desktop-1440','mobile-390']){
    add({
      page:pageForRoute(route.route),
      frame_name:`${route.label} · ${viewport}`,
      route:`#/${route.route}`,
      purpose:`${route.label} ${route.kind} experience with explicit evidence and failure boundaries.`,
      viewport,
      persona:'Default / inherited',
      state:'default',
      ...common,
      backend_dependencies:backendForRoute(route),
      responsive_notes:viewport==='mobile-390'?'Prioritised stack, filter sheet, touch-safe controls, persistent truth metadata.':'Stable dense workspace with sticky context and bounded panels.'
    });
  }
});

const priorityRoutes=['market','asset-rankings','asset','advanced-chart','decision-provenance','news-research','portfolio-analytics','watchlist','screener-lab','live-markets','trust-center','theme-personas'];
PERSONA_PROFILES.forEach((persona)=>{
  priorityRoutes.forEach((routeName)=>{
    const route=routeDefinitions.find((item)=>item.route===routeName);
    for(const viewport of ['desktop-1440','mobile-390']){
      add({
        page:pageNames[13],
        frame_name:`${route.label} · ${persona.name} · ${viewport}`,
        route:`#/${route.route}`,
        purpose:`${persona.name} priority composition for ${route.label}; risk and provenance remain mandatory.`,
        viewport,
        persona:persona.name,
        state:'persona-priority',
        ...common,
        backend_dependencies:backendForRoute(route),
        responsive_notes:viewport==='mobile-390'?'Persona priorities collapse to an essential ordered stack.':'Persona priorities alter order, density, horizon, and emphasis.'
      });
    }
  });
});

const states=['loading','empty','no-results','partial-provider-failure','stale','fallback-demo','permission-denied','offline'];
priorityRoutes.forEach((routeName)=>{
  const route=routeDefinitions.find((item)=>item.route===routeName);
  states.forEach((state)=>add({
    page:pageNames[23],
    frame_name:`${route.label} · ${state}`,
    route:`#/${route.route}`,
    purpose:`${route.label} ${state} treatment preserving geometry, truth labels, and recovery guidance.`,
    viewport:'desktop-1440',
    persona:'Default / inherited',
    state,
    ...common,
    backend_dependencies:backendForRoute(route),
    interaction_notes:'Recovery action, source inspector, and route navigation remain operable.',
    accessibility_notes:'State announced once; focus remains stable; meaning is not color-only.'
  }));
});

const overlays=[
  'Universal command search','Global asset search','Category navigator expanded','Workspace switcher','Compare tray','Watchlist action',
  'Explain This Move launcher','Notification center','Account panel','Mobile navigation','Filter sheet','Column customizer','Density selector',
  'Chart toolbar','Evidence panel','Provenance inspector','Source tooltip','Confidence details','Freshness details','Provider status',
  'Saved-view menu','Alert builder','Export evidence dialog','Keyboard shortcut guide'
];
overlays.forEach((name,index)=>add({
  page:index<10?pageNames[8]:name.includes('Evidence')||name.includes('Provenance')||name.includes('Source')?pageNames[12]:pageNames[9],
  frame_name:`Overlay · ${name}`,
  route:'global-overlay',
  purpose:`Editable ${name} interaction with bounded focus and explicit context.`,
  viewport:index%3===0?'mobile-390':'desktop-1440',
  persona:'All personas',
  state:'overlay-open',
  ...common,
  backend_dependencies:'Inherited from invoking route; static preview rejects mutations.',
  interaction_notes:'Escape closes when modal; focus is bounded and returns to the trigger.',
  accessibility_notes:'Named control, logical focus order, visible focus, and no keyboard trap.',
  responsive_notes:'Sheet or full-width drawer on mobile; anchored panel or dialog on desktop.'
}));

if(screenRows.length!==411)throw new Error(`Expected 411 screen-matrix rows, received ${screenRows.length}`);

const components=[
  ['Button','default hover active pressed focus selected loading disabled error warning success','Enter/Space','full-width option'],
  ['Icon button','default hover active pressed focus selected loading disabled','Enter/Space; accessible name required','44px touch target'],
  ['Split button','default hover focus expanded disabled','Arrow keys and Enter','menu becomes sheet'],
  ['Segmented control','default hover focus selected disabled','Arrow keys','horizontal scroll'],
  ['Tabs','default hover focus selected disabled','Arrow keys Home End','scrollable tab rail'],
  ['Filter chip','default hover focus selected disabled','Enter/Space/Delete','wrap or horizontal rail'],
  ['Status indicator','live delayed estimated derived demo fallback stale unavailable','read-only semantics','never color-only'],
  ['Text field','default hover focus filled error disabled','native editing','full width'],
  ['Combobox','closed open loading no-results error disabled','Arrow keys Enter Escape','sheet on narrow screens'],
  ['Date/time selector','default focus invalid disabled','native or roving grid','modal sheet'],
  ['Asset selector','default open loading no-results permission','search and arrows','full-screen search'],
  ['Range selector','default hover focus selected disabled','Arrow keys','touch-safe presets'],
  ['Slider','default focus disabled error','Arrow keys Home End','large thumb'],
  ['Switch','on off focus disabled','Space','label remains visible'],
  ['Checkbox','checked mixed unchecked focus disabled','Space','44px label target'],
  ['Radio group','default selected focus disabled','Arrow keys','stacked'],
  ['Tooltip','hidden visible focus-triggered','Escape','popover alternative'],
  ['Popover','closed open loading error','Escape focus return','drawer alternative'],
  ['Menu','closed open selected disabled','Arrow keys typeahead Escape','sheet alternative'],
  ['Drawer','closed opening open error','Escape focus trap','full height'],
  ['Modal','closed open loading error','Escape focus trap','full-screen option'],
  ['Command palette','closed open results empty error','Ctrl/Cmd+K arrows Enter Escape','full-screen'],
  ['Toast','neutral success warning error','dismiss button','bottom safe area'],
  ['Inline notice','info warning error success demo','read in document order','stacked'],
  ['Banner','live delayed stale fallback demo unavailable','landmark where persistent','wraps'],
  ['Breadcrumbs','default current overflow','links and buttons','collapses safely'],
  ['Pagination','default current disabled loading','Tab Enter','compact controls'],
  ['Data table','loading empty no-results partial stale fallback error','table semantics and sort controls','priority cards/horizontal grid'],
  ['Column customizer','closed open selected disabled','checkboxes and search','sheet'],
  ['Density selector','comfortable compact terminal','radio/segmented','compact menu'],
  ['Chart toolbar','default selected disabled unavailable','roving controls','scrollable rail'],
  ['Evidence panel','loading empty partial stale fallback error','tree/list navigation','drawer'],
  ['Provenance inspector','graph list loading orphan error','keyboard graph plus list','list first'],
  ['Source tooltip','live delayed stale fallback unavailable','focus-triggered','inline disclosure'],
  ['Confidence indicator','high medium low unavailable','read-only label','text plus progress'],
  ['Freshness indicator','live delayed stale fallback unavailable','read-only label','icon plus text'],
  ['Provider status','operational partial degraded unavailable','read-only disclosure','stacked'],
  ['Skeleton','first-load incremental fixed-size','aria-busy on owner','fixed dimensions'],
  ['Empty state','first-use no-results filtered permission','recovery action','prioritised copy'],
  ['Maintenance state','planned unplanned offline','status and retry','full-route fallback']
].map(([component,states,keyboard,mobile])=>({component,states,keyboard_behavior:keyboard,mobile_behavior:mobile,implementation_status:'foundation-contract; route adoption incremental'}));

await Promise.all([
  writeFile(path.join(root,'QELLY_ROUTE_INVENTORY.csv'),csv(Object.keys(routeRows[0]),routeRows)),
  writeFile(path.join(root,'QELLY_SCREEN_MATRIX.csv'),csv(Object.keys(screenRows[0]),screenRows)),
  writeFile(path.join(root,'QELLY_COMPONENT_INVENTORY.csv'),csv(Object.keys(components[0]),components))
]);

console.log(JSON.stringify({status:'qelly-design-inventory-built',routes:routeRows.length,frames:screenRows.length,components:components.length},null,2));
