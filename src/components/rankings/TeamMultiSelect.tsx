// src/components/TeamMultiSelect.tsx
"use client";

import type { TeamAbbr } from "@/types/hockey";
import { TEAM_ABBRS } from "@/types/hockey";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  value: TeamAbbr[];
  onChange: (v: TeamAbbr[]) => void;
  label?: string;
};

export default function TeamMultiSelect({ value, onChange, label = "Teams" }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return TEAM_ABBRS.filter((abbr) => abbr.toLowerCase().includes(needle));
  }, [q]);

  const toggle = (abbr: TeamAbbr) => {
    const set = new Set(value);
    set.has(abbr) ? set.delete(abbr) : set.add(abbr);
    onChange(Array.from(set));
  };

  const clear = () => onChange([]);

  const selectedCount = value.length;

  return (
    <div className="relative" ref={ref}>
      <div className="text-sm font-medium mb-1">{label}</div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full border border-[var(--border)] rounded px-3 py-2 text-left bg-[var(--surface)] text-[var(--surface-contrast)]"
        title="Select teams"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedCount === 0 ? "All Teams" : `${selectedCount} selected`}
      </button>

      {open && (
        <div className="menu absolute z-20 mt-2 w-80 max-h-[22rem] overflow-hidden p-2">
          {/* Search */}
          <div className="menu-search p-2 pb-2">
            <input
              className="w-full rounded px-2 py-1 text-sm"
              placeholder="Search teams (e.g., CBJ)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              aria-label="Search teams"
            />
          </div>
          <div className="menu-sep" />

          {/* Options */}
          <div
            role="listbox"
            aria-multiselectable="true"
            className="max-h-64 overflow-auto pr-1 grid grid-cols-3 gap-2"
          >
            {filtered.map((abbr) => {
              const checked = value.includes(abbr);
              return (
                <label
                  key={abbr}
                  role="option"
                  aria-selected={checked}
                  className="menu-item text-sm"
                  title={abbr}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                    checked={checked}
                    onChange={() => toggle(abbr)}
                  />
                  <span className="font-mono">{abbr}</span>
                </label>
              );
            })}

            {filtered.length === 0 && (
              <div className="col-span-3 text-xs text-[var(--muted)] px-1 py-2">
                No matches.
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between gap-2 mt-2 px-1 pb-1">
            <button
              type="button"
              className="px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--hover)]"
              onClick={clear}
              title="Clear all selected teams"
            >
              Clear
            </button>
            <div className="space-x-2">
              <button
                type="button"
                className="px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--hover)]"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--hover)]"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
