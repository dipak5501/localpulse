-- LocalPulse schema: geospatial pulses, one-vote-per-user upvotes, row-level security and realtime.

create extension if not exists postgis with schema extensions;

create table public.pulses (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 40),
  text        text not null check (char_length(btrim(text)) between 1 and 280),
  category    text not null check (category in ('event', 'food', 'music', 'sports', 'alert', 'chatter')),
  location    extensions.geography(point, 4326) not null,
  upvotes     integer not null default 0 check (upvotes >= 0),
  created_at  timestamptz not null default now()
);

-- GiST index makes ST_DWithin radius queries use the index instead of scanning every row.
create index pulses_location_idx on public.pulses using gist (location);
create index pulses_created_at_idx on public.pulses (created_at desc);

create table public.pulse_votes (
  pulse_id   uuid not null references public.pulses (id) on delete cascade,
  voter_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pulse_id, voter_id)
);

-- Keep pulses.upvotes as a denormalised counter so ranking never needs a join.
create function public.sync_pulse_upvotes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.pulses set upvotes = upvotes + 1 where id = new.pulse_id;
  elsif tg_op = 'DELETE' then
    update public.pulses set upvotes = greatest(upvotes - 1, 0) where id = old.pulse_id;
  end if;
  return null;
end;
$$;

create trigger pulse_votes_sync
after insert or delete on public.pulse_votes
for each row execute function public.sync_pulse_upvotes();

-- Pulses within `radius_km` of a point, newest first. Trending ranking happens client-side
-- (src/lib/trending.ts) so the same scoring code is unit-tested and shared.
create function public.nearby_pulses(
  origin_lat double precision,
  origin_lng double precision,
  radius_km double precision default 5,
  max_age_hours integer default 48,
  max_results integer default 300
)
returns table (
  id uuid,
  author_name text,
  text text,
  category text,
  lat double precision,
  lng double precision,
  upvotes integer,
  created_at timestamptz,
  distance_km double precision
)
language sql stable set search_path = '' as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(origin_lng, origin_lat), 4326)::extensions.geography as g
  )
  select
    p.id,
    p.author_name,
    p.text,
    p.category,
    extensions.st_y(p.location::extensions.geometry),
    extensions.st_x(p.location::extensions.geometry),
    p.upvotes,
    p.created_at,
    extensions.st_distance(p.location, origin.g) / 1000
  from public.pulses p, origin
  where extensions.st_dwithin(p.location, origin.g, least(radius_km, 50) * 1000)
    and p.created_at > now() - make_interval(hours => max_age_hours)
  order by p.created_at desc
  limit least(max_results, 500);
$$;

alter table public.pulses enable row level security;
alter table public.pulse_votes enable row level security;

create policy "Pulses are public" on public.pulses
  for select using (true);

create policy "Signed-in users post as themselves" on public.pulses
  for insert to authenticated with check (author_id = (select auth.uid()) and upvotes = 0);

create policy "Authors can delete their pulses" on public.pulses
  for delete to authenticated using (author_id = (select auth.uid()));

create policy "Votes are public" on public.pulse_votes
  for select using (true);

create policy "Users vote as themselves" on public.pulse_votes
  for insert to authenticated with check (voter_id = (select auth.uid()));

create policy "Users can remove their own vote" on public.pulse_votes
  for delete to authenticated using (voter_id = (select auth.uid()));

-- Broadcast inserts/updates so every open map sees new pulses and vote counts live.
alter publication supabase_realtime add table public.pulses;
