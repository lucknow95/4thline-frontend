// src/app/blog/[slug]/page.tsx
import AffiliateDisclosure from '@/components/AffiliateDisclosure';
import fs from 'fs';
import matter from 'gray-matter';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import path from 'path';
import rehypeStringify from 'rehype-stringify';
import { remark } from 'remark';
import remarkRehype from 'remark-rehype';
import type { Plugin, Transformer } from 'unified';
import { visit } from 'unist-util-visit';

export const dynamic = 'force-static';

/* =============================================================================
   Affiliate config (rough-in)
   ========================================================================== */
const AFFILIATES = {
  fanatics: {
    enabled: true,
    hostIncludes: ['fanatics.com', 'fanatics.ca', 'fanatics.93n6tx.net'],
    // Minimal UTMs; your fanatics.93n6tx.net links already track. Tweak later.
    params: {
      utm_source: '4thlinefantasy',
      utm_medium: 'blog',
      utm_campaign: 'affiliate',
    } as Record<string, string>,
  },
};

/* =============================================================================
   Helpers
   ========================================================================== */
function normalizeTitle(s: string) {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/** remark plugin factory: ensure single H1
 *  - Remove first MD H1 if it matches pageTitle
 *  - Demote any other MD H1s to H2
 */
function remarkSingleH1(pageTitle: string): Plugin {
  const plugin: Plugin = function thisPlugin(): Transformer {
    return (tree: any) => {
      let removedMatchingH1 = false;

      (visit as any)(tree, 'heading', (node: any, index?: number, parent?: any) => {
        if (!parent || index == null) return;
        if (node.depth !== 1) return;

        const text = (node.children ?? [])
          .filter((c: any) => c.type === 'text' || c.type === 'inlineCode')
          .map((c: any) => String(c.value ?? ''))
          .join('')
          .trim();

        if (!removedMatchingH1 && normalizeTitle(text) === normalizeTitle(pageTitle)) {
          parent.children.splice(index, 1); // remove matching H1
          removedMatchingH1 = true;
          return;
        }

        // Any other H1 becomes H2
        node.depth = 2;
      });
    };
  };

  return plugin;
}

/** remark plugin: Markdown shortcode → Fanatics callout
 * Usage in .md:
 *   [[fanatics title="Boston Bruins Hoodie" url="https://fanatics.93n6tx.net/c/6390525/586570/9663" note="Free shipping over $X"]]
 */
function remarkFanaticsShortcode(): Plugin {
  const plugin: Plugin = function thisPlugin(): Transformer {
    const re = /\[\[\s*fanatics\s+([^[\]]+?)\s*\]\]/gi;

    return (tree: any) => {
      (visit as any)(tree, 'paragraph', (node: any, index?: number, parent?: any) => {
        if (!parent || index == null) return;

        if (
          node.children?.length !== 1 ||
          node.children[0].type !== 'text' ||
          typeof node.children[0].value !== 'string'
        ) {
          return;
        }

        const raw = node.children[0].value as string;
        const m = re.exec(raw);
        re.lastIndex = 0;
        if (!m || !m[1]) return;

        const attrs = m[1];
        const kv: Record<string, string> = {};
        attrs.replace(/(\w+)\s*=\s*"([^"]*)"/g, (_: any, k: string, v: string) => {
          kv[k] = v;
          return '';
        });

        const title = kv.title || 'Shop at Fanatics';
        const url = kv.url || '';
        const note = kv.note || '';
        if (!url) return;

        // Build safe URL with our UTMs if not present
        let finalUrl = url;
        try {
          const u = new URL(url, 'https://example.com'); // handles relative too
          Object.entries(AFFILIATES.fanatics.params).forEach(([k, v]) => {
            if (!u.searchParams.has(k)) u.searchParams.set(k, v);
          });
          finalUrl = u.toString();
        } catch {
          /* keep original on parse error */
        }

        // Replace the paragraph with raw HTML (allowed later by allowDangerousHtml)
        parent.children.splice(index, 1, {
          type: 'html',
          value: `
<div class="my-6 md:my-8 rounded-2xl p-4 md:p-5 bg-white/70 backdrop-blur-md border border-white/50 shadow-sm">
  <div class="flex items-start justify-between gap-4">
    <div>
      <div class="text-sm uppercase tracking-wide text-[#0F2A44]/70 font-semibold">Fanatics Pick</div>
      <div class="mt-1 text-lg font-bold text-[#0F2A44]">${escapeHtml(title)}</div>
      ${note ? `<div class="mt-1 text-sm text-[#0F2A44]/80">${escapeHtml(note)}</div>` : ''}
    </div>
    <a href="${escapeHtml(finalUrl)}" target="_blank" rel="noopener noreferrer"
       class="shrink-0 inline-flex items-center justify-center px-3 py-2 rounded-xl font-semibold text-white bg-[#0F2A44] hover:bg-[#0F2A44] transition shadow hover:shadow-[0_0_0_2px_#FF8A00,0_0_20px_#FF8A00]">
      Shop at Fanatics →
    </a>
  </div>
</div>`.trim(),
        });
      });
    };
  };

  return plugin;
}

/** rehype plugin: decorate plain <a> links to Fanatics (outside shortcodes) */
function rehypeFanaticsLinks(): Plugin {
  const plugin: Plugin = function thisPlugin(): Transformer {
    return (tree: any) => {
      const cfg = AFFILIATES.fanatics;
      if (!cfg.enabled) return;

      (visit as any)(tree, 'element', (node: any) => {
        if (node.tagName !== 'a') return;
        const href = node.properties?.href as string | undefined;
        if (!href) return;

        try {
          const url = new URL(href, 'https://example.com');
          const host = url.host.toLowerCase();

          if (cfg.hostIncludes.some((h) => host.includes(h))) {
            Object.entries(cfg.params).forEach(([k, v]) => {
              if (!url.searchParams.has(k)) url.searchParams.set(k, v);
            });
            node.properties.href = url.toString();
            node.properties.target = node.properties.target || '_blank';
            node.properties.rel = node.properties.rel || 'noopener noreferrer';
          }
        } catch {
          /* ignore malformed URLs */
        }
      });
    };
  };

  return plugin;
}

export default async function BlogPostPage({
  params,
}: {
  // Next 15: params is a Promise
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!slug) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-red-600 mb-4">Invalid Blog URL</h1>
        <p className="text-gray-600">No blog post selected.</p>
      </main>
    );
  }

  const postPath = path.join(process.cwd(), 'content/blog', `${slug}.md`);
  if (!fs.existsSync(postPath)) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-red-600 mb-4">404 - Post Not Found</h1>
        <p className="text-gray-600">The requested post doesn’t exist.</p>
      </main>
    );
  }

  const fileContents = fs.readFileSync(postPath, 'utf8');
  const { data, content } = matter(fileContents);

  // Hide drafts entirely
  if (data?.draft === true) {
    notFound();
  }

  const title =
    (data?.title as string) ||
    slug.replace(/-/g, ' ').replace(/\b\w/g, (m: string) => m.toUpperCase());

  // Markdown → HTML with:
  //  - Single-H1 rule
  //  - Fanatics shortcode → callout
  //  - Fanatics link decoration
  const processed = await remark()
    .use(remarkSingleH1(title))
    .use(remarkFanaticsShortcode())
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeFanaticsLinks())
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(content);

  const contentHtml = String(processed);

  const dateStr = data?.date
    ? new Date(data.date as string).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    : '';

  const tags = (data?.tags as string[]) || [];
  const categories = (data?.categories as string[]) || [];

  return (
    <main className="relative min-h-screen">
      {/* Ice background */}
      <div
        className="absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 40%, #E6F4FF 0%, #BFE4FF 45%, #5CAFE8 85%)',
        }}
      />

      <div className="mx-auto max-w-4xl px-4 py-10 md:py-12">
        <div className="mb-6">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F2A44] rounded-lg px-2 py-1 transition hover:shadow-[0_0_0_2px_#FF8A00,0_0_16px_#FF8A00]"
            aria-label="Back to blog"
          >
            ← Back to Blog
          </Link>
        </div>

        {/* Frosted article card */}
        <article className="rounded-2xl p-6 md:p-8 bg-white/70 backdrop-blur-md border border-white/50 shadow-sm">
          <header className="mb-6 md:mb-8">
            <h1 className="text-3xl md:text-4xl font-extrabold leading-tight text-[#0F2A44]">
              {title}
            </h1>
            {dateStr && (
              <p className="mt-2 text-sm md:text-base text-[#0F2A44]/70">
                {dateStr}
              </p>
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

          {/* Comfortable reading column with consistent rhythm */}
          <div
            className="
              prose prose-lg md:prose-lg
              mx-auto max-w-[72ch] text-[#0F2A44] leading-relaxed
              prose-headings:text-[#0F2A44]
              prose-a:font-semibold prose-a:no-underline
              hover:prose-a:shadow-[0_0_0_2px_#FF8A00,0_0_12px_#FF8A00]
              prose-strong:text-[#0F2A44]
              prose-hr:border-[#5CAFE8]/40 prose-hr:my-10
              prose-blockquote:border-l-4 prose-blockquote:border-[#5CAFE8]/50 prose-blockquote:pl-4 prose-blockquote:my-8
              prose-figcaption:text-[#0F2A44]/70
              prose-p:mb-6 md:prose-p:mb-7
              prose-ul:my-6 prose-ol:my-6
              prose-li:my-2
              prose-h2:mt-12 prose-h2:mb-3
              prose-h3:mt-8 prose-h3:mb-2.5
              prose-table:my-8 prose-img:my-8
            "
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />

          <AffiliateDisclosure />
        </article>

        <div className="mt-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F2A44] rounded-lg px-2 py-1 transition hover:shadow-[0_0_0_2px_#FF8A00,0_0_16px_#FF8A00]"
            aria-label="Back to blog"
          >
            ← Back to Blog
          </Link>
        </div>
      </div>
    </main>
  );
}
