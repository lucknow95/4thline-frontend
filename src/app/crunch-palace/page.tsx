// src/app/crunch-palace/page.tsx
'use client';

import { arenaMap } from '@/data/arenaMap';
import rawSchedule from '@/data/nhlSchedule.json';
import { ymdToNumber, type TeamBlock } from '@/lib/optimizer';
import { cityToAbbr, fullTeamToAbbr } from '@/lib/teamMaps';
import '@/styles/data-table.css'; // unified data-table visuals
import { useMemo, useState } from 'react';

type Mode = 'total' | 'perGame';

/* ---------------- Legacy JSON types (what nhlSchedule.json currently looks like) ---------------- */
type OldGame = {
  date: string;            // "YYYY-MM-DD"
  home_team: string;       // full team name or city label
  away_team: string;       // full team name or city label
  time?: string | null;
  venue?: string | null;
  special_game?: string | null;
};
type OldTeamBlock = {
  team: string;            // team abbreviation, e.g., "COL"
  schedule: OldGame[];
};

/* ---------------- Helpers to normalize labels and resolve abbreviations ---------------- */
function normalizeLabel(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^St[.]?\s+Louis$/i, 'St. Louis')
    .replace(/^Montr(e|é)al$/i, 'Montréal')
    // Utah variants occasionally appear differently in external text
    .replace(/^Utah (Hockey Club|Coyotes)$/i, 'Utah Mammoth'); // normalize to current site usage
}

function resolveAbbr(label: string): string | null {
  const name = normalizeLabel(label);
  // Try full official names first
  const byFull = (fullTeamToAbbr as Record<string, string>)[name];
  if (byFull) return byFull;

  // Then city/short labels
  const byCity = (cityToAbbr as Record<string, string>)[name];
  if (byCity) return byCity;

  // Avoid ambiguous bare "New York"
  if (/^New York$/i.test(name)) return null;

  // Fallback: first word as city hint ("Colorado Avalanche" -> "Colorado")
  const first = name.split(/\s+/)[0] ?? '';
  if (!first) return null;
  const byFirst = (cityToAbbr as Record<string, string>)[first];
  if (byFirst) return byFirst;

  return null;
}

/* ---------------- Convert old JSON into new TeamBlock shape (defensive) ---------------- */
function convertToNewBlocks(oldBlocks: OldTeamBlock[]): TeamBlock[] {
  const out: TeamBlock[] = [];

  for (const tb of oldBlocks) {
    const teamAbbr = tb?.team;
    if (!teamAbbr || !Array.isArray(tb.schedule)) continue;

    const games = tb.schedule
      .map((g) => {
        if (!g?.date || !g?.home_team || !g?.away_team) return null;

        const ymd = ymdToNumber(g.date);
        if (Number.isNaN(ymd)) return null;

        const homeAbbr = resolveAbbr(g.home_team);
        const awayAbbr = resolveAbbr(g.away_team);
        if (!homeAbbr || !awayAbbr) return null;

        const isHome = homeAbbr === teamAbbr;
        const opp = isHome ? awayAbbr : homeAbbr;

        return { ymd, home: isHome, opp };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.ymd - b.ymd);

    out.push({ team: teamAbbr, games });
  }

  out.sort((a, b) => a.team.localeCompare(b.team));
  return out;
}

/* ---------------- Load & convert schedule once at module scope ---------------- */
const legacyBlocks = (rawSchedule as unknown) as OldTeamBlock[];
const leagueSchedule: TeamBlock[] = Array.isArray(legacyBlocks)
  ? convertToNewBlocks(legacyBlocks)
  : [];

/* ---------------- Mock data stays the same ---------------- */
const mockTeamHits: { [team: string]: number } = {
  'Anaheim Ducks': 1287,
  'Boston Bruins': 1490,
  'Buffalo Sabres': 1333,
  'Calgary Flames': 1422,
  'Carolina Hurricanes': 1275,
  'Chicago Blackhawks': 1389,
  'Colorado Avalanche': 1301,
  'Columbus Blue Jackets': 1430,
  'Dallas Stars': 1295,
  'Detroit Red Wings': 1511,
  'Edmonton Oilers': 1550,
  'Florida Panthers': 1605,
  'Los Angeles Kings': 1450,
  'Minnesota Wild': 1498,
  'Montreal Canadiens': 1392,
  'Nashville Predators': 1501,
  'New Jersey Devils': 1321,
  'New York Islanders': 1344,
  'New York Rangers': 1415,
  'Ottawa Senators': 1472,
  'Philadelphia Flyers': 1399,
  'Pittsburgh Penguins': 1441,
  'San Jose Sharks': 1311,
  'Seattle Kraken': 1483,
  'St. Louis Blues': 1352,
  'Tampa Bay Lightning': 1500,
  'Toronto Maple Leafs': 1329,
  'Utah Mammoth': 1280, // was Arizona Coyotes
  'Vancouver Canucks': 1402,
  'Vegas Golden Knights': 1593,
  'Washington Capitals': 1479,
  'Winnipeg Jets': 1552,
};

export default function CrunchPalacePage() {
  // Checkbox OFF = total, ON = per-game average
  const [mode, setMode] = useState<Mode>('total');

  // Today in local YMD (e.g., 20251006) so "Home Games Played" reflects season-to-date
  const todayYmd = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const dd = d.getDate();
    return y * 10000 + m * 100 + dd;
  }, []);

  // FULL TEAM NAME -> # of HOME games **played so far**
  // We count only from each team's own block to avoid double counting.
  const homeGamesPlayedByTeam = useMemo(() => {
    const map = new Map<string, number>();

    // Build a quick abbr -> full name map from arenaMap keys (fallback to simple mapping)
    const abbrToFull: Record<string, string> = {};
    for (const fullName of Object.keys(arenaMap)) {
      const abbr = (fullTeamToAbbr as Record<string, string>)[fullName];
      if (abbr) abbrToFull[abbr] = fullName;
    }
    // Ensure Utah alias works regardless of UTA/UTM and arena key variants
    if (!abbrToFull['UTA'] && arenaMap['Utah Hockey Club']) abbrToFull['UTA'] = 'Utah Hockey Club';
    if (!abbrToFull['UTM'] && arenaMap['Utah Mammoth']) abbrToFull['UTM'] = 'Utah Mammoth';

    for (const tb of leagueSchedule) {
      const fullName = abbrToFull[tb.team] ?? tb.team; // fallback to abbr if unknown
      const playedHome = tb.games.reduce((acc, g) => acc + (g.home && g.ymd <= todayYmd ? 1 : 0), 0);
      map.set(fullName, playedHome);
    }
    return map;
  }, [todayYmd]);

  // Build, enrich, and sort rankings based on mode
  const rows = useMemo(() => {
    const items = Object.entries(mockTeamHits).map(([teamFullName, hits]) => {
      const arena = arenaMap[teamFullName] ?? { city: 'Unknown City', venue: 'Unknown Arena' };
      const homeGamesPlayed = homeGamesPlayedByTeam.get(teamFullName) ?? 0;
      const perGame = homeGamesPlayed > 0 ? hits / homeGamesPlayed : 0;

      // Compute the team abbreviation (prefer full-name map, fall back to resolver)
      const teamAbbr =
        (fullTeamToAbbr as Record<string, string>)[teamFullName] ??
        resolveAbbr(teamFullName) ??
        '—';

      return { teamFullName, teamAbbr, arena, hits, homeGamesPlayed, perGame };
    });

    items.sort((a, b) => {
      const av = mode === 'total' ? a.hits : a.perGame;
      const bv = mode === 'total' ? b.hits : b.perGame;
      return bv - av;
    });

    return items;
  }, [homeGamesPlayedByTeam, mode]);

  const unitLabel = mode === 'total' ? 'Total Hits' : 'Hits / Home Game';

  // Inline styles to override any legacy CSS that hides the 2nd/last column on .data-table
  const forceShowSecondCol = { display: 'table-cell' as const };
  const forceShowLastCol = { display: 'table-cell' as const };

  // TODO: Future — make rows clickable to open a team trend view.

  return (
    <main className="max-w-4xl mx-auto py-10 px-4">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-2">
          <span role="img" aria-label="steak">🥩</span> Crunch Palace Rankings
        </h1>

        {/* Controls: checkbox toggle */}
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mode === 'perGame'}
              onChange={(e) => setMode(e.target.checked ? 'perGame' : 'total')}
            />
            <span>Average (per Home Game)</span>
          </label>
        </div>
      </div>

      <p className="mb-6 text-base md:text-lg text-[var(--muted)]">
        {mode === 'total'
          ? 'Total home hits by team (season-to-date; mock totals).'
          : 'Home hits per home game played (season-to-date; mock totals ÷ home games played).'}
      </p>

      <div className="overflow-x-auto rounded-2xl shadow ring-1 ring-[var(--border)]">
        {/* Unified data-table styling */}
        <table className="data-table table-fixed border-separate border-spacing-0">
          <thead>
            <tr>
              <th>#</th>
              <th style={forceShowSecondCol}>Team</th>
              <th>Arena</th>
              <th>{unitLabel}</th>
              <th className="text-xs" style={forceShowLastCol}>Home Games Played</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry, idx) => (
              <tr key={entry.teamFullName}>
                <td>{idx + 1}</td>
                <td style={forceShowSecondCol} className="font-mono font-semibold">
                  {entry.teamAbbr}
                </td>
                <td>
                  <span className="font-semibold">{entry.arena.venue}</span>
                </td>
                <td className="font-semibold">
                  {mode === 'total' ? entry.hits.toLocaleString() : entry.perGame.toFixed(2)}
                </td>
                <td style={forceShowLastCol}>{entry.homeGamesPlayed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-sm text-[var(--muted)]">
        * “Home Games Played” is computed from <code>nhlSchedule.json</code> up to today
        (local date). Replace mock totals with official NHL team hit stats when available.
      </p>
    </main>
  );
}
