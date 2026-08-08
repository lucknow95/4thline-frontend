"use client";

import FantasyWeekPicker from "@/components/schedule/FantasyWeekPicker";
import TeamScheduleCalendar, {
    type TeamCalendarGame,
} from "@/components/schedule/TeamScheduleCalendar";
import scheduleData from "@/data/nhlSchedule.json";
import {
    getCurrentFantasyWeek,
    getWeekDateRange,
    utcDateToDateOnly,
} from "@/utils/fantasyWeeks";
import { abbr } from "@/utils/leagueSchedule";
import { useMemo, useState } from "react";

type DayAbbr =
    | "Mon"
    | "Tue"
    | "Wed"
    | "Thu"
    | "Fri"
    | "Sat"
    | "Sun";

type ScheduleGame = {
    date: string;
    home_team: string;
    away_team: string;
};

type TeamSchedule = {
    team: string;
    schedule: ScheduleGame[];
};

type DayGame = {
    date: string;
    opponent: string;
    location: "vs" | "@" | "";
};

type WeeklyTeamRow = {
    team: string;
    gamesByDay: Record<DayAbbr, DayGame[]>;
    totalGames: number;
};

type SortKey = "team" | "total";
type SortDirection = "asc" | "desc";

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

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const TEAM_FULL_BY_ABBR: Record<string, string> = {
    ANA: "Anaheim Ducks",
    BOS: "Boston Bruins",
    BUF: "Buffalo Sabres",
    CGY: "Calgary Flames",
    CAR: "Carolina Hurricanes",
    CHI: "Chicago Blackhawks",
    COL: "Colorado Avalanche",
    CBJ: "Columbus Blue Jackets",
    DAL: "Dallas Stars",
    DET: "Detroit Red Wings",
    EDM: "Edmonton Oilers",
    FLA: "Florida Panthers",
    LAK: "Los Angeles Kings",
    MIN: "Minnesota Wild",
    MTL: "Montreal Canadiens",
    NSH: "Nashville Predators",
    NJD: "New Jersey Devils",
    NYI: "New York Islanders",
    NYR: "New York Rangers",
    OTT: "Ottawa Senators",
    PHI: "Philadelphia Flyers",
    PIT: "Pittsburgh Penguins",
    SJS: "San Jose Sharks",
    SEA: "Seattle Kraken",
    STL: "St. Louis Blues",
    TBL: "Tampa Bay Lightning",
    TOR: "Toronto Maple Leafs",
    UTA: "Utah Mammoth",
    UTM: "Utah Mammoth",
    VAN: "Vancouver Canucks",
    VGK: "Vegas Golden Knights",
    WSH: "Washington Capitals",
    WPG: "Winnipeg Jets",
};

function createEmptyDayMap(): Record<DayAbbr, DayGame[]> {
    return {
        Mon: [],
        Tue: [],
        Wed: [],
        Thu: [],
        Fri: [],
        Sat: [],
        Sun: [],
    };
}

function createEmptyDayTotals(): Record<DayAbbr, number> {
    return {
        Mon: 0,
        Tue: 0,
        Wed: 0,
        Thu: 0,
        Fri: 0,
        Sat: 0,
        Sun: 0,
    };
}

function createEmptyDaySets(): Record<DayAbbr, Set<string>> {
    return {
        Mon: new Set<string>(),
        Tue: new Set<string>(),
        Wed: new Set<string>(),
        Thu: new Set<string>(),
        Fri: new Set<string>(),
        Sat: new Set<string>(),
        Sun: new Set<string>(),
    };
}

function parseDateToUTC(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
}

function dateToYmdNumber(date: string): number {
    return Number(date.replaceAll("-", ""));
}

function getDayAbbr(date: string): DayAbbr {
    const dayIndex = parseDateToUTC(date).getUTCDay();
    return DAY_BY_UTC_INDEX[dayIndex] ?? "Sun";
}

function formatShortDate(date: Date): string {
    return new Intl.DateTimeFormat("en-CA", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    }).format(date);
}

function getTeamPerspective(
    team: string,
    game: ScheduleGame
): DayGame {
    const homeTeam = abbr(game.home_team);
    const awayTeam = abbr(game.away_team);

    if (homeTeam === team) {
        return {
            date: game.date,
            opponent: awayTeam,
            location: "vs",
        };
    }

    if (awayTeam === team) {
        return {
            date: game.date,
            opponent: homeTeam,
            location: "@",
        };
    }

    return {
        date: game.date,
        opponent: awayTeam,
        location: "",
    };
}

function teamPlaysOnEverySelectedDay(
    gamesByDay: Record<DayAbbr, DayGame[]>,
    selectedDays: DayAbbr[]
): boolean {
    if (selectedDays.length === 0) {
        return true;
    }

    return selectedDays.every(
        (day) => gamesByDay[day].length > 0
    );
}

export default function WeeklyScheduleClient() {
    const [week, setWeek] = useState<number>(() =>
        getCurrentFantasyWeek()
    );

    const [selectedDays, setSelectedDays] = useState<DayAbbr[]>([]);
    const [sortKey, setSortKey] = useState<SortKey>("team");
    const [sortDirection, setSortDirection] =
        useState<SortDirection>("asc");

    const [calendarTeam, setCalendarTeam] =
        useState<string | null>(null);

    const weekDatesByDay = useMemo<
        Record<DayAbbr, string>
    >(() => {
        const { start } = getWeekDateRange(week);

        return DAYS.reduce(
            (dates, day, index) => {
                const date = new Date(
                    start.getTime() + index * ONE_DAY_MS
                );

                dates[day] = formatShortDate(date);
                return dates;
            },
            {} as Record<DayAbbr, string>
        );
    }, [week]);

    const selectedWeekStartYmd = useMemo(() => {
        const { start } = getWeekDateRange(week);
        return dateToYmdNumber(utcDateToDateOnly(start));
    }, [week]);

    const leagueTotalsByDay = useMemo<
        Record<DayAbbr, number>
    >(() => {
        const { start, end } = getWeekDateRange(week);
        const startDate = utcDateToDateOnly(start);
        const endDate = utcDateToDateOnly(end);

        const uniqueGamesByDay = createEmptyDaySets();
        const teams = scheduleData as TeamSchedule[];

        for (const teamBlock of teams) {
            for (const game of teamBlock.schedule) {
                if (
                    game.date < startDate ||
                    game.date > endDate
                ) {
                    continue;
                }

                const homeTeam = abbr(game.home_team);
                const awayTeam = abbr(game.away_team);
                const day = getDayAbbr(game.date);

                const gameKey =
                    `${game.date}|${homeTeam}|${awayTeam}`;

                uniqueGamesByDay[day].add(gameKey);
            }
        }

        const totals = createEmptyDayTotals();

        for (const day of DAYS) {
            totals[day] = uniqueGamesByDay[day].size;
        }

        return totals;
    }, [week]);

    const weeklyTeams = useMemo<WeeklyTeamRow[]>(() => {
        const { start, end } = getWeekDateRange(week);
        const startDate = utcDateToDateOnly(start);
        const endDate = utcDateToDateOnly(end);
        const teams = scheduleData as TeamSchedule[];

        const rows = teams
            .map((teamBlock) => {
                const team = abbr(teamBlock.team);
                const gamesByDay = createEmptyDayMap();

                for (const game of teamBlock.schedule) {
                    if (
                        game.date < startDate ||
                        game.date > endDate
                    ) {
                        continue;
                    }

                    const day = getDayAbbr(game.date);

                    gamesByDay[day].push(
                        getTeamPerspective(team, game)
                    );
                }

                const totalGames = DAYS.reduce(
                    (total, day) =>
                        total + gamesByDay[day].length,
                    0
                );

                return {
                    team,
                    gamesByDay,
                    totalGames,
                };
            })
            .filter((team) =>
                teamPlaysOnEverySelectedDay(
                    team.gamesByDay,
                    selectedDays
                )
            );

        rows.sort((a, b) => {
            const teamNameA =
                TEAM_FULL_BY_ABBR[a.team] ?? a.team;

            const teamNameB =
                TEAM_FULL_BY_ABBR[b.team] ?? b.team;

            if (sortKey === "total") {
                const totalDifference =
                    sortDirection === "desc"
                        ? b.totalGames - a.totalGames
                        : a.totalGames - b.totalGames;

                if (totalDifference !== 0) {
                    return totalDifference;
                }
            }

            return teamNameA.localeCompare(teamNameB);
        });

        return rows;
    }, [
        week,
        selectedDays,
        sortKey,
        sortDirection,
    ]);

    const calendarGames = useMemo<
        TeamCalendarGame[]
    >(() => {
        if (!calendarTeam) {
            return [];
        }

        const teams = scheduleData as TeamSchedule[];

        const teamBlock = teams.find(
            (block) => abbr(block.team) === calendarTeam
        );

        return (teamBlock?.schedule ?? []).flatMap(
            (game) => {
                const perspective = getTeamPerspective(
                    calendarTeam,
                    game
                );

                if (!perspective.location) {
                    return [];
                }

                return [
                    {
                        ymd: dateToYmdNumber(game.date),
                        home: perspective.location === "vs",
                        opp: perspective.opponent,
                    },
                ];
            }
        );
    }, [calendarTeam]);

    function toggleSelectedDay(day: DayAbbr) {
        setSelectedDays((current) =>
            current.includes(day)
                ? current.filter(
                    (selectedDay) => selectedDay !== day
                )
                : [...current, day]
        );
    }

    function sortByTeam() {
        setSortKey("team");
        setSortDirection("asc");
    }

    function sortByTotalGames() {
        if (sortKey === "total") {
            setSortDirection((current) =>
                current === "desc" ? "asc" : "desc"
            );

            return;
        }

        setSortKey("total");
        setSortDirection("desc");
    }

    return (
        <div className="space-y-5">
            <div className="rounded-xl border border-zinc-300 bg-white p-4 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-[minmax(380px,420px)_1fr]">
                    <FantasyWeekPicker
                        week={week}
                        onWeekChange={setWeek}
                    />

                    <div className="min-w-0">
                        <div className="mb-1 flex items-center justify-between gap-3">
                            <span className="block text-sm font-semibold text-slate-800">
                                Filter by Days
                            </span>

                            {selectedDays.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedDays([])}
                                    className="text-xs font-medium text-blue-700 underline-offset-2 hover:underline"
                                >
                                    Clear days
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {DAYS.map((day) => {
                                const isSelected =
                                    selectedDays.includes(day);

                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() =>
                                            toggleSelectedDay(day)
                                        }
                                        className={[
                                            "h-10 min-w-[52px] rounded-md border px-3 text-base font-medium transition-colors",
                                            isSelected
                                                ? "border-amber-500 bg-amber-100 text-amber-950"
                                                : "border-[var(--border)] bg-white text-slate-800 hover:border-[var(--accent)] hover:bg-amber-50",
                                        ].join(" ")}
                                        aria-pressed={isSelected}
                                    >
                                        {day}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600">
                <p>
                    Showing{" "}
                    <span className="font-semibold text-zinc-900">
                        {weeklyTeams.length}
                    </span>{" "}
                    teams
                </p>

                <p>
                    Selected days require a team to play on
                    every selected day.
                </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-300 bg-white shadow-sm">
                <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-sm">
                    <thead>
                        <tr>
                            <th className="sticky left-0 z-30 w-[96px] min-w-[96px] max-w-[96px] border-b border-r border-zinc-300 bg-zinc-100 p-0 text-left">
                                <button
                                    type="button"
                                    onClick={sortByTeam}
                                    className="flex min-h-[88px] w-full items-center px-3 py-3 text-left font-semibold text-zinc-900 transition-colors hover:bg-amber-50 hover:text-amber-800"
                                >
                                    Teams
                                </button>
                            </th>

                            {DAYS.map((day) => {
                                const isSelected =
                                    selectedDays.includes(day);

                                return (
                                    <th
                                        key={day}
                                        className={[
                                            "min-w-[125px] border-b border-r border-zinc-300 px-3 py-3 text-center",
                                            isSelected
                                                ? "bg-amber-100"
                                                : "bg-zinc-100",
                                        ].join(" ")}
                                    >
                                        <div className="font-semibold text-zinc-900">
                                            {day}
                                        </div>

                                        <div className="mt-0.5 text-xs font-normal text-zinc-600">
                                            {weekDatesByDay[day]}
                                        </div>

                                        <div className="mt-1 text-[11px] font-medium text-zinc-500">
                                            {leagueTotalsByDay[day]}{" "}
                                            {leagueTotalsByDay[day] === 1
                                                ? "game"
                                                : "games"}
                                        </div>
                                    </th>
                                );
                            })}

                            <th className="min-w-[115px] border-b border-zinc-300 bg-zinc-100 p-0 text-center">
                                <button
                                    type="button"
                                    onClick={sortByTotalGames}
                                    className="flex min-h-[88px] w-full flex-col items-center justify-center px-3 py-3 font-semibold text-zinc-900 transition-colors hover:bg-amber-50 hover:text-amber-800"
                                >
                                    <span>Total Games</span>

                                    {sortKey === "total" && (
                                        <span className="mt-1 text-[10px] font-medium uppercase text-zinc-500">
                                            {sortDirection === "desc"
                                                ? "High-Low"
                                                : "Low-High"}
                                        </span>
                                    )}
                                </button>
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {weeklyTeams.map((team) => (
                            <tr key={team.team}>
                                <td className="sticky left-0 z-20 w-[96px] min-w-[96px] max-w-[96px] border-b border-r border-zinc-200 bg-white p-0">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCalendarTeam(team.team)
                                        }
                                        className="w-full px-3 py-3 text-left font-bold text-blue-700 underline-offset-2 transition-colors hover:bg-amber-50 hover:underline"
                                        title={`Open ${TEAM_FULL_BY_ABBR[team.team] ??
                                            team.team
                                            } calendar`}
                                    >
                                        {team.team}
                                    </button>
                                </td>

                                {DAYS.map((day) => {
                                    const isSelected =
                                        selectedDays.includes(day);

                                    const games =
                                        team.gamesByDay[day];

                                    return (
                                        <td
                                            key={`${team.team}-${day}`}
                                            className={[
                                                "border-b border-r border-zinc-200 px-2 py-2 align-middle",
                                                isSelected
                                                    ? "bg-amber-50"
                                                    : "bg-white",
                                            ].join(" ")}
                                        >
                                            {games.length === 0 ? (
                                                <div className="text-center text-zinc-400">
                                                    -
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-1">
                                                    {games.map(
                                                        (game, gameIndex) => (
                                                            <span
                                                                key={`${team.team}-${game.date}-${game.opponent}-${gameIndex}`}
                                                                className="inline-flex min-w-[72px] justify-center rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-800"
                                                            >
                                                                {game.location
                                                                    ? `${game.location} `
                                                                    : ""}
                                                                {game.opponent}
                                                            </span>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}

                                <td className="border-b border-zinc-200 bg-white px-3 py-3 text-center text-base font-bold text-zinc-900">
                                    {team.totalGames}
                                </td>
                            </tr>
                        ))}

                        {weeklyTeams.length === 0 && (
                            <tr>
                                <td
                                    colSpan={9}
                                    className="px-4 py-8 text-center text-zinc-600"
                                >
                                    No teams play on every selected day.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {calendarTeam && (
                <TeamScheduleCalendar
                    team={calendarTeam}
                    teamName={
                        TEAM_FULL_BY_ABBR[calendarTeam] ??
                        calendarTeam
                    }
                    games={calendarGames}
                    initialMonthYmd={selectedWeekStartYmd}
                    onClose={() => setCalendarTeam(null)}
                />
            )}
        </div>
    );
}