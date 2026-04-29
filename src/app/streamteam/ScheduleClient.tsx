// src/app/streamteam/ScheduleClient.tsx
"use client";

import scheduleData from "@/data/nhlSchedule.json";
import { useMemo, useState } from "react";

type DayAbbr = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

type ScheduleGame = {
  date: string;
  home_team: string;
  away_team: string;
};

type TeamSchedule = {
  team: string;
  schedule: ScheduleGame[];
};

type DisplayGame = {
  date: string;
  day: DayAbbr;
  opponent: string;
  homeAway: "Home" | "Away";
};

type StreamTeam = {
  team: string;
  gamesThisWeek: number;
  selectedDayGames: number;
  games: DisplayGame[];
};

const WEEK1_MON_UTC = Date.UTC(2025, 9, 6);
const MS_DAY = 24 * 60 * 60 * 1000;

const DAYS: DayAbbr[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TEAM_ALIASES: Record<string, string[]> = {
  ANA: ["ANA", "Anaheim", "Anaheim Ducks"],
  BOS: ["BOS", "Boston", "Boston Bruins"],
  BUF: ["BUF", "Buffalo", "Buffalo Sabres"],
  CGY: ["CGY", "Calgary", "Calgary Flames"],
  CAR: ["CAR", "Carolina", "Carolina Hurricanes"],
  CHI: ["CHI", "Chicago", "Chicago Blackhawks"],
  COL: ["COL", "Colorado", "Colorado Avalanche"],
  CBJ: ["CBJ", "Columbus", "Columbus Blue Jackets"],
  DAL: ["DAL", "Dallas", "Dallas Stars"],
  DET: ["DET", "Detroit", "Detroit Red Wings"],
  EDM: ["EDM", "Edmonton", "Edmonton Oilers"],
  FLA: ["FLA", "Florida", "Florida Panthers"],
  LAK: ["LAK", "Los Angeles", "Los Angeles Kings"],
  MIN: ["MIN", "Minnesota", "Minnesota Wild"],
  MTL: ["MTL", "Montreal", "Montreal Canadiens"],
  NSH: ["NSH", "Nashville", "Nashville Predators"],
  NJD: ["NJD", "New Jersey", "New Jersey Devils"],
  NYI: ["NYI", "New York Islanders"],
  NYR: ["NYR", "New York Rangers"],
  OTT: ["OTT", "Ottawa", "Ottawa Senators"],
  PHI: ["PHI", "Philadelphia", "Philadelphia Flyers"],
  PIT: ["PIT", "Pittsburgh", "Pittsburgh Penguins"],
  SJS: ["SJS", "San Jose", "San Jose Sharks"],
  SEA: ["SEA", "Seattle", "Seattle Kraken"],
  STL: ["STL", "St. Louis", "St Louis", "St. Louis Blues"],
  TBL: ["TBL", "Tampa Bay", "Tampa Bay Lightning"],
  TOR: ["TOR", "Toronto", "Toronto Maple Leafs"],
  UTA: ["UTA", "Utah", "Utah Hockey Club", "Utah Mammoth"],
  VAN: ["VAN", "Vancouver", "Vancouver Canucks"],
  VGK: ["VGK", "Vegas", "Vegas Golden Knights"],
  WSH: ["WSH", "Washington", "Washington Capitals"],
  WPG: ["WPG", "Winnipeg", "Winnipeg Jets"],
};

function clampWeek(value: number): number {
  if (!Number.isFinite(value)) return 1;
  if (value < 1) return 1;
  if (value > 27) return 27;
  return Math.floor(value);
}

function parseDateToUTC(date: string): number {
  const parts = date.split("-");

  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${date}`);
  }

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    throw new Error(`Invalid numeric date: ${date}`);
  }

  return Date.UTC(year, month - 1, day);
}

function getDayAbbr(date: string): DayAbbr {
  const utc = parseDateToUTC(date);
  const dayIndex = new Date(utc).getUTCDay();

  const map: Record<number, DayAbbr> = {
    0: "Sun",
    1: "Mon",
    2: "Tue",
    3: "Wed",
    4: "Thu",
    5: "Fri",
    6: "Sat",
  };

  return map[dayIndex] ?? "Sun";
}

function getWeekRange(week: number) {
  const safeWeek = clampWeek(week);
  const start = WEEK1_MON_UTC + (safeWeek - 1) * 7 * MS_DAY;
  const endExclusive = start + 7 * MS_DAY;

  return { start, endExclusive };
}

function formatDate(date: string): string {
  const utc = parseDateToUTC(date);

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
  }).format(new Date(utc));
}

function normalizeTeamName(value: string): string {
  return value.trim().toLowerCase();
}

function isTeamMatch(teamAbbr: string, value: string): boolean {
  const aliases = TEAM_ALIASES[teamAbbr] ?? [teamAbbr];
  const normalizedValue = normalizeTeamName(value);

  return aliases.some(
    (alias) => normalizeTeamName(alias) === normalizedValue
  );
}

function getOpponent(teamAbbr: string, game: ScheduleGame): string {
  if (isTeamMatch(teamAbbr, game.home_team)) {
    return game.away_team;
  }

  if (isTeamMatch(teamAbbr, game.away_team)) {
    return game.home_team;
  }

  return game.away_team;
}

function getHomeAway(teamAbbr: string, game: ScheduleGame): "Home" | "Away" {
  if (isTeamMatch(teamAbbr, game.home_team)) {
    return "Home";
  }

  return "Away";
}

function teamPlaysOnEverySelectedDay(
  games: DisplayGame[],
  selectedDays: DayAbbr[]
): boolean {
  if (selectedDays.length === 0) {
    return true;
  }

  return selectedDays.every((day) =>
    games.some((game) => game.day === day)
  );
}

export default function ScheduleClient() {
  const [week, setWeek] = useState(21);
  const [selectedDays, setSelectedDays] = useState<DayAbbr[]>([]);

  const weekOptions = useMemo(
    () =>
      Array.from({ length: 27 }, (_, index) => ({
        value: index + 1,
        label: `Week ${index + 1}`,
      })),
    []
  );

  const streamTeams = useMemo<StreamTeam[]>(() => {
    const { start, endExclusive } = getWeekRange(week);
    const teams = scheduleData as TeamSchedule[];

    return teams
      .map((teamBlock) => {
        const games = teamBlock.schedule
          .filter((game) => {
            const gameDate = parseDateToUTC(game.date);
            return gameDate >= start && gameDate < endExclusive;
          })
          .map((game) => {
            const day = getDayAbbr(game.date);

            return {
              date: game.date,
              day,
              opponent: getOpponent(teamBlock.team, game),
              homeAway: getHomeAway(teamBlock.team, game),
            };
          })
          .sort((a, b) => parseDateToUTC(a.date) - parseDateToUTC(b.date));

        return {
          team: teamBlock.team,
          gamesThisWeek: games.length,
          selectedDayGames: games.filter((game) =>
            selectedDays.includes(game.day)
          ).length,
          games,
        };
      })
      .filter((team) => teamPlaysOnEverySelectedDay(team.games, selectedDays))
      .sort((a, b) => {
        if (selectedDays.length > 0) {
          return b.gamesThisWeek - a.gamesThisWeek || a.team.localeCompare(b.team);
        }

        return a.team.localeCompare(b.team);
      });
  }, [week, selectedDays]);

  function toggleSelectedDay(day: DayAbbr) {
    setSelectedDays((current) => {
      if (current.includes(day)) {
        return current.filter((d) => d !== day);
      }

      return DAYS.filter((d) => [...current, day].includes(d));
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
          <div>
            <label className="mb-1 block text-sm font-semibold">
              Select Week
            </label>
            <select
              value={week}
              onChange={(event) =>
                setWeek(clampWeek(Number(event.target.value)))
              }
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--surface-contrast)]"
            >
              {weekOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <label className="block text-sm font-semibold">
                Days You Need Starts
              </label>

              {selectedDays.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedDays([])}
                  className="text-xs font-semibold underline hover:no-underline"
                >
                  Clear days
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleSelectedDay(day)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${selectedDays.includes(day)
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-[var(--border)] bg-transparent text-[var(--surface-contrast)]"
                    }`}
                >
                  {day}
                </button>
              ))}
            </div>

            <p className="mt-3 text-sm text-[var(--muted)]">
              {selectedDays.length === 0
                ? "No days selected — showing all teams for the selected week."
                : `Showing only teams that play on every selected day: ${selectedDays.join(
                  ", "
                )}.`}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full min-w-[800px] border-collapse text-left text-sm">
          <thead className="bg-[var(--surface)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Team</th>
              <th className="px-4 py-3 font-semibold">Games This Week</th>
              <th className="px-4 py-3 font-semibold">
                Selected-Day Games
              </th>
              <th className="px-4 py-3 font-semibold">Weekly Schedule</th>
            </tr>
          </thead>

          <tbody>
            {streamTeams.map((team) => (
              <tr
                key={team.team}
                className="border-t border-[var(--border)] align-top"
              >
                <td className="px-4 py-3 font-bold">{team.team}</td>
                <td className="px-4 py-3">{team.gamesThisWeek}</td>
                <td className="px-4 py-3">
                  {selectedDays.length === 0 ? "—" : team.selectedDayGames}
                </td>
                <td className="px-4 py-3">
                  {team.games.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {team.games.map((game) => {
                        const isSelectedDay = selectedDays.includes(game.day);

                        return (
                          <span
                            key={`${team.team}-${game.date}-${game.opponent}`}
                            className={`rounded-full border px-3 py-1 text-xs ${isSelectedDay
                                ? "border-green-600 bg-green-600 text-white"
                                : "border-[var(--border)]"
                              }`}
                          >
                            {game.day} {formatDate(game.date)}{" "}
                            {game.homeAway === "Home" ? "vs" : "@"}{" "}
                            {game.opponent}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-[var(--muted)]">No games</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {streamTeams.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
          No teams play on every selected day for this week.
        </div>
      )}
    </div>
  );
}