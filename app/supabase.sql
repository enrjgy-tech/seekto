-- Seekto storage for your own Supabase project (schema version 1).
-- Run this once in your project's SQL Editor. It's safe to run again.
--
-- What it stores: for each Seekto account, opaque item ids, version numbers and encrypted data.
-- Your account key never leaves your devices, so this database can't read your notes,
-- recordings or calendar. Tables are closed to direct access; the app only talks to the
-- functions below, and every change must carry the account's write token (stored here only
-- as a SHA-256 hash). A change is accepted only if its version is newer than what's stored,
-- so an old copy can't overwrite a newer one.

create table if not exists public.seekto_accounts (
  account_id text primary key check (account_id ~ '^[0-9a-f]{32}$'),
  token_hash text not null,
  created_at timestamptz not null default now()
);

create sequence if not exists public.seekto_seq;

create table if not exists public.seekto_items (
  account_id text not null references public.seekto_accounts (account_id) on delete cascade,
  item_id text not null check (item_id ~ '^[0-9a-f]{40}$'),
  version bigint not null check (version > 0),
  body text not null check (length(body) <= 3000000),
  seq bigint not null default nextval('public.seekto_seq'),
  updated_at timestamptz not null default now(),
  primary key (account_id, item_id)
);

create index if not exists seekto_items_changes on public.seekto_items (account_id, seq);

-- No direct table access from the browser keys. Row level security with no policies denies
-- everything, and the grants are removed as well.
alter table public.seekto_accounts enable row level security;
alter table public.seekto_items enable row level security;
revoke all on table public.seekto_accounts, public.seekto_items from anon, authenticated;
revoke all on sequence public.seekto_seq from anon, authenticated;

create or replace function public.seekto_hash(p_token text) returns text
language sql immutable set search_path = pg_catalog
as $$ select encode(sha256(convert_to(p_token, 'UTF8')), 'hex') $$;

create or replace function public.seekto_check(p_account text, p_token text) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from seekto_accounts where account_id = p_account and token_hash = seekto_hash(p_token)) then
    raise exception 'seekto: wrong account or token' using errcode = '42501';
  end if;
end $$;

create or replace function public.seekto_info() returns jsonb
language sql stable set search_path = public, pg_temp
as $$ select jsonb_build_object('app', 'seekto', 'schema', 1) $$;

-- Claim an account id with a write token. Only someone with the account key can derive both.
create or replace function public.seekto_register(p_account text, p_token text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  created boolean;
begin
  if length(p_token) <> 64 then
    raise exception 'seekto: bad token' using errcode = '22023';
  end if;
  insert into seekto_accounts (account_id, token_hash) values (p_account, seekto_hash(p_token))
  on conflict (account_id) do nothing;
  created := found;
  perform seekto_check(p_account, p_token);
  return jsonb_build_object('ok', true, 'created', created);
end $$;

-- Save encrypted items: [{ "item_id", "version", "body" }]. Older versions are refused.
create or replace function public.seekto_put(p_account text, p_token text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  it record;
  accepted int := 0;
  stale text[] := '{}';
begin
  perform seekto_check(p_account, p_token);
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then
    raise exception 'seekto: send at most 200 items at a time' using errcode = '22023';
  end if;
  for it in select * from jsonb_to_recordset(p_items) as x(item_id text, version bigint, body text) loop
    insert into seekto_items (account_id, item_id, version, body)
    values (p_account, it.item_id, it.version, it.body)
    on conflict (account_id, item_id) do update
      set version = excluded.version, body = excluded.body,
          seq = nextval('public.seekto_seq'), updated_at = now()
      where seekto_items.version < excluded.version;
    if found then accepted := accepted + 1; else stale := stale || it.item_id; end if;
  end loop;
  return jsonb_build_object('accepted', accepted, 'stale', to_jsonb(stale));
end $$;

-- What changed after a point: ids, versions and positions, without the data.
create or replace function public.seekto_changes(p_account text, p_token text, p_since bigint, p_limit int default 500) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform seekto_check(p_account, p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object('item_id', item_id, 'version', version, 'seq', seq, 'size', length(body)) order by seq)
    from (
      select item_id, version, seq, body from seekto_items
      where account_id = p_account and seq > p_since
      order by seq limit least(greatest(p_limit, 1), 1000)
    ) c
  ), '[]'::jsonb);
end $$;

-- The encrypted data for some items.
create or replace function public.seekto_get(p_account text, p_token text, p_ids text[]) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform seekto_check(p_account, p_token);
  if cardinality(p_ids) > 100 then
    raise exception 'seekto: ask for at most 100 items at a time' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('item_id', item_id, 'version', version, 'body', body))
    from seekto_items where account_id = p_account and item_id = any (p_ids)
  ), '[]'::jsonb);
end $$;

-- Delete an account and everything in it.
create or replace function public.seekto_forget(p_account text, p_token text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform seekto_check(p_account, p_token);
  delete from seekto_accounts where account_id = p_account;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.seekto_check(text, text) from public, anon, authenticated;
grant execute on function public.seekto_info() to anon, authenticated;
grant execute on function public.seekto_register(text, text) to anon, authenticated;
grant execute on function public.seekto_put(text, text, jsonb) to anon, authenticated;
grant execute on function public.seekto_changes(text, text, bigint, int) to anon, authenticated;
grant execute on function public.seekto_get(text, text, text[]) to anon, authenticated;
grant execute on function public.seekto_forget(text, text) to anon, authenticated;
