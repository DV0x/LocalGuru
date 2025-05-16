-- Drop the function
drop function if exists public.locations_near;

-- Drop the indexes
drop index if exists idx_locations_geom;
drop index if exists idx_locations_name;
drop index if exists idx_locations_source_text;

-- Drop the table
drop table if exists public.locations; 