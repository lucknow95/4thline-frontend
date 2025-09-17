// src/lib/optimizerAdapter.ts

/**
 * Adapter: convert player-centric schedules from your API
 * into team-centric TeamBlock[] for the optimizer.
 *
 * Example API (per player):
 * {
 *   id: 39056,
 *   name: "Wyatt Aamodt",
 *   team: "COL",
 *   schedule: [
 *     { date: "2025-10-07", home_team: "Los Angeles", away_team: "Colorado Avalanche" },
 *     ...
 *   ]
 * }
 *
 * Optimizer wants (per team):
 * { team: "COL", games: [{ ymd: 20251007, home: false, opp: "LAK" }, ...] }
 */

import type {
  PlayerWithSchedule,
  NameMaps,
  TeamBlock,
  TeamAbbr,
} from '@/types/hockey';

/** "YYYY-MM-DD" -> 20251007 (UTC safe). Throws if invalid. */
function toYmdNumber(dateStr: string): number {
  const parts = dateStr.trim().split('-').map(p => p.trim()) as [string, string, string];
  if (parts.length !== 3) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }

  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  if (
    Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d) ||
    m < 1 || m > 12 || d < 1 || d > 31
  ) {
    throw new Error(`Invalid date parts: ${dateStr}`);
  }

  return y * 10000 + m * 100 + d;
}




/** Light label normalization to improve matching against maps. */
function normalizeLabel(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .trim()
    .replace(/\s+/g, ' ')             // collapse whitespace
    .replace(/^St[.]?\s+Louis$/i, 'St. Louis') // common variant
    .replace(/^Montr(e|é)al$/i, 'Montréal');   // unify Montreal w/ accent
}

/**
 * Resolve a provider label (full team name or city/short label) to an abbr.
 * - Tries full names first, then city/short labels.
 * - Falls back to first word for things like "Colorado Avalanche" -> "Colorado".
 * - Returns null for ambiguous inputs (e.g., plain "New York").
 */
function resolveAbbrFromMaps(name: string, maps: NameMaps): TeamAbbr | null {
  const label = normalizeLabel(name);

  // Try exact full team name
  const full = maps.fullTeamToAbbr[label as keyof typeof maps.fullTeamToAbbr];
  if (full) return full;

  // Try exact city/short label
  const city = maps.cityToAbbr[label as keyof typeof maps.cityToAbbr];
  if (city) return city;

  // Avoid ambiguous bare "New York"
  if (/^New York$/i.test(label)) return null;

  // Fallback: first word as city hint (e.g., "Colorado Avalanche" -> "Colorado")
  const firstWord = label.split(' ')[0];
  const cityFromFirst = maps.cityToAbbr[firstWord as keyof typeof maps.cityToAbbr];
  if (cityFromFirst) return cityFromFirst;

  return null;
}

/**
 * Build per-team schedule blocks from many player objects.
 * - De-dupes games so the same team/date/opponent/homeAway isn't inserted twice.
 * - Records a game from both teams' perspectives (home & away).
 * - Skips any game where either side can't be resolved to a known abbreviation.
 */
export function buildTeamBlocksFromPlayerSchedules(
  players: PlayerWithSchedule[],
  maps: NameMaps
): TeamBlock[] {
  // teamAbbr -> Map<dedupeKey, { ymd, home, opp }>
  const perTeam = new Map<TeamAbbr, Map<string, { ymd: number; home: boolean; opp: TeamAbbr }>>();

  for (const p of players) {
    if (!Array.isArray(p.schedule)) continue;

    for (const g of p.schedule) {
      const ymd = toYmdNumber(g.date);

      // Resolve team abbreviations from provider labels
      const homeAbbr = resolveAbbrFromMaps(g.home_team, maps);
      const awayAbbr = resolveAbbrFromMaps(g.away_team, maps);
      if (!homeAbbr || !awayAbbr) {
        // Skip unresolvable pairs to avoid polluting data. Consider logging elsewhere.
        continue;
      }

      // Record from HOME team's perspective
      {
        const team = homeAbbr;
        const opp = awayAbbr;
        const home = true;
        const key = `${ymd}-H-${opp}`;

        if (!perTeam.has(team)) perTeam.set(team, new Map());
        const bucket = perTeam.get(team)!;
        if (!bucket.has(key)) bucket.set(key, { ymd, home, opp });
      }

      // Record from AWAY team's perspective
      {
        const team = awayAbbr;
        const opp = homeAbbr;
        const home = false;
        const key = `${ymd}-A-${opp}`;

        if (!perTeam.has(team)) perTeam.set(team, new Map());
        const bucket = perTeam.get(team)!;
        if (!bucket.has(key)) bucket.set(key, { ymd, home, opp });
      }
    }
  }

  // Emit TeamBlock[]
  const out: TeamBlock[] = [];
  for (const [team, gamesMap] of perTeam.entries()) {
    const games = Array.from(gamesMap.values()).sort((a, b) => a.ymd - b.ymd);
    out.push({ team, games });
  }

  // Stable sort by abbreviation for consistent output
  out.sort((a, b) => a.team.localeCompare(b.team));
  return out;
}

// Re-exports (optional) if you want convenient imports from this module.
export type { PlayerWithSchedule, NameMaps, TeamBlock } from '@/types/hockey';
