// src/lib/msf.ts

// If these paths are different in your project, adjust them here:
import basePlayersRaw from "@/data/realPlayers.json";
import withScheduleRaw from "@/data/realPlayersWithSchedule.json";

export type LocalScheduleItem = { date: string; home_team?: string; away_team?: string };
export type LocalPlayer = {
  id: number | string;
  name: string;
  team: string;                // often an abbreviation in your dataset
  positions?: string[];
  // stats are optional; we pass them through as-is
  stats?: {
    Season?: {
      G?: number; A?: number; PIM?: number; PPP?: number; SHP?: number;
      SOG?: number; FW?: number; HIT?: number; BLK?: number;
      gamesPlayed?: number; GP?: number;
    };
  };
  // schedule may be string[] of dates or object[] with {date}
  schedule?: LocalScheduleItem[] | string[];
  // pass-through canonical shapes if present
  totals?: Record<string, number>;
  perGame?: Record<string, number>;
  // Some sources may include this; if present we'll normalize it too.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - keep flexible: not all players will have this
  teamAbbr?: string;
};

function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/** One-off team abbreviation fixups */
const TEAM_ABBR_FIXUPS: Record<string, string> = {
  UTM: "UTA", // Normalize Utah abbreviation
};

/** Return normalized team abbreviation (or original if no fixup) */
function normalizeAbbr(abbr?: string): string | undefined {
  if (!abbr) return abbr;
  return TEAM_ABBR_FIXUPS[abbr] ?? abbr;
}

/** Normalize team-related fields on a player (team and optional teamAbbr) */
function normalizePlayerTeam<T extends LocalPlayer>(p: T): T {
  const fixedTeam = normalizeAbbr(p.team) ?? p.team;
  // Support optional teamAbbr if your data includes it
  const maybeAbbr = (p as unknown as { teamAbbr?: string }).teamAbbr;
  const fixedAbbr = normalizeAbbr(maybeAbbr);

  return {
    ...p,
    team: fixedTeam,
    ...(fixedAbbr ? { teamAbbr: fixedAbbr } : {}),
  };
}

/**
 * Returns the best available dataset:
 * 1) If realPlayersWithSchedule.json has players, return it directly (normalized).
 * 2) Else, return realPlayers.json but merge any schedules found in withSchedule file (normalized).
 * 3) Else, return an empty array.
 */
export async function fetchRankingsData(): Promise<LocalPlayer[]> {
  try {
    const basePlayers = asArray<LocalPlayer>(basePlayersRaw);
    const withSchedule = asArray<LocalPlayer>(withScheduleRaw);

    // Case 1: withSchedule is complete → just use it (normalized)
    if (withSchedule.length > 0) {
      return withSchedule.map(normalizePlayerTeam);
    }

    // Case 2: merge schedules from withSchedule onto base (if withSchedule exists but empty,
    // this will just return basePlayers untouched) — normalize either way.
    if (basePlayers.length > 0) {
      const schedById = new Map<string, LocalPlayer["schedule"]>();
      for (const p of withSchedule) {
        if (p && p.id != null && Array.isArray(p.schedule)) {
          schedById.set(String(p.id), p.schedule);
        }
      }
      return basePlayers.map((p) => {
        const mergedSchedule = schedById.get(String(p.id));
        const merged = mergedSchedule ? { ...p, schedule: mergedSchedule } : p;
        return normalizePlayerTeam(merged);
      });
    }

    return [];
  } catch (err) {
    console.error("[msf] fetchRankingsData failed:", err);
    return [];
  }
}
