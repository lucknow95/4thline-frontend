// src/app/page.tsx
import { getBlogPosts } from "@/lib/getBlogPosts";
import Link from "next/link";
import type { ReactNode } from "react";

type RawPost = Awaited<ReturnType<typeof getBlogPosts>>[number];

type FlatPost = {
  slug: string;
  title: string;
  date: string; // ISO
  excerpt?: string;
  tags?: string[];
  categories?: string[];
};

function flattenPost(p: RawPost): FlatPost {
  const r = p as unknown as {
    slug?: string;
    title?: string;
    date?: string | Date;
    excerpt?: string;
    tags?: string[];
    categories?: string[];
    metadata?: Partial<FlatPost> & { date?: string | Date };
    frontmatter?: Partial<FlatPost> & { date?: string | Date };
    meta?: Partial<FlatPost> & { date?: string | Date };
  };

  const meta = r.metadata ?? r.frontmatter ?? r.meta ?? {};
  const slug = r.slug ?? "";
  const title = r.title ?? meta.title ?? "Untitled";
  const rawDate = r.date ?? meta.date ?? new Date(0);
  const date =
    typeof rawDate === "string" ? rawDate : new Date(rawDate).toISOString();

  const ex = r.excerpt ?? meta.excerpt;
  const tags = r.tags ?? meta.tags;
  const categories = r.categories ?? meta.categories;

  return {
    slug,
    title,
    date,
    ...(typeof ex === "string" ? { excerpt: ex } : {}),
    ...(Array.isArray(tags) ? { tags } : {}),
    ...(Array.isArray(categories) ? { categories } : {}),
  };
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xl font-semibold tracking-tight leading-tight">
      {children}
    </h2>
  );
}

export default async function HomePage() {
  let raw: RawPost[] = [];
  try {
    raw = await getBlogPosts();
  } catch {
    raw = [];
  }
  const posts = raw.map(flattenPost);
  const latest = [...posts]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 3);

  // Comfy buffer on all cards (you asked for a big, obvious gap)
  const padX = "px-24 sm:px-28 lg:px-32";
  const padY = "py-16 sm:py-20 lg:py-24";
  const pad = `${padX} ${padY}`;

  const cardBase =
    "group block box-border overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-sm transition-colors duration-150 " +
    "hover:bg-amber-50 hover:border-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2";

  const titleCls =
    "text-[1rem] sm:text-[1.06rem] lg:text-[1.1rem] font-semibold leading-snug tracking-tight break-words " +
    "group-hover:text-amber-800";

  const bodyCls =
    "mt-3 text-[0.95rem] lg:text-base text-neutral-700 leading-7 break-words hyphens-auto";

  const linkHover =
    "font-medium underline underline-offset-4 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2";

  return (
    <main className="mx-auto max-w-6xl px-5 sm:px-6 md:px-8 py-10">
      {/* HERO — white, big buffer */}
      <section className={`rounded-lg border border-neutral-300 bg-white ${pad} text-neutral-900 shadow-sm`}>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
          4th Line Fantasy
        </h1>
        <p className="mt-4 text-sm sm:text-base text-neutral-700 leading-7">
          Smarter fantasy hockey decisions with schedule edges, player tools, and clean data.
          Free tools now—premium features later.
        </p>
      </section>

      {/* NEWSLETTER */}
      <section className={`${cardBase} ${pad} mt-10`}>
        <SectionHeading>Newsletter: what you’ll get</SectionHeading>
        <p className={bodyCls}>
          Quick, actionable fantasy edges: weekly schedule highlights (off-night streams),
          streaming targets by category (HIT, BLK, SOG, PPP), short strategy notes, and site updates.
          Read more & sign up on the{" "}
          <Link href="/newsletter" className={linkHover}>
            Newsletter page
          </Link>
          .
        </p>
      </section>

      {/* FEATURES */}
      <section className="mt-10">
        <SectionHeading>What’s inside</SectionHeading>
        <div className="mt-4 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Player Rankings",
              desc:
                "Sort by G, A, PIM, PPP, SHP, SOG, FW, HIT, BLK—totals or per-game, with team & day filters.",
              href: "/rankings",
            },
            {
              title: "Blog",
              desc: "Short strategy posts, streaming picks, schedule talk, and build updates.",
              href: "/blog",
            },
            {
              title: "Crunch Palace (soon)",
              desc: "Arena-by-arena hits tracking to spot ‘friendly’ barns for peripherals.",
              href: "/crunch-palace",
            },
            {
              title: "Player Pages & Logs (soon)",
              desc: "Game logs with home/away splits and upcoming schedule views.",
              href: "/players",
            },
            {
              title: "Schedule Optimizer (soon)",
              desc: "Plan medium-term moves by total games and off-nights over the next month.",
              href: "/optimizer",
            },
          ].map((f) => (
            <Link key={f.title} href={f.href} className={`${cardBase} ${pad}`}>
              <div className={titleCls}>{f.title}</div>
              <div className={bodyCls}>{f.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* LATEST POSTS */}
      <section className="mt-10">
        <SectionHeading>Latest posts</SectionHeading>
        {latest.length === 0 ? (
          <div className="mt-3 text-sm text-neutral-600">
            No posts yet. Your first article will appear here.
          </div>
        ) : (
          <div className="mt-4 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((p) => {
              const date = new Date(p.date).toLocaleDateString("en-CA", {
                year: "numeric",
                month: "long",
                day: "numeric",
              });
              return (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className={`${cardBase} ${pad}`}
                >
                  <div className={titleCls}>{p.title}</div>
                  <div className="mt-2 text-xs text-neutral-500">{date}</div>
                  {"excerpt" in p && p.excerpt ? (
                    <div className={bodyCls + " mt-3 line-clamp-3"}>{p.excerpt}</div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        )}
        <div className="mt-6">
          <Link href="/blog" className={linkHover}>
            View all posts
          </Link>
        </div>
      </section>
    </main>
  );
}
