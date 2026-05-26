'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export interface Post {
  slug: string;
  meta: {
    title: string;
    date: string;
    excerpt?: string;
    tags?: string[];
    categories?: string[];
    archive?: string;
    season?: string;
    pinned?: boolean;
  };
}

type ArchiveItem = {
  label: string;
  type: 'all' | 'category' | 'season';
  value?: string;
  aliases?: string[];
};

const POSTS_PER_PAGE = 5;

const DEFAULT_ARCHIVE: ArchiveItem = {
  label: 'All Posts',
  type: 'all',
};

const archiveItems: ArchiveItem[] = [
  DEFAULT_ARCHIVE,

  {
    label: 'Playoff Previews',
    type: 'category',
    value: 'Playoff Previews',
    aliases: ['Playoff Preview', 'Playoffs'],
  },
  {
    label: 'Draft Prep',
    type: 'category',
    value: 'Draft Prep',
    aliases: ['Draft Preparation', 'Draft'],
  },
  {
    label: 'Strategy',
    type: 'category',
    value: 'Strategy',
    aliases: ['Evergreen Strategy', 'Fantasy Strategy', 'Evergreen'],
  },
  {
    label: 'General',
    type: 'category',
    value: 'General',
    aliases: ['Site Updates'],
  },

  {
    label: '2025–2026 Season',
    type: 'season',
    value: '2025-2026',
    aliases: ['2025–2026'],
  },
  {
    label: '2026–2027 Season',
    type: 'season',
    value: '2026-2027',
    aliases: ['2026–2027'],
  },
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getSeasonFromDate(date: string) {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const year = parsed.getFullYear();
  const month = parsed.getMonth() + 1;

  // NHL content season logic:
  // Aug-Dec 2025 = 2025-2026
  // Jan-Jul 2026 = 2025-2026
  if (month >= 8) {
    return `${year}-${year + 1}`;
  }

  return `${year - 1}-${year}`;
}

function postMatchesArchive(post: Post, archive: ArchiveItem) {
  if (archive.type === 'all') {
    return true;
  }

  if (archive.type === 'season') {
    const postSeason = post.meta.season || getSeasonFromDate(post.meta.date);
    return postSeason === archive.value;
  }

  const possibleValues = [archive.value, ...(archive.aliases || [])]
    .filter(Boolean)
    .map((value) => normalize(String(value)));

  const postArchive = post.meta.archive ? normalize(post.meta.archive) : '';
  const postCategories = (post.meta.categories || []).map(normalize);
  const postTags = (post.meta.tags || []).map(normalize);

  return possibleValues.some(
    (value) =>
      postArchive === value ||
      postCategories.includes(value) ||
      postTags.includes(value)
  );
}

function sortPosts(posts: Post[]) {
  return [...posts].sort((a, b) => {
    const aPinned = a.meta.pinned === true ? 1 : 0;
    const bPinned = b.meta.pinned === true ? 1 : 0;

    if (aPinned !== bPinned) {
      return bPinned - aPinned;
    }

    return new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime();
  });
}

export default function BlogClient({ allPosts }: { allPosts: Post[] }) {
  const [activeArchiveLabel, setActiveArchiveLabel] = useState(DEFAULT_ARCHIVE.label);
  const [currentPage, setCurrentPage] = useState(1);

  const activeArchive: ArchiveItem =
    archiveItems.find((item) => item.label === activeArchiveLabel) ?? DEFAULT_ARCHIVE;

  const sortedPosts = useMemo(() => sortPosts(allPosts), [allPosts]);

  const archiveCounts = useMemo(() => {
    return archiveItems.reduce<Record<string, number>>((counts, item) => {
      counts[item.label] = sortedPosts.filter((post) =>
        postMatchesArchive(post, item)
      ).length;

      return counts;
    }, {});
  }, [sortedPosts]);

  const filteredPosts = useMemo(() => {
    return sortedPosts.filter((post) => postMatchesArchive(post, activeArchive));
  }, [sortedPosts, activeArchive]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedPosts = filteredPosts.slice(
    (safeCurrentPage - 1) * POSTS_PER_PAGE,
    safeCurrentPage * POSTS_PER_PAGE
  );

  const handleArchiveClick = (label: string) => {
    setActiveArchiveLabel(label);
    setCurrentPage(1);
  };

  const goToPreviousPage = () => {
    setCurrentPage((page) => Math.max(1, page - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((page) => Math.min(totalPages, page + 1));
  };

  return (
    <main className="relative min-h-screen">
      <div
        className="absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 40%, #E6F4FF 0%, #BFE4FF 45%, #5CAFE8 85%)',
        }}
      />

      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        <header className="mb-8 md:mb-10">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#0F2A44]/70">
            4th Line Fantasy
          </p>

          <h1 className="mt-2 text-4xl md:text-5xl font-extrabold tracking-tight text-[#0F2A44] drop-shadow-sm">
            Fantasy Hockey Blog
          </h1>

          <p className="mt-3 max-w-3xl text-sm md:text-base leading-7 text-[#0F2A44]/80">
            Weekly waiver-wire targets, playoff schedule previews, draft prep, and
            long-term fantasy hockey strategy built for managers who want the small
            edges.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">
          <aside
            className="lg:col-span-1 rounded-2xl p-4 md:p-5 bg-white/65 backdrop-blur-md shadow-sm border border-white/50 h-fit"
            aria-label="Blog archive"
          >
            <h2 className="text-xl font-extrabold text-[#0F2A44]">
              Archive
            </h2>

            <p className="mt-1 text-sm leading-6 text-[#0F2A44]/70">
              Browse posts by type or season.
            </p>

            <nav className="mt-5 space-y-2">
              {archiveItems.map((item, index) => {
                const isActive = item.label === activeArchiveLabel;
                const isSeasonHeader = index === 5;

                return (
                  <div key={item.label}>
                    {isSeasonHeader && (
                      <div className="pt-4 pb-1 text-xs font-bold uppercase tracking-[0.18em] text-[#0F2A44]/50">
                        Season Archives
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleArchiveClick(item.label)}
                      className={[
                        'w-full rounded-xl px-3 py-2 text-left transition border',
                        isActive
                          ? 'bg-[#0F2A44] text-white border-[#0F2A44] shadow-sm'
                          : 'bg-white/65 text-[#0F2A44] border-white/60 hover:border-[#FF8A00]/70 hover:shadow-[0_0_0_2px_#FF8A00,0_0_14px_#FF8A00]',
                      ].join(' ')}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold">
                          {item.label}
                        </span>

                        <span
                          className={[
                            'rounded-full px-2 py-0.5 text-xs font-bold',
                            isActive
                              ? 'bg-white/15 text-white'
                              : 'bg-[#0F2A44]/10 text-[#0F2A44]/70',
                          ].join(' ')}
                        >
                          {archiveCounts[item.label] || 0}
                        </span>
                      </span>
                    </button>
                  </div>
                );
              })}
            </nav>
          </aside>

          <section className="lg:col-span-3">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-[#0F2A44]">
                  {activeArchive.label}
                </h2>

                <p className="mt-1 text-sm text-[#0F2A44]/70">
                  {filteredPosts.length}{' '}
                  {filteredPosts.length === 1 ? 'post' : 'posts'}
                </p>
              </div>

              <p className="text-sm font-semibold text-[#0F2A44]/70">
                Page {safeCurrentPage} of {totalPages}
              </p>
            </div>

            {filteredPosts.length === 0 && (
              <div className="rounded-2xl p-5 md:p-6 bg-white/65 backdrop-blur-md border border-white/50 shadow-sm">
                <p className="text-[#0F2A44]/80">
                  No posts are currently filed here.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 md:gap-6">
              {paginatedPosts.map(({ slug, meta }) => {
                const postSeason = meta.season || getSeasonFromDate(meta.date);
                const primaryCategory = meta.archive || meta.categories?.[0] || 'Blog';

                return (
                  <article
                    key={slug}
                    className="group rounded-2xl p-5 md:p-6 bg-white/70 backdrop-blur-md border border-white/50 shadow-sm transition hover:shadow-[0_0_0_2px_#FF8A00,0_0_24px_#FF8A00]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {meta.pinned === true && (
                        <span className="rounded-full bg-[#FF8A00]/15 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-[#0F2A44]">
                          Pinned
                        </span>
                      )}

                      <span className="rounded-full bg-[#0F2A44]/10 px-2.5 py-1 text-xs font-bold text-[#0F2A44]/80">
                        {primaryCategory}
                      </span>

                      {postSeason && (
                        <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-[#0F2A44]/70 border border-white/60">
                          {postSeason}
                        </span>
                      )}
                    </div>

                    <Link href={`/blog/${slug}`} className="block mt-3">
                      <h3 className="text-2xl md:text-3xl font-extrabold leading-tight text-[#0F2A44]">
                        {meta.title}
                      </h3>
                    </Link>

                    <p className="mt-2 text-xs md:text-sm font-medium text-[#0F2A44]/65">
                      {formatDate(meta.date)}
                    </p>

                    {meta.excerpt && (
                      <p className="mt-4 text-sm md:text-base leading-7 text-[#0F2A44]/88">
                        {meta.excerpt}
                      </p>
                    )}

                    <div className="mt-5">
                      <Link
                        href={`/blog/${slug}`}
                        className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-extrabold text-[#0F2A44] transition hover:shadow-[0_0_0_2px_#FF8A00,0_0_16px_#FF8A00]"
                        aria-label={`Read post: ${meta.title}`}
                      >
                        Read article
                        <span aria-hidden>→</span>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>

            {filteredPosts.length > 0 && (
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={goToPreviousPage}
                  disabled={safeCurrentPage === 1}
                  className="rounded-xl px-4 py-2 font-bold text-[#0F2A44] bg-white/70 border border-white/60 shadow-sm transition disabled:opacity-45 disabled:cursor-not-allowed hover:enabled:shadow-[0_0_0_2px_#FF8A00,0_0_16px_#FF8A00]"
                >
                  ← Previous
                </button>

                <p className="text-center text-sm font-semibold text-[#0F2A44]/75">
                  Page {safeCurrentPage} of {totalPages}
                </p>

                <button
                  type="button"
                  onClick={goToNextPage}
                  disabled={safeCurrentPage === totalPages}
                  className="rounded-xl px-4 py-2 font-bold text-[#0F2A44] bg-white/70 border border-white/60 shadow-sm transition disabled:opacity-45 disabled:cursor-not-allowed hover:enabled:shadow-[0_0_0_2px_#FF8A00,0_0_16px_#FF8A00]"
                >
                  Next →
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}