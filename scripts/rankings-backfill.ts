// scripts/rankings-backfill.ts
// Ingest seasonal player stats for Rankings (NHL 2025–26)
// Usage (PowerShell):
//   $env:DOTENV_CONFIG_PATH = ".env.local"
//   $env:RK_DRY_RUN = "1"
//   npx tsx -r dotenv/config scripts/rankings-backfill.ts
//
// Env:
//   DATABASE_URL=postgres://... (Supabase or Postgres)
//   MSF_API_KEY=xxxxxxxxxxxxxxxx
//   MSF_API_PASSWORD=MYSPORTSFEEDS (optional; default in msfClient)
// Optional:
//   RK_SEASON_TAG=2025-2026-regular
//   RK_LEAGUE=nhl
//   RK_DRY_RUN=1
//   RK_USE_GAMELOGS=1  (fallback: derive totals by summing player_gamelogs)
//   RK_SEASON_START=YYYYMMDD (to constrain player_gamelogs; default 20251007)
//   MSF_PAGE_LIMIT=200 (page size for gamelogs; default 200)

import {
    fetchWithBackoff,
    msfUrlPlayerGamelogs,
    msfUrlPlayerStatsTotals,
} from "@/lib/msfClient";
import "dotenv/config";
import { Pool } from "pg";

/* ================================
   Config / Env
   ================================ */
const SEASON_TAG = process.env.RK_SEASON_TAG ?? "2025-2026-regular";
const LEAGUE = process.env.RK_LEAGUE ?? "nhl";
const DATABASE_URL = process.env.DATABASE_URL || "";
const DRY_RUN = (process.env.RK_DRY_RUN ?? "") === "1";
const USE_GAMELOGS = (process.env.RK_USE_GAMELOGS ?? "") === "1";

// Constrain gamelogs to reduce 400s; default to opening week (Oct 7, 2025).
const SEASON_START = process.env.RK_SEASON_START ?? "20251007";
const PAGE_LIMIT = Math.max(50, Number(process.env.MSF_PAGE_LIMIT ?? 200)); // sane floor

if (!DATABASE_URL && !DRY_RUN)
    throw new Error("Missing DATABASE_URL (or set RK_DRY_RUN=1).");

const needsSSL =
    !!DATABASE_URL &&
    (DATABASE_URL.includes("supabase.co") ||
        DATABASE_URL.includes("pooler.supabase.com"));

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl:
        needsSSL || process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : undefined,
});

type TotalsRow = {
    season: string;
    player_id: string;
    player_name: string;
    team_abbr: string;
    position: string;
    gp: number;
    g: number;
    a: number;
    pim: number;
    ppg: number;
    ppa: number;
    ppp: number;
    shg: number;
    sha: number;
    shp: number;
    sog: number;
    fw: number;
    hit: number;
    blk: number;
};

/* ================================
   DB – Ensure + Upsert
   ================================ */
async function ensureTable(client: Pool) {
    await client.query(`
    CREATE TABLE IF NOT EXISTS player_stats_totals (
      season TEXT NOT NULL,
      player_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      team_abbr TEXT NOT NULL,
      position TEXT NOT NULL,
      gp INTEGER NOT NULL,
      g INTEGER NOT NULL,
      a INTEGER NOT NULL,
      pim INTEGER NOT NULL,
      ppg INTEGER NOT NULL,
      ppa INTEGER NOT NULL,
      ppp INTEGER NOT NULL,
      shg INTEGER NOT NULL,
      sha INTEGER NOT NULL,
      shp INTEGER NOT NULL,
      sog INTEGER NOT NULL,
      fw INTEGER NOT NULL,
      hit INTEGER NOT NULL,
      blk INTEGER NOT NULL,
      PRIMARY KEY (season, player_id)
    );
  `);
}

async function upsertTotals(client: Pool, row: TotalsRow) {
    await client.query(
        `
    INSERT INTO player_stats_totals (
      season, player_id, player_name, team_abbr, position,
      gp, g, a, pim, ppg, ppa, ppp, shg, sha, shp, sog, fw, hit, blk
    )
    VALUES (
      $1,$2,$3,$4,$5,
      $6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
    )
    ON CONFLICT (season, player_id) DO UPDATE SET
      player_name = EXCLUDED.player_name,
      team_abbr   = EXCLUDED.team_abbr,
      position    = EXCLUDED.position,
      gp          = EXCLUDED.gp,
      g           = EXCLUDED.g,
      a           = EXCLUDED.a,
      pim         = EXCLUDED.pim,
      ppg         = EXCLUDED.ppg,
      ppa         = EXCLUDED.ppa,
      ppp         = EXCLUDED.ppp,
      shg         = EXCLUDED.shg,
      sha         = EXCLUDED.sha,
      shp         = EXCLUDED.shp,
      sog         = EXCLUDED.sog,
      fw          = EXCLUDED.fw,
      hit         = EXCLUDED.hit,
      blk         = EXCLUDED.blk;
  `,
        [
            row.season,
            row.player_id,
            row.player_name,
            row.team_abbr,
            row.position,
            row.gp,
            row.g,
            row.a,
            row.pim,
            row.ppg,
            row.ppa,
            row.ppp,
            row.shg,
            row.sha,
            row.shp,
            row.sog,
            row.fw,
            row.hit,
            row.blk,
        ]
    );
}

/* ================================
   Parsing Helpers
   ================================ */
function num(x: any, fallback = 0) {
    const n = Number(x);
    return Number.isFinite(n) ? n : fallback;
}

// Defensive extractors for MSF stats shapes (seasonal totals or gamelog items)
function extractTotalsFromSeasonalEntry(e: any): TotalsRow | null {
    const player = e?.player || e?.playerEntry?.player || e?.playerEntry;
    // choose best-known team field, fallback to 'FA'
    const team =
        e?.team ||
        e?.playerEntry?.team ||
        e?.teamAsOfGame ||
        e?.game?.homeTeam ||
        e?.game?.awayTeam ||
        {};
    const stats = e?.stats || e?.playerEntry?.stats;

    const id = String(player?.id ?? player?.playerId ?? "");
    const first = player?.firstName ?? player?.first_name ?? "";
    const last = player?.lastName ?? player?.last_name ?? "";
    const name = [first, last].filter(Boolean).join(" ") || player?.name || "";
    const abbr = (team?.abbreviation ?? team?.abbrev ?? "FA")
        .toString()
        .toUpperCase();
    const pos = (player?.position ?? player?.primaryPosition ?? "F")
        .toString()
        .toUpperCase();

    // MSF shapes vary; try common nests
    const s = stats?.skaterStats ?? stats?.playerStats ?? stats ?? {};

    const gp = num(s.gamesPlayed ?? s.games ?? s.gp);
    const g = num(s.goals ?? s.g);
    const a = num(s.assists ?? s.a);
    const pim = num(s.pim ?? s.penaltyMinutes);
    const ppg = num(s.powerplayGoals ?? s.ppg);
    const ppa = num(s.powerplayAssists ?? s.ppa);
    const ppp = num(
        s.powerplayPoints ?? (num(s.powerplayGoals) + num(s.powerplayAssists))
    );
    const shg = num(s.shorthandedGoals ?? s.shg);
    const sha = num(s.shorthandedAssists ?? s.sha);
    const shp = num(
        s.shorthandedPoints ??
        (num(s.shorthandedGoals) + num(s.shorthandedAssists))
    );
    const sog = num(s.shots ?? s.sog);
    const fw = num(s.faceoffsWon ?? s.fw ?? s.faceOffsWon);
    const hit = num(s.hits ?? s.hit);
    const blk = num(s.blockedShots ?? s.blk);

    if (!id || !name) return null;

    return {
        season: SEASON_TAG,
        player_id: id,
        player_name: name,
        team_abbr: abbr || "FA",
        position: pos === "G" ? "G" : pos, // goalies present; you filter them later in the UI
        gp,
        g,
        a,
        pim,
        ppg,
        ppa,
        ppp,
        shg,
        sha,
        shp,
        sog,
        fw,
        hit,
        blk,
    };
}

function sumInto(map: Map<string, TotalsRow>, row: TotalsRow) {
    const prev = map.get(row.player_id);
    if (!prev) {
        map.set(row.player_id, { ...row });
        return;
    }
    prev.gp += row.gp;
    prev.g += row.g;
    prev.a += row.a;
    prev.pim += row.pim;
    prev.ppg += row.ppg;
    prev.ppa += row.ppa;
    prev.ppp += row.ppp;
    prev.shg += row.shg;
    prev.sha += row.sha;
    prev.shp += row.shp;
    prev.sog += row.sog;
    prev.fw += row.fw;
    prev.hit += row.hit;
    prev.blk += row.blk;
}

/* ================================
   Fetchers (MSF) via shared client
   ================================ */

// Preferred: seasonal totals (single call)
async function fetchSeasonalTotals(): Promise<TotalsRow[]> {
    const url = msfUrlPlayerStatsTotals(LEAGUE, SEASON_TAG);
    const { status, text } = await fetchWithBackoff(url);

    if (status !== 200) {
        if (/Access Restricted/i.test(text)) {
            throw new Error(
                `Access Restricted for seasonal totals. Your key may not include this feed.`
            );
        }
        throw new Error(`MSF HTTP ${status}: ${text.slice(0, 400)}`);
    }

    let json: any;
    try {
        json = JSON.parse(text);
    } catch {
        throw new Error("Failed to parse JSON from seasonal totals.");
    }

    const list: any[] =
        json?.playerStatsTotals ?? json?.playerStats ?? json?.players ?? [];

    const rows: TotalsRow[] = [];
    for (const e of list) {
        const row = extractTotalsFromSeasonalEntry(e);
        if (row) rows.push(row);
    }
    return rows;
}

// Fallback: derive totals by summing player gamelogs
// Constrained by date (since SEASON_START) to avoid 400s for huge season-wide requests.
async function fetchTotalsFromGamelogs(): Promise<TotalsRow[]> {
    const byPlayer = new Map<string, TotalsRow>();

    let page = 1;
    while (true) {
        const url = msfUrlPlayerGamelogs(LEAGUE, SEASON_TAG, {
            dateSince: SEASON_START,
            page,
            limit: PAGE_LIMIT,
        });
        const { status, text } = await fetchWithBackoff(url);

        if (status === 400) {
            throw new Error(
                `MSF HTTP 400 on page ${page}: try narrowing date window or reducing limit.`
            );
        }
        if (status === 403) {
            throw new Error(
                `Access Restricted for player gamelogs. Your key may not include this feed.`
            );
        }
        if (status !== 200) {
            throw new Error(`MSF HTTP ${status} on page ${page}: ${text.slice(0, 400)}`);
        }

        let json: any;
        try {
            json = JSON.parse(text);
        } catch {
            throw new Error(`Failed to parse JSON from gamelogs (page ${page}).`);
        }

        const list: any[] = json?.playerGamelogs ?? json?.gamelogs ?? [];
        if (!Array.isArray(list) || list.length === 0) break;

        for (const e of list) {
            const row = extractTotalsFromSeasonalEntry(e);
            if (!row) continue;
            // Each gamelog row is a single game; ensure gp increments by 1 at minimum.
            row.gp = Math.max(1, row.gp || 1);
            sumInto(byPlayer, row);
        }

        page += 1;
        if (list.length < PAGE_LIMIT) break; // reached the end
    }

    return [...byPlayer.values()];
}

/* ================================
   Main
   ================================ */
async function run() {
    console.log(`Rankings backfill: ${LEAGUE} ${SEASON_TAG}`);
    console.log(DRY_RUN ? "(DRY RUN: no DB writes)" : "(writing to DB)");

    if (!DRY_RUN) await ensureTable(pool);

    let rows: TotalsRow[] = [];
    try {
        if (!USE_GAMELOGS) {
            rows = await fetchSeasonalTotals();
        } else {
            rows = await fetchTotalsFromGamelogs();
        }
    } catch (e: any) {
        // If seasonal totals blocked or errored, try gamelogs automatically once:
        if (!USE_GAMELOGS && /Access Restricted|MSF HTTP \d+/.test(e?.message || "")) {
            console.warn(
                "Seasonal totals unavailable — falling back to player gamelogs (constrained date window)…"
            );
            rows = await fetchTotalsFromGamelogs();
        } else {
            throw e;
        }
    }

    console.log(`Fetched ${rows.length} player totals`);

    let upserts = 0;
    for (const r of rows) {
        if (DRY_RUN) {
            console.log(
                `${r.team_abbr} ${r.player_name} | GP ${r.gp} G ${r.g} A ${r.a} PIM ${r.pim} SOG ${r.sog} HIT ${r.hit} BLK ${r.blk} FW ${r.fw} PPP ${r.ppp} SHP ${r.shp}`
            );
        } else {
            await upsertTotals(pool, r);
            upserts++;
        }
    }

    console.log(DRY_RUN ? "Dry run complete." : `Upserts: ${upserts}`);
    await pool.end();
}

run().catch(async (e) => {
    console.error("Rankings backfill failed:", e?.message || e);
    try {
        await pool.end();
    } catch { }
    process.exit(1);
});
