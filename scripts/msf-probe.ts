// scripts/msf-probe.ts
// Drop-in probe implementing:
//  - buildGamelogsUrl (MSF path-style date handling + optional team)
//  - team normalization (prefer 3-letter abbreviations like TOR)
//  - friendly console output (counts + preview)
//  - optional totals endpoints via MSF_PROBE_SKIP_TOTALS
//  - fetchWithBackoff (429 handling)

type GamelogsOpts = {
    season: string;
    from?: string | null;
    to?: string | null;
    team?: string | null;
    page?: number;
    limit?: number;
};

/** Normalize input team:
 * - If already a 3-letter code, uppercase it (e.g., tor -> TOR).
 * - Otherwise, keep as user provided but hyphenate spaces (Toronto Maple Leafs -> Toronto-Maple-Leafs).
 * MSF endpoints tend to work best with 3-letter codes for filters.
 */
function normalizeTeam(team: string): string {
    const t = (team || "").trim();
    if (!t) return "";
    if (/^[A-Za-z]{3}$/.test(t)) return t.toUpperCase();
    return t.replace(/\s+/g, "-");
}

// ✅ Correct MSF v2.1 gamelogs: PATH-style date + player_gamelogs.json (no stats=stats)
function buildGamelogsUrl(opts: GamelogsOpts) {
    const season = opts.season;
    const from = (opts.from || "").trim();
    const to = (opts.to || "").trim();
    const team = normalizeTeam(opts.team || "");
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 25;

    // PATH segment: /date/YYYYMMDD  OR  /date/from-YYYYMMDD-to-YYYYMMDD
    let dateSeg = "date";
    if (from && to && from !== to) {
        dateSeg += `/from-${from}-to-${to}`;
    } else {
        const day = from || to || "";
        if (day) dateSeg += `/${day}`;
    }

    const teamPart = team ? `&team=${encodeURIComponent(team)}` : "";
    return `https://api.mysportsfeeds.com/v2.1/pull/nhl/${season}/${dateSeg}/player_gamelogs.json?page=${page}&limit=${limit}${teamPart}`;
}

// --- backoff fetch ---
async function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithBackoff(url: string, init: RequestInit = {}, attempt = 1, maxAttempts = 5): Promise<Response> {
    const res = await fetch(url, init);
    if (res.status === 429 && attempt < maxAttempts) {
        const retryAfterHeader = res.headers.get("retry-after");
        const retryAfterSec = Number(retryAfterHeader) || 1;
        const jitter = 250 + Math.floor(Math.random() * 750); // 250..1000 ms
        const waitMs = retryAfterSec * 1000 + jitter;
        console.warn(`[Probe][429] ${url} -> retry in ${waitMs}ms (attempt ${attempt}/${maxAttempts})`);
        await sleep(waitMs);
        return fetchWithBackoff(url, init, attempt + 1, maxAttempts);
    }
    return res;
}

// --- simple helper to safe-get text/json with logging ---
async function safeFetchJson(url: string, init: RequestInit = {}) {
    try {
        const res = await fetchWithBackoff(url, init);
        const text = await res.text();
        let parsed: any = null;
        try {
            parsed = JSON.parse(text);
        } catch {
            /* not JSON */
        }
        return { status: res.status, headers: res.headers, bodyText: text, bodyJson: parsed };
    } catch (err) {
        console.error("[Probe] fetch error:", err);
        throw err;
    }
}

// --- probe flow (main) ---
async function main() {
    const season = process.env.MSF_PROBE_SEASON || "2025-2026-regular";
    const from = process.env.RK_PROBE_FROM || "";
    const to = process.env.RK_PROBE_TO || "";
    const team = process.env.MSF_PROBE_TEAM || "";
    const limit = Number(process.env.MSF_PROBE_LIMIT || "25");
    const page = Number(process.env.MSF_PROBE_PAGE || "1");
    const SKIP_TOTALS = process.env.MSF_PROBE_SKIP_TOTALS === "1";

    // Build gamelogs URL
    const gamelogsUrl = buildGamelogsUrl({ season, from, to, team, limit, page });
    console.log("[Probe] gamelogs URL:", gamelogsUrl);

    // MSF auth — use Basic (APIKEY:MYSPORTSFEEDS) or explicit env
    const commonHeaders: Record<string, string> = {};
    if (process.env.MSF_API_KEY) {
        const b64 = Buffer.from(`${process.env.MSF_API_KEY}:MYSPORTSFEEDS`).toString("base64");
        commonHeaders["Authorization"] = `Basic ${b64}`;
    } else if (process.env.MSF_BASIC_AUTH) {
        commonHeaders["Authorization"] = `Basic ${process.env.MSF_BASIC_AUTH}`;
    } else if (process.env.MSF_BEARER) {
        commonHeaders["Authorization"] = `Bearer ${process.env.MSF_BEARER}`;
    } else {
        console.warn("[Probe] ⚠️ No MSF auth env found; expect 401.");
    }

    // 1) Call player_gamelogs
    console.log("[Probe] fetching player_gamelogs...");
    const gl = await safeFetchJson(gamelogsUrl, { headers: commonHeaders });
    console.log(`[Probe] player_gamelogs -> status ${gl.status}`);

    if (gl.bodyJson) {
        const arr =
            gl.bodyJson.playerGamelogs ||
            gl.bodyJson.gamelogs ||
            gl.bodyJson.games ||
            [];
        const count = Array.isArray(arr) ? arr.length : 0;
        console.log(`[Probe] gamelogs count: ${count}`);
        if (Array.isArray(arr) && arr.length) {
            const preview = arr.slice(0, 3).map((g: any) => {
                const p = g.player || {};
                const t = g.team || {};
                const fn = p.firstName ?? "";
                const ln = p.lastName ?? "";
                const ab = t.abbreviation ?? t.name ?? "";
                return `${fn} ${ln} (${ab})`;
            });
            console.log("[Probe] sample:", preview.join(" | "));
        }
    } else {
        console.log("[Probe] gamelogs raw:", gl.bodyText.slice(0, 600));
    }

    // small jitter before next call
    await sleep(500 + Math.floor(Math.random() * 500));

    // 2) Optionally call totals endpoints (guarded by SKIP_TOTALS)
    if (!SKIP_TOTALS) {
        const playerTotalsUrl = `https://api.mysportsfeeds.com/v2.1/pull/nhl/${season}/player_stats_totals.json?stats=gamesPlayed&limit=1`;
        console.log("[Probe] fetching player_stats_totals...");
        const pt = await safeFetchJson(playerTotalsUrl, { headers: commonHeaders });
        console.log(`[Probe] player_stats_totals -> status ${pt.status}`);
        if (pt.bodyJson && pt.bodyJson.meta) {
            console.log("[Probe] player_stats_totals meta sample:", JSON.stringify(pt.bodyJson.meta));
        }

        await sleep(500 + Math.floor(Math.random() * 500));

        const teamTotalsUrl = `https://api.mysportsfeeds.com/v2.1/pull/nhl/${season}/team_stats_totals.json?limit=1`;
        console.log("[Probe] fetching team_stats_totals...");
        const tt = await safeFetchJson(teamTotalsUrl, { headers: commonHeaders });
        console.log(`[Probe] team_stats_totals -> status ${tt.status}`);
    } else {
        console.log("[Probe] SKIP_TOTALS=1 -> skipping player_stats_totals and team_stats_totals");
    }

    console.log("[Probe] done.");
}

// run
main().catch((err) => {
    console.error("[Probe] unhandled error:", err);
    process.exit(1);
});
