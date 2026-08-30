const TOP_LEVEL_PUBLIC_API_ROUTES=Object.freeze([
  '/api/health',
  '/api/ready'
]);

const PUBLIC_V1_API_PATHS=Object.freeze([
  '/api/v1/config',
  '/api/v1/auth/status',
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/passkeys/authenticate/options',
  '/api/v1/auth/passkeys/authenticate/verify',
  '/api/v1/auth/recovery/request',
  '/api/v1/auth/recovery/status',
  '/api/v1/auth/recovery/reset',
  '/api/v1/production-foundation/status',
  '/api/v1/platform/capabilities',
  '/api/v1/search',
  '/api/v1/public/markets/overview',
  '/api/v1/public/markets/assets',
  '/api/v1/public/providers',
  '/api/v1/providers/status',
  '/api/v1/providers/ecb',
  '/api/v1/calculations/metadata',
  '/api/v1/calculations/formulas',
  '/api/v1/calculations/run',
  '/api/v1/calculations/batch',
  '/api/v1/indicators',
  '/api/v1/indicators/run',
  '/api/v1/india/rules',
  '/api/v1/india/charges'
]);

const PUBLIC_V1_TEMPLATE_ROUTES=Object.freeze([
  '/api/v1/public/markets/assets/:id',
  '/api/v1/public/markets/assets/:id/candles',
  '/api/v1/calculations/formulas/:id',
  '/api/v1/indicators/:id'
]);

const TOP_LEVEL_PUBLIC_SET=new Set(TOP_LEVEL_PUBLIC_API_ROUTES);
const PUBLIC_V1_SET=new Set(PUBLIC_V1_API_PATHS);

function templateRoutePattern(route){
  const source=String(route).split('/').map((segment)=>{
    if(segment.startsWith(':'))return '[^/]+';
    return segment.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  }).join('/');
  return new RegExp(`^${source}$`);
}

const PUBLIC_V1_TEMPLATE_PATTERNS=Object.freeze(PUBLIC_V1_TEMPLATE_ROUTES.map(templateRoutePattern));
const PUBLIC_V1_TEMPLATE_SET=new Set(PUBLIC_V1_TEMPLATE_ROUTES);

export function isPublicApiContractRoute(route){
  const value=String(route||'');
  return TOP_LEVEL_PUBLIC_SET.has(value)||PUBLIC_V1_SET.has(value)||PUBLIC_V1_TEMPLATE_SET.has(value);
}

export function isPublicApiRequestPath(pathname){
  const value=String(pathname||'');
  return TOP_LEVEL_PUBLIC_SET.has(value)||PUBLIC_V1_SET.has(value)||PUBLIC_V1_TEMPLATE_PATTERNS.some((pattern)=>pattern.test(value));
}

export function classifyApiContractAccess(route){
  return isPublicApiContractRoute(route)?'public':'authenticated-or-policy-dependent';
}

export {TOP_LEVEL_PUBLIC_API_ROUTES,PUBLIC_V1_API_PATHS,PUBLIC_V1_TEMPLATE_ROUTES};
