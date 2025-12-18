// src/lib/msfClient.ts
// Shared helper for MySportsFeeds API access
// Used by scripts like rankings-backfill.ts, cp-backfill.ts, msf-probe.ts
// -----------------------------------------------------------------------

import "dotenv/config";

/* ===========================================================================
   Config
   =========================================================================== */

const API_KEY =
    process.env.MSF_API_KEY || process.env.MYSPORTSFEEDS_API_KEY || "";
const API_PASSWORD = process.env.MSF_API_PASSWORD || "MYSPORTSFEEDS";

if (!API_KEY) {
    throw new Error("Missing MSF_API_KEY (or MYSPORTSFEEDS_API_KEY).");
}

/* ===========================================================================
   Auth + Utilities
   =========================================================================== */

export function msfAuthHeader(): Record<string, string> {
    const token = Buffer.from(`${API_KEY}:${API_PASSWORD}`).toString("base64");
    return { Authorization: `Basic ${token}` };
}

export function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

function parseRetryAfterSeconds(h: string | null): number | null {
    if (!h) return null;
    // Could be seconds or HTTP-date; MSF typically returns seconds
    const secs = Number(h);
    return Number.isFinite(secs) ? Math.max(0, secs) : null;
}

/**
 * Fetch with backoff for MSF endpoints.
 * Retries on:
 *  - 429 (rate limited) honoring Retry-After when present (or exponential delay)
 *  - 5xx (server wobble) with exponential delay
 * Never retries other 4xx.
 */
export async function fetchWithBackoff(
    url: string,
    tries = 3,
    initialDelayMs = 750
): Promise<{ status: number; text: string }> {
    let delay = initialDelayMs;

    for (let i = 0; i < tries; i++) {
        const res = await fetch(url, { headers: msfAuthHeader() });
        const text = await res.text();

        if (res.status === 429 && i < tries - 1) {
            const retryAfterHeader = res.headers.get("retry-after");
            const retryAfterSecs = parseRetryAfterSeconds(retryAfterHeader);
            const waitMs = retryAfterSecs != null ? retryAfterSecs * 1000 : delay;
            console.warn(
                `[MSF] ${url} → 429 (rate limited). Retrying in ${waitMs}ms${retryAfterSecs != null ? ` (Retry-After=${retryAfterSecs}s)` : ""
                }`
            );
            await sleep(waitMs);
            delay *= 2;
            continue;
        }

        if (res.status >= 500 && i < tries - 1) {
            console.warn(`[MSF] ${url} → ${res.status} (retrying in ${delay}ms)`);
            await sleep(delay);
            delay *= 2;
            continue;
        }

        return { status: res.status, text };
    }

    return { status: 599, text: "Exhausted retries" };
}

/* ===========================================================================
   Endpoint Builders
   =========================================================================== */

export function msfUrlPlayerStatsTotals(
    league: string,
    season: string
): string {
    return `https://api.mysportsfeeds.com/v2.1/pull/${league}/${season}/player_stats_totals.json?stats=stats`;
}

export function msfUrlTeamStatsTotals(
    league: string,
    season: string
): string {
    return `https://api.mysportsfeeds.com/v2.1/pull/${league}/${season}/team_stats_totals.json?stats=stats`;
}

export function msfUrlPlayerGamelogs(
    league: string,
    season: string,
    opts: {
        dateSince?: string;
        dateFrom?: string;
        dateTo?: string;
        team?: string; // NEW: optional team filter (NHL abbr like TOR, BOS, EDM)
        page?: number;
        limit?: number;
    } = {}
): string {
    const parts: string[] = [];

    if (opts.dateFrom && opts.dateTo) {
        parts.push(`date=from-${opts.dateFrom}-to-${opts.dateTo}`);
    } else if (opts.dateSince) {
        parts.push(`date=since-${opts.dateSince}`);
    }
    if (opts.team) {
        parts.push(`team=${encodeURIComponent(opts.team)}`);
    }

    const page = opts.page ?? 1;
    const limit = opts.limit ?? 200;

    const qp = [
        ...parts,
        "stats=stats",
        `page=${page}`,
        `limit=${limit}`,
    ]
        .filter(Boolean)
        .join("&");

    return `https://api.mysportsfeeds.com/v2.1/pull/${league}/${season}/player_gamelogs.json?${qp}`;
}

export function msfUrlGames(league: string, season: string): string {
    return `https://api.mysportsfeeds.com/v2.1/pull/${league}/${season}/games.json`;
}

export function msfUrlBoxscoreByDate(
    league: string,
    season: string,
    yyyymmdd: string
): string {
    return `https://api.mysportsfeeds.com/v2.1/pull/${league}/${season}/date/${yyyymmdd}/boxscore.json`;
}

/* ===========================================================================
   Extras
   =========================================================================== */

/** Build contiguous YYYYMMDD windows between [from, to], size in days (inclusive). */
export function buildDateWindows(
    fromYmd: string,
    toYmd: string,
    windowDays = 3
): Array<{ from: string; to: string }> {
    const res: Array<{ from: string; to: string }> = [];
    const toDate = (ymd: string) =>
        new Date(
            Number(ymd.slice(0, 4)),
            Number(ymd.slice(4, 6)) - 1,
            Number(ymd.slice(6, 8))
        );
    const pad = (n: number) => String(n).padStart(2, "0");
    const toYmdStr = (d: Date) =>
        `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

    let cur = toDate(fromYmd);
    const end = toDate(toYmd);

    while (cur <= end) {
        const startStr = toYmdStr(cur);
        const tmp = new Date(cur);
        tmp.setDate(tmp.getDate() + (windowDays - 1));
        const stop = tmp > end ? end : tmp;
        const stopStr = toYmdStr(stop);
        res.push({ from: startStr, to: stopStr });

        // advance to next day after stop
        const next = new Date(stop);
        next.setDate(next.getDate() + 1);
        cur = next;
    }
    return res;
}

/* ===========================================================================
   Quick Diagnostic Wrapper
   =========================================================================== */

export async function probeEndpoint(name: string, url: string) {
    try {
        const { status, text } = await fetchWithBackoff(url);
        const snippet = text.slice(0, 240).replace(/\s+/g, " ").trim();
        console.log(`[${status}] ${name}`);
        console.log(`  GET ${url}`);
        console.log(`  Snip: ${snippet}\n`);
    } catch (err: any) {
        console.error(`[ERR] ${name}: ${err?.message || err}`);
    }
}
