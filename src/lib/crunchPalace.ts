// src/lib/crunchPalace.ts
import { Pool } from 'pg';
import { fullTeamToAbbr } from '@/lib/teamMaps';
import arenaMap from '@/data/arenaMap';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

// Season tag (explicit so we can support multi-season later)
export const CURRENT_SEASON = '2025-26';

export type CPAggregateRow = {
  season: string;
  team_abbr: string;
  team_full: string;
  arena_name: string;
  home_games: number;
  total_hits: number;
  hits_per_game: number;
};

export async function getCrunchPalaceRows(season = CURRENT_SEASON): Promise<CPAggregateRow[]> {
  const { rows } = await pool.query<CPAggregateRow>(
    `SELECT season, team_abbr, team_full, arena_name, home_games, total_hits, hits_per_game
     FROM cp_arena_agg
     WHERE season = $1
     ORDER BY total_hits DESC`,
    [season]
  );
  return rows;
}

type HomeGameInsert = {
  game_id: string;
  date: string;          // YYYY-MM-DD
  team_abbr: string;     // HOME team
  team_full: string;
  arena_name: string;
  hits: number;
  is_regular_season: boolean;
  season?: string;
};

// Upsert a single home-game stat row
export async function upsertHomeGameStat(input: HomeGameInsert) {
  const season = input.season ?? CURRENT_SEASON;
  await pool.query(
    `INSERT INTO team_game_stats_home (season, game_id, "date", team_abbr, team_full, arena_name, hits, is_regular_season)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (season, game_id, team_abbr)
     DO UPDATE SET hits = EXCLUDED.hits, is_regular_season = EXCLUDED.is_regular_season`,
    [
      season,
      input.game_id,
      input.date,
      input.team_abbr,
      input.team_full,
      input.arena_name,
      input.hits,
      input.is_regular_season,
    ]
  );
}

/**
 * Utility: map team_abbr -> full name from fullTeamToAbbr
 */
export const abbrToFull: Record<string, string> = Object.fromEntries(
  Object.entries(fullTeamToAbbr).map(([full, abbr]) => [abbr, full])
);

// Get arena by full team name (falls back to team’s entry in arenaMap)
export function arenaForTeamFull(teamFull: string): string {
  return arenaMap[teamFull]?.venue ?? 'Unknown Arena';
}
