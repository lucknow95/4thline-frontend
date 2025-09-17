// src/app/rankings/RankingsClient.tsx 
"use client";

import { useMemo, useState } from "react";

// UI
import WeeklyRosterFilter from "@/components/WeeklyRosterFilter";
import StatMinFilters from "@/components/rankings/StatMinFilters";
import TeamMultiSelect from "@/components/rankings/TeamMultiSelect";
// PerGameToggle removed (now inside StatMinFilters)
import Pagination from "@/components/rankings/Pagination";
import PlayerTable from "@/components/rankings/PlayerTable";

// Compute
import { applyAllFiltersAndSort } from "@/lib/rankings/compute";

// Types
import type {
  DayAbbr,
  Player,
  Position,
  RankingsFilters,
  SkaterStatKeys,
  SortKey,
  TeamAbbr,
} from "@/types/hockey";

/* ---------------------- Raw types (minimal) ------------------------------- */
type RawScheduleItem = { date: string; home_team?: string; away_team?: string };
type RawSeasonStats = Partial<Record<SkaterStatKeys, number>> & {
  gamesPlayed?: number;
  GP?: number;
};
type RawPlayer = {
  id: number | string;
  name: string;
  team: string;
  positions?: string[];
  stats?: { Season?: RawSeasonStats };
  schedule?: RawScheduleItem[] | string[];
  totals?: Record<SkaterStatKeys, number>;
  perGame?: Record<SkaterStatKeys, number>;
};

/* ---------------------- Helpers: mins & defaults -------------------------- */
const ZERO_MIN_DEFAULTS: Record<SkaterStatKeys, number> = {
  G: 0, A: 0, PIM: 0, PPP: 0, SHP: 0, SOG: 0, FW: 0, HIT: 0, BLK: 0,
};

function normalizeMinStats(
  minStats: Partial<Record<SkaterStatKeys, number>> | undefined
): Record<SkaterStatKeys, number> {
  const out: Record<SkaterStatKeys, number> = { ...ZERO_MIN_DEFAULTS };
  if (minStats) {
    (Object.keys(ZERO_MIN_DEFAULTS) as SkaterStatKeys[]).forEach((k) => {
      const v = minStats[k];
      out[k] = typeof v === "number" && Number.isFinite(v) ? v : 0;
    });
  }
  return out;
}

/* ---------------------- Week + date utils --------------------------------- */
// Week 1 Monday (UTC). Month is 0-based (9 = October).
const WEEK1_MON_UTC = Date.UTC(2025, 9, 6); // 2025-10-06
const MS_DAY = 24 * 60 * 60 * 1000;

const MON_TO_SUN: DayAbbr[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isDayAbbrString(s: string): s is DayAbbr {
  return (MON_TO_SUN as readonly string[]).includes(s);
}

function clampWeek(w: any): number {
  const n = Number(w);
  if (!Number.isFinite(n)) return 1;
  if (n < 1) return 1;
  if (n > 27) return 27;
  return Math.floor(n);
}

function weekMonToSunUTC(week: number) {
  const w = clampWeek(week);
  const start = WEEK1_MON_UTC + (w - 1) * 7 * MS_DAY;
  const endExclusive = start + 7 * MS_DAY;
  return { start, endExclusive };
}

// Accept "YYYY-MM-DD", or ISO with time and optional TZ
function parseFlexibleDateToUTC(isoish: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoish);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d)) {
      return Date.UTC(y, mo - 1, d);
    }
    return null;
  }
  const m2 = /^(\d{4})-(\d{2})-(\d{2})[T\s]\d{2}:\d{2}(?::\d{2})?(?:[Zz]|[+\-]\d{2}:?\d{2})?/.exec(isoish);
  if (m2) {
    const y = Number(m2[1]), mo = Number(m2[2]), d = Number(m2[3]);
    if (Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d)) {
      return Date.UTC(y, mo - 1, d);
    }
    return null;
  }
  const t = Date.parse(isoish);
  if (Number.isFinite(t)) {
    const d = new Date(t);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  return null;
}

/** Count games within a week (Mon→Sun, with Sun→Sat fallback). */
function daysAndCountForWeek(dates: string[], week: number): { days: DayAbbr[]; gtw: number } {
  const w = clampWeek(week);

  const primary = weekMonToSunUTC(w);
  const fallback = { start: WEEK1_MON_UTC - MS_DAY + (w - 1) * 7 * MS_DAY, endExclusive: 0 as number };
  fallback.endExclusive = fallback.start + 7 * MS_DAY;

  const compute = ({ start, endExclusive }: { start: number; endExclusive: number }) => {
    const hitDays = new Set<DayAbbr>();
    let count = 0;
    for (const raw of dates) {
      const t = parseFlexibleDateToUTC(raw);
      if (t == null) continue;
      if (t >= start && t < endExclusive) {
        count++;
        const idx = new Date(t).getUTCDay(); // 0..6
        const map: DayAbbr[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        hitDays.add(map[idx] as DayAbbr);
      }
    }
    return { days: MON_TO_SUN.filter((d) => hitDays.has(d)), gtw: count };
  };

  const monSun = compute(primary);
  if (monSun.gtw > 0) return monSun;
  return compute(fallback);
}

/* ---------------------- schedule auto-discovery --------------------------- */
function findScheduleOnRaw(raw: any): RawPlayer["schedule"] | undefined {
  if (Array.isArray(raw?.schedule)) return raw.schedule as any[];
  for (const [, val] of Object.entries(raw ?? {})) {
    if (!Array.isArray(val) || val.length === 0) continue;
    const first = val[0] as any;
    if (typeof first === "string") {
      const s = String(first);
      if (/^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{4}-\d{2}-\d{2}T/.test(s)) return val as string[];
    }
    if (first && typeof first === "object" && typeof first.date === "string") {
      return val as RawScheduleItem[];
    }
  }
  return undefined;
}

/** Coerce schedule → unique DayAbbr[] for this week + numeric GTW. */
function coerceScheduleToWeek(
  raw: RawPlayer,
  week: number
): { days: DayAbbr[]; gtw: number; _rawPick?: string } {
  const picked = findScheduleOnRaw(raw);
  if (!Array.isArray(picked) || picked.length === 0) return { days: [], gtw: 0 };

  const first: any = picked[0];
  if (typeof first === "string") {
    const arr = picked as string[];
    const looksLikeAllDayAbbr = arr.every(isDayAbbrString);
    if (looksLikeAllDayAbbr) {
      const uniq = new Set<DayAbbr>(arr as DayAbbr[]);
      const days = MON_TO_SUN.filter((d) => uniq.has(d));
      return { days, gtw: arr.length };
    }
    return daysAndCountForWeek(arr, week);
  }

  if (first && typeof first === "object" && typeof first.date === "string") {
    const dates = (picked as RawScheduleItem[]).map((g) => g.date);
    return daysAndCountForWeek(dates, week);
  }

  return { days: [], gtw: 0 };
}

/* ---------------------- Raw → Canonical (minimal) ------------------------- */
function firstSkaterPosition(raw: RawPlayer): Position {
  const p = (raw.positions?.[0] ?? "").toUpperCase();
  if (p === "C" || p === "LW" || p === "RW" || p === "D" || p === "G") return p as Position;
  return "C";
}
function coerceTeamAbbr(s: string): TeamAbbr {
  return s as TeamAbbr;
}

function adaptToCanonical(raw: RawPlayer, week: number): Player {
  const out: any = {
    id: raw.id,
    name: raw.name,
    team: coerceTeamAbbr(raw.team),
    position: firstSkaterPosition(raw),
  };

  // Stats
  if (raw.totals && raw.perGame) {
    out.totals = raw.totals;
    out.perGame = raw.perGame;
  } else {
    const s = raw.stats?.Season;
    const gp =
      typeof s?.gamesPlayed === "number"
        ? s!.gamesPlayed!
        : typeof s?.GP === "number"
          ? s!.GP!
          : 0;

    const totals: Record<SkaterStatKeys, number> = {
      G: s?.G ?? 0, A: s?.A ?? 0, PIM: s?.PIM ?? 0, PPP: s?.PPP ?? 0, SHP: s?.SHP ?? 0,
      SOG: s?.SOG ?? 0, FW: s?.FW ?? 0, HIT: s?.HIT ?? 0, BLK: s?.BLK ?? 0,
    };
    const perGame =
      gp > 0
        ? {
          G: totals.G / gp, A: totals.A / gp, PIM: totals.PIM / gp, PPP: totals.PPP / gp,
          SHP: totals.SHP / gp, SOG: totals.SOG / gp, FW: totals.FW / gp,
          HIT: totals.HIT / gp, BLK: totals.BLK / gp,
        }
        : { ...ZERO_MIN_DEFAULTS };

    out.totals = totals;
    out.perGame = perGame;
  }

  // Schedule
  const { days, gtw } = coerceScheduleToWeek(raw, week);
  out.schedule = days;
  out.gamesThisWeek = gtw;

  return out as Player;
}

/** Dedupe adapted players by id+team+position, merging weekly schedule days. */
function dedupePlayers(list: Player[]): Player[] {
  const keyOf = (p: Player) =>
    `${p.id != null ? String(p.id) : p.name}|${p.team}|${p.position}`;

  const map = new Map<string, Player>();
  for (const p of list) {
    const k = keyOf(p);
    const existing = map.get(k);
    if (!existing) {
      map.set(k, p);
      continue;
    }
    const days1 = Array.isArray((existing as any).schedule)
      ? ((existing as any).schedule as DayAbbr[])
      : [];
    const days2 = Array.isArray((p as any).schedule)
      ? ((p as any).schedule as DayAbbr[])
      : [];
    const uniq = new Set<DayAbbr>([...days1, ...days2]);
    const mergedDays = MON_TO_SUN.filter((d) => uniq.has(d));
    (existing as any).schedule = mergedDays;
    (existing as any).gamesThisWeek = mergedDays.length;
  }
  return Array.from(map.values());
}

/* --------------------------- Component ------------------------------------ */
type RankingsClientProps = { initialPlayers: RawPlayer[] };

export default function RankingsClient({ initialPlayers }: RankingsClientProps) {
  // Week selector
  const [week, setWeek] = useState<number>(1);
  const weekClamped = clampWeek(week);

  const weekOptions = useMemo(
    () => Array.from({ length: 27 }, (_, i) => ({ value: i + 1, label: `Week ${i + 1}` })),
    []
  );

  // Applied filters
  const [filters, setFilters] = useState<RankingsFilters>({
    selectedDays: [],
    teams: [],
    search: "",
    minStats: { ...ZERO_MIN_DEFAULTS },
    perGameMode: false,
    page: 1,
    pageSize: 50,
    sortKey: "SOG" as SortKey,
    sortDir: "desc",
  });

  // Pending filters
  const [pendingFilters, setPendingFilters] = useState<RankingsFilters>(filters);

  const onApply = () =>
    setFilters({
      ...pendingFilters,
      minStats: normalizeMinStats(pendingFilters.minStats),
      page: 1,
    });

  // 🔄 Clear Filters: reset most filters but keep week/perGame/sort/pageSize
  const onClear = () => {
    const kept = {
      perGameMode: filters.perGameMode,
      sortKey: filters.sortKey,
      sortDir: filters.sortDir,
      pageSize: filters.pageSize,
    };
    const cleared: RankingsFilters = {
      selectedDays: [],
      teams: [],
      search: "",
      minStats: { ...ZERO_MIN_DEFAULTS },
      page: 1,
      ...kept,
    };
    setPendingFilters(cleared);
    setFilters(cleared);
  };

  // Exclude goalies, adapt, and dedupe
  const adaptedSkaters: Player[] = useMemo(() => {
    const nonGoalies = initialPlayers.filter(
      (rp) => (rp.positions?.[0] ?? "").toUpperCase() !== "G"
    );
    const adapted = nonGoalies.map((rp) => adaptToCanonical(rp, weekClamped));
    return dedupePlayers(adapted);
  }, [initialPlayers, weekClamped]);

  // Compute
  const { pageItems, totalCount } = useMemo(() => {
    return applyAllFiltersAndSort(adaptedSkaters, filters);
  }, [adaptedSkaters, filters]);

  // Setters for pending
  const setSelectedDays = (v: DayAbbr[]) =>
    setPendingFilters((f) => ({ ...f, selectedDays: v }));
  const setTeams = (v: TeamAbbr[]) =>
    setPendingFilters((f) => ({ ...f, teams: v }));
  const setSearch = (v: string) =>
    setPendingFilters((f) => ({ ...f, search: v }));
  const setMinStats = (v: Partial<Record<SkaterStatKeys, number>>) =>
    setPendingFilters((f) => ({ ...f, minStats: v }));

  // Per-game toggle is immediate
  const setPerGameMode = (v: boolean) => {
    setPendingFilters((f) => ({ ...f, perGameMode: v }));
    setFilters((f) => ({ ...f, perGameMode: v }));
  };

  // Sort & pagination
  const onSort = (key: SortKey, dir: "asc" | "desc") =>
    setFilters((f) => ({ ...f, sortKey: key, sortDir: dir, page: 1 }));
  const onPageChange = (p: number) =>
    setFilters((f) => ({ ...f, page: p }));

  return (
    <div className="space-y-4">
      {/* Filters row + desktop Apply/Clear container */}
      <div className="relative">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <WeeklyRosterFilter
            value={{ selectedDays: pendingFilters.selectedDays as DayAbbr[], week: weekClamped }}
            onChange={(next) => {
              const nextWeek = clampWeek((next as any)?.week);
              setPendingFilters((f) => ({
                ...f,
                selectedDays: (next as any).selectedDays as DayAbbr[],
              }));
              setWeek(nextWeek);
            }}
            weekOptions={weekOptions}
          />

          <TeamMultiSelect value={pendingFilters.teams} onChange={setTeams} />

          <StatMinFilters
            value={pendingFilters.minStats}
            perGameMode={pendingFilters.perGameMode}
            onChange={setMinStats}
            onTogglePerGame={setPerGameMode}  // <-- Per Game lives here now
          />

          {/* PerGameToggle removed */}
        </div>

        {/* Desktop: stacked Apply + Clear in the empty top-right */}
        <div
          className="
            hidden lg:flex absolute top-0 right-0 z-10 shrink-0
            flex-col space-y-2 items-end
          "
        >
          <button
            type="button"
            onClick={onApply}
            aria-label="Apply Filters"
            className="
              w-48 h-12 rounded-lg px-6 inline-flex justify-center items-center
              bg-blue-600 text-white font-semibold shadow-md
              hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-amber-400
              transition-colors
            "
          >
            Apply Filters
          </button>

          <button
            type="button"
            onClick={onClear}
            aria-label="Clear Filters"
            className="
              w-48 h-12 rounded-lg px-6 inline-flex justify-center items-center
              bg-transparent border-2 border-blue-600 text-blue-600 font-semibold shadow-md
              hover:text-amber-400 hover:border-amber-400
              focus:outline-none focus:ring-2 focus:ring-amber-400
              transition-colors
            "
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Search + mobile Apply/Clear */}
      <div className="flex items-center gap-3">
        <input
          className="w-full rounded px-3 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--surface-contrast)]"
          placeholder="Search player name"
          value={pendingFilters.search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Mobile/tablet: Apply */}
        <button
          className="lg:hidden px-4 py-2 rounded bg-blue-600 text-white font-semibold shadow-md hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-amber-400"
          onClick={onApply}
          type="button"
          aria-label="Apply Filters (mobile)"
        >
          Apply
        </button>

        {/* Mobile/tablet: Clear */}
        <button
          className="lg:hidden px-4 py-2 rounded border-2 border-blue-600 text-blue-600 font-semibold shadow-md hover:text-amber-400 hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          onClick={onClear}
          type="button"
          aria-label="Clear Filters (mobile)"
        >
          Clear
        </button>
      </div>

      {/* Table */}
      <PlayerTable
        players={pageItems ?? []}
        perGameMode={filters.perGameMode}
        sortKey={filters.sortKey}
        sortDir={filters.sortDir}
        onSort={onSort}
        currentWeek={weekClamped}
      />

      {/* Empty state */}
      {totalCount === 0 && (
        <div className="text-sm text-[var(--muted)]">No players match your filters.</div>
      )}

      {/* Pagination */}
      {totalCount > 0 && (
        <Pagination
          page={filters.page}
          pageSize={filters.pageSize}
          total={totalCount}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
