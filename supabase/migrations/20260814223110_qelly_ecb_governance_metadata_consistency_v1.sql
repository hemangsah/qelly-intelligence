update public.qelly_providers
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'scope','read_only_attributed_reference_data',
  'activation_allowed',true,
  'governance_decision','approved_attributed_reference_data_for_qelly_read_only_reference_surfaces',
  'transaction_use','not_for_transaction_execution',
  'source_attribution_required',true,
  'modification_disclosure_required',true,
  'usage_policy_url','https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html',
  'reference_rate_url','https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html'
),
updated_at = now()
where provider_key='ecb';
