// src/lib/rankings.ts
import { Pool } from 'pg';
export const CURRENT_SEASON = '2025-2026-regular';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

export type PlayerRow = {
    season: string;
    player_id: string;
    player_name: string;
    team_abbr: string;
    position: string;
    gp: number;
    g: number; a: number; pim: number; ppg: number; ppa: number; ppp: number;
    shg: number; sha: number; shp: number; sog: number; fw: number; hit: number; blk: number;
};

export async function getPlayerRankings(season = CURRENT_SEASON, limit = 50, offset = 0): Promise<PlayerRow[]> {
    const { rows } = await pool.query(
        `SELECT * FROM v_player_stats_rankings WHERE season = $1 ORDER BY hit DESC, sog DESC LIMIT $2 OFFSET $3`,
        [season, limit, offset]
    );
    return rows;
}
