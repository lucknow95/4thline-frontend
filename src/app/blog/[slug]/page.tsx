import fs from "fs";
import matter from "gray-matter";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import path from "path";
import rehypeStringify from "rehype-stringify";
import { remark } from "remark";
import remarkRehype from "remark-rehype";
import type { Plugin, Transformer } from "unified";
import { visit } from "unist-util-visit";

export const dynamic = "force-static";

const BUY_ME_A_COFFEE_URL = "https://www.buymeacoffee.com/samirwin";
const ETSY_SHOP_URL = "https://www.etsy.com/shop/4thLineFantasy";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

function loadPost(slug: string) {
  const md = path.join(BLOG_DIR, `${slug}.md`);
  const mdx = path.join(BLOG_DIR, `${slug}.mdx`);
  const postPath = fs.existsSync(md) ? md : fs.existsSync(mdx) ? mdx : null;

  if (!postPath) {
    return null;
  }

  const file = fs.readFileSync(postPath, "utf8");
  return matter(file);
}

function remarkRemoveFirstH1(): Plugin {
  const plugin: Plugin = function thisPlugin(): Transformer {
    return (tree: any) => {
      let removedFirstH1 = false;

      (visit as any)(tree, "heading", (node: any, index?: number, parent?: any) => {
        if (!parent || index == null) return;
        if (node.depth !== 1) return;

        if (!removedFirstH1) {
          parent.children.splice(index, 1);
          removedFirstH1 = true;
          return;
        }

        node.depth = 2;
      });
    };
  };

  return plugin;
}

function remarkRemoveFanaticsShortcode(): Plugin {
  const plugin: Plugin = function thisPlugin(): Transformer {
    const re = /\[\[\s*fanatics(?:\s+([^[\]]+?))?\s*\]\]/gi;

    return (tree: any) => {
      (visit as any)(tree, "paragraph", (node: any, index?: number, parent?: any) => {
        if (!parent || index == null) return;

        const paragraphText = (node.children ?? [])
          .map((child: any) => String(child.value ?? ""))
          .join("");

        if (re.test(paragraphText)) {
          parent.children.splice(index, 1);
        }

        re.lastIndex = 0;
      });
    };
  };

  return plugin;
}

function pickFirst(...vals: unknown[]) {
  return vals.find(
    (value) => typeof value === "string" && value.trim().length > 0
  ) as string | undefined;
}

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const { slug } = params;
  const loaded = loadPost(slug);

  if (!loaded) {
    return { title: "Post not found" };
  }

  const { data } = loaded as { data: Record<string, unknown> };

  const title =
    (data?.title as string) ||
    slug.replace(/-/g, " ").replace(/\b\w/g, (m: string) => m.toUpperCase());

  const description =
    (data?.excerpt as string) ||
    (data?.description as string) ||
    "4th Line Fantasy blog post";

  const ogSrc =
    pickFirst(data?.thumbnail, data?.image, data?.cover, data?.coverImage) ||
    "/og/default-og.png";

  const authors = Array.isArray(data?.author)
    ? (data?.author as string[])
    : data?.author
      ? [String(data?.author)]
      : undefined;

  const publishedTime = data?.date
    ? new Date(String(data.date)).toISOString()
    : undefined;

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
          <h1 className="text-3xl font-bold text-red-600 mb-4">
            Invalid Blog URL
          </h1>

          <p className="text-gray-600">
            No blog post selected.
          </p>
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
          <h1 className="text-3xl font-bold text-red-600 mb-4">
            404 - Post Not Found
          </h1>

          <p className="text-gray-600">
            The requested post doesn’t exist.
          </p>
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
    .use(remarkRemoveFirstH1())
    .use(remarkRemoveFanaticsShortcode())
    .use(remarkRehype, { allowDangerousHtml: true })
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

  return (
    <main className="relative min-h-screen flex justify-center">
      <div
        className="absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 40%, #E6F4FF 0%, #BFE4FF 45%, #5CAFE8 85%)",
        }}
      />

      <div className="w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-10 md:py-12">
        <div className="mb-7 md:mb-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F2A44] rounded-lg px-2 py-1 transition hover:shadow-[0_0_0_2px_#FF8A00,0_0_16px_#FF8A00]"
            aria-label="Back to blog"
          >
            ← Back to Blog
          </Link>
        </div>

        <article className="rounded-2xl px-5 sm:px-7 md:px-12 py-8 md:py-12 bg-white/84 backdrop-blur-md border border-white/50 shadow-sm">
          <header className="mb-16 md:mb-20 max-w-[76ch] mx-auto">
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight text-[#0F2A44]">
              {title}
            </h1>

            {dateStr && (
              <p className="mt-4 text-sm md:text-base font-medium text-[#0F2A44]/65">
                {dateStr}
              </p>
            )}

            {(data as any)?.excerpt && (
              <p className="mt-7 text-lg md:text-xl leading-8 text-[#0F2A44]/82">
                {(data as any).excerpt}
              </p>
            )}
          </header>

          <div
            className={[
              "prose md:prose-lg max-w-[76ch] mx-auto text-[#0F2A44]",
              "prose-headings:font-extrabold prose-headings:tracking-tight prose-headings:text-[#0F2A44]",
              "prose-h2:mt-20 prose-h2:mb-6 prose-h2:pb-2 prose-h2:border-b prose-h2:border-[#5CAFE8]/35",
              "prose-h3:mt-14 prose-h3:mb-5",
              "prose-h4:inline-block prose-h4:mt-12 prose-h4:mb-5 prose-h4:rounded-xl prose-h4:bg-[#FF8A00]/18 prose-h4:px-4 prose-h4:py-2 prose-h4:text-base prose-h4:font-extrabold prose-h4:text-[#0F2A44] prose-h4:border prose-h4:border-[#FF8A00]/60 prose-h4:shadow-[0_0_0_2px_rgba(255,138,0,0.22),0_0_18px_rgba(255,138,0,0.28)]",
              "prose-p:my-5 md:prose-p:my-6 prose-p:leading-8",
              "prose-ul:my-6 prose-ol:my-6 prose-li:my-2 prose-li:leading-8",
              "prose-a:font-bold prose-a:text-[#0F2A44] prose-a:no-underline hover:prose-a:underline hover:prose-a:decoration-2 hover:prose-a:underline-offset-4",
              "prose-strong:text-[#0F2A44] prose-strong:font-extrabold",
              "prose-hr:border-[#5CAFE8]/40 prose-hr:mt-16 prose-hr:mb-16",
              "prose-blockquote:my-10 prose-blockquote:rounded-2xl prose-blockquote:bg-[#E6F4FF]/70 prose-blockquote:px-5 prose-blockquote:py-4 prose-blockquote:border-l-4 prose-blockquote:border-[#FF8A00] prose-blockquote:text-[#0F2A44]/85",
              "prose-img:rounded-xl prose-img:shadow-sm prose-img:my-8",
              "prose-figure:my-8 prose-figcaption:text-sm prose-figcaption:text-[#0F2A44]/70",
              "prose-pre:rounded-xl prose-pre:p-4 prose-pre:bg-slate-900 prose-pre:text-slate-100",
              "prose-code:px-1.5 prose-code:py-0.5 prose-code:bg-slate-100 prose-code:rounded",
              "prose-table:my-8 prose-th:font-semibold",
            ].join(" ")}
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />

          <section className="mt-12 md:mt-14 max-w-[76ch] mx-auto rounded-2xl bg-[#0F2A44] text-white p-5 md:p-6 shadow-sm">
            <h2 className="text-2xl font-extrabold">
              Support 4th Line Fantasy
            </h2>

            <p className="mt-3 text-sm md:text-base leading-7 text-white/85">
              If this article helped you make a better fantasy hockey move, you can support
              the project by buying me a coffee or checking out the merch shop.
            </p>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href={BUY_ME_A_COFFEE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-white px-4 py-3 text-center text-sm font-extrabold text-[#0F2A44] transition hover:shadow-[0_0_0_2px_#FF8A00,0_0_18px_#FF8A00]"
              >
                Buy Me a Coffee
              </a>

              <a
                href={ETSY_SHOP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-white/10 px-4 py-3 text-center text-sm font-extrabold text-white border border-white/25 transition hover:shadow-[0_0_0_2px_#FF8A00,0_0_18px_#FF8A00]"
              >
                Shop Merch
              </a>
            </div>
          </section>

          <p className="mt-5 max-w-[76ch] mx-auto text-[11px] leading-5 text-[#0F2A44]/45">
            Disclosure: Some links may be affiliate or support links. If you choose to use them,
            4th Line Fantasy may earn a small commission or receive support at no extra cost to you.
          </p>
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