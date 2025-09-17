"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Props = {
    children: React.ReactNode;
    /** Height of the top scrollbar (px). Default 12. */
    trackHeight?: number;
    /** Optional extra classes for the top bar container. */
    className?: string;
};

export default function TopScrollSync({ children, trackHeight = 12, className = "" }: Props) {
    const topRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const [contentWidth, setContentWidth] = useState(0);
    const syncing = useRef<"top" | "bottom" | null>(null);

    // Measure the scrollable content width and keep it updated
    useLayoutEffect(() => {
        const el = bottomRef.current;
        if (!el) return;

        const measure = () => setContentWidth(el.scrollWidth);
        measure();

        const ro = new ResizeObserver(measure);
        ro.observe(el);
        window.addEventListener("resize", measure);

        return () => {
            ro.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, []);

    // Sync scroll positions (top bar mirrors bottom content and vice versa)
    useEffect(() => {
        const top = topRef.current;
        const bottom = bottomRef.current;
        if (!top || !bottom) return;

        const onTop = () => {
            if (syncing.current === "bottom") return;
            syncing.current = "top";
            bottom.scrollLeft = top.scrollLeft;
            syncing.current = null;
        };
        const onBottom = () => {
            if (syncing.current === "top") return;
            syncing.current = "bottom";
            top.scrollLeft = bottom.scrollLeft;
            syncing.current = null;
        };

        top.addEventListener("scroll", onTop, { passive: true });
        bottom.addEventListener("scroll", onBottom, { passive: true });

        return () => {
            top.removeEventListener("scroll", onTop);
            bottom.removeEventListener("scroll", onBottom);
        };
    }, []);

    return (
        <div className="w-full">
            {/* Sticky top scrollbar (only shows if content overflows) */}
            <div
                ref={topRef}
                className={[
                    "sticky top-0 z-10 overflow-x-auto",
                    "bg-[var(--surface-muted)] border border-[var(--border)] border-b-0 rounded-t-xl",
                    "[scrollbar-width:thin]",
                    className,
                ].join(" ")}
                style={{ height: trackHeight }}
                aria-hidden="true"
            >
                {/* Phantom element creates the top track width */}
                <div style={{ width: contentWidth, height: trackHeight }} />
            </div>

            {/* Your original horizontal scroller lives here */}
            <div ref={bottomRef} className="overflow-x-auto border border-[var(--border)] rounded-b-xl">
                {children}
            </div>
        </div>
    );
}
