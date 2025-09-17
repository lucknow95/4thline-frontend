// src/types/index.ts

/**
 * Common timeframes used across the site.
 * Include the display strings that Rankings uses, but stay open-ended.
 */
export type Timeframe =
  | 'Season'
  | 'Last 7 Days'
  | 'Last 14 Days'
  | 'Last 30 Days'
  | string;

/**
 * Core per-game stat line used in rankings and logs.
 * Keep fields optional & extensible to match partial/mixed provider data.
 */
export interface StatLine {
  /** Games played within the timeframe represented by this line */
  gamesPlayed?: number;
  G?: number;
  A?: number;
  PIM?: number;
  PPP?: number;
  SHP?: number;
  SOG?: number;
  FW?: number;
  HIT?: number;
  BLK?: number;
  /** Allow unexpected stat keys without type errors (e.g., TOI, +/-) */
  [k: string]: number | undefined;
}

/**
 * Stats keyed by timeframe (e.g., "Season", "Last 7 Days", etc.).
 * We purposely allow any string key because data can vary by provider.
 */
export type StatsByTimeframe = {
  [tf in Timeframe]?: StatLine;
} & {
  [custom: string]: StatLine | undefined;
};

/**
 * Basic schedule entry for a single game.
 * Optional fields anticipate your later schedule import (venue/special_game/time).
 */
export interface ScheduleGame {
  /** ISO date string, e.g., "2025-10-06" */
  date: string;
  /** City or team name per your schedule formatting rules */
  home_team: string;
  /** City or team name per your schedule formatting rules */
  away_team: string;
  /** Local start time, e.g., "7:00 PM" (optional until populated) */
  time?: string;
  /** Arena/venue name (optional until populated) */
  venue?: string;
  /** Flags like "Stadium Series", "Global Series"; null or undefined for normal games */
  special_game?: string | null;
}

/**
 * Optional: a normalized position set; keep string fallback for flexibility.
 * Since goalies are excluded from rankings, you can ignore 'G' where needed.
 */
export type PlayerPosition = 'C' | 'LW' | 'RW' | 'D' | 'G' | string;

/**
 * Primary Player model used across rankings, player pages, and logs.
 */
export interface Player {
  id: number;
  name: string;
  /** Team abbreviation or name; kept as string to align with current data */
  team: string;
  /** Single primary position (optional) */
  position?: PlayerPosition;
  /** Multi-eligibility positions (optional) */
  positions?: PlayerPosition[];
  /** Stats keyed by timeframe */
  stats: StatsByTimeframe;
  /** Optional schedule; can be populated once team schedules are loaded */
  schedule?: ScheduleGame[];
}

/* -------------------------
 * Helpful types for Game Logs
 * ------------------------- */

/**
 * A single game log entry for a player.
 * Mirrors StatLine (without gamesPlayed), plus contextual fields.
 */
export interface GameLogEntry {
  /** ISO date string for the game */
  date: string;
  /** Opponent team (city or name, consistent with your schedule feed) */
  opponent: string;
  /** True if the game was at home */
  home: boolean;
  /** Optional: Home/Away text like "HOME"/"AWAY" if you prefer strings */
  homeAwayLabel?: 'HOME' | 'AWAY';
  /**
   * The player's stats for this specific game.
   * gamesPlayed is not applicable at single-game granularity.
   */
  stats: Omit<StatLine, 'gamesPlayed'>;
  /** Optional Time On Ice formatted string like "18:43" */
  toi?: string;
}

/**
 * A convenient container for a player's logs across timeframes or filters.
 */
export interface PlayerGameLogs {
  playerId: number;
  entries: GameLogEntry[];
}
