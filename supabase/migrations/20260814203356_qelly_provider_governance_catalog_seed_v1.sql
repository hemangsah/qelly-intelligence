-- Qelly Intelligence provider governance catalog seed v1
-- Live migration version: 20260814203356
-- Applied to Supabase project ssdgfgqnjlwzkgukzeef on 2026-08-14.
--
-- Purpose:
--   Restore auditable provider-governance metadata without implying that any
--   provider is commercially approved, redistribution-approved, live, fresh,
--   or safe for browser exposure. The provider runtime foundation migration
--   (20260808085124 qelly_provider_data_runtime_foundation_v1) must exist first.
--
-- Canonical Qelly runtime decisions preserved here:
--   Binance  -> blocked_pending_redistribution_rights
--   Coinbase -> blocked_pending_written_end_user_display_permission
--   ECB      -> conditionally_approved_attributed_reference_data
--
-- All provider rows remain lifecycle=verification, rights=unverified,
-- verified_at=NULL, and readiness activation_allowed=false.

insert into public.qelly_providers (
  provider_key, display_name, provider_type, lifecycle_status,
  commercial_rights_status, redistribution_rights_status, metadata
)
values
  ('binance','Binance','market_data','verification','unverified','unverified',jsonb_build_object(
    'governance_decision','blocked_pending_redistribution_rights',
    'decision_source','qelly_public_runtime_contract',
    'activation_allowed',false
  )),
  ('coinbase','Coinbase','market_data','verification','unverified','unverified',jsonb_build_object(
    'governance_decision','blocked_pending_written_end_user_display_permission',
    'decision_source','qelly_public_runtime_contract',
    'activation_allowed',false
  )),
  ('ecb','European Central Bank','reference','verification','unverified','unverified',jsonb_build_object(
    'governance_decision','conditionally_approved_attributed_reference_data',
    'decision_source','qelly_public_runtime_contract',
    'activation_allowed',false,
    'scope','attributed_reference_data_only'
  ))
on conflict (provider_key) do update set
  display_name=excluded.display_name,
  provider_type=excluded.provider_type,
  lifecycle_status='verification',
  commercial_rights_status='unverified',
  redistribution_rights_status='unverified',
  metadata=public.qelly_providers.metadata || excluded.metadata,
  verified_at=null,
  updated_at=now();

insert into public.qelly_provider_readiness (provider_id,check_name,status,evidence,last_checked_at)
select p.id, x.check_name, x.status, x.evidence, now()
from public.qelly_providers p
join lateral (
  values
    ('current_availability'::text,'pending'::text,jsonb_build_object('reason','not_probed','activation_allowed',false)),
    ('freshness'::text,'pending'::text,jsonb_build_object('reason','not_probed','activation_allowed',false))
) as x(check_name,status,evidence) on true
where p.provider_key in ('binance','coinbase','ecb')
on conflict (provider_id,check_name) do update set
  status=excluded.status,
  evidence=excluded.evidence,
  last_checked_at=excluded.last_checked_at,
  updated_at=now();

insert into public.qelly_provider_readiness (provider_id,check_name,status,evidence,last_checked_at)
select p.id,
       case p.provider_key when 'ecb' then 'attribution' else 'redistribution_rights' end,
       'warning',
       jsonb_build_object(
         'governance_decision',p.metadata->>'governance_decision',
         'decision_source','qelly_public_runtime_contract',
         'activation_allowed',false
       ),
       now()
from public.qelly_providers p
where p.provider_key in ('binance','coinbase','ecb')
on conflict (provider_id,check_name) do update set
  status=excluded.status,
  evidence=excluded.evidence,
  last_checked_at=excluded.last_checked_at,
  updated_at=now();
