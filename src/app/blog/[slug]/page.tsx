import AffiliateDisclosure from '@/components/AffiliateDisclosure';
import fs from 'fs';
import matter from 'gray-matter';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import path from 'path';
import { remark } from 'remark';
import html from 'remark-html';

// Keep static unless you want dynamic rendering
export const dynamic = 'force-static';

export default async function BlogPostPage({
  params,
}: {
  // ✅ Next 15 expects params as a Promise
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

  const processedContent = await remark().use(html).process(content);
  const contentHtml = processedContent.toString();

  const title =
    (data?.title as string) ||
    slug.replace(/-/g, ' ').replace(/\b\w/g, (m: string) => m.toUpperCase());

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

          {/* Content with BIG, skimmable spacing */}
          <div
            className="
              prose prose-lg max-w-none text-[#0F2A44]
              prose-headings:text-[#0F2A44]
              prose-a:font-semibold prose-a:no-underline
              hover:prose-a:shadow-[0_0_0_2px_#FF8A00,0_0_12px_#FF8A00]
              prose-strong:text-[#0F2A44]
              prose-hr:border-[#5CAFE8]/40
              prose-blockquote:border-[#5CAFE8]/50
              prose-figcaption:text-[#0F2A44]/70
              prose-p:mb-12 md:prose-p:mb-14 prose-p:leading-relaxed
              prose-ul:my-10 prose-ol:my-10
              prose-li:my-3 md:prose-li:my-4 prose-li:leading-relaxed
              prose-h2:mt-14 prose-h2:mb-6
              prose-h3:mt-10 prose-h3:mb-4
              prose-table:my-10 prose-img:my-8
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
