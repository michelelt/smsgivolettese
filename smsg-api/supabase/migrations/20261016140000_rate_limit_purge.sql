-- Purge stale hits (raw client IPs live in key) on every call; replaces the planned daily cron.
create or replace function app.consume_rate_limit(p_key text, p_max int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
        h int;
begin
  delete from public.rate_limit_hits where window_start < now() - interval '1 day';
  insert into public.rate_limit_hits as r (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into h;
  return h <= p_max;
end $$;
