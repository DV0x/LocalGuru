-- Create locations table
create table public.locations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  source_text text not null,
  longitude float not null,
  latitude float not null,
  address text,
  confidence float default 0.8,
  created_at timestamptz default now(),
  unique(name)
);

-- Indexes for performance
create index idx_locations_name on public.locations(name);
create index idx_locations_source_text on public.locations(source_text);

-- Set up RLS to allow public access for reading (but not writing)
alter table public.locations enable row level security;

-- Policy for selecting locations
create policy "Allow public access to locations" 
  on public.locations
  for select 
  to anon, authenticated
  using (true);

-- Add spatial extension if not already added
create extension if not exists "postgis";

-- Add spatial index for faster geo queries
alter table public.locations
  add column geom geography(Point, 4326) generated always as (
    st_makepoint(longitude, latitude)::geography
  ) stored;

create index idx_locations_geom on public.locations using gist(geom);

-- Function to calculate distance between points
create or replace function public.locations_near(
  lat float,
  lng float,
  distance_meters float default 5000
)
returns setof public.locations
language sql
as $$
  select *
  from public.locations
  where st_dwithin(
    geom,
    st_makepoint(lng, lat)::geography,
    distance_meters
  )
  order by st_distance(
    geom,
    st_makepoint(lng, lat)::geography
  )
  limit 100;
$$; 