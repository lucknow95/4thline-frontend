// src/lib/getBlogPosts.ts
import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';

export interface PostMeta {
  title: string;
  date: string;
  excerpt?: string;
  tags?: string[];
  categories?: string[];
  /** If false, hide from production even if not a draft (default: true) */
  published?: boolean;
  /** If true, treat as a draft and hide from production (default: false) */
  draft?: boolean;
}

export interface Post {
  slug: string;
  meta: PostMeta;
}

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

function isVisible(meta: PostMeta, showDrafts: boolean): boolean {
  const isDraft = meta.draft === true;
  const isPublished = meta.published !== false; // undefined => true

  if (showDrafts) return true; // local preview shows everything
  if (!isPublished) return false;
  if (isDraft) return false;
  return true;
}

export function getBlogPosts(): Post[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const showDrafts = process.env.SHOW_DRAFTS === 'true';

  const filenames = fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));

  const posts: Post[] = filenames.map((filename) => {
    const filePath = path.join(BLOG_DIR, filename);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const { data } = matter(fileContents);

    const slug = filename.replace(/\.(md|mdx)$/, '');
    const meta: PostMeta = {
      title: data.title ?? slug,
      date: data.date ?? new Date().toISOString(),
      excerpt: data.excerpt ?? '',
      tags: data.tags ?? [],
      categories: data.categories ?? [],
      published: data.published,
      draft: data.draft,
    };

    return { slug, meta };
  });

  // Hide drafts/unpublished (unless SHOW_DRAFTS=true) and sort by date desc
  return posts
    .filter((p) => isVisible(p.meta, showDrafts))
    .sort((a, b) => (a.meta.date < b.meta.date ? 1 : -1));
}
