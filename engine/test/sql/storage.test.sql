-- Checks app/supabase.sql the way the browser uses it: as the "anon" role.
-- Run after the setup script; every check raises an error if it fails.
\set ON_ERROR_STOP 1
set role anon;
do $$
declare
  a text := repeat('a', 32);
  t text := repeat('b', 64);
  i text := repeat('1', 40);
  r jsonb;
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
  raise notice 'storage checks passed';
end $$;
