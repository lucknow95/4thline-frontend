// src/app/api/crunch-palace/ingest/route.ts
import {
  abbrToFull,
  arenaForTeamFull,
  CURRENT_SEASON,
  // optional helper — implement this in your lib to run
  // `REFRESH MATERIALIZED VIEW CONCURRENTLY cp_team_hits_agg`
  refreshCrunchPalaceAgg,
  upsertHomeGameStat,
} from '@/lib/crunchPalace';
import { resolveAbbr } from '@/lib/teamMaps';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProviderRow = {
  game_id: string;
  date: string; // YYYY-MM-DD (America/Toronto local date)
  home_team: string; // abbr or full/city; we'll normalize
  home_hits: number;
  is_regular_season: boolean;
};

/**
 * TODO: Wire to MySportsFeeds (MSF).
 *
 * Notes:
 * - Use MSF creds from env: MSF_API_USERNAME/MSF_API_PASSWORD (or MSF_API_KEY).
 * - Fetch by *local date* (America/Toronto) and exclude preseason.
 * - Map provider payload -> ProviderRow[] exactly as below.
 */
async function fetchMSFHomeHitsForDate(dateYmd: string): Promise<ProviderRow[]> {
  const username = process.env.MSF_API_USERNAME;
  const password = process.env.MSF_API_PASSWORD;
  const apiKey = process.env.MSF_API_KEY;

  // If not configured yet, no-op so prod shows "No data yet" gracefully.
  if ((!username || !password) && !apiKey) return [];

  // 🔒 Implement the real MSF call here when ready.
  // Example outline:
  // const seasonPath = process.env.CP_SEASON?.replace('-', '') ?? '202526';
  // const yyyymmdd = dateYmd.replace(/-/g, '');
  // const url = `https://api.mysportsfeeds.com/v3/pull/nhl/${seasonPath}/date/${yyyymmdd}/games.json`;
  // const authHeader = apiKey
  //   ? `Basic ${Buffer.from(apiKey + ':MYSPORTSFEEDS').toString('base64')}`
  //   : `Basic ${Buffer.from(username + ':' + password).toString('base64')}`;
  // const resp = await fetch(url, { headers: { Authorization: authHeader } });
  // if (!resp.ok) throw new Error(`MSF fetch failed ${resp.status}`);
  // const json = await resp.json();
  // return json.games
  //   .filter((g: any) => g.schedule?.gameType === 'REG') // exclude preseason
  //   .map((g: any) => ({
  //     game_id: String(g.schedule?.id ?? g.game?.id ?? `${dateYmd}-${g.schedule?.homeTeam?.abbreviation ?? 'UNK'}`),
  //     date: dateYmd,
  //     home_team: g.schedule?.homeTeam?.abbreviation ?? g.schedule?.homeTeam?.name ?? '',
  //     home_hits: Number(g.stats?.homeTeam?.hits ?? 0),
  //     is_regular_season: true,
  //   }));

  return [];
}

/** Iterate dates (inclusive) in America/Toronto */
function* dateIter(from: Date, to: Date) {
  const d = new Date(from);
  while (d <= to) {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const ymd = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    yield ymd;
    d.setDate(d.getDate() + 1);
  }
}

/** Parse query params */
function parseRange(req: NextRequest) {
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const date = url.searchParams.get('date');
  const dry = url.searchParams.get('dryRun') === '1';
  const season = url.searchParams.get('season') ?? CURRENT_SEASON;

  // Default: “yesterday” in America/Toronto
  const now = new Date();
  const toronto = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', dateStyle: 'short' });
  const [mm, dd, yy] = toronto.format(now).split('/');
  const todayLocal = new Date(Number(`20${yy}`), Number(mm) - 1, Number(dd));
  const defaultFrom = new Date(todayLocal);
  defaultFrom.setDate(defaultFrom.getDate() - 1);

  if (date) return { from: date, to: date, dry, season };
  if (from && to) return { from, to, dry, season };

  const y = defaultFrom.getFullYear();
  const m = defaultFrom.getMonth() + 1;
  const d = defaultFrom.getDate();
  const ymd = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { from: ymd, to: ymd, dry, season };
}

/** Normalize a provider team label to our UTA-style abbr */
function normalizeAbbr(s: string): string | null {
  if (!s) return null;
  // Already a 3-letter code?
  if (s.length === 3 && /^[A-Z]{3}$/.test(s)) return s;
  // Resolve from our maps:
  return resolveAbbr(s);
}

export async function POST(req: NextRequest) {
  // 1) 🔒 Cron auth
  const secret = req.headers.get('x-cron-secret');
  const expected = process.env.CP_CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { from, to, dry, season } = parseRange(req);

  try {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    let attempted = 0;
    let inserted = 0;

    for (const ymd of dateIter(fromDate, toDate)) {
      const rows = await fetchMSFHomeHitsForDate(ymd);

      for (const r of rows) {
        attempted++;
        if (!r.is_regular_season) continue;

        const abbr = normalizeAbbr(r.home_team);
        if (!abbr) continue;

        const teamFull = abbrToFull[abbr] ?? r.home_team;
        const arena = arenaForTeamFull(teamFull);

        if (!dry) {
          await upsertHomeGameStat({
            game_id: r.game_id,
            date: r.date,
            team_abbr: abbr,
            team_full: teamFull,
            arena_name: arena,
            hits: Math.max(0, r.home_hits | 0),
            is_regular_season: true,
            season,
          });
        }
        inserted++;
      }
    }

    // 2) 🔄 Refresh materialized view (only if we actually wrote data)
    if (!dry && inserted > 0 && typeof refreshCrunchPalaceAgg === 'function') {
      await refreshCrunchPalaceAgg(); // internally runs: REFRESH MATERIALIZED VIEW CONCURRENTLY cp_team_hits_agg
    }

    return NextResponse.json({
      ok: true,
      season,
      from,
      to,
      dryRun: dry,
      attempted,
      inserted,
    });
  } catch (err: any) {
    // Helpful error text for logs
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
