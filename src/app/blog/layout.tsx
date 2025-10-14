// src/app/blog/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Blog · 4th Line Fantasy",
    description: "Fantasy hockey tools & insights.",
    openGraph: {
        title: "Blog · 4th Line Fantasy",
        description: "Fantasy hockey tools & insights.",
        images: [{ url: "/og/default-og.png", width: 1200, height: 630 }],
    },
    twitter: {
        card: "summary_large_image",
        title: "Blog · 4th Line Fantasy",
        description: "Fantasy hockey tools & insights.",
        images: ["/og/default-og.png"],
    },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
    return children;
}
