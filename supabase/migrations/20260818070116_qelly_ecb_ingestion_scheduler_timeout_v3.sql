-- Keep the scheduled ECB ingestion request alive long enough for the bounded
-- official-source daily -> 90-day fallback path to finish. Secrets remain in
-- Supabase Vault and are never materialized into migration source.
do $$
declare
  target_job_id bigint;
begin
  select jobid into target_job_id
  from cron.job
  where jobname = 'qelly-ecb-provider-ingestion';

  if target_job_id is null then
    raise exception 'qelly-ecb-provider-ingestion cron job not found';
  end if;

  perform cron.alter_job(
    job_id := target_job_id,
    command := $cmd$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name='qelly_project_url') || '/functions/v1/qelly-provider-ingestion',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-qelly-ingestion-key',(select decrypted_secret from vault.decrypted_secrets where name='qelly_internal_scheduler_key')
        ),
        body := jsonb_build_object('trigger','cron','scheduled_at',now()),
        timeout_milliseconds := 30000
      ) as request_id;
    $cmd$
  );
end
$$;
