// src/app/merch/page.tsx
"use client";

import AffiliateDisclosure from "@/components/AffiliateDisclosure";
import SubscribeForm from "@/components/SubscribeForm";
import FanaticsCallout from "@/components/affiliate/FanaticsCallout";

export default function MerchPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] px-4 text-center">
      <div className="w-full max-w-2xl mx-auto">
        {/* Use a single vertical stack to control spacing uniformly */}
        <div className="flex flex-col gap-10">
          <header>
            <h1 className="text-4xl font-bold mb-3 text-[rgb(var(--brand-dark))]">
              🛍️ 4TH Line Fantasy merch coming soon.
            </h1>
            <p className="text-lg" style={{ color: "rgba(var(--brand-dark), 0.85)" }}>
              Has the site helped you in your fantasy matchups? I’d love a coffee to help keep
              optimizing your lineup and building more tools for you.
            </p>
          </header>

          {/* Primary CTA: Buy Me a Coffee */}
          <div>
            <a
              href="https://buymeacoffee.com/samirwin"
              target="_blank"
              rel="noopener noreferrer"
              className="
                not-prose inline-flex items-center justify-center w-56 h-10 px-5 rounded-md font-semibold
                bg-[rgb(var(--brand-dark))] shadow-md transition-colors duration-200
                focus:outline-none focus:ring-2 focus:ring-amber-400
                !text-white visited:!text-white hover:!text-amber-400 hover:visited:!text-amber-400
              "
            >
              ☕ Buy me a coffee
            </a>
          </div>

          {/* Secondary CTA: merch drop notify (uses unified /api/subscribe) */}
          <section className="space-y-3 rounded-xl border p-4">
            <p className="text-base" style={{ color: "rgba(var(--brand-dark), 0.75)" }}>
              Want first access when merch drops? Enter your email and I’ll let you know.
            </p>

            <div className="flex flex-col items-center">
              <SubscribeForm list="merch" />
            </div>

            <p className="text-xs text-neutral-500">
              By subscribing you consent to receive merch updates from 4th Line Fantasy. You can
              unsubscribe at any time.
            </p>
          </section>

          {/* Fanatics affiliate callout (tinted backdrop + hover glow) */}
          <FanaticsCallout />

          {/* Affiliate Disclosure */}
          <footer>
            <AffiliateDisclosure />
          </footer>
        </div>
      </div>
    </main>
  );
}
