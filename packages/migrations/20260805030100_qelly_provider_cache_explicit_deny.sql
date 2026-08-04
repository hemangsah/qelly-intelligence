-- Make the provider-cache browser boundary explicit for advisors and reviewers.
-- service_role bypasses RLS; anon/authenticated remain denied even if grants drift.

begin;

alter table public.qelly_provider_cache enable row level security;

drop policy if exists qelly_provider_cache_browser_deny on public.qelly_provider_cache;
create policy qelly_provider_cache_browser_deny
on public.qelly_provider_cache
for all
to anon, authenticated
using (false)
with check (false);

revoke all on table public.qelly_provider_cache from anon, authenticated;

commit;
