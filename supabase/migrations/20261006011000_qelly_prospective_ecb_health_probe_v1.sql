-- Deploy the accepted provider-ingestion probe action before applying this.
-- Four genuine daily HTTP/schema attempts can accumulate a >=20-sample weekly
-- latency window prospectively. This neither backfills samples nor declares an
-- availability/latency SLO, and does not change the weekday ingestion job.
do $$
begin
  if not exists(select 1 from vault.decrypted_secrets where name='qelly_project_url')
     or not exists(select 1 from vault.decrypted_secrets where name='qelly_internal_scheduler_key') then
    raise exception 'Existing private scheduler configuration is required';
  end if;
  perform cron.schedule(
    'qelly-ecb-prospective-health-probe',
    '25 */6 * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name='qelly_project_url') || '/functions/v1/qelly-provider-ingestion?action=probe',
        headers := jsonb_build_object('Content-Type','application/json','x-qelly-ingestion-key',(select decrypted_secret from vault.decrypted_secrets where name='qelly_internal_scheduler_key')),
        body := jsonb_build_object('trigger','prospective-health-cron','scheduled_at',now()),
        timeout_milliseconds := 12000
      ) as request_id;
    $job$
  );
end
$$;
