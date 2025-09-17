// src/app/blog/page.tsx
import { getBlogPosts } from '@/lib/getBlogPosts';
import BlogClient from './BlogClient';

export default function BlogIndexPage() {
  // By default, do NOT include drafts in the index.
  // (If you ever want to preview drafts locally, you could pass:
  //   { includeDrafts: process.env.NODE_ENV !== 'production' }
  // but keeping it strict avoids confusion with 404s on the slug page.)
  const allPosts = getBlogPosts();

  return <BlogClient allPosts={allPosts} />;
}
