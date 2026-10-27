-- Buzz notification database. Paste this whole file into Supabase: SQL Editor, New query, Run. Safe to run twice.
-- Design: the table can NOT be read or changed directly by the public site key.
-- The phone can only call two small functions: save my own subscription, delete my own subscription.

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  times      text[] not null,
  tz         text not null,
  topics     text[] not null default '{}',
  terms      text[] not null default '{}',
  state      jsonb not null default '{"slots":{},"clusters":[]}'::jsonb,
  failures   int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
-- No row policies on purpose: with row security on and no policy, the public key sees nothing.

create or replace function public.buzz_upsert_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_times text[], p_tz text, p_topics text[], p_terms text[]
) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Only real browser push services are accepted (the sender will contact this address).
  if p_endpoint is null or length(p_endpoint) > 1000 or p_endpoint !~
     '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/' then
    raise exception 'bad endpoint';
  end if;
  if p_p256dh is null or length(p_p256dh) not between 20 and 200 or p_auth is null or length(p_auth) not between 8 and 100 then
    raise exception 'bad keys';
  end if;
  if p_times is null or cardinality(p_times) not between 1 and 2
     or exists (select 1 from unnest(p_times) t where t !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then
    raise exception 'bad times';
  end if;
  if p_tz is null or length(p_tz) > 64 or p_tz !~ '^[A-Za-z0-9_+/-]+$' then
    raise exception 'bad time zone';
  end if;
  if p_topics is null or cardinality(p_topics) > 30 or exists (select 1 from unnest(p_topics) t where t !~ '^[a-z0-9-]{1,30}$') then
    raise exception 'bad topics';
  end if;
  if p_terms is null or cardinality(p_terms) > 20 or exists (select 1 from unnest(p_terms) t where length(t) not between 2 and 60) then
    raise exception 'bad terms';
  end if;
  -- Storage guard: a free database must not be fillable by strangers.
  if not exists (select 1 from public.push_subscriptions where endpoint = p_endpoint)
     and (select count(*) from public.push_subscriptions) >= 5000 then
    raise exception 'subscription limit reached';
  end if;

  insert into public.push_subscriptions (endpoint, p256dh, auth, times, tz, topics, terms)
  values (p_endpoint, p_p256dh, p_auth, p_times, p_tz, p_topics, p_terms)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, times = excluded.times, tz = excluded.tz,
        topics = excluded.topics, terms = excluded.terms, failures = 0, updated_at = now();
end $$;

create or replace function public.buzz_delete_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;

revoke all on function public.buzz_upsert_subscription(text, text, text, text[], text, text[], text[]) from public;
revoke all on function public.buzz_delete_subscription(text) from public;
grant execute on function public.buzz_upsert_subscription(text, text, text, text[], text, text[], text[]) to anon;
grant execute on function public.buzz_delete_subscription(text) to anon;
