// src/app/players/page.tsx
"use client";

import TopScrollSync from "@/components/ui/TopScrollSync";
import Link from "next/link";
import { useMemo, useState } from "react";

import rawSchedule from "@/data/nhlSchedule.json"; // league source of truth
import realPlayers from "@/data/realPlayersWithSchedule.json";
import "@/styles/data-table.css";
import type { Player } from "@/types";
import { filterPlayers } from "@/types/guards";
import { dedupePlayersById } from "@/utils/dedupe";
import {
  generateWeekOptions,
  getGamesThisWeek,
  getWeekLabel,
} from "@/utils/fantasyWeeks";

/* ================================
   Team abbrev normalization
   ================================ */
const TEAM_ABBR_MAP: Record<string, string> = {
  "Anaheim Ducks": "ANA", Anaheim: "ANA", ANA: "ANA",
  "Boston Bruins": "BOS", Boston: "BOS", BOS: "BOS",
  "Buffalo Sabres": "BUF", Buffalo: "BUF", BUF: "BUF",
  "Calgary Flames": "CGY", Calgary: "CGY", CGY: "CGY",
  "Carolina Hurricanes": "CAR", Carolina: "CAR", CAR: "CAR",
  "Chicago Blackhawks": "CHI", Chicago: "CHI", CHI: "CHI",
  "Colorado Avalanche": "COL", Colorado: "COL", COL: "COL",
  "Columbus Blue Jackets": "CBJ", Columbus: "CBJ", CBJ: "CBJ",
  "Dallas Stars": "DAL", Dallas: "DAL", DAL: "DAL",
  "Detroit Red Wings": "DET", Detroit: "DET", DET: "DET",
  "Edmonton Oilers": "EDM", Edmonton: "EDM", EDM: "EDM",
  "Florida Panthers": "FLA", Florida: "FLA", FLA: "FLA", FLO: "FLA",
  "Los Angeles Kings": "LAK", "Los Angeles": "LAK", LAK: "LAK",
  "Minnesota Wild": "MIN", Minnesota: "MIN", MIN: "MIN",
  "Montreal Canadiens": "MTL", Montreal: "MTL", "Montréal Canadiens": "MTL", "Montréal": "MTL", MTL: "MTL",
  "Nashville Predators": "NSH", Nashville: "NSH", NSH: "NSH",
  "New Jersey Devils": "NJD", "New Jersey": "NJD", NJD: "NJD",
  "New York Islanders": "NYI", NYI: "NYI",
  "New York Rangers": "NYR", NYR: "NYR",
  "Ottawa Senators": "OTT", Ottawa: "OTT", OTT: "OTT",
  "Philadelphia Flyers": "PHI", Philadelphia: "PHI", PHI: "PHI",
  "Pittsburgh Penguins": "PIT", Pittsburgh: "PIT", PIT: "PIT",
  "San Jose Sharks": "SJS", "San Jose": "SJS", SJS: "SJS",
  "Seattle Kraken": "SEA", Seattle: "SEA", SEA: "SEA",
  "St. Louis Blues": "STL", "St. Louis": "STL", "St Louis": "STL", STL: "STL",
  "Tampa Bay Lightning": "TBL", "Tampa Bay": "TBL", Tampa: "TBL", TBL: "TBL",
  "Toronto Maple Leafs": "TOR", Toronto: "TOR", TOR: "TOR",
  "Vancouver Canucks": "VAN", Vancouver: "VAN", VAN: "VAN",
  "Vegas Golden Knights": "VGK", Vegas: "VGK", VGK: "VGK",
  "Washington Capitals": "WSH", Washington: "WSH", WSH: "WSH",
  "Winnipeg Jets": "WPG", Winnipeg: "WPG", WPG: "WPG", WPJ: "WPG",
  "Utah Mammoth": "UTM", "Utah Hockey Club": "UTM", Utah: "UTM", UTM: "UTM", UTA: "UTM",
};
function normalizeTeamAbbreviation(input: string): string {
  return TEAM_ABBR_MAP[input] || input;
}

/* ================================
   NY venue disambiguation
   ================================ */
const VENUE_TO_TEAM_ABBR: Record<string, string> = {
  "Madison Square Garden": "NYR",
  "UBS Arena": "NYI",
};
function resolveCityToTeamAbbr(cityOrName: string, venue?: string | null): string {
  if (cityOrName === "New York") {
    if (venue && VENUE_TO_TEAM_ABBR[venue]) return VENUE_TO_TEAM_ABBR[venue];
    return "NY?";
  }
  return normalizeTeamAbbreviation(cityOrName);
}

/* ================================
   League schedule typing/map
   ================================ */
type LeagueGame = {
  date: string;            // "YYYY-MM-DD"
  home_team: string;
  away_team: string;
  time?: string | null;
  venue?: string | null;
  special_game?: string | null;
};
type LeagueTeamBlock = {
  team: string;            // team abbr, e.g. "COL"
  schedule: LeagueGame[];
};

const ITEMS_PER_PAGE = 50;
const NUM_WEEKS = 27;

/* Opponent helpers */
function describeFixtureForTeam(game: LeagueGame, teamAbbr: string): {
  side: "home" | "away" | "unknown";
  opponent: string;
} {
  const home = resolveCityToTeamAbbr(game.home_team, game.venue);
  const away = resolveCityToTeamAbbr(game.away_team, game.venue);

  if (home === teamAbbr) return { side: "home", opponent: away };
  if (away === teamAbbr) return { side: "away", opponent: home };
  return { side: "unknown", opponent: home !== teamAbbr ? home : away };
}
function decorateOpponent(side: "home" | "away" | "unknown", opponent: string): string {
  if (side === "home") return `vs ${opponent}`;
  if (side === "away") return `@ ${opponent}`;
  return opponent || "—";
}

/* ================================
   Sort state/types
   ================================ */
type SortKey = "name" | "team" | "pos" | "gtw";
type SortDir = "asc" | "desc";
const defaultDirFor: Record<SortKey, SortDir> = {
  name: "asc",
  team: "asc",
  pos: "asc",
  gtw: "desc", // numeric, usually want high→low first
};

export default function PlayersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedWeek, setSelectedWeek] = useState(1);

  // NEW: positions filter (none = all)
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);

  // NEW: sorting
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>(defaultDirFor["name"]);

  const weekOptions = useMemo(() => generateWeekOptions(NUM_WEEKS), []);

  // Validate and de-duplicate once
  const allPlayers: Player[] = useMemo(() => {
    const validated = filterPlayers(realPlayers as unknown);
    return dedupePlayersById(validated);
  }, []);

  // League schedule map: ABBR -> games[]
  const leagueGamesByTeam = useMemo(() => {
    const blocks = (rawSchedule as unknown as LeagueTeamBlock[]) || [];
    const map = new Map<string, LeagueGame[]>();
    for (const tb of blocks) {
      if (!tb?.team || !Array.isArray(tb.schedule)) continue;
      map.set(tb.team, tb.schedule);
    }
    return map;
  }, []);

  // Derive canonical positions present in the dataset for UI (C/LW/RW/D/G)
  const allPositions = useMemo(() => {
    const order = ["C", "LW", "RW", "D", "G"];
    const set = new Set<string>();
    for (const p of allPlayers) {
      if (Array.isArray(p.positions)) {
        p.positions.forEach((pos) => set.add(String(pos).toUpperCase()));
      } else if (p.position) {
        set.add(String(p.position).toUpperCase());
      }
    }
    return order.filter((o) => set.has(o));
  }, [allPlayers]);

  // Build rows for ALL players (so sorting by GTW is across the full list)
  const rowsAll = useMemo(() => {
    return allPlayers.map((player) => {
      const teamAbbr = normalizeTeamAbbreviation(player.team);
      const teamLeagueGames = leagueGamesByTeam.get(teamAbbr) ?? [];

      const pseudoPlayer = { team: teamAbbr, schedule: teamLeagueGames } as unknown as Player;
      const games = getGamesThisWeek(pseudoPlayer, selectedWeek);
      const gtw = games.length;

      const opps =
        gtw === 0
          ? ""
          : games
            .map((g) => {
              const { side, opponent } = describeFixtureForTeam(g as LeagueGame, teamAbbr);
              return decorateOpponent(side, opponent);
            })
            .join(", ");

      const pos = Array.isArray(player.positions)
        ? player.positions.join("/")
        : player.position ?? "";

      return { player, teamAbbr, pos, gtw, opps };
    });
  }, [allPlayers, leagueGamesByTeam, selectedWeek]);

  // Filters: search + positions
  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return rowsAll.filter(({ player, pos }) => {
      const hit =
        !term || player.name.toLowerCase().includes(term);
      const posHit =
        selectedPositions.length === 0 ||
        pos
          .split("/")
          .map((p) => p.toUpperCase())
          .some((p) => selectedPositions.includes(p));
      return hit && posHit;
    });
  }, [rowsAll, searchTerm, selectedPositions]);

  // Sorting
  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "gtw") {
        cmp = a.gtw - b.gtw;
      } else if (sortKey === "team") {
        cmp = a.teamAbbr.localeCompare(b.teamAbbr);
      } else if (sortKey === "pos") {
        cmp = (a.pos || "").localeCompare(b.pos || "");
      } else {
        // name
        cmp = a.player.name.localeCompare(b.player.name);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredRows, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const pageRows = useMemo(
    () => sortedRows.slice(pageStart, pageStart + ITEMS_PER_PAGE),
    [sortedRows, pageStart]
  );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  // Sort header helpers
  const onHeaderClick = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(defaultDirFor[key]);
    }
    setCurrentPage(1);
  };
  const ariaSortFor = (key: SortKey): "ascending" | "descending" | "none" =>
    sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none";

  return (
    <main className="max-w-6xl mx-auto py-10 px-4">
      {/* Title + Week selector */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
        <h1 className="text-3xl md:text-4xl font-bold">Players</h1>

        <div className="flex items-center gap-2">
          <label htmlFor="week-dropdown" className="text-sm font-medium">
            View:
          </label>
          <select
            id="week-dropdown"
            value={selectedWeek}
            onChange={(e) => {
              setSelectedWeek(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border border-[var(--border)] rounded px-2 py-1 text-sm bg-[var(--surface)] text-[var(--surface-contrast)]"
          >
            {weekOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="text-xs md:text-sm text-[var(--muted)] ml-1">
            {getWeekLabel(selectedWeek)}
          </span>
        </div>
      </div>

      {/* Search + Positions filter */}
      <div className="flex flex-col gap-3 mb-4">
        <input
          type="text"
          placeholder="Search players..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full max-w-md rounded px-3 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--surface-contrast)] placeholder-[var(--muted)]"
        />

        {allPositions.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Positions:</span>
            {allPositions.map((p) => {
              const checked = selectedPositions.includes(p);
              return (
                <label key={p} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setCurrentPage(1);
                      if (checked) {
                        setSelectedPositions((prev) => prev.filter((x) => x !== p));
                      } else {
                        setSelectedPositions((prev) => [...prev, p]);
                      }
                    }}
                  />
                  <span className="font-mono">{p}</span>
                </label>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setSelectedPositions([]);
                setCurrentPage(1);
              }}
              className="px-2 py-1 text-xs rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--surface-contrast)] hover:bg-[var(--hover)]"
              title="Show all positions"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Table with sticky top scrollbar (only appears if overflow) */}
      <TopScrollSync>
        <table className="data-table min-w-[1100px] md:min-w-[1300px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th
                role="columnheader"
                aria-sort={ariaSortFor("name")}
                onClick={() => onHeaderClick("name")}
                className="cursor-pointer select-none"
                title="Sort by Player"
              >
                Player{sortKey === "name" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
              </th>
              <th
                className="hidden sm:table-cell cursor-pointer select-none"
                role="columnheader"
                aria-sort={ariaSortFor("pos")}
                onClick={() => onHeaderClick("pos")}
                title="Sort by Position"
              >
                Pos{sortKey === "pos" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
              </th>
              <th
                role="columnheader"
                aria-sort={ariaSortFor("team")}
                onClick={() => onHeaderClick("team")}
                className="cursor-pointer select-none"
                title="Sort by Team"
              >
                Team{sortKey === "team" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
              </th>
              <th
                role="columnheader"
                aria-sort={ariaSortFor("gtw")}
                onClick={() => onHeaderClick("gtw")}
                className="cursor-pointer select-none"
                title="Sort by Games This Week"
              >
                Games This Week{sortKey === "gtw" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
              </th>
              {/* Opponents always visible; use horizontal scroll on mobile */}
              <th className="w-[40%]">Opponents</th>
            </tr>
          </thead>

          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center">
                  No players found{searchTerm ? ` for “${searchTerm}”` : ""}.
                </td>
              </tr>
            ) : (
              pageRows.map(({ player, teamAbbr, pos, gtw, opps }) => (
                <tr key={player.id}>
                  <td>
                    <Link href={`/players/${player.id}`} className="text-blue-700 hover:underline">
                      {player.name}
                    </Link>
                  </td>
                  <td className="hidden sm:table-cell">{pos}</td>
                  <td className="font-mono">{teamAbbr}</td>
                  <td>
                    <span className="font-semibold">{gtw}</span> game{gtw !== 1 ? "s" : ""}
                  </td>
                  <td className="whitespace-nowrap">{opps || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TopScrollSync>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-6 text-sm">
        <button
          onClick={() => goToPage(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
          className="px-3 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--surface-contrast)] hover:bg-[var(--hover)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Prev
        </button>

        <span className="text-[var(--muted)]">
          Page {safeCurrentPage} of {totalPages}
        </span>

        <button
          onClick={() => goToPage(safeCurrentPage + 1)}
          disabled={safeCurrentPage === totalPages}
          className="px-3 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--surface-contrast)] hover:bg-[var(--hover)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </main>
  );
}
