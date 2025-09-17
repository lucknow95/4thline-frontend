// src/types/hockey.ts

/** Literal union of NHL team abbreviations (includes UTA for 2025–26, keeps ARI for legacy data). */
export type TeamAbbr =
  | 'ANA' | 'BOS' | 'BUF' | 'CGY' | 'CAR' | 'CHI' | 'COL' | 'CBJ'
  | 'DAL' | 'DET' | 'EDM' | 'FLA' | 'LAK' | 'MIN' | 'MTL' | 'NSH'
  | 'NJD' | 'NYI' | 'NYR' | 'OTT' | 'PHI' | 'PIT' | 'SJS' | 'SEA'
  | 'STL' | 'TBL' | 'TOR' | 'UTA' | 'VAN' | 'VGK' | 'WSH' | 'WPG'
  

/** Canonical list of team abbreviations (used by guards & UI). */
export const TEAM_ABBRS = [
  'ANA','BOS','BUF','CGY','CAR','CHI','COL','CBJ',
  'DAL','DET','EDM','FLA','LAK','MIN','MTL','NSH',
  'NJD','NYI','NYR','OTT','PHI','PIT','SJS','SEA',
  'STL','TBL','TOR','UTA','VAN','VGK','WSH','WPG',
  
] as const satisfies ReadonlyArray<TeamAbbr>;

/** Day-of-week index in UTC: 0..6 (Sun..Sat). */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Day-of-week abbreviations (Mon..Sun) for UI/filters. */
export type DayAbbr = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as const satisfies ReadonlyArray<DayAbbr>;

/** Date range used by the optimizer (inclusive, yyyymmdd as a number). */
export interface DateRange {
  readonly startYmd: number;
  readonly endYmd: number;
}

/** Optimizer filters. */
export interface Filters {
  /** Include home games. */
  readonly includeHome: boolean;
  /** Include away games. */
  readonly includeAway: boolean;
  /** Only include off-nights (Mon/Wed/Fri/Sun). */
  readonly offNightsOnly: boolean;
  /** Optional set of day indices to include (empty = any). */
  readonly daysOfWeek: DayIndex[];
  /** Minimum games threshold for a team to appear. */
  readonly minGames: number;
}

/** One game from a team's perspective after adaptation. */
export interface TeamGame {
  /** yyyymmdd in UTC, e.g., 20251007 */
  readonly ymd: number;
  /** True if the team is home. */
  readonly home: boolean;
  /** Opponent team abbreviation. */
  readonly opp: TeamAbbr;
}

/** Per-team schedule block consumed by the optimizer. */
export interface TeamBlock {
  /** Team abbreviation. */
  readonly team: TeamAbbr;
  /** All games for this team (regular season only for optimizer). */
  readonly games: ReadonlyArray<TeamGame>;
}

/** Result row computed by the optimizer for the selected window. */
export interface TeamWindowSummary {
  readonly team: TeamAbbr;
  readonly gamesTotal: number;
  readonly offNightGames: number;
  readonly heavyNightGames: number;
  readonly b2bCount: number;
  readonly home: number;
  readonly away: number;
  /** Per-week bins aligned to the chosen start (Mon–Sun). */
  readonly perWeek: ReadonlyArray<number>;
}

/** Player-centric API shape (what your provider returns). */
export interface PlayerWithSchedule {
  readonly id: number;
  readonly name: string;
  /** The provider may send non-standard strings; keep wide here. */
  readonly team: string;
  readonly positions?: ReadonlyArray<string>;
  readonly stats?: unknown; // left open; not used by the optimizer
  readonly schedule: ReadonlyArray<PlayerScheduleGame>;
}

/** One game entry from your API (pre-adaptation). */
export interface PlayerScheduleGame {
  /** "YYYY-MM-DD" */
  readonly date: string;
  /** Home team label (can be full name or city). */
  readonly home_team: string;
  /** Away team label (can be full name or city). */
  readonly away_team: string;
}

/** Maps for resolving provider strings to canonical abbreviations. */
export interface NameMaps {
  /** Full team name -> abbr (e.g., "Colorado Avalanche" -> "COL"). */
  readonly fullTeamToAbbr: Record<string, TeamAbbr>;
  /** City/short label -> abbr (e.g., "Los Angeles" -> "LAK"). */
  readonly cityToAbbr: Record<string, TeamAbbr>;
}

/** Default threshold often used to classify "heavy" nights league-wide. */
export const HEAVY_NIGHT_THRESHOLD_DEFAULT = 6 as const;

/** Type guard for team abbreviations when dealing with unknown strings. */
export function isTeamAbbr(x: unknown): x is TeamAbbr {
  return typeof x === 'string' && (TEAM_ABBRS as readonly string[]).includes(x);
}

/* -------------------------------------------------------------------------- */
/* Rankings Page Types                                                        */
/* -------------------------------------------------------------------------- */

export type Position = 'C' | 'LW' | 'RW' | 'D' | 'G';
export type SkaterPosition = Exclude<Position, 'G'>;

/** Stat keys used on the rankings table. */
export type SkaterStatKeys =
  | 'G' | 'A' | 'PIM' | 'PPP' | 'SHP' | 'SOG' | 'FW' | 'HIT' | 'BLK';

/** Player shape used by Rankings (post-adaptation to our canonical types). */
export interface Player {
  /** Provider id can be numeric; we allow string too to be flexible. */
  readonly id: string | number;
  readonly name: string;
  readonly team: TeamAbbr;
  readonly position: Position;

  /** Season totals (for totals mode display & filters). */
  readonly totals: Record<SkaterStatKeys, number>;

  /** Per-game averages (for per-game mode display & filters). */
  readonly perGame: Record<SkaterStatKeys, number>;

  /**
   * Days this player has games in the currently-selected week window.
   * Example: ['Tue','Fri'] — used for "Games This Week" and day filters.
   */
  readonly schedule: ReadonlyArray<DayAbbr>;
}

export type SortKey = SkaterStatKeys | 'name' | 'team' | 'gamesThisWeek';

export interface RankingsFilters {
  /** Day filter: none selected => show all players. */
  selectedDays: DayAbbr[];
  /** Team filter uses canonical abbreviations. */
  teams: TeamAbbr[];
  /** Name search (case-insensitive contains). */
  search: string;
  /** Minimum stat thresholds (compare vs totals or perGame depending on mode). */
  minStats: Partial<Record<SkaterStatKeys, number>>;
  /** Toggle for display + filter comparison mode. */
  perGameMode: boolean;
  /** Pagination */
  page: number;
  pageSize: number;
  /** Sorting */
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
}
