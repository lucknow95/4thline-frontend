// src/components/rankings/StatMinFilters.tsx
import type { SkaterStatKeys } from "@/types/hockey";

type Props = {
  value: Partial<Record<SkaterStatKeys, number>>;
  perGameMode: boolean;
  onChange: (v: Partial<Record<SkaterStatKeys, number>>) => void;
  /** Optional: pass from parent to make the header toggle interactive */
  onTogglePerGame?: (next: boolean) => void;
};

const FIELDS: SkaterStatKeys[] = ["G", "A", "PIM", "PPP", "SHP", "SOG", "FW", "HIT", "BLK"];

export default function StatMinFilters({ value, perGameMode, onChange, onTogglePerGame }: Props) {
  const setField = (k: SkaterStatKeys, raw: string) => {
    const n = Number(raw);
    const next = { ...value };
    if (!raw || Number.isNaN(n) || n === 0) {
      delete next[k];
    } else {
      next[k] = n;
    }
    onChange(next);
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--surface-contrast)] p-4 shadow-sm">
      {/* Header w/ optional Per Game toggle on the right */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Minimum Stats</h3>

        {typeof onTogglePerGame === "function" ? (
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
              checked={perGameMode}
              onChange={(e) => onTogglePerGame(e.target.checked)}
              aria-label="Per Game"
            />
            <span>Per Game</span>
          </label>
        ) : (
          <span className="text-sm text-[var(--muted)]">
            {perGameMode ? "Per game" : "Totals"}
          </span>
        )}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-3 gap-3">
        {FIELDS.map((k) => (
          <label key={k} className="text-xs flex flex-col">
            <span className="mb-1">{k}</span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              className="rounded px-2 py-1 border border-[var(--border)] bg-[var(--surface)] text-[var(--surface-contrast)]"
              value={value[k] ?? ""}
              onChange={(e) => setField(k, e.target.value)}
              placeholder="min"
              aria-label={`Minimum ${k}${perGameMode ? " (per game)" : ""}`}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
