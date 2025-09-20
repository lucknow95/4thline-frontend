import Footer from "@/components/Footer";
import Logo from "@/components/Logo";
import NavLink from "@/components/NavLink";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://4thlinefantasy.com"
  ),
  title: "4th Line Fantasy",
  description: "Fantasy hockey tools",
  icons: {
    icon: ["/brand/favicon-32x32.png", "/brand/favicon-16x16.png"],
    apple: "/brand/apple-touch-icon.png",
  },
  manifest: "/brand/site.webmanifest",
  openGraph: {
    title: "4th Line Fantasy",
    description: "Fantasy hockey tools & insights to give you the edge.",
    images: ["/brand/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "4th Line Fantasy",
    description: "Fantasy hockey tools & insights to give you the edge.",
    images: ["/brand/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col">
        <header className="site-header w-full">
          <nav
            className="mx-auto max-w-6xl px-4 py-3"
            aria-label="Primary"
            role="navigation"
          >
            <ul className="flex flex-wrap items-center gap-6 text-sm">
              <li>
                <NavLink href="/" className="flex items-center gap-2">
                  <Logo size={28} priority />
                  <span>4th Line Fantasy</span>
                  <span className="sr-only">Home</span>
                </NavLink>
              </li>
              <li
                className="h-5 w-px bg-[var(--header-border)]"
                aria-hidden="true"
              />
              <li>
                <NavLink href="/rankings">Rankings</NavLink>
              </li>
              <li>
                <NavLink href="/players">Players</NavLink>
              </li>
              <li>
                <NavLink href="/optimizer">Optimizer</NavLink>
              </li>
              <li>
                <NavLink href="/crunch-palace">Crunch Palace</NavLink>
              </li>
              <li>
                <NavLink href="/blog" exact={false}>
                  Blog
                </NavLink>
              </li>
              <li>
                <NavLink href="/newsletter">Newsletter</NavLink>
              </li>
              <li>
                <NavLink href="/merch">Merch</NavLink>
              </li>
            </ul>
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 flex-grow">
          {children}
        </main>

        <Footer />
      </body>
    </html>
  );
}
