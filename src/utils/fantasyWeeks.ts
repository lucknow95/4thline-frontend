// src/utils/fantasyWeeks.ts
import rawSchedule from "@/data/nhlSchedule.json";
import type { Player, ScheduleGame } from "@/types";
import { isISODate } from "@/types/guards";
import type { DayAbbr } from "@/types/hockey";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type RawScheduleGame = {
  date: string;
};

type RawTeamSchedule = {
  schedule?: RawScheduleGame[];
};

/** Build a Date at UTC midnight for the given Y-M-D. */
function utcDateFromYMD(yyyy: number, mm01: number, dd: number): Date {
  return new Date(Date.UTC(yyyy, mm01 - 1, dd, 0, 0, 0, 0));
}

/** Parse YYYY-MM-DD as UTC midnight without timezone drift. */
function parseISODateOnlyToUTC(dateStr: string): Date | null {
  if (!isISODate(dateStr)) return null;
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Add whole UTC calendar days. */
function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * ONE_DAY_MS);
}

/** Format a UTC date for display. */
function formatLocalFromUTC(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Convert a UTC Date to an ISO timestamp with a supplied time. */
function toUtcIso(
  date: Date,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0
): string {
  const copy = new Date(date.getTime());
  copy.setUTCHours(hours, minutes, seconds, milliseconds);
  return copy.toISOString();
}

/** Return YYYY-MM-DD using UTC fields. */
export function utcDateToDateOnly(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

/** Find the Monday on or before a UTC date. */
function mondayOnOrBefore(date: Date): Date {
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return addUtcDays(date, -daysSinceMonday);
}

/** Find the Sunday on or after a UTC date. */
function sundayOnOrAfter(date: Date): Date {
  const daysUntilSunday = (7 - date.getUTCDay()) % 7;
  return addUtcDays(date, daysUntilSunday);
}

function getScheduleDateBounds(): {
  firstGameDate: string;
  lastGameDate: string;
} {
  const blocks = rawSchedule as RawTeamSchedule[];

  let firstGameDate = "";
  let lastGameDate = "";

  for (const block of blocks) {
    for (const game of block.schedule ?? []) {
      if (!isISODate(game.date)) continue;

      if (!firstGameDate || game.date < firstGameDate) {
        firstGameDate = game.date;
      }

      if (!lastGameDate || game.date > lastGameDate) {
        lastGameDate = game.date;
      }
    }
  }

  if (!firstGameDate || !lastGameDate) {
    throw new Error(
      "Unable to derive fantasy-week boundaries from nhlSchedule.json."
    );
  }

  return { firstGameDate, lastGameDate };
}

const scheduleBounds = getScheduleDateBounds();

const parsedFirstGameDate = parseISODateOnlyToUTC(
  scheduleBounds.firstGameDate
);
const parsedLastGameDate = parseISODateOnlyToUTC(
  scheduleBounds.lastGameDate
);

if (!parsedFirstGameDate || !parsedLastGameDate) {
  throw new Error("The NHL schedule contains invalid season-boundary dates.");
}

/** First and last actual regular-season game dates. */
export const FIRST_GAME_DATE = scheduleBounds.firstGameDate;
export const LAST_GAME_DATE = scheduleBounds.lastGameDate;

/** Full Monday-Sunday fantasy-season boundaries. */
export const FIRST_WEEK_START = mondayOnOrBefore(parsedFirstGameDate);
export const LAST_WEEK_END = sundayOnOrAfter(parsedLastGameDate);

/** Number of complete Monday-Sunday fantasy-week windows in the schedule. */
export const FANTASY_WEEK_COUNT =
  Math.floor(
    (LAST_WEEK_END.getTime() - FIRST_WEEK_START.getTime()) /
      (7 * ONE_DAY_MS)
  ) + 1;

export interface WeekOption {
  value: number;
  label: string;
  start: string;
  end: string;
}

export function clampFantasyWeek(value: number): number {
  if (!Number.isFinite(value)) return 1;

  return Math.min(
    FANTASY_WEEK_COUNT,
    Math.max(1, Math.floor(value))
  );
}

/**
 * Return the fantasy week for a schedule date.
 * Dates before Week 1 return 0.
 */
export function getFantasyWeek(dateStr: string): number {
  const gameDateUTC = parseISODateOnlyToUTC(dateStr);
  if (!gameDateUTC) return 0;

  const diffMs = gameDateUTC.getTime() - FIRST_WEEK_START.getTime();
  if (diffMs < 0) return 0;

  const diffDays = Math.floor(diffMs / ONE_DAY_MS);
  return Math.floor(diffDays / 7) + 1;
}

/**
 * Return the current fantasy week, clamped to the season.
 * Before the season this returns Week 1; after the season it returns the
 * final fantasy week.
 */
export function getCurrentFantasyWeek(now = new Date()): number {
  const localCalendarDateAsUTC = utcDateFromYMD(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate()
  );

  const diffMs =
    localCalendarDateAsUTC.getTime() - FIRST_WEEK_START.getTime();
  const rawWeek = Math.floor(diffMs / (7 * ONE_DAY_MS)) + 1;

  return clampFantasyWeek(rawWeek);
}

/** Start and end UTC Date objects for a fantasy week. */
export function getWeekDateRange(
  weekNumber: number
): { start: Date; end: Date } {
  const week = clampFantasyWeek(weekNumber);
  const start = addUtcDays(FIRST_WEEK_START, (week - 1) * 7);
  const end = addUtcDays(start, 6);

  return { start, end };
}

/** Label such as Week 1 (Sep 28 – Oct 4, 2026). */
export function getWeekLabel(weekNumber: number): string {
  const week = clampFantasyWeek(weekNumber);
  const { start, end } = getWeekDateRange(week);

  const startText = formatLocalFromUTC(start);
  const endText = formatLocalFromUTC(end);
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();

  const yearText =
    startYear === endYear
      ? String(startYear)
      : `${startYear}–${endYear}`;

  return `Week ${week} (${startText} – ${endText}, ${yearText})`;
}

/**
 * Generate week dropdown options.
 * Omitting numWeeks automatically uses the complete imported season.
 */
export function generateWeekOptions(
  numWeeks: number = FANTASY_WEEK_COUNT
): WeekOption[] {
  const count = Math.min(
    FANTASY_WEEK_COUNT,
    Math.max(1, Math.floor(numWeeks))
  );

  return Array.from({ length: count }, (_, index) => {
    const week = index + 1;
    const { start, end } = getWeekDateRange(week);

    return {
      value: week,
      label: getWeekLabel(week),
      start: toUtcIso(start),
      end: toUtcIso(end, 23, 59, 59, 999),
    };
  });
}

export type Game = Pick<
  ScheduleGame,
  "date" | "home_team" | "away_team"
>;

export type PlayerLike =
  | Pick<Player, "schedule">
  | null
  | undefined;

/** Games for a player or team schedule in a selected fantasy week. */
export function getGamesThisWeek(
  player: PlayerLike,
  selectedWeek: number
): Game[] {
  const schedule = player?.schedule ?? [];
  if (!Array.isArray(schedule) || schedule.length === 0) return [];

  const week = clampFantasyWeek(selectedWeek);

  return schedule.filter(
    (game) =>
      isISODate(game.date) &&
      getFantasyWeek(game.date) === week
  );
}

export const dayShortNameToNumber: Record<
  DayAbbr,
  number
> & { Sun: number } = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
} as const;

/** Exact YYYY-MM-DD values for selected weekdays in a fantasy week. */
export function getSelectedDatesForWeek(
  weekNumber: number,
  selectedDays: DayAbbr[]
): string[] {
  const { start } = getWeekDateRange(weekNumber);

  return selectedDays.map((dayShort) => {
    const dayIndex = dayShortNameToNumber[dayShort];
    const offset = dayIndex === 0 ? 6 : dayIndex - 1;
    return utcDateToDateOnly(addUtcDays(start, offset));
  });
}

/** Games occurring on selected weekdays within a fantasy week. */
export function getGamesThisWeekOnDates(
  player: PlayerLike,
  weekNumber: number,
  selectedDays: DayAbbr[]
): Game[] {
  if (!selectedDays || selectedDays.length === 0) return [];

  const selectedDates = new Set(
    getSelectedDatesForWeek(weekNumber, selectedDays)
  );

  const schedule = player?.schedule ?? [];
  if (!Array.isArray(schedule) || schedule.length === 0) return [];

  return schedule.filter(
    (game) =>
      isISODate(game.date) &&
      selectedDates.has(game.date)
  );
}
