// src/components/TeamFilterDropdown.tsx
"use client";

import { nhlTeamsFull } from "@/data/constants";
import { useEffect, useMemo, useRef, useState } from "react";

interface TeamFilterDropdownProps {
  selectedTeams: string[];
  onChange: (teams: string[]) => void;
  onApply: () => void;
}

export default function TeamFilterDropdown({
  selectedTeams,
  onChange,
  onApply,
}: TeamFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Sort filtered teams alphabetically by abbr
  const filteredTeams = useMemo(
    () =>
      nhlTeamsFull
        .filter(
          (team) =>
            team.abbr.toLowerCase().includes(search.toLowerCase()) ||
            team.name.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => a.abbr.localeCompare(b.abbr)),
    [search]
  );

  const handleToggleTeam = (abbr: string) => {
    if (selectedTeams.includes(abbr)) {
      onChange(selectedTeams.filter((t) => t !== abbr));
    } else {
      onChange([...selectedTeams, abbr]);
    }
  };

  const selectedCount = selectedTeams.length;

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        className="border border-[var(--border)] px-3 py-2 rounded bg-[var(--surface)] text-[var(--surface-contrast)]"
        onClick={() => setOpen((o) => !o)}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Filter by Team"
      >
        {selectedCount === 0 ? "Filter by Team" : `${selectedCount} selected`}
      </button>

      {open && (
        <div className="menu absolute z-20 mt-2 w-80">
          {/* Search */}
          <div className="menu-search p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teams…"
              className="w-full rounded px-2 py-1 text-sm"
              aria-label="Search teams"
              autoFocus
            />
          </div>

          <div className="menu-sep" />

          {/* Options */}
          <div
            role="listbox"
            aria-multiselectable="true"
            className="max-h-64 overflow-auto px-2 pb-2 grid grid-cols-3 gap-2"
          >
            {filteredTeams.map((team) => {
              const checked = selectedTeams.includes(team.abbr);
              return (
                <label
                  key={team.abbr}
                  role="option"
                  aria-selected={checked}
                  className="menu-item text-sm"
                  title={`${team.name} (${team.abbr})`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                    checked={checked}
                    onChange={() => handleToggleTeam(team.abbr)}
                  />
                  <span className="font-mono font-semibold">{team.abbr}</span>
                </label>
              );
            })}
            {filteredTeams.length === 0 && (
              <div className="col-span-3 text-xs text-[var(--muted)] px-1 py-2">
                No matches.
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t border-[var(--border)] p-2">
            <button
              className="px-3 py-1 rounded border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--hover)] text-sm"
              onClick={() => setOpen(false)}
              type="button"
            >
              Close
            </button>
            <button
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
              onClick={() => {
                setOpen(false);
                onApply();
              }}
              type="button"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
