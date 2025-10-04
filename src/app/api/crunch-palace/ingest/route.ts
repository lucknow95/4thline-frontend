// src/app/api/crunch-palace/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { upsertHomeGameStat, abbrToFull, arenaForTeamFull, CURRENT_SEASON } from '@/lib/crunchPalace';
import { resolveAbbr } from '@/lib/teamMaps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProviderRow = {
  game_id: string;
  date: string; // YYYY-MM-DD (America/Toronto)
  home_team: string; // can be abbr or full/city (we'll normalize)
  home_hits: number;
  is_regular_season: boolean;
};

/**
 * TODO: Wire to MySportsFeeds.
 * For now, this returns an empty array so prod shows "No data yet" until MSF is connected.
 * Implement by day (local ET). You can also accept a date range if MSF supports it.
 */
async function fetchMSFHomeHitsForDate(dateYmd: string): Promise<ProviderRow[]> {
  // Example outline (pseudo):
  // const apiKey = process.env.MYSPORTSFEEDS_API_KEY!;
  // const resp = await fetch(`https://api.mysportsfeeds.com/v3/pull/nhl/2025-2026/date/${dateYmd}/games.json`, { headers: { Authorization: `Basic ${btoa(apiKey + ':MYSPORTSFEEDS')}` }});
  // Map provider payload -> ProviderRow[]
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
  // If provider already sends 3-letter code:
  if (s.length === 3 && /^[A-Z]{3}$/.test(s)) return s;
  // Try resolving from our maps:
  return resolveAbbr(s);
}

export async function POST(req: NextRequest) {
  const { from, to, dry, season } = parseRange(req);

  try {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    let inserted = 0;
    for (const ymd of dateIter(fromDate, toDate)) {
      const rows = await fetchMSFHomeHitsForDate(ymd);

      for (const r of rows) {
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

    return NextResponse.json({ ok: true, from, to, season, inserted, dryRun: dry });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
