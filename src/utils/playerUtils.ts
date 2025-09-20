// src/utils/playerUtils.ts
import type { Player } from '@/types';
// ❌ remove this
// import type { DayShort } from '@/utils/fantasyWeeks';

// ✅ use the exported type from guards
import rawSchedule from '@/data/nhlSchedule.json';
import type { DayShort } from '@/types/guards';
import { filterSchedule, isISODate } from '@/types/guards';

// Validate once at module load
const nhlSchedule = filterSchedule(rawSchedule as unknown);

/* ================================================
   Filtering & Sorting helpers
   ================================================ */

// ✅ Filter players by stat thresholds (supports perGame + timeframe)
export function filterPlayersByStats(
  players: Player[],
  minStats: Record<string, number>,
  perGame: boolean,
  selectedTimeframe: string = 'Season'
): Player[] {
  return players.filter((player) => {
    const stats = player.stats[selectedTimeframe];
    if (!stats || typeof stats !== 'object') return false;

    const gp = stats.gamesPlayed || 1;

    return Object.entries(minStats).every(([stat, min]) => {
      const raw = (stats as Record<string, unknown>)[stat];
      if (typeof raw !== 'number') return false;

      const value = perGame ? raw / gp : raw;

      return Number.isFinite(value) && Number.isFinite(min) && value >= min;
    });
  });
}

// ✅ Sort players by stat (supports perGame + timeframe)
export function sortPlayers(
  players: Player[],
  stat: string,
  order: 'asc' | 'desc',
  perGame: boolean,
  selectedTimeframe: string = 'Season'
): Player[] {
  return [...players].sort((a, b) => {
    if (stat === 'name') {
      return order === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    }

    const aStats = a.stats[selectedTimeframe];
    const bStats = b.stats[selectedTimeframe];
    if (!aStats || !bStats) return 0;

    const aRaw = (aStats as Record<string, unknown>)[stat];
    const bRaw = (bStats as Record<string, unknown>)[stat];

    const aNum = typeof aRaw === 'number' ? aRaw : 0;
    const bNum = typeof bRaw === 'number' ? bRaw : 0;

    const aValue = perGame ? aNum / (aStats.gamesPlayed || 1) : aNum;
    const bValue = perGame ? bNum / (bStats.gamesPlayed || 1) : bNum;

    return order === 'asc' ? aValue - bValue : bValue - aValue;
  });
}

/* ================================================
   Weekly Games helper (schedule-based)
   ================================================ */

/**
 * Calculate number of games a player plays on selected days in a specific week.
 * @param player The player object.
 * @param week The week number (1-based, with week 1 being the start of the NHL season).
 * @param selectedDays Array of short day names: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
 * @param seasonStartDate ISO string for the first day of the season, e.g. '2025-10-06'
 */
export function calculateWeeklyGames(
  player: Player,
  week: number,
  selectedDays: DayShort[],
  seasonStartDate: string = '2025-10-06'
): number {
  // Find this player's team schedule (JSON uses full team name for the team itself)
  const teamSchedule = nhlSchedule.find((t) => t.team === player.team);
  if (!teamSchedule || !Array.isArray(teamSchedule.schedule)) return 0;

  // Calculate date range for the selected week (Mon–Sun window starting from seasonStartDate)
  const seasonStart = new Date(seasonStartDate);
  if (Number.isNaN(seasonStart.getTime())) return 0;

  const weekStart = new Date(seasonStart);
  weekStart.setDate(seasonStart.getDate() + (week - 1) * 7);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Helper: convert 'YYYY-MM-DD' to DayShort
  const dateToDayShort = (isoDate: string): DayShort => {
    const idx = new Date(isoDate).getDay(); // 0=Sun ... 6=Sat
    const map: DayShort[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return map[idx] ?? 'Mon';
    // (If idx were NaN we’d never get here because isISODate is enforced by filterSchedule)
  };

  return teamSchedule.schedule.filter((game: any) => {
    const dateStr = game?.date;
    if (!isISODate(dateStr)) return false; // double-safe (should already be valid)

    const date = new Date(dateStr);
    const dayShort = dateToDayShort(dateStr);

    const inWeek = date >= weekStart && date <= weekEnd;
    const dayMatches =
      selectedDays.length === 0 || selectedDays.includes(dayShort);

    return inWeek && dayMatches;
  }).length;
}
