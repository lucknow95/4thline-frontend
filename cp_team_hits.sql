-- Migration to create cp_team_hits table and aggregated view
-- Creates the base table for storing per-team hit totals by game,
-- along with a materialized view summarising home-hit averages. It also
-- defines a helper function to refresh the materialized view concurrently.

-- Raw per‑game facts (append‑only)
create table if not exists cp_team_hits (
  id           bigserial primary key,
  season       text not null,
  game_date    date not null,
  team_abbr    text not null,
  home_away    text not null check (home_away in ('H','A')),
  arena_name   text not null,
  hits         int not null check (hits >= 0),
  source       text default 'mysportsfeeds',
  ingested_at  timestamptz default now(),
  unique (season, game_date, team_abbr)
);

-- Aggregated view for Crunch Palace page
create materialized view if not exists cp_team_hits_agg as
select
  season,
  team_abbr,
  max(arena_name)                                             as arena_name,
  count(*) filter (where home_away = 'H')                     as home_games,
  sum(hits) filter (where home_away = 'H')                    as total_hits,
  case
    when count(*) filter (where home_away = 'H') > 0
      then (sum(hits) filter (where home_away = 'H')::numeric
            / count(*) filter (where home_away = 'H'))
    else 0 end                                               as hits_per_game
from cp_team_hits
group by season, team_abbr;

-- Helper function to refresh the materialized view concurrently. Using
-- a Postgres function allows us to call this via Supabase RPC from the API layer.
create or replace function refresh_cp_team_hits_agg()
returns void
language sql
as $$
  refresh materialized view concurrently cp_team_hits_agg;
$$;