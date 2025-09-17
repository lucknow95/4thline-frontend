// src/components/rankings/Pagination.tsx
type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
};

export default function Pagination({ page, pageSize, total, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const btn =
    "px-3 py-1 rounded-md border border-[var(--border)] " +
    "bg-[var(--surface)] text-[var(--surface-contrast)] " +
    "hover:bg-[var(--hover)] transition disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <nav
      className="flex items-center justify-between gap-3 mt-4 text-sm"
      aria-label="Pagination"
    >
      <button
        disabled={page === 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        className={btn}
        type="button"
      >
        Previous
      </button>

      <span className="text-[var(--muted)]">Page {page} of {totalPages}</span>

      <button
        disabled={page === totalPages}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        className={btn}
        type="button"
      >
        Next
      </button>
    </nav>
  );
}
