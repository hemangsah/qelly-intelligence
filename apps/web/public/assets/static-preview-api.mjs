const OBSERVED_AT = '2025-01-15T12:00:00.000Z';
const OBSERVED_UNIX = Math.floor(Date.parse(OBSERVED_AT) / 1000);
const TRUTH_BOUNDARY = 'Deterministic demo observations for the Static visual preview. Backend services are unavailable; this data is not live.';
const DEMO_GRAPH_ID = 'QELLY-DEMO-PROVENANCE-BTC-001';

const DEMO_ASSETS = [
  ['QI-CRYPTO-BTC', 'BTC', 'Bitcoin', 'Store of value', 42500, 1.84, 18420000000],
  ['QI-CRYPTO-ETH', 'ETH', 'Ethereum', 'Smart-contract platform', 2280, -0.62, 9120000000],
  ['QI-CRYPTO-SOL', 'SOL', 'Solana', 'Smart-contract platform', 98.4, 3.21, 1860000000],
  ['QI-CRYPTO-BNB', 'BNB', 'BNB', 'Exchange ecosystem', 312.6, 0.48, 734000000],
  ['QI-CRYPTO-XRP', 'XRP', 'XRP', 'Payments', 0.61, -1.17, 1280000000],
  ['QI-CRYPTO-ADA', 'ADA', 'Cardano', 'Smart-contract platform', 0.52, 2.03, 386000000]
].map(([canonicalId, symbol, name, category, price, change24h, quoteVolume24h], index) => ({
  canonicalId,
  id: canonicalId,
  symbol,
  providerSymbol: `${symbol}USDT`,
  name,
  assetClass: 'crypto',
  category,
  currency: 'USD',
  price,
  change24h,
  open24h: price / (1 + (change24h / 100)),
  high24h: price * (1.018 + (index * 0.001)),
  low24h: price * (0.973 - (index * 0.001)),
  volume24h: quoteVolume24h / price,
  quoteVolume24h,
  marketCap: null,
  marketCapDefinition: 'Unavailable in the deterministic demo dataset.',
  definitions: {
    marketCap: 'Unavailable in the deterministic demo dataset.'
  },
  source: {
    provider: 'qelly-static-demo',
    providerName: 'Qelly deterministic demo',
    attribution: 'Qelly deterministic demo · not live',
    observationTime: OBSERVED_AT,
    observedAt: OBSERVED_AT,
    ingestionTime: OBSERVED_AT,
    freshness: 'simulated',
    qualityState: 'simulated-demo',
    confidence: 0.5,
    cacheState: 'static-artifact',
    degraded: true,
    fallbackReason: 'Static visual preview: persistent API and external market providers are not connected.',
    entitlement: 'public-static-preview'
  }
}));

function clone(value) {
  return structuredClone(value);
}

function assetFor(value) {
  const decoded = decodeURIComponent(String(value ?? '')).toUpperCase();
  return DEMO_ASSETS.find((asset) => asset.canonicalId === decoded || asset.symbol === decoded);
}

function demoCandles(asset, limit) {
  const count = Math.max(24, Math.min(Number(limit) || 168, 240));
  const points = Array.from({ length: count }, (_, index) => {
    const wave = Math.sin(index / 5) * 0.018 + Math.cos(index / 11) * 0.009;
    const drift = ((index / Math.max(count - 1, 1)) - 0.5) * (asset.change24h / 100);
    const close = asset.price * (1 + wave + drift);
    const open = close * (1 - Math.sin(index / 3) * 0.0025);
    return {
      time: OBSERVED_UNIX - ((count - index - 1) * 3600),
      open,
      high: Math.max(open, close) * 1.004,
      low: Math.min(open, close) * 0.996,
      close,
      volume: (asset.quoteVolume24h / asset.price / 24) * (0.8 + ((index % 5) * 0.1))
    };
  });
  return {
    canonicalId: asset.canonicalId,
    assetName: asset.name,
    provider: 'qelly-static-demo',
    requestedProvider: null,
    symbol: asset.providerSymbol,
    interval: '1h',
    points,
    summary: {
      first: points[0].close,
      last: points.at(-1).close,
      minimum: Math.min(...points.map((point) => point.low)),
      maximum: Math.max(...points.map((point) => point.high))
    },
    source: {
      mode: 'simulated-demo',
      attribution: 'Qelly deterministic demo · not live',
      observedAt: OBSERVED_AT
    },
    guardrails: {
      live: false,
      executable: false,
      truthBoundary: TRUTH_BOUNDARY
    }
  };
}

function overview() {
  const advancers = DEMO_ASSETS.filter((asset) => asset.change24h > 0).length;
  const decliners = DEMO_ASSETS.filter((asset) => asset.change24h < 0).length;
  return {
    generatedAt: OBSERVED_AT,
    mode: 'simulated-demo',
    truthBoundary: TRUTH_BOUNDARY,
    items: DEMO_ASSETS,
    total: DEMO_ASSETS.length,
    breadth: { advancers, decliners, unchanged: DEMO_ASSETS.length - advancers - decliners },
    kpis: [
      { label: 'Demo assets', value: DEMO_ASSETS.length, unit: 'count', definition: 'Fixed instruments bundled with this static artifact.' },
      { label: 'Demo quote volume', value: DEMO_ASSETS.reduce((sum, asset) => sum + asset.quoteVolume24h, 0), unit: 'USD', definition: 'Deterministic example values; not provider observations.' },
      { label: 'Backend connections', value: 0, unit: 'count', definition: 'No persistent API, provider, database, queue or storage connection.' },
      { label: 'Live values', value: 0, unit: 'count', definition: 'This preview never labels fallback data as live.' }
    ],
    providerStatus: {
      provider: 'Qelly deterministic demo',
      status: 'backend-unavailable',
      lastSuccessAt: null,
      cacheEntries: 0
    }
  };
}

function config() {
  return {
    productName: 'Qelly Intelligence',
    productVersion: '0.9.0-preview.1',
    release: 'static-visual-preview',
    defaultRoute: 'market',
    routes: ['market', 'asset-rankings', 'asset', 'decision-provenance', 'feature-universe', 'about-qelly', 'theme-personas', 'auth-login', 'auth-register', 'auth-recovery', 'news-research'],
    auth: {
      authenticated: false,
      mode: 'static-visual-preview',
      productionIdentityEnabled: false,
      developmentIdentityEnabled: false,
      backendAvailable: false
    },
    csrf: { token: '' },
    liveTrading: false,
    preview: {
      label: 'Static visual preview',
      dataMode: 'deterministic-demo',
      backendAvailable: false,
      liveData: false,
      limitations: 'Authentication, persistence, external providers, workers and infrastructure are unavailable.'
    }
  };
}

function evidenceGraph(){
  const nodes=[
    {nodeId:'source-btc',type:'SourceRecord',label:'Qelly deterministic demo',classification:'demo-not-live',revision:1,data:{provider:'qelly-static-demo',observedAt:OBSERVED_AT,license:'bundled deterministic record'}},
    {nodeId:'observation-btc',type:'ProviderObservation',label:'BTC demo price observation',classification:'demo-not-live',revision:1,data:{canonicalId:'QI-CRYPTO-BTC',price:42500,currency:'USD'}},
    {nodeId:'normalization-btc',type:'NormalizedObservation',label:'Canonical BTC observation',classification:'derived-demo',revision:1,data:{canonicalId:'QI-CRYPTO-BTC',methodologyVersion:'static-preview-v1'}},
    {nodeId:'move-btc',type:'MarketMove',label:'Deterministic 24h move',classification:'derived-demo',revision:1,data:{change24h:1.84,horizon:'24h',causality:'not established'}},
    {nodeId:'hypothesis-btc',type:'Hypothesis',label:'Illustrative broad-risk hypothesis',classification:'user-assumption-demo',revision:1,data:{statement:'The move may reflect broad risk appetite.',uncertainty:'High'}},
    {nodeId:'risk-btc',type:'RiskAssessment',label:'Evidence limitation',classification:'governance',revision:1,data:{risk:'Demo observations cannot support a live market decision.'}},
    {nodeId:'decision-btc',type:'DecisionRecord',label:'Research further',classification:'demo-considered-action',revision:1,data:{action:'research-further',execution:'disabled'}}
  ];
  const edges=[
    ['edge-1','source-btc','observation-btc','supports'],
    ['edge-2','observation-btc','normalization-btc','derived from'],
    ['edge-3','normalization-btc','move-btc','derived from'],
    ['edge-4','move-btc','hypothesis-btc','considered in'],
    ['edge-5','risk-btc','hypothesis-btc','contradicts'],
    ['edge-6','hypothesis-btc','decision-btc','considered in'],
    ['edge-7','risk-btc','decision-btc','affects']
  ].map(([edgeId,fromNodeId,toNodeId,type])=>({edgeId,fromNodeId,toNodeId,type}));
  return {
    graphId:DEMO_GRAPH_ID,
    title:'BTC demo observation → considered research action',
    truthBoundary:'Static visual preview evidence package. All records are deterministic demo data, not live observations or financial advice.',
    generatedAt:OBSERVED_AT,
    nodes,
    edges,
    integrity:{valid:true,checksum:'demo-checksum-not-cryptographic'},
    textAlternative:{steps:[
      'Qelly deterministic demo supplied a fixed BTC observation.',
      'The observation was normalized to QI-CRYPTO-BTC using static-preview-v1.',
      'A 1.84% illustrative move was derived; causality was not established.',
      'A broad-risk hypothesis was considered and explicitly limited by unavailable live evidence.',
      'The only considered action is research further; execution is disabled.'
    ]}
  };
}

export async function staticPreviewRequest(path, options = {}) {
  const method = String(options.method ?? 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const error = new Error('Static visual preview: backend unavailable; this action was not executed.');
    error.status = 503;
    error.code = 'static_visual_preview_backend_unavailable';
    throw error;
  }

  const [pathname, query = ''] = String(path).split('?');
  const params = new URLSearchParams(query);

  if (pathname === '/api/v1/config') return clone(config());
  if (pathname === '/api/v1/auth/status') {
    return { authenticated: false, mode: 'static-visual-preview', backendAvailable: false };
  }
  if (pathname === '/api/v1/public/markets/overview') return clone(overview());
  if (pathname === '/api/v1/public/markets/assets') {
    return clone({ generatedAt: OBSERVED_AT, mode: 'simulated-demo', truthBoundary: TRUTH_BOUNDARY, total: DEMO_ASSETS.length, items: DEMO_ASSETS });
  }
  if (pathname === '/api/v1/public/providers') {
    return {
      generatedAt: OBSERVED_AT,
      mode: 'static-visual-preview',
      truthBoundary: TRUTH_BOUNDARY,
      items: [{
        id: 'qelly-static-demo',
        name: 'Qelly deterministic demo',
        status: 'simulated',
        live: false,
        backendAvailable: false,
        attribution: 'Bundled static demo values · not live'
      }]
    };
  }
  if(pathname==='/api/v1/evidence/graphs'){
    return clone({
      total:1,
      mode:'deterministic-demo',
      persistence:'unavailable',
      truthBoundary:'One deterministic demo evidence package. Persistence and authenticated workspace history are unavailable.',
      items:[{graphId:DEMO_GRAPH_ID,title:'BTC demo observation → considered research action',generatedAt:OBSERVED_AT,state:'demo-not-live'}]
    });
  }
  if(pathname===`/api/v1/evidence/graphs/${DEMO_GRAPH_ID}`)return clone(evidenceGraph());
  if(pathname===`/api/v1/evidence/graphs/${DEMO_GRAPH_ID}/export`){
    return clone({...evidenceGraph(),exportBoundary:'Demo export only. No live provider evidence or persistent audit record is included.'});
  }

  const candleMatch = pathname.match(/^\/api\/v1\/public\/markets\/assets\/([^/]+)\/candles$/);
  if (candleMatch) {
    const asset = assetFor(candleMatch[1]);
    if (asset) return clone(demoCandles(asset, params.get('limit')));
  }

  const assetMatch = pathname.match(/^\/api\/v1\/public\/markets\/assets\/([^/]+)$/);
  if (assetMatch) {
    const asset = assetFor(assetMatch[1]);
    if (asset) return clone(asset);
  }

  const error = new Error('Static visual preview: this route needs the unavailable backend.');
  error.status = 503;
  error.code = 'static_visual_preview_backend_unavailable';
  throw error;
}
