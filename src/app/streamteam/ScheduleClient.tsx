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

function clampWeek(value: number): number {
  if (!Number.isFinite(value)) return 1;
  if (value < 1) return 1;
  if (value > 27) return 27;
  return Math.floor(value);
}

function parseDateToUTC(date: string): number {
  const parts = date.split("-");
  if (parts.length !== 3) throw new Error(`Invalid date format: ${date}`);

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

function formatShortDate(utc: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
  }).format(new Date(utc));
}

function formatDate(date: string): string {
  return formatShortDate(parseDateToUTC(date));
}

function getOpponent(team: string, game: ScheduleGame): string {
  if (game.home_team.includes(team)) return game.away_team;
  if (game.away_team.includes(team)) return game.home_team;
  return game.away_team;
}

function getHomeAway(team: string, game: ScheduleGame): "Home" | "Away" {
  if (game.home_team.includes(team)) return "Home";
  return "Away";
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
  const [week, setWeek] = useState(21);
  const [selectedDays, setSelectedDays] = useState<DayAbbr[]>([]);

  const weekOptions = useMemo(() => {
    return Array.from({ length: 27 }, (_, index) => {
      const weekNum = index + 1;
      const { start } = getWeekRange(weekNum);
      const end = start + 6 * MS_DAY;

      return {
        value: weekNum,
        label: `Week ${weekNum} (${formatShortDate(start)} – ${formatShortDate(end)})`,
      };
    });
  }, []);

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
          });

        return {
          team: teamBlock.team,
          gamesThisWeek: games.length,
          selectedDayGames: games.filter((g) =>
            selectedDays.includes(g.day)
          ).length,
          games,
        };
      })
      .filter((team) =>
        teamPlaysOnEverySelectedDay(team.games, selectedDays)
      );
  }, [week, selectedDays]);

  function toggleSelectedDay(day: DayAbbr) {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day]
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border p-4">
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div>
            <label className="mb-1 block text-sm font-semibold">
              Select Week
            </label>
            <select
              value={week}
              onChange={(e) => setWeek(clampWeek(Number(e.target.value)))}
              className="w-full border px-3 py-2 rounded"
            >
              {weekOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Days You Need Starts
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleSelectedDay(day)}
                  className={`px-3 py-2 rounded border ${selectedDays.includes(day)
                      ? "bg-blue-600 text-white"
                      : ""
                    }`}
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
                  {team.games.map((g) => {
                    const isSelectedDay = selectedDays.includes(g.day);

                    return (
                      <span
                        key={g.date}
                        className={
                          isSelectedDay
                            ? "schedule-pill"
                            : "schedule-pill schedule-pill-muted"
                        }
                      >
                        {g.day} {formatDate(g.date)}
                      </span>
                    );
                  })}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}