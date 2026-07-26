const routes = [
  { section:'Access', route:'auth-login', label:'Secure Login', icon:'↳', meta:'A1', public:true, anonymousOnly:true },
  { section:'Access', route:'auth-register', label:'Create Organization', icon:'＋', meta:'A1', public:true, anonymousOnly:true },
  { section:'Access', route:'auth-recovery', label:'Recover Account', icon:'↺', meta:'A4', public:true, anonymousOnly:true },
  { section:'Account', route:'account-session', label:'Session Center', icon:'⌾', meta:'A1' },
  { section:'Account', route:'security-setup', label:'MFA Setup', icon:'◈', meta:'A2' },
  { section:'Account', route:'passkey-center', label:'Passkey Center', icon:'⌁', meta:'A3' },
  { section:'Account', route:'account-recovery', label:'Recovery Controls', icon:'⌘', meta:'A3' },
  { section:'Operations', route:'secure-import-vault', label:'Secure Import Vault', icon:'⇧', meta:'A2' },
  { section:'Operations', route:'delivery-operations', label:'Delivery Operations', icon:'⇶', meta:'A3' },
  { section:'Operations', route:'platform-readiness', label:'Platform Readiness', icon:'◌', meta:'A4' },
  { section:'Security', route:'secret-rotation', label:'Secret Rotation', icon:'◇', meta:'A5' },
  { section:'Operations', route:'quarantine-review', label:'Quarantine Review', icon:'▣', meta:'A5' },
  { section:'Operations', route:'staging-assurance', label:'Staging Assurance', icon:'◎', meta:'A5' },
  { section:'Live', route:'live-markets', label:'Live Market Command', icon:'◭', meta:'P22' },
  { section:'Experience', route:'theme-personas', label:'Theme Personas', icon:'◐', meta:'P22' },
  { section:'Experience', route:'feature-universe', label:'Feature Universe', icon:'✦', meta:'P22' , public:true },
  { section:'Company', route:'about-qelly', label:'About Qelly', icon:'Q', meta:'P22' , public:true },
  { section:'Discover', route:'discovery-hub', label:'Discovery Overview', icon:'◆', meta:'W5' },
  { section:'Discover', route:'asset-rankings', label:'Asset Rankings', icon:'≋', meta:'W5' , public:true },
  { section:'Discover', route:'search', label:'Universal Search', icon:'⌕', meta:'W5' },
  { section:'Discover', route:'categories', label:'Categories', icon:'▦', meta:'W5' },
  { section:'Discover', route:'venues', label:'Venues', icon:'⌂', meta:'W5' },
  { section:'Discover', route:'dex-discovery', label:'DEX Discovery', icon:'⌁', meta:'W5' },
  { section:'Discover', route:'global-charts', label:'Global Charts', icon:'⌇', meta:'W5' },
  { section:'Discover', route:'converter', label:'Converter', icon:'⇄', meta:'W5' },
  { section:'Discover', route:'news-research', label:'News & Research', icon:'▤', meta:'W5' },
  { section:'Discover', route:'trust-center', label:'Trust Center', icon:'✓', meta:'W5' },
  { section:'Intelligence', route:'asset-intelligence', label:'Asset Intelligence', icon:'◈', meta:'W6' },
  { section:'Intelligence', route:'advanced-chart', label:'Advanced Chart Studio', icon:'⌁', meta:'W6' },
  { section:'Intelligence', route:'fundamentals-estimates', label:'Fundamentals & Estimates', icon:'▥', meta:'W6' },
  { section:'Intelligence', route:'filing-workspace', label:'Filing Workspace', icon:'▤', meta:'W6' },
  { section:'Intelligence', route:'event-calendar', label:'Event Calendar', icon:'▦', meta:'W6' },
  { section:'Intelligence', route:'comparison-lab', label:'Comparison Lab', icon:'⇆', meta:'W6' },
  { section:'Intelligence', route:'market', label:'Market Overview', icon:'◫', meta:'W1' , public:true },
  { section:'Intelligence', route:'rankings', label:'Legacy Rankings', icon:'≋', meta:'W1' },
  { section:'Workspace', route:'asset', label:'Asset Dossier', icon:'◉', meta:'W1' , public:true },
  { section:'Workspace', route:'watchlist', label:'Watchlists', icon:'☆', meta:'W7' },
  { section:'Workspace', route:'alert-center', label:'Alert Rules', icon:'⚑', meta:'W7' },
  { section:'Workspace', route:'notification-center', label:'Notifications', icon:'◇', meta:'W7' },
  { section:'Workspace', route:'screener-lab', label:'Screener Lab', icon:'⌘', meta:'W7' },
  { section:'Workspace', route:'portfolio-analytics', label:'Portfolio Analytics', icon:'◒', meta:'W7' },
  { section:'Workspace', route:'research-workspace', label:'Research Workspace', icon:'▧', meta:'W7' },
  { section:'Workspace', route:'onboarding', label:'Guided Onboarding', icon:'◎', meta:'P21' },
  { section:'Workspace', route:'notification-schedules', label:'Notification Schedules', icon:'◷', meta:'P21' },
  { section:'Workspace', route:'formula-screener', label:'Formula Screener', icon:'ƒ', meta:'P21' },
  { section:'Workspace', route:'portfolio-attribution', label:'Portfolio Attribution', icon:'◔', meta:'P21' },
  { section:'Workspace', route:'import-center', label:'Import Center', icon:'⇥', meta:'P21' },
  { section:'Workspace', route:'research-history', label:'Research History', icon:'◫', meta:'P21' },
  { section:'Operations', route:'migration-center', label:'Migration Center', icon:'▥', meta:'P21' },
  { section:'Platform', route:'theme-lab', label:'Theme Laboratory', icon:'◐', meta:'W1' },
  { section:'Control', route:'identity-access', label:'Identity & Access', icon:'⌾', meta:'W2' },
  { section:'Control', route:'data-mesh', label:'Provider Runtime', icon:'⌁', meta:'W3' },
  { section:'Control', route:'instrument-master', label:'Instrument Master', icon:'◇', meta:'W3' },
  { section:'Data Plane', route:'timeseries-lab', label:'Time Series Lab', icon:'⌇', meta:'W4' },
  { section:'Data Plane', route:'stream-operations', label:'Stream Operations', icon:'⇶', meta:'W4' },
  { section:'Operations', route:'observability', label:'Observability Center', icon:'◌', meta:'W4' },
  { section:'Evidence', route:'decision-provenance', label:'Decision Provenance', icon:'⌘', meta:'Scope A' },
  { section:'Evidence', route:'security-evidence', label:'Security Evidence', icon:'▣', meta:'W2' },
  { section:'Detail', route:'category-detail', label:'Category Detail', icon:'▦', meta:'W5', hidden:true },
  { section:'Detail', route:'venue-detail', label:'Venue Detail', icon:'⌂', meta:'W5', hidden:true },
  { section:'Detail', route:'research-article', label:'Research Article', icon:'▤', meta:'W5', hidden:true }
];

export const productDomains = [
  { id:'home', label:'Home', shortLabel:'Home', icon:'Q', defaultRoute:'feature-universe', destinations:['Home','Product','Company','Learning'] },
  { id:'markets', label:'Markets', shortLabel:'Markets', icon:'◫', defaultRoute:'market', destinations:['Markets','Discovery','Assets','Derivatives','Exchanges','Charts','Screener'] },
  { id:'research', label:'Research', shortLabel:'Research', icon:'▤', defaultRoute:'news-research', destinations:['Research','News','Events','Learning'] },
  { id:'workspaces', label:'Workspaces', shortLabel:'Work', icon:'▧', defaultRoute:'watchlist', destinations:['Portfolio','Watchlists','Alerts','Workspaces','Settings'] },
  { id:'evidence', label:'Evidence', shortLabel:'Evidence', icon:'⌘', defaultRoute:'decision-provenance', destinations:['Decision Provenance','Evidence','Trust'] },
  { id:'data', label:'Data plane', shortLabel:'Data', icon:'⌁', defaultRoute:'data-mesh', destinations:['Data Sources','Developer/API','Operations'] },
  { id:'operations', label:'Operations', shortLabel:'Ops', icon:'◌', defaultRoute:'platform-readiness', destinations:['Operations','Security','Trust'] },
  { id:'account', label:'Account', shortLabel:'Account', icon:'◎', defaultRoute:'account-session', destinations:['Settings','Workspaces','Team'] },
  { id:'experience', label:'Experience', shortLabel:'Mode', icon:'◐', defaultRoute:'theme-personas', destinations:['Personas','Navigation','Accessibility'] }
];

const explicitDomain = {
  'feature-universe':'home','about-qelly':'home',
  market:'markets',rankings:'markets','asset-rankings':'markets','discovery-hub':'markets',search:'markets',categories:'markets','category-detail':'markets',venues:'markets','venue-detail':'markets','dex-discovery':'markets','global-charts':'markets',converter:'markets',asset:'markets','asset-intelligence':'markets','advanced-chart':'markets','live-markets':'markets',
  'news-research':'research','research-article':'research','research-workspace':'research','research-history':'research','filing-workspace':'research','fundamentals-estimates':'research','event-calendar':'research','comparison-lab':'research',
  watchlist:'workspaces','alert-center':'workspaces','notification-center':'workspaces','notification-schedules':'workspaces','screener-lab':'workspaces','formula-screener':'workspaces','portfolio-analytics':'workspaces','portfolio-attribution':'workspaces',onboarding:'workspaces','import-center':'workspaces',
  'decision-provenance':'evidence','security-evidence':'evidence','trust-center':'evidence',
  'data-mesh':'data','instrument-master':'data','timeseries-lab':'data','stream-operations':'data',
  'secure-import-vault':'operations','delivery-operations':'operations','platform-readiness':'operations','secret-rotation':'operations','quarantine-review':'operations','staging-assurance':'operations','migration-center':'operations',observability:'operations','identity-access':'operations',
  'auth-login':'account','auth-register':'account','auth-recovery':'account','account-session':'account','security-setup':'account','passkey-center':'account','account-recovery':'account',
  'theme-personas':'experience','theme-lab':'experience'
};

const publicStoryRoutes = new Set(['feature-universe','about-qelly','theme-personas']);
const researchRoutes = new Set(['news-research','research-article','research-workspace','research-history','filing-workspace','fundamentals-estimates','event-calendar','trust-center','decision-provenance']);
const operationalRoutes = new Set(['secure-import-vault','delivery-operations','platform-readiness','secret-rotation','quarantine-review','staging-assurance','migration-center','observability','identity-access','data-mesh','instrument-master','timeseries-lab','stream-operations','security-evidence','theme-lab']);
const accessRoutes = new Set(['auth-login','auth-register','auth-recovery','account-session','security-setup','passkey-center','account-recovery']);

function routeKind(route){
  if(publicStoryRoutes.has(route))return 'public-story';
  if(researchRoutes.has(route))return 'research';
  if(operationalRoutes.has(route))return 'operational';
  if(accessRoutes.has(route))return 'access';
  return 'analytical';
}

export const routeDefinitions = routes.map((item)=>({
  ...item,
  domain:explicitDomain[item.route]??'markets',
  kind:routeKind(item.route)
}));

export function domainForRoute(route){
  return routeDefinitions.find((item)=>item.route===route)?.domain??'markets';
}
