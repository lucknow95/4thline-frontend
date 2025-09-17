// src/app/merch/page.tsx
"use client";

import AffiliateDisclosure from "@/components/AffiliateDisclosure";
import SubscribeForm from "@/components/SubscribeForm";

export default function MerchPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] px-4 text-center">
      <div className="w-full max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-3 text-[rgb(var(--brand-dark))]">
          🛍️ 4TH Line Fantasy merch coming soon.
        </h1>

        <p className="mb-8 text-lg" style={{ color: "rgba(var(--brand-dark), 0.85)" }}>
          Has the site helped you in your fantasy matchups? I’d love a coffee to help keep
          optimizing your lineup and building more tools for you.
        </p>

        {/* Primary CTA: Buy Me a Coffee */}
        <div className="mb-8">
          <a
            href="https://buymeacoffee.com/samirwin"
            target="_blank"
            rel="noopener noreferrer"
            className="
              not-prose inline-flex items-center justify-center w-56 px-5 py-2.5 rounded-md font-semibold
              bg-[rgb(var(--brand-dark))] shadow-md transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-amber-400
              !text-white visited:!text-white hover:!text-amber-400 hover:visited:!text-amber-400
            "
          >
            ☕ Buy me a coffee
          </a>
        </div>

        {/* Secondary CTA: merch drop notify (uses unified /api/subscribe) */}
        <div className="space-y-3 rounded-xl border p-4">
          <p className="text-base" style={{ color: "rgba(var(--brand-dark), 0.75)" }}>
            Want first access when merch drops? Enter your email and I’ll let you know.
          </p>

          {/* Reuse shared JSON-posting form, targeting list="merch" */}
          <div className="flex flex-col items-center">
            <SubscribeForm list="merch" />
          </div>

          <p className="text-xs text-neutral-500">
            By subscribing you consent to receive merch updates from 4th Line Fantasy. You can
            unsubscribe at any time.
          </p>
        </div>

        {/* Affiliate Disclosure */}
        <div className="mt-8">
          <AffiliateDisclosure />
        </div>
      </div>
    </main>
  );
}
