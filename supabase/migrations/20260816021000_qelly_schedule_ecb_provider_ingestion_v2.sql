do $$
begin
  if not exists (select 1 from vault.secrets where name='qelly_project_url') then
    raise exception 'qelly_project_url vault secret is required';
  end if;
  if not exists (select 1 from vault.secrets where name='qelly_provider_ingestion_key') then
    raise exception 'qelly_provider_ingestion_key vault secret is required';
  end if;
end
$$;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in select jobid from cron.job where jobname='qelly-ecb-provider-ingestion' loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'qelly-ecb-provider-ingestion',
    '15 17 * * 1-5',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name='qelly_project_url') || '/functions/v1/qelly-provider-ingestion',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-qelly-ingestion-key',(select decrypted_secret from vault.decrypted_secrets where name='qelly_provider_ingestion_key')
      ),
      body := jsonb_build_object('trigger','cron','scheduled_at',now()),
      timeout_milliseconds := 10000
    ) as request_id;
    $job$
  );
end
$$;
