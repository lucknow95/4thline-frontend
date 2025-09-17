// src/app/players/[id]/PlayerPageClient.tsx
"use client";

import type { Player } from "@/types";
import { isISODate } from "@/types/guards";
import {
  generateWeekOptions,
  getGamesThisWeek,
  getWeekLabel,
} from "@/utils/fantasyWeeks";
import { useMemo, useState } from "react";
import GameLogs, { type GameLog } from "./GameLogs";

// ⬇ League schedule is the source of truth
import rawSchedule from "@/data/nhlSchedule.json";

/* ------------------------------------------------------------------ */
/* Team abbreviation normalization (aligned with Rankings page)        */
/* ------------------------------------------------------------------ */
const TEAM_ABBR_MAP: Record<string, string> = {
  "Anaheim Ducks": "ANA", Anaheim: "ANA", ANA: "ANA",
  "Boston Bruins": "BOS", Boston: "BOS", BOS: "BOS",
  "Buffalo Sabres": "BUF", Buffalo: "BUF", BUF: "BUF",
  "Calgary Flames": "CGY", Calgary: "CGY", CGY: "CGY",
  "Carolina Hurricanes": "CAR", Carolina: "CAR", CAR: "CAR",
  "Chicago Blackhawks": "CHI", Chicago: "CHI", CHI: "CHI",
  "Colorado Avalanche": "COL", Colorado: "COL", COL: "COL",
  "Columbus Blue Jackets": "CBJ", Columbus: "CBJ", CBJ: "CBJ",
  "Dallas Stars": "DAL", Dallas: "DAL", DAL: "DAL",
  "Detroit Red Wings": "DET", Detroit: "DET", DET: "DET",
  "Edmonton Oilers": "EDM", Edmonton: "EDM", EDM: "EDM",
  "Florida Panthers": "FLA", Florida: "FLA", FLA: "FLA", FLO: "FLA",
  "Los Angeles Kings": "LAK", "Los Angeles": "LAK", LAK: "LAK",
  "Minnesota Wild": "MIN", Minnesota: "MIN", MIN: "MIN",
  "Montreal Canadiens": "MTL", Montreal: "MTL", "Montréal Canadiens": "MTL", "Montréal": "MTL", MTL: "MTL",
  "Nashville Predators": "NSH", Nashville: "NSH", NSH: "NSH",
  "New Jersey Devils": "NJD", "New Jersey": "NJD", NJD: "NJD",
  "New York Islanders": "NYI", NYI: "NYI",
  "New York Rangers": "NYR", NYR: "NYR",
  "Ottawa Senators": "OTT", Ottawa: "OTT", OTT: "OTT",
  "Philadelphia Flyers": "PHI", Philadelphia: "PHI", PHI: "PHI",
  "Pittsburgh Penguins": "PIT", Pittsburgh: "PIT", PIT: "PIT",
  "San Jose Sharks": "SJS", "San Jose": "SJS", SJS: "SJS",
  "Seattle Kraken": "SEA", Seattle: "SEA", SEA: "SEA",
  "St. Louis Blues": "STL", "St Louis": "STL", "St. Louis": "STL", STL: "STL",
  "Tampa Bay Lightning": "TBL", "Tampa Bay": "TBL", Tampa: "TBL", TBL: "TBL",
  "Toronto Maple Leafs": "TOR", Toronto: "TOR", TOR: "TOR",
  "Vancouver Canucks": "VAN", Vancouver: "VAN", VAN: "VAN",
  "Vegas Golden Knights": "VGK", Vegas: "VGK", VGK: "VGK",
  "Washington Capitals": "WSH", Washington: "WSH", WSH: "WSH",
  "Winnipeg Jets": "WPG", Winnipeg: "WPG", WPG: "WPG", WPJ: "WPG",
  "Utah Mammoth": "UTM", "Utah Hockey Club": "UTM", Utah: "UTM", UTM: "UTM", UTA: "UTM",
};

function normalizeTeamAbbreviation(input?: string): string {
  if (!input) return "";
  return TEAM_ABBR_MAP[input] || input;
}

/* ------------------------------------------------------------------ */
/* New York venue disambiguation (NYR vs NYI)                          */
/* ------------------------------------------------------------------ */
const VENUE_TO_TEAM_ABBR: Record<string, string> = {
  "Madison Square Garden": "NYR",
  "UBS Arena": "NYI",
};

/** If schedule uses city-only "New York", try venue to decide. */
function resolveCityToTeamAbbr(cityOrName: string, venue?: string | null): string {
  if (cityOrName === "New York") {
    if (venue && VENUE_TO_TEAM_ABBR[venue]) return VENUE_TO_TEAM_ABBR[venue];
    return "NY?"; // keep ambiguous instead of guessing wrong team
  }
  return normalizeTeamAbbreviation(cityOrName);
}

/* ------------------------------------------------------------------ */
/* League schedule map (ABBR -> games[])                               */
/* ------------------------------------------------------------------ */
type LeagueGame = {
  date: string;
  home_team: string; // city or full name or ABBR
  away_team: string; // city or full name or ABBR
  time?: string | null;
  venue?: string | null;
  special_game?: string | null;
};
type LeagueTeamBlock = {
  team: string; // ABBR, e.g., "COL"
  schedule: LeagueGame[];
};

const LEAGUE_GAMES_BY_TEAM: Map<string, LeagueGame[]> = (() => {
  const blocks = (rawSchedule as unknown as LeagueTeamBlock[]) || [];
  const map = new Map<string, LeagueGame[]>();
  for (const tb of blocks) {
    if (!tb?.team || !Array.isArray(tb.schedule)) continue;
    map.set(tb.team, tb.schedule);
  }
  return map;
})();

// Build a pseudo-player with the league schedule so fantasyWeeks helpers work
function pseudoPlayerForTeam(teamAbbr: string): Pick<Player, "team" | "schedule"> {
  return {
    team: teamAbbr,
    schedule: LEAGUE_GAMES_BY_TEAM.get(teamAbbr) ?? [],
  } as any;
}

/* ------------------------------------------------------------------ */
/* Helpers to format opponent & side safely                            */
/* ------------------------------------------------------------------ */
function describeFixtureForTeam(game: LeagueGame, teamAbbr: string): {
  side: "home" | "away" | "unknown";
  opponent: string;
} {
  const home = resolveCityToTeamAbbr(game.home_team, game.venue);
  const away = resolveCityToTeamAbbr(game.away_team, game.venue);

  if (home === teamAbbr) return { side: "home", opponent: away };
  if (away === teamAbbr) return { side: "away", opponent: home };

  // If neither matches (data variance), fall back to unknown with best-effort opponent
  if (home === "NY?" && away === teamAbbr) return { side: "away", opponent: "NY?" };
  if (away === "NY?" && home === teamAbbr) return { side: "home", opponent: "NY?" };

  return { side: "unknown", opponent: home !== teamAbbr ? home : away };
}

function decorateOpponent(side: "home" | "away" | "unknown", opponent: string): string {
  if (side === "home") return `vs ${opponent}`;
  if (side === "away") return `@${opponent}`;
  return opponent || "—";
}

/* ------------------------------------------------------------------ */

type Props = {
  player: Player & { gameLogs?: GameLog[] };
  numWeeks: number;
};

export default function PlayerPageClient({ player, numWeeks }: Props) {
  const safeNumWeeks = Math.max(1, Number.isFinite(numWeeks) ? numWeeks : 1);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [tab, setTab] = useState<"overview" | "logs" | "schedule">("overview");

  const weekOptions = useMemo(() => generateWeekOptions(safeNumWeeks), [safeNumWeeks]);

  const playerTeamAbbr = useMemo(
    () => normalizeTeamAbbreviation(player.team),
    [player.team]
  );

  // Use league schedule for the selected week (parity with Optimizer/Rankings)
  // Explicitly type as LeagueGame[] so .venue is known to exist on items.
  const weekGames = useMemo<LeagueGame[]>(() => {
    const pseudo = pseudoPlayerForTeam(playerTeamAbbr);
    return getGamesThisWeek(pseudo as Player, selectedWeek) as unknown as LeagueGame[];
  }, [playerTeamAbbr, selectedWeek]);

  const hasLogs = Array.isArray(player.gameLogs) && player.gameLogs.length > 0;

  const todayMidnight = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t.getTime();
  }, []);

  // Upcoming schedule also from league schedule
  const upcoming = useMemo<LeagueGame[]>(() => {
    const sched = LEAGUE_GAMES_BY_TEAM.get(playerTeamAbbr) ?? [];
    return sched
      .filter((g) => isISODate(g.date))
      .filter((g) => {
        const d = new Date(g.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime() >= todayMidnight;
      })
      .slice(0, 10);
  }, [playerTeamAbbr, todayMidnight]);

  // Reusable classes for token-aligned buttons
  const tabBase =
    "px-3 py-1 rounded-md border transition " +
    "border-[var(--border)] bg-[var(--surface)] text-[var(--surface-contrast)] hover:bg-[var(--hover)]";
  const tabActive = "bg-blue-600 text-white border-blue-600";

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-bold">
          {player.name}
          {Array.isArray(player.positions) && player.positions.length > 0
            ? ` (${player.positions.join("/")})`
            : ""}{" "}
          - {playerTeamAbbr}
        </h1>
      </header>

      {/* Tabs */}
      <nav className="flex gap-2" role="tablist" aria-label="Player sections">
        <button
          role="tab"
          aria-selected={tab === "overview"}
          className={`${tabBase} ${tab === "overview" ? tabActive : ""}`}
          onClick={() => setTab("overview")}
          type="button"
        >
          Overview
        </button>

        {hasLogs && (
          <button
            role="tab"
            aria-selected={tab === "logs"}
            className={`${tabBase} ${tab === "logs" ? tabActive : ""}`}
            onClick={() => setTab("logs")}
            type="button"
          >
            Game Logs
          </button>
        )}

        <button
          role="tab"
          aria-selected={tab === "schedule"}
          className={`${tabBase} ${tab === "schedule" ? tabActive : ""}`}
          onClick={() => setTab("schedule")}
          type="button"
        >
          Schedule
        </button>
      </nav>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">Performance Graph</h2>
          <p>🛠️ Placeholder for future graph.</p>
        </section>
      )}

      {/* GAME LOGS */}
      {tab === "logs" && hasLogs && (
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Recent Game Logs</h2>
          <GameLogs
            team={playerTeamAbbr}
            logs={player.gameLogs as GameLog[]}
            normalizeAbbr={normalizeTeamAbbreviation}
            pageSize={10}
          />
        </section>
      )}
      {tab === "logs" && !hasLogs && (
        <section>
          <p>No game logs available for this player yet.</p>
        </section>
      )}

      {/* SCHEDULE */}
      {tab === "schedule" && (
        <section className="space-y-3">
          {/* Week Picker */}
          <div className="flex items-center gap-2">
            <label htmlFor="week-picker" className="font-medium">
              View Schedule for:
            </label>
            <select
              id="week-picker"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              className="border border-[var(--border)] rounded px-2 py-1 bg-[var(--surface)] text-[var(--surface-contrast)]"
            >
              {weekOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-sm text-[var(--muted)]">
              {getWeekLabel(selectedWeek)}
            </span>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2">
              Games in {getWeekLabel(selectedWeek)}
            </h3>
            {weekGames.length > 0 ? (
              <ul className="list-disc pl-6">
                {weekGames.map((game, idx) => {
                  const { side, opponent } = describeFixtureForTeam(game, playerTeamAbbr);
                  const decorated = decorateOpponent(side, opponent);
                  const accent =
                    side === "home"
                      ? "text-green-600"
                      : side === "away"
                        ? "text-blue-600"
                        : "text-zinc-600";

                  return (
                    <li key={`${game.date}-${idx}`}>
                      <span className={accent}>
                        {game.date}: {decorated}
                      </span>
                      {game.venue && (
                        <span className="ml-2 text-xs text-zinc-500">({game.venue})</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>No games for this player in {getWeekLabel(selectedWeek)}.</p>
            )}
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2">Upcoming Schedule</h3>
            {upcoming.length > 0 ? (
              <ul className="list-disc pl-6">
                {upcoming.map((game, idx) => {
                  const { side, opponent } = describeFixtureForTeam(game, playerTeamAbbr);
                  const decorated = decorateOpponent(side, opponent);
                  const accent =
                    side === "home"
                      ? "text-green-600"
                      : side === "away"
                        ? "text-blue-600"
                        : "text-zinc-600";

                  return (
                    <li key={`${game.date}-up-${idx}`}>
                      <span className={accent}>
                        {game.date}: {decorated}
                      </span>
                      {game.venue && (
                        <span className="ml-2 text-xs text-zinc-500">({game.venue})</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>No upcoming games found for this player.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
