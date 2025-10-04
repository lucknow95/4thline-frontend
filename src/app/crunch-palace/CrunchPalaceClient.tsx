// src/app/crunch-palace/CrunchPalaceClient.tsx
'use client';

import '@/styles/data-table.css';
import { useMemo, useState } from 'react';

type Mode = 'total' | 'perGame';

type Row = {
  season: string;
  team_abbr: string;
  team_full: string;
  arena_name: string;
  home_games: number;
  total_hits: number;
  hits_per_game: number;
};

type Props = {
  initialRows: Row[];
  hasData: boolean;
};

type SortKey = 'metric' | 'games';
type SortDir = 'asc' | 'desc';

export default function CrunchPalaceClient({ initialRows, hasData }: Props) {
  const [mode, setMode] = useState<Mode>('total');
  const [sortKey, setSortKey] = useState<SortKey>('metric');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const unitLabel = mode === 'total' ? 'Total Hits' : 'Hits / Home Game';

  const sorted = useMemo(() => {
    const list = [...initialRows];

    list.sort((a, b) => {
      let av = 0;
      let bv = 0;

      if (sortKey === 'metric') {
        av = mode === 'total' ? a.total_hits : a.hits_per_game;
        bv = mode === 'total' ? b.total_hits : b.hits_per_game;
      } else {
        av = a.home_games;
        bv = b.home_games;
      }

      if (av === bv) {
        // Stable secondary: team name ASC to keep flicker minimal
        return a.team_full.localeCompare(b.team_full);
      }
      return sortDir === 'desc' ? (bv - av) : (av - bv);
    });

    return list;
  }, [initialRows, mode, sortDir, sortKey]);

  const rankForIndex = (idx: number) => idx + 1;

  const onClickRank = () => {
    // Rank header = toggle metric direction
    setSortKey('metric');
    setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
  };

  const onClickHits = () => {
    setSortKey('metric');
    setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
  };

  const onClickGames = () => {
    setSortKey('games');
    setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-2">
          <span role="img" aria-label="steak">🥩</span> Crunch Palace Rankings
        </h1>

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mode === 'perGame'}
              onChange={(e) => setMode(e.target.checked ? 'perGame' : 'total')}
            />
            <span>Average (per Home Game)</span>
          </label>
        </div>
      </div>

      <p className="mb-6 text-base md:text-lg text-[var(--muted)]">
        {mode === 'total'
          ? 'Total home hits by team (season-to-date).'
          : 'Home hits per home game played (season-to-date).'}
      </p>

      {initialRows.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-6 text-sm text-[var(--muted)]">
          {hasData
            ? 'No rows to display.'
            : 'No regular-season data yet. Check back after games are ingested (nightly).'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl shadow ring-1 ring-[var(--border)]">
          <table className="data-table table-fixed border-separate border-spacing-0">
            <thead>
              <tr>
                <th>
                  <button className="underline decoration-dotted" onClick={onClickRank} title="Sort by rank (metric)">
                    #
                  </button>
                </th>
                <th style={{ display: 'table-cell' }}>Team</th>
                <th>Arena</th>
                <th>
                  <button className="underline decoration-dotted" onClick={onClickHits} title={`Sort by ${unitLabel}`}>
                    {unitLabel}
                  </button>
                </th>
                <th className="text-xs" style={{ display: 'table-cell' }}>
                  <button className="underline decoration-dotted" onClick={onClickGames} title="Sort by Home Games Played">
                    Home Games Played
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => (
                <tr key={`${row.team_abbr}-${row.arena_name}`}>
                  <td>{rankForIndex(idx)}</td>
                  <td style={{ display: 'table-cell' }} className="font-semibold">
                    {row.team_full}
                  </td>
                  <td>
                    <span className="font-semibold">{row.arena_name}</span>
                  </td>
                  <td className="font-semibold">
                    {mode === 'total' ? row.total_hits.toLocaleString() : row.hits_per_game.toFixed(2)}
                  </td>
                  <td style={{ display: 'table-cell' }}>{row.home_games}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-sm text-[var(--muted)]">
        * Home games & hits are computed from team boxscore data (regular season only). Special/neutral games are counted for the scheduled home team and attributed to their usual arena.
      </p>
    </>
  );
}
