// src/lib/rankings/compute.ts
import type { Player, RankingsFilters, SkaterStatKeys, DayAbbr } from "@/types/hockey";

/* ----------------------------- helpers ----------------------------------- */

function getStat(p: Player, key: SkaterStatKeys, perGame: boolean): number {
  const bucket = perGame ? (p as any).perGame : (p as any).totals;
  const v = bucket?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function getGamesThisWeek(p: Player): number {
  const numeric = (p as any)?.gamesThisWeek;
  if (typeof numeric === "number" && Number.isFinite(numeric)) return numeric;
  if (Array.isArray(p.schedule)) return p.schedule.length;
  return 0;
}

/** Player has games on *all* selected days. No days selected → passes. */
function playsOnAllSelectedDays(p: Player, days: DayAbbr[]): boolean {
  if (!days || days.length === 0) return true;
  const sched = Array.isArray(p.schedule) ? p.schedule : [];
  if (sched.length === 0) return false;
  return days.every((d) => sched.includes(d));
}

/** Compare one stat to a minimum value (per-game or totals). */
function statPasses(p: Player, key: SkaterStatKeys, min: number, perGame: boolean): boolean {
  return getStat(p, key, perGame) >= (typeof min === "number" ? min : 0);
}

/** Check all minimum stat filters. */
function passesAllMinStats(
  p: Player,
  minStats: Partial<Record<SkaterStatKeys, number>>,
  perGame: boolean
): boolean {
  for (const [k, v] of Object.entries(minStats)) {
    if (v == null) continue; // skip undefined/null entries
    if (!statPasses(p, k as SkaterStatKeys, v, perGame)) return false;
  }
  return true;
}

/** Case-insensitive sort helpers with stable tie-break. */
function cmpName(a: Player, b: Player): number {
  const aa = a.name.toLowerCase();
  const bb = b.name.toLowerCase();
  if (aa < bb) return -1;
  if (aa > bb) return 1;
  return 0;
}
function cmpTeam(a: Player, b: Player): number {
  const aa = (a.team || "").toLowerCase();
  const bb = (b.team || "").toLowerCase();
  if (aa < bb) return -1;
  if (aa > bb) return 1;
  return cmpName(a, b);
}

/* ---------------------- combo sort support -------------------------------- */

type ComboKey = "HB" | "HSOG" | "SOGBLK" | "HSOGBLK";

/** Normalize incoming sort key strings like "H+SOG" → "HSOG". */
function normalizeComboKey(key: unknown): ComboKey | null {
  if (typeof key !== "string") return null;
  const k = key.toUpperCase().replace(/\s+/g, "").replace(/\+/g, "");
  if (k === "HB") return "HB";
  if (k === "HSOG") return "HSOG";
  if (k === "SOGBLK") return "SOGBLK";
  if (k === "HSOGBLK") return "HSOGBLK";
  return null;
}

/** Compute the combo value for a player in totals or per-game mode. */
function getComboValue(p: Player, combo: ComboKey, perGame: boolean): number {
  const HIT = getStat(p, "HIT", perGame);
  const BLK = getStat(p, "BLK", perGame);
  const SOG = getStat(p, "SOG", perGame);
  switch (combo) {
    case "HB":
      return HIT + BLK;
    case "HSOG":
      return HIT + SOG;
    case "SOGBLK":
      return SOG + BLK;
    case "HSOGBLK":
      return HIT + SOG + BLK;
  }
}

/* ----------------------------- sorting ----------------------------------- */

function sortPlayers(
  list: Player[],
  key: RankingsFilters["sortKey"],
  dir: "asc" | "desc",
  perGame: boolean
): Player[] {
  const mul = dir === "asc" ? 1 : -1;

  return [...list].sort((a, b) => {
    // Name / Team
    if (key === "name") {
      return mul * cmpName(a, b);
    }
    if (key === "team") {
      return mul * cmpTeam(a, b);
    }

    // GTW
    if (key === "gamesThisWeek") {
      const ag = getGamesThisWeek(a);
      const bg = getGamesThisWeek(b);
      const cmp = ag - bg;
      return mul * (cmp !== 0 ? cmp : cmpName(a, b));
    }

    // Combo columns (e.g., "H+SOG", "SOG+BLK", etc.)
    const combo = normalizeComboKey(key as unknown as string);
    if (combo) {
      const av = getComboValue(a, combo, perGame);
      const bv = getComboValue(b, combo, perGame);
      const cmp = av - bv;
      return mul * (cmp !== 0 ? cmp : cmpName(a, b));
    }

    // Plain stat columns
    const av = getStat(a, key as SkaterStatKeys, perGame);
    const bv = getStat(b, key as SkaterStatKeys, perGame);
    const cmp = av - bv;
    return mul * (cmp !== 0 ? cmp : cmpName(a, b));
  });
}

/* ------------------------- main pipeline --------------------------------- */

export function applyAllFiltersAndSort(
  players: Player[],
  f: RankingsFilters
): { pageItems: Player[]; totalCount: number } {
  const {
    selectedDays = [],
    teams = [],
    search = "",
    minStats = {},
    perGameMode = false,
    sortKey,
    sortDir,
    page = 1,
    pageSize = 50,
  } = f;

  const q = search.trim().toLowerCase();

  // Filters
  let list = players.filter((p) => {
    if (teams.length && !teams.includes(p.team)) return false;
    if (q && !p.name.toLowerCase().includes(q)) return false;
    if (!passesAllMinStats(p, minStats, perGameMode)) return false;
    if (!playsOnAllSelectedDays(p, selectedDays)) return false;
    return true;
  });

  // Sort
  list = sortPlayers(list, sortKey, sortDir, perGameMode);

  // Pagination
  const totalCount = list.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = list.slice(start, end);

  return { pageItems, totalCount };
}
