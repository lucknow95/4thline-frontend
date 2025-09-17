"use client";
import { useState } from "react";

export default function SubscribeForm({ list }: { list: "newsletter" | "merch" }) {
    const [email, setEmail] = useState("");
    const [msg, setMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMsg(null);
        setLoading(true);

        const res = await fetch("/api/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email,
                list,
                sourcePath: typeof window !== "undefined" ? window.location.pathname : null,
            }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
            setMsg(`Error: ${data?.error || res.statusText}`);
        } else {
            setMsg("Success! Check your email to confirm.");
            setEmail("");
        }
        setLoading(false);
    }

    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-[rgb(var(--brand-dark))]"
                autoComplete="email"
                disabled={loading}
                aria-label="Email address"
            />
            <button
                type="submit"
                disabled={loading}
                className="rounded-lg px-4 py-2 font-semibold
                   bg-[rgb(var(--brand-dark))] text-white shadow-md
                   hover:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400
                   disabled:opacity-60 disabled:cursor-not-allowed"
                aria-busy={loading}
            >
                {loading ? "Submitting…" : "Subscribe"}
            </button>
            {msg && <p className="text-sm">{msg}</p>}
        </form>
    );
}
