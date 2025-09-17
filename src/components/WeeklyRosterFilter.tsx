// src/components/WeeklyRosterFilter.tsx
"use client";

import type { DayAbbr } from "@/types/hockey";
import { useCallback, useMemo } from "react";

interface WeekOption {
  value: number;
  label: string;
}

type Props = {
  value: {
    selectedDays: DayAbbr[];
    week: number;
  };
  onChange: (next: { selectedDays: DayAbbr[]; week: number }) => void;
  weekOptions: WeekOption[];
};

export default function WeeklyRosterFilter({ value, onChange, weekOptions }: Props) {
  const { selectedDays, week } = value;

  // Canonical Mon→Sun order (matches DayAbbr)
  const daysOfWeek = useMemo(
    () => (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const) satisfies readonly DayAbbr[],
    []
  );

  // Quick-select off-nights
  const OFF_NIGHTS = useMemo(
    () => (["Mon", "Wed", "Fri", "Sun"] as const) satisfies readonly DayAbbr[],
    []
  );

  // Week 1 starts Monday Oct 6, 2025 (local date for display only)
  const WEEK1_START = useMemo(() => new Date("2025-10-06T00:00:00"), []);
  const addDays = useCallback((d: Date, days: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x;
  }, []);
  const fmt = useCallback(
    (d: Date) => {
      // Show "Oct 6" or "Jan 2, 2026" if year differs from WEEK1_START
      const includeYear = d.getFullYear() !== WEEK1_START.getFullYear();
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        ...(includeYear ? { year: "numeric" as const } : {}),
      });
    },
    [WEEK1_START]
  );

  const { weekStart, weekEnd, weekLabel } = useMemo(() => {
    const start = addDays(WEEK1_START, (week - 1) * 7);
    const end = addDays(start, 6);
    const sameYear = start.getFullYear() === end.getFullYear();
    const label = sameYear
      ? `${start.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })}–${end.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })}, ${start.getFullYear()}`
      : `${fmt(start)}–${fmt(end)}`;
    return { weekStart: start, weekEnd: end, weekLabel: label };
  }, [WEEK1_START, addDays, fmt, week]);

  const handleCheckboxChange = useCallback(
    (day: DayAbbr) => {
      if (selectedDays.includes(day)) {
        onChange({ ...value, selectedDays: selectedDays.filter((d) => d !== day) });
      } else {
        const next = [...selectedDays, day];
        // Keep UI order consistent (Mon→Sun)
        const ordered = (daysOfWeek as readonly DayAbbr[]).filter((d) => next.includes(d));
        onChange({ ...value, selectedDays: ordered });
      }
    },
    [daysOfWeek, onChange, selectedDays, value]
  );

  const handleClear = useCallback(() => {
    onChange({ ...value, selectedDays: [] });
  }, [onChange, value]);

  const handleOffNights = useCallback(() => {
    onChange({ ...value, selectedDays: [...OFF_NIGHTS] });
  }, [OFF_NIGHTS, onChange, value]);

  const handleWeekChange = (newWeek: number) => {
    onChange({ ...value, week: newWeek });
  };

  return (
    <section
      className="flex flex-col gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--surface-contrast)] shadow-sm"
      aria-labelledby="weekly-roster-filter-title"
    >
      <div className="flex flex-wrap items-center gap-4">
        <span id="weekly-roster-filter-title" className="font-semibold">
          Select Fantasy Week:
        </span>

        <div className="flex items-center gap-3">
          <select
            value={week}
            onChange={(e) => handleWeekChange(Number(e.target.value))}
            className="rounded px-2 py-1 text-sm border border-[var(--border)] bg-[var(--surface)] text-[var(--surface-contrast)]"
            aria-label="Fantasy week"
          >
            {weekOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Week date range label */}
          <span
            className="text-xs text-[var(--muted)]"
            aria-live="polite"
            title={`${weekStart.toDateString()} – ${weekEnd.toDateString()}`}
          >
            {weekLabel}
          </span>
        </div>

        <div className="flex gap-3 flex-wrap" role="group" aria-label="Days of week">
          {daysOfWeek.map((day) => (
            <label key={day} className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                checked={selectedDays.includes(day)}
                onChange={() => handleCheckboxChange(day)}
                aria-checked={selectedDays.includes(day)}
                aria-label={day}
              />
              <span>{day}</span>
            </label>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={handleOffNights}
            className="px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--hover)] transition"
            title="Quick select Mon / Wed / Fri / Sun"
          >
            Off-nights (Mon/Wed/Fri/Sun)
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--hover)] transition"
            title="Clear all selected days"
          >
            Clear
          </button>
        </div>
      </div>

      <p className="text-xs text-[var(--muted)]">
        Tip: The player list updates only when you click <span className="font-medium">Apply Filters</span> above.
      </p>
    </section>
  );
}
