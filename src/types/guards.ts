// src/types/guards.ts
import type { Player, ScheduleGame } from '@/types';

/* ================================
   DayShort helpers
   ================================ */
// Define days locally and infer the union type
const DAY_SHORTS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
type DayShort = typeof DAY_SHORTS[number];

export function isDayShort(x: unknown): x is DayShort {
  return typeof x === 'string' && (DAY_SHORTS as readonly string[]).includes(x);
}

export function toDayShorts(arr: unknown): DayShort[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter(isDayShort) as DayShort[];
}

/* ================================
   Date / Schedule guards
   ================================ */
export function isISODate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function isScheduleGame(x: unknown): x is Pick<ScheduleGame, 'date' | 'home_team' | 'away_team'> {
  if (!x || typeof x !== 'object') return false;
  const g = x as any;
  return (
    isISODate(g.date) &&
    typeof g.home_team === 'string' &&
    typeof g.away_team === 'string'
  );
}

/* ================================
   Player guards
   ================================ */
export function isPlayer(obj: unknown): obj is Player {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as any;

  const hasId = typeof o.id === 'number';
  const hasName = typeof o.name === 'string';
  const hasTeam = typeof o.team === 'string' || typeof o.teamAbbr === 'string';
  // allow either single position or positions[]
  const hasPosition =
    typeof o.position === 'string' ||
    (Array.isArray(o.positions) && o.positions.every((p: unknown) => typeof p === 'string'));

  const okStats = o.stats && typeof o.stats === 'object';

  const okSchedule =
    !('schedule' in o) ||
    (Array.isArray(o.schedule) && o.schedule.every(isScheduleGame));

  return hasId && hasName && hasTeam && hasPosition && okStats && okSchedule;
}

export function filterPlayers(data: unknown): Player[] {
  if (!Array.isArray(data)) return [];
  return data.filter(isPlayer) as Player[];
}

/* ================================
   League Schedule (team blocks)
   ================================ */
export type ScheduleTeam = {
  team: string;
  schedule: Array<{ date: string; home_team: string; away_team: string }>;
};

export function isScheduleTeam(x: unknown): x is ScheduleTeam {
  if (!x || typeof x !== 'object') return false;
  const o = x as any;
  if (typeof o.team !== 'string' || !Array.isArray(o.schedule)) return false;
  return o.schedule.every(isScheduleGame);
}

export function filterSchedule(data: unknown): ScheduleTeam[] {
  if (!Array.isArray(data)) return [];
  return data.filter(isScheduleTeam) as ScheduleTeam[];
}

/* ================================
   Exhaustiveness helper
   ================================ */
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}
