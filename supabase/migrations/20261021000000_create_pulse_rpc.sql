-- RPC helpers so the browser never has to construct PostGIS geography literals,
-- plus EXECUTE grants so anon/authenticated roles can call them via PostgREST.

create or replace function public.create_pulse(
  pulse_text text,
  pulse_category text,
  origin_lat double precision,
  origin_lng double precision,
  display_name text default 'anonymous'
)
returns table (
  id uuid,
  author_name text,
  text text,
  category text,
  lat double precision,
  lng double precision,
  upvotes integer,
  created_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  safe_name text := left(btrim(coalesce(nullif(btrim(display_name), ''), 'anonymous')), 40);
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if abs(origin_lat) > 90 or abs(origin_lng) > 180 then
    raise exception 'invalid coordinates';
  end if;

  return query
  insert into public.pulses (author_id, author_name, text, category, location)
  values (
    uid,
    safe_name,
    pulse_text,
    pulse_category,
    extensions.st_setsrid(extensions.st_makepoint(origin_lng, origin_lat), 4326)::extensions.geography
  )
  returning
    pulses.id,
    pulses.author_name,
    pulses.text,
    pulses.category,
    extensions.st_y(pulses.location::extensions.geometry),
    extensions.st_x(pulses.location::extensions.geometry),
    pulses.upvotes,
    pulses.created_at;
end;
$$;

grant execute on function public.nearby_pulses(double precision, double precision, double precision, integer, integer)
  to anon, authenticated;

grant execute on function public.create_pulse(text, text, double precision, double precision, text)
  to authenticated;

-- Explicit table grants (Supabase usually sets these via defaults; keep migrations self-contained).
grant select on table public.pulses to anon, authenticated;
grant insert, delete on table public.pulses to authenticated;
grant select on table public.pulse_votes to anon, authenticated;
grant insert, delete on table public.pulse_votes to authenticated;
