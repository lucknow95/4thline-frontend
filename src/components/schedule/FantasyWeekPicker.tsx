"use client";

import {
  clampFantasyWeek,
  FANTASY_WEEK_COUNT,
  generateWeekOptions,
} from "@/utils/fantasyWeeks";
import { useId, useMemo } from "react";

type Props = {
  week: number;
  onWeekChange: (week: number) => void;
  label?: string;
  className?: string;
};

export default function FantasyWeekPicker({
  week,
  onWeekChange,
  label = "Select Week",
  className,
}: Props) {
  const selectId = useId();
  const weekOptions = useMemo(() => generateWeekOptions(), []);
  const currentWeek = clampFantasyWeek(week);

  const canGoPrevious = currentWeek > 1;
  const canGoNext = currentWeek < FANTASY_WEEK_COUNT;

  function changeWeek(nextWeek: number) {
    onWeekChange(clampFantasyWeek(nextWeek));
  }

  const arrowClass =
    "h-10 w-9 shrink-0 rounded-md border border-[var(--border)] bg-white px-0 text-lg font-bold text-slate-800 hover:border-[var(--accent)] hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border)] disabled:hover:bg-white sm:w-10";

  return (
    <div
      className={["w-full min-w-0 space-y-1", className]
        .filter(Boolean)
        .join(" ")}
    >
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-semibold text-slate-800"
        >
          {label}
        </label>
      )}

      <div className="flex w-full min-w-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => changeWeek(currentWeek - 1)}
          disabled={!canGoPrevious}
          className={arrowClass}
          aria-label="Go to previous fantasy week"
          title={
            canGoPrevious
              ? `Go to Week ${currentWeek - 1}`
              : "Already at the first fantasy week"
          }
        >
          ←
        </button>

        <select
          id={selectId}
          value={currentWeek}
          onChange={(event) => changeWeek(Number(event.target.value))}
          className="h-10 w-full min-w-0 flex-1 rounded-md border border-[var(--border)] bg-white px-2 pr-7 text-[13px] font-medium text-slate-900 focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-amber-200 sm:px-3 sm:pr-8 sm:text-base"
        >
          {weekOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => changeWeek(currentWeek + 1)}
          disabled={!canGoNext}
          className={arrowClass}
          aria-label="Go to next fantasy week"
          title={
            canGoNext
              ? `Go to Week ${currentWeek + 1}`
              : "Already at the final fantasy week"
          }
        >
          →
        </button>
      </div>
    </div>
  );
}