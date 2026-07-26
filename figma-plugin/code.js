const EXPECTED_FRAME_COUNT=411;
const PAGE_NAMES=[
  '01 — Cover and product principles',
  '02 — Brand foundation',
  '03 — Color tokens',
  '04 — Typography',
  '05 — Spacing and grids',
  '06 — Iconography',
  '07 — Motion system',
  '08 — Accessibility',
  '09 — Navigation architecture',
  '10 — Components',
  '11 — Data tables',
  '12 — Charts and heatmaps',
  '13 — Provenance components',
  '14 — Persona system',
  '15 — Responsive behavior',
  '16 — Public storytelling',
  '17 — Market discovery',
  '18 — Asset intelligence',
  '19 — Derivatives',
  '20 — Research',
  '21 — Portfolio',
  '22 — Operations',
  '23 — Trust and company',
  '24 — States and edge cases',
  '25 — Developer handoff'
];

const ROUTE_ROWS=`
auth-login|Secure Login|access|01 — Cover and product principles|identity service
auth-register|Create Organization|access|01 — Cover and product principles|identity service
auth-recovery|Recover Account|access|24 — States and edge cases|identity and delivery services
account-session|Session Center|operational|22 — Operations|identity service
security-setup|MFA Setup|operational|22 — Operations|identity and encryption services
passkey-center|Passkey Center|operational|22 — Operations|identity and WebAuthn services
account-recovery|Recovery Controls|operational|22 — Operations|identity and delivery services
secure-import-vault|Secure Import Vault|operational|22 — Operations|storage and scanner services
delivery-operations|Delivery Operations|operational|22 — Operations|worker and delivery services
platform-readiness|Platform Readiness|operational|22 — Operations|readiness dependencies
secret-rotation|Secret Rotation|operational|22 — Operations|keyring and audit services
quarantine-review|Quarantine Review|operational|22 — Operations|storage and ClamAV
staging-assurance|Staging Assurance|operational|22 — Operations|staging dependencies
live-markets|Live Market Command|analytical|17 — Market discovery|market provider and stream services
theme-personas|Theme Personas|public|14 — Persona system|layout preferences
feature-universe|Feature Universe|public|16 — Public storytelling|public content only
about-qelly|About Qelly|public|23 — Trust and company|public content only
discovery-hub|Discovery Overview|analytical|17 — Market discovery|discovery service
asset-rankings|Asset Rankings|analytical|17 — Market discovery|public market service
search|Universal Search|analytical|17 — Market discovery|search and entitlements
categories|Categories|analytical|17 — Market discovery|discovery service
venues|Venues|analytical|17 — Market discovery|discovery service
dex-discovery|DEX Discovery|analytical|17 — Market discovery|discovery service
global-charts|Global Charts|analytical|12 — Charts and heatmaps|discovery service
converter|Converter|analytical|17 — Market discovery|market observation service
news-research|News & Research|research|20 — Research|research and news services
trust-center|Trust Center|research|23 — Trust and company|provider status and methodology
asset-intelligence|Asset Intelligence|analytical|18 — Asset intelligence|asset intelligence service
advanced-chart|Advanced Chart Studio|analytical|12 — Charts and heatmaps|timeseries service
fundamentals-estimates|Fundamentals & Estimates|research|18 — Asset intelligence|asset intelligence service
filing-workspace|Filing Workspace|research|20 — Research|research and storage services
event-calendar|Event Calendar|research|20 — Research|event service
comparison-lab|Comparison Lab|analytical|18 — Asset intelligence|asset intelligence service
market|Market Overview|analytical|17 — Market discovery|public market service
rankings|Legacy Rankings|analytical|17 — Market discovery|market service
asset|Asset Dossier|analytical|18 — Asset intelligence|public market service
watchlist|Watchlists|analytical|21 — Portfolio|workspace service
alert-center|Alert Rules|operational|21 — Portfolio|alert and worker services
notification-center|Notifications|operational|21 — Portfolio|notification service
screener-lab|Screener Lab|analytical|17 — Market discovery|screener service
portfolio-analytics|Portfolio Analytics|analytical|21 — Portfolio|portfolio service
research-workspace|Research Workspace|research|20 — Research|research service
onboarding|Guided Onboarding|operational|22 — Operations|onboarding service
notification-schedules|Notification Schedules|operational|22 — Operations|worker and notification services
formula-screener|Formula Screener|analytical|17 — Market discovery|screener service
portfolio-attribution|Portfolio Attribution|analytical|21 — Portfolio|portfolio service
import-center|Import Center|operational|22 — Operations|import service
research-history|Research History|research|20 — Research|research service
migration-center|Migration Center|operational|22 — Operations|migration service
theme-lab|Theme Laboratory|operational|14 — Persona system|layout preferences
identity-access|Identity & Access|operational|22 — Operations|identity and authorization
data-mesh|Provider Runtime|operational|22 — Operations|provider runtime
instrument-master|Instrument Master|operational|22 — Operations|instrument service
timeseries-lab|Time Series Lab|analytical|12 — Charts and heatmaps|timeseries service
stream-operations|Stream Operations|operational|22 — Operations|stream service
observability|Observability Center|operational|22 — Operations|observability service
decision-provenance|Decision Provenance|research|13 — Provenance components|evidence service
security-evidence|Security Evidence|operational|23 — Trust and company|audit and security services
category-detail|Category Detail|analytical|17 — Market discovery|discovery service
venue-detail|Venue Detail|analytical|17 — Market discovery|discovery service
research-article|Research Article|research|20 — Research|research service
`.trim().split('\n').map((row)=>{
  const [route,label,kind,page,backend]=row.split('|');
  return {route,label,kind,page,backend};
});

const PERSONAS=[
  'Scalper Velocity',
  'Investor Compound',
  'Aggressive Alpha',
  'Quant Operator',
  'Research Oracle',
  'Signal Access'
];
const PRIORITY_ROUTES=['market','asset-rankings','asset','advanced-chart','decision-provenance','news-research','portfolio-analytics','watchlist','screener-lab','live-markets','trust-center','theme-personas'];
const STATES=['loading','empty','no-results','partial-provider-failure','stale','fallback-demo','permission-denied','offline'];
const OVERLAYS=[
  'Universal command search','Global asset search','Category navigator expanded','Workspace switcher','Compare tray',
  'Watchlist action','Explain This Move launcher','Notification center','Account panel','Mobile navigation',
  'Filter sheet','Column customizer','Density selector','Chart toolbar','Evidence panel','Provenance inspector',
  'Source tooltip','Confidence details','Freshness details','Provider status','Saved-view menu','Alert builder',
  'Export evidence dialog','Keyboard shortcut guide'
];

const COLORS={
  burgundyBlack:{r:0.031,g:0,b:0.012},
  burgundyCore:{r:0.192,g:0,b:0.067},
  burgundyBloom:{r:0.557,g:0.114,b:0.294},
  porcelain:{r:0.984,g:0.969,b:0.957},
  white:{r:1,g:1,b:1},
  graphite:{r:0.098,g:0.078,b:0.086},
  rose:{r:0.957,g:0.906,b:0.925},
  border:{r:0.847,g:0.796,b:0.812},
  muted:{r:0.424,g:0.353,b:0.38},
  green:{r:0.031,g:0.42,b:0.227},
  warning:{r:0.541,g:0.275,b:0}
};

const hex=(value)=>({r:parseInt(value.slice(1,3),16)/255,g:parseInt(value.slice(3,5),16)/255,b:parseInt(value.slice(5,7),16)/255});
const solid=(color,opacity=1)=>[{type:'SOLID',color,opacity}];

async function loadFonts(){
  await Promise.all([
    figma.loadFontAsync({family:'Inter',style:'Regular'}),
    figma.loadFontAsync({family:'Inter',style:'Medium'}),
    figma.loadFontAsync({family:'Inter',style:'Bold'})
  ]);
}

function textNode(characters,size=14,weight='Regular',color=COLORS.graphite){
  const node=figma.createText();
  node.fontName={family:'Inter',style:weight};
  node.fontSize=size;
  node.characters=characters;
  node.fills=solid(color);
  node.textAutoResize='HEIGHT';
  node.layoutAlign='STRETCH';
  return node;
}

function autoFrame(name,direction='VERTICAL',gap=12,padding=20){
  const frame=figma.createFrame();
  frame.name=name;
  frame.layoutMode=direction;
  frame.itemSpacing=gap;
  frame.paddingTop=padding;
  frame.paddingRight=padding;
  frame.paddingBottom=padding;
  frame.paddingLeft=padding;
  frame.primaryAxisSizingMode='AUTO';
  frame.counterAxisSizingMode='FIXED';
  frame.fills=solid(COLORS.white);
  frame.strokes=solid(COLORS.border);
  frame.strokeWeight=1;
  frame.cornerRadius=12;
  return frame;
}

function chip(label,tone=COLORS.burgundyBloom){
  const frame=autoFrame(`Chip / ${label}`,'HORIZONTAL',6,6);
  frame.paddingLeft=9;
  frame.paddingRight=9;
  frame.fills=solid(tone,.1);
  frame.strokes=solid(tone);
  frame.appendChild(textNode(label,12,'Medium',tone));
  return frame;
}

function metadataRows(spec){
  return [
    ['Route',spec.route],
    ['Purpose',spec.purpose],
    ['Viewport',spec.viewport],
    ['Persona',spec.persona],
    ['State',spec.state],
    ['Source requirements',spec.sources],
    ['Backend dependencies',spec.backend],
    ['Interaction notes',spec.interaction],
    ['Accessibility notes',spec.accessibility],
    ['Responsive notes',spec.responsive]
  ];
}

function composition(kind,state){
  const modules={
    public:['Identity proposition','Evidence narrative','Market pulse','Methodology / trust','Primary CTA'],
    analytical:['Pulse strip','Filter / timeframe controls','Primary chart or table','Source / freshness rail','Explain This Move'],
    research:['Abstract / thesis','Citation-rich evidence','Contradiction view','Provenance graph','Version / export'],
    operational:['Status summary','Dependency evidence','Controlled actions','Audit events','Failure guidance'],
    access:['Identity context','Secure form','Recovery path','Privacy boundary','Support guidance']
  }[kind]||['Primary content','Evidence context','Actions'];
  if(state!=='default')modules.unshift(`State treatment: ${state}`);
  return modules;
}

function createScreen(spec,width,height){
  const frame=autoFrame(spec.name,'HORIZONTAL',0,0);
  frame.resize(width,height);
  frame.clipsContent=true;
  frame.setPluginData('qellyFrame','true');
  frame.setPluginData('route',spec.route);
  frame.setPluginData('persona',spec.persona);
  frame.setPluginData('state',spec.state);

  const dock=autoFrame('Slim edge dock','VERTICAL',8,10);
  dock.resize(width<600?0:62,height);
  dock.fills=solid(COLORS.burgundyBlack);
  dock.strokes=[];
  if(width>=600){
    dock.appendChild(textNode('Q',18,'Bold',COLORS.white));
    ['◫','▤','⌘','◌','◎'].forEach((item)=>dock.appendChild(textNode(item,15,'Medium',COLORS.white)));
    frame.appendChild(dock);
  }else{
    dock.remove();
  }

  const body=autoFrame('Screen body','VERTICAL',14,18);
  body.layoutGrow=1;
  body.resize(width-(width>=600?62:0),height);
  body.fills=solid(spec.kind==='public'?COLORS.porcelain:COLORS.white);
  body.strokes=[];
  const header=autoFrame('Location and truth','HORIZONTAL',10,10);
  header.layoutAlign='STRETCH';
  header.fills=solid(COLORS.rose);
  header.strokes=[];
  header.appendChild(chip(spec.persona,COLORS.burgundyBloom));
  header.appendChild(chip(spec.state,spec.state==='default'?COLORS.green:COLORS.warning));
  header.appendChild(chip('Source + freshness',COLORS.muted));
  body.appendChild(header);
  body.appendChild(textNode(spec.name,width<600?22:32,'Bold',COLORS.burgundyCore));
  body.appendChild(textNode(spec.purpose,width<600?13:15,'Regular',COLORS.muted));

  const content=autoFrame('Route composition',width<800?'VERTICAL':'HORIZONTAL',12,0);
  content.layoutAlign='STRETCH';
  content.strokes=[];
  content.fills=[];
  const primary=autoFrame('Primary composition','VERTICAL',9,14);
  primary.layoutGrow=1;
  primary.fills=solid(COLORS.porcelain);
  composition(spec.kind,spec.state).forEach((label,index)=>{
    const module=autoFrame(`${index+1}. ${label}`,'HORIZONTAL',8,10);
    module.layoutAlign='STRETCH';
    module.fills=solid(index===0?COLORS.rose:COLORS.white);
    module.appendChild(textNode(label,13,index===0?'Bold':'Medium',COLORS.graphite));
    primary.appendChild(module);
  });
  content.appendChild(primary);
  const metadata=autoFrame('Handoff metadata','VERTICAL',7,12);
  metadata.resize(width<800?Math.max(260,width-36):330,100);
  metadata.fills=solid(COLORS.graphite);
  metadata.strokes=[];
  metadata.appendChild(textNode('FRAME CONTRACT',11,'Bold',COLORS.white));
  metadataRows(spec).forEach(([key,value])=>{
    metadata.appendChild(textNode(`${key.toUpperCase()}\n${value}`,10,'Regular',COLORS.white));
  });
  content.appendChild(metadata);
  body.appendChild(content);
  frame.appendChild(body);
  return frame;
}

function pageByShortName(pages,shortName){
  return pages.get(`QELLY · ${shortName}`);
}

function placeFrame(page,frame,index){
  const columns=4;
  const gap=120;
  frame.x=(index%columns)*(frame.width+gap);
  frame.y=Math.floor(index/columns)*(frame.height+gap);
  page.appendChild(frame);
}

function specFromRoute(route,viewport,persona='Default / inherited',state='default'){
  return {
    name:`${route.label} · ${viewport}`,
    route:`#/${route.route}`,
    purpose:`${route.label} ${route.kind} experience with explicit evidence and failure boundaries.`,
    viewport,
    persona,
    state,
    sources:'Canonical records; provider; observation and ingestion time; freshness; quality; confidence.',
    backend:route.backend,
    interaction:'Keyboard, pointer, touch, command search, and progressive disclosure.',
    accessibility:'Landmarks, visible focus, non-color state encoding, text alternatives, 200% zoom.',
    responsive:viewport==='mobile-390'?'Prioritised stack, filter sheet, touch chart, persistent truth metadata.':'Stable dense workspace with sticky context and bounded panels.',
    kind:route.kind
  };
}

function createStylesAndVariables(){
  const burgundy=figma.createPaintStyle();
  burgundy.name='Qelly / Brand / Burgundy Core';
  burgundy.paints=solid(COLORS.burgundyCore);
  const surface=figma.createPaintStyle();
  surface.name='Qelly / Surface / Porcelain';
  surface.paints=solid(COLORS.porcelain);
  const heading=figma.createTextStyle();
  heading.name='Qelly / Type / Heading 2';
  heading.fontName={family:'Inter',style:'Bold'};
  heading.fontSize=26;
  heading.lineHeight={unit:'PERCENT',value:120};
  if(figma.variables){
    const collection=figma.variables.createVariableCollection('Qelly semantic colors');
    const modeId=collection.modes[0].modeId;
    collection.renameMode(modeId,'Light');
    const surfaceVariable=figma.variables.createVariable('surface/default',collection.id,'COLOR');
    surfaceVariable.setValueForMode(modeId,{...COLORS.white,a:1});
    const evidenceVariable=figma.variables.createVariable('status/evidence',collection.id,'COLOR');
    evidenceVariable.setValueForMode(modeId,{...COLORS.burgundyBloom,a:1});
  }
}

function createComponents(page){
  const button=figma.createComponent();
  button.name='Button / Primary';
  button.layoutMode='HORIZONTAL';
  button.primaryAxisSizingMode='AUTO';
  button.counterAxisSizingMode='AUTO';
  button.paddingTop=10;button.paddingBottom=10;button.paddingLeft=16;button.paddingRight=16;
  button.cornerRadius=8;button.fills=solid(COLORS.burgundyCore);
  button.appendChild(textNode('Primary action',13,'Medium',COLORS.white));
  page.appendChild(button);

  const status=figma.createComponent();
  status.name='Status / Demo not live';
  status.layoutMode='HORIZONTAL';
  status.primaryAxisSizingMode='AUTO';
  status.counterAxisSizingMode='AUTO';
  status.paddingTop=6;status.paddingBottom=6;status.paddingLeft=9;status.paddingRight=9;
  status.cornerRadius=999;status.fills=solid(hex('#6941C6'),.1);status.strokes=solid(hex('#6941C6'));
  status.appendChild(textNode('◇ Demo · not live',12,'Medium',hex('#6941C6')));
  page.appendChild(status);
}

async function run(){
  await loadFonts();
  for(const page of [...figma.root.children]){
    if(page.type==='PAGE'&&page.getPluginData('qellyGenerated')==='true')page.remove();
  }
  const pages=new Map();
  for(const shortName of PAGE_NAMES){
    const page=figma.createPage();
    page.name=`QELLY · ${shortName}`;
    page.setPluginData('qellyGenerated','true');
    pages.set(page.name,page);
  }
  createStylesAndVariables();
  createComponents(pageByShortName(pages,'10 — Components'));

  let frameCount=0;
  const pageIndexes=new Map(PAGE_NAMES.map((name)=>[name,0]));
  const append=(pageName,frame)=>{
    const page=pageByShortName(pages,pageName);
    const index=pageIndexes.get(pageName)??0;
    placeFrame(page,frame,index);
    pageIndexes.set(pageName,index+1);
    frameCount+=1;
  };

  for(const pageName of PAGE_NAMES){
    append(pageName,createScreen({
      name:`${pageName} · Foundation`,
      route:'design-system',
      purpose:`Editable Qelly foundation for ${pageName.replace(/^\d+ — /,'')}.`,
      viewport:'desktop-1440',
      persona:'All personas',
      state:'governed-foundation',
      sources:'QELLY_DESIGN_TOKENS.json and canonical repository contracts.',
      backend:'None for design foundation.',
      interaction:'Editable auto-layout, variables, styles, and component instances.',
      accessibility:'WCAG 2.2 AA annotations and non-color state encoding.',
      responsive:'Constraints documented for mobile, tablet, desktop, and analytical-wide.',
      kind:pageName.includes('Public')?'public':pageName.includes('Research')?'research':pageName.includes('Operations')?'operational':'analytical'
    },1440,900));
  }

  for(const route of ROUTE_ROWS){
    append(route.page,createScreen(specFromRoute(route,'desktop-1440'),1440,900));
    append(route.page,createScreen(specFromRoute(route,'mobile-390'),390,844));
  }

  for(const persona of PERSONAS){
    for(const routeId of PRIORITY_ROUTES){
      const route=ROUTE_ROWS.find((item)=>item.route===routeId);
      const desktop=specFromRoute(route,'desktop-1440',persona,'persona-priority');
      desktop.name=`${route.label} · ${persona} · desktop`;
      desktop.purpose=`${persona} priority composition for ${route.label}; source, risk, and provenance remain mandatory.`;
      append('14 — Persona system',createScreen(desktop,1440,900));
      const mobile=specFromRoute(route,'mobile-390',persona,'persona-priority');
      mobile.name=`${route.label} · ${persona} · mobile`;
      mobile.purpose=desktop.purpose;
      append('14 — Persona system',createScreen(mobile,390,844));
    }
  }

  for(const routeId of PRIORITY_ROUTES){
    const route=ROUTE_ROWS.find((item)=>item.route===routeId);
    for(const state of STATES){
      const spec=specFromRoute(route,'desktop-1440','Default / inherited',state);
      spec.name=`${route.label} · ${state}`;
      spec.purpose=`${route.label} ${state} treatment that preserves layout, truth labels, recovery guidance, and accessible meaning.`;
      append('24 — States and edge cases',createScreen(spec,1440,900));
    }
  }

  OVERLAYS.forEach((name,index)=>{
    const kind=name.includes('Evidence')||name.includes('Provenance')||name.includes('Source')?'research':'analytical';
    const pageName=kind==='research'?'13 — Provenance components':index<10?'09 — Navigation architecture':'10 — Components';
    append(pageName,createScreen({
      name:`Overlay · ${name}`,
      route:'global-overlay',
      purpose:`Editable ${name} interaction with bounded focus and explicit context.`,
      viewport:index%3===0?'mobile-390':'desktop-1440',
      persona:'All personas',
      state:'overlay-open',
      sources:'Inherited from the invoking route; never stripped from the overlay.',
      backend:'Invoking route contract; static preview rejects mutations.',
      interaction:'Escape closes; focus is trapped where modal; trigger regains focus.',
      accessibility:'Named control, logical focus order, no keyboard trap, visible focus.',
      responsive:'Drawer or sheet on mobile; anchored panel or dialog on desktop.',
      kind
    },index%3===0?390:1440,index%3===0?844:900));
  });

  if(frameCount!==EXPECTED_FRAME_COUNT)throw new Error(`Expected ${EXPECTED_FRAME_COUNT} frames, generated ${frameCount}`);
  figma.currentPage=pageByShortName(pages,'01 — Cover and product principles');
  figma.viewport.scrollAndZoomIntoView(figma.currentPage.children.slice(0,1));
  figma.notify(`Qelly governed design system generated: ${frameCount} editable frames across ${PAGE_NAMES.length} pages.`);
  figma.closePlugin(`Generated ${frameCount} editable Qelly frames.`);
}

run().catch((error)=>{
  figma.notify(`Qelly generator failed: ${error.message}`,{error:true});
  figma.closePlugin(error.message);
});
