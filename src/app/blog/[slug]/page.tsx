// src/app/blog/[slug]/page.tsx
import AffiliateDisclosure from "@/components/AffiliateDisclosure";
import fs from "fs";
import matter from "gray-matter";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import path from "path";
import rehypeStringify from "rehype-stringify";
import { remark } from "remark";
import remarkRehype from "remark-rehype";
import type { Plugin, Transformer } from "unified";
import { visit } from "unist-util-visit";

export const dynamic = "force-static";

/* =============================================================================
   Affiliate config
   ========================================================================== */
const AFFILIATES = {
  fanatics: {
    enabled: true,
    defaultUrl: "https://fanatics.93n6tx.net/c/6390525/586570/9663",
    decorateHosts: ["fanatics.com", "fanatics.ca"],
    params: {
      utm_source: "4thlinefantasy",
      utm_medium: "blog",
      utm_campaign: "affiliate",
    } as Record<string, string>,
    // tiny logo used inside the callout box
    logoSrc: "/images/brands/fanatics.jpeg",
  },
};

/* =============================================================================
   Paths / helpers
   ========================================================================== */
const BLOG_DIR = path.join(process.cwd(), "content", "blog");

function normalizeTitle(s: string) {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadPost(slug: string) {
  const md = path.join(BLOG_DIR, `${slug}.md`);
  const mdx = path.join(BLOG_DIR, `${slug}.mdx`);
  const postPath = fs.existsSync(md) ? md : (fs.existsSync(mdx) ? mdx : null);
  if (!postPath) return null;
  const file = fs.readFileSync(postPath, "utf8");
  return matter(file);
}

/* =============================================================================
   remark plugin: ensure single H1
   ========================================================================== */
function remarkSingleH1(pageTitle: string): Plugin {
  const plugin: Plugin = function thisPlugin(): Transformer {
    return (tree: any) => {
      let removedMatchingH1 = false;

      (visit as any)(tree, "heading", (node: any, index?: number, parent?: any) => {
        if (!parent || index == null) return;
        if (node.depth !== 1) return;

        const text = (node.children ?? [])
          .filter((c: any) => c.type === "text" || c.type === "inlineCode")
          .map((c: any) => String(c.value ?? ""))
          .join("")
          .trim();

        if (!removedMatchingH1 && normalizeTitle(text) === normalizeTitle(pageTitle)) {
          parent.children.splice(index, 1); // remove matching H1
          removedMatchingH1 = true;
          return;
        }

        // demote any other H1 to H2
        node.depth = 2;
      });
    };
  };

  return plugin;
}

/* =============================================================================
   remark plugin: [[fanatics ...]] shortcode → clickable brand callout
   Supports: url, note, title
   ========================================================================== */
function remarkFanaticsShortcode(): Plugin {
  const plugin: Plugin = function thisPlugin(): Transformer {
    const re = /\[\[\s*fanatics(?:\s+([^[\]]+?))?\s*\]\]/gi;

    return (tree: any) => {
      (visit as any)(tree, "paragraph", (node: any, index?: number, parent?: any) => {
        if (!parent || index == null) return;

        if (
          node.children?.length !== 1 ||
          node.children[0].type !== "text" ||
          typeof node.children[0].value !== "string"
        )
          return;

        const raw = node.children[0].value as string;
        const m = re.exec(raw);
        re.lastIndex = 0;
        if (!m) return;

        // parse key="value" pairs
        const attrs = m[1] ?? "";
        const kv: Record<string, string> = {};
        attrs.replace(/(\w+)\s*=\s*"([^"]*)"/g, (_: any, k: string, v: string) => {
          kv[k] = v;
          return "";
        });

        // destination: provided url or default tracking link
        let finalUrl = kv.url || AFFILIATES.fanatics.defaultUrl;

        // decorate plain fanatics.com/.ca with UTM (skip tracking domain)
        try {
          const u = new URL(finalUrl, "https://example.com");
          const host = u.host.toLowerCase();
          if (AFFILIATES.fanatics.decorateHosts.some((h) => host.includes(h))) {
            Object.entries(AFFILIATES.fanatics.params).forEach(([k, v]) => {
              if (!u.searchParams.has(k)) u.searchParams.set(k, v);
            });
            finalUrl = u.toString();
          }
        } catch {
          /* ignore bad urls */
        }

        const note = kv.note || "Officially licensed gear";
        const heading =
          kv.title && kv.title.trim().length > 0
            ? kv.title
            : "Get your licensed gear at Fanatics";

        parent.children.splice(index, 1, {
          type: "html",
          value: `
<a href="${escapeHtml(finalUrl)}" target="_blank" rel="noopener noreferrer"
   class="group block my-6 md:my-8 rounded-2xl p-4 md:p-5 bg-white/70 backdrop-blur-md border border-white/50 shadow-sm transition
          hover:shadow-[0_0_0_2px_#FF8A00,0_0_20px_#FF8A00]">
  <div class="flex items-center justify-between gap-4">
    <div class="flex items-center gap-2">
      <img src="${escapeHtml(AFFILIATES.fanatics.logoSrc)}" alt="Fanatics" class="h-4 w-auto" />
      <div class="text-sm uppercase tracking-wide text-[#0F2A44]/70 font-semibold">FANATICS PICK</div>
    </div>
    <div class="hidden sm:block rounded-full px-3 py-1 text-xs font-semibold bg-[#0F2A44] text-white">
      Shop Fanatics →
    </div>
  </div>
  <div class="mt-2 text-lg font-bold text-[#0F2A44]">${escapeHtml(heading)}</div>
  ${note ? `<div class="mt-1 text-sm text-[#0F2A44]/80">${escapeHtml(note)}</div>` : ""}
</a>`.trim(),
        });
      });
    };
  };

  return plugin;
}

/* =============================================================================
   rehype plugin: decorate plain <a> links to Fanatics (outside shortcodes)
   ========================================================================== */
function rehypeFanaticsLinks(): Plugin {
  const plugin: Plugin = function thisPlugin(): Transformer {
    return (tree: any) => {
      const cfg = AFFILIATES.fanatics;
      if (!cfg.enabled) return;

      (visit as any)(tree, "element", (node: any) => {
        if (node.tagName !== "a") return;
        const href = node.properties?.href as string | undefined;
        if (!href) return;

        try {
          const url = new URL(href, "https://example.com");
          const host = url.host.toLowerCase();

          // Only decorate fanatics.com/.ca (never the tracking domain)
          if (cfg.decorateHosts.some((h) => host.includes(h))) {
            Object.entries(cfg.params).forEach(([k, v]) => {
              if (!url.searchParams.has(k)) url.searchParams.set(k, v);
            });
            node.properties.href = url.toString();
          }

          // Always add safety attrs
          node.properties.target = node.properties.target || "_blank";
          node.properties.rel = node.properties.rel || "noopener noreferrer";
        } catch {
          /* ignore malformed URLs */
        }
      });
    };
  };

  return plugin;
}

/* =============================================================================
   Metadata (OG/Twitter) — use frontmatter image keys or fallback
   ========================================================================== */
function pickFirst(...vals: unknown[]) {
  return vals.find(v => typeof v === "string" && v.trim().length > 0) as string | undefined;
}

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const { slug } = params;
  const loaded = loadPost(slug);
  if (!loaded) return { title: "Post not found" };

  const { data } = loaded as { data: Record<string, unknown> };

  const title =
    (data?.title as string) ||
    slug.replace(/-/g, " ").replace(/\b\w/g, (m: string) => m.toUpperCase());
  const description =
    (data?.excerpt as string) ||
    (data?.description as string) ||
    "4th Line Fantasy blog post";

  // Accept multiple possible keys from frontmatter
  const ogSrc =
    pickFirst(data?.thumbnail, data?.image, data?.cover, data?.coverImage) ||
    "/og/default-og.png";

  // Optional article metadata if present
  const authors = Array.isArray(data?.author)
    ? (data?.author as string[])
    : data?.author
      ? [String(data?.author)]
      : undefined;
  const publishedTime = data?.date ? new Date(String(data.date)).toISOString() : undefined;

  return {
    title,
    description,
    openGraph: {
      type: "article",
      title,
      description,
      url: `/blog/${slug}`,
      images: [{ url: ogSrc, width: 1200, height: 630, alt: title }],
      authors,
      publishedTime,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogSrc],
    },
  };
}

/* =============================================================================
   Page
   ========================================================================== */
export default async function BlogPostPage(
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  if (!slug) {
    return (
      <main className="flex justify-center relative min-h-screen">
        <div
          className="absolute inset-0 -z-10"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 40%, #E6F4FF 0%, #BFE4FF 45%, #5CAFE8 85%)",
          }}
        />
        <div className="w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-10 md:py-12">
          <h1 className="text-3xl font-bold text-red-600 mb-4">Invalid Blog URL</h1>
          <p className="text-gray-600">No blog post selected.</p>
        </div>
      </main>
    );
  }

  const loaded = loadPost(slug);
  if (!loaded) {
    return (
      <main className="flex justify-center relative min-h-screen">
        <div
          className="absolute inset-0 -z-10"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 40%, #E6F4FF 0%, #BFE4FF 45%, #5CAFE8 85%)",
          }}
        />
        <div className="w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-10 md:py-12">
          <h1 className="text-3xl font-bold text-red-600 mb-4">404 - Post Not Found</h1>
          <p className="text-gray-600">The requested post doesn’t exist.</p>
        </div>
      </main>
    );
  }

  const { data, content } = loaded;

  if ((data as any)?.draft === true) {
    notFound();
  }

  const title =
    ((data as any)?.title as string) ||
    slug.replace(/-/g, " ").replace(/\b\w/g, (m: string) => m.toUpperCase());

  const processed = await remark()
    .use(remarkSingleH1(title))
    .use(remarkFanaticsShortcode())
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeFanaticsLinks())
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(content);

  const contentHtml = String(processed);

  const dateStr = (data as any)?.date
    ? new Date((data as any).date as string).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    : "";

  const tags = ((data as any)?.tags as string[]) || [];
  const categories = ((data as any)?.categories as string[]) || [];

  /* ---------- HERO IMAGE (with real existence check + remote unoptimized) ---------- */
  const FALLBACK_HERO = "/images/brands/fanatics.jpeg";
  const fmHero =
    (data as any)?.thumbnail ||
    (data as any)?.image ||
    (data as any)?.cover ||
    (data as any)?.coverImage ||
    "";

  const stripQuery = (p: string): string => {
    const i = p.indexOf("?");
    return i === -1 ? p : p.slice(0, i);
  };
  const ensureLeadingSlash = (p: string) => (p.startsWith("/") ? p : `/${p}`);
  const publicFileExists = (p: string) =>
    fs.existsSync(path.join(process.cwd(), "public", p.replace(/^\//, "")));

  let heroImage: string = FALLBACK_HERO;
  let isFallbackHero = true;
  let isRemoteHero = false;

  if (typeof fmHero === "string" && fmHero.trim().length > 0) {
    const raw = fmHero.trim();
    if (/^https?:\/\//i.test(raw)) {
      // Remote URL → render unoptimized to avoid next.config domain errors
      heroImage = raw;
      isFallbackHero = false;
      isRemoteHero = true;
    } else {
      const cleaned = ensureLeadingSlash(stripQuery(raw.replace(/^\/+/, "")));
      if (publicFileExists(cleaned)) {
        heroImage = cleaned;
        isFallbackHero = false;
      } else {
        heroImage = FALLBACK_HERO;
        isFallbackHero = true;
      }
    }
  }

  return (
    <main className="relative min-h-screen flex justify-center">
      {/* Ice background */}
      <div
        className="absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 40%, #E6F4FF 0%, #BFE4FF 45%, #5CAFE8 85%)",
        }}
      />

      {/* Centered wrapper that controls the content width */}
      <div className="w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-10 md:py-12">
        <div className="mb-6">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F2A44] rounded-lg px-2 py-1 transition hover:shadow-[0_0_0_2px_#FF8A00,0_0,16px_#FF8A00]"
            aria-label="Back to blog"
          >
            ← Back to Blog
          </Link>
        </div>

        {/* Hero */}
        <div className="rounded-2xl overflow-hidden bg-white/70 backdrop-blur-md border border-white/50 shadow-sm">
          <div
            className={
              isFallbackHero
                ? "relative w-full h-56 md:h-72 flex items-center justify-center"
                : "relative w-full aspect-[16/9]"
            }
          >
            <Image
              src={heroImage}
              alt={typeof (data as any)?.title === "string" ? (data as any).title : "Blog hero image"}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              className={isFallbackHero ? "object-contain p-6 bg-white" : "object-cover"}
              quality={isFallbackHero ? 100 : 90}
              unoptimized={isRemoteHero}
            />
          </div>
        </div>

        {/* Article */}
        <article className="mt-6 md:mt-8 rounded-2xl px-6 md:px-10 py-8 md:py-10 bg-white/80 backdrop-blur-md border border-white/50 shadow-sm">

          {/* Title block */}
          <header className="mb-6 md:mb-8">
            <h1 className="text-3xl md:text-4xl font-extrabold leading-tight text-[#0F2A44]">
              {title}
            </h1>
            {dateStr && (
              <p className="mt-2 text-sm md:text-base text-[#0F2A44]/70">{dateStr}</p>
            )}
            {(tags.length > 0 || categories.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <span
                    key={`cat-${c}`}
                    className="px-2 py-1 text-xs font-semibold rounded-full bg-white/80 border border-white/50 text-[#0F2A44]"
                    title="Category"
                  >
                    {c}
                  </span>
                ))}
                {tags.map((t) => (
                  <span
                    key={`tag-${t}`}
                    className="px-2 py-1 text-xs font-medium rounded-full bg-white/80 border border-white/50 text-[#0F2A44]"
                    title="Tag"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </header>

          {/* Polished reading styles */}
          <div
            className={[
              // base
              "prose md:prose-lg max-w-[72ch] mx-auto text-[#0F2A44]",
              // headings
              "prose-headings:font-extrabold prose-headings:text-[#0F2A44] prose-h2:mt-12 prose-h2:mb-3 prose-h3:mt-8 prose-h3:mb-2.5",
              // paragraphs & lists
              "prose-p:my-4 md:prose-p:my-5 prose-ul:my-5 prose-ol:my-5 prose-li:my-1.5",
              // links
              "prose-a:font-semibold prose-a:no-underline hover:prose-a:underline hover:prose-a:decoration-2 hover:prose-a:underline-offset-4",
              // emphasis
              "prose-strong:text-[#0F2A44]",
              // hr & blockquote
              "prose-hr:border-[#5CAFE8]/40 prose-hr:my-10",
              "prose-blockquote:pl-5 prose-blockquote:border-l-4 prose-blockquote:border-[#5CAFE8]/50 prose-blockquote:text-[#0F2A44]/80",
              // images & figures
              "prose-img:rounded-xl prose-img:shadow-sm prose-img:my-6",
              "prose-figure:my-8 prose-figcaption:text-sm prose-figcaption:text-[#0F2A44]/70",
              // code
              "prose-pre:rounded-xl prose-pre:p-4 prose-pre:bg-slate-900 prose-pre:text-slate-100",
              "prose-code:px-1.5 prose-code:py-0.5 prose-code:bg-slate-100 prose-code:rounded",
              // tables
              "prose-table:my-6 prose-th:font-semibold",
            ].join(" ")}
            // Rendered HTML from remark/rehype
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />

          {/* Disclosure */}
          <div className="mt-10">
            <AffiliateDisclosure />
          </div>
        </article>

        <div className="mt-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F2A44] rounded-lg px-2 py-1 transition hover:shadow-[0_0_0_2px_#FF8A00,0_0,16px_#FF8A00]"
            aria-label="Back to blog"
          >
            ← Back to Blog
          </Link>
        </div>
      </div>
    </main>
  );
}
