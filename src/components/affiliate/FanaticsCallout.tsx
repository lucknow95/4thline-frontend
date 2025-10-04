// src/components/affiliate/FanaticsCallout.tsx
"use client";

import Link from "next/link";
import { useCallback, useId } from "react";

type Props = {
    title?: string;
    note?: string;
    href?: string;
    className?: string; // spacing hook
};

export default function FanaticsCallout({
    title = "Get your licensed gear at Fanatics",
    note = "Officially licensed gear",
    href = "https://fanatics.ca/?utm_source=4thlinefantasy&utm_medium=affiliate&utm_campaign=sitewide_callout",
    className = "",
}: Props) {
    const headingId = useId();

    const onClick = useCallback(() => {
        // TODO: swap to GA4/PostHog later
        // eslint-disable-next-line no-console
        console.log("AffiliateClick", {
            href,
            location: typeof window !== "undefined" ? window.location.pathname : "",
        });
    }, [href]);

    return (
        <Link
            href={href}
            prefetch={false}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={onClick}
            aria-labelledby={headingId}
            className={["group block no-underline outline-none", className].join(" ")}
        >
            <article
                // Card container
                className={[
                    "relative rounded-2xl border p-5 shadow-sm transition-shadow duration-300",
                    // brand-tinted backdrop + subtle border
                    "bg-[rgba(var(--brand-dark),0.04)]",
                    "border-[rgba(var(--brand-dark),0.18)]",
                    // clear hover/focus glow + keyboard ring
                    "group-hover:shadow-[0_0_48px_rgba(var(--brand-dark),0.40)]",
                    "focus-visible:shadow-[0_0_52px_rgba(var(--brand-dark),0.45)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-dark),0.40)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
                    // containment so nothing spills
                    "overflow-hidden max-w-full break-words",
                ].join(" ")}
                style={{ color: "rgba(var(--brand-dark), 0.88)" }}
            >
                {/* Top row: logo/label + faux CTA pill (whole card already links) */}
                <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <img
                            src="/images/brands/fanatics.jpeg"
                            alt="Fanatics"
                            className="h-6 w-6 rounded object-contain shrink-0"
                            loading="lazy"
                        />
                        <span
                            className="truncate text-xs font-semibold uppercase tracking-wide"
                            style={{ color: "rgba(var(--brand-dark), 0.6)" }}
                            title="Fanatics Pick"
                        >
                            Fanatics Pick
                        </span>
                    </div>

                    <span
                        className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium transition shrink-0"
                        style={{ border: "1px solid rgba(var(--brand-dark), 0.25)" }}
                        aria-hidden="true"
                    >
                        Shop Fanatics →
                    </span>
                </div>

                {/* Headline + subcopy */}
                <h3
                    id={headingId}
                    className="text-lg font-semibold leading-tight"
                    style={{ color: "rgb(var(--brand-dark))" }}
                >
                    {title}
                </h3>
                <p className="mt-1 text-sm" style={{ color: "rgba(var(--brand-dark), 0.7)" }}>
                    {note}
                </p>
            </article>
        </Link>
    );
}
