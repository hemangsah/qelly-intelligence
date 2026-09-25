import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
const migrationPath='supabase/migrations/20260925173145_qelly_governed_read_rpc_private_boundary_v1.sql';

test('Wave BK moves governed market-read privilege out of the exposed public schema',async()=>{
  const sql=await read(migrationPath);
  assert.match(sql,/create or replace function qelly_private\.qelly_market_data_snapshot\(p_limit integer default 100\)[\s\S]*?security definer/i);
  assert.match(sql,/create or replace function qelly_private\.qelly_timeseries_history\([\s\S]*?security definer/i);
  assert.match(sql,/set search_path to ''/i);
  assert.match(sql,/v_actor uuid := auth\.uid\(\)/i);
  assert.match(sql,/authentication_required/i);

  assert.match(sql,/create or replace function public\.qelly_market_data_snapshot\(p_limit integer default 100\)[\s\S]*?security invoker/i);
  assert.match(sql,/select qelly_private\.qelly_market_data_snapshot\(\$1\)/i);
  assert.match(sql,/create or replace function public\.qelly_timeseries_history\([\s\S]*?security invoker/i);
  assert.match(sql,/select qelly_private\.qelly_timeseries_history\(\$1,\$2\)/i);
});

test('Wave BK public wrappers are authenticated-only and do not grant direct service-role or anonymous execution',async()=>{
  const sql=await read(migrationPath);
  for(const signature of [
    'public.qelly_market_data_snapshot\\(integer\\)',
    'public.qelly_timeseries_history\\(text,integer\\)'
  ]){
    assert.match(sql,new RegExp('revoke all on function '+signature+'[\\s\\S]*?from public, anon, authenticated, service_role','i'));
    assert.match(sql,new RegExp('grant execute on function '+signature+'[\\s\\S]*?to authenticated','i'));
  }
  assert.doesNotMatch(sql,/grant execute on function public\.qelly_(?:market_data_snapshot|timeseries_history)[\s\S]{0,120}to service_role/i);
  assert.doesNotMatch(sql,/grant execute on function public\.qelly_(?:market_data_snapshot|timeseries_history)[\s\S]{0,120}to anon/i);
});

test('Wave BK does not broaden browser access to governed raw tables',async()=>{
  const sql=await read(migrationPath);
  assert.doesNotMatch(sql,/grant\s+(?:select|insert|update|delete|all)[\s\S]{0,100}qelly_(?:providers|provider_cache|provider_readiness|timeseries_points|timeseries_series|data_quality_events|release_identity|provider_instrument_mappings)/i);
  assert.doesNotMatch(sql,/alter table[\s\S]{0,80}disable row level security/i);
  assert.doesNotMatch(sql,/drop policy/i);
});

test('Wave BK keeps Cloudflare authenticated facades and public RPC names stable',async()=>{
  const [snapshot,timeseries,dataPlane]=await Promise.all([
    read('functions/_lib/market-data-snapshot.js'),
    read('functions/api/v1/timeseries/[[route]].js'),
    read('functions/api/v1/platform/data-plane.js')
  ]);
  assert.match(snapshot,/rpc\/qelly_market_data_snapshot/);
  assert.match(timeseries,/rpc\/qelly_timeseries_history/);
  assert.match(dataPlane,/resolveSession\(request,env,\{required:true\}\)/);
  assert.match(timeseries,/resolveSession\(request,env,\{required:true\}\)/);
  for(const source of [snapshot,timeseries,dataPlane])assert.doesNotMatch(source,/QELLY_SUPABASE_SERVICE_ROLE_KEY/);
});

test('Wave BK preserves current CSP and session security boundaries',async()=>{
  const [headers,authTest]=await Promise.all([
    read('apps/web/public/_headers'),
    read('tests/qelly-auth-rls-governance-wave-3.test.mjs')
  ]);
  assert.match(headers,/frame-ancestors 'none'/);
  assert.match(headers,/object-src 'none'/);
  assert.match(headers,/base-uri 'none'/);
  assert.doesNotMatch(headers,/script-src[^\n;]*'unsafe-eval'/);
  assert.match(authTest,/PKCE/i);
  assert.match(authTest,/HttpOnly/i);
  assert.match(authTest,/SameSite=Lax/i);
});

test('Wave BK records leaked-password protection as a manual external control, not a fabricated in-repo fix',async()=>{
  const doc=await read('docs/security/QELLY_WAVE_BK_SECURITY_HARDENING.md');
  assert.match(doc,/Leaked-password protection/i);
  assert.match(doc,/manual\/external/i);
  assert.match(doc,/Supabase Auth/i);
  assert.match(doc,/disabled/i);
  assert.doesNotMatch(doc,/enabled successfully|fixed automatically/i);
});
