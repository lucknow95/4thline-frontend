// src/app/streamteam/ScheduleClient.tsx
"use client";

import scheduleData from "@/data/nhlSchedule.json";
import {
  clampFantasyWeek,
  generateWeekOptions,
  getCurrentFantasyWeek,
  getWeekDateRange,
  utcDateToDateOnly,
} from "@/utils/fantasyWeeks";
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
  homeAway: "Home" | "Away" | "Unknown";
};

type StreamTeam = {
  team: string;
  gamesThisWeek: number;
  selectedDayGames: number;
  games: DisplayGame[];
};

const DAYS: DayAbbr[] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

const DAY_BY_UTC_INDEX: DayAbbr[] = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

const TEAM_ALIASES_BY_ABBR: Record<string, string[]> = {
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
  FLA: ["FLA", "FLO", "Florida", "Florida Panthers"],
  LAK: ["LAK", "Los Angeles", "Los Angeles Kings"],
  MIN: ["MIN", "Minnesota", "Minnesota Wild"],
  MTL: [
    "MTL",
    "Montreal",
    "Montréal",
    "Montreal Canadiens",
    "Montréal Canadiens",
  ],
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
  TBL: ["TBL", "Tampa", "Tampa Bay", "Tampa Bay Lightning"],
  TOR: ["TOR", "Toronto", "Toronto Maple Leafs"],
  UTM: [
    "UTM",
    "UTA",
    "Utah",
    "Utah Mammoth",
    "Utah Hockey Club",
  ],
  VAN: ["VAN", "Vancouver", "Vancouver Canucks"],
  VGK: ["VGK", "Vegas", "Vegas Golden Knights"],
  WSH: ["WSH", "Washington", "Washington Capitals"],
  WPG: ["WPG", "WPJ", "Winnipeg", "Winnipeg Jets"],
};

const NAME_TO_ABBR: Record<string, string> = Object.entries(
  TEAM_ALIASES_BY_ABBR
).reduce(
  (map, [abbr, aliases]) => {
    for (const alias of aliases) {
      map[alias] = abbr;
    }

    return map;
  },
  {} as Record<string, string>
);

function normalizeTeamName(value: string): string {
  return NAME_TO_ABBR[value] ?? value;
}

function parseDateToUTC(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function getDayAbbr(date: string): DayAbbr {
  const dayIndex = parseDateToUTC(date).getUTCDay();
  return DAY_BY_UTC_INDEX[dayIndex] ?? "Sun";
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parseDateToUTC(date));
}

function describeGameForTeam(
  team: string,
  game: ScheduleGame
): {
  opponent: string;
  homeAway: DisplayGame["homeAway"];
} {
  const homeTeam = normalizeTeamName(game.home_team);
  const awayTeam = normalizeTeamName(game.away_team);

  if (homeTeam === team) {
    return {
      opponent: awayTeam,
      homeAway: "Home",
    };
  }

  if (awayTeam === team) {
    return {
      opponent: homeTeam,
      homeAway: "Away",
    };
  }

  return {
    opponent: awayTeam,
    homeAway: "Unknown",
  };
}

function teamPlaysOnEverySelectedDay(
  games: DisplayGame[],
  selectedDays: DayAbbr[]
): boolean {
  if (selectedDays.length === 0) return true;

  return selectedDays.every((day) =>
    games.some((game) => game.day === day)
  );
}

export default function ScheduleClient() {
  const [week, setWeek] = useState<number>(() =>
    getCurrentFantasyWeek()
  );

  const [selectedDays, setSelectedDays] = useState<DayAbbr[]>([]);

  const weekOptions = useMemo(() => generateWeekOptions(), []);

  const streamTeams = useMemo<StreamTeam[]>(() => {
    const { start, end } = getWeekDateRange(week);
    const startDate = utcDateToDateOnly(start);
    const endDate = utcDateToDateOnly(end);
    const teams = scheduleData as TeamSchedule[];

    return teams
      .map((teamBlock) => {
        const games = teamBlock.schedule
          .filter(
            (game) =>
              game.date >= startDate &&
              game.date <= endDate
          )
          .map((game) => {
            const perspective = describeGameForTeam(
              teamBlock.team,
              game
            );

            return {
              date: game.date,
              day: getDayAbbr(game.date),
              opponent: perspective.opponent,
              homeAway: perspective.homeAway,
            };
          });

        return {
          team: teamBlock.team,
          gamesThisWeek: games.length,
          selectedDayGames: games.filter((game) =>
            selectedDays.includes(game.day)
          ).length,
          games,
        };
      })
      .filter((team) =>
        teamPlaysOnEverySelectedDay(
          team.games,
          selectedDays
        )
      );
  }, [week, selectedDays]);

  function toggleSelectedDay(day: DayAbbr) {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((selectedDay) => selectedDay !== day)
        : [...current, day]
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border p-4">
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div>
            <label className="mb-1 block text-sm font-semibold">
              Select Week
            </label>

            <select
              value={week}
              onChange={(event) =>
                setWeek(
                  clampFantasyWeek(
                    Number(event.target.value)
                  )
                )
              }
              className="w-full rounded border px-3 py-2"
            >
              {weekOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">
              Days You Need Starts
            </label>

            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleSelectedDay(day)}
                  className={[
                    "rounded border px-3 py-2",
                    selectedDays.includes(day)
                      ? "bg-blue-600 text-white"
                      : "",
                  ].join(" ")}
                  aria-pressed={selectedDays.includes(day)}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <table className="rankings-table text-sm">
        <thead>
          <tr>
            <th>Team</th>
            <th>Games</th>
            <th>Selected Days</th>
            <th className="schedule-column">Schedule</th>
          </tr>
        </thead>

        <tbody>
          {streamTeams.map((team) => (
            <tr key={team.team}>
              <td>{team.team}</td>
              <td>{team.gamesThisWeek}</td>
              <td>{team.selectedDayGames}</td>

              <td className="schedule-column">
                <div className="schedule-scroll">
                  {team.games.map((game) => {
                    const isSelectedDay =
                      selectedDays.includes(game.day);

                    const location =
                      game.homeAway === "Home"
                        ? "vs"
                        : game.homeAway === "Away"
                          ? "@"
                          : "";

                    return (
                      <span
                        key={`${team.team}-${game.date}`}
                        className={
                          isSelectedDay
                            ? "schedule-pill"
                            : "schedule-pill schedule-pill-muted"
                        }
                        title={`${game.homeAway}: ${game.opponent}`}
                      >
                        {game.day} {formatDate(game.date)}
                        {location
                          ? ` ${location} ${game.opponent}`
                          : ""}
                      </span>
                    );
                  })}
                </div>
              </td>
            </tr>
          ))}

          {streamTeams.length === 0 && (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-6 text-center text-zinc-600"
              >
                No teams play on every selected day.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
