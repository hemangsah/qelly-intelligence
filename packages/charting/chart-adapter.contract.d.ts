export type FreshnessClass = 'live' | 'delayed' | 'cached' | 'stale' | 'simulated' | 'unavailable';
export interface ChartPoint { time: string; value: string; volume?: string | null; }
export interface ChartMetadata {
  canonicalEntityId: string;
  provider: string;
  source: string;
  observedAt: string;
  receivedAt: string;
  freshnessClass: FreshnessClass;
  confidence: number;
  qualityFlags: string[];
  entitlementClass: string;
}
export interface ChartRequest {
  canonicalEntityId: string;
  interval: '1m' | '5m' | '15m' | '1h' | '1d' | '1w';
  from: string;
  to: string;
  adjusted?: boolean;
  currency?: string;
}
export interface ChartAdapter {
  loadSeries(request: ChartRequest, signal?: AbortSignal): Promise<{ points: ChartPoint[]; metadata: ChartMetadata }>;
  subscribe?(request: ChartRequest, onDelta: (point: ChartPoint, sequence: number) => void): () => void;
}
