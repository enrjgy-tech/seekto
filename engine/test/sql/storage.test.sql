-- Checks app/supabase.sql the way the browser uses it: as the "anon" role.
-- Run after the setup script; every check raises an error if it fails.
\set ON_ERROR_STOP 1
-- A small storage limit for this test, so it doesn't write hundreds of megabytes
create or replace function public.seekto_max_bytes() returns bigint language sql immutable set search_path = pg_catalog as $$ select 6000000::bigint $$;
set role anon;
do $$
declare
  a text := repeat('a', 32);
  t text := repeat('b', 64);
  i text := repeat('1', 40);
  r jsonb;
  n int;
begin
  begin
    perform count(*) from public.seekto_items;
    raise exception 'FAIL: tables are open to direct access';
  exception when insufficient_privilege then null;
  end;
  if public.seekto_info() ->> 'app' <> 'seekto' then raise exception 'FAIL: info'; end if;
  if not (public.seekto_register(a, t) ->> 'created')::boolean then raise exception 'FAIL: register'; end if;
  begin
    perform public.seekto_register(a, repeat('c', 64));
    raise exception 'FAIL: someone else claimed the account';
  exception when insufficient_privilege then null;
  end;
  r := public.seekto_put(a, t, jsonb_build_array(jsonb_build_object('item_id', i, 'version', 5, 'body', 'v5')));
  if (r ->> 'accepted')::int <> 1 then raise exception 'FAIL: put'; end if;
  r := public.seekto_put(a, t, jsonb_build_array(jsonb_build_object('item_id', i, 'version', 4, 'body', 'old')));
  if (r ->> 'accepted')::int <> 0 then raise exception 'FAIL: an older version replaced a newer one'; end if;
  r := public.seekto_get(a, t, array[i]);
  if r -> 0 ->> 'body' <> 'v5' then raise exception 'FAIL: get'; end if;
  if jsonb_array_length(public.seekto_changes(a, t, 0)) <> 1 then raise exception 'FAIL: changes'; end if;
  begin
    perform public.seekto_get(a, repeat('d', 64), array[i]);
    raise exception 'FAIL: read with a wrong token';
  exception when insufficient_privilege then null;
  end;
  perform public.seekto_forget(a, t);
  -- Each account has a storage limit
  perform public.seekto_register(repeat('e', 32), t);
  begin
    for n in 1..3 loop
      perform public.seekto_put(repeat('e', 32), t, jsonb_build_array(jsonb_build_object('item_id', lpad(to_hex(n), 40, '0'), 'version', 1, 'body', repeat('x', 2900000))));
    end loop;
    raise exception 'FAIL: an account stored more than its limit';
  exception when sqlstate '53100' then null;
  end;
  perform public.seekto_forget(repeat('e', 32), t);
  -- Only a limited number of accounts can be created with the public browser key
  for n in 1..public.seekto_max_accounts() loop
    perform public.seekto_register(lpad(to_hex(n), 32, '0'), t);
  end loop;
  begin
    perform public.seekto_register(repeat('f', 32), t);
    raise exception 'FAIL: more accounts than the limit';
  exception when sqlstate '53400' then null;
  end;
  -- an existing account can still sign in
  perform public.seekto_register(lpad(to_hex(1), 32, '0'), t);
  raise notice 'storage checks passed';
end $$;
reset role;
create or replace function public.seekto_max_bytes() returns bigint language sql immutable set search_path = pg_catalog as $$ select 300000000::bigint $$;
