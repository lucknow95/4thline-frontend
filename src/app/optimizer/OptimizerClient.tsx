// src/app/optimizer/OptimizerClient.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  DateRange,
  Filters,
  TeamBlock,
  TeamWindowSummary,
} from '@/lib/optimizer';
import {
  clampCustomRangeToSeason,
  clampToSeasonWindow,
  numberToUTCDate,
  summarizeAll,
  ymdToNumber,
} from '@/lib/optimizer';

import '@/styles/data-table.css'; // unified table styles

// ──────────────────────────────────────────────────────────────────────────────
// Types & constants
// ──────────────────────────────────────────────────────────────────────────────

type Mode = 'weeks' | 'custom';

type Props = {
  schedule: TeamBlock[];
  seasonStartYmd: number;
  seasonEndYmd: number;
  teamCityByAbbr: Record<string, string>;
};

const ALL_DAYS: Array<{ key: string; label: string; idx: number }> = [
  { key: 'Sun', label: 'Sun', idx: 0 },
  { key: 'Mon', label: 'Mon', idx: 1 },
  { key: 'Tue', label: 'Tue', idx: 2 },
  { key: 'Wed', label: 'Wed', idx: 3 },
  { key: 'Thu', label: 'Thu', idx: 4 },
  { key: 'Fri', label: 'Fri', idx: 5 },
  { key: 'Sat', label: 'Sat', idx: 6 },
];

// Mon, Wed, Fri, Sun (indices)
const OFF_NIGHTS = [1, 3, 5, 0] as const;

// ──────────────────────────────────────────────────────────────────────────────
// Small helpers
// ──────────────────────────────────────────────────────────────────────────────

function yyyyMmDd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function nearestMonday(d = new Date()) {
  const copy = new Date(d);
  const day = copy.getDay(); // 0 Sun, 1 Mon, ...
  const diff = day === 1 ? 0 : day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function ymdToInput(ymd: number): string {
  const dt = numberToUTCDate(ymd);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export default function OptimizerClient({
  schedule,
  seasonStartYmd,
  seasonEndYmd,
  teamCityByAbbr,
}: Props) {
  const router = useRouter();

  // -------- Top filter card state (kept exactly like the last version) --------
  const defaultMonday = yyyyMmDd(nearestMonday());

  const [mode, setMode] = useState<Mode>('weeks');

  // "Weeks" mode inputs
  const [startMonday, setStartMonday] = useState<string>(defaultMonday);
  const [numWeeks, setNumWeeks] = useState<number>(4);

  // "Custom" mode inputs
  const [customStart, setCustomStart] = useState<string>(defaultMonday);
  const [customEnd, setCustomEnd] = useState<string>(
    yyyyMmDd(new Date(new Date(defaultMonday).getTime() + 27 * 86400000))
  );

  // Days & minimum games (UI uses day keys; we translate to indices on Apply)
  const [offNightsOnly, setOffNightsOnly] = useState<boolean>(false);
  const [daysOfWeekKeys, setDaysOfWeekKeys] = useState<string[]>([]);
  const [minGames, setMinGames] = useState<number>(0);

  // -------- Results table state ----------
  const [range, setRange] = useState<DateRange>(() =>
    clampToSeasonWindow(ymdToNumber(defaultMonday), 4, seasonStartYmd, seasonEndYmd)
  );
  const [rows, setRows] = useState<TeamWindowSummary[]>([]);

  // Remember user's manual day selections when toggling Off-nights on/off
  const prevDaysRef = useRef<string[]>([]);

  // Compute once on mount so page isn't empty before first Apply
  useEffect(() => {
    handleApply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Actions
  // ───────────────────────────────────────────────────────────────────────────

  function toggleDayKey(key: string) {
    setDaysOfWeekKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  const OFF_NIGHTS = new Set<number>([1, 3, 5, 0]);

  function onToggleOffNights() {
    setOffNightsOnly((on) => {
      if (!on) {
        // Turning ON → store current custom days and replace with OFF_NIGHTS set
        prevDaysRef.current = daysOfWeekKeys;
        setDaysOfWeekKeys(
          ALL_DAYS.filter((d) => OFF_NIGHTS.has(d.idx)).map((d) => d.key)
        );
      } else {
        // Turning OFF → restore prior manual selection (if any)
        setDaysOfWeekKeys(
          prevDaysRef.current.length ? prevDaysRef.current : []
        );
      }
      return !on;
    });
  }

  function handleApply() {
    // Resolve the selected date window
    let resolved: DateRange;
    if (mode === 'weeks') {
      const startY = ymdToNumber(startMonday);
      const safeStart = Number.isNaN(startY) ? seasonStartYmd : startY;
      const safeWeeks = Math.min(Math.max(1, numWeeks), 52);
      resolved = clampToSeasonWindow(safeStart, safeWeeks, seasonStartYmd, seasonEndYmd);
      // Keep custom inputs in sync with resolved (for URL + consistency)
      setCustomStart(ymdToInput(resolved.startYmd));
      setCustomEnd(ymdToInput(resolved.endYmd));
    } else {
      const s = ymdToNumber(customStart);
      const e = ymdToNumber(customEnd);
      const safeStart = Number.isNaN(s) ? seasonStartYmd : s;
      const safeEnd = Number.isNaN(e) ? seasonEndYmd : e;
      resolved = clampCustomRangeToSeason(safeStart, safeEnd, seasonStartYmd, seasonEndYmd);
    }

    // Translate UI days to indices; respect off-nights override
    const dayIdxs =
      offNightsOnly
        ? [...OFF_NIGHTS]
        : daysOfWeekKeys
          .map((k) => ALL_DAYS.find((d) => d.key === k)?.idx)
          .filter((n): n is number => typeof n === 'number')
          .sort((a, b) => a - b);

    const filters: Filters = {
      includeHome: true, // venues removed
      includeAway: true, // venues removed
      offNightsOnly,
      daysOfWeek: dayIdxs,
      minGames,
    };

    const computed = summarizeAll(schedule, resolved, filters);
    setRange(resolved);
    setRows(computed);

    // Optional: keep URL in sync (compact, no query param explosion)
    const params = new URLSearchParams();
    params.set('mode', mode);
    if (mode === 'weeks') {
      params.set('start', ymdToInput(resolved.startYmd));
      params.set('weeks', String(numWeeks));
    } else {
      params.set('start', ymdToInput(resolved.startYmd));
      params.set('end', ymdToInput(resolved.endYmd));
    }
    params.set('off', offNightsOnly ? '1' : '0');
    if (dayIdxs.length && !offNightsOnly) params.set('days', dayIdxs.join(','));
    params.set('min', String(minGames));
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function handleClear() {
    setMode('weeks');
    const defMon = yyyyMmDd(nearestMonday());
    setStartMonday(defMon);
    setNumWeeks(4);
    setCustomStart(defMon);
    setCustomEnd(yyyyMmDd(new Date(new Date(defMon).getTime() + 27 * 86400000)));
    setOffNightsOnly(false);
    setDaysOfWeekKeys([]);
    setMinGames(0);
    // Recompute with defaults
    setTimeout(() => handleApply(), 0);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Derived UI labels
  // ───────────────────────────────────────────────────────────────────────────

  const unitWindow = useMemo(() => {
    const s = numberToUTCDate(range.startYmd);
    const e = numberToUTCDate(range.endYmd);
    const fmt = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
        d.getUTCDate()
      ).padStart(2, '0')}`;
    const days =
      Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return { label: `${fmt(s)} → ${fmt(e)} (${Math.max(1, days)} days)` };
  }, [range]);

  // Heat band for “Games (Total)”
  const maxGames = rows.reduce((m, r) => Math.max(m, r.gamesTotal), 0) || 1;
  function bandStyle(val: number) {
    const f = val / maxGames; // 0..1
    const hue = 120;
    const sat = 55;
    const light = 96 - Math.round(f * 26); // 96% → 70%
    return { backgroundColor: `hsl(${hue} ${sat}% ${light}%)` };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-4">
      {/* Top controls: 2-card layout (UNCHANGED) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* MODE CARD */}
        <section className="rounded-2xl border border-zinc-300 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-xl font-semibold">Mode</h2>

          <div className="flex flex-col gap-4">
            {/* Mode toggles */}
            <div className="flex items-center gap-6">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  className="h-4 w-4"
                  checked={mode === 'weeks'}
                  onChange={() => setMode('weeks')}
                />
                <span>Weeks</span>
              </label>

              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  className="h-4 w-4"
                  checked={mode === 'custom'}
                  onChange={() => setMode('custom')}
                />
                <span>Custom dates</span>
              </label>
            </div>

            {/* Weeks mode inputs */}
            {mode === 'weeks' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col">
                  <label className="mb-1 text-sm text-zinc-600">
                    Start (Monday)
                  </label>
                  <input
                    type="date"
                    value={startMonday}
                    onChange={(e) => setStartMonday(e.target.value)}
                    className="rounded-md border p-2"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-1 text-sm text-zinc-600"># of weeks</label>
                  <select
                    value={numWeeks}
                    onChange={(e) => setNumWeeks(Number(e.target.value))}
                    className="rounded-md border p-2"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Custom mode inputs */}
            {mode === 'custom' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col">
                  <label className="mb-1 text-sm text-zinc-600">Start date</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="rounded-md border p-2"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-1 text-sm text-zinc-600">End date</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="rounded-md border p-2"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* DAYS & MINIMUM GAMES CARD */}
        <section className="relative rounded-2xl border border-zinc-300 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <h2 className="text-xl font-semibold">Days & Minimum Games</h2>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleApply}
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Apply Filters
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-md border border-zinc-300 px-4 py-2 hover:bg-zinc-50"
              >
                Clear Filters
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Off-nights only */}
            <div className="flex items-center gap-2">
              <input
                id="offnights"
                type="checkbox"
                checked={offNightsOnly}
                onChange={onToggleOffNights}
                className="h-4 w-4"
              />
              <label htmlFor="offnights">Off-nights only</label>
            </div>

            {/* Days-of-week */}
            <div className="md:col-span-2">
              <div className="mb-2 text-sm text-zinc-600">Days of week</div>
              <div className="flex flex-wrap gap-2">
                {ALL_DAYS.map((d) => {
                  const active = daysOfWeekKeys.includes(d.key);
                  const disabled = offNightsOnly;
                  return (
                    <button
                      type="button"
                      key={d.key}
                      onClick={() => !disabled && toggleDayKey(d.key)}
                      className={[
                        'rounded-md border px-3 py-1 text-sm',
                        disabled
                          ? 'opacity-50 cursor-not-allowed border-zinc-300'
                          : active
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-zinc-300 hover:bg-zinc-50',
                      ].join(' ')}
                      aria-pressed={active}
                      title={disabled ? 'Disabled when Off-nights only is on' : ''}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Min games */}
            <div className="flex flex-col">
              <label className="mb-1 text-sm text-zinc-600">Min games ≥</label>
              <input
                type="number"
                min={0}
                value={minGames}
                onChange={(e) => setMinGames(Math.max(0, Number(e.target.value)))}
                className="w-28 rounded-md border p-2"
              />
            </div>
          </div>
        </section>
      </div>

      {/* RESULTS TABLE (restored) */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="data-table table-fixed border-separate border-spacing-0">
          <thead>
            <tr>
              <th>Team</th>
              <th>City</th>
              <th>Games (Total)</th>
              <th>Off-Night</th>
              <th>Heavy</th>
              <th>B2B</th>
              <th>Home</th>
              <th>Away</th>
              <th>Per-Week</th>
              <th>Weekly Strip (games per week)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const mismatch =
                r.offNightGames + r.heavyNightGames > r.gamesTotal;
              return (
                <tr key={r.team}>
                  <td className="font-medium">{r.team}</td>
                  <td>{teamCityByAbbr[r.team] || ''}</td>

                  {/* High-contrast banded cell */}
                  <td
                    className="font-semibold text-zinc-900"
                    style={bandStyle(r.gamesTotal)}
                    title="Total games in the selected window"
                  >
                    {r.gamesTotal}
                  </td>

                  <td>
                    {r.offNightGames}
                    {mismatch && (
                      <span
                        className="ml-2 text-amber-700"
                        title="Off-night + heavy exceed total (likely a calc rule to fix in Optimizer.ts)"
                      >
                        ⚠
                      </span>
                    )}
                  </td>
                  <td>{r.heavyNightGames}</td>
                  <td>{r.b2bCount}</td>
                  <td>{r.home}</td>
                  <td>{r.away}</td>
                  <td>{r.perWeek.join(' | ')}</td>
                  <td>
                    <MiniStrip perWeek={r.perWeek} />
                  </td>
                </tr>
              );
            })}

            {!rows.length && (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-6 text-center text-sm text-gray-500"
                >
                  No games match the selected window/filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Window summary (optional, as in your prior table card) */}
      <div className="text-xs text-gray-600">
        Window: <span className="font-medium">{unitWindow.label}</span>
      </div>
    </div>
  );
}

// Mini strip chart for per-week counts
function MiniStrip({ perWeek }: { perWeek: number[] }) {
  const max = Math.max(...perWeek, 1);
  return (
    <div className="flex gap-1" title="Games per week across the selected window">
      {perWeek.map((v, i) => {
        const h = 10 + Math.round((v / max) * 18);
        return (
          <div
            key={i}
            className="w-2 rounded"
            style={{
              height: `${h}px`,
              backgroundColor: 'hsl(210 60% 75%)',
            }}
            title={`Week ${i + 1}: ${v} game${v === 1 ? '' : 's'}`}
          />
        );
      })}
    </div>
  );
}
