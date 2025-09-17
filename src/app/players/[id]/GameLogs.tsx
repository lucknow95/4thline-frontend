// src/app/players/[id]/GameLogs.tsx
"use client";

import TopScrollSync from "@/components/ui/TopScrollSync";
import { useEffect, useMemo, useState } from "react";

/** Local type that tolerates different key casings in your data */
export type GameLog = {
  date: string; // "YYYY-MM-DD"
  home_team: string;
  away_team: string;
  // Stats (support both UPPER and lower keys via accessors below)
  G?: number; A?: number; SOG?: number; HIT?: number; BLK?: number; PIM?: number; PPP?: number; SHP?: number;
  g?: number; a?: number; sog?: number; hit?: number; blk?: number; pim?: number; ppp?: number; shp?: number;
};

type ColumnKey = "date" | "opp" | "ha" | "G" | "A" | "SOG" | "HIT" | "BLK" | "PIM" | "PPP" | "SHP";
type SortDir = "asc" | "desc";

const COLUMNS: ReadonlyArray<{ key: ColumnKey; label: string }> = [
  { key: "date", label: "Date" },
  { key: "opp", label: "Opp" },
  { key: "ha", label: "H/A" },
  { key: "G", label: "G" },
  { key: "A", label: "A" },
  { key: "SOG", label: "SOG" },
  { key: "HIT", label: "HIT" },
  { key: "BLK", label: "BLK" },
  { key: "PIM", label: "PIM" },
  { key: "PPP", label: "PPP" },
  { key: "SHP", label: "SHP" },
] as const;

type Props = {
  /** Player's team (full name or abbr, but must match your logs' home/away fields) */
  team: string;
  /** Per-game logs for the player */
  logs: GameLog[];
  /** Rows per page */
  pageSize?: number; // default 10
  /** Provided by parent to keep abbreviation normalization consistent site-wide */
  normalizeAbbr: (name?: string) => string;
};

function getStatVal(
  gl: GameLog,
  key: Exclude<ColumnKey, "date" | "opp" | "ha">
): number {
  // Support both UPPER and lower variants
  const map: Record<string, number | undefined> = {
    G: gl.G ?? gl.g,
    A: gl.A ?? gl.a,
    SOG: gl.SOG ?? gl.sog,
    HIT: gl.HIT ?? gl.hit,
    BLK: gl.BLK ?? gl.blk,
    PIM: gl.PIM ?? gl.pim,
    PPP: gl.PPP ?? gl.ppp,
    SHP: gl.SHP ?? gl.shp,
  };
  const v = map[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function getOpponent(gl: GameLog, playerTeam: string): { opp: string; ha: "H" | "A" } {
  const isHome = gl.home_team === playerTeam;
  const oppRaw = isHome ? gl.away_team : gl.home_team;
  return { opp: oppRaw, ha: isHome ? "H" : "A" };
}

function fmtDate(isoDate: string): string {
  // Show nice short format, fallback to raw if invalid
  const t = new Date(isoDate).getTime();
  if (Number.isNaN(t)) return isoDate;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function GameLogs({ team, logs, pageSize = 10, normalizeAbbr }: Props) {
  const [sortKey, setSortKey] = useState<ColumnKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever sort changes or logs change
  useEffect(() => {
    setPage(1);
  }, [sortKey, sortDir, logs]);

  const sorted = useMemo(() => {
    const arr = [...logs];
    arr.sort((a, b) => {
      let av: number | string;
      let bv: number | string;

      if (sortKey === "date") {
        av = new Date(a.date).getTime();
        bv = new Date(b.date).getTime();
      } else if (sortKey === "opp" || sortKey === "ha") {
        const aOH = getOpponent(a, team);
        const bOH = getOpponent(b, team);
        av = sortKey === "opp" ? normalizeAbbr(aOH.opp) : aOH.ha;
        bv = sortKey === "opp" ? normalizeAbbr(bOH.opp) : bOH.ha;
      } else {
        av = getStatVal(a, sortKey);
        bv = getStatVal(b, sortKey);
      }

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [logs, sortKey, sortDir, team, normalizeAbbr]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSlice = sorted.slice((page - 1) * pageSize, page * pageSize);

  const totals = useMemo(() => {
    const t = { G: 0, A: 0, SOG: 0, HIT: 0, BLK: 0, PIM: 0, PPP: 0, SHP: 0 };
    for (const gl of pageSlice) {
      (Object.keys(t) as (keyof typeof t)[]).forEach((k) => {
        t[k] += getStatVal(gl, k as Exclude<ColumnKey, "date" | "opp" | "ha">);
      });
    }
    const n = Math.max(1, pageSlice.length);
    const avgs: Record<keyof typeof t, string> = {
      G: (t.G / n).toFixed(2),
      A: (t.A / n).toFixed(2),
      SOG: (t.SOG / n).toFixed(2),
      HIT: (t.HIT / n).toFixed(2),
      BLK: (t.BLK / n).toFixed(2),
      PIM: (t.PIM / n).toFixed(2),
      PPP: (t.PPP / n).toFixed(2),
      SHP: (t.SHP / n).toFixed(2),
    };
    return { totals: t, avgs, n };
  }, [pageSlice]);

  const handleSort = (key: ColumnKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Default to descending for most columns; date also desc (newest first)
      setSortDir("desc");
    }
  };

  if (!logs || logs.length === 0) {
    return (
      <div className="text-sm text-[var(--muted)]">
        No game logs available.
      </div>
    );
  }

  // Reusable token-aligned button styles
  const btn =
    "px-3 py-1 rounded-md border border-[var(--border)] " +
    "bg-[var(--surface)] text-[var(--surface-contrast)] " +
    "hover:bg-[var(--hover)] transition disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="space-y-3">
      {/* Sticky top horiz scrollbar + tokenized table */}
      <TopScrollSync>
        <table className="table table-sm min-w-[900px]">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="cursor-pointer select-none"
                  onClick={() => handleSort(col.key)}
                  title={`Sort by ${col.label}`}
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  {col.label}
                  {sortKey === col.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {pageSlice.map((gl, idx) => {
              const { opp, ha } = getOpponent(gl, team);
              return (
                <tr key={`${gl.date}-${idx}`}>
                  <td>{fmtDate(gl.date)}</td>
                  <td>{normalizeAbbr(opp)}</td>
                  <td>{ha}</td>
                  <td>{getStatVal(gl, "G")}</td>
                  <td>{getStatVal(gl, "A")}</td>
                  <td>{getStatVal(gl, "SOG")}</td>
                  <td>{getStatVal(gl, "HIT")}</td>
                  <td>{getStatVal(gl, "BLK")}</td>
                  <td>{getStatVal(gl, "PIM")}</td>
                  <td>{getStatVal(gl, "PPP")}</td>
                  <td>{getStatVal(gl, "SHP")}</td>
                </tr>
              );
            })}
          </tbody>

          {pageSlice.length > 0 && (
            <tfoot>
              <tr className="bg-[var(--surface-muted)] font-semibold">
                <td colSpan={3}>
                  Averages (over {totals.n} {totals.n === 1 ? "game" : "games"})
                </td>
                <td>{totals.avgs.G}</td>
                <td>{totals.avgs.A}</td>
                <td>{totals.avgs.SOG}</td>
                <td>{totals.avgs.HIT}</td>
                <td>{totals.avgs.BLK}</td>
                <td>{totals.avgs.PIM}</td>
                <td>{totals.avgs.PPP}</td>
                <td>{totals.avgs.SHP}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </TopScrollSync>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <button
          className={btn}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          aria-label="Previous page"
          type="button"
        >
          Previous
        </button>

        <span className="text-sm text-[var(--muted)]">
          Page {page} of {totalPages}
        </span>

        <button
          className={btn}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          aria-label="Next page"
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
}
