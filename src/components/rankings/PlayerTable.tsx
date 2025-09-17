// src/components/rankings/PlayerTable.tsx
"use client";

import type { Player, SkaterStatKeys, SortKey } from "@/types/hockey";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/* ---------------- top scrollbar wrapper ---------------- */
function TopScrollSync({
  children,
  trackHeight = 12,
}: {
  children: React.ReactNode;
  trackHeight?: number;
}) {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const syncing = useRef<"top" | "bottom" | null>(null);

  // measure table width
  useLayoutEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const measure = () => setContentWidth(el.scrollWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // keep scroll positions in sync
  useEffect(() => {
    const top = topRef.current;
    const bottom = bottomRef.current;
    if (!top || !bottom) return;

    const onTop = () => {
      if (syncing.current === "bottom") return;
      syncing.current = "top";
      bottom.scrollLeft = top.scrollLeft;
      syncing.current = null;
    };
    const onBottom = () => {
      if (syncing.current === "top") return;
      syncing.current = "bottom";
      top.scrollLeft = bottom.scrollLeft;
      syncing.current = null;
    };

    top.addEventListener("scroll", onTop, { passive: true });
    bottom.addEventListener("scroll", onBottom, { passive: true });

    return () => {
      top.removeEventListener("scroll", onTop);
      bottom.removeEventListener("scroll", onBottom);
    };
  }, []);

  return (
    <div className="w-full">
      {/* sticky top scrollbar */}
      <div
        ref={topRef}
        className="sticky top-0 z-10 overflow-x-auto bg-[var(--surface-muted)] border border-[var(--border)] border-b-0 rounded-t-2xl [scrollbar-width:thin]"
        style={{ height: trackHeight }}
        aria-hidden="true"
      >
        <div style={{ width: contentWidth, height: trackHeight }} />
      </div>

      {/* original scroll container (kept styles) */}
      <div ref={bottomRef} className="w-full overflow-x-auto rounded-2xl shadow ring-1 ring-zinc-200">
        {children}
      </div>
    </div>
  );
}

/* ---------------- existing table component ---------------- */

type Props = {
  players?: Player[]; // tolerate undefined
  perGameMode: boolean;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey, dir: "asc" | "desc") => void;
  currentWeek: number; // <-- make sure RankingsClient passes this!
};

const STAT_COLS: SkaterStatKeys[] = ["G", "A", "PIM", "PPP", "SHP", "SOG", "FW", "HIT", "BLK"];
const MON_TO_SUN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type DayAbbr = (typeof MON_TO_SUN)[number];

// --- Type guard to satisfy TS when checking a string vs the union ---
function isDayAbbrStr(s: unknown): s is DayAbbr {
  return typeof s === "string" && (MON_TO_SUN as readonly string[]).includes(s);
}

/* ---------------- week math (same anchor as RankingsClient) ---------------- */
const WEEK1_MON_UTC = Date.UTC(2025, 9, 6); // 2025-10-06 (Mon), month is 0-based
const MS_DAY = 24 * 60 * 60 * 1000;
function clampWeek(w: any): number {
  const n = Number(w);
  if (!Number.isFinite(n)) return 1;
  if (n < 1) return 1;
  if (n > 27) return 27;
  return Math.floor(n);
}
function weekMonToSunUTC(week: number) {
  const w = clampWeek(week);
  const start = WEEK1_MON_UTC + (w - 1) * 7 * MS_DAY;
  const end = start + 7 * MS_DAY; // end-exclusive
  return { start, end };
}
function weekSunToSatUTC(week: number) {
  const w = clampWeek(week);
  const start = WEEK1_MON_UTC - MS_DAY + (w - 1) * 7 * MS_DAY;
  const end = start + 7 * MS_DAY; // end-exclusive
  return { start, end };
}
function parseFlexibleDateToUTC(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const iso = input.trim();
  if (!iso) return null;

  // "YYYY-MM-DD"
  const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return Date.UTC(Number(y), Number(mo) - 1, Number(d));
  }
  // ISO with time
  const m2 = iso.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s]\d{2}:\d{2}(:\d{2})?([Zz]|[+\-]\d{2}:?\d{2})?$/
  );
  if (m2) {
    const [, y, mo, d] = m2;
    return Date.UTC(Number(y), Number(mo) - 1, Number(d));
  }
  const t = Date.parse(iso);
  if (Number.isFinite(t)) {
    const d = new Date(t);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  return null;
}

/* ---------------- GTW computation on the row ---------------- */
function countInWindowFromDates(dates: unknown[], start: number, end: number): number {
  let n = 0;
  for (const raw of dates) {
    const t = parseFlexibleDateToUTC(raw);
    if (t == null) continue;
    if (t >= start && t < end) n++;
  }
  return n;
}
function countGamesFromStringArray(dates: string[], week: number): number {
  const { start: ms, end: me } = weekMonToSunUTC(week);
  let n = countInWindowFromDates(dates, ms, me);
  if (n === 0) {
    const { start: ss, end: se } = weekSunToSatUTC(week);
    n = countInWindowFromDates(dates, ss, se);
  }
  return n;
}
function countGamesFromRawItems(items: Array<{ date: string }>, week: number): number {
  return countGamesFromStringArray(items.map((g) => g.date), week);
}

/** Prefer numeric gamesThisWeek; else derive from schedule in whatever shape it is. */
function computeGTWFromRow(p: Player, week: number): number {
  const any = p as any;

  // 1) numeric
  const n = any?.gamesThisWeek;
  if (typeof n === "number" && Number.isFinite(n)) return n;

  // 2) schedule present?
  const sched = any?.schedule;
  if (Array.isArray(sched) && sched.length > 0) {
    const first = sched[0];

    // DayAbbr[] (Mon, Tue, ...)
    if (isDayAbbrStr(first)) {
      return (sched as string[]).length;
    }

    // string[] of dates
    if (typeof first === "string") {
      return countGamesFromStringArray(sched as string[], week);
    }

    // Raw items with {date}
    if (first && typeof first === "object" && typeof (first as any).date === "string") {
      return countGamesFromRawItems(sched as Array<{ date: string }>, week);
    }
  }

  // 3) common alternates
  const flatDates = any?.gameDates ?? any?.games ?? any?.dates;
  if (Array.isArray(flatDates) && flatDates.length > 0) {
    const first = flatDates[0];
    if (typeof first === "string") return countGamesFromStringArray(flatDates as string[], week);
    if (first && typeof first === "object" && typeof (first as any).date === "string") {
      return countGamesFromRawItems(flatDates as Array<{ date: string }>, week);
    }
  }

  return 0;
}

/* ---------------- other helpers ---------------- */
function getStatSum(p: Player, keys: SkaterStatKeys[], perGame: boolean): number {
  const src = perGame ? p.perGame : p.totals;
  return keys.reduce((acc, k) => acc + (src?.[k] ?? 0), 0);
}
const sumHB = (p: Player, perGame: boolean) => getStatSum(p, ["HIT", "BLK"], perGame);
const sumHSOG = (p: Player, perGame: boolean) => getStatSum(p, ["HIT", "SOG"], perGame);
const sumSOGBLK = (p: Player, perGame: boolean) => getStatSum(p, ["SOG", "BLK"], perGame);
const sumHSOGBLK = (p: Player, perGame: boolean) =>
  getStatSum(p, ["HIT", "SOG", "BLK"], perGame);

function fmt(val: number, perGame: boolean) {
  return perGame ? val.toFixed(2) : val;
}

function rowKey(p: Player, i: number): string {
  const base = p.id != null ? String(p.id) : "row";
  return `${base}-${p.team ?? "NA"}-${i}`;
}

// ---------- sort helpers for headers ----------
function normalizeKeyStr(k: string) {
  return k.toUpperCase().replace(/\s+/g, "").replace(/\+/g, "");
}

export default function PlayerTable({
  players = [],
  perGameMode,
  sortKey,
  sortDir,
  onSort,
  currentWeek,
}: Props) {
  const currentKey = (sortKey as unknown as string) ?? "";
  const isActiveKey = (k: string) => normalizeKeyStr(currentKey) === normalizeKeyStr(k);

  // Accept any key string (including combo keys), handle toggle
  const clickSortAny = (k: string) => {
    const dir = isActiveKey(k) && sortDir === "desc" ? "asc" : "desc";
    onSort(k as unknown as SortKey, dir);
  };

  // ---- Debug the first row so we can see why GTW is 0
  const p0 = players.at(0);
  if (typeof window !== "undefined" && p0) {
    const anyP0: any = p0;
    const sched = anyP0?.schedule;
    const gtw = computeGTWFromRow(p0, currentWeek);
    const sample = Array.isArray(sched) ? (sched.length > 5 ? sched.slice(0, 5) : sched) : sched;
    console.log("[PlayerTable GTW debug]", {
      currentWeek,
      firstPlayer: anyP0?.name,
      scheduleType: Array.isArray(sched) ? typeof sched[0] : typeof sched,
      scheduleSample: sample,
      precomputedGTW: anyP0?.gamesThisWeek,
      computedGTW: gtw,
    });
  }

  return (
    <TopScrollSync>
      {/* ensure horizontal scroll is available */}
      <table className="rankings-table min-w-[1800px] table-fixed border-separate border-spacing-0">
        <thead>
          <tr className="whitespace-nowrap">
            <Th onClick={() => clickSortAny("name")} active={isActiveKey("name")} dir={sortDir}>
              Name
            </Th>
            <Th onClick={() => clickSortAny("team")} active={isActiveKey("team")} dir={sortDir}>
              Team
            </Th>
            <th className="px-3 py-2 text-left">Pos</th>

            {STAT_COLS.map((k) => (
              <Th key={k} onClick={() => clickSortAny(k)} active={isActiveKey(k)} dir={sortDir}>
                {k}
              </Th>
            ))}

            {/* combo columns (sortable) */}
            <Th
              onClick={() => clickSortAny("H+B")}
              active={isActiveKey("H+B") || isActiveKey("HB")}
              dir={sortDir}
            >
              <span title="Hits + Blocks">H+B</span>
            </Th>
            <Th
              onClick={() => clickSortAny("H+SOG")}
              active={isActiveKey("H+SOG") || isActiveKey("HSOG")}
              dir={sortDir}
            >
              <span title="Hits + Shots on Goal">H+SOG</span>
            </Th>
            <Th
              onClick={() => clickSortAny("SOG+BLK")}
              active={isActiveKey("SOG+BLK") || isActiveKey("SOGBLK")}
              dir={sortDir}
            >
              <span title="Shots on Goal + Blocks">SOG+BLK</span>
            </Th>
            <Th
              onClick={() => clickSortAny("H+SOG+BLK")}
              active={isActiveKey("H+SOG+BLK") || isActiveKey("HSOGBLK")}
              dir={sortDir}
            >
              <span title="Hits + Shots on Goal + Blocks">H+SOG+BLK</span>
            </Th>

            <Th
              onClick={() => clickSortAny("gamesThisWeek")}
              active={isActiveKey("gamesThisWeek")}
              dir={sortDir}
            >
              <span title="Games This Week">GTW</span>
            </Th>
          </tr>
        </thead>

        <tbody>
          {players.length === 0 ? (
            <tr>
              <td
                colSpan={3 + STAT_COLS.length + 4 /* combos */ + 1 /* GTW */}
                className="px-4 py-6 text-center text-zinc-600"
              >
                No players to display.
              </td>
            </tr>
          ) : (
            players.map((p, i) => (
              <tr key={rowKey(p, i)}>
                <td className="px-3 py-2">
                  <Link href={`/players/${p.id}`} className="text-blue-700 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono">{p.team}</td>
                <td className="px-3 py-2">{p.position}</td>

                {STAT_COLS.map((k) => (
                  <td key={k} className="px-3 py-2">
                    {formatStat(p, k, perGameMode)}
                  </td>
                ))}

                <td className="px-3 py-2">{fmt(sumHB(p, perGameMode), perGameMode)}</td>
                <td className="px-3 py-2">{fmt(sumHSOG(p, perGameMode), perGameMode)}</td>
                <td className="px-3 py-2">{fmt(sumSOGBLK(p, perGameMode), perGameMode)}</td>
                <td className="px-3 py-2">{fmt(sumHSOGBLK(p, perGameMode), perGameMode)}</td>

                {/* GTW computed per-row with multiple fallbacks */}
                <td className="px-3 py-2 text-center">{computeGTWFromRow(p, currentWeek)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TopScrollSync>
  );
}

function formatStat(p: Player, k: SkaterStatKeys, perGame: boolean) {
  const total = p.totals?.[k] ?? 0;
  const avg = p.perGame?.[k] ?? 0;
  return perGame ? avg.toFixed(2) : total;
}

function Th({
  children,
  onClick,
  active,
  dir,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  dir?: "asc" | "desc";
}) {
  return (
    <th
      className={`px-3 py-2 text-left ${onClick ? "cursor-pointer select-none" : ""}`}
      onClick={onClick}
      title={active ? (dir === "desc" ? "Sorted ↓" : "Sorted ↑") : undefined}
    >
      {children}
      {active ? (dir === "desc" ? " ↓" : " ↑") : null}
    </th>
  );
}
