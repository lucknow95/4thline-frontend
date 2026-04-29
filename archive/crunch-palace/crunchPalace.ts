// src/lib/crunchPalace.ts
import arenaMap from '@/data/arenaMap';
import { fullTeamToAbbr } from '@/lib/teamMaps';
import { Pool } from 'pg';

// --- Robust SSL handling for Supabase both locally and in prod ---
const needsSSL =
  !!process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.includes('supabase.co') ||
    process.env.DATABASE_URL.includes('pooler.supabase.com'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase requires SSL from anywhere; use a permissive CA locally.
  ssl: needsSSL || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : undefined,
});

// Season tag (explicit so we can support multi-season later)
export const CURRENT_SEASON = '2025-26';

/** Row shape returned to the page/UI */
export type CPAggregateRow = {
  season: string;
  team_abbr: string;
  team_full: string;
  arena_name: string;
  home_games: number;
  total_hits: number;
  hits_per_game: number;
};

/**
 * Get aggregated Crunch Palace rows for a season.
 * Reads from the materialized view `cp_team_hits_agg` and
 * attaches `team_full` in Node (view only stores abbr).
 */
export async function getCrunchPalaceRows(
  season: string = CURRENT_SEASON
): Promise<CPAggregateRow[]> {
  type ViewRow = {
    season: string;
    team_abbr: string;
    arena_name: string;
    home_games: number;
    total_hits: number;
    hits_per_game: number;
  };

  const { rows } = await pool.query<ViewRow>(
    `
      SELECT season, team_abbr, arena_name, home_games, total_hits, hits_per_game
      FROM cp_team_hits_agg
      WHERE season = $1
      ORDER BY hits_per_game DESC, total_hits DESC, team_abbr ASC
    `,
    [season]
  );

  return rows.map((r) => ({
    season: r.season,
    team_abbr: r.team_abbr,
    team_full: abbrToFull[r.team_abbr] ?? r.team_abbr,
    arena_name: r.arena_name,
    home_games: Number(r.home_games) || 0,
    total_hits: Number(r.total_hits) || 0,
    hits_per_game: Number(r.hits_per_game) || 0,
  }));
}

/** Input for a single (home) game upsert */
type HomeGameInsert = {
  game_id: string;       // kept for compatibility; not stored in cp_team_hits
  date: string;          // YYYY-MM-DD (local game date)
  team_abbr: string;     // HOME team (abbr like 'FLA')
  team_full: string;
  arena_name: string;
  hits: number;
  is_regular_season: boolean; // ignored here (we ingest REG only upstream)
  season?: string;
};

/**
 * Upsert a single HOME game stat row into `cp_team_hits`.
 * We store one row per (season, game_date, team_abbr) with `home_away='H'`.
 */
export async function upsertHomeGameStat(input: HomeGameInsert) {
  const season = input.season ?? CURRENT_SEASON;

  await pool.query(
    `
      INSERT INTO cp_team_hits (season, game_date, team_abbr, home_away, arena_name, hits)
      VALUES ($1, $2, $3, 'H', $4, $5)
      ON CONFLICT (season, game_date, team_abbr)
      DO UPDATE SET
        arena_name = EXCLUDED.arena_name,
        hits       = EXCLUDED.hits
    `,
    [
      season,
      input.date,           // -> game_date
      input.team_abbr,
      input.arena_name,
      Math.max(0, input.hits | 0),
    ]
  );
}

/**
 * Refresh the materialized view so new data shows immediately.
 * Prefer CONCURRENTLY; if the unique index isn't present yet, fall back
 * to non-concurrent refresh and log a friendly hint.
 */
export async function refreshCrunchPalaceAgg() {
  try {
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY cp_team_hits_agg;');
  } catch (e: any) {
    // 42P01 = relation does not exist (schema not applied yet)
    if (e?.code === '42P01') {
      console.warn('cp_team_hits_agg not found yet. Did you run cp_team_hits.sql?');
      return;
    }
    // 55000 = cannot refresh concurrently (no unique index on matview)
    // Provide a fallback so local/dev runs don't break.
    if (e?.code === '55000') {
      console.warn(
        'Concurrent refresh unavailable; falling back to non-concurrent refresh.\n' +
        'Tip: add a unique index on (season, team_abbr):\n' +
        '  CREATE UNIQUE INDEX IF NOT EXISTS cp_team_hits_agg_unique ON cp_team_hits_agg (season, team_abbr);'
      );
      await pool.query('REFRESH MATERIALIZED VIEW cp_team_hits_agg;');
      return;
    }
    throw e;
  }
}

/**
 * Utility: map team_abbr -> full name from fullTeamToAbbr
 */
export const abbrToFull: Record<string, string> = Object.fromEntries(
  Object.entries(fullTeamToAbbr).map(([full, abbr]) => [abbr, full])
);

/**
 * Get arena by full team name (falls back to team’s entry in arenaMap)
 */
export function arenaForTeamFull(teamFull: string): string {
  return arenaMap[teamFull]?.venue ?? 'Unknown Arena';
}
