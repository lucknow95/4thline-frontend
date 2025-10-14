// scripts/cp-backfill.ts
//
// One-off backfill to populate cp_team_hits from the start of a season to today.
// It fetches daily game data from MySportsFeeds (home team hits only), normalizes
// to your schema, upserts via upsertHomeGameStat, then refreshes the materialized
// view so the site shows updated numbers immediately.
//
// Run locally (Windows PowerShell):
//   # ensure envs loaded (dotenv picks up .env.local if you set DOTENV_CONFIG_PATH)
//   #   $env:DOTENV_CONFIG_PATH = ".env.local"
//   # using tsx runner (recommended):
//   #   npx tsx -r dotenv/config scripts/cp-backfill.ts
//   # or with ts-node ESM loader:
//   #   node --require dotenv/config --loader ts-node/esm scripts/cp-backfill.ts
//
// Required env (in .env.local or set in shell):
//   DATABASE_URL=postgresql://...                    (used by lib's pg Pool)
//   CP_SEASON=2025-26
//   CP_SEASON_START=2025-10-06                       (optional; default is season-appropriate)
//
//   1️⃣ MSF_API_KEY=your_mysportsfeeds_api_key_here   <-- put this in .env.local (do NOT hardcode in code)
//
//   2️⃣ In production (Vercel), also add MSF_API_KEY in Project → Settings → Environment Variables
//
//   3️⃣ If your local DB connection needs SSL, use ?sslmode=require on DATABASE_URL
//
//   4️⃣ After saving .env.local, open a NEW terminal before running the script

import {
    abbrToFull,
    arenaForTeamFull,
    CURRENT_SEASON,
    refreshCrunchPalaceAgg,
    upsertHomeGameStat,
} from '../src/lib/crunchPalace';
import { resolveAbbr } from '../src/lib/teamMaps';

/* -----------------------------------------------------------------------------
   Types
----------------------------------------------------------------------------- */
type ProviderRow = {
    game_id: string;
    date: string; // YYYY-MM-DD (America/Toronto)
    home_team: string; // abbr or full/city; we'll normalize
    home_hits: number;
    is_regular_season: boolean;
};

/* -----------------------------------------------------------------------------
   Date helpers
----------------------------------------------------------------------------- */
function ymd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + n);
    return copy;
}

function parseISODate(s: string): Date {
    // s expected as YYYY-MM-DD
    const [yStr, mStr, dStr] = s.split('-');

    const y = Number(yStr); // required
    const m = Number(mStr ?? '1'); // default January
    const d = Number(dStr ?? '1'); // default 1st

    // Guard against NaN
    const yy = Number.isFinite(y) ? y : 1970;
    const mm = Number.isFinite(m) ? m : 1;
    const dd = Number.isFinite(d) ? d : 1;

    return new Date(yy, mm - 1, dd);
}

function todayInToronto(): Date {
    // Get "date only" for America/Toronto
    const tz = 'America/Toronto';
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());

    const yearPart = parts.find((p) => p.type === 'year')?.value;
    const monthPart = parts.find((p) => p.type === 'month')?.value;
    const dayPart = parts.find((p) => p.type === 'day')?.value;

    if (!yearPart || !monthPart || !dayPart) {
        throw new Error('Could not compute local Toronto date');
    }

    return new Date(Number(yearPart), Number(monthPart) - 1, Number(dayPart));
}

/* -----------------------------------------------------------------------------
   Season helpers
----------------------------------------------------------------------------- */
function toMSFSeasonPath(season: string): string {
    // Convert "YYYY-YY" → "YYYY-YYYY-regular"
    const [startStr, endShort] = season.split('-');
    const start = Number(startStr);
    const endFull = endShort?.length === 2 ? `20${endShort}` : endShort;
    if (!Number.isFinite(start) || !endFull) {
        throw new Error(`Bad CP_SEASON: ${season}`);
    }
    return `${start}-${endFull}-regular`;
}

function defaultSeasonStart(season: string): string {
    // For 2025-26 the NHL regular season starts Oct 6, 2025 (project baseline).
    if (season === '2025-26') return '2025-10-06';
    // Reasonable default for other seasons: Oct 1 of the start year
    const startYear = Number(season.split('-')[0]);
    return `${startYear}-10-01`;
}

/* -----------------------------------------------------------------------------
   Provider fetch (API key only)
   - Uses MSF v3 first; falls back to v2.1 if v3 returns 400/404.
   - Returns only HOME rows and only REG season rows.
----------------------------------------------------------------------------- */
const MSF_API_KEY = process.env.MSF_API_KEY; // 1️⃣ must be set in .env.local

function msfAuthHeader(): string {
    if (!MSF_API_KEY) {
        console.warn('[MSF] API key not found. Set MSF_API_KEY in .env.local');
        return '';
    }
    // MSF uses Basic auth: username = API key, password = "MYSPORTSFEEDS"
    return `Basic ${Buffer.from(`${MSF_API_KEY}:MYSPORTSFEEDS`).toString('base64')}`;
}

async function fetchMSFHomeHitsForDate(dateYmd: string): Promise<ProviderRow[]> {
    if (!MSF_API_KEY) {
        console.warn(`[MSF] Credentials not configured; ${dateYmd} will ingest 0 rows.`);
        return [];
    }

    const seasonRaw = (process.env.CP_SEASON || CURRENT_SEASON).trim();
    const vSeason = toMSFSeasonPath(seasonRaw); // e.g., "2025-2026-regular"
    const yyyymmdd = dateYmd.replace(/-/g, '');
    const Authorization = msfAuthHeader();

    const tryV3 = async (): Promise<ProviderRow[] | null> => {
        const url = `https://api.mysportsfeeds.com/v3/pull/nhl/${vSeason}/date/${yyyymmdd}/games.json`;
        const resp = await fetch(url, { headers: { Authorization } });

        // Common "no games / out of range" statuses → fall back
        if (resp.status === 404 || resp.status === 400) {
            console.warn(`[MSF v3] ${dateYmd} ${resp.status} ${resp.statusText} :: ${url}`);
            return null; // try fallback
        }
        if (!resp.ok) {
            console.warn(`[MSF v3] ${dateYmd} ${resp.status} ${resp.statusText} :: ${url}`);
            return null;
        }

        const json: any = await resp.json();
        const games = Array.isArray(json?.games) ? json.games : [];

        const rows: ProviderRow[] = [];
        for (const g of games) {
            const sched = g.schedule ?? g.game ?? {};
            const stats = g.stats ?? {};
            const gameType = sched.gameType || sched.scheduleStatus || '';
            const isReg = String(gameType).toUpperCase().includes('REG'); // "REG" or "REGULAR"

            // Prefer abbreviation, fall back to name
            const homeAbbr =
                sched.homeTeam?.abbreviation ??
                sched.homeTeamAbbreviation ??
                sched.homeTeam?.name ??
                '';

            // Robust hits extraction across payload shapes
            const hitsCandidates = [
                stats?.homeTeam?.hits,
                stats?.home?.hits,
                stats?.homeTeamStats?.hits,
                stats?.homeTeam?.teamStats?.hits,
            ];
            const hitsFirst = hitsCandidates.find((x) => x !== undefined);
            const homeHits = Number(hitsFirst ?? 0);

            rows.push({
                game_id: String(sched.id ?? `${dateYmd}-${homeAbbr || 'UNK'}`),
                date: dateYmd,
                home_team: String(homeAbbr || ''),
                home_hits: Number.isFinite(homeHits) ? homeHits : 0,
                is_regular_season: !!isReg,
            });
        }
        return rows;
    };

    const tryV21 = async (): Promise<ProviderRow[] | null> => {
        // ✅ FIX: v2.1 needs a single-day DATE RANGE (YYYYMMDD-YYYYMMDD)
        const dateRange = `${yyyymmdd}-${yyyymmdd}`;
        const url = `https://api.mysportsfeeds.com/v2.1/pull/nhl/${vSeason}/team_gamelogs.json?date=${dateRange}`;
        const resp = await fetch(url, { headers: { Authorization } });

        // MSF often returns 400/404 when no games fall within the season slice for that date.
        if (resp.status === 404 || resp.status === 400) {
            console.warn(`[MSF v2.1] ${dateYmd} ${resp.status} ${resp.statusText} :: ${url}`);
            return []; // treat as "no games that day"
        }
        if (!resp.ok) {
            console.warn(`[MSF v2.1] ${dateYmd} ${resp.status} ${resp.statusText} :: ${url}`);
            return null;
        }

        const json: any = await resp.json();
        // Common v2.1 shapes; normalize:
        const logs = json?.teamgamelogs ?? json?.teamGameLogs ?? json?.gamelogs ?? [];
        const rows: ProviderRow[] = [];

        for (const lg of logs) {
            const team = lg?.team || lg?.teamStats?.team || {};
            const game = lg?.game || lg?.gameSchedule || {};
            const stats = lg?.stats || lg?.teamStats || {};
            const gameType = game?.gameType || game?.gameScheduleType || '';
            const isReg = String(gameType).toUpperCase().includes('REG'); // "REGULAR" etc.

            // Only keep HOME rows; many v2.1 payloads include homeOrAway
            const hoa = (lg?.homeOrAway ?? lg?.isHomeTeam) as string | boolean | undefined;
            const isHome =
                typeof hoa === 'string'
                    ? hoa.toUpperCase() === 'HOME'
                    : typeof hoa === 'boolean'
                        ? !!hoa
                        : true; // if absent, assume home (or change to skip)

            if (!isHome) continue;

            const homeAbbr = team?.abbreviation ?? team?.abbrev ?? team?.name ?? '';

            const hitsCandidates = [stats?.hits?.overall, stats?.hits];
            const hitsFirst = hitsCandidates.find((x) => x !== undefined);
            const homeHits = Number(hitsFirst ?? 0);

            rows.push({
                game_id: String(game?.id ?? `${dateYmd}-${homeAbbr || 'UNK'}`),
                date: dateYmd,
                home_team: String(homeAbbr || ''),
                home_hits: Number.isFinite(homeHits) ? homeHits : 0,
                is_regular_season: !!isReg,
            });
        }
        return rows;
    };

    try {
        const v3 = await tryV3();
        if (v3 !== null) return v3; // got data (or empty) from v3
    } catch (e: any) {
        console.warn(`[MSF v3] ${dateYmd} threw`, String(e?.message ?? e));
    }

    try {
        const v21 = await tryV21();
        if (v21 !== null) return v21;
    } catch (e: any) {
        console.warn(`[MSF v2.1] ${dateYmd} threw`, String(e?.message ?? e));
    }

    console.warn(`[MSF] ${dateYmd} returned no results from v3 or v2.1`);
    return [];
}

/* -----------------------------------------------------------------------------
   Normalization helpers
----------------------------------------------------------------------------- */
function normalizeAbbr(s: string): string | null {
    if (!s) return null;
    if (s.length === 3 && /^[A-Z]{3}$/.test(s)) return s;
    return resolveAbbr(s);
}

function sanitizeHits(n: unknown): number {
    const v = Number(n);
    return Number.isFinite(v) && v >= 0 ? Math.trunc(v) : 0;
}

/* -----------------------------------------------------------------------------
   Main backfill
----------------------------------------------------------------------------- */
async function backfill() {
    const season = (process.env.CP_SEASON ?? CURRENT_SEASON).trim();

    // sanity check: basic "YYYY-YY" shape
    if (!/^\d{4}-\d{2}$/.test(season)) {
        throw new Error(`Invalid CP_SEASON format "${season}". Expected "YYYY-YY" (e.g., 2025-26).`);
    }

    // Season-aware default start:
    const startDefault = (process.env.CP_SEASON_START || defaultSeasonStart(season)).trim();
    const start = parseISODate(startDefault);

    // If user mistakenly sets a start in the future, bail early
    const todayLocal = todayInToronto();
    if (start > todayLocal) {
        console.log(
            `Start date ${ymd(start)} is after today's Toronto date ${ymd(todayLocal)}. Nothing to do.`
        );
        return;
    }

    let cursor = start;
    let totalInserted = 0;
    let totalAttempted = 0;
    let totalRegularSeasonDiscarded = 0;

    console.log(
        `Crunch Palace backfill: season=${season}, from=${ymd(cursor)} to=${ymd(todayLocal)}`
    );

    // Defensive loop bound (avoid accidental infinite loop)
    const hardStop = addDays(todayLocal, 2);

    while (cursor <= todayLocal && cursor < hardStop) {
        const dateStr = ymd(cursor);
        try {
            const rows = await fetchMSFHomeHitsForDate(dateStr);
            totalAttempted += rows.length;

            let insertedForDay = 0;
            for (const r of rows) {
                if (!r.is_regular_season) {
                    totalRegularSeasonDiscarded++;
                    continue;
                }

                const abbr = normalizeAbbr(r.home_team);
                if (!abbr) continue;

                const teamFull = (abbrToFull as Record<string, string>)[abbr] ?? r.home_team;
                const arena = arenaForTeamFull(teamFull);

                await upsertHomeGameStat({
                    game_id: r.game_id, // optional: kept for logging/compatibility
                    date: r.date,
                    team_abbr: abbr,
                    team_full: teamFull,
                    arena_name: arena,
                    hits: sanitizeHits(r.home_hits),
                    is_regular_season: true,
                    season,
                });
                insertedForDay++;
            }

            console.log(
                `${dateStr}: fetched=${rows.length}, inserted=${insertedForDay}${rows.length && rows.length !== insertedForDay
                    ? ` (skipped ${rows.length - insertedForDay})`
                    : ''
                }`
            );
            totalInserted += insertedForDay;
        } catch (err: any) {
            console.error(`${dateStr}: error`, err?.message ?? String(err));
        }

        cursor = addDays(cursor, 1);
    }

    console.log(
        `Refreshing materialized view… (inserted ${totalInserted} of ${totalAttempted} attempted, ` +
        `discarded non-REG=${totalRegularSeasonDiscarded})`
    );
    await refreshCrunchPalaceAgg();
    console.log('Backfill complete.');
}

/* -----------------------------------------------------------------------------
   Entrypoint
----------------------------------------------------------------------------- */
backfill().catch((err) => {
    console.error(err);
    process.exit(1);
});
