// src/utils/fantasyWeeks.ts
import type { Player, ScheduleGame } from "@/types";
import { isISODate } from "@/types/guards";
import type { DayAbbr } from "@/types/hockey";

// ---- Constants & UTC helpers ----
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Build a Date at UTC midnight for the given Y-M-D */
function utcDateFromYMD(yyyy: number, mm01: number, dd: number): Date {
  // Note: month is 0-based in Date.UTC
  return new Date(Date.UTC(yyyy, mm01 - 1, dd, 0, 0, 0, 0));
}

/** Parse an ISO-like 'YYYY-MM-DD' as a UTC midnight Date (never local) */
function parseISODateOnlyToUTC(dateStr: string): Date | null {
  if (!isISODate(dateStr)) return null;
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Add whole days in UTC by milliseconds (DST-proof) */
function addUtcDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * ONE_DAY_MS);
}

/** Format a Date as local string but computed from UTC date */
function formatLocalFromUTC(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Convert UTC Date to UTC ISO string with the provided time */
function toUtcIso(d: Date, h = 0, m = 0, s = 0, ms = 0): string {
  const x = new Date(d.getTime());
  x.setUTCHours(h, m, s, ms);
  return x.toISOString();
}

// --- 1. Week 1 starts Monday, Oct 6, 2025 at UTC midnight
export const FIRST_WEEK_START = utcDateFromYMD(2025, 10, 6);

/** Week option (now includes start/end for code that needs exact bounds) */
export interface WeekOption {
  value: number; // 1-based
  label: string; // "Week N (Oct 6 – Oct 12)"
  start: string; // UTC ISO for Monday 00:00:00.000
  end: string;   // UTC ISO for Sunday 23:59:59.999
}

// --- 2. Week number for a 'YYYY-MM-DD' date (Week 1 = Oct 6–12, 2025)
export function getFantasyWeek(dateStr: string): number {
  const gameDateUTC = parseISODateOnlyToUTC(dateStr);
  if (!gameDateUTC) return 0; // invalid input -> treat as before week 1
  const diffMs = gameDateUTC.getTime() - FIRST_WEEK_START.getTime();
  if (diffMs < 0) return 0; // before week 1
  const diffDays = Math.floor(diffMs / ONE_DAY_MS);
  return Math.floor(diffDays / 7) + 1; // 1-based
}

// --- 3. Start/end UTC Date objects for a given week number
export function getWeekDateRange(weekNumber: number): { start: Date; end: Date } {
  const wk = Math.max(1, Math.floor(weekNumber));
  const start = addUtcDays(FIRST_WEEK_START, (wk - 1) * 7);
  const end = addUtcDays(start, 6);
  return { start, end };
}

// --- 4. Label like "Week 1 (Oct 6 – Oct 12)"
export function getWeekLabel(weekNumber: number): string {
  const { start, end } = getWeekDateRange(weekNumber);
  return `Week ${Math.max(1, Math.floor(weekNumber))} (${formatLocalFromUTC(start)} – ${formatLocalFromUTC(end)})`;
}

// --- 5. Week options for dropdown (WITH start/end)
export function generateWeekOptions(numWeeks: number): WeekOption[] {
  const n = Math.max(1, Math.floor(numWeeks));
  const out: WeekOption[] = [];
  for (let i = 0; i < n; i++) {
    const wk = i + 1;
    const { start, end } = getWeekDateRange(wk);
    out.push({
      value: wk,
      label: getWeekLabel(wk),
      start: toUtcIso(start, 0, 0, 0, 0),
      end: toUtcIso(end, 23, 59, 59, 999),
    });
  }
  return out;
}

// Types for safety
export type Game = Pick<ScheduleGame, "date" | "home_team" | "away_team">;
export type PlayerLike = Pick<Player, "schedule"> | null | undefined;

// --- 6. Games for a player in a given week (UTC-safe)
export function getGamesThisWeek(player: PlayerLike, selectedWeek: number): Game[] {
  const sched = player?.schedule ?? [];
  if (!Array.isArray(sched) || sched.length === 0) return [];
  return sched.filter(
    (game) => isISODate(game.date) && getFantasyWeek(game.date) === selectedWeek
  );
}

// --- 7. Day name → JS getDay() number mapping (UTC variant below)
export const dayShortNameToNumber: Record<DayAbbr, number> & { Sun: number } = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
} as const;

// --- 8. Exact calendar dates for selected week/days (returns YYYY-MM-DD, UTC)
export function getSelectedDatesForWeek(weekNumber: number, selectedDays: DayAbbr[]): string[] {
  const { start } = getWeekDateRange(weekNumber); // Monday UTC
  return selectedDays.map((dayShort) => {
    const dayIdx = dayShortNameToNumber[dayShort]; // 0..6 for Sun..Sat
    let offset = dayIdx - 1; // Monday = 1
    if (offset < 0) offset = 6; // Sunday wraps to end of week
    const d = addUtcDays(start, offset);
    // Build YYYY-MM-DD from UTC parts (no TZ drift)
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
}

// --- 9. Games for a player on exact selected dates in a given week (UTC-safe)
export function getGamesThisWeekOnDates(
  player: PlayerLike,
  weekNumber: number,
  selectedDays: DayAbbr[]
): Game[] {
  if (!selectedDays || selectedDays.length === 0) return [];
  const dates = new Set(getSelectedDatesForWeek(weekNumber, selectedDays));
  const sched = player?.schedule ?? [];
  if (!Array.isArray(sched) || sched.length === 0) return [];
  return sched.filter((game) => isISODate(game.date) && dates.has(game.date));
}
