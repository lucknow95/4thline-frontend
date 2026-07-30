"use client";

import { useEffect, useState } from "react";

export type TeamCalendarGame = {
  ymd: number;
  home: boolean;
  opp: string;
};

type Props = {
  team: string;
  teamName: string;
  games: TeamCalendarGame[];
  initialMonthYmd: number;
  onClose: () => void;
};

const CALENDAR_DAYS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

function numberToUTCDate(ymd: number): Date {
  const year = Math.floor(ymd / 10000);
  const month = Math.floor((ymd % 10000) / 100);
  const day = ymd % 100;

  return new Date(Date.UTC(year, month - 1, day));
}

function ymdToMonthDate(ymd: number): Date {
  const date = numberToUTCDate(ymd);

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      1
    )
  );
}

function dateToYmdNumber(date: Date): number {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return Number(`${year}${month}${day}`);
}

function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function moveMonth(date: Date, amount: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + amount,
      1
    )
  );
}

function getCalendarCells(monthDate: Date): Array<Date | null> {
  const year = monthDate.getUTCFullYear();
  const month = monthDate.getUTCMonth();

  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const lastOfMonth = new Date(Date.UTC(year, month + 1, 0));

  const leadingBlankCount =
    (firstOfMonth.getUTCDay() + 6) % 7;

  const daysInMonth = lastOfMonth.getUTCDate();
  const cells: Array<Date | null> = [];

  for (let index = 0; index < leadingBlankCount; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(Date.UTC(year, month, day)));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export default function TeamScheduleCalendar({
  team,
  teamName,
  games,
  initialMonthYmd,
  onClose,
}: Props) {
  const [monthDate, setMonthDate] = useState<Date>(() =>
    ymdToMonthDate(initialMonthYmd)
  );

  useEffect(() => {
    setMonthDate(ymdToMonthDate(initialMonthYmd));
  }, [initialMonthYmd, team]);

  const cells = getCalendarCells(monthDate);
  const gamesByYmd = new Map<number, TeamCalendarGame[]>();

  for (const game of games) {
    const existing = gamesByYmd.get(game.ymd) ?? [];
    existing.push(game);
    gamesByYmd.set(game.ymd, existing);
  }

  const buttonClass =
    "rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${teamName} schedule calendar`}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">{teamName}</h2>

            <p className="text-sm text-zinc-600">
              Click through months to review upcoming schedule fit.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={buttonClass}
          >
            Close
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              setMonthDate((current) =>
                moveMonth(current, -1)
              )
            }
            className={buttonClass}
          >
            Previous
          </button>

          <div className="text-center text-xl font-semibold">
            {formatMonthYear(monthDate)}
          </div>

          <button
            type="button"
            onClick={() =>
              setMonthDate((current) =>
                moveMonth(current, 1)
              )
            }
            className={buttonClass}
          >
            Next
          </button>
        </div>

        <div className="mb-3 flex items-center justify-center gap-5 text-sm font-medium text-zinc-700">
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded bg-[#00b050]" />
            <span>Home</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded bg-red-600" />
            <span>Away</span>
          </div>
        </div>

        <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-zinc-300">
          {CALENDAR_DAYS.map((day) => (
            <div
              key={day}
              className="border-b border-r border-zinc-200 bg-zinc-100 px-2 py-2 text-center text-xs font-bold text-zinc-700 last:border-r-0"
            >
              {day}
            </div>
          ))}

          {cells.map((cell, index) => {
            if (!cell) {
              return (
                <div
                  key={`blank-${index}`}
                  className="min-h-20 border-b border-r border-zinc-200 bg-zinc-50 p-2 last:border-r-0"
                />
              );
            }

            const ymd = dateToYmdNumber(cell);
            const dayGames = gamesByYmd.get(ymd) ?? [];
            const firstGame = dayGames[0];
            const hasGame = dayGames.length > 0;

            return (
              <div
                key={ymd}
                className={[
                  "min-h-20 border-b border-r border-zinc-200 p-2 last:border-r-0",
                  hasGame && firstGame?.home
                    ? "bg-green-50"
                    : hasGame
                      ? "bg-red-50"
                      : "bg-white",
                ].join(" ")}
              >
                <div
                  className={[
                    "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold",
                    hasGame && firstGame?.home
                      ? "bg-[#00b050] text-white"
                      : hasGame
                        ? "bg-red-600 text-white"
                        : "text-zinc-700",
                  ].join(" ")}
                >
                  {cell.getUTCDate()}
                </div>

                <div className="space-y-1">
                  {dayGames.map((game, gameIndex) => (
                    <div
                      key={`${game.ymd}-${game.opp}-${gameIndex}`}
                      className={[
                        "rounded-md px-2 py-1 text-xs font-semibold text-white",
                        game.home
                          ? "bg-[#00b050]"
                          : "bg-red-600",
                      ].join(" ")}
                      title={
                        game.home
                          ? `Home vs ${game.opp}`
                          : `Away at ${game.opp}`
                      }
                    >
                      {game.home ? "vs" : "@"} {game.opp}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
