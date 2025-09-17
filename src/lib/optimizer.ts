// src/lib/optimizer.ts
// Pure logic for the "Next N Weeks Team Optimizer" – runs on server or client.

// -------------------- Types --------------------

export type DateRange = { startYmd: number; endYmd: number }; // inclusive YYYYMMDD

export type Filters = {
  includeHome: boolean;
  includeAway: boolean;
  offNightsOnly: boolean;
  daysOfWeek: number[]; // 0..6 (Sun=0). Empty => any day (when offNightsOnly=false)
  minGames: number;
};

// NEW team-centric block (matches optimizerAdapter output)
export type TeamBlock = {
  team: string; // abbreviation, e.g., "COL"
  games: Array<{
    ymd: number;     // 20251007
    home: boolean;   // true if this team is home
    opp: string;     // opponent abbr (not used in calc, but handy to keep)
  }>;
};

export type TeamWindowSummary = {
  team: string;                // 'ANA'
  gamesTotal: number;
  offNightGames: number;       // Mon/Wed/Fri/Sun
  heavyNightGames: number;     // Tue/Thu/Sat
  b2bCount: number;
  home: number;
  away: number;
  perWeek: number[];           // bins aligned to selected start (Mon–Sun)
};

// -------------------- Constants & basic helpers --------------------

// Off-nights: Sun(0), Mon(1), Wed(3), Fri(5)
// Heavy: Tue(2), Thu(4), Sat(6)
const OFF_NIGHT_SET = new Set([0, 1, 3, 5]);
const HEAVY_NIGHT_SET = new Set([2, 4, 6]);

/** Robust, TS-safe parser: returns NaN if isoDate isn't 'YYYY-MM-DD' */
export function ymdToNumber(isoDate: string): number {
  if (!isoDate || isoDate.length < 10) return Number.NaN;
  const y = parseInt(isoDate.slice(0, 4), 10);
  const m = parseInt(isoDate.slice(5, 7), 10);
  const d = parseInt(isoDate.slice(8, 10), 10);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return Number.NaN;
  return y * 10000 + m * 100 + d;
}

export function numberToUTCDate(ymd: number): Date {
  const y = Math.floor(ymd / 10000);
  const m = Math.floor((ymd % 10000) / 100);
  const d = ymd % 100;
  return new Date(Date.UTC(y, m - 1, d));
}
export function toYmdNumber(dt: Date): number {
  return dt.getUTCFullYear() * 10000 + (dt.getUTCMonth() + 1) * 100 + dt.getUTCDate();
}
export function addDaysYmd(ymd: number, days: number): number {
  const dt = numberToUTCDate(ymd);
  dt.setUTCDate(dt.getUTCDate() + days);
  return toYmdNumber(dt);
}
export function getUtcWeekday(ymd: number): number {
  return numberToUTCDate(ymd).getUTCDay(); // 0..6
}

export function isOffNightYmd(ymd: number): boolean {
  return OFF_NIGHT_SET.has(getUtcWeekday(ymd));
}
export function isHeavyNightYmd(ymd: number): boolean {
  return HEAVY_NIGHT_SET.has(getUtcWeekday(ymd));
}

// -------------------- Window helpers --------------------

export function getNextWeekMondayFromToday(today: Date): number {
  const base = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const wd = base.getUTCDay();
  const diff = ((8 - wd) % 7) || 7; // 1..7
  const next = new Date(base);
  next.setUTCDate(base.getUTCDate() + diff);
  return toYmdNumber(next);
}
export function nextMondayOnOrAfter(ymd: number): number {
  const wd = getUtcWeekday(ymd);
  const add = (8 - wd) % 7; // 0 if already Monday
  return addDaysYmd(ymd, add);
}

export function clampToSeasonWindow(
  desiredStartYmd: number,
  weeks: number,
  seasonStartYmd: number,
  seasonEndYmd: number
): DateRange {
  let start = nextMondayOnOrAfter(desiredStartYmd);
  if (start < seasonStartYmd) start = nextMondayOnOrAfter(seasonStartYmd);
  if (start > seasonEndYmd) start = seasonEndYmd;
  const intendedEnd = addDaysYmd(start, weeks * 7 - 1);
  const end = intendedEnd > seasonEndYmd ? seasonEndYmd : intendedEnd;
  return { startYmd: start, endYmd: end };
}

export function clampCustomRangeToSeason(
  rawStartYmd: number,
  rawEndYmd: number,
  seasonStartYmd: number,
  seasonEndYmd: number
): DateRange {
  let start = Math.max(rawStartYmd, seasonStartYmd);
  let end = Math.min(rawEndYmd, seasonEndYmd);
  if (end < start) end = start;
  return { startYmd: start, endYmd: end };
}

function buildWeekBins(range: DateRange): { starts: number[]; ends: number[] } {
  const starts: number[] = [];
  const ends: number[] = [];
  let cur = range.startYmd;
  while (cur <= range.endYmd) {
    const end = Math.min(addDaysYmd(cur, 6), range.endYmd);
    starts.push(cur);
    ends.push(end);
    cur = addDaysYmd(end, 1);
  }
  return { starts, ends };
}

// -------------------- League context (for future extensions) --------------------
// (kept for potential future “league volume” features)
/** Create a date -> total league games map within the window. */
function leagueGamesByDate(schedule: TeamBlock[], range: DateRange): Map<number, number> {
  const map = new Map<number, number>();
  for (const block of schedule) {
    for (const g of block.games) {
      if (g.ymd < range.startYmd || g.ymd > range.endYmd) continue;
      map.set(g.ymd, (map.get(g.ymd) ?? 0) + 1);
    }
  }
  return map;
}

// B2B counter that is safe under noUncheckedIndexedAccess
function countB2BFromDates(sortedUniqueYmds: number[]): number {
  let cnt = 0;
  for (let i = 0; i < sortedUniqueYmds.length - 1; i++) {
    const a = sortedUniqueYmds[i];
    const b = sortedUniqueYmds[i + 1];
    if (a !== undefined && b !== undefined && b === addDaysYmd(a, 1)) cnt++;
  }
  return cnt;
}

// -------------------- Core computation --------------------

/**
 * Compute summaries from real games (no placeholders).
 * NOTE: Heavy nights are weekday-based (Tue/Thu/Sat), not league-volume-based.
 */
export function summarizeAll(
  teams: TeamBlock[],
  range: DateRange,
  filters: Filters,
  // kept for backwards compatibility; ignored now that heavy nights are weekday-based
  _heavyNightThreshold = 6
): TeamWindowSummary[] {
  // Kept available for future features; not used for the weekday-based heavy/off counts
  const _leagueByDate = leagueGamesByDate(teams, range);

  const wantDayFilter = Array.isArray(filters.daysOfWeek) && filters.daysOfWeek.length > 0;
  const rows: TeamWindowSummary[] = [];

  for (const tb of teams) {
    // filter & collect this team's games in the window
    const gamesInWindow = tb.games.filter((g) => {
      if (g.ymd < range.startYmd || g.ymd > range.endYmd) return false;
      if (g.home && !filters.includeHome) return false;
      if (!g.home && !filters.includeAway) return false;
      if (filters.offNightsOnly && !isOffNightYmd(g.ymd)) return false;
      if (wantDayFilter && !filters.daysOfWeek.includes(getUtcWeekday(g.ymd))) return false;
      return true;
    });

    const gamesTotal = gamesInWindow.length;
    if (gamesTotal < filters.minGames) continue;

    // Off vs Heavy strictly by weekday sets
    let offNightGames = 0;
    let heavyNightGames = 0;
    let home = 0;

    for (const g of gamesInWindow) {
      const wd = getUtcWeekday(g.ymd);
      if (OFF_NIGHT_SET.has(wd)) offNightGames++;
      else if (HEAVY_NIGHT_SET.has(wd)) heavyNightGames++;
      // (All days are covered by these two sets.)
      if (g.home) home++;
    }

    const away = gamesTotal - home;

    // B2B: consecutive calendar days for this team
    const uniqueDates = Array.from(new Set(gamesInWindow.map((g) => g.ymd))).sort((a, b) => a - b);
    const b2bCount = countB2BFromDates(uniqueDates);

    // Per-week bins aligned to the selected window start (Mon–Sun)
    const { starts, ends } = buildWeekBins(range);
    const perWeek = starts.map((binStart, idx) => {
      const binEnd = ends[idx]!;
      let c = 0;
      for (const g of gamesInWindow) {
        if (g.ymd >= binStart && g.ymd <= binEnd) c++;
      }
      return c;
    });

    rows.push({
      team: tb.team,
      gamesTotal,
      offNightGames,
      heavyNightGames,
      b2bCount,
      home,
      away,
      perWeek,
    });
  }

  // Sort with useful ties: total desc, off-night desc, b2b asc, team asc
  rows.sort((a, b) => {
    if (b.gamesTotal !== a.gamesTotal) return b.gamesTotal - a.gamesTotal;
    if (b.offNightGames !== a.offNightGames) return b.offNightGames - a.offNightGames;
    if (a.b2bCount !== b.b2bCount) return a.b2bCount - b.b2bCount;
    return a.team.localeCompare(b.team);
  });

  return rows;
}
