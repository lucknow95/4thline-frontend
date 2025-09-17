'use client';

import Link from 'next/link';
import { useState } from 'react';

export interface Post {
  slug: string;
  meta: {
    title: string;
    date: string;
    excerpt?: string;
    tags?: string[];
    categories?: string[];
  };
}

export default function BlogClient({ allPosts }: { allPosts: Post[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [applyFilters, setApplyFilters] = useState(false);

  const allTags: string[] = Array.from(
    new Set(allPosts.flatMap((post) => post.meta.tags || []))
  ).sort();

  const allCategories: string[] = Array.from(
    new Set(allPosts.flatMap((post) => post.meta.categories || []))
  ).sort();

  const toggleSelected = (
    value: string,
    selected: string[],
    setSelected: (v: string[]) => void
  ) => {
    setSelected(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value]
    );
  };

  const filteredPosts = applyFilters
    ? allPosts.filter(({ meta }) => {
      const query = searchQuery.toLowerCase();
      const titleMatch = meta.title.toLowerCase().includes(query);
      const dateMatch = meta.date.includes(query);

      const tagMatch =
        selectedTags.length === 0 ||
        (meta.tags || []).some((tag: string) => selectedTags.includes(tag));

      const catMatch =
        selectedCategories.length === 0 ||
        (meta.categories || []).some((cat: string) => selectedCategories.includes(cat));

      return (titleMatch || dateMatch) && tagMatch && catMatch;
    })
    : allPosts;

  return (
    <main className="relative min-h-screen">
      {/* Ice background (always on) */}
      <div
        className="absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 40%, #E6F4FF 0%, #BFE4FF 45%, #5CAFE8 85%)',
        }}
      />

      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        {/* Header */}
        <header className="mb-8 md:mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#0F2A44] drop-shadow-sm">
            Fantasy Hockey Blog
          </h1>
          <p className="mt-2 text-sm md:text-base text-[#0F2A44]/80">
            Draft strategy, sleepers, schedule hacks, and more.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {/* Filters sidebar (frosted) */}
          <aside
            className="md:col-span-1 rounded-2xl p-4 md:p-5 bg-white/60 backdrop-blur-md shadow-sm border border-white/40"
            aria-label="Filters"
          >
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[#0F2A44] mb-1.5">
                  Search Posts
                </label>
                <input
                  type="text"
                  placeholder="Search title or date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/80 border border-white/50 outline-none focus:ring-2 focus:ring-[#FF8A00]/60 text-[#0F2A44] placeholder:text-[#0F2A44]/50"
                />
              </div>

              {/* Hidden: Tags & Categories UI (kept for later) */}
              <div className="hidden">
                <label className="block text-sm font-semibold text-[#0F2A44] mb-1.5">
                  Search Tags & Categories
                </label>
                <input
                  type="text"
                  placeholder="Search tags or categories..."
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/80 border border-white/50 outline-none focus:ring-2 focus:ring-[#FF8A00]/60 text-[#0F2A44] placeholder:text-[#0F2A44]/50 mb-2"
                />

                <div className="max-h-64 overflow-y-auto rounded-xl p-3 bg-white/70 border border-white/50 text-[#0F2A44] space-y-2">
                  {/* (contents preserved for future) */}
                </div>
              </div>

              <button
                onClick={() => setApplyFilters(true)}
                className="w-full px-4 py-2 rounded-xl font-semibold text-white bg-[#0F2A44] hover:bg-[#0F2A44] transition shadow hover:shadow-[0_0_0_2px_#FF8A00,0_0_20px_#FF8A00] focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/70"
              >
                Apply Filters
              </button>
            </div>
          </aside>

          {/* Posts column */}
          <section className="md:col-span-2">
            {filteredPosts.length === 0 && (
              <p className="text-[#0F2A44]/80">No posts match your filters.</p>
            )}

            {/* Use GRID with row gaps so the blue bg is visible between cards */}
            <div className="grid grid-cols-1 gap-6 md:gap-8">
              {filteredPosts.map(({ slug, meta }) => (
                <article
                  key={slug}
                  className="group rounded-2xl p-5 md:p-6 bg-white/65 backdrop-blur-md border border-white/50 shadow-sm transition hover:shadow-[0_0_0_2px_#FF8A00,0_0_24px_#FF8A00]"
                >
                  <Link href={`/blog/${slug}`} className="block">
                    <h2 className="text-2xl md:text-3xl font-extrabold leading-tight text-[#0F2A44]">
                      {meta.title}
                    </h2>
                  </Link>

                  <p className="mt-1 text-xs md:text-sm text-[#0F2A44]/70">
                    {new Date(meta.date).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>

                  {meta.excerpt && (
                    <p className="mt-3 text-sm md:text-base text-[#0F2A44]/90">
                      {meta.excerpt}
                    </p>
                  )}

                  <div className="mt-4">
                    <Link
                      href={`/blog/${slug}`}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F2A44] hover:shadow-[0_0_0_2px_#FF8A00,0_0_16px_#FF8A00] rounded-lg px-2 py-1 transition"
                      aria-label={`Read post: ${meta.title}`}
                    >
                      Read post
                      <span aria-hidden>→</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
