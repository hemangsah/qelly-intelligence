/* Reuse within the same UTC ingest day only. No trading-day assumptions. */
export function shouldReuseEcbDailyCache(cached,now=new Date()){
  if(!cached||!(now instanceof Date)||!Number.isFinite(now.getTime()))return false;
  const until=Date.parse(String(cached.expires_at||'')),ingested=Date.parse(String(cached.ingestion_time||''));
  if(!Number.isFinite(until)||!Number.isFinite(ingested)||until<=now.getTime()||ingested>now.getTime())return false;
  // Re-fetch on each new cron UTC date even if the 36-hour fallback cache
  // remains within TTL. ECB reference dates may legitimately be unchanged
  // on holidays; retain source observation date, never fabricate a new one.
  return new Date(ingested).toISOString().slice(0,10)===now.toISOString().slice(0,10);
}
