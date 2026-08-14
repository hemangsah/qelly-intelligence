update public.qelly_providers
set lifecycle_status='active',
    commercial_rights_status='allowed',
    redistribution_rights_status='allowed',
    attribution='European Central Bank euro foreign exchange reference rates',
    verified_at=now(),
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'governance_decision','conditionally_approved_attributed_reference_data',
      'usage_policy_url','https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html',
      'reference_rate_url','https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html',
      'scope','read_only_attributed_reference_data',
      'transaction_use','discouraged_by_source',
      'evidence_release_sha','fbaf7565d4bb4686d37090365c3eb448706cbb2e'
    ),
    updated_at=now()
where provider_key='ecb';

insert into public.qelly_provider_readiness(provider_id,check_name,status,evidence,last_checked_at)
select p.id,v.check_name,'pass',v.evidence,now()
from public.qelly_providers p
cross join (values
  ('official_documentation', jsonb_build_object('source','ECB','url','https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html','activation_allowed',true)),
  ('terms', jsonb_build_object('source','ECB/ESCB reuse policy','url','https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html','free_reuse',true,'source_attribution_required',true,'activation_allowed',true)),
  ('commercial_use', jsonb_build_object('source','ECB/ESCB reuse policy','commercial_and_noncommercial_reuse',true,'source_attribution_required',true,'activation_allowed',true)),
  ('redistribution_rights', jsonb_build_object('source','ECB/ESCB reuse policy','free_reuse',true,'source_attribution_required',true,'activation_allowed',true)),
  ('attribution', jsonb_build_object('required','Source: European Central Bank','modification_disclosure_required',true,'activation_allowed',true)),
  ('current_availability', jsonb_build_object('canonical_release_sha','fbaf7565d4bb4686d37090365c3eb448706cbb2e','truth_state','delayed_provider','source_identifier','EUR','observation_date','2026-08-14','activation_allowed',true)),
  ('freshness', jsonb_build_object('canonical_release_sha','fbaf7565d4bb4686d37090365c3eb448706cbb2e','freshness','daily-working-day-reference','observation_date','2026-08-14','activation_allowed',true))
) as v(check_name,evidence)
where p.provider_key='ecb'
on conflict(provider_id,check_name) do update
set status=excluded.status,
    evidence=excluded.evidence,
    last_checked_at=excluded.last_checked_at,
    updated_at=now();
